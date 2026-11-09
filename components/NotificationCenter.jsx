'use client';
import {useState} from 'react';
import PushSettings from './PushSettings';
import {
 Bell,Settings2,ClipboardCheck,ShoppingCart,CalendarDays,Package,Users,
 Clock3,CalendarCheck2,CheckCheck,Check,ChevronRight,ArrowLeft,
 Inbox,Filter,RefreshCcw,ShieldCheck,History,SlidersHorizontal
} from 'lucide-react';

const kindInfo={
 assignment:{icon:ClipboardCheck,name:'Responsabilidades'},
 reminder:{icon:Clock3,name:'Lembretes'},
 event:{icon:CalendarDays,name:'Eventos'},
 shopping:{icon:ShoppingCart,name:'Compras'},
 stock:{icon:Package,name:'Estoque'},
 team:{icon:Users,name:'Equipe'},
 summary:{icon:CalendarCheck2,name:'Resumo de eventos'}
};
const settings=[
 {id:'assignments',label:'Compromissos e compras atribuídos a mim',description:'Quando alguém atribuir uma responsabilidade a você.',icon:ClipboardCheck},
 {id:'reminders',label:'Lembretes de compromissos',description:'Avisos de prazos para o dia seguinte.',icon:Clock3},
 {id:'events',label:'Alterações em eventos',description:'Criação de eventos e mudanças em datas, horários ou situação.',icon:CalendarDays},
 {id:'shopping',label:'Compras realizadas',description:'Atualizações de compras recebidas pelos administradores.',icon:ShoppingCart},
 {id:'stock',label:'Estoque baixo',description:'Quando a quantidade cair até o limite mínimo.',icon:Package},
 {id:'team',label:'Movimentações na equipe',description:'Avisos sobre a entrada de novos integrantes.',icon:Users},
 {id:'summaries',label:'Resumo antes da janta',description:'Aviso cerca de 24 horas antes, com tarefas, compras e materiais pendentes.',icon:CalendarCheck2}
];
function relativeDate(raw){
 if(!raw)return '';
 const time=new Date(raw).getTime(),diff=Math.max(0,Math.floor((Date.now()-time)/60000));
 if(diff<1)return 'Agora';if(diff<60)return 'Há '+diff+' min';
 if(diff<1440)return 'Há '+Math.floor(diff/60)+' h';
 const days=Math.floor(diff/1440);
 if(days===1)return 'Ontem';
 if(days<7)return 'Há '+days+' dias';
 return new Date(raw).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
}
function groupName(raw){
 const now=new Date(), date=new Date(raw);
 const fmt=x=>x.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const current=fmt(now),item=fmt(date);
 if(item===current)return 'Hoje';
 const yesterday=new Date(now.getTime()-86400000);
 if(item===fmt(yesterday))return 'Ontem';
 return date.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
}
function NoticeRow({notification,open,markRead,compact=false}){
 const info=kindInfo[notification.kind]||kindInfo.event;
 const Icon=info.icon;
 return <div className={'he-notice-row '+(notification.read_at?'':'unread')+(compact?' compact':'')}>
  <button type="button" className="he-notice-open" onClick={()=>open(notification)} title="Abrir registro relacionado">
   <span className="he-notice-icon"><Icon size={19}/></span>
   <span className="he-notice-copy"><span className="he-notice-title">{notification.title}</span><span className="he-notice-body">{notification.body}</span>
    <span className="he-notice-metadata">{relativeDate(notification.created_at)} <span>·</span> {info.name}</span>
   </span>
   <ChevronRight size={17} className="he-notice-arrow"/>
  </button>
  {!notification.read_at&&<button type="button" className="he-notice-read" aria-label={'Marcar como lida: '+notification.title} title="Marcar como lida" onClick={()=>markRead(notification)}><Check size={15}/></button>}
  {!notification.read_at&&<span className="he-notice-unread-dot" aria-hidden="true"/>}
 </div>;
}
export function NotificationBell({inbox,open,onToggle,onOpenPage,onOpenRecord}){
 const [onlyUnread,setOnlyUnread]=useState(false);
 const shown=(onlyUnread?inbox.items.filter(x=>!x.read_at):inbox.items).slice(0,5);
 return <div className="he-night-notification-wrap he-notice-bell-wrap">
  <button type="button" className={'he-night-icon-button '+(open?'active':'')} aria-label={'Notificações'+(inbox.unread?' ('+inbox.unread+' não lidas)':'')}
    aria-expanded={open} title="Notificações" onClick={onToggle}>
   <Bell size={23}/>
   {inbox.unread>0&&<span className="he-notice-count">{inbox.unread>99?'99+':inbox.unread}</span>}
  </button>
  {open&&<div className="he-notice-dropdown" role="region" aria-label="Notificações recentes">
   <header className="he-notice-dropdown-head">
    <span><Bell size={19}/> <strong>Notificações</strong>{inbox.unread>0&&<small>{inbox.unread} novas</small>}</span>
    <button type="button" title="Preferências" aria-label="Preferências de notificações" onClick={()=>onOpenPage('preferences')}><Settings2 size={18}/></button>
   </header>
   <div className="he-notice-dropdown-filters">
    <button type="button" className={!onlyUnread?'active':''} onClick={()=>setOnlyUnread(false)}>Todas</button>
    <button type="button" className={onlyUnread?'active':''} onClick={()=>setOnlyUnread(true)}>Não lidas</button>
    {inbox.unread>0&&<button className="he-notice-mark-all" type="button" onClick={()=>inbox.markAllRead()}><CheckCheck size={15}/> Marcar lidas</button>}
   </div>
   <div className="he-notice-dropdown-list">
    {inbox.loading?<p className="he-notice-empty">Carregando notificações…</p>:
     shown.length?shown.map(n=><NoticeRow key={n.id} compact notification={n} open={onOpenRecord} markRead={inbox.markRead}/>):
     <p className="he-notice-empty"><Inbox size={21}/>{onlyUnread?'Nenhuma notificação não lida.':'Nenhuma notificação neste espaço.'}</p>}
   </div>
   {inbox.error&&<p role="alert" className="he-notice-error">{inbox.error}</p>}
   <button type="button" className="he-notice-see-all" onClick={()=>onOpenPage('history')}>Ver todo o histórico <ChevronRight size={17}/></button>
  </div>}
 </div>;
}

