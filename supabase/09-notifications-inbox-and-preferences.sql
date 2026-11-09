
-- Hora Extra only: durable, recipient-scoped notification center.
create table if not exists public.notification_preferences (
 workspace_id uuid not null,
 user_id uuid not null,
 assignments boolean not null default true,
 reminders boolean not null default true,
 events boolean not null default true,
 shopping boolean not null default false,
 stock boolean not null default true,
 team boolean not null default false,
 summaries boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,user_id),
 constraint notification_prefs_member_fk foreign key(workspace_id,user_id)
 references public.memberships(workspace_id,user_id) on delete cascade
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 user_id uuid not null,
 actor_id uuid,
 kind text not null check (kind in ('assignment','reminder','event','shopping','stock','team','summary')),
 title text not null check (char_length(title) between 1 and 160),
 body text not null check (char_length(body) between 1 and 600),
 entity_type text check(entity_type in ('event','task','purchase','stock','team')),
 entity_id uuid,
 event_id uuid,
 dedupe_key text,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 constraint notifications_member_fk foreign key(workspace_id,user_id)
 references public.memberships(workspace_id,user_id) on delete cascade,
 constraint notifications_actor_fk foreign key(actor_id) references auth.users(id) on delete set null,
 constraint notifications_event_fk foreign key(event_id) references public.events(id) on delete set null,
 constraint notifications_dedupe_key_length check(dedupe_key is null or char_length(dedupe_key)<=180)
);
create index if not exists notifications_inbox_idx
 on public.notifications(workspace_id,user_id,created_at desc);
create index if not exists notifications_unread_idx
 on public.notifications(workspace_id,user_id,created_at desc)
 where read_at is null;
create unique index if not exists notifications_dedupe_idx
 on public.notifications(workspace_id,user_id,dedupe_key)
 where dedupe_key is not null;

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
 for select to authenticated using (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
 );
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
 for update to authenticated using (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
 ) with check (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
 );
drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
 for select to authenticated using (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
 );
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
 for insert to authenticated with check (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
 );
drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
 for update to authenticated using (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
 ) with check (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
 );

revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
revoke all on public.notification_preferences from public,anon,authenticated;
grant select,insert on public.notification_preferences to authenticated;
grant update(assignments,reminders,events,shopping,stock,team,summaries,updated_at)
 on public.notification_preferences to authenticated;

comment on table public.notifications is
 'Private inbox per authenticated member and workspace. Insertion is only by database-owned internal routines.';
comment on table public.notification_preferences is
 'Opt-in categories per member and workspace; default flags match Midnight HE UI.';

create or replace function app_private.notify_actor_name(p_workspace uuid,p_actor uuid)
returns text language sql stable security definer set search_path='' as $$
 select coalesce(
  (select nullif(left(trim(m.display_name),60),'') from public.memberships m
   where m.workspace_id=p_workspace and m.user_id=p_actor),
  'Um integrante'
 );
$$;
revoke all on function app_private.notify_actor_name(uuid,uuid) from public,anon,authenticated;

create or replace function app_private.send_notification(
 p_workspace uuid, p_user uuid, p_kind text, p_title text, p_body text,
 p_entity_type text default null,p_entity_id uuid default null,p_event_id uuid default null,
 p_dedupe_key text default null,p_actor uuid default null
) returns void language plpgsql security definer set search_path='' as $$
declare
 p public.notification_preferences%rowtype;
 allowed boolean;
begin
 if p_user is null or p_workspace is null or p_user=p_actor then return; end if;
 if not exists(select 1 from public.memberships m
               where m.workspace_id=p_workspace and m.user_id=p_user) then return; end if;
 select * into p from public.notification_preferences
 where workspace_id=p_workspace and user_id=p_user;
 allowed:=case p_kind
   when 'assignment' then coalesce(p.assignments,true)
   when 'reminder' then coalesce(p.reminders,true)
   when 'event' then coalesce(p.events,true)
   when 'shopping' then coalesce(p.shopping,false)
   when 'stock' then coalesce(p.stock,true)
   when 'team' then coalesce(p.team,false)
   when 'summary' then coalesce(p.summaries,false)
   else false
 end;
 if not allowed then return; end if;
 insert into public.notifications(
 workspace_id,user_id,kind,actor_id,title,body,entity_type,entity_id,event_id,dedupe_key)
 values (p_workspace,p_user,p_kind,p_actor,
         left(p_title,160),left(p_body,600),
         p_entity_type,p_entity_id,p_event_id,p_dedupe_key)
 on conflict do nothing;
end $$;
revoke all on function app_private.send_notification(uuid,uuid,text,text,text,text,uuid,uuid,text,uuid)
 from public,anon,authenticated;

-- Exposing only unread-state mutation to the frontend prevents forged notifications.
-- No direct INSERT, DELETE, or recipient reassignment is granted.
