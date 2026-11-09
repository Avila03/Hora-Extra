-- Hora Extra: Web Push subscriptions and secure delivery controls.
create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  device_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscription_member_fk foreign key (workspace_id,user_id)
    references public.memberships(workspace_id,user_id) on delete cascade,
  constraint push_endpoint_secure check (
    length(endpoint) between 20 and 2048 and endpoint ~ '^https://[^[:space:]]+$'
  ),
  constraint push_keys_valid check (length(p256dh) between 40 and 200 and length(auth_key) between 15 and 100),
  constraint push_label_length check (device_label is null or length(device_label)<=100),
  constraint push_unique_device_workspace unique(workspace_id,user_id,endpoint)
);
create index if not exists push_subscriptions_recipient_idx on public.push_subscriptions(workspace_id,user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists he_push_select_own on public.push_subscriptions;
create policy he_push_select_own on public.push_subscriptions
for select to authenticated using (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
);
drop policy if exists he_push_insert_own on public.push_subscriptions;
create policy he_push_insert_own on public.push_subscriptions
for insert to authenticated with check (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
);
drop policy if exists he_push_update_own on public.push_subscriptions;
create policy he_push_update_own on public.push_subscriptions
for update to authenticated using (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
) with check (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
);
drop policy if exists he_push_delete_own on public.push_subscriptions;
create policy he_push_delete_own on public.push_subscriptions
for delete to authenticated using (
  user_id=(select auth.uid()) and app_private.role_level(workspace_id)>=0
);
revoke all on public.push_subscriptions from public,anon,authenticated;
grant select,insert,delete on public.push_subscriptions to authenticated;
grant update(p256dh,auth_key,device_label,updated_at) on public.push_subscriptions to authenticated;

alter table public.notifications
add column if not exists push_claimed_at timestamptz;

create or replace function app_private.he_push_test(p_workspace uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null or not exists (
    select 1 from public.memberships
    where workspace_id=p_workspace and user_id=v_user
  ) then raise exception 'Acesso negado ao espaço'; end if;
  if not exists (
    select 1 from public.push_subscriptions
    where workspace_id=p_workspace and user_id=v_user
  ) then raise exception 'Primeiro ative as notificações push neste dispositivo'; end if;
  insert into public.notifications(
     workspace_id,user_id,kind,title,body,entity_type,dedupe_key
  ) values(
     p_workspace,v_user,'reminder','Teste do Hora Extra',
     'As notificações na tela bloqueada estão configuradas.','team',
     'push_test:'||v_user::text||':'||to_char(now() at time zone 'UTC','YYYYMMDDHH24MI')
  ) on conflict do nothing returning id into v_id;
  return v_id is not null;
end $$;
revoke all on function app_private.he_push_test(uuid) from public,anon;
grant execute on function app_private.he_push_test(uuid) to authenticated;
create or replace function public.send_my_push_test(p_workspace uuid)
returns boolean language sql security invoker set search_path='' as $$
 select app_private.he_push_test(p_workspace);
$$;
revoke all on function public.send_my_push_test(uuid) from public,anon;
grant execute on function public.send_my_push_test(uuid) to authenticated;
