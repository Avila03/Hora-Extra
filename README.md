# Hora Extra

Gestão dos encontros feitos em casa: jantas, churrascos e festas com a família e os amigos. Cada **espaço** reúne os eventos, as compras, os compromissos da equipe, o estoque de bebidas, comidas e ingredientes e o patrimônio (louças, talheres, utensílios).

Produção: https://horaextra.vercel.app · Next.js 16 + React 19 + Supabase · PWA instalável com notificações no celular.

## O que o app faz

- **Visão geral:** o próximo evento em destaque, o progresso dos preparativos, uma busca no espaço e o sininho de avisos.
- **Eventos:** cada evento tem Cardápio, Itens necessários (o checklist de materiais), Compras e Compromissos (antes, durante e depois). Cada item pode ter um responsável, com o botão **Assumir**. **Colar lista** transforma linhas como `5 kg de carne` em itens.
- **Fechamento da janta:** registra o consumo (com desconto opcional no estoque), as sobras, as avarias e a limpeza pendente. Gera um relatório único por evento e marca o evento como concluído.
- **Compromissos:** tarefas, compras e manutenção da casa, com responsável, prazo e situação.
- **Estoque:** produtos com mínimo, validade, custo e local de armazenamento. Toda entrada e saída fica no histórico, inclusive a quantidade inicial.
- **Patrimônio e utensílios:** empréstimos (quem levou e até quando), devoluções, avarias, manutenção e arquivamento, tudo com histórico.
- **Locais de armazenamento:** criar, renomear e excluir (Estoque → **Locais**). Ao excluir um local, os itens ficam sem local definido.
- **Equipe:** convite por link válido por 30 dias, papéis, nome de exibição por espaço e vários espaços por conta.
- **Avisos:** caixa de entrada privada, preferências por tipo, lembretes de hora em hora (rodam no servidor) e Web Push no iPhone (com o app instalado na tela inicial).

## Permissões

| Papel | Consultar | Criar e editar | Excluir | Equipe |
|---|---|---|---|---|
| Proprietário | Sim | Sim | Sim | Tudo; único que exclui o espaço e concede administrador |
| Administrador | Sim | Sim | Sim | Convites, colaboradores e visualizadores |
| Colaborador | Sim | Sim | Não | Não |
| Visualizador | Sim | Não | Não | Não |

Quem entra pelo link vira colaborador; o papel muda em *Espaços e equipe*. As regras são aplicadas no PostgreSQL (RLS, permissões por coluna e funções em `app_private`), não só na tela.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha as duas variáveis abaixo
npm run dev
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://uajgzhfelwdsrigtfvwc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave publishable do projeto Hora Extra>
```

Nunca publique a `service_role`, chaves `sb_secret_` ou a senha do banco.

## Banco de dados

Projeto Supabase exclusivo **Hora Extra** (`uajgzhfelwdsrigtfvwc`); não reutilize os projetos do Dengo ou do Mesa Marcada. As migrações em `supabase/` já estão aplicadas, de `schema.sql` até `23-cleanup-and-fk-indexes.sql`. Num banco novo e vazio, aplique-as em ordem: `schema.sql`, `02` a `23`. Os dois arquivos `04-*` e os dois `09-*` são independentes entre si.

A Edge Function `supabase/functions/hora-extra-push` entrega o Web Push. Ela é chamada por um gatilho com segredo guardado no Vault.

## Testes

- **Banco:** `tests/db/rls-e2e.sql`, com 117 verificações de permissões, funções, gatilhos e avisos, simulando cinco pessoas. Roda numa transação desfeita no final.
- **Interface:** `tests/e2e/hora-extra.spec.mjs`, com o fluxo completo de uma janta no Playwright (`npm run test:e2e`).
- O GitHub Actions compila o app a cada push e tem um job manual para os testes de interface.

Como rodar: [TESTES.md](TESTES.md). Auditoria e decisões: [AUDITORIA.md](AUDITORIA.md). Histórico: [CHANGELOG.md](CHANGELOG.md).

## Estrutura

```
app/page.jsx              tela principal (login, espaços, navegação e formulários)
app/hora-extra.css        identidade visual Midnight HE (único arquivo de estilos)
components/               Visão geral, Eventos, Fechamento, Compromissos, Estoque, Patrimônio, Locais, Avisos, Equipe
public/sw.js              service worker (PWA e push)
supabase/                 migrações e Edge Function
tests/                    suítes de banco e de interface
```
