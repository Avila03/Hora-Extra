-- Hora Extra: esquema inicial de produção (PostgreSQL / Supabase).
-- Aplicar somente em um NOVO projeto Supabase exclusivo.
create extension if not exists pgcrypto;
create schema if not exists app_private;

create table public.workspaces (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.memberships (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','collaborator','viewer')),
 display_name text,
 created_at timestamptz not null default now(),
 primary key(workspace_id,user_id)
);
create table public.areas (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check (length(trim(name))>0),
 kind text not null default 'interno',
 notes text,
 created_at timestamptz not null default now(),
 unique(workspace_id,id)
);
create table public.events (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 title text not null check (length(trim(title))>0),
 event_date date not null,
 start_time time,
 guests int not null default 0 check (guests>=0),
 event_type text,
 status text not null default 'planning' check(status in ('planning','confirmed','active','completed','cancelled')),
 notes text,
 menu_notes text,
 created_at timestamptz not null default now(),
 unique(workspace_id,id)
);
create table public.menu_items (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 event_id uuid not null,
 name text not null,
 quantity numeric(12,3) not null default 1 check(quantity>=0),
 unit text not null default 'un',
 created_at timestamptz not null default now(),
 foreign key (workspace_id,event_id) references public.events(workspace_id,id) on delete cascade
);
create table public.inventory_items (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check(length(trim(name))>0),
 category text not null default 'other',
 quantity numeric(12,3) not null default 0 check(quantity>=0),
 min_quantity numeric(12,3) not null default 0 check(min_quantity>=0),
 unit text not null default 'un',
 area_id uuid,
 expires_on date,
 price numeric(12,2) check(price>=0),
 created_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key (workspace_id,area_id) references public.areas(workspace_id,id)
);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 inventory_item_id uuid not null,
 delta numeric(12,3) not null check (delta<>0),
 reason text not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(workspace_id,inventory_item_id) references public.inventory_items(workspace_id,id)
);
create table public.assets (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null,
 quantity int not null default 0 check(quantity>=0),
 damaged_quantity int not null default 0 check(damaged_quantity>=0 and damaged_quantity<=quantity),
 area_id uuid,
 notes text,
 created_at timestamptz not null default now(),
 foreign key (workspace_id,area_id) references public.areas(workspace_id,id)
);
create table public.shopping_items (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null,
 quantity numeric(12,3) not null default 1 check(quantity>0),
 unit text not null default 'un',
 estimated_unit_price numeric(12,2) check(estimated_unit_price>=0),
 status text not null default 'pending' check(status in ('pending','purchased','received')),
 event_id uuid,
 inventory_item_id uuid,
 notes text,
 created_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key(workspace_id,event_id) references public.events(workspace_id,id),
 foreign key(workspace_id,inventory_item_id) references public.inventory_items(workspace_id,id)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 title text not null,
 due_on date,
 status text not null default 'pending' check(status in ('pending','done')),
 event_id uuid,
 area_id uuid,
 notes text,
 created_at timestamptz not null default now(),
 foreign key(workspace_id,event_id) references public.events(workspace_id,id),
 foreign key(workspace_id,area_id) references public.areas(workspace_id,id)
);
create table public.maintenance_routines (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 title text not null,
 frequency_days integer not null check(frequency_days>0),
 next_due_on date not null,
 last_done_on date,
 area_id uuid,
 notes text,
 created_at timestamptz not null default now(),
 foreign key(workspace_id,area_id) references public.areas(workspace_id,id)
);
create table public.invitations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 code_hash text not null unique,
 role text not null check(role in ('admin','collaborator','viewer')),
 created_by uuid not null references auth.users(id),
 expires_at timestamptz not null,
 redeemed_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);

-- Internal authorization, not exposed through the PostgREST API.
create or replace function app_private.role_level(p_workspace uuid)
returns int language sql stable security definer set search_path='' as $$
 select coalesce(max(case m.role when 'owner' then 3 when 'admin' then 2 when 'collaborator' then 1 else 0 end),-1)
 from public.memberships m where m.workspace_id=p_workspace and m.user_id=(select auth.uid())
$$;
revoke all on function app_private.role_level(uuid) from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.role_level(uuid) to authenticated;

create or replace function app_private.add_workspace_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.memberships(workspace_id,user_id,role)
 values(new.id,new.created_by,'owner');
 return new;
end $$;
revoke all on function app_private.add_workspace_owner() from public;
create trigger on_workspace_created after insert on public.workspaces
for each row execute function app_private.add_workspace_owner();

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
create policy "workspaces_read" on public.workspaces for select to authenticated
 using(app_private.role_level(id)>=0);
create policy "workspaces_insert" on public.workspaces for insert to authenticated
 with check(created_by=(select auth.uid()));
create policy "workspaces_update" on public.workspaces for update to authenticated
 using(app_private.role_level(id)>=2) with check(app_private.role_level(id)>=2 and created_by=(select created_by from public.workspaces where id=workspaces.id));
create policy "memberships_read" on public.memberships for select to authenticated
 using(app_private.role_level(workspace_id)>=0);

-- Members and roles are never client-writable: manage them through
-- narrowly audited invitations/RPCs in a future migration.
-- No direct delete policies: preserve audit records until server-side flows exist.
do $$
declare t text;
begin
 foreach t in array array['areas','events','menu_items','inventory_items','assets','shopping_items','tasks','maintenance_routines'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy %I on public.%I for select to authenticated using (app_private.role_level(workspace_id)>=0)',t||'_read',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (app_private.role_level(workspace_id)>=1)',t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (app_private.role_level(workspace_id)>=1) with check (app_private.role_level(workspace_id)>=1)',t||'_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using (app_private.role_level(workspace_id)>=2)',t||'_delete',t);
 end loop;
end $$;
alter table public.inventory_movements enable row level security;
create policy movements_read on public.inventory_movements for select to authenticated using(app_private.role_level(workspace_id)>=0);
alter table public.invitations enable row level security;
create policy invitations_read on public.invitations for select to authenticated using(app_private.role_level(workspace_id)>=2);

-- Inventory quantity is updated in a locked transaction through this RPC.
create or replace function public.record_inventory_movement(
 p_item_id uuid,p_delta numeric,p_reason text
) returns void language plpgsql security definer set search_path='' as $$
declare v_item public.inventory_items%rowtype;
begin
 if p_delta is null or p_delta=0 or p_reason is null or length(trim(p_reason))=0 then
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
revoke all on function public.record_inventory_movement(uuid,numeric,text) from public,anon;
grant execute on function public.record_inventory_movement(uuid,numeric,text) to authenticated;

-- Prevent editing quantity directly: use movement RPC so audit stays complete.
create or replace function app_private.guard_stock_quantity()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.quantity is distinct from new.quantity and current_user <> 'postgres' then
  raise exception 'Estoque só pode ser alterado via movimentação';
 end if;
 return new;
end $$;
-- Activate quantity guard only after implementing an authenticated RPC
-- strategy using a trusted transaction flag and direct-write restrictions.

create index events_workspace_date_idx on public.events(workspace_id,event_date);
create index tasks_workspace_due_idx on public.tasks(workspace_id,due_on);
create index inventory_workspace_name_idx on public.inventory_items(workspace_id,name);
create index movements_workspace_time_idx on public.inventory_movements(workspace_id,created_at desc);
create index routines_workspace_next_idx on public.maintenance_routines(workspace_id,next_due_on);
