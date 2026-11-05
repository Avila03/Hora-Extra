-- Execute após schema.sql no banco exclusivo Hora Extra.
-- Impede que clientes alterem quantidade diretamente sem histórico.
revoke update on public.inventory_items from authenticated;
grant update(name,category,min_quantity,unit,area_id,expires_on,price)
on public.inventory_items to authenticated;
-- A RPC SECURITY DEFINER record_inventory_movement continua autorizada
-- a atualizar quantity e cria um registro de auditoria na mesma transação.

-- Protege autoria e identidade do workspace contra reassociação.
drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update to authenticated
 using(app_private.role_level(id)>=2)
 with check(app_private.role_level(id)>=2);
revoke update on public.workspaces from authenticated;
grant update(name) on public.workspaces to authenticated;

-- Evita edição de workspace_id, id e outras colunas de vínculo
-- nos registros acessíveis diretamente pelo cliente.
do $$
declare t text;
begin
 foreach t in array array['areas','events','menu_items','assets','shopping_items','tasks','maintenance_routines'] loop
  execute format('revoke update on public.%I from authenticated',t);
 end loop;
end $$;
grant update(name,kind,notes) on public.areas to authenticated;
grant update(title,event_date,start_time,guests,event_type,status,notes,menu_notes) on public.events to authenticated;
grant update(name,quantity,unit) on public.menu_items to authenticated;
grant update(name,quantity,damaged_quantity,area_id,notes) on public.assets to authenticated;
grant update(name,quantity,unit,estimated_unit_price,status,event_id,inventory_item_id,notes) on public.shopping_items to authenticated;
grant update(title,due_on,status,event_id,area_id,notes) on public.tasks to authenticated;
grant update(title,frequency_days,next_due_on,last_done_on,area_id,notes) on public.maintenance_routines to authenticated;
-- Importante: testar permissões de coluna e RLS com contas de cada papel
-- antes de disponibilizar o ambiente ao público.
