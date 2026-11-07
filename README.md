# Hora Extra

Sistema de gestão de espaço particular para festas, jantares e encontros com amigos e família.

## Interface 0.4 — foco nos quatro módulos

A navegação principal do Hora Extra apresenta **somente Eventos, Estoque, Patrimônio e Tarefas**, tanto no desktop quanto no celular. A gestão de acessos continua disponível como configuração administrativa, fora do menu principal.

O Estoque recebeu a nova interface mobile-first: indicadores de estoque baixo, validade, movimentações do dia e valor estimado; cartões por produto; busca e filtro por categoria; alertas; entradas e saídas em um formulário único; histórico com data, motivo e responsável. Os valores e alertas usam registros reais do Supabase, sem dados inventados.

Os registros dos módulos anteriormente existentes (Compras, Manutenção e Ambientes) **não foram excluídos do banco**. O cadastro de ambientes permanece como estrutura de apoio para definir locais de armazenamento. A demonstração antiga permanece em `/demo`, mas não é exibida no menu principal.

## Versão 0.3 — Supabase

O aplicativo agora dispõe de uma interface de gestão conectada ao **projeto Supabase exclusivo Hora Extra**, preservando a demonstração anterior em `/demo`.

- Cadastro e login por e-mail e senha (Supabase Auth).
- Um espaço privado com proprietário, administrador, colaborador e visualizador.
- Eventos, estoque de alimentos/bebidas/ingredientes/temperos, patrimônio e louças, compras, tarefas, manutenção e ambientes persistidos no PostgreSQL.
- Movimentações auditáveis via RPC com bloqueio transacional para impedir estoque negativo.
- Gestão de membros já cadastrados e com e-mail confirmado: proprietário adiciona administradores, administradores adicionam colaboradores/visualizadores, sem escalada de privilégios.
- Acesso por associação ao espaço e políticas RLS em todas as tabelas.
- Layout responsivo e navegação móvel.

## Supabase

Projeto de destino: `uajgzhfelwdsrigtfvwc` (Hora Extra), **não reutilizar** Dengo ou Mesa Marcada.

As migrações estão em `supabase/`, nesta ordem:
1. `schema.sql`
2. `02-security-hardening.sql`
3. `03-private-access-and-team.sql`

O esquema inicial e o reforço de segurança foram aplicados juntos (primeiro registro de migração); a migração 03 foi aplicada em seguida (segundo registro). Os três arquivos SQL foram aplicados ao projeto Hora Extra em 05/11/2026. **Não reaplicar como se fossem novas migrações** em um banco já configurado. Se configurar outro banco vazio, seguir a ordem indicada.

### Variáveis de ambiente

Em `.env.local` no desenvolvimento ou nas configurações do projeto Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://uajgzhfelwdsrigtfvwc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave pública do projeto Hora Extra>
```

A chave pode ser consultada no Supabase → Project Settings → API Keys. A chave publishable é destinada ao navegador, mas **nunca** publicar `service_role`, `sb_secret_` ou senha do banco.

### Instalação
```bash
npm install
npm run dev
```

O primeiro usuário cadastrado e confirmado pode criar o espaço e torna-se proprietário. **Importante: faça o cadastro do proprietário antes de divulgar/deployar a aplicação**, pois o primeiro cadastro tem o direito de bootstrap enquanto não houver espaço. Novos usuários criam suas contas, confirmam o e-mail e precisam ser adicionados à equipe pelo proprietário/administrador para acessar dados.

## Permissões

| Papel | Consultar | Criar/editar dados | Excluir dados | Gestão de equipe |
| --- | --- | --- | --- | --- |
| Proprietário | Sim | Sim | Sim | Todos, exceto remover o proprietário |
| Administrador | Sim | Sim | Sim | Colaboradores e visualizadores |
| Colaborador | Sim | Sim | Não | Não |
| Visualizador | Sim | Não | Não | Não |

A segurança é aplicada no PostgreSQL (RLS, `GRANT` por coluna e funções privadas); não depende de botões desabilitados no frontend.

## Verificações feitas

- 12 tabelas no esquema `public`, todas com RLS ativado.
- Supabase Database Security Advisor sem alertas após a migração 03.
- RPCs públicas com `SECURITY INVOKER`; implementação privilegiada isolada em `app_private`.
- O frontend foi conectado ao Supabase no código; **ainda é necessário configurar variáveis de ambiente e testar cadastro/login e permissões com contas reais após a implantação**.
- Nenhum dado de Dengo ou Mesa Marcada foi alterado.

## Limitações e próximos incrementos

- A demonstração em `/demo` ainda usa `localStorage` e não sincroniza com o banco.
- A versão conectada tem CRUD de módulos principais e gestão de equipe, mas ainda não implementa a interface completa do planejamento detalhado de evento (cardápio estruturado, menu items, vínculos por evento/ambiente), upload, convite por e-mail nem testes automáticos de interface.
- Cadastro de usuários depende da configuração de confirmação de e-mail no painel Supabase.
- Incluir suíte de testes de RLS com usuários de cada papel e validação de build/deploy antes de liberação ampla.

## Eventos — planejamento interno (0.5)

A lista de Eventos possui a ação **Abrir evento**. A tela interna organiza cinco áreas: Visão geral, Cardápio, Itens necessários, Compras e Checklist. Cada evento mantém seus próprios pratos, quantidades, itens necessários, decisão de compra (precisa comprar, já temos, parcial ou não comprar agora), marcação de resolvido, tarefas e observações. É possível associar um item ao Estoque para visualizar quantidade disponível, sem descontá-la automaticamente.

Banco: `public.menu_items` recebeu `course` e `notes`; a tabela `public.event_requirements` foi adicionada pela migração `supabase/04-event-planner.sql`. Ambas respeitam permissões RLS do espaço. Colaboradores podem cadastrar e atualizar; administradores/proprietário também podem excluir. A migração 04 já foi aplicada ao projeto exclusivo Hora Extra; **não a execute novamente** neste projeto.

Verificado: criação e atualização de pratos e itens via SQL com papel `authenticated` de proprietário em uma transação revertida por `ROLLBACK`, sem persistência de registros de teste. Interface compilada na Vercel. Fluxos completos de interface com usuários de diferentes papéis ainda demandam testes manuais.