export function NotificationInbox({inbox,view='history',onViewChange,onBack,onOpenRecord,workspaceName,supabase,workspaceId,userId}){
 const [filter,setFilter]=useState('all');
 const [kind,setKind]=useState('all');
 const isSettings=view==='preferences';
 const filtered=inbox.items.filter(n=>(filter!=='unread'||!n.read_at)&&(kind==='all'||n.kind===kind));
 const groups=[];
 filtered.forEach(n=>{
  const title=groupName(n.created_at);
  if(groups[groups.length-1]?.title!==title)groups.push({title,notices:[]});
  groups[groups.length-1].notices.push(n);
 });
 return <div className="he-notification-page">
  <div className="he-notification-page-bar">
   <button type="button" className="he-notice-back" onClick={onBack}><ArrowLeft size={18}/> Voltar</button>
   <span className="he-notification-workspace"><ShieldCheck size={16}/> {workspaceName}</span>
  </div>
  <div className="he-notification-page-top">
   <div><h2>{isSettings?'Preferências de notificações':'Central de Notificações'}</h2>
    <p>{isSettings?'Escolha os avisos que deseja receber neste espaço.':'Acompanhe o que aconteceu no espaço e retome o registro relacionado.'}</p></div>
   {!isSettings&&inbox.unread>0&&<button type="button" className="he-notice-mark-all-full" onClick={inbox.markAllRead}><CheckCheck size={16}/> Marcar todas como lidas</button>}
  </div>
  <div className="he-notification-tabs" role="tablist" aria-label="Notificações e preferências">
   <button type="button" role="tab" aria-selected={!isSettings} className={!isSettings?'active':''} onClick={()=>onViewChange('history')}><History size={17}/> Histórico</button>
   <button type="button" role="tab" aria-selected={isSettings} className={isSettings?'active':''} onClick={()=>onViewChange('preferences')}><SlidersHorizontal size={17}/> Preferências</button>
  </div>
  {isSettings?
   <section className="he-notice-preferences">
    <div className="he-notice-settings-intro"><Settings2 size={24}/><div><h3>Quais avisos você quer receber?</h3><p>As escolhas são individuais e não afetam os demais integrantes. Notificações sobre suas próprias ações não são enviadas.</p></div></div>
    {settings.map(({id,label,description,icon:Icon})=><label className="he-notice-setting-row" key={id}>
     <span className="he-notice-setting-icon"><Icon size={21}/></span>
     <span className="he-notice-setting-copy"><strong>{label}</strong><small>{description}</small></span>
     <input type="checkbox" checked={!!inbox.prefs[id]} disabled={inbox.loading||inbox.saving} onChange={e=>inbox.updatePreference(id,e.target.checked)} aria-label={label}/>
    </label>)}
    <PushSettings supabase={supabase} workspaceId={workspaceId} userId={userId}/>
    <div className="he-notice-settings-footer"><ShieldCheck size={18}/> Os avisos serão enviados de acordo com suas preferências. Para recebê-los na tela bloqueada, ative também o push neste aparelho.</div>
   </section>:
   <section className="he-notice-history">
    <div className="he-notice-toolbar">
     <div className="he-notice-filter-group">
      <button type="button" className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Todas</button>
      <button type="button" className={filter==='unread'?'active':''} onClick={()=>setFilter('unread')}>Não lidas ({inbox.unread})</button>
     </div>
     <label className="he-notice-category-filter"><Filter size={16}/><select value={kind} onChange={e=>setKind(e.target.value)} aria-label="Filtrar categoria">
      <option value="all">Todas as categorias</option>
      {Object.entries(kindInfo).map(([key,info])=><option key={key} value={key}>{info.name}</option>)}
     </select></label>
    </div>
    {inbox.loading?<p className="he-notice-empty">Carregando histórico…</p>:
      groups.length?groups.map(g=><div className="he-notice-group" key={g.title}><h3>{g.title}</h3><div className="he-notice-history-list">
       {g.notices.map(n=><NoticeRow key={n.id} notification={n} open={onOpenRecord} markRead={inbox.markRead}/>)}
      </div></div>):<div className="he-notice-empty he-notice-full-empty"><Inbox size={29}/><strong>Nenhuma notificação encontrada</strong><span>Os próximos avisos aparecerão aqui automaticamente.</span></div>}
    {inbox.hasMore&&<button type="button" className="he-notice-loadmore" disabled={inbox.loadingMore} onClick={inbox.loadMore}>
     {inbox.loadingMore?'Carregando…':'Carregar notificações antigas'} <ChevronRight size={16}/>
    </button>}
   </section>}
  {inbox.error&&<div className="he-notice-error" role="alert">{inbox.error}<button type="button" onClick={inbox.refresh}><RefreshCcw size={16}/> Tentar novamente</button></div>}
 </div>;
}
