
-- Hora Extra: reminders generated from real due dates; never from browser-provided content.
create or replace function app_private.create_member_reminders(p_workspace uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  item record;
  event_row record;
  local_date date := (now() at time zone 'America/Sao_Paulo')::date;
  target_at timestamptz;
  pending_tasks integer;
  pending_purchases integer;
  pending_requirements integer;
begin
 if p_workspace is null or p_user is null then return; end if;
 if not exists(select 1 from public.memberships m
     where m.workspace_id=p_workspace and m.user_id=p_user) then return; end if;

 for item in select t.id,t.title,t.due_on,t.event_id
    from public.tasks t
    where t.workspace_id=p_workspace and t.assigned_to=p_user
      and t.status<>'done' and t.due_on=local_date+1
 loop
   perform app_private.send_notification(
     p_workspace,p_user,'reminder','Compromisso para amanhã',
     'Você precisa concluir "'||item.title||'" até amanhã.',
     'task',item.id,item.event_id,
     'task_due:'||item.id::text||':'||item.due_on::text,null);
 end loop;

 for event_row in select e.id,e.title,e.event_date,e.start_time
   from public.events e
   where e.workspace_id=p_workspace
     and e.status not in ('completed','cancelled')
     and e.event_date between local_date and local_date+2
 loop
  target_at:=(event_row.event_date+coalesce(event_row.start_time,time '18:00'))
    at time zone 'America/Sao_Paulo';
  if not (target_at>now() and target_at<=now()+interval '24 hours') then continue; end if;
  select count(*) into pending_tasks
    from public.tasks t where t.workspace_id=p_workspace
      and t.event_id=event_row.id and t.status<>'done';
  select count(*) into pending_purchases
    from public.shopping_items s where s.workspace_id=p_workspace
      and s.event_id=event_row.id and s.status='pending';
  select count(*) into pending_requirements
    from public.event_requirements r where r.workspace_id=p_workspace
      and r.event_id=event_row.id and not r.is_done;
  perform app_private.send_notification(
    p_workspace,p_user,'summary','Resumo da janta: '||event_row.title,
    'Faltam '||pending_tasks||' compromissos, '||pending_purchases||
     ' compras e '||pending_requirements||' materiais para providenciar.',
    'event',event_row.id,event_row.id,
    'event_summary:'||event_row.id::text||':'||event_row.event_date::text||
      ':'||coalesce(event_row.start_time::text,'18:00'),null);
 end loop;
end $$;
revoke all on function app_private.create_member_reminders(uuid,uuid)
 from public,anon,authenticated;

-- May only generate the caller's own reminders for a space they belong to.
create or replace function public.refresh_my_reminders(p_workspace uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if (select auth.uid()) is null or
   not exists(select 1 from public.memberships m
     where m.workspace_id=p_workspace and m.user_id=(select auth.uid()))
 then raise exception 'Acesso negado ao espaço'; end if;
 perform app_private.create_member_reminders(p_workspace,(select auth.uid()));
end $$;
revoke all on function public.refresh_my_reminders(uuid) from public,anon;
grant execute on function public.refresh_my_reminders(uuid) to authenticated;

-- Executable only by the database scheduler / privileged database role.
create or replace function app_private.dispatch_all_due_notifications()
returns void language plpgsql security definer set search_path='' as $$
declare entry record;
begin
 for entry in select m.workspace_id,m.user_id from public.memberships m loop
   perform app_private.create_member_reminders(entry.workspace_id,entry.user_id);
 end loop;
end $$;
revoke all on function app_private.dispatch_all_due_notifications()
 from public,anon,authenticated;
