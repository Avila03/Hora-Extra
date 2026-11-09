-- A single archival closing per event. Stock and damage logs are atomic and never charged twice.
create table if not exists public.event_closeouts(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 event_id uuid not null,
 closed_by uuid references auth.users(id) on delete set null,
 closed_at timestamptz not null default now(),
 notes text,
 leftover_notes text,
 damage_notes text,
 cleanup_notes text,
 pending_task_count integer not null default 0,
 pending_shopping_count integer not null default 0,
 pending_requirement_count integer not null default 0,
 pending_task_titles jsonb not null default '[]'::jsonb,
 constraint he_event_closeouts_event_unique unique(event_id),
 constraint he_event_closeouts_workspace_event_fk
  foreign key(workspace_id,event_id) references public.events(workspace_id,id) on delete cascade,
 constraint he_event_closeout_title_array check(jsonb_typeof(pending_task_titles)='array')
);
create table if not exists public.event_closeout_consumption(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 closeout_id uuid not null references public.event_closeouts(id) on delete cascade,
 inventory_item_id uuid,
 name text not null,
 unit text not null,
 consumed_quantity numeric not null default 0 check(consumed_quantity>=0),
 leftover_quantity numeric not null default 0 check(leftover_quantity>=0),
 stock_deducted boolean not null default false,
 notes text,
 constraint he_closeout_consumption_workspace_fk foreign key(workspace_id)
   references public.workspaces(id) on delete cascade,
 constraint he_closeout_consumption_item_fk
   foreign key(workspace_id,inventory_item_id) references public.inventory_items(workspace_id,id)
   on delete set null (inventory_item_id)
);
create table if not exists public.event_closeout_damages(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 closeout_id uuid not null references public.event_closeouts(id) on delete cascade,
 asset_id uuid,
 name text not null,
 quantity integer not null check(quantity>0),
 notes text,
 constraint he_closeout_damage_workspace_fk foreign key(workspace_id)
   references public.workspaces(id) on delete cascade,
 constraint he_closeout_damage_asset_fk foreign key(workspace_id,asset_id)
   references public.assets(workspace_id,id) on delete set null (asset_id)
);

create index if not exists he_closeouts_workspace_event_idx on public.event_closeouts(workspace_id,event_id);
create index if not exists he_closeout_consumption_idx on public.event_closeout_consumption(workspace_id,closeout_id);
create index if not exists he_closeout_damages_idx on public.event_closeout_damages(workspace_id,closeout_id);
alter table public.event_closeouts enable row level security;
alter table public.event_closeout_consumption enable row level security;
alter table public.event_closeout_damages enable row level security;
create policy he_event_closeouts_select on public.event_closeouts
 for select to authenticated using(app_private.role_level(workspace_id)>=0);
create policy he_closeout_consumption_select on public.event_closeout_consumption
 for select to authenticated using(app_private.role_level(workspace_id)>=0);
create policy he_closeout_damages_select on public.event_closeout_damages
 for select to authenticated using(app_private.role_level(workspace_id)>=0);
revoke all on public.event_closeouts,public.event_closeout_consumption,public.event_closeout_damages
 from public,anon,authenticated;
grant select on public.event_closeouts,public.event_closeout_consumption,public.event_closeout_damages to authenticated;

