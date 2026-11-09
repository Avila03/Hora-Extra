-- Hora Extra: compromissos compartilhados e responsáveis.
-- Aplicar somente no projeto Supabase uajgzhfelwdsrigtfvwc.
alter table public.tasks
 add column if not exists kind text not null default 'general',
 add column if not exists assigned_to uuid,
 add column if not exists created_by uuid default auth.uid();

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
 check (status in ('pending','in_progress','done'));
alter table public.tasks add constraint tasks_kind_check
 check (kind in ('general','purchase','maintenance'));

-- Referência composta impede atribuição de responsável fora do espaço.
alter table public.tasks add constraint tasks_assignee_membership_fkey
 foreign key (workspace_id,assigned_to)
 references public.memberships(workspace_id,user_id)
 on delete set null (assigned_to);

alter table public.tasks add constraint tasks_created_by_fkey
 foreign key (created_by) references auth.users(id) on delete set null;

create index if not exists tasks_workspace_assignee_idx
 on public.tasks(workspace_id,assigned_to,status);
create index if not exists tasks_workspace_kind_idx
 on public.tasks(workspace_id,kind,due_on);

-- As políticas RLS do workspace permanecem ativas.
grant update(kind,assigned_to) on public.tasks to authenticated;
comment on column public.tasks.kind is 'Tipo: general (tarefa), purchase (compra), maintenance (manutenção)';
comment on column public.tasks.assigned_to is 'Responsável, necessariamente membro do mesmo workspace';
