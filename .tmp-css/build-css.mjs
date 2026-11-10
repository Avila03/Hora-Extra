// Gera as variantes do CSS unificado a partir dos arquivos atuais, na mesma ordem em que o app os carrega.
// Uso (na raiz do repo): node build-css.mjs <saida> [restaurar.json]
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import {PurgeCSS} from 'purgecss';

const out = process.argv[2] || '/tmp/css';
const restoreFile = process.argv[3];
fs.mkdirSync(out, {recursive: true});
const order = ['globals', 'live', 'stock', 'events', 'commitments', 'brand', 'spaces', 'workspace-chooser', 'midnight', 'notifications', 'assets-closeout'];
const combined = order.map(n => `/* ===== ${n}.css ===== */\n` + fs.readFileSync(`app/${n}.css`, 'utf8')).join('\n');
fs.writeFileSync(path.join(out, 'combined.css'), combined);

const [purged] = await new PurgeCSS().purge({
  content: ['app/**/*.jsx', 'components/**/*.{jsx,js}'],
  css: [{raw: combined}],
  keyframes: true, fontFace: true, variables: false,
  safelist: {
    standard: ['planning', 'confirmed', 'active', 'completed', 'cancelled', 'pending', 'in_progress', 'done', 'purchased', 'received',
      'general', 'purchase', 'maintenance', 'danger', 'warning', 'success', 'compact', 'invited', 'unread', 'selected', 'checked',
      'taken', 'unassigned', 'ready', 'quiet', 'warn', 'archived', 'is-closed', 'enabled', 'positive', 'negative', 'on', 'wide'],
    greedy: [/^status-/, /^he-notice/, /^he-night/],
  },
});
fs.writeFileSync(path.join(out, 'purged.css'), purged.css);

// Remove declarações sobrescritas pela MESMA regra (mesmo seletor e mesmo contexto @media) mais adiante.
function dedupe(css) {
  const root = postcss.parse(css);
  const seen = new Map(); // ctx|seletor|prop -> declaração vencedora até aqui
  const rules = [];
  root.walkRules(rule => { if (rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return; rules.push(rule); });
  let removed = 0;
  for (const rule of rules) {
    const ctx = rule.parent.type === 'atrule' ? '@' + rule.parent.name + ' ' + rule.parent.params : '';
    const sel = rule.selectors.map(s => s.trim()).sort().join(',');
    rule.walkDecls(decl => {
      const key = ctx + '|' + sel + '|' + decl.prop;
      const prev = seen.get(key);
      const modern = /dvh|svh|lvh|color-mix|-webkit-|-moz-/.test(decl.value + prev?.value);
      if (!prev || prev.parent === decl.parent || modern) { seen.set(key, decl); return; }
      if (prev.important && !decl.important) { decl.remove(); removed++; return; }
      prev.remove(); removed++; seen.set(key, decl);
    });
  }
  root.walkRules(r => { if (!r.nodes.length) r.remove(); });
  root.walkAtRules(a => { if (a.nodes && !a.nodes.length) a.remove(); });
  return {css: root.toString(), removed};
}
const deduped = dedupe(purged.css);
fs.writeFileSync(path.join(out, 'deduped.css'), deduped.css);

// Sem !important, exceto as declarações que a comparação provou necessárias (restaurar.json: ["seletor", ...]).
const keep = new Set(restoreFile && fs.existsSync(restoreFile) ? JSON.parse(fs.readFileSync(restoreFile, 'utf8')) : []);
const root = postcss.parse(deduped.css);
let stripped = 0, kept = 0;
root.walkDecls(d => {
  if (!d.important) return;
  if (keep.has(d.parent.selector)) { kept++; return; }
  d.important = false; stripped++;
});
fs.writeFileSync(path.join(out, 'final.css'), root.toString());
const count = s => (s.match(/!important/g) || []).length;
console.log(JSON.stringify({
  combinedBytes: combined.length, purgedBytes: purged.css.length, dedupedBytes: deduped.css.length,
  dedupRemoved: deduped.removed, importantBefore: count(combined), importantKept: kept, importantStripped: stripped,
  purgedRejected: (purged.rejected || []).length,
}));
