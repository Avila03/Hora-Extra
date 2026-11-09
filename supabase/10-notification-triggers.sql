
-- Database-generated notifications (no untrusted client-side INSERTs).
create or replace function app_private.he_notification_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 recipient record;
 actor uuid := (select auth.uid());
 label text;
begin
 if tg_op='UPDATE' and not (
   new.event_date is distinct from old.event_date or
   new.start_time is distinct from old.start_time or
   new.title is distinct from old.title or
   new.status is distinct from old.status
 ) then return new; end if;
 if tg_op='UPDATE' and new.status='cancelled' and old.status='cancelled' then return new; end if;
 label:=app_private.notify_actor_name(new.workspace_id,actor);
 for recipient in select m.user_id from public.memberships m where m.workspace_id=new.workspace_id loop
  perform app_private.send_notification(
    new.workspace_id,recipient.user_id,'event',
    case when tg_op='INSERT' then 'Novo evento cadastrado'
         when new.status='cancelled' then 'Evento cancelado'
         else 'Evento atualizado' end,
    case when tg_op='INSERT' then label||' criou "'||new.title||'" para '||to_char(new.event_date,'DD/MM')||'.'
         when new.status='cancelled' then label||' cancelou "'||new.title||'".'
         else label||' atualizou "'||new.title||'" para '||to_char(new.event_date,'DD/MM')||
           coalesce(' às '||to_char(new.start_time,'HH24:MI'),'')||'.' end,
    'event',new.id,new.id,null,actor
  );
 end loop;
 return new;
end $$;
revoke all on function app_private.he_notification_event() from public,anon,authenticated;
drop trigger if exists he_notify_events on public.events;
create trigger he_notify_events after insert or update of title,event_date,start_time,status
 on public.events for each row execute function app_private.he_notification_event();

create or replace function app_private.he_notification_task()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); label text;
begin
 if tg_op='INSERT' then
  if new.assigned_to is null then return new; end if;
 elsif tg_op='UPDATE' then
  if new.assigned_to is not distinct from old.assigned_to
     or new.assigned_to is null then return new; end if;
 else return new; end if;
 label:=app_private.notify_actor_name(new.workspace_id,actor);
 perform app_private.send_notification(
   new.workspace_id,new.assigned_to,'assignment',
   'Novo compromisso atribuído',
   label||' atribuiu a você: "'||new.title||'".',
   'task',new.id,new.event_id,null,actor);
 return new;
end $$;
revoke all on function app_private.he_notification_task() from public,anon,authenticated;
drop trigger if exists he_notify_tasks on public.tasks;
create trigger he_notify_tasks after insert or update of assigned_to
 on public.tasks for each row execute function app_private.he_notification_task();

create or replace function app_private.he_notification_shopping()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient record; actor uuid:=(select auth.uid());
 label text;
begin
 label:=app_private.notify_actor_name(new.workspace_id,actor);
 if new.assigned_to is not null and
  (tg_op='INSERT' or (tg_op='UPDATE' and new.assigned_to is distinct from old.assigned_to)) then
   perform app_private.send_notification(
    new.workspace_id,new.assigned_to,'assignment',
    'Você ficou responsável por uma compra',
    label||' atribuiu a você a compra: "'||new.name||'".',
    'purchase',new.id,new.event_id,null,actor);
 end if;
 if tg_op='UPDATE' and new.status is distinct from old.status
   and new.status in ('purchased','received') then
  for recipient in
   select m.user_id from public.memberships m
   where m.workspace_id=new.workspace_id and m.role in ('owner','admin')
  loop
   perform app_private.send_notification(
    new.workspace_id,recipient.user_id,'shopping',
    'Compra realizada',
    label||' marcou "'||new.name||'" como '||
     (case when new.status='received' then 'recebido' else 'comprado' end)||'.',
    'purchase',new.id,new.event_id,null,actor);
  end loop;
 end if;
 return new;
end $$;
revoke all on function app_private.he_notification_shopping() from public,anon,authenticated;
drop trigger if exists he_notify_shopping on public.shopping_items;
create trigger he_notify_shopping after insert or update of assigned_to,status
 on public.shopping_items for each row execute function app_private.he_notification_shopping();

create or replace function app_private.he_notification_stock()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient record; actor uuid:=(select auth.uid());
begin
 if old.quantity>old.min_quantity and new.quantity<=new.min_quantity then
  for recipient in select m.user_id from public.memberships m
    where m.workspace_id=new.workspace_id
  loop
   perform app_private.send_notification(
    new.workspace_id,recipient.user_id,'stock',
    'Estoque baixo',
    'O item "'||new.name||'" atingiu o estoque mínimo: '||
      trim(to_char(new.quantity,'FM999999990.999'))||' '||new.unit||'.',
    'stock',new.id,null,null,actor
   );
  end loop;
 end if;
 return new;
end $$;
revoke all on function app_private.he_notification_stock() from public,anon,authenticated;
drop trigger if exists he_notify_stock on public.inventory_items;
create trigger he_notify_stock after update of quantity,min_quantity
 on public.inventory_items for each row execute function app_private.he_notification_stock();

create or replace function app_private.he_notification_member()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient record; actor uuid:=(select auth.uid());
 label text;
begin
 label:=coalesce(nullif(new.display_name,''),'Um integrante');
 for recipient in select m.user_id from public.memberships m
   where m.workspace_id=new.workspace_id and m.role in ('owner','admin')
 loop
  perform app_private.send_notification(
   new.workspace_id,recipient.user_id,'team',
   'Novo integrante na equipe',
   label||' entrou no espaço.',
   'team',new.user_id,null,null,actor);
 end loop;
 return new;
end $$;
revoke all on function app_private.he_notification_member() from public,anon,authenticated;
drop trigger if exists he_notify_memberships on public.memberships;
create trigger he_notify_memberships after insert
 on public.memberships for each row execute function app_private.he_notification_member();
