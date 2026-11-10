// Fluxo completo de uma janta em casa: espaço → evento → cardápio, materiais, compras e compromissos →
// estoque e patrimônio → equipe e convite → papéis → notificações → fechamento → exclusões.
import {test, expect} from '@playwright/test';

const PASSWORD = process.env.HE_PASSWORD;
const OWNER = process.env.HE_OWNER_EMAIL;
const COLLAB = process.env.HE_COLLAB_EMAIL;
const VIEWER = process.env.HE_VIEWER_EMAIL;
const SPACE = 'TESTE E2E ' + Date.now().toString(36).toUpperCase();
const EVENT = 'Janta de teste';

test.describe.configure({mode: 'serial'});

let owner, ownerContext, inviteLink;

async function login(page, email, path = '/') {
  await page.goto(path);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', {name: 'Entrar'}).click();
}
async function toast(page, text) {
  await expect(page.locator('.hx-toast')).toContainText(text);
  await page.locator('.hx-toast').click();
}
async function openSpace(page) {
  await page.getByRole('button', {name: new RegExp(SPACE)}).click();
  await expect(page.locator('.hx-sidebar')).toBeVisible();
}
const nav = (page, label) => page.locator('.hx-sidebar nav').getByRole('button', {name: label}).click();

test.beforeAll(async ({browser}) => {
  expect(PASSWORD && OWNER && COLLAB && VIEWER, 'defina HE_PASSWORD, HE_OWNER_EMAIL, HE_COLLAB_EMAIL e HE_VIEWER_EMAIL').toBeTruthy();
  ownerContext = await browser.newContext();
  owner = await ownerContext.newPage();
  owner.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Despensa E2E' : undefined));
});
test.afterAll(async () => { await ownerContext?.close(); });

test('proprietário entra e cria um espaço novo', async () => {
  await login(owner, OWNER);
  await expect(owner.getByRole('heading', {name: 'Escolha seu espaço'})).toBeVisible();
  await owner.getByLabel('Nome do espaço').fill(SPACE);
  await owner.getByRole('button', {name: /Criar/}).click();
  await expect(owner.locator('.hx-sidebar')).toBeVisible();
  await expect(owner.locator('.he-brand-workspace')).toHaveText(SPACE);
  await expect(owner.getByRole('heading', {level: 1})).toContainText('He');
});

test('Visão geral → "Criar evento" abre o formulário do evento e salva', async () => {
  await owner.locator('.he-night-overview').getByRole('button', {name: /Criar evento/}).first().click();
  const dialog = owner.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toContainText('Eventos');
  await dialog.getByLabel('Evento').fill(EVENT);
  const date = new Date(Date.now() + 3 * 864e5).toLocaleDateString('en-CA');
  await dialog.getByLabel('Data').fill(date);
  await dialog.getByLabel('Convidados').fill('8');
  await dialog.getByLabel('Observações').fill('Levar gelo extra');
  await dialog.getByRole('button', {name: 'Salvar'}).click();
  await toast(owner, 'Registro salvo');
  await expect(owner.locator('.he-night-featured h2')).toHaveText(EVENT);
});

test('editar evento consegue apagar um campo opcional', async () => {
  await nav(owner, 'Eventos');
  await owner.locator('.ev-event-card', {hasText: EVENT}).getByTitle('Editar evento').click();
  const dialog = owner.getByRole('dialog');
  await expect(dialog.getByLabel('Observações')).toHaveValue('Levar gelo extra');
  await dialog.getByLabel('Observações').fill('');
  await dialog.getByRole('button', {name: 'Salvar'}).click();
  await toast(owner, 'Registro salvo');
  await owner.locator('.ev-event-card', {hasText: EVENT}).getByTitle('Editar evento').click();
  await expect(owner.getByRole('dialog').getByLabel('Observações')).toHaveValue('');
  await owner.getByRole('dialog').getByRole('button', {name: 'Cancelar'}).click();
});

