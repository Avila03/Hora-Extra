'use client';
import {useEffect, useState} from 'react';
import {ArrowLeft, Check} from 'lucide-react';

const pad = n => String(Math.floor(n)).padStart(2, '0');
const num = v => Number(v || 0).toLocaleString('pt-BR', {maximumFractionDigits: 3});
const phaseOrder = {during: 0, before: 1, after: 2};
const phaseLabel = {before: 'Antes', during: 'Durante', after: 'Depois'};

// Início do evento no fuso de São Paulo (UTC-3, sem horário de verão).
export function eventStart(event) {
  if (!event?.event_date) return null;
  const time = event.start_time ? String(event.start_time).slice(0, 5) : '00:00';
  return new Date(event.event_date + 'T' + time + ':00-03:00');
}
export function clockText(start, now) {
  if (!start) return {label: 'Hora extra', value: '--:--:--'};
  const diff = Math.round((now - start) / 1000);
  const abs = Math.abs(diff);
  if (diff < 0 && abs >= 172800) return {label: 'Começa em', value: Math.floor(abs / 86400) + ' dias'};
  const value = pad(abs / 3600) + ':' + pad((abs % 3600) / 60) + ':' + pad(abs % 60);
  return {label: diff < 0 ? 'Começa em' : 'Hora extra em curso', value};
}

export default function LiveMode({
  event, tasks = [], shoppingItems = [], requirements = [], members = [], stock = [], userId,
  canEdit = false, busy = false, onPatchTask, onPatchShopping, onPatchRequirement, onStockOut, onCloseout, onBack,
}) {
  const [tab, setTab] = useState('agora');
  const [now, setNow] = useState(() => Date.now());
  const [out, setOut] = useState(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const initials = id => {
    if (!id) return '--';
    if (id === userId) return 'EU';
    const name = members.find(m => m.user_id === id)?.display_name || '';
    return (name.trim().slice(0, 2) || '··').toUpperCase();
  };
  const work = tasks.filter(t => t.event_id === event.id)
    .slice().sort((a, b) => (phaseOrder[a.event_phase || 'before'] - phaseOrder[b.event_phase || 'before']) || String(a.created_at).localeCompare(String(b.created_at)));
  const shop = shoppingItems.filter(x => x.event_id === event.id);
  const req = requirements.filter(x => x.event_id === event.id);
  const lists = {
    agora: {title: 'Compromissos da janta', rows: work.map(t => ({
      id: t.id, title: t.title, done: t.status === 'done',
      meta: phaseLabel[t.event_phase || 'before'] + (t.notes ? ' · ' + t.notes : ''), who: initials(t.assigned_to),
      toggle: () => onPatchTask(t, {status: t.status === 'done' ? 'pending' : 'done'}),
    }))},
    compras: {title: 'Ainda falta buscar', rows: shop.map(x => ({
      id: x.id, title: x.name, done: x.status !== 'pending',
      meta: num(x.quantity) + ' ' + x.unit + (x.notes ? ' · ' + x.notes : ''), who: initials(x.assigned_to),
      toggle: () => onPatchShopping(x, {status: x.status === 'pending' ? 'purchased' : 'pending'}),
    }))},
    itens: {title: 'Materiais na mesa', rows: req.map(r => ({
      id: r.id, title: r.name, done: !!r.is_done,
      meta: num(r.quantity) + ' ' + r.unit + (r.notes ? ' · ' + r.notes : ''), who: initials(r.assigned_to),
      toggle: () => onPatchRequirement(r, {is_done: !r.is_done}),
    }))},
  };
  const current = lists[tab];
  const all = [...lists.agora.rows, ...lists.compras.rows, ...lists.itens.rows];
  const clock = clockText(eventStart(event), now);
  const tabs = [['agora', 'Agora', lists.agora.rows], ['compras', 'Compras', lists.compras.rows], ['itens', 'Itens', lists.itens.rows]];

  async function submitOut(e) {
    e.preventDefault();
    const item = stock.find(s => s.id === out.itemId);
    const qty = Number(String(out.qty).replace(',', '.'));
    if (!item || !Number.isFinite(qty) || qty <= 0) return;
    const ok = await onStockOut(item, qty);
    if (ok) setOut(null);
  }

  return <section className="hx2-live" aria-label="Hora extra em curso">
    <header className="hx2-live-head">
      <div className="hx2-live-top">
        <button type="button" className="hx2-icon-btn" onClick={onBack} aria-label="Voltar à visão geral do evento"><ArrowLeft size={18}/></button>
        <span className="hx2-live-status">● {event.status === 'completed' ? 'Encerrado' : 'Ao vivo'}</span>
      </div>
      <span className="hx2-live-label">{clock.label}</span>
      <strong className="hx2-live-clock" aria-live="off">{clock.value}</strong>
      <span className="hx2-live-sub">{event.title} · {pad(event.guests || 0)} pessoas</span>
      <div className="hx2-live-lights" role="img" aria-label={all.filter(r => r.done).length + ' de ' + all.length + ' itens resolvidos'}>
        {all.map(r => <span key={r.id} className={r.done ? 'on' : ''}/>)}
      </div>
      <div className="hx2-live-tabs" role="tablist" aria-label="Área do evento">
        {tabs.map(([key, label, rows]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
          {label} <small>{pad(rows.filter(r => r.done).length)}/{pad(rows.length)}</small>
        </button>)}
      </div>
    </header>

    <div className="hx2-live-list">
      <div className="hx2-live-list-title"><span>{current.title}</span><span>{pad(current.rows.filter(r => r.done).length)}/{pad(current.rows.length)}</span></div>
      {current.rows.map(r => <button key={r.id} type="button" className={'hx2-live-row' + (r.done ? ' done' : '')} aria-pressed={r.done}
        disabled={!canEdit || busy} onClick={r.toggle}>
        <span className="hx2-live-box" aria-hidden="true">{r.done ? <Check size={20} strokeWidth={3}/> : null}</span>
        <span className="hx2-row-main"><strong>{r.title}</strong><small>{r.meta}</small></span>
        <span className="hx2-live-who">{r.who}</span>
      </button>)}
      {!current.rows.length && <p className="hx2-empty">Nada cadastrado nesta área.</p>}
    </div>

    {out && <form className="hx2-live-out" onSubmit={submitOut}>
      <strong>O que acabou?</strong>
      <label>Produto do estoque<select required value={out.itemId} onChange={e => setOut({...out, itemId: e.target.value})}>
        <option value="">Selecione</option>
        {stock.map(s => <option key={s.id} value={s.id}>{s.name} · {num(s.quantity)} {s.unit}</option>)}
      </select></label>
      <label>Quantidade usada<input required inputMode="decimal" value={out.qty} onChange={e => setOut({...out, qty: e.target.value})}/></label>
      <div className="hx2-actions"><button type="button" className="hx2-btn secondary" onClick={() => setOut(null)}>Cancelar</button><button className="hx2-btn" disabled={busy}>Registrar saída</button></div>
    </form>}

    <footer className="hx2-live-foot">
      {canEdit && <button type="button" className="hx2-btn wide" onClick={() => setOut({itemId: '', qty: '1'})}>Acabou alguma coisa?</button>}
      {canEdit && <button type="button" className="hx2-btn secondary" onClick={onCloseout}>Encerrar e registrar</button>}
    </footer>
  </section>;
}
