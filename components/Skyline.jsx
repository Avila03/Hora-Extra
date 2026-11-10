'use client';
// Horizonte de prédios: cada área do evento é um prédio, cada item resolvido acende uma janela.
// Áreas com muitos itens mostram no máximo MAX janelas, acesas na mesma proporção.
const MAX = 12;
const pad = n => String(n).padStart(2, '0');

export function windowsFor(done, total) {
  if (!total) return [];
  const count = Math.min(total, MAX);
  const lit = total > MAX ? Math.round((done / total) * count) : done;
  return Array.from({length: count}, (_, i) => i < lit);
}

export default function Skyline({areas = [], onOpen, compact = false}) {
  const lit = areas.reduce((s, a) => s + a.done, 0);
  const total = areas.reduce((s, a) => s + a.total, 0);
  const tallest = Math.max(1, ...areas.map(a => Math.min(a.total, MAX)));
  return <div className={'hx2-skyline' + (compact ? ' compact' : '')}>
    <div className="hx2-skyline-head">
      <span>Preparativos</span>
      <strong>{pad(lit)}/{pad(total)} acesas</strong>
    </div>
    <div className="hx2-skyline-city" role="img"
      aria-label={'Preparativos: ' + areas.map(a => a.label + ' ' + a.done + ' de ' + a.total).join(', ')}>
      {areas.map((a, i) => {
        const wins = windowsFor(a.done, a.total);
        const rows = Math.max(1, Math.ceil(Math.min(a.total, MAX) / 2));
        const tallestRows = Math.ceil(tallest / 2);
        const height = 44 + Math.round((rows / Math.max(1, tallestRows)) * (compact ? 96 : 150)) + i * (compact ? 6 : 10);
        return <button type="button" key={a.key} className={'hx2-tower ' + (i % 2 ? 'up' : 'down') + (a.total && a.done === a.total ? ' complete' : '')}
          style={{height}} onClick={() => onOpen?.(a.key)} disabled={!onOpen}
          aria-label={a.label + ': ' + a.done + ' de ' + a.total + ' resolvidos'}>
          {wins.map((on, j) => <span key={j} className={on ? 'on' : ''}/>)}
          {!a.total && <em>vazio</em>}
        </button>;
      })}
    </div>
    <div className="hx2-skyline-labels">
      {areas.map(a => <div key={a.key}>
        <span>{a.label}</span>
        <strong className={a.total && a.done === a.total ? 'complete' : ''}>{pad(a.done)}/{pad(a.total)}</strong>
      </div>)}
    </div>
  </div>;
}
