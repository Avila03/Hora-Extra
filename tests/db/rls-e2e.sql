-- Hora Extra — teste de ponta a ponta do banco (RLS, RPCs, gatilhos e notificações).
-- Roda inteiro dentro de UMA transação e termina com RAISE EXCEPTION,
-- o que reverte tudo: nenhuma conta, espaço ou registro de teste é mantido.
-- O relatório volta na mensagem de erro final ("HE_TEST_REPORT").
-- Executar como postgres (SQL Editor do Supabase ou MCP execute_sql).
do $test$
declare
 ids jsonb := jsonb_build_object(
  'o',gen_random_uuid(),'a',gen_random_uuid(),'c',gen_random_uuid(),'v',gen_random_uuid(),'x',gen_random_uuid(),
  'ws',gen_random_uuid(),'ev',gen_random_uuid(),'ev2',gen_random_uuid(),'tk',gen_random_uuid(),
  'it',gen_random_uuid(),'ev3',gen_random_uuid(),'as',gen_random_uuid(),'rq',gen_random_uuid(),'sh',gen_random_uuid());
 tok text := '';
 t record; q text; k text; b boolean; n int; res text; passed int := 0; failed int := 0; report text := '';
begin
 insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 select (ids->>u)::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
        'he-e2e-'||u||'@test.invalid',now(),'{}','{}',now(),now()
 from unnest(array['o','a','c','v','x']) u;

 for t in select * from (values
  -- espaço e equipe
  (1,'o','ok','proprietário cria espaço',$$insert into public.workspaces(id,name,created_by) values(':ws','TESTE E2E',':o')$$),
  (2,'o','true','proprietário vira owner automaticamente',$$select exists(select 1 from public.memberships where workspace_id=':ws' and user_id=':o' and role='owner')$$),
  (3,'o','true','proprietário recebe nome de exibição',$$select (select display_name from public.memberships where workspace_id=':ws' and user_id=':o') is not null$$),
  (4,'x','true','estranho não enxerga o espaço',$$select not exists(select 1 from public.workspaces where id=':ws')$$),
  (5,'x','err','estranho não cria evento no espaço',$$insert into public.events(workspace_id,title,event_date) values(':ws','X',current_date)$$),
  (6,'x','err','estranho não cria espaço em nome de outro',$$insert into public.workspaces(name,created_by) values('Y',':o')$$),
  (7,'c','err','não-membro não gera convite',$$select public.create_workspace_invite(':ws')$$),
  (8,'o','token','proprietário gera convite',$$select public.create_workspace_invite(':ws')$$),
  (9,'c','ok','colaborador entra pelo link',$$select public.join_workspace_by_link(':tok')$$),
  (10,'c','true','quem entra pelo link é colaborador',$$select (select role from public.memberships where workspace_id=':ws' and user_id=':c')='collaborator'$$),
  (11,'c','ok','entrar de novo pelo link é idempotente',$$select public.join_workspace_by_link(':tok')$$),
  (12,'x','err','token inválido é recusado',$$select public.join_workspace_by_link(repeat('a',64))$$),
  (13,'o','ok','proprietário adiciona administrador',$$select public.add_member_by_email(':ws','he-e2e-a@test.invalid','admin')$$),
  (14,'o','ok','proprietário adiciona visualizador',$$select public.add_member_by_email(':ws','he-e2e-v@test.invalid','viewer')$$),
  (15,'o','true','nome de exibição não expõe e-mail completo',$$select not exists(select 1 from public.memberships where workspace_id=':ws' and display_name like '%@%')$$),
  (16,'c','err','colaborador não adiciona pessoas',$$select public.add_member_by_email(':ws','he-e2e-x@test.invalid','viewer')$$),
  (17,'a','err','administrador não concede admin',$$select public.add_member_by_email(':ws','he-e2e-x@test.invalid','admin')$$),
  (18,'c','err','colaborador não gera convite',$$select public.create_workspace_invite(':ws')$$),
  (19,'c','err','colaborador não se promove',$$update public.memberships set role='owner' where workspace_id=':ws' and user_id=':c'$$),
  (20,'c','zero','colaborador não renomeia espaço',$$update public.workspaces set name='hack' where id=':ws'$$),
  (21,'a','one','administrador renomeia espaço',$$update public.workspaces set name='TESTE E2E 2' where id=':ws'$$),
  (22,'c','ok','integrante define o próprio nome',$$select public.set_my_display_name(':ws','Colab Teste')$$),
  -- eventos
  (30,'v','true','visualizador enxerga o espaço',$$select exists(select 1 from public.workspaces where id=':ws')$$),
  (31,'v','err','visualizador não cria evento',$$insert into public.events(workspace_id,title,event_date) values(':ws','V',current_date)$$),
  (32,'c','ok','colaborador cria evento',$$insert into public.events(id,workspace_id,title,event_date,guests,status) values(':ev',':ws','Janta E2E',current_date+3,8,'planning')$$),
  (33,'c','ok','colaborador cria prato',$$insert into public.menu_items(workspace_id,event_id,name,quantity,unit,course) values(':ws',':ev','Picanha',2,'kg','main')$$),
  (34,'c','ok','colaborador cria item necessário (created_by automático)',$$insert into public.event_requirements(id,workspace_id,event_id,name,quantity,unit) values(':rq',':ws',':ev','Garfos',10,'un')$$),
  (35,'c','ok','colaborador cria compra',$$insert into public.shopping_items(id,workspace_id,event_id,name,quantity,unit) values(':sh',':ws',':ev','Carvão',2,'saco')$$),
  (36,'c','zero','colaborador não exclui evento',$$delete from public.events where id=':ev'$$),
  (37,'v','zero','visualizador não altera evento',$$update public.events set title='V' where id=':ev'$$),
  (38,'c','err','responsável precisa ser do espaço',$$update public.event_requirements set assigned_to=':x' where id=':rq'$$),
  (39,'c','one','colaborador assume item necessário',$$update public.event_requirements set assigned_to=':c' where id=':rq' and assigned_to is null$$),
  (40,'o','ok','compra atribuída a outra pessoa',$$update public.shopping_items set assigned_to=':c' where id=':sh'$$),
  (41,'c','true','colaborador avisado da compra atribuída',$$select exists(select 1 from public.notifications where user_id=':c' and entity_id=':sh')$$),
  -- compromissos e notificações
  (50,'o','ok','proprietário atribui compromisso',$$insert into public.tasks(id,workspace_id,title,assigned_to,event_id,due_on) values(':tk',':ws','Comprar gelo',':c',':ev',(now() at time zone 'America/Sao_Paulo')::date+1)$$),
  (51,'c','true','colaborador recebe aviso de atribuição',$$select exists(select 1 from public.notifications where user_id=':c' and workspace_id=':ws' and entity_id=':tk')$$),
  (52,'o','true','autor não recebe aviso da própria ação',$$select not exists(select 1 from public.notifications where user_id=':o' and entity_id=':tk')$$),
  (53,'a','true','avisos são privados de cada pessoa',$$select not exists(select 1 from public.notifications where user_id=':c')$$),
  (54,'c','one','colaborador marca aviso como lido',$$update public.notifications set read_at=now() where user_id=':c' and entity_id=':tk'$$),
  (55,'o','zero','ninguém marca aviso alheio',$$update public.notifications set read_at=now() where user_id=':c'$$),
  (56,'c','err','cliente não cria avisos manualmente',$$insert into public.notifications(workspace_id,user_id,kind,title) values(':ws',':c','event','fake')$$),
  (57,'c','ok','lembretes sob demanda',$$select public.refresh_my_reminders(':ws')$$),
  (58,'c','true','lembrete do compromisso de amanhã',$$select (select count(*) from public.notifications where user_id=':c' and entity_id=':tk')>=2$$),
  (59,'c','ok','lembretes sem duplicar',$$select public.refresh_my_reminders(':ws')$$),
  (60,'c','true','lembrete não duplicado',$$select (select count(*) from public.notifications where user_id=':c' and entity_id=':tk')=2$$),
  (61,'c','zero','colaborador não exclui compromisso',$$delete from public.tasks where id=':tk'$$),
  -- estoque
  (70,'c','ok','colaborador cadastra produto',$$insert into public.inventory_items(id,workspace_id,name,category,quantity,min_quantity,unit) values(':it',':ws','Cerveja','Bebidas',10,3,'un')$$),
  (71,'c','true','estoque inicial aparece no histórico',$$select exists(select 1 from public.inventory_movements where inventory_item_id=':it')$$),
  (72,'c','err','quantidade não muda por fora do histórico',$$update public.inventory_items set quantity=99 where id=':it'$$),
  (73,'c','ok','saída de 4',$$select public.record_inventory_movement(':it',-4,'uso')$$),
  (74,'c','true','saldo 6',$$select (select quantity from public.inventory_items where id=':it')=6$$),
  (75,'c','err','estoque nunca fica negativo',$$select public.record_inventory_movement(':it',-100,'erro')$$),
  (76,'v','err','visualizador não movimenta',$$select public.record_inventory_movement(':it',1,'v')$$),
  (77,'x','err','estranho não movimenta',$$select public.record_inventory_movement(':it',1,'x')$$),
  (78,'c','ok','saída até o mínimo',$$select public.record_inventory_movement(':it',-3,'uso')$$),
  (79,'o','true','proprietário avisado de estoque baixo',$$select exists(select 1 from public.notifications where user_id=':o' and entity_id=':it')$$),
  (80,'c','one','colaborador edita cadastro do produto',$$update public.inventory_items set min_quantity=2, price=5.5 where id=':it'$$),
  -- patrimônio
  (90,'c','ok','colaborador cadastra patrimônio',$$insert into public.assets(id,workspace_id,name,quantity) values(':as',':ws','Taças',12)$$),
  (91,'c','err','cadastro não define saldos internos',$$insert into public.assets(workspace_id,name,quantity,loaned_quantity) values(':ws','Pratos',5,5)$$),
  (92,'c','ok','empréstimo de 5',$$select public.record_asset_action(':as','loan',5,'Tia Maria',null,null,current_date+7,null)$$),
  (93,'c','err','empréstimo exige pessoa',$$select public.record_asset_action(':as','loan',1,'',null,null,null,null)$$),
  (94,'c','err','empréstimo acima do disponível',$$select public.record_asset_action(':as','loan',8,'Primo',null,null,null,null)$$),
  (95,'c','ok','devolução parcial de 2',$$select public.record_asset_action(':as','return',2,null,null,(select id from public.asset_loans where asset_id=':as' limit 1),null,null)$$),
  (96,'c','ok','avaria de 2',$$select public.record_asset_action(':as','damage',2,null,null,null,null,null)$$),
  (97,'c','ok','envia 1 para manutenção',$$select public.record_asset_action(':as','repair_start',1,null,null,null,null,null)$$),
  (98,'c','true','disponível = 12-1-3-1 = 7',$$select (select quantity-damaged_quantity-loaned_quantity-maintenance_quantity from public.assets where id=':as')=7$$),
  (99,'c','err','total não fica abaixo do comprometido',$$update public.assets set quantity=2 where id=':as'$$),
  (100,'c','err','saldo emprestado só muda por RPC',$$update public.assets set loaned_quantity=0 where id=':as'$$),
  (101,'c','true','histórico do patrimônio registrado',$$select (select count(*) from public.asset_movements where asset_id=':as')>=5$$),
  (102,'v','err','visualizador não empresta',$$select public.record_asset_action(':as','loan',1,'V',null,null,null,null)$$),
  (103,'a','err','não arquiva com empréstimo aberto',$$update public.assets set archived_at=now() where id=':as'$$),
  -- fechamento da janta
  (110,'v','err','visualizador não encerra',$$select public.finish_event(':ev',null,null,null,null,'[]','[]')$$),
  (111,'c','ok','colaborador encerra com consumo e avaria',$$select public.finish_event(':ev','ok','sobrou arroz','1 taça','lavar',('[{"inventory_item_id":":it","consumed":1,"leftover":0,"deduct":true}]')::jsonb,('[{"asset_id":":as","quantity":1}]')::jsonb)$$),
  (112,'c','true','evento concluído',$$select (select status from public.events where id=':ev')='completed'$$),
  (113,'c','true','consumo descontado (3-1=2)',$$select (select quantity from public.inventory_items where id=':it')=2$$),
  (114,'c','true','avaria somada (1+1=2)',$$select (select damaged_quantity from public.assets where id=':as')=2$$),
  (115,'c','true','pendências fotografadas',$$select (select pending_task_count=1 and pending_shopping_count=1 and pending_requirement_count=1 from public.event_closeouts where event_id=':ev')$$),
  (116,'c','err','segundo encerramento recusado',$$select public.finish_event(':ev',null,null,null,null,'[]','[]')$$),
  (117,'c','err','evento concluído não volta a planejamento',$$update public.events set status='planning' where id=':ev'$$),
  (118,'c','ok','observações editáveis depois',$$select public.update_event_closeout_notes(':ev','corrigido',null,null,null)$$),
  (119,'c','true','edição não repete desconto',$$select (select quantity from public.inventory_items where id=':it')=2$$),
  (120,'c','ok','cria evento cancelado',$$insert into public.events(id,workspace_id,title,event_date,status) values(':ev2',':ws','Cancelado',current_date,'cancelled')$$),
  (121,'c','err','cancelado não pode ser encerrado',$$select public.finish_event(':ev2',null,null,null,null,'[]','[]')$$),
  (122,'c','err','consumo maior que o estoque reverte tudo',$$select public.finish_event(':ev2',null,null,null,null,('[{"inventory_item_id":":it","consumed":50,"deduct":true}]')::jsonb,'[]')$$),
  (123,'a','ok','evento com compra e compromisso',$$insert into public.events(id,workspace_id,title,event_date) values(':ev3',':ws','Para excluir',current_date)$$),
  (124,'a','ok','compra no evento',$$insert into public.shopping_items(workspace_id,event_id,name,quantity) values(':ws',':ev3','Gelo',1)$$),
  (125,'a','ok','compromisso no evento',$$insert into public.tasks(workspace_id,title,event_id) values(':ws','Limpar',':ev3')$$),
  (126,'a','one','admin exclui evento com compras e compromissos',$$delete from public.events where id=':ev3'$$),
  (127,'a','one','admin exclui produto com histórico',$$delete from public.inventory_items where id=':it'$$),
  (128,'c','err','colaborador não arquiva patrimônio',$$select public.set_asset_archived(':as',true)$$),
  (129,'a','err','não arquiva com empréstimo aberto (RPC)',$$select public.set_asset_archived(':as',true)$$),
  (150,'c','err','colaborador não troca papéis',$$select public.set_member_role(':ws',':v','collaborator')$$),
  (151,'a','err','administrador não promove a admin',$$select public.set_member_role(':ws',':c','admin')$$),
  (152,'a','ok','administrador torna colaborador visualizador',$$select public.set_member_role(':ws',':c','viewer')$$),
  (153,'c','err','visualizador não cria evento',$$insert into public.events(workspace_id,title,event_date) values(':ws','V',current_date)$$),
  (154,'a','err','administrador não altera o proprietário',$$select public.set_member_role(':ws',':o','viewer')$$),
  (155,'a','err','ninguém altera o próprio papel',$$select public.set_member_role(':ws',':a','viewer')$$),
  (156,'o','ok','proprietário devolve papel de colaborador',$$select public.set_member_role(':ws',':c','collaborator')$$),
  (157,'c','err','TRUNCATE recusado pela API',$$truncate public.events$$),
  -- remoção de pessoas e exclusão do espaço
  (160,'c','err','colaborador não remove pessoas',$$select public.remove_member(':ws',':v')$$),
  (161,'a','err','administrador não remove o proprietário',$$select public.remove_member(':ws',':o')$$),
  (162,'a','ok','administrador remove visualizador',$$select public.remove_member(':ws',':v')$$),
  (163,'v','true','removido perde acesso',$$select not exists(select 1 from public.events where workspace_id=':ws')$$),
  (164,'o','ok','proprietário revoga convite',$$select public.revoke_workspace_invite(':ws')$$),
  (165,'x','err','link revogado é recusado',$$select public.join_workspace_by_link(':tok')$$),
  (166,'a','err','administrador não exclui espaço',$$select public.delete_workspace(':ws','TESTE E2E 2')$$),
  (167,'o','err','nome errado impede exclusão',$$select public.delete_workspace(':ws','TESTE')$$),
  (168,'c','err','exclusão direta bloqueada',$$delete from public.workspaces where id=':ws'$$),
  (169,'o','ok','proprietário exclui espaço',$$select public.delete_workspace(':ws','TESTE E2E 2')$$),
  (170,'pg','true','exclusão em cascata completa',$$select not exists(select 1 from public.events where workspace_id=':ws') and not exists(select 1 from public.memberships where workspace_id=':ws') and not exists(select 1 from public.notifications where workspace_id=':ws') and not exists(select 1 from public.asset_movements where workspace_id=':ws') and not exists(select 1 from public.inventory_movements where workspace_id=':ws')$$)
 ) as v(nr,who,expect,label,sql) order by nr loop
  q := t.sql;
  for k in select jsonb_object_keys(ids) order by length(jsonb_object_keys(ids)) desc loop
   q := replace(q, ':'||k, ids->>k);
  end loop;
  q := replace(q, ':tok', tok);
  execute 'reset role';
  if t.who <> 'pg' then
   perform set_config('request.jwt.claims', json_build_object('sub',ids->>t.who,'role','authenticated')::text, true);
   execute 'set local role authenticated';
  end if;
  res := null;
  begin
   if t.expect in ('true','token') then
    if t.expect='token' then execute q into tok; b := tok is not null and length(tok)=64;
    else execute q into b; end if;
    res := case when b then 'PASS' else 'FAIL (resultado falso)' end;
   else
    execute q; get diagnostics n = row_count;
    res := case t.expect when 'ok' then 'PASS' when 'err' then 'FAIL (deveria ter sido bloqueado)'
      when 'zero' then case when n=0 then 'PASS' else 'FAIL ('||n||' linhas alteradas)' end
      when 'one' then case when n=1 then 'PASS' else 'FAIL ('||n||' linhas alteradas)' end end;
   end if;
  exception when others then
   res := case when t.expect='err' then 'PASS' else 'FAIL ['||left(sqlerrm,110)||']' end;
  end;
  execute 'reset role';
  if res='PASS' then passed := passed+1; else failed := failed+1; end if;
  report := report || lpad(t.nr::text,3) || ' ' || rpad(t.who,2) || ' ' || res || ' — ' || t.label || E'\n';
 end loop;
 raise exception 'HE_TEST_REPORT passed=% failed=% %', passed, failed, E'\n'||report;
end $test$;
