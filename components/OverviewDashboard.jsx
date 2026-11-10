'use client';
import {Plus, ArrowRight} from 'lucide-react';
import Skyline from './Skyline';

const pad = n => String(n).padStart(2, '0');
const dayMonth = v => v ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}).replace('/', '.') : '--.--';
const weekday = v => v ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', {weekday: 'short'}).replace('.', '').toUpperCase() : '';
const num = n => Number(n || 0).toLocaleString('pt-BR', {maximumFractionDigits: 3});
const eventStatuses = {planning: 'Planejamento', confirmed: 'Confirmado', active: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado'};

export function eventAreas(eventId, {menuItems = [], requirements = [], shoppingItems = [], tasks = []}) {
  const menu = menuItems.filter(x => x.event_id === eventId);
  const req = requirements.filter(x => x.event_id === eventId);
  const shop = shoppingItems.filter(x => x.event_id === eventId);
  const work = tasks.filter(x => x.event_id === eventId);
  return [
    {key: 'menu', label: 'Cardápio', done: menu.length, total: menu.length},
    {key: 'items', label: 'Materiais', done: req.filter(x => x.is_done).length, total: req.length},
    {key: 'shopping', label: 'Compras', done: shop.filter(x => x.status !== 'pending').length, total: shop.length},
    {key: 'commitments', label: 'Tarefas', done: work.filter(x => x.status === 'done').length, total: work.length},
  ];
}

export default function OverviewDashboard({
  events = [], tasks = [], shoppingItems = [], requirements = [], menuItems = [], stock = [], userId,
  onNavigate, onOpenEvent, onCreateEvent, onCreateTask, onGoStock, canEdit = false,
}) {
  const today = new Date().toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
  const upcoming = events.filter(e => e.event_date >= today && !['completed', 'cancelled'].includes(e.status))
    .slice().sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
  const past = events.filter(e => e.event_date < today || e.status === 'completed')
    .slice().sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)));
  const featured = upcoming[0] || null;
  const areas = featured ? eventAreas(featured.id, {menuItems, requirements, shoppingItems, tasks}) : [];
  const days = featured ? Math.max(0, Math.round((new Date(featured.event_date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 864e5)) : 0;
  const dark = areas.reduce((s, a) => s + (a.total - a.done), 0);
  const mine = tasks.filter(t => t.assigned_to === userId && t.status !== 'done')
    .slice().sort((a, b) => String(a.due_on || '9999').localeCompare(String(b.due_on || '9999'))).slice(0, 4);
  const pending = shoppingItems.filter(x => x.status === 'pending' && (!featured || x.event_id === featured.id)).slice(0, 5);
  const expiring = p => p.expires_on && (new Date(p.expires_on + 'T12:00:00') - new Date(today + 'T12:00:00')) / 864e5 <= 30;
  const alerts = stock.filter(p => Number(p.quantity) <= Number(p.min_quantity) || expiring(p)).slice(0, 5);
  const agenda = [...upcoming.slice(0, 3), ...past.slice(0, Math.max(0, 3 - upcoming.length))];
  const openSection = key => featured ? onOpenEvent(featured.id, key) : onNavigate('events');
  const due = t => t.due_on ? (t.due_on === today ? 'HOJE' : weekday(t.due_on) + ' ' + dayMonth(t.due_on)) : 'SEM PRAZO';

  return <div className="he-night-overview hx2-overview">
    <div className="hx2-hero-row">
      <section className="he-night-featured hx2-hero" aria-label="Próximo evento">
        <div className="hx2-hero-main">
          <span className="hx2-eyebrow">■ Próximo encontro</span>
          {featured ? <>
            <h2>{featured.title}</h2>
            <dl className="hx2-facts">
              <div><dt>Data</dt><dd>{dayMonth(featured.event_date)} {weekday(featured.event_date)}</dd></div>
              <div><dt>Hora</dt><dd>{featured.start_time ? String(featured.start_time).slice(0, 5) : '--:--'}</dd></div>
              <div><dt>Pessoas</dt><dd>{pad(featured.guests || 0)}</dd></div>
            </dl>
            <div className="hx2-countdown">
              <strong>{pad(days)}</strong>
              <span><b>{days === 1 ? 'Dia' : 'Dias'}</b>{days === 0 ? 'A hora extra é hoje' : 'até a próxima hora extra'}</span>
            </div>
            <p className="hx2-hero-note">{dark ? dark + (dark === 1 ? ' janela ainda apagada.' : ' janelas ainda apagadas.') : 'Todas as janelas acesas. Está tudo pronto.'} {eventStatuses[featured.status] || ''}{featured.event_type ? ' · ' + featured.event_type : ''}</p>
            <div className="hx2-actions">
              <button className="he-night-bright-btn hx2-btn" type="button" onClick={() => onOpenEvent(featured.id, 'overview')}>Abrir evento</button>
              <button className="hx2-btn secondary" type="button" onClick={() => onOpenEvent(featured.id, 'live')}>Iniciar hora extra</button>
            </div>
          </> : <>
            <h2>Seu próximo encontro começa aqui.</h2>
            <p className="hx2-hero-note">Organize uma janta, festa ou reunião com a turma. Cada preparativo resolvido acende uma janela.</p>
            <div className="hx2-actions">
              <button className="he-night-bright-btn hx2-btn" type="button" onClick={canEdit ? onCreateEvent : () => onNavigate('events')}><Plus size={16}/>{canEdit ? 'Criar evento' : 'Ver eventos'}</button>
            </div>
          </>}
        </div>
        <div className="hx2-hero-city">
          {featured ? <Skyline areas={areas} onOpen={openSection}/> :
            <Skyline areas={[{key: 'a', label: 'Cardápio', done: 0, total: 0}, {key: 'b', label: 'Materiais', done: 0, total: 0}, {key: 'c', label: 'Compras', done: 0, total: 0}, {key: 'd', label: 'Tarefas', done: 0, total: 0}]}/>}
        </div>
      </section>

      <section className="hx2-card hx2-mine" aria-label="Com você">
        <header><h3>Com você</h3><span className={mine.length ? 'warn' : ''}>{pad(mine.length)} abertos</span></header>
        {mine.map((t, i) => <button type="button" key={t.id} className="hx2-ledger-row" onClick={() => t.event_id ? onOpenEvent(t.event_id, 'commitments') : onNavigate('tasks')}>
          <span className="hx2-index">{pad(i + 1)}</span>
          <span className="hx2-row-main"><strong>{t.title}</strong><small className={t.due_on === today ? 'warn' : ''}>{due(t)}{t.event_id ? ' · ' + (events.find(e => e.id === t.event_id)?.title || '') : ''}</small></span>
        </button>)}
        {!mine.length && <p className="hx2-empty">Nada esperando por você agora.</p>}
        {canEdit && <button type="button" className="hx2-btn dashed" onClick={onCreateTask}>+ Novo compromisso</button>}
      </section>
    </div>

    <div className="hx2-ledgers">
      <section className="hx2-card" aria-label="Compras pendentes">
        <header><h3>Compras</h3><span>{featured ? pad(areas[2].done) + '/' + pad(areas[2].total) + ' feitas' : pad(pending.length) + ' pendentes'}</span></header>
        <div className="hx2-cols"><span>Item</span><span>Qtd</span></div>
        {pending.map(x => <button type="button" key={x.id} className="hx2-ledger-row cols" onClick={() => onOpenEvent(x.event_id, 'shopping')}>
          <span className="hx2-row-main"><strong>{x.name}</strong><small className={x.assigned_to ? '' : 'warn'}>{x.assigned_to ? 'Com responsável' : 'Sem responsável'}</small></span>
          <span className="hx2-num">{num(x.quantity)} {x.unit}</span>
        </button>)}
        {!pending.length && <p className="hx2-empty">Nenhuma compra pendente.</p>}
      </section>

      <section className="hx2-card" aria-label="Estoque">
        <header><h3>Estoque</h3><span className={alerts.length ? 'warn' : 'ok'}>{alerts.length ? pad(alerts.length) + ' alertas' : 'Em dia'}</span></header>
        <div className="hx2-cols"><span>Produto</span><span>Saldo/mín</span></div>
        {alerts.map(p => <button type="button" key={p.id} className="hx2-ledger-row cols" onClick={onGoStock}>
          <span className="hx2-row-main"><strong>{p.name}</strong><small>{Number(p.quantity) <= Number(p.min_quantity) ? 'Abaixo do mínimo' : 'Vence em ' + dayMonth(p.expires_on)}</small></span>
          <span className="hx2-num warn">{num(p.quantity)}/{num(p.min_quantity)} {p.unit}</span>
        </button>)}
        {!alerts.length && <p className="hx2-empty">Nenhum produto abaixo do mínimo ou perto do vencimento.</p>}
      </section>

      <section className="hx2-card" aria-label="Agenda">
        <header><h3>Agenda</h3><button type="button" className="hx2-link" onClick={() => onNavigate('events')}>Todos <ArrowRight size={14}/></button></header>
        {agenda.map(e => {
          const done = e.status === 'completed' || e.event_date < today;
          return <button type="button" key={e.id} className={'hx2-agenda-row' + (done ? ' past' : '')} onClick={() => onOpenEvent(e.id, 'overview')}>
            <span className="hx2-agenda-date"><strong>{dayMonth(e.event_date)}</strong><small>{weekday(e.event_date)}{e.start_time ? ' · ' + String(e.start_time).slice(0, 5) : ''}</small></span>
            <span className="hx2-row-main"><strong>{e.title}</strong><small className={done ? 'ok' : ''}>{done ? 'Encerrado' : (eventStatuses[e.status] || '') + ' · ' + pad(e.guests || 0) + ' pessoas'}</small></span>
          </button>;
        })}
        {!agenda.length && <p className="hx2-empty">Nenhum evento ainda.</p>}
        {canEdit && <button type="button" className="hx2-btn dashed" onClick={onCreateEvent}>+ Planejar o próximo</button>}
      </section>
    </div>
  </div>;
}