test('planejamento: cardápio, itens necessários, compras coladas e compromissos', async () => {
  await owner.locator('.ev-event-card', {hasText: EVENT}).getByRole('button', {name: /Abrir evento/}).click();
  await expect(owner.locator('.ev-hero h2')).toHaveText(EVENT);

  await owner.getByRole('button', {name: 'Abrir cardápio do evento'}).click();
  await owner.locator('.ev-panel').getByRole('button', {name: 'Adicionar', exact: true}).click();
  await owner.locator('.ev-modal').getByLabel('Nome *').fill('Picanha');
  await owner.locator('.ev-modal').getByLabel('Quantidade *').fill('2');
  await owner.locator('.ev-modal').getByRole('button', {name: 'Salvar item'}).click();
  await expect(owner.locator('.ev-menu-item', {hasText: 'Picanha'})).toBeVisible();

  await owner.getByRole('button', {name: 'Abrir itens necessários do evento'}).click();
  await owner.getByRole('button', {name: 'Adicionar vários'}).click();
  await owner.locator('.ev-modal').getByLabel('Itens (um por linha)').fill('20 garfos\n20 copos\nliquidificador');
  await owner.locator('.ev-modal').getByRole('button', {name: 'Adicionar lista inteira'}).click();
  await expect(owner.locator('.ev-need-row')).toHaveCount(3);
  await owner.locator('.ev-need-row', {hasText: 'garfos'}).getByRole('button', {name: 'Assumir'}).click();
  await expect(owner.locator('.ev-need-row', {hasText: 'garfos'})).toContainText('Responsável: Você');

  await owner.getByRole('button', {name: 'Abrir compras do evento'}).click();
  await owner.locator('.ev-shopping-panel .ev-panel-title').getByRole('button', {name: 'Colar lista'}).click();
  await owner.locator('.ev-modal').getByLabel('Itens (um por linha)').fill('5 kg de carne\n3 caixas de cerveja\ncarvão\n2 garrafas de vinho');
  await owner.locator('.ev-modal').getByRole('button', {name: 'Adicionar lista inteira'}).click();
  await toast(owner, '4 itens adicionados');
  const carne = owner.locator('.ev-purchase-row', {hasText: 'carne'});
  await expect(carne).toContainText('5 kg');
  await expect(owner.locator('.ev-purchase-row', {hasText: 'vinho'})).toContainText('2 garrafa');
  await carne.getByRole('checkbox').click();
  await expect(owner.locator('.ev-shopping-summary')).toContainText('1 de 4 comprados');

  await owner.getByRole('button', {name: 'Abrir compromissos do evento'}).click();
  await owner.getByRole('button', {name: 'Novo compromisso'}).click();
  await owner.locator('.ev-modal').getByLabel('O que precisa ser feito? *').fill('Acender a churrasqueira');
  await owner.locator('.ev-modal').getByRole('button', {name: 'Salvar compromisso'}).click();
  await expect(owner.locator('.ev-task-row', {hasText: 'Acender a churrasqueira'})).toBeVisible();
});

test('estoque: produto com local novo, estoque inicial no histórico e saída', async () => {
  await nav(owner, 'Estoque');
  await owner.getByRole('button', {name: 'Produtos e insumos'}).click();
  await owner.getByRole('button', {name: /Novo produto|Adicionar produto|Cadastrar produto/}).first().click();
  const dialog = owner.getByRole('dialog');
  await dialog.getByLabel('Produto').fill('Cerveja lata');
  await dialog.getByLabel('Categoria').selectOption('Bebidas');
  await dialog.getByLabel('Quantidade inicial').fill('24');
  await dialog.getByLabel('Estoque mínimo').fill('6');
  await dialog.getByLabel('Local de armazenamento').selectOption('__new');
  await expect(dialog.getByLabel('Local de armazenamento')).toHaveValue(/[0-9a-f-]{36}/);
  await dialog.getByRole('button', {name: 'Salvar'}).click();
  await toast(owner, 'Registro salvo');
  const card = owner.locator('[id^="he-stock-"]', {hasText: 'Cerveja lata'});
  await expect(card).toContainText('Despensa E2E');
  await card.getByRole('button', {name: /Saída/}).click();
  await owner.locator('.stock-modal').getByLabel(/Quantidade/).fill('4');
  await owner.locator('.stock-modal').getByLabel('Motivo').fill('Teste de saída');
  await owner.locator('.stock-modal').locator('button[type=submit]').click();
  await toast(owner, 'Movimentação registrada');
  await expect(card).toContainText('20');
  await expect(owner.getByText('Estoque inicial').first()).toBeVisible();
});

