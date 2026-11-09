-- Service-role Edge Function may invoke ONLY explicitly granted push RPC helpers.
grant usage on schema app_private to service_role;
grant execute on function app_private.he_push_claim_impl(uuid,text) to service_role;
grant execute on function app_private.he_push_prune_impl(uuid,text) to service_role;