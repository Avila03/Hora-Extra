-- Hora Extra · planejamento de eventos (aplicado ao Supabase Hora Extra).
alter table public.menu_items
 add column if not exists course text not null default 'other',
 add column if not exists notes text;

alter table public.menu_items drop constraint if exists menu_items_course_check;
alter table public.menu_items
 add constraint menu_items_course_check
 check (course in ('main','side','drink','dessert','other'));
grant update(course,notes) on public.menu_items to authenticated;

create table if not exists public.event_requirements (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 event_id uuid not null,
 inventory_item_id uuid,
 name text not null check(length(trim(name)) between 1 and 180),
 quantity numeric(12,3) not null default 1 check(quantity>0),
 unit text not null default 'un' check(length(trim(unit)) between 1 and 30),
 purchase_status text not null default 'buy' check(purchase_status in ('buy','have','partial','later')),
 is_done boolean not null default false,
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key (workspace_id,event_id) references public.events(workspace_id,id) on delete cascade,
 foreign key (workspace_id,inventory_item_id) references public.inventory_items(workspace_id,id) on delete set null (inventory_item_id)
);
create index if not exists event_requirements_event_idx on public.event_requirements(workspace_id,event_id,created_at);
create index if not exists menu_items_event_idx on public.menu_items(workspace_id,event_id,created_at);

alter table public.event_requirements enable row level security;
revoke all on public.event_requirements from anon,authenticated;
grant select,insert,delete on public.event_requirements to authenticated;
grant update(name,quantity,unit,purchase_status,is_done,notes,inventory_item_id)
 on public.event_requirements to authenticated;

create policy event_requirements_read on public.event_requirements
 for select to authenticated using (app_private.role_level(workspace_id)>=0);
create policy event_requirements_insert on public.event_requirements
 for insert to authenticated
 with check (app_private.role_level(workspace_id)>=1 and created_by=(select auth.uid()));
create policy event_requirements_update on public.event_requirements
 for update to authenticated
 using (app_private.role_level(workspace_id)>=1)
 with check (app_private.role_level(workspace_id)>=1);
create policy event_requirements_delete on public.event_requirements
 for delete to authenticated using (app_private.role_level(workspace_id)>=2);
