// Compara o estilo calculado de cada elemento, em cada tela, entre o CSS atual e as variantes geradas.
// Uso: node capture.mjs <dir-variantes> combined purged deduped final
import fs from 'node:fs';
import {chromium} from 'playwright';

const BASE = process.env.HE_BASE_URL || 'http://localhost:3000';
const dir = process.argv[2];
const variants = process.argv.slice(3);
const css = Object.fromEntries(variants.map(v => [v, fs.readFileSync(`${dir}/${v}.css`, 'utf8')]));
const SPACE = process.env.HE_SPACE || 'VISUAL E2E';
const PROPS = ['display', 'position', 'top', 'left', 'right', 'bottom', 'z-index', 'width', 'height', 'min-height', 'max-width',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-top-style', 'border-top-color', 'border-right-color', 'border-bottom-width', 'border-bottom-color', 'border-left-width', 'border-left-color',
  'border-top-left-radius', 'border-bottom-right-radius', 'color', 'background-color', 'background-image', 'box-shadow', 'opacity', 'visibility',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'text-align', 'text-decoration-line', 'white-space',
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'grid-template-columns', 'overflow-x', 'overflow-y', 'transform', 'filter',
  'clip-path', 'cursor', 'outline-style', 'object-fit'];
const PSEUDO = ['content', 'background-color', 'background-image', 'clip-path', 'width', 'height', 'opacity', 'left', 'bottom'];