create or replace function app_private.he_finish_event(
 p_event_id uuid,
 p_notes text default null,
 p_leftovers text default null,
 p_damages_notes text default null,
 p_cleanup text default null,
 p_consumption jsonb default '[]'::jsonb,
 p_asset_damages jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_event public.events%rowtype;
 v_closeout_id uuid;
 v_line jsonb;
 v_item public.inventory_items%rowtype;
 v_asset public.assets%rowtype;
 v_consumed numeric;
 v_leftover numeric;
 v_qty integer;
 v_item_id uuid;
 v_name text;
 v_tasks integer;
 v_shopping integer;
 v_requirements integer;
 v_titles jsonb;
begin
 if (select auth.uid()) is null or p_event_id is null then
  raise exception 'Identifique o evento para encerramento';
 end if;
 select * into v_event from public.events where id=p_event_id for update;
 if not found or app_private.role_level(v_event.workspace_id)<1 then
  raise exception 'Evento não encontrado ou permissão insuficiente';
 end if;
 if v_event.status='cancelled' then raise exception 'Eventos cancelados não podem ser encerrados'; end if;
 if exists(select 1 from public.event_closeouts where event_id=v_event.id) then
   raise exception 'Esta janta já possui relatório de encerramento';
 end if;
 if jsonb_typeof(p_consumption) <> 'array' or jsonb_typeof(p_asset_damages) <> 'array' then
   raise exception 'Listas de consumo ou avarias inválidas';
 end if;
 if jsonb_array_length(p_consumption)>60 or jsonb_array_length(p_asset_damages)>60 then
   raise exception 'Limite de 60 registros por categoria no encerramento';
 end if;
 select count(*),coalesce(jsonb_agg(title order by created_at),'[]'::jsonb)
  into v_tasks,v_titles from public.tasks where workspace_id=v_event.workspace_id
    and event_id=v_event.id and status<>'done';
 select count(*) into v_shopping from public.shopping_items where workspace_id=v_event.workspace_id
  and event_id=v_event.id and status='pending';
 select count(*) into v_requirements from public.event_requirements where workspace_id=v_event.workspace_id
  and event_id=v_event.id and not is_done;

 insert into public.event_closeouts(
  workspace_id,event_id,closed_by,notes,leftover_notes,damage_notes,cleanup_notes,
  pending_task_count,pending_shopping_count,pending_requirement_count,pending_task_titles
 ) values(
  v_event.workspace_id,v_event.id,(select auth.uid()),
  nullif(left(trim(coalesce(p_notes,'')),4000),''),
  nullif(left(trim(coalesce(p_leftovers,'')),4000),''),
  nullif(left(trim(coalesce(p_damages_notes,'')),4000),''),
  nullif(left(trim(coalesce(p_cleanup,'')),4000),''),
  v_tasks,v_shopping,v_requirements,v_titles
 ) returning id into v_closeout_id;

 for v_line in select value from jsonb_array_elements(p_consumption) loop
   if coalesce(v_line->>'inventory_item_id','')='' then
     raise exception 'Selecione um produto do estoque para registrar consumo';
   end if;
   v_item_id:=(v_line->>'inventory_item_id')::uuid;
   select * into v_item from public.inventory_items
    where id=v_item_id and workspace_id=v_event.workspace_id for update;
   if not found then raise exception 'Produto de estoque inexistente'; end if;
   v_consumed:=coalesce((v_line->>'consumed')::numeric,0);
   v_leftover:=coalesce((v_line->>'leftover')::numeric,0);
   if v_consumed<0 or v_leftover<0 or v_consumed>1000000 or v_leftover>1000000 then
    raise exception 'Consumo ou sobra fora dos limites';
   end if;
   if v_consumed=0 and v_leftover=0 then continue; end if;
   if coalesce((v_line->>'deduct')::boolean,false) and v_consumed>0 then
      perform app_private.do_record_inventory_movement(v_item.id,-v_consumed,
        left('Consumo na janta "'||v_event.title||'"',240));
   end if;
   insert into public.event_closeout_consumption(
     workspace_id,closeout_id,inventory_item_id,name,unit,consumed_quantity,
     leftover_quantity,stock_deducted,notes
   ) values (
     v_event.workspace_id,v_closeout_id,v_item.id,v_item.name,v_item.unit,
     v_consumed,v_leftover,
     coalesce((v_line->>'deduct')::boolean,false) and v_consumed>0,
     nullif(left(trim(coalesce(v_line->>'notes','')),500),'')
   );
 end loop;

 for v_line in select value from jsonb_array_elements(p_asset_damages) loop
   if coalesce(v_line->>'asset_id','')='' then raise exception 'Selecione o patrimônio danificado'; end if;
   v_item_id:=(v_line->>'asset_id')::uuid;
   select * into v_asset from public.assets where id=v_item_id and workspace_id=v_event.workspace_id for update;
   if not found then raise exception 'Patrimônio danificado inexistente'; end if;
   v_qty:=(v_line->>'quantity')::integer;
   if v_qty is null or v_qty<1 then raise exception 'Informe a quantidade de itens danificados'; end if;
   perform app_private.he_do_asset_action(v_asset.id,'damage',v_qty,null,
     'Avaria no encerramento: '||v_event.title||
       case when nullif(trim(coalesce(v_line->>'notes','')),'') is not null
       then ' — '||left(trim(v_line->>'notes'),250) else '' end,
     null,null,v_event.id);
   insert into public.event_closeout_damages(
     workspace_id,closeout_id,asset_id,name,quantity,notes
   ) values(
     v_event.workspace_id,v_closeout_id,v_asset.id,v_asset.name,v_qty,
     nullif(left(trim(coalesce(v_line->>'notes','')),500),'')
   );
 end loop;
 update public.events set status='completed' where id=v_event.id;
 return v_closeout_id;
end $$;
revoke all on function app_private.he_finish_event(uuid,text,text,text,text,jsonb,jsonb) from public,anon,authenticated;

create or replace function public.finish_event(
 p_event_id uuid,
 p_notes text default null,
 p_leftovers text default null,
 p_damages_notes text default null,
 p_cleanup text default null,
 p_consumption jsonb default '[]'::jsonb,
 p_asset_damages jsonb default '[]'::jsonb
) returns uuid language sql security invoker set search_path='' as $$
 select app_private.he_finish_event(
  p_event_id,p_notes,p_leftovers,p_damages_notes,p_cleanup,p_consumption,p_asset_damages
 );
$$;
revoke all on function public.finish_event(uuid,text,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.finish_event(uuid,text,text,text,text,jsonb,jsonb) to authenticated;

-- Corrections to narrative notes do not replay stock deductions or damages.
create or replace function app_private.he_update_closeout_notes(
 p_event_id uuid,p_notes text,p_leftovers text,p_damages_notes text,p_cleanup text
) returns void language plpgsql security definer set search_path='' as $$
declare v_closeout public.event_closeouts%rowtype;
begin
 select * into v_closeout from public.event_closeouts where event_id=p_event_id for update;
 if not found or (select auth.uid()) is null or app_private.role_level(v_closeout.workspace_id)<1 then
  raise exception 'Encerramento não encontrado ou sem permissão';
 end if;
 update public.event_closeouts set
  notes=nullif(left(trim(coalesce(p_notes,'')),4000),''),
  leftover_notes=nullif(left(trim(coalesce(p_leftovers,'')),4000),''),
  damage_notes=nullif(left(trim(coalesce(p_damages_notes,'')),4000),''),
  cleanup_notes=nullif(left(trim(coalesce(p_cleanup,'')),4000),'')
 where id=v_closeout.id;
end $$;
revoke all on function app_private.he_update_closeout_notes(uuid,text,text,text,text) from public,anon,authenticated;
create or replace function public.update_event_closeout_notes(
 p_event_id uuid,p_notes text,p_leftovers text,p_damages_notes text,p_cleanup text
) returns void language sql security invoker set search_path='' as $$
 select app_private.he_update_closeout_notes(p_event_id,p_notes,p_leftovers,p_damages_notes,p_cleanup);
$$;
revoke all on function public.update_event_closeout_notes(uuid,text,text,text,text) from public,anon;
grant execute on function public.update_event_closeout_notes(uuid,text,text,text,text) to authenticated;
