'use client';
import {CalendarDays, CheckCircle2, ClipboardCheck, ShoppingCart, Package, ChevronRight, Clock3, UserRound, CalendarClock, ClipboardList, Flame, Leaf, ArrowRight, Check} from 'lucide-react';
const d=(s)=>s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sem data';
const statusMap={pending:'Pendente',in_progress:'Em andamento',done:'Concluído'};
const labelFor=(item)=>item.title||item.name||'Item';
function CardTitle({icon:Icon,title,subtitle,action,onAction}){return <div className="he-card-heading"><div className="he-card-heading-start"><Icon size={23} strokeWidth={1.8}/><div><h2>{title}</h2><p>{subtitle}</p></div></div><button className="he-inline-link" onClick={onAction}>{action}<ChevronRight size={16}/></button></div>}
function Empty({text}){return <p className="he-empty">{text}</p>}
export default function OverviewDashboard({events=[],tasks=[],requirements=[],stock=[],members=[],userId,canEdit=false,onNavigate,onOpenEvent,onToggleRequirement}){
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const future=events.filter(e=>e.event_date>=today&&!['completed','cancelled'].includes(e.status)).slice().sort((a,b)=>a.event_date.localeCompare(b.event_date));
 const upcoming15=future.filter(e=>(new Date(e.event_date+'T12:00:00')-new Date(today+'T12:00:00'))/86400000<=15);
 const pending=tasks.filter(t=>t.status!=='done');
 const low=stock.filter(i=>Number(i.quantity)<=Number(i.min_quantity));
 const shopping=requirements.filter(r=>['buy','partial'].includes(r.purchase_status));
 const purchased=shopping.filter(r=>r.is_done);
 const pct=shopping.length?Math.round(100*purchased.length/shopping.length):0;
 const highlighted=future[0];
 const assignee=(id)=>!id?'Sem responsável':id===userId?'Você':members.find(m=>m.user_id===id)?.display_name||'Integrante';
 const highlights=pending.slice().sort((a,b)=>Number(a.assigned_to===userId)-Number(b.assigned_to===userId)||String(a.due_on||'9999').localeCompare(String(b.due_on||'9999'))).slice(0,3);
 const shopItems=shopping.slice().sort((a,b)=>Number(a.is_done)-Number(b.is_done)||String(a.created_at).localeCompare(String(b.created_at))).slice(0,3);
 const stockItems=stock.slice().sort((a,b)=>(Number(a.quantity)<=Number(a.min_quantity)?-1:1)-(Number(b.quantity)<=Number(b.min_quantity)?-1:1)).slice(0,4);
 const kpis=[
  {label:'Próximos eventos',number:upcoming15.length,detail:'Nos próximos 15 dias',icon:CalendarDays,go:'events'},
  {label:'Compromissos pendentes',number:pending.length,detail:'Aguardando conclusão',icon:ClipboardCheck,go:'tasks'},
  {label:'Progresso das compras',number:pct+'%',detail:purchased.length+' de '+shopping.length+' itens comprados',icon:ShoppingCart,go:'events'},
  {label:'Itens em baixo estoque',number:low.length,detail:'Precisam de atenção',icon:Package,go:'inventory_items'}
 ];
 return <div className="he-overview">
  <div className="he-kpi-grid">{kpis.map(({label,number,detail,icon:Icon,go})=><button type="button" className="he-kpi" key={label} onClick={()=>onNavigate(go)}><span className="he-kpi-icon"><Icon size={26} strokeWidth={1.7}/></span><span className="he-kpi-copy"><span className="he-kpi-label">{label}</span><strong>{number}</strong><small>{detail}</small></span><ChevronRight size={17} className="he-kpi-chevron"/></button>)}</div>
  <div className="he-overview-grid">
   <section className="he-dash-card he-commitment-preview">
    <CardTitle icon={ClipboardCheck} title="Compromissos" subtitle="Responsabilidades para os próximos encontros." action="Ver todos" onAction={()=>onNavigate('tasks')}/>
    <div className="he-preview-rows">{highlights.map(t=><div className="he-preview-row" key={t.id}><span className="he-preview-item-icon">{t.kind==='purchase'?<ShoppingCart size={20}/>:t.kind==='maintenance'?<Flame size={20}/>:<Leaf size={20}/>}</span><div className="he-preview-item"><strong>{labelFor(t)}</strong><small>Responsável: {assignee(t.assigned_to)}</small></div><span className={'he-status '+(t.status||'pending')}>{statusMap[t.status]||'Pendente'}</span></div>)}{!highlights.length&&<Empty text="Nenhum compromisso pendente no momento."/>}</div>
   </section>
   <section className="he-featured-card">
    {highlighted?<><div className="he-featured-pattern"/><div className="he-featured-content"><span className="he-featured-eyebrow">EVENTO EM DESTAQUE</span><h2>{highlighted.title}</h2><div className="he-featured-detail"><CalendarDays size={18}/>{d(highlighted.event_date)}{highlighted.start_time&&<><span className="he-separator"/><Clock3 size={18}/>{String(highlighted.start_time).slice(0,5)}</>}</div><div className="he-featured-detail"><UserRound size={18}/>{highlighted.guests||0} convidados</div><div className="he-featured-actions"><button type="button" className="he-featured-primary" onClick={()=>onOpenEvent(highlighted.id)}><CalendarClock size={18}/> Ver detalhes</button><button type="button" className="he-featured-outline" onClick={()=>onNavigate('events')}>Todos os eventos <ArrowRight size={16}/></button></div></div></>:<div className="he-featured-content he-no-events"><span className="he-featured-eyebrow">PRÓXIMO ENCONTRO</span><CalendarDays size={40}/><h2>O próximo encontro começa aqui.</h2><p>Crie um evento para organizar cardápio, compras e preparativos.</p><button className="he-featured-primary" type="button" onClick={()=>onNavigate('events')}>Ver eventos <ArrowRight size={16}/></button></div>}
   </section>
   <section className="he-dash-card">
    <CardTitle icon={ShoppingCart} title="Lista de compras" subtitle="Itens dos eventos, com responsáveis." action="Ver compras" onAction={()=>onNavigate('events')}/>
    <div className="he-shop-stat"><strong>{pct}%</strong><div><span>{purchased.length} de {shopping.length} itens comprados</span><div className="he-progress"><span style={{width:pct+'%'}}/></div></div></div>
    <div className="he-preview-rows">{shopItems.map(r=><div key={r.id} className="he-preview-row he-shop-row"><label className="he-small-check"><input type="checkbox" disabled={!canEdit} checked={!!r.is_done} onChange={()=>onToggleRequirement(r)} aria-label={'Marcar '+r.name+' como comprado'}/></label><div className="he-preview-item"><strong className={r.is_done?'done':''}>{r.name} ({Number(r.quantity||0).toLocaleString('pt-BR')} {r.unit||'un'})</strong></div><span className="he-shop-assignee"><UserRound size={13}/>{assignee(r.assigned_to)}</span><span className={'he-status '+(r.is_done?'done':'pending')}>{r.is_done?'Comprado':'Pendente'}</span></div>)}{!shopItems.length&&<Empty text="Adicione itens de compra ao planejamento de um evento."/>}</div>
   </section>
   <section className="he-dash-card">
    <CardTitle icon={Package} title="Estoque" subtitle="Produtos disponíveis e alertas de reposição." action="Ver estoque" onAction={()=>onNavigate('inventory_items')}/>
    <div className="he-preview-rows">{stockItems.map(r=>{const isLow=Number(r.quantity)<=Number(r.min_quantity);const goal=Math.max(Number(r.min_quantity)*2,Number(r.quantity),1);const pct=100*Number(r.quantity)/goal;return <div key={r.id} className="he-preview-row he-stock-row"><span className="he-stock-product-icon"><Package size={19}/></span><div className="he-preview-item"><strong>{r.name}</strong></div><small className="he-stock-quantity">{Number(r.quantity||0).toLocaleString('pt-BR')} {r.unit||'un'}</small><div className="he-stock-bar" aria-label={isLow?'Estoque baixo':'Estoque suficiente'}><span style={{width:pct+'%'}}/></div><span className={'he-status '+(isLow?'pending':'done')}>{isLow?'Baixo':'Ok'}</span></div>})}{!stockItems.length&&<Empty text="Seu estoque aparecerá aqui após o primeiro cadastro."/>}</div>
   </section>
  </div>
 </div>;
}