async function applyVariant(page, name) {
  await page.evaluate(({name, text}) => {
    const own = document.getElementById('he-variant');
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"], style')].filter(n => n.id !== 'he-variant');
    for (const n of sheets) { if (n.tagName === 'LINK') n.disabled = name !== 'orig'; else n.media = name === 'orig' ? '' : 'not all'; }
    if (name === 'orig') { own?.remove(); return; }
    const el = own || Object.assign(document.createElement('style'), {id: 'he-variant'});
    el.textContent = text; document.head.appendChild(el);
  }, {name, text: css[name] || ''});
  await page.waitForTimeout(80);
}
async function capture(page) {
  return page.evaluate(({PROPS, PSEUDO}) => {
    const out = {};
    const pathOf = el => { const parts = []; for (let n = el; n && n !== document.body; n = n.parentElement) { const sib = [...n.parentElement.children].filter(c => c.tagName === n.tagName); parts.unshift(n.tagName.toLowerCase() + (sib.length > 1 ? ':' + (sib.indexOf(n) + 1) : '')); } return parts.join('>'); };
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg' || ['SCRIPT', 'STYLE', 'LINK', 'NEXT-ROUTE-ANNOUNCER'].includes(el.tagName)) continue;
      const cs = getComputedStyle(el), rec = {};
      for (const p of PROPS) rec[p] = cs.getPropertyValue(p);
      for (const ps of ['::before', '::after']) { const pc = getComputedStyle(el, ps); if (pc.content && pc.content !== 'none' && pc.content !== 'normal') for (const p of PSEUDO) rec[ps + p] = pc.getPropertyValue(p); }
      out[pathOf(el)] = rec;
    }
    return out;
  }, {PROPS, PSEUDO});
}
// Para as diferenças da variante final: quais seletores com !important (no deduped) casam com o elemento e declaram a propriedade.
async function culprits(page, diffs, importantSelectors) {
  const norm = x => x.replace(/(^|[^:]):(before|after)/g, '$1::$2').replace(/\s+/g, '').replace(/"/g, "'");
  const map = new Map(importantSelectors.map(s => [norm(s), s]));
  const got = await page.evaluate(({diffs, importantSelectors}) => {
    const norm = x => x.replace(/(^|[^:]):(before|after)/g, '$1::$2').replace(/\s+/g, '').replace(/"/g, "'");
    const sheet = document.getElementById('he-variant').sheet, found = new Set();
    const rules = []; const walk = list => { for (const r of list) { if (r.cssRules && r.media) { if (matchMedia(r.media.mediaText).matches) walk(r.cssRules); } else if (r.selectorText) rules.push(r); } };
    walk(sheet.cssRules);
    const byPath = p => { let n = document.body; for (const seg of p.split('>')) { const [tag, idx] = seg.split(':'); const sib = [...n.children].filter(c => c.tagName.toLowerCase() === tag); n = sib[(idx ? +idx : 1) - 1]; if (!n) return null; } return n; };
    for (const d of diffs) {
      const el = byPath(d.path); if (!el) continue;
      const prop = d.prop.replace(/^::(before|after)/, '');
      const target = d.prop.startsWith('::') ? null : el;
      for (const r of rules) {
        if (!importantSelectors.includes(norm(r.selectorText))) continue;
        let sel = r.selectorText;
        const pseudo = d.prop.match(/^::(before|after)/)?.[0];
        try {
          const matches = pseudo ? sel.split(',').some(s => s.trim().endsWith(pseudo) || s.trim().endsWith(':' + pseudo.slice(2))) && el.matches(sel.split(',').map(s => s.trim().replace(/::?(before|after)$/, '')).join(',')) : target.matches(sel);
          if (matches && r.style.getPropertyValue(prop)) found.add(norm(sel));
        } catch {}
      }
    }
    return [...found];
  }, {diffs, importantSelectors: [...map.keys()]});
  return got.map(k => map.get(k)).filter(Boolean);
}

const browser = await chromium.launch();
const report = {}, finalDiffs = [], failures = [];
let importantSelectors = [];
if (fs.existsSync(`${dir}/deduped.css`)) {
  const postcss = (await import('postcss')).default;
  const set = new Set(); postcss.parse(fs.readFileSync(`${dir}/deduped.css`, 'utf8')).walkDecls(d => { if (d.important) set.add(d.parent.selector); });
  importantSelectors = [...set];
}
const restore = new Set();

const nv = v => String(v).replace(/url\([^)]*\)/g, 'url()').replace(/(^|[\s,(])0(px|%)/g, '$10');
async function screen(page, name, go, viewport) {
  try { await go(); await page.waitForTimeout(500); }
  catch (e) { failures.push(viewport + '/' + name + ': ' + e.message.split('\n')[0]); return; }
  await applyVariant(page, 'orig');
  const base = await capture(page);
  for (const v of variants) {
    await applyVariant(page, v);
    const got = await capture(page), diffs = [];
    for (const [path, rec] of Object.entries(base)) {
      const g = got[path]; if (!g) { diffs.push({path, prop: '(elemento)', a: 'existe', b: 'sumiu'}); continue; }
      for (const [p, val] of Object.entries(rec)) if (nv(g[p]) !== nv(val)) diffs.push({path, prop: p, a: val, b: g[p]});
    }
    report[v] ??= {}; report[v][viewport + '/' + name] = diffs.length;
    if (diffs.length) report[v].samples ??= [], report[v].samples.length < 8 && report[v].samples.push({screen: viewport + '/' + name, ...diffs[0]});
    if (v === 'final' && diffs.length) { finalDiffs.push(...diffs.map(d => ({screen: name, ...d}))); for (const s of await culprits(page, diffs, importantSelectors)) restore.add(s); }
  }
  await applyVariant(page, 'orig');
}

for (const viewport of ['desktop', 'mobile']) {
  const ctx = await browser.newContext(viewport === 'desktop' ? {viewport: {width: 1440, height: 900}, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo'} : {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo'});
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss());
  const click = async (loc) => { await loc.first().click(); };
  await screen(page, 'login', async () => { await page.goto(BASE); await page.getByLabel('E-mail').waitFor(); }, viewport);
  await page.getByLabel('E-mail').fill(process.env.HE_OWNER_EMAIL); await page.getByLabel('Senha').fill(process.env.HE_PASSWORD);
  await page.getByRole('button', {name: 'Entrar'}).click();
  await screen(page, 'escolher-espaco', async () => { await page.getByRole('heading', {name: 'Escolha seu espaço'}).waitFor(); }, viewport);
  await page.getByRole('button', {name: new RegExp(SPACE)}).click();
  const nav = async label => viewport === 'desktop'
    ? click(page.locator('.hx-sidebar nav').getByRole('button', {name: label}))
    : click(page.getByRole('navigation', {name: 'Navegação no celular'}).getByRole('button', {name: label}));
  const team = async () => viewport === 'desktop' ? click(page.locator('.hx-sidebar').getByRole('button', {name: 'Espaços e equipe'})) : (await click(page.getByRole('button', {name: 'Abrir mais opções'})), await click(page.locator('.he-mobile-sheet').getByRole('button', {name: /Espaços e equipe/})));
  const close = async () => { await page.keyboard.press('Escape'); const c = page.getByRole('button', {name: /^(Cancelar|Fechar)$/}); if (await c.count()) await c.first().click().catch(() => {}); };
  await screen(page, 'visao-geral', async () => { await page.locator('.he-night-overview').waitFor(); }, viewport);
  await screen(page, 'busca', async () => { await page.getByLabel('Buscar no espaço').fill('c'); await page.locator('.he-night-search-results').waitFor(); }, viewport).catch(() => {});
  await page.getByLabel('Buscar no espaço').fill('').catch(() => {});
  await screen(page, 'sininho', async () => { await click(page.getByRole('button', {name: /^Notificações/})); await page.getByText('Conferir as cadeiras').first().waitFor(); }, viewport);
  await page.keyboard.press('Escape'); await click(page.getByRole('button', {name: /^Notificações/})).catch(() => {});
  await screen(page, 'eventos', async () => { await nav('Eventos'); await page.locator('.ev-event-card').first().waitFor(); }, viewport);
  await screen(page, 'evento-visao', async () => { await click(page.locator('.ev-event-card', {hasText: 'Churrasco'}).getByRole('button', {name: /Abrir evento/})); await page.locator('.ev-hero').waitFor(); }, viewport);
  for (const [n, label] of [['evento-cardapio', 'Abrir cardápio do evento'], ['evento-itens', 'Abrir itens necessários do evento'], ['evento-compras', 'Abrir compras do evento'], ['evento-compromissos', 'Abrir compromissos do evento']])
    await screen(page, n, async () => { await click(page.getByRole('button', {name: label})); await page.waitForTimeout(200); }, viewport);
  await screen(page, 'modal-colar-lista', async () => { await click(page.getByRole('button', {name: 'Abrir compras do evento'})); await click(page.locator('.ev-panel-title').getByRole('button', {name: 'Colar lista'})); await page.locator('.ev-modal').waitFor(); }, viewport);
  await close();
  await screen(page, 'fechamento-form', async () => { await click(page.locator('.ev-back-to-overview')); await click(page.getByRole('button', {name: /Iniciar fechamento/})); await click(page.getByRole('button', {name: /Adicionar produto/})); await click(page.getByRole('button', {name: /Registrar dano/})); }, viewport);
  await screen(page, 'modal-evento', async () => { await click(page.getByRole('button', {name: /Todos os eventos/})); await click(page.locator('.ev-event-card', {hasText: 'Churrasco'}).getByTitle('Editar evento')); await page.getByRole('dialog').waitFor(); }, viewport);
  await close();
  await screen(page, 'fechamento-relatorio', async () => { await click(page.locator('.ev-event-card', {hasText: 'aniversário'}).getByRole('button', {name: /Abrir evento/})); await click(page.getByRole('button', {name: /Ver relatório/})); await page.waitForTimeout(200); }, viewport);
  await screen(page, 'compromissos', async () => { await nav('Compromissos'); await page.locator('.cm-card').first().waitFor(); }, viewport);
  await screen(page, 'modal-compromisso', async () => { await click(page.getByRole('button', {name: /Novo compromisso/})); await page.getByRole('dialog').waitFor(); }, viewport);
  await close();
  await screen(page, 'estoque', async () => { await nav('Estoque'); await click(page.getByRole('button', {name: 'Produtos e insumos'})); await page.locator('[id^="he-stock-"]').first().waitFor(); }, viewport);
  await screen(page, 'modal-movimento', async () => { await click(page.locator('[id^="he-stock-"]', {hasText: 'Cerveja'}).getByRole('button', {name: /Saída/})); await page.locator('.stock-modal').waitFor(); }, viewport);
  await close();
  await screen(page, 'modal-produto', async () => { await click(page.getByRole('button', {name: /Novo produto|Adicionar produto|Cadastrar produto/})); await page.getByRole('dialog').waitFor(); }, viewport);
  await close();
  await screen(page, 'locais', async () => { await click(page.getByRole('button', {name: /Locais/})); await page.locator('.he-areas-dialog').waitFor(); }, viewport);
  await close();
  await screen(page, 'patrimonio', async () => { await click(page.getByRole('button', {name: 'Patrimônio e utensílios'})); await page.locator('.he-asset-card').first().waitFor(); }, viewport);
  await screen(page, 'modal-patrimonio', async () => { await click(page.locator('.he-asset-card', {hasText: 'Taças'}).getByRole('button', {name: /Movimentar/})); await page.locator('.he-asset-dialog').waitFor(); }, viewport);
  await close();
  await screen(page, 'patrimonio-historico', async () => { await click(page.getByRole('button', {name: /Histórico/})); await page.waitForTimeout(200); }, viewport);
  await screen(page, 'patrimonio-arquivados', async () => { await click(page.getByRole('button', {name: 'Arquivados'})); await page.waitForTimeout(200); }, viewport);
  await screen(page, 'equipe', async () => { await team(); await page.locator('.he-team-page').waitFor(); await click(page.getByRole('button', {name: /Excluir espaço/})); }, viewport);
  await screen(page, 'notificacoes', async () => { await click(page.getByRole('button', {name: /^Notificações/})); await click(page.getByRole('button', {name: /Ver todo o histórico/})); await page.waitForTimeout(300); }, viewport);
  await screen(page, 'preferencias', async () => { await click(page.getByRole('tab', {name: /Preferências/})); await page.waitForTimeout(300); }, viewport);
  if (viewport === 'mobile') await screen(page, 'menu-mais', async () => { await click(page.getByRole('button', {name: 'Abrir mais opções'})); await page.locator('.he-mobile-sheet').waitFor(); }, viewport);
  await ctx.close();
}
await browser.close();
const totals = Object.fromEntries(Object.entries(report).map(([v, r]) => [v, Object.entries(r).filter(([k]) => k !== 'samples').reduce((s, [, n]) => s + n, 0)]));
const screens = Object.keys(report[variants[0]] || {}).filter(k => k !== 'samples').length;
fs.writeFileSync(`${dir}/report.json`, JSON.stringify({totals, report, failures, finalDiffs: finalDiffs.slice(0, 200)}, null, 1));
const prev = fs.existsSync(`${dir}/restore.json`) ? JSON.parse(fs.readFileSync(`${dir}/restore.json`, 'utf8')) : [];
fs.writeFileSync(`${dir}/restore.json`, JSON.stringify([...new Set([...prev, ...restore])], null, 1));
console.log(JSON.stringify({screens, totals, newRestore: restore.size, failures}));
for (const v of variants) for (const s of report[v]?.samples || []) console.log(v, s.screen, s.path.slice(-60), s.prop, JSON.stringify(s.a).slice(0, 40), '→', JSON.stringify(s.b).slice(0, 40));
