-- Patrimônio auditável — Hora Extra only. Existing assets and damaged counts preserved.
alter table public.assets
  add column if not exists loaned_quantity integer not null default 0,
  add column if not exists maintenance_quantity integer not null default 0,
  add column if not exists archived_at timestamptz;
alter table public.assets drop constraint if exists he_assets_balanced_quantity;
alter table public.assets add constraint he_assets_balanced_quantity check (
  quantity>=0 and damaged_quantity>=0 and loaned_quantity>=0
  and maintenance_quantity>=0
  and damaged_quantity+loaned_quantity+maintenance_quantity<=quantity
);
create unique index if not exists he_assets_workspace_id_id_unique
  on public.assets(workspace_id,id);

create table if not exists public.asset_loans(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 asset_id uuid not null,
 borrower_name text not null check(length(trim(borrower_name)) between 1 and 120),
 quantity integer not null check(quantity>0),
 returned_quantity integer not null default 0 check(returned_quantity>=0 and returned_quantity<=quantity),
 due_on date,
 notes text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 returned_at timestamptz,
 foreign key(workspace_id,asset_id) references public.assets(workspace_id,id) on delete cascade
);
create index if not exists he_asset_loans_workspace_idx
 on public.asset_loans(workspace_id,asset_id,created_at desc);

create table if not exists public.asset_movements(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 asset_id uuid,
 asset_name text not null,
 kind text not null check(kind in ('create','adjust','loan','return','damage','repair_start','repair_finish','archive','restore')),
 quantity integer not null default 0 check(quantity>=0),
 borrower_name text,
 loan_id uuid,
 event_id uuid,
 details text,
 available_after integer,
 damaged_after integer,
 loaned_after integer,
 maintenance_after integer,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 constraint he_asset_movements_asset_fk
   foreign key(workspace_id,asset_id) references public.assets(workspace_id,id) on delete set null (asset_id),
 constraint he_asset_movements_loan_fk
   foreign key(loan_id) references public.asset_loans(id) on delete set null,
 constraint he_asset_movements_event_fk
   foreign key(workspace_id,event_id) references public.events(workspace_id,id) on delete set null (event_id)
);
create index if not exists he_asset_movements_lookup_idx
 on public.asset_movements(workspace_id,asset_id,created_at desc);

alter table public.asset_loans enable row level security;
alter table public.asset_movements enable row level security;
create policy he_asset_loans_read on public.asset_loans
 for select to authenticated using(app_private.role_level(workspace_id)>=0);
create policy he_asset_movements_read on public.asset_movements
 for select to authenticated using(app_private.role_level(workspace_id)>=0);
revoke all on public.asset_loans, public.asset_movements from public,anon,authenticated;
grant select on public.asset_loans,public.asset_movements to authenticated;

-- A direct metadata/count edit from the existing asset editor is recorded too.
create or replace function app_private.he_track_asset_edits()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_kind text; v_text text;
begin
 if current_setting('he.asset_action',true)='active' then return new; end if;
 if tg_op='INSERT' then
   v_kind:='create';
   v_text:='Cadastro inicial do patrimônio';
 else
   if row(new.name,new.quantity,new.damaged_quantity,new.loaned_quantity,new.maintenance_quantity,new.archived_at)
      is not distinct from
      row(old.name,old.quantity,old.damaged_quantity,old.loaned_quantity,old.maintenance_quantity,old.archived_at)
   then return new; end if;
   v_kind:=case when new.archived_at is distinct from old.archived_at then
       case when new.archived_at is null then 'restore' else 'archive' end
     else 'adjust' end;
   v_text:='Cadastro atualizado';
 end if;
 insert into public.asset_movements(
    workspace_id,asset_id,asset_name,kind,quantity,details,
    available_after,damaged_after,loaned_after,maintenance_after,created_by
 ) values(
    new.workspace_id,new.id,new.name,v_kind,
    case when tg_op='INSERT' then new.quantity else abs(new.quantity-old.quantity) end,v_text,
    new.quantity-new.damaged_quantity-new.loaned_quantity-new.maintenance_quantity,
    new.damaged_quantity,new.loaned_quantity,new.maintenance_quantity,(select auth.uid())
 );
 return new;
end $$;
revoke all on function app_private.he_track_asset_edits() from public,anon,authenticated;
drop trigger if exists he_assets_history_trigger on public.assets;
create trigger he_assets_history_trigger after insert or update on public.assets
 for each row execute function app_private.he_track_asset_edits();

