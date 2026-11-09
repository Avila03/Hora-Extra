
-- Hora Extra: múltiplos espaços e convites de entrada por link.
-- Somente projeto uajgzhfelwdsrigtfvwc.
drop index if exists public.hora_extra_single_workspace;

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
 for insert to authenticated
 with check (created_by = (select auth.uid()));

-- Os tokens de convite nunca ficam em uma tabela exposta ao browser.
create table if not exists app_private.workspace_invite_links (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null,
 updated_at timestamptz not null default now(),
 constraint workspace_invite_hash_length check (length(token_hash)=64)
);
revoke all on app_private.workspace_invite_links from public, anon, authenticated;

create or replace function app_private.do_create_workspace_invite(p_workspace uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
 if (select auth.uid()) is null or app_private.role_level(p_workspace)<2 then
  raise exception 'Somente administradores podem compartilhar convites';
 end if;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into app_private.workspace_invite_links(workspace_id,token_hash,expires_at,updated_at)
 values(p_workspace,encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '30 days',now())
 on conflict (workspace_id) do update set token_hash=excluded.token_hash,
 expires_at=excluded.expires_at,updated_at=excluded.updated_at;
 return v_token;
end $$;
revoke all on function app_private.do_create_workspace_invite(uuid) from public,anon;
grant execute on function app_private.do_create_workspace_invite(uuid) to authenticated;

create or replace function public.create_workspace_invite(p_workspace uuid)
returns text language sql security invoker set search_path = '' as $$
 select app_private.do_create_workspace_invite(p_workspace);
$$;
revoke all on function public.create_workspace_invite(uuid) from public, anon;
grant execute on function public.create_workspace_invite(uuid) to authenticated;

create or replace function app_private.do_join_workspace_by_link(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_workspace uuid;v_user uuid;v_name text;
begin
 v_user:=(select auth.uid());
 if v_user is null then raise exception 'Entre na sua conta para participar'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
  raise exception 'Link de convite inválido';
 end if;
 select i.workspace_id into v_workspace from app_private.workspace_invite_links i
 where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
 and i.expires_at>now();
 if v_workspace is null then raise exception 'Este convite expirou ou foi revogado'; end if;
 select coalesce(nullif(split_part(u.email,'@',1),''),'Integrante') into v_name
 from auth.users u where u.id=v_user;
 insert into public.memberships(workspace_id,user_id,role,display_name)
 values(v_workspace,v_user,'collaborator',left(coalesce(v_name,'Integrante'),120))
 on conflict (workspace_id,user_id) do nothing;
 return v_workspace;
end $$;
revoke all on function app_private.do_join_workspace_by_link(text) from public,anon;
grant execute on function app_private.do_join_workspace_by_link(text) to authenticated;

create or replace function public.join_workspace_by_link(p_token text)
returns uuid language sql security invoker set search_path = '' as $$
 select app_private.do_join_workspace_by_link(p_token);
$$;
revoke all on function public.join_workspace_by_link(text) from public, anon;
grant execute on function public.join_workspace_by_link(text) to authenticated;

create or replace function app_private.do_revoke_workspace_invite(p_workspace uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or app_private.role_level(p_workspace)<2 then
  raise exception 'Somente administradores podem revogar convites';
 end if;
 delete from app_private.workspace_invite_links where workspace_id=p_workspace;
end $$;
revoke all on function app_private.do_revoke_workspace_invite(uuid) from public,anon;
grant execute on function app_private.do_revoke_workspace_invite(uuid) to authenticated;

create or replace function public.revoke_workspace_invite(p_workspace uuid)
returns void language sql security invoker set search_path='' as $$
 select app_private.do_revoke_workspace_invite(p_workspace);
$$;
revoke all on function public.revoke_workspace_invite(uuid) from public, anon;
grant execute on function public.revoke_workspace_invite(uuid) to authenticated;
