
-- Hora Extra: segurança e membros (exclusivo ao projeto Hora Extra).
create unique index if not exists hora_extra_single_workspace on public.workspaces ((true));

create or replace function app_private.can_bootstrap_workspace()
returns boolean language sql stable security definer set search_path='' as $$
 select not exists (select 1 from public.workspaces)
$$;
revoke all on function app_private.can_bootstrap_workspace() from public;
grant execute on function app_private.can_bootstrap_workspace() to authenticated;
drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
 for insert to authenticated
 with check (created_by=(select auth.uid()) and (select app_private.can_bootstrap_workspace()));

-- Nenhum acesso direto de escrita a membros, convites ou movimentos.
revoke insert,update,delete on public.memberships from anon,authenticated;
revoke insert,update,delete on public.inventory_movements from anon,authenticated;
revoke insert,update,delete on public.invitations from anon,authenticated;

-- A lógica privilegiada permanece no schema privado e não exposto pela API.
create or replace function app_private.do_record_inventory_movement(
 p_item_id uuid,p_delta numeric,p_reason text
) returns void language plpgsql security definer set search_path='' as $$
declare v_item public.inventory_items%rowtype;
begin
 if (select auth.uid()) is null or p_delta is null or p_delta=0
   or p_reason is null or length(trim(p_reason))=0 then
  raise exception 'Movimentação inválida';
 end if;
 select * into v_item from public.inventory_items where id=p_item_id for update;
 if not found or app_private.role_level(v_item.workspace_id)<1 then
  raise exception 'Sem permissão ou item não encontrado';
 end if;
 if v_item.quantity+p_delta<0 then raise exception 'Estoque insuficiente'; end if;
 update public.inventory_items set quantity=quantity+p_delta where id=p_item_id;
 insert into public.inventory_movements(workspace_id,inventory_item_id,delta,reason,created_by)
 values(v_item.workspace_id,p_item_id,p_delta,p_reason,(select auth.uid()));
end $$;
revoke all on function app_private.do_record_inventory_movement(uuid,numeric,text) from public;
grant execute on function app_private.do_record_inventory_movement(uuid,numeric,text) to authenticated;

create or replace function public.record_inventory_movement(p_item_id uuid,p_delta numeric,p_reason text)
returns void language sql security invoker set search_path='' as $$
 select app_private.do_record_inventory_movement(p_item_id,p_delta,p_reason);
$$;
revoke all on function public.record_inventory_movement(uuid,numeric,text) from public,anon;
grant execute on function public.record_inventory_movement(uuid,numeric,text) to authenticated;

drop trigger if exists enforce_stock_movement on public.inventory_items;
create trigger enforce_stock_movement before update of quantity on public.inventory_items
for each row execute function app_private.guard_stock_quantity();

-- Administradores só podem incluir pessoas que já criaram e confirmaram conta.
create or replace function app_private.do_add_member_by_email(
 p_workspace uuid,p_email text,p_role text
) returns void language plpgsql security definer set search_path='' as $$
declare v_level int; v_user uuid; v_old_role text;
begin
 v_level := app_private.role_level(p_workspace);
 if (select auth.uid()) is null or v_level < 2 then
  raise exception 'Somente administradores podem gerenciar a equipe';
 end if;
 if p_role is null or p_role not in ('admin','collaborator','viewer') then
  raise exception 'Papel inválido';
 end if;
 if p_role='admin' and v_level<3 then
  raise exception 'Somente o proprietário concede acesso de administrador';
 end if;
 if p_email is null or length(trim(p_email))<3 then
  raise exception 'E-mail inválido';
 end if;
 select id into v_user from auth.users
 where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null
 limit 1;
 if v_user is null then
  raise exception 'Pessoa não encontrada: ela precisa cadastrar e confirmar o e-mail primeiro';
 end if;
 select role into v_old_role from public.memberships
 where workspace_id=p_workspace and user_id=v_user for update;
 if v_old_role='owner' or (v_old_role='admin' and v_level<3) then
  raise exception 'Sem permissão para alterar esta pessoa';
 end if;
 insert into public.memberships(workspace_id,user_id,role,display_name)
 values(p_workspace,v_user,p_role,trim(p_email))
 on conflict(workspace_id,user_id) do update set
 role=excluded.role,display_name=coalesce(public.memberships.display_name,excluded.display_name);
end $$;
revoke all on function app_private.do_add_member_by_email(uuid,text,text) from public;
grant execute on function app_private.do_add_member_by_email(uuid,text,text) to authenticated;

create or replace function public.add_member_by_email(p_workspace uuid,p_email text,p_role text)
returns void language sql security invoker set search_path='' as $$
 select app_private.do_add_member_by_email(p_workspace,p_email,p_role);
$$;
revoke all on function public.add_member_by_email(uuid,text,text) from public,anon;
grant execute on function public.add_member_by_email(uuid,text,text) to authenticated;

create or replace function app_private.do_remove_member(p_workspace uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_level int; v_target text;
begin
 v_level := app_private.role_level(p_workspace);
 if (select auth.uid()) is null or v_level<2 then
  raise exception 'Sem permissão para remover membros';
 end if;
 select role into v_target from public.memberships
 where workspace_id=p_workspace and user_id=p_user for update;
 if v_target is null then raise exception 'Membro não encontrado'; end if;
 if v_target='owner' or (v_target='admin' and v_level<3) or p_user=(select auth.uid()) then
  raise exception 'Não é permitido remover esta pessoa';
 end if;
 delete from public.memberships where workspace_id=p_workspace and user_id=p_user;
end $$;
revoke all on function app_private.do_remove_member(uuid,uuid) from public;
grant execute on function app_private.do_remove_member(uuid,uuid) to authenticated;

create or replace function public.remove_member(p_workspace uuid,p_user uuid)
returns void language sql security invoker set search_path='' as $$
 select app_private.do_remove_member(p_workspace,p_user);
$$;
revoke all on function public.remove_member(uuid,uuid) from public,anon;
grant execute on function public.remove_member(uuid,uuid) to authenticated;

create or replace function app_private.do_set_my_display_name(p_workspace uuid,p_name text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or p_name is null or length(trim(p_name)) not between 1 and 120 then
  raise exception 'Nome inválido';
 end if;
 update public.memberships set display_name=trim(p_name)
 where workspace_id=p_workspace and user_id=(select auth.uid());
 if not found then raise exception 'Sem acesso ao espaço'; end if;
end $$;
revoke all on function app_private.do_set_my_display_name(uuid,text) from public;
grant execute on function app_private.do_set_my_display_name(uuid,text) to authenticated;

create or replace function public.set_my_display_name(p_workspace uuid,p_name text)
returns void language sql security invoker set search_path='' as $$
 select app_private.do_set_my_display_name(p_workspace,p_name);
$$;
revoke all on function public.set_my_display_name(uuid,text) from public,anon;
grant execute on function public.set_my_display_name(uuid,text) to authenticated;
