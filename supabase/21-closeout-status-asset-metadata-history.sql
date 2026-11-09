-- Event closeouts are historical records: a completed event cannot silently go back to planning.
create or replace function app_private.he_guard_closed_event_status()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.status is distinct from old.status and new.status<>'completed'
    and exists(select 1 from public.event_closeouts where event_id=old.id)
 then
  raise exception 'Janta já encerrada: seu relatório é histórico e o evento não pode ser reaberto';
 end if;
 return new;
end $$;
revoke all on function app_private.he_guard_closed_event_status() from public,anon,authenticated;
drop trigger if exists he_guard_closed_event_status on public.events;
create trigger he_guard_closed_event_status before update of status on public.events
 for each row execute function app_private.he_guard_closed_event_status();

-- Metadata edits should also appear in the audit trail, not only quantity changes.
create or replace function app_private.he_track_asset_edits()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_kind text; v_text text;
begin
 if current_setting('he.asset_action',true)='active' then return new; end if;
 if tg_op='INSERT' then
   v_kind:='create';
   v_text:='Cadastro inicial do patrimônio';
 else
   if row(new.name,new.notes,new.area_id,new.quantity,new.damaged_quantity,new.loaned_quantity,new.maintenance_quantity,new.archived_at)
      is not distinct from
      row(old.name,old.notes,old.area_id,old.quantity,old.damaged_quantity,old.loaned_quantity,old.maintenance_quantity,old.archived_at)
   then return new; end if;
   v_kind:=case when new.archived_at is distinct from old.archived_at then
       case when new.archived_at is null then 'restore' else 'archive' end
     else 'adjust' end;
   v_text:='Cadastro atualizado';
 end if;
 insert into public.asset_movements(
    workspace_id,asset_id,asset_name,kind,quantity,details,
    available_after,damaged_after,loaned_after,maintenance_after,created_by
 ) values(
    new.workspace_id,new.id,new.name,v_kind,
    case when tg_op='INSERT' then new.quantity else abs(new.quantity-old.quantity) end,v_text,
    new.quantity-new.damaged_quantity-new.loaned_quantity-new.maintenance_quantity,
    new.damaged_quantity,new.loaned_quantity,new.maintenance_quantity,(select auth.uid())
 );
 return new;
end $$;
revoke all on function app_private.he_track_asset_edits() from public,anon,authenticated;
