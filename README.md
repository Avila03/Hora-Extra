# Hora Extra

## Interface 0.6 — Responsáveis nos itens e lista de compras automática

Os **Itens necessários** do evento agora podem ser atribuídos a integrantes da equipe:
- cada item exibe quem é responsável e traz o botão **Assumir** quando não há ninguém;
- é possível selecionar outra pessoa na própria linha ou no formulário de edição;
- a atribuição fica salva no Supabase e protegida por chave estrangeira que exige participação na mesma equipe.

A aba **Compras** utiliza automaticamente os itens necessários marcados como `buy` (precisa comprar) ou `partial` (temos parcialmente), sem copiar itens para outra tabela. Itens comprados são marcados com a caixa de seleção e ficam em uma seção separada, com progresso de compras.

O botão **Colar lista** recebe várias linhas de uma só vez: `5 kg de carne`, `3 caixas de cerveja`, `carvão`. O sistema interpreta quantidades e unidades usuais, assume uma unidade quando não informada, ignora duplicidades exatas por nome e unidade e salva até 80 itens por envio.

**Observação:** a lista é derivada dos itens necessários, não de uma inferência automática de ingredientes dos pratos do cardápio; calcular ingredientes com receitas e quantidades por convidado permanece uma evolução futura. Marcar item como comprado não movimenta estoque automaticamente.

Migração aplicada apenas ao Supabase Hora Extra: `supabase/05-event-requirement-assignees.sql`. RLS segue habilitado. O build foi conferido no GitHub Actions; a publicação no Vercel depende de acesso ao projeto de hospedagem.

---

## Interface 0.5 — Compromissos compartilhados

A navegação principal agora tem somente **Compromissos, Eventos e Estoque**. O módulo Patrimônio está integrado ao Estoque em uma opção interna ("Patrimônio e utensílios") para reduzir a quantidade de telas sem perder os dados e cadastros. A equipe continua disponível pelo controle administrativo.

**Compromissos** reúne tarefas, compras e manutenção; cada compromisso pode ter:
- responsável (qualquer integrante do espaço), prazo, observações, tipo e evento opcional;
- situações **A fazer**, **Em andamento** e **Concluído**;
- filtro por **Meus**, **Sem responsável**, **Em aberto**, **Concluídos** e tipo;
- botão **Assumir**, caso ainda não exista responsável;
- edição e exclusão conforme as permissões da pessoa.

No planejamento de eventos, tarefas adicionadas no checklist também podem ter responsáveis e aparecem na lista geral de Compromissos. Pessoas ainda precisam estar cadastradas e autorizadas no workspace para serem selecionadas.

### Migração

Foi aplicada ao banco Supabase **Hora Extra** (`uajgzhfelwdsrigtfvwc`) a migração `supabase/04-shared-commitments.sql`, que acrescenta `kind`, `assigned_to`, `created_by` e `in_progress` à tabela `tasks`, com chave estrangeira composta que exige o responsável pertencer ao mesmo espaço. Nenhum outro projeto Supabase foi alterado. Os itens das tabelas antigas não foram excluídos.

### Observações

Os compromissos do tipo "Compra" são responsabilidades pessoais; marcar o compromisso como concluído **não** registra automaticamente uma entrada de estoque nem uma despesa financeira. O sistema ainda preserva o planejamento detalhado de materiais e compras dentro dos eventos.

---

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
