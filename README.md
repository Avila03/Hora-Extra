# Hora Extra

## Identidade Midnight HE — novembro de 2026

O aplicativo conectado usa a nova identidade **Midnight HE**, inspirada no conceito visual aprovado:

- Fundo azul-noite (`#00141e`), superfícies em azul profundo e contornos ciano iluminados, com contraste alto.
- Menu lateral escuro com logomarca HE preservada e navegação destacada em azul, além de versão mobile com barra inferior.
- Visão geral com destaque para o próximo evento real, painel de quatro etapas de preparação, atalhos para Cardápio/Itens necessários/Compras/Compromissos, lista de próximos eventos e ações rápidas.
- Busca interna que encontra eventos, tarefas, compras e itens de estoque do espaço atual, mais um sino de alertas para compromissos pendentes e baixo estoque.
- Telas de eventos, compras, compromissos, estoque, equipe, seleção de espaços, login e formulários harmonizadas com a mesma identidade.
- Atalhos rápidos respeitam as permissões da pessoa. O painel usa apenas os dados retornados do Supabase; a imagem do churrasco é decorativa, sem valores demonstrativos.
- PWA e metadados da barra do navegador ajustados ao tom noturno.

**Imagem de capa:** foto “Steaks cooking over open flames on a grill”, por Sebastian Alvarado Rojas, Unsplash (licença gratuita). Fonte: https://unsplash.com/photos/steaks-cooking-over-open-flames-on-a-grill-ttOZWD1X2oo. O efeito de iluminação, transparência e contornos é implementado em CSS.

A identidade está concentrada em `app/midnight.css` e no painel `components/OverviewDashboard.jsx`. Os módulos de negócio permanecem funcionando com as tabelas e as permissões existentes, sem migração de dados.

---

## Interface 0.9 — Seleção simples e exclusão de espaços

- A lateral apresenta apenas o botão **Escolher**. O seletor suspenso foi removido (inclusive do menu mobile). O botão abre a tela de escolha de espaços.
- Em **Espaços e equipe**, proprietários visualizam uma seção recolhida **Excluir espaço**, com confirmação obrigatória digitando o nome exato.
- A exclusão é permanente, elimina os dados vinculados ao espaço (eventos, compras, estoque, tarefas, patrimônio, convites e membros) usando as chaves estrangeiras `ON DELETE CASCADE`, mas preserva os outros espaços e a conta do usuário.
- Apenas um membro com papel `owner` pode chamar `public.delete_workspace`, que invoca uma função restrita em `app_private`. As permissões de `DELETE` direto na tabela `workspaces` estão revogadas para `authenticated` e `anon`.
- Após excluir, a interface limpa os dados do espaço anterior e retorna à tela de escolha, sem selecionar outro espaço silenciosamente.

Migração: `supabase/07-owner-only-workspace-deletion.sql`, aplicada exclusivamente no Supabase Hora Extra. O teste transacional com `ROLLBACK` confirmou rejeição de outro usuário, rejeição de nome incorreto e exclusão correta pelo proprietário, sem deletar espaços reais.

---

## Interface 0.8 — Múltiplos espaços e entrada por link

Agora o Hora Extra permite **criar e alternar entre vários espaços** dentro do mesmo Supabase, cada um com eventos, compromissos, estoque e equipe independentes.

**Como convidar:** em *Espaços e equipe*, um administrador clica em **Gerar link de convite** e **Copiar link**. A pessoa abre o link no próprio telefone, entra ou cria sua conta, e o aplicativo realiza a associação com o espaço automaticamente, como **colaborador**. Não é necessário informar e-mail nem aprovar a entrada manualmente. O link é válido por 30 dias, pode ser revogado e gerar um novo invalida o anterior.

**Como criar outro espaço:** em *Espaços e equipe* basta preencher o nome e clicar em **Criar espaço**. O menu de seleção de espaço na lateral (ou no menu **Mais** do celular) alterna entre espaços. A seleção é lembrada no dispositivo.

