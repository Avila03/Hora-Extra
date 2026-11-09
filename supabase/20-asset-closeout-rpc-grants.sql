-- Public RPC wrappers are security invoker. Permit their private, guarded helpers
-- for authenticated members only; all helpers independently validate auth.uid() and workspace role.
grant execute on function app_private.he_do_asset_action(uuid,text,integer,text,text,uuid,date,uuid) to authenticated;
grant execute on function app_private.he_finish_event(uuid,text,text,text,text,jsonb,jsonb) to authenticated;
grant execute on function app_private.he_update_closeout_notes(uuid,text,text,text,text) to authenticated;