test('patrimônio: cadastro, empréstimo, devolução, arquivar e reativar', async () => {
  await owner.getByRole('button', {name: 'Patrimônio e utensílios'}).click();
  for (const [name, qty] of [['Taças E2E', '12'], ['Travessa E2E', '2']]) {
    await owner.getByRole('button', {name: /Novo item|Cadastrar item/}).first().click();
    const dialog = owner.getByRole('dialog');
    await dialog.getByLabel('Item').fill(name);
    await dialog.getByLabel('Quantidade').fill(qty);
    await dialog.getByRole('button', {name: 'Salvar'}).click();
    await toast(owner, 'Registro salvo');
  }
  const tacas = owner.locator('.he-asset-card', {hasText: 'Taças E2E'});
  await tacas.getByRole('button', {name: /Movimentar/}).click();
  const move = owner.locator('.he-asset-dialog');
  await move.getByLabel('Quantidade').fill('3');
  await move.getByLabel('Quem está levando?').fill('Tia Maria');
  await move.getByRole('button', {name: 'Registrar movimentação'}).click();
  await toast(owner, 'Movimentação registrada');
  await expect(tacas).toContainText('Tia Maria');

  await owner.getByRole('button', {name: 'Arquivar Taças E2E'}).click();
  await toast(owner, 'Devolva os itens emprestados');

  const travessa = owner.locator('.he-asset-card', {hasText: 'Travessa E2E'});
  await owner.getByRole('button', {name: 'Arquivar Travessa E2E'}).click();
  await toast(owner, 'Item arquivado');
  await expect(travessa).toHaveCount(0);
  await owner.getByRole('button', {name: 'Arquivados'}).click();
  await owner.getByRole('button', {name: 'Reativar Travessa E2E'}).click();
  await toast(owner, 'Item reativado');
});

test('equipe: nome de exibição e link de convite', async () => {
  await owner.locator('.hx-sidebar').getByRole('button', {name: 'Espaços e equipe'}).click();
  await owner.getByLabel('Seu nome neste espaço').fill('Anfitrião E2E');
  await owner.getByRole('button', {name: 'Salvar nome'}).click();
  await toast(owner, 'Seu nome neste espaço foi atualizado');
  await expect(owner.locator('.hx-member').first()).toContainText('Anfitrião E2E');
  await owner.getByRole('button', {name: 'Gerar link de convite'}).click();
  inviteLink = await owner.getByLabel('Link do convite').inputValue();
  expect(inviteLink).toMatch(/\?convite=[a-f0-9]{64}$/);
});

test('colaborador e visualizador entram pelo link; proprietário define papéis', async ({browser}) => {
  for (const email of [COLLAB, VIEWER]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, email, new URL(inviteLink).pathname + new URL(inviteLink).search);
    await expect(page.locator('.he-choose-invite-notice')).toBeVisible();
    await openSpace(page);
    await ctx.close();
  }
  await owner.locator('.he-night-refresh').click();
  const viewerRow = owner.locator('.hx-member', {hasText: 'he-e2e-viewer'});
  await expect(viewerRow).toBeVisible();
  await viewerRow.locator('.he-role-select').selectOption('viewer');
  await toast(owner, 'Papel atualizado');
  await expect(viewerRow.locator('.he-role-select')).toHaveValue('viewer');
});

