-- Allow users to request ONLY their own reminders; private dispatcher remains locked.
create or replace function app_private.refresh_my_reminders_guarded(p_workspace uuid)
returns void language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=(select auth.uid());
begin
 if current_user_id is null or not exists(
   select 1 from public.memberships m
   where m.workspace_id=p_workspace and m.user_id=current_user_id
 ) then
   raise exception 'Acesso negado ao espaço';
 end if;
 perform app_private.create_member_reminders(p_workspace,current_user_id);
end $$;
revoke all on function app_private.refresh_my_reminders_guarded(uuid) from public,anon;
grant execute on function app_private.refresh_my_reminders_guarded(uuid) to authenticated;

create or replace function public.refresh_my_reminders(p_workspace uuid)
returns void language sql security invoker set search_path='' as $$
 select app_private.refresh_my_reminders_guarded(p_workspace);
$$;
revoke all on function public.refresh_my_reminders(uuid) from public,anon;
grant execute on function public.refresh_my_reminders(uuid) to authenticated;
