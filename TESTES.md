# Testes de ponta a ponta — Hora Extra

Duas suítes cobrem o fluxo completo de uma janta em casa: uma direto no banco (permissões, RPCs, gatilhos e notificações) e outra na interface, com navegador de verdade.

## 1. Banco — `tests/db/rls-e2e.sql` (117 verificações)

Simula cinco pessoas (proprietário, administrador, colaborador, visualizador e alguém de fora) e percorre: criação do espaço, convite por link, papéis, eventos, cardápio, itens necessários, compras, compromissos, avisos e lembretes, estoque, locais de armazenamento, patrimônio (empréstimo, devolução, avaria, manutenção, arquivamento), fechamento da janta, exclusões em cascata e exclusão do espaço.

**Como rodar:** cole o arquivo no SQL Editor do Supabase Hora Extra e execute. Tudo acontece dentro de uma transação que termina com erro de propósito: nada é gravado. O relatório aparece na mensagem de erro `HE_TEST_REPORT passed=… failed=…`, com uma linha por verificação.

## 2. Interface — `tests/e2e/hora-extra.spec.mjs` (14 cenários, Playwright)

| # | Cenário |
|---|---|
| 1 | Proprietário entra e cria um espaço |
| 2 | Visão geral → "Criar evento" abre o formulário certo e salva |
| 3 | Editar evento consegue apagar um campo opcional |
| 4 | Cardápio, itens necessários em lote, "Colar lista" de compras, marcar comprado, compromissos |
| 5 | Produto com local de armazenamento novo, estoque inicial no histórico, saída |
| 5b | Locais de armazenamento: renomear, nome repetido recusado, excluir (itens ficam sem local) |
| 6 | Patrimônio: cadastro, empréstimo, bloqueio de arquivamento com empréstimo, arquivar e reativar |
| 7 | Nome de exibição e link de convite |
| 8 | Colaborador e visualizador entram pelo link; proprietário troca o papel |
| 9 | Visualizador só consulta; colaborador recebe aviso de compromisso atribuído |
| 10 | Fechamento da janta desconta o estoque e conclui o evento |
| 11 | Exclusão de evento com compras e de produto com histórico |
| 12 | Celular: barra inferior e menu "Mais" |
| 13 | Proprietário exclui o espaço de teste |

**Como rodar:**

1. Crie três contas confirmadas no Supabase (proprietário, colaborador, visualizador) com a mesma senha.
2. `npm install && npx playwright install --with-deps chromium`
3. Suba o app (`npm run build && npm start`) com as variáveis do Supabase.
4. Rode:

```bash
HE_BASE_URL=http://localhost:3000 \
HE_OWNER_EMAIL=... HE_COLLAB_EMAIL=... HE_VIEWER_EMAIL=... HE_PASSWORD=... \
npm run test:e2e
```

A suíte cria um espaço `TESTE E2E …` e o exclui no último cenário. Se ela parar no meio, o espaço fica na lista do proprietário de teste e pode ser excluído pela própria tela.

No GitHub, o job manual **E2E (interface)** roda a mesma suíte quando os segredos `HE_E2E_OWNER_EMAIL`, `HE_E2E_COLLAB_EMAIL`, `HE_E2E_VIEWER_EMAIL`, `HE_E2E_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` estiverem cadastrados.

## Resultado em 10/11/2026

- Banco: **110/110** depois da migração 22 (antes dela: 90/95, mais 7 falhas numa rodada extra de exclusões e arquivamento).
- Interface: **13/13** com as correções desta rodada.
- Build e lint: sem erros; 32 avisos de código sem uso (listados em `AUDITORIA.md`).
