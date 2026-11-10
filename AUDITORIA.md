# Auditoria — 10/11/2026

## Corrigido nesta rodada

| Problema | Efeito para quem usa | Correção |
|---|---|---|
| Formulário de cadastro usava a aba atual, não a tabela que o abriu | "Criar evento" na Visão geral abria um formulário vazio que não salvava | `app/page.jsx`: o formulário usa a própria seção (`modalSection`) |
| Campos vazios eram descartados ao editar | Não dava para apagar observações, horário, validade, preço | Na edição, campo vazio vira `null` (ou 0 em números obrigatórios) |
| Excluir evento com compras ou compromissos | Sempre falhava (chave estrangeira) | Migração 22: compras e compromissos do evento saem junto; aviso na confirmação |
| Excluir produto com movimentações | Sempre falhava | Migração 22: o histórico do produto sai junto; aviso na confirmação |
| Arquivar/reativar patrimônio | Sempre "permission denied" | RPC `set_asset_archived` (só administradores, bloqueia com empréstimo ou manutenção) |
| Cadastro de patrimônio aceitava saldos internos | Dava para criar item "já emprestado" sem histórico | Inserção por coluna, sem `loaned_quantity`, `maintenance_quantity` e `archived_at` |
| Sem caminho para papéis administrador/visualizador | Todo mundo entrava como colaborador para sempre | RPC `set_member_role` + seletor de papel em *Espaços e equipe* |
| Proprietário sem nome de exibição | Aparecia como "Integrante"; avisos diziam "Um integrante" | Nome automático ao criar o espaço + campo "Seu nome neste espaço" |
| Quantidade inicial do produto fora do histórico | O histórico não fechava com o saldo | Gatilho registra "Estoque inicial" |
| Sem tela para locais de armazenamento | O campo "Local" nunca tinha opções | Opção "+ Novo local de armazenamento…" no formulário |
| `refresh` podia deixar a tela "ocupada" ao trocar de espaço | Botões travados | `setBusy(false)` no retorno antecipado |
| Históricos limitados a 1000 linhas sem ordem | Movimentações recentes podiam sumir | Históricos ordenados do mais novo, até 2000 |
| Lista de eventos começava pelos mais antigos | "Próximos encontros" mostrava o passado primeiro | Próximos primeiro; concluídos/passados depois |
| `TRUNCATE` liberado para `anon`/`authenticated` | Sem uso, ignora RLS | Revogado em todas as tabelas públicas |
| `add_member_by_email` gravava o e-mail completo como nome | E-mail visível para a equipe | Usa só a parte antes do @; nomes existentes corrigidos |

## Excessos — listados, **não removidos** (aguardando sua decisão)

**Interface**
- `app/demo/page.jsx` (22 KB): demonstração antiga com `localStorage`, só linkada na tela de "Configuração pendente".
- 10 arquivos CSS (146 KB) com três identidades sobrepostas: `live.css` (verde original), `brand.css` (azul claro) e `midnight.css`, que sobrescreve as outras com 99 `!important`.
- `app/page.jsx`: a tabela genérica de registros e o botão "Adicionar" do cabeçalho nunca aparecem (todas as abas têm tela própria); funções `toggleShoppingFromDashboard`, `stats`, `shoppingPercentage`, `money` e a variável `joined` sem uso.
- 20 ícones importados e não usados em `page.jsx`, `AssetHub`, `EventCloseout`, `EventHub`, `OverviewDashboard` e `StockDashboard`.
- `public/sw.js`: bloco `catch` vazio.

**Banco**
- Tabelas sem tela e sem dados: `maintenance_routines`, `invitations`.
- Colunas sem uso: `event_requirements.purchase_status`, `shopping_items.migration_source_requirement_id`, `tasks.area_id`, `areas.kind`.
- Funções sem uso na interface: `add_member_by_email`, `app_private.can_bootstrap_workspace`.
- Índice nunca usado: `event_requirements_event_assignee_idx`.

**Documentação**
- O `README.md` é um diário de versões com trechos que se contradizem (ex.: diz que Compras derivam dos itens necessários, o que mudou na migração 08; a lista de migrações para na 06).

## Pendências que continuam em aberto

- **Proteção contra senhas vazadas** desligada no Supabase Auth (Authentication → Policies → Password security).
- Locais de armazenamento podem ser criados, mas não renomeados nem excluídos pela tela.
- Lista de compras ainda não é calculada a partir de receitas × convidados.
- 28 chaves estrangeiras sem índice (aviso informativo; irrelevante no volume atual).
- O job E2E do GitHub precisa de contas de teste e segredos cadastrados para rodar.