test('visualizador só consulta; colaborador recebe aviso de compromisso atribuído', async ({browser}) => {
  // proprietário atribui um compromisso ao colaborador
  await nav(owner, 'Compromissos');
  await owner.getByRole('button', {name: /Novo compromisso/}).first().click();
  const dialog = owner.getByRole('dialog');
  await dialog.getByLabel('O que precisa ser feito?').fill('Buscar o gelo');
  await dialog.getByLabel('Responsável').selectOption({label: 'he-e2e-collab'});
  await dialog.getByRole('button', {name: 'Salvar compromisso'}).click();
  await toast(owner, 'Compromisso criado');

  const vctx = await browser.newContext();
  const viewer = await vctx.newPage();
  await login(viewer, VIEWER);
  await openSpace(viewer);
  await expect(viewer.locator('.hx-user small')).toHaveText('Visualizador');
  await viewer.locator('.hx-sidebar nav').getByRole('button', {name: 'Eventos'}).click();
  await expect(viewer.locator('.ev-event-card', {hasText: EVENT})).toBeVisible();
  await expect(viewer.getByRole('button', {name: /Novo evento/})).toHaveCount(0);
  await expect(viewer.getByTitle('Editar evento')).toHaveCount(0);
  await vctx.close();

  const cctx = await browser.newContext();
  const collab = await cctx.newPage();
  await login(collab, COLLAB);
  await openSpace(collab);
  const bell = collab.getByRole('button', {name: /Notificações \(\d+ não lidas\)/});
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(collab.getByText('Buscar o gelo').first()).toBeVisible();
  await cctx.close();
});

test('fechamento da janta desconta estoque e conclui o evento', async () => {
  await nav(owner, 'Eventos');
  await owner.locator('.ev-event-card', {hasText: EVENT}).getByRole('button', {name: /Abrir evento/}).click();
  await owner.getByRole('button', {name: /Iniciar fechamento/}).click();
  await owner.getByRole('button', {name: /Adicionar produto/}).click();
  const product = owner.getByLabel('Produto do estoque');
  await product.selectOption(await product.locator('option', {hasText: 'Cerveja lata'}).getAttribute('value'));
  await owner.getByLabel('Consumido').fill('10');
  await owner.getByLabel('Resumo e observações gerais').fill('Tudo certo');
  await owner.getByRole('button', {name: 'Encerrar janta e gerar relatório'}).click();
  await expect(owner.getByText(/Janta encerrada|relatório/i).first()).toBeVisible();
  await owner.getByRole('button', {name: /Todos os eventos/}).click();
  await expect(owner.locator('.ev-event-card', {hasText: EVENT})).toContainText('Concluído');
  await nav(owner, 'Estoque');
  await owner.getByRole('button', {name: 'Produtos e insumos'}).click();
  await expect(owner.locator('[id^="he-stock-"]', {hasText: 'Cerveja lata'})).toContainText('10');
});

test('exclusões: evento com compras e produto com histórico', async () => {
  await nav(owner, 'Estoque');
  await owner.getByRole('button', {name: 'Produtos e insumos'}).click();
  await owner.getByRole('button', {name: 'Excluir Cerveja lata'}).click();
  await expect(owner.locator('[id^="he-stock-"]', {hasText: 'Cerveja lata'})).toHaveCount(0);
  await nav(owner, 'Eventos');
  await owner.locator('.ev-event-card', {hasText: EVENT}).getByTitle('Excluir evento').click();
  await expect(owner.locator('.ev-event-card', {hasText: EVENT})).toHaveCount(0);
});

test('celular: barra inferior e menu "Mais"', async ({browser}) => {
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const page = await ctx.newPage();
  await login(page, OWNER);
  await page.getByRole('button', {name: new RegExp(SPACE)}).click();
  await expect(page.locator('.hx-sidebar')).toBeHidden();
  const bottom = page.getByRole('navigation', {name: 'Navegação no celular'});
  await expect(bottom).toBeVisible();
  await bottom.getByRole('button', {name: 'Estoque'}).click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Estoque');
  await bottom.getByRole('button', {name: 'Abrir mais opções'}).click();
  await expect(page.locator('.he-mobile-sheet')).toBeVisible();
  await ctx.close();
});

test('proprietário exclui o espaço de teste', async () => {
  await owner.locator('.hx-sidebar').getByRole('button', {name: 'Espaços e equipe'}).click();
  await owner.getByRole('button', {name: /Excluir espaço/}).click();
  await owner.locator('#he-delete-confirm').fill(SPACE);
  await owner.getByRole('button', {name: 'Excluir permanentemente'}).click();
  await expect(owner.getByRole('heading', {name: 'Escolha seu espaço'})).toBeVisible();
  await expect(owner.getByRole('button', {name: new RegExp(SPACE)})).toHaveCount(0);
});
