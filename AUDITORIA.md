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
| Sem tela para renomear ou excluir locais | Local criado errado ficava para sempre | Estoque → **Locais**: renomear (colaborador), excluir (administrador), nomes únicos por espaço |
| `refresh` podia deixar a tela "ocupada" ao trocar de espaço | Botões travados | `setBusy(false)` no retorno antecipado |
| Históricos limitados a 1000 linhas sem ordem | Movimentações recentes podiam sumir | Históricos ordenados do mais novo, até 2000 |
| Lista de eventos começava pelos mais antigos | "Próximos encontros" mostrava o passado primeiro | Próximos primeiro; concluídos/passados depois |
| `TRUNCATE` liberado para `anon`/`authenticated` | Sem uso, ignora RLS | Revogado em todas as tabelas públicas |
| `add_member_by_email` gravava o e-mail completo como nome | E-mail visível para a equipe | Usa só a parte antes do @; nomes existentes corrigidos |

## Excessos — removidos em 10/11/2026, por decisão do proprietário

**Interface**
- `app/demo/page.jsx`: demonstração antiga com `localStorage`, apagada.
- Os 11 arquivos CSS (148 KB, com três identidades sobrepostas) viraram um só, `app/hora-extra.css` (128 KB):
  - 15 KB de regras sem uso foram retirados;
  - 203 declarações sobrescritas pelo mesmo seletor foram eliminadas;
  - restam 23 `!important` dos 121 originais.
  A equivalência foi verificada pelo estilo calculado de cada elemento em 57 telas, no computador e no celular.
- `app/page.jsx`: a tabela genérica inalcançável, o botão "Adicionar" do cabeçalho e as funções e variáveis sem uso foram removidos.
- 22 ícones importados sem uso foram removidos de 6 arquivos. O `catch` vazio do `sw.js` agora explica o que acontece.

**Banco (migração 23)**
- Tabelas `maintenance_routines` e `invitations` apagadas.
- Colunas `purchase_status`, `migration_source_requirement_id`, `tasks.area_id` e `areas.kind` apagadas.
- Funções `add_member_by_email` e `can_bootstrap_workspace` apagadas.
- O índice nunca usado foi apagado, e 23 índices foram criados para cobrir todas as chaves estrangeiras.

**Documentação**
- O `README.md` foi reescrito com o estado atual; o diário de versões foi para `CHANGELOG.md`.

## Pendências que continuam em aberto

- **Proteção contra senhas vazadas** desligada no Supabase Auth (Authentication → Policies → Password security).
- Lista de compras ainda não é calculada a partir de receitas × convidados.
- O job E2E do GitHub precisa de contas de teste e segredos cadastrados para rodar.
