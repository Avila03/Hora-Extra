-- Hora Extra: responsáveis pelos itens necessários e compras do evento.
-- Este script altera exclusivamente o Supabase Hora Extra.
ALTER TABLE public.event_requirements
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

ALTER TABLE public.event_requirements
  ADD CONSTRAINT event_requirements_assignee_membership_fkey
  FOREIGN KEY (workspace_id, assigned_to)
  REFERENCES public.memberships(workspace_id,user_id)
  ON DELETE SET NULL (assigned_to);

CREATE INDEX IF NOT EXISTS event_requirements_event_assignee_idx
  ON public.event_requirements(workspace_id,event_id,assigned_to);

-- Somente campos de negócio, nunca ids/workspace/autor.
GRANT UPDATE(name,quantity,unit,inventory_item_id,purchase_status,is_done,notes,assigned_to)
 ON public.event_requirements TO authenticated;

COMMENT ON COLUMN public.event_requirements.assigned_to IS
 'Responsável por providenciar o item; deve pertencer à equipe do mesmo espaço.';
