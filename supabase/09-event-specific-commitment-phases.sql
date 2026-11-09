-- Hora Extra: compromissos de cada janta, antes, durante ou após o evento.
-- Somente projeto Supabase Hora Extra.
alter table public.tasks add column if not exists event_phase text not null default 'before';
alter table public.tasks drop constraint if exists tasks_event_phase_check;
alter table public.tasks add constraint tasks_event_phase_check
 check (event_phase in ('before','during','after'));
grant update(event_phase) on public.tasks to authenticated;
create index if not exists tasks_event_phase_idx on public.tasks(workspace_id,event_id,event_phase,status);
comment on column public.tasks.event_phase is 'Fase das tarefas vinculadas ao evento: before, during ou after; outras tarefas mantêm before por compatibilidade.';
