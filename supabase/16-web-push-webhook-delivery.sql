-- Hora Extra: only a trusted database webhook + Edge service key may claim push payloads.
-- Secrets are stored separately in Supabase Vault, never in source control.
create or replace function app_private.he_push_token_is_valid(p_token text)
returns boolean language sql stable security definer set search_path='' as $$
 select p_token is not null and length(p_token)>=48 and exists (
  select 1 from vault.decrypted_secrets s
  where s.name='he_push_dispatch_secret'
    and extensions.digest(s.decrypted_secret,'sha256')=extensions.digest(p_token,'sha256')
 );
$$;
revoke all on function app_private.he_push_token_is_valid(text) from public,anon,authenticated;

create or replace function app_private.he_push_claim_impl(p_notification_id uuid,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 msg public.notifications%rowtype;
 destinations jsonb;
 public_key text;
 private_key text;
begin
 if not app_private.he_push_token_is_valid(p_token) then
   raise exception 'Invalid push webhook authentication' using errcode='28000';
 end if;
 select * into msg from public.notifications
  where id=p_notification_id and push_claimed_at is null for update;
 if not found then return null; end if;
 select jsonb_agg(jsonb_build_object(
  'id',s.id,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth_key
 )) into destinations
 from public.push_subscriptions s
 where s.workspace_id=msg.workspace_id and s.user_id=msg.user_id;
 if destinations is null then return null; end if;
 select decrypted_secret into public_key from vault.decrypted_secrets where name='he_push_vapid_public';
 select decrypted_secret into private_key from vault.decrypted_secrets where name='he_push_vapid_private';
 if public_key is null or private_key is null then
   raise exception 'VAPID keys not configured';
 end if;
 update public.notifications set push_claimed_at=now() where id=msg.id;
 return jsonb_build_object(
  'id',msg.id,'title',msg.title,'body',msg.body,
  'url','/?he_space='||msg.workspace_id::text||'&he_push='||msg.id::text,
  'subscriptions',destinations,
  'vapid_public',public_key,'vapid_private',private_key,
  'vapid_subject','https://horaextra.vercel.app'
 );
end $$;
revoke all on function app_private.he_push_claim_impl(uuid,text) from public,anon,authenticated;
grant execute on function app_private.he_push_claim_impl(uuid,text) to service_role;
create or replace function public.he_push_claim(p_notification_id uuid,p_token text)
returns jsonb language sql security invoker set search_path='' as $$
 select app_private.he_push_claim_impl(p_notification_id,p_token);
$$;
revoke all on function public.he_push_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.he_push_claim(uuid,text) to service_role;

create or replace function app_private.he_push_prune_impl(p_id uuid,p_token text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not app_private.he_push_token_is_valid(p_token) then
  raise exception 'Invalid push webhook authentication' using errcode='28000';
 end if;
 delete from public.push_subscriptions where id=p_id;
 return found;
end $$;
revoke all on function app_private.he_push_prune_impl(uuid,text) from public,anon,authenticated;
grant execute on function app_private.he_push_prune_impl(uuid,text) to service_role;
create or replace function public.he_push_prune(p_id uuid,p_token text)
returns boolean language sql security invoker set search_path='' as $$
 select app_private.he_push_prune_impl(p_id,p_token);
$$;
revoke all on function public.he_push_prune(uuid,text) from public,anon,authenticated;
grant execute on function public.he_push_prune(uuid,text) to service_role;

create or replace function app_private.he_queue_push()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 webhook_secret text;
begin
 if not exists(select 1 from public.push_subscriptions s
    where s.workspace_id=new.workspace_id and s.user_id=new.user_id) then
  return new;
 end if;
 select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name='he_push_dispatch_secret';
 if webhook_secret is null then
  raise warning 'Hora Extra push webhook is missing secret';
  return new;
 end if;
 perform net.http_post(
  url:='https://uajgzhfelwdsrigtfvwc.supabase.co/functions/v1/hora-extra-push',
  body:=jsonb_build_object('notification_id',new.id),
  headers:=jsonb_build_object(
    'Content-Type','application/json','x-he-push-secret',webhook_secret
  ),
  timeout_milliseconds:=5000
 );
 return new;
exception when others then
  raise warning 'Hora Extra push queue error: %',sqlerrm;
  return new;
end $$;
revoke all on function app_private.he_queue_push() from public,anon,authenticated;
drop trigger if exists he_notify_push_delivery on public.notifications;
create trigger he_notify_push_delivery after insert on public.notifications
for each row execute function app_private.he_queue_push();