Banco: migração `supabase/06-multiple-spaces-invite-links.sql` removeu o índice que limitava o banco a um espaço, preservando as tabelas e dados existentes; os convites são armazenados como hash SHA-256 em `app_private.workspace_invite_links` e manipulados por RPCs autenticadas, sem expor tokens no banco público. A seleção de dados continua sujeita ao RLS do espaço.

**Verificação:** criação de segundo espaço (em transação revertida), entrada de outra conta pelo link, restrições de permissão do colaborador e revogação do convite foram verificadas via consultas SQL revertidas com `ROLLBACK`. Nenhuma conta foi adicionada como resultado dos testes. O GitHub Actions executa `npm run build` para verificar o frontend.

---

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
- Múltiplos espaços privados, cada um com proprietário, administrador, colaborador e visualizador.
- Eventos, estoque de alimentos/bebidas/ingredientes/temperos, patrimônio e louças, compras, tarefas, manutenção e ambientes persistidos no PostgreSQL.
- Movimentações auditáveis via RPC com bloqueio transacional para impedir estoque negativo.
- Entrada por convite de link revogável para colaboradores; permissões administrativas continuam restritas.
- Acesso por associação ao espaço e políticas RLS em todas as tabelas.
- Layout responsivo e navegação móvel.

## Supabase

Projeto de destino: `uajgzhfelwdsrigtfvwc` (Hora Extra), **não reutilizar** Dengo ou Mesa Marcada.

As migrações estão em `supabase/`, nesta ordem:
1. `schema.sql`
2. `02-security-hardening.sql`
3. `03-private-access-and-team.sql`
4. `04-shared-commitments.sql`
5. `05-event-requirement-assignees.sql`
6. `06-multiple-spaces-invite-links.sql`

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

Cada usuário autenticado pode criar um novo espaço e se torna seu proprietário. Para entrar em um espaço de outra pessoa, basta abrir o link que ela compartilhar. A eventual confirmação de e-mail depende das opções do projeto Supabase e não do fluxo de convite.

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
- O frontend usa Supabase e o projeto está vinculado à Vercel; testes manuais de navegação com contas reais ainda são recomendados.
- Nenhum dado de Dengo ou Mesa Marcada foi alterado.

## Limitações e próximos incrementos

- A demonstração em `/demo` ainda usa `localStorage` e não sincroniza com o banco.
- A versão conectada oferece planejamento de eventos, lista de compras, atribuição de responsáveis, múltiplos espaços e convites por link, mas ainda não dispõe de testes automatizados de ponta a ponta.
- Cadastro de usuários depende da configuração de confirmação de e-mail no painel Supabase.
- Incluir suíte de testes de RLS com usuários de cada papel e validação de build/deploy antes de liberação ampla.

## Eventos — planejamento interno (0.5)

A lista de Eventos possui a ação **Abrir evento**. A tela interna organiza cinco áreas: Visão geral, Cardápio, Itens necessários, Compras e Checklist. Cada evento mantém seus próprios pratos, quantidades, itens necessários, decisão de compra (precisa comprar, já temos, parcial ou não comprar agora), marcação de resolvido, tarefas e observações. É possível associar um item ao Estoque para visualizar quantidade disponível, sem descontá-la automaticamente.

Banco: `public.menu_items` recebeu `course` e `notes`; a tabela `public.event_requirements` foi adicionada pela migração `supabase/04-event-planner.sql`. Ambas respeitam permissões RLS do espaço. Colaboradores podem cadastrar e atualizar; administradores/proprietário também podem excluir. A migração 04 já foi aplicada ao projeto exclusivo Hora Extra; **não a execute novamente** neste projeto.

Verificado: criação e atualização de pratos e itens via SQL com papel `authenticated` de proprietário em uma transação revertida por `ROLLBACK`, sem persistência de registros de teste. Interface compilada na Vercel. Fluxos completos de interface com usuários de diferentes papéis ainda demandam testes manuais.
