-- Hora Extra only: server-side delivery of reminders even when users are offline.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule(
  'hora_extra_notifications_hourly',
  '0 * * * *',
  'select app_private.dispatch_all_due_notifications();'
);