-- All checkouts, returns, damage and repairs run as a single locked transaction.
create or replace function app_private.he_do_asset_action(
 p_asset_id uuid,p_kind text,p_quantity integer,p_person text default null,
 p_notes text default null,p_loan_id uuid default null,p_due_on date default null,
 p_event_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_asset public.assets%rowtype;
 v_loan public.asset_loans%rowtype;
 v_person text;
 v_activity uuid;
 v_available integer;
begin
 if (select auth.uid()) is null or p_asset_id is null
   or p_quantity is null or p_quantity<=0 or p_quantity>100000 then
   raise exception 'Informe uma quantidade válida';
 end if;
 select * into v_asset from public.assets where id=p_asset_id for update;
 if not found or app_private.role_level(v_asset.workspace_id)<1 then
   raise exception 'Item não encontrado ou sem permissão';
 end if;
 if v_asset.archived_at is not null then raise exception 'Este item está arquivado'; end if;
 if p_event_id is not null and not exists(
  select 1 from public.events where id=p_event_id and workspace_id=v_asset.workspace_id
 ) then raise exception 'Evento inválido para este patrimônio'; end if;
 v_available:=v_asset.quantity-v_asset.damaged_quantity-v_asset.loaned_quantity-v_asset.maintenance_quantity;
 v_person:=nullif(left(trim(coalesce(p_person,'')),120),'');
 perform set_config('he.asset_action','active',true);

 if p_kind='loan' then
   if v_person is null then raise exception 'Informe quem vai levar o item'; end if;
   if p_quantity>v_available then raise exception 'Quantidade disponível insuficiente para empréstimo'; end if;
   insert into public.asset_loans(
    workspace_id,asset_id,borrower_name,quantity,due_on,notes,created_by
   ) values(
    v_asset.workspace_id,v_asset.id,v_person,p_quantity,p_due_on,left(p_notes,1000),(select auth.uid())
   ) returning * into v_loan;
   update public.assets set loaned_quantity=loaned_quantity+p_quantity where id=v_asset.id;
 elsif p_kind='return' then
   if p_loan_id is null then raise exception 'Selecione o empréstimo a devolver'; end if;
   select * into v_loan from public.asset_loans where id=p_loan_id and asset_id=v_asset.id and workspace_id=v_asset.workspace_id for update;
   if not found then raise exception 'Empréstimo não encontrado'; end if;
   if p_quantity>v_loan.quantity-v_loan.returned_quantity then raise exception 'Devolução maior que o saldo emprestado'; end if;
   v_person:=v_loan.borrower_name;
   update public.asset_loans
      set returned_quantity=returned_quantity+p_quantity,
          returned_at=case when returned_quantity+p_quantity=quantity then now() else null end
      where id=v_loan.id;
   update public.assets set loaned_quantity=loaned_quantity-p_quantity where id=v_asset.id;
 elsif p_kind='damage' then
   if p_quantity>v_available then raise exception 'Não há itens disponíveis suficientes para marcar como avariados'; end if;
   update public.assets set damaged_quantity=damaged_quantity+p_quantity where id=v_asset.id;
 elsif p_kind='repair_start' then
   if p_quantity>v_asset.damaged_quantity then raise exception 'Itens avariados insuficientes'; end if;
   update public.assets
    set damaged_quantity=damaged_quantity-p_quantity,
        maintenance_quantity=maintenance_quantity+p_quantity where id=v_asset.id;
 elsif p_kind='repair_finish' then
   if p_quantity>v_asset.maintenance_quantity then raise exception 'Itens em manutenção insuficientes'; end if;
   update public.assets set maintenance_quantity=maintenance_quantity-p_quantity where id=v_asset.id;
 else raise exception 'Tipo de movimentação inválido'; end if;

 select * into v_asset from public.assets where id=p_asset_id;
 insert into public.asset_movements(
   workspace_id,asset_id,asset_name,kind,quantity,borrower_name,loan_id,event_id,details,
   available_after,damaged_after,loaned_after,maintenance_after,created_by
 ) values (
   v_asset.workspace_id,v_asset.id,v_asset.name,p_kind,p_quantity,
   v_person,case when p_kind in ('loan','return') then v_loan.id else null end,
   p_event_id,nullif(left(trim(coalesce(p_notes,'')),1000),''),
   v_asset.quantity-v_asset.damaged_quantity-v_asset.loaned_quantity-v_asset.maintenance_quantity,
   v_asset.damaged_quantity,v_asset.loaned_quantity,v_asset.maintenance_quantity,(select auth.uid())
 ) returning id into v_activity;
 return v_activity;
end $$;
revoke all on function app_private.he_do_asset_action(uuid,text,integer,text,text,uuid,date,uuid)
 from public,anon,authenticated;
create or replace function public.record_asset_action(
 p_asset_id uuid,p_kind text,p_quantity integer,p_person text default null,
 p_notes text default null,p_loan_id uuid default null,p_due_on date default null,
 p_event_id uuid default null
) returns uuid language sql security invoker set search_path='' as $$
 select app_private.he_do_asset_action(p_asset_id,p_kind,p_quantity,p_person,p_notes,p_loan_id,p_due_on,p_event_id);
$$;
revoke all on function public.record_asset_action(uuid,text,integer,text,text,uuid,date,uuid) from public,anon;
grant execute on function public.record_asset_action(uuid,text,integer,text,text,uuid,date,uuid) to authenticated;
