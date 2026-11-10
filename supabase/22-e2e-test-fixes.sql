-- 22 — Correções encontradas pela suíte de testes de ponta a ponta (10/11/2026).
-- Aplicar somente no Supabase Hora Extra (uajgzhfelwdsrigtfvwc).

-- 1. Excluir um evento leva junto as compras e os compromissos daquele evento
--    (antes a exclusão falhava por chave estrangeira assim que havia uma compra ou tarefa).
alter table public.shopping_items drop constraint shopping_items_workspace_id_event_id_fkey,
 add constraint shopping_items_workspace_id_event_id_fkey foreign key (workspace_id,event_id)
 references public.events(workspace_id,id) on delete cascade;
alter table public.tasks drop constraint tasks_workspace_id_event_id_fkey,
 add constraint tasks_workspace_id_event_id_fkey foreign key (workspace_id,event_id)
 references public.events(workspace_id,id) on delete cascade;

-- 2. Excluir um produto do estoque leva junto o histórico dele e solta vínculos opcionais
--    (antes falhava assim que o produto tinha qualquer movimentação).
alter table public.inventory_movements drop constraint inventory_movements_workspace_id_inventory_item_id_fkey,
 add constraint inventory_movements_workspace_id_inventory_item_id_fkey foreign key (workspace_id,inventory_item_id)
 references public.inventory_items(workspace_id,id) on delete cascade;
alter table public.shopping_items drop constraint shopping_items_workspace_id_inventory_item_id_fkey,
 add constraint shopping_items_workspace_id_inventory_item_id_fkey foreign key (workspace_id,inventory_item_id)
 references public.inventory_items(workspace_id,id) on delete set null (inventory_item_id);

