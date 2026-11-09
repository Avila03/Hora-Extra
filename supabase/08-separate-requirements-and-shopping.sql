-- Hora Extra - separate logistical requirements from actual event purchases.
-- Existing requirements are retained; older records marked buy/partial are COPIED once to purchases.
alter table public.shopping_items
  add column if not exists assigned_to uuid,
  add column if not exists migration_source_requirement_id uuid;

alter table public.shopping_items
  add constraint shopping_items_assignee_membership_fkey
  foreign key (workspace_id,assigned_to)
  references public.memberships(workspace_id,user_id)
  on delete set null (assigned_to);

create index if not exists shopping_items_event_assignee_idx
  on public.shopping_items(workspace_id,event_id,assigned_to,status);
create unique index if not exists shopping_items_migration_source_unique
  on public.shopping_items(workspace_id,migration_source_requirement_id)
  where migration_source_requirement_id is not null;

grant update(name,quantity,unit,estimated_unit_price,status,notes,assigned_to)
 on public.shopping_items to authenticated;

-- The old purchase_status column remains for backwards compatibility, but
-- is never consumed by the new purchasing UI. New logistical entries don't default to "buy".
alter table public.event_requirements alter column purchase_status set default 'have';
comment on column public.event_requirements.purchase_status is
 'Legacy field retained for compatibility. New shopping lists use public.shopping_items exclusively.';
comment on column public.shopping_items.migration_source_requirement_id is
 'One-time migration provenance only; shopping items and logistical requirements are independent thereafter.';

insert into public.shopping_items (
 workspace_id,event_id,inventory_item_id,name,quantity,unit,
 status,notes,assigned_to,migration_source_requirement_id
)
select r.workspace_id,r.event_id,r.inventory_item_id,r.name,r.quantity,r.unit,
 case when r.is_done then 'purchased' else 'pending' end,
 r.notes,r.assigned_to,r.id
from public.event_requirements r
where r.purchase_status in ('buy','partial')
on conflict (workspace_id,migration_source_requirement_id)
 where migration_source_requirement_id is not null do nothing;
