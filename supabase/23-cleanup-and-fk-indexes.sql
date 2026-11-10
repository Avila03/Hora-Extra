-- 23 — Limpeza decidida na auditoria de 10/11/2026 + índices das chaves estrangeiras.
-- Aplicar somente no Supabase Hora Extra (uajgzhfelwdsrigtfvwc).

-- 1. Tabelas sem tela e sem dados
drop table if exists public.maintenance_routines;
drop table if exists public.invitations;

-- 2. Colunas sem uso (a FK de tasks.area_id sai junto)
alter table public.event_requirements drop column if exists purchase_status;
alter table public.shopping_items drop column if exists migration_source_requirement_id;
alter table public.tasks drop column if exists area_id;
alter table public.areas drop column if exists kind;

-- 3. Funções sem uso (o convite é por link; o modo de espaço único acabou na migração 06)
drop function if exists public.add_member_by_email(uuid,text,text);
drop function if exists app_private.do_add_member_by_email(uuid,text,text);
drop function if exists app_private.can_bootstrap_workspace();

-- 4. Índice nunca usado
drop index if exists public.event_requirements_event_assignee_idx;

-- 5. Excluir um local de armazenamento deixa produtos e utensílios "sem local"
alter table public.inventory_items drop constraint inventory_items_workspace_id_area_id_fkey,
 add constraint inventory_items_workspace_id_area_id_fkey foreign key (workspace_id,area_id)
 references public.areas(workspace_id,id) on delete set null (area_id);
alter table public.assets drop constraint assets_workspace_id_area_id_fkey,
 add constraint assets_workspace_id_area_id_fkey foreign key (workspace_id,area_id)
 references public.areas(workspace_id,id) on delete set null (area_id);
create unique index if not exists areas_workspace_name_key on public.areas (workspace_id, lower(trim(name)));

-- 6. Índice para toda chave estrangeira do schema public que ainda não tem um índice cobrindo
do $$
declare r record;
begin
 for r in
  select c.conrelid::regclass as tbl, c.conname,
         (select string_agg(quote_ident(a.attname), ',' order by k.ord)
            from unnest(c.conkey) with ordinality k(attnum,ord)
            join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum) as cols
    from pg_constraint c
   where c.contype='f' and c.connamespace='public'::regnamespace
     and not exists (
      select 1 from pg_index i
       where i.indrelid=c.conrelid
         and (select array_agg(x order by x) from unnest((string_to_array(i.indkey::text,' ')::int2[])[1:cardinality(c.conkey)]) x)
           = (select array_agg(x order by x) from unnest(c.conkey) x))
 loop
  execute format('create index if not exists %I on %s (%s)', left(r.conname||'_idx',63), r.tbl, r.cols);
 end loop;
end $$;
