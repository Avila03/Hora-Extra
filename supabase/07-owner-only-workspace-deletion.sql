
-- Funcao de exclusao segura de um espaco inteiro (sem afetar outros espacos).
-- Nunca invocar sem a acao explicita do proprietario no aplicativo.
create or replace function app_private.do_delete_workspace(
 p_workspace uuid, p_confirmation text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
 v_name text;
 v_user uuid := (select auth.uid());
begin
 if v_user is null or p_workspace is null then
   raise exception 'É necessário entrar na sua conta para excluir um espaço';
 end if;

 select w.name into v_name from public.workspaces w
 where w.id=p_workspace
 for update;

 if v_name is null then
   raise exception 'Espaço não encontrado';
 end if;

 if not exists (
   select 1 from public.memberships m
   where m.workspace_id=p_workspace and m.user_id=v_user and m.role='owner'
 ) then
   raise exception 'Somente o proprietário pode excluir este espaço';
 end if;

 if p_confirmation is null or p_confirmation <> v_name then
   raise exception 'Digite o nome exato do espaço para confirmar a exclusão';
 end if;

 -- FK ON DELETE CASCADE elimina apenas dados vinculados ao mesmo workspace.
 delete from public.workspaces where id=p_workspace;
end
$$;

revoke all on function app_private.do_delete_workspace(uuid,text) from public,anon;
grant execute on function app_private.do_delete_workspace(uuid,text) to authenticated;

create or replace function public.delete_workspace(
 p_workspace uuid, p_confirmation text
) returns void
language sql security invoker set search_path = ''
as $$
 select app_private.do_delete_workspace(p_workspace,p_confirmation);
$$;

revoke all on function public.delete_workspace(uuid,text) from public,anon;
grant execute on function public.delete_workspace(uuid,text) to authenticated;
-- Nenhum usuario pode excluir um espaco por DELETE direto no Data API.
revoke delete on public.workspaces from anon,authenticated;