-- 3. Arquivar/reativar patrimônio por RPC protegida
--    (a tela atualizava archived_at direto, mas a coluna nunca foi liberada: sempre "permission denied").
create or replace function app_private.he_set_asset_archived(p_asset_id uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_asset public.assets%rowtype;
begin
 if (select auth.uid()) is null or p_asset_id is null or p_archived is null then
  raise exception 'Informe o patrimônio';
 end if;
 select * into v_asset from public.assets where id=p_asset_id for update;
 if not found or app_private.role_level(v_asset.workspace_id)<2 then
  raise exception 'Somente administradores arquivam ou reativam patrimônio';
 end if;
 if p_archived and (v_asset.loaned_quantity>0 or v_asset.maintenance_quantity>0) then
  raise exception 'Devolva os empréstimos e conclua as manutenções antes de arquivar';
 end if;
 update public.assets
    set archived_at=case when p_archived then coalesce(archived_at,now()) else null end
  where id=v_asset.id;
end $$;
revoke all on function app_private.he_set_asset_archived(uuid,boolean) from public, anon;
grant execute on function app_private.he_set_asset_archived(uuid,boolean) to authenticated;
create or replace function public.set_asset_archived(p_asset_id uuid, p_archived boolean)
returns void language sql security invoker set search_path = '' as $$
 select app_private.he_set_asset_archived(p_asset_id,p_archived);
$$;
revoke all on function public.set_asset_archived(uuid,boolean) from public, anon;
grant execute on function public.set_asset_archived(uuid,boolean) to authenticated;

-- 4. Saldos internos do patrimônio só mudam pelas RPCs auditadas
revoke insert on public.assets from authenticated;
grant insert (id, workspace_id, name, quantity, damaged_quantity, area_id, notes, created_at)
 on public.assets to authenticated;

-- 4b. TRUNCATE ignora RLS e não é usado pelo app: retirado dos papéis da API.
do $$
declare r record;
begin
 for r in select tablename from pg_tables where schemaname='public' loop
  execute format('revoke truncate on public.%I from anon, authenticated', r.tablename);
 end loop;
end $$;

-- 5. Nomes de exibição: proprietário passa a ter nome; ninguém aparece com e-mail completo
create or replace function app_private.add_workspace_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.memberships(workspace_id,user_id,role,display_name)
 values(new.id,new.created_by,'owner',
  (select left(coalesce(nullif(split_part(u.email,'@',1),''),'Proprietário'),120)
     from auth.users u where u.id=new.created_by));
 return new;
end $$;

create or replace function app_private.do_add_member_by_email(p_workspace uuid, p_email text, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_level int; v_user uuid; v_old_role text;
begin
 v_level := app_private.role_level(p_workspace);
 if (select auth.uid()) is null or v_level < 2 then
  raise exception 'Somente administradores podem gerenciar a equipe';
 end if;
 if p_role is null or p_role not in ('admin','collaborator','viewer') then raise exception 'Papel inválido'; end if;
 if p_role='admin' and v_level<3 then raise exception 'Somente o proprietário concede acesso de administrador'; end if;
 if p_email is null or length(trim(p_email))<3 then raise exception 'E-mail inválido'; end if;
 select id into v_user from auth.users
  where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null limit 1;
 if v_user is null then
  raise exception 'Pessoa não encontrada: ela precisa cadastrar e confirmar o e-mail primeiro';
 end if;
 select role into v_old_role from public.memberships where workspace_id=p_workspace and user_id=v_user for update;
 if v_old_role='owner' or (v_old_role='admin' and v_level<3) then
  raise exception 'Sem permissão para alterar esta pessoa';
 end if;
 insert into public.memberships(workspace_id,user_id,role,display_name)
 values(p_workspace,v_user,p_role,left(coalesce(nullif(split_part(trim(p_email),'@',1),''),'Integrante'),120))
 on conflict(workspace_id,user_id) do update set
  role=excluded.role,display_name=coalesce(public.memberships.display_name,excluded.display_name);
end $$;

update public.memberships m
   set display_name=left(coalesce(nullif(split_part(u.email,'@',1),''),'Integrante'),120)
  from auth.users u
 where u.id=m.user_id and (m.display_name is null or trim(m.display_name)='' or m.display_name like '%@%');

-- 6. Quantidade inicial de um produto entra no histórico de movimentações
create or replace function app_private.he_log_initial_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.quantity>0 and (select auth.uid()) is not null then
  insert into public.inventory_movements(workspace_id,inventory_item_id,delta,reason,created_by)
  values(new.workspace_id,new.id,new.quantity,'Estoque inicial',(select auth.uid()));
 end if;
 return new;
end $$;
revoke all on function app_private.he_log_initial_stock() from public, anon, authenticated;
drop trigger if exists he_inventory_initial_movement on public.inventory_items;
create trigger he_inventory_initial_movement after insert on public.inventory_items
for each row execute function app_private.he_log_initial_stock();

-- 7. Alterar o papel de um integrante (antes só era possível entrar como colaborador,
--    sem nenhum caminho na interface para administrador ou visualizador).
create or replace function app_private.he_set_member_role(p_workspace uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_level int; v_old text; v_me uuid := (select auth.uid());
begin
 v_level := app_private.role_level(p_workspace);
 if v_me is null or v_level<2 then raise exception 'Somente administradores gerenciam a equipe'; end if;
 if p_role is null or p_role not in ('admin','collaborator','viewer') then raise exception 'Papel inválido'; end if;
 if p_user is null or p_user=v_me then raise exception 'Você não pode alterar o seu próprio papel'; end if;
 select role into v_old from public.memberships where workspace_id=p_workspace and user_id=p_user for update;
 if v_old is null then raise exception 'Integrante não encontrado neste espaço'; end if;
 if v_old='owner' then raise exception 'O papel do proprietário não pode ser alterado'; end if;
 if (p_role='admin' or v_old='admin') and v_level<3 then
  raise exception 'Somente o proprietário concede ou retira acesso de administrador';
 end if;
 update public.memberships set role=p_role where workspace_id=p_workspace and user_id=p_user;
end $$;
revoke all on function app_private.he_set_member_role(uuid,uuid,text) from public, anon;
grant execute on function app_private.he_set_member_role(uuid,uuid,text) to authenticated;
create or replace function public.set_member_role(p_workspace uuid, p_user uuid, p_role text)
returns void language sql security invoker set search_path = '' as $$
 select app_private.he_set_member_role(p_workspace,p_user,p_role);
$$;
revoke all on function public.set_member_role(uuid,uuid,text) from public, anon;
grant execute on function public.set_member_role(uuid,uuid,text) to authenticated;
