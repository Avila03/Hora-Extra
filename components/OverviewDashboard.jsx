'use client';
import {
  CalendarDays, Clock3, MapPin, Users, UtensilsCrossed, PackageCheck,
  ShoppingBasket, ClipboardCheck, ChevronRight, ArrowRight, Plus, ListChecks,
  Package, Zap, CircleCheck, Check, Target, CalendarPlus
} from 'lucide-react';

const formatDate=(value,opts={day:'2-digit',month:'short'})=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR',opts):'Sem data';
const eventStatuses={planning:'Planejamento',confirmed:'Confirmado',active:'Em preparação',completed:'Concluído',cancelled:'Cancelado'};
const stateDone=(t)=>t.status==='done';
const number=(n)=>Number(n||0).toLocaleString('pt-BR');
const steps=[
  {key:'menu',label:'Cardápio definido',icon:UtensilsCrossed},
  {key:'items',label:'Materiais organizados',icon:PackageCheck},
  {key:'shopping',label:'Compras realizadas',icon:ShoppingBasket},
  {key:'commitments',label:'Compromissos concluídos',icon:ClipboardCheck}
];

export default function OverviewDashboard({
  events=[],tasks=[],shoppingItems=[],requirements=[],menuItems=[],stock=[],
  onNavigate,onOpenEvent,onCreateEvent,onCreateTask,onGoStock,canEdit=false
}){
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const next=events.filter(e=>e.event_date>=today&&!['completed','cancelled'].includes(e.status))
   .slice().sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date)));
 const featured=next[0]||null;
 const featuredMenu=menuItems.filter(x=>x.event_id===featured?.id);
 const featuredReq=requirements.filter(x=>x.event_id===featured?.id);
 const featuredPurchases=shoppingItems.filter(x=>x.event_id===featured?.id);
 const featuredTasks=tasks.filter(x=>x.event_id===featured?.id);
 const checks=[
  featuredMenu.length>0,
  featuredReq.length>0&&featuredReq.every(x=>x.is_done),
  featuredPurchases.length>0&&featuredPurchases.every(x=>x.status!=='pending'),
  featuredTasks.length>0&&featuredTasks.every(stateDone)
 ];
 const complete=checks.filter(Boolean).length;
 const progress=Math.round((complete/4)*100);
 const shortcuts=[
  {key:'menu',label:'Cardápio',num:featuredMenu.length+' '+(featuredMenu.length===1?'item':'itens'),description:'Pratos e bebidas',icon:UtensilsCrossed},
  {key:'items',label:'Itens necessários',num:featuredReq.length+' '+(featuredReq.length===1?'item':'itens'),description:'Materiais e utensílios',icon:PackageCheck},
  {key:'shopping',label:'Compras',num:featuredPurchases.length+' '+(featuredPurchases.length===1?'item':'itens'),description:featuredPurchases.filter(x=>x.status!=='pending').length+' comprados · '+featuredPurchases.filter(x=>x.status==='pending').length+' pendentes',icon:ShoppingBasket},
  {key:'commitments',label:'Compromissos',num:featuredTasks.filter(stateDone).length+'/'+featuredTasks.length,description:'Tarefas concluídas',icon:ClipboardCheck}
 ];
 const openSection=section=>featured?onOpenEvent(featured.id,section):onNavigate('events');
 return <div className="he-night-overview">
   <div className="he-night-hero-grid">
    <section className="he-night-featured" aria-label="Próximo evento">
      <div className="he-night-featured-image" aria-hidden="true"/>
      <div className="he-night-hero-content">
        <span className="he-night-eyebrow"><CalendarDays size={20}/> Próximo evento</span>
        {featured?<><h2>{featured.title}</h2>
         <p><CalendarDays size={18}/>{formatDate(featured.event_date,{weekday:'short',day:'2-digit',month:'2-digit'})}{featured.start_time&&<span>· {String(featured.start_time).slice(0,5)}</span>}</p>
         <p><Users size={18}/>{number(featured.guests)} {Number(featured.guests)===1?'convidado':'convidados'}{featured.event_type?' · '+featured.event_type:''}</p>
         <div className="he-night-hero-actions">
          <button className="he-night-bright-btn" type="button" onClick={()=>onOpenEvent(featured.id,'overview')}>Ver detalhes <ArrowRight size={18}/></button>
          <button className="he-night-ghost-btn" type="button" onClick={()=>onNavigate('events')}>Todos os eventos <ChevronRight size={17}/></button>
         </div>
        </>:<><h2>Seu próximo encontro começa aqui.</h2><p>Organize uma janta, festa ou reunião com a turma.</p>
         <div className="he-night-hero-actions"><button className="he-night-bright-btn" type="button" onClick={canEdit?onCreateEvent:()=>onNavigate('events')}><Plus size={17}/>{canEdit?'Criar evento':'Ver eventos'}</button></div>
        </>}
      </div>
    </section>
    <section className="he-night-progress-panel">
     <div className="he-night-panel-heading"><Target size={28}/><div><h3>Preparação do evento</h3><p>{featured?'Tudo para '+featured.title:'Acompanhe o próximo encontro'}</p></div></div>
     <div className="he-night-progress-line"><div className="he-night-progress-track"><span style={{width:featured?progress+'%':'0%'}}/></div><strong>{featured?progress+'%':'—'}</strong></div>
     <div className="he-night-step-list">
      {steps.map((step,i)=><button type="button" key={step.key} disabled={!featured} onClick={()=>openSection(step.key)} className="he-night-step">
       <span className={'he-night-step-check '+(checks[i]?'ready':'')}><Check size={15}/></span>
       <span>{step.label}</span><ChevronRight size={17}/>
      </button>)}
     </div>
    </section>
   </div>
   <div className="he-night-shortcuts" aria-label="Atalhos do próximo evento">
    {shortcuts.map(({key,label,num,description,icon:Icon})=>
     <button type="button" className="he-night-shortcut" key={key} onClick={()=>openSection(key)}>
      <Icon size={31} strokeWidth={1.7}/>
      <div><span>{label}</span><strong>{num}</strong></div><ChevronRight className="he-night-shortcut-arrow" size={20}/>
      <small>{description}</small>
     </button>)}
   </div>
   <div className="he-night-bottom-grid">
    <section className="he-night-box he-night-next-events">
     <header><div><CalendarDays size={27}/><h3>Próximos eventos</h3></div><button type="button" onClick={()=>onNavigate('events')}>Ver todos <ArrowRight size={17}/></button></header>
     <div className="he-night-events-list">
      {next.slice(0,3).map(e=><button type="button" key={e.id} className="he-night-event-row" onClick={()=>onOpenEvent(e.id,'overview')}>
       <span className="he-night-date-chip"><strong>{new Date(e.event_date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit'})}</strong><small>{new Date(e.event_date+'T12:00:00').toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase()}</small></span>
       <span className="he-night-event-data"><strong>{e.title}</strong><small>{formatDate(e.event_date,{weekday:'short',day:'2-digit',month:'2-digit'})}{e.start_time?' · '+String(e.start_time).slice(0,5):''}</small></span>
       <span className={'he-night-event-status '+e.status}>{eventStatuses[e.status]||'Em planejamento'}</span><ChevronRight size={20}/>
      </button>)}
      {!next.length&&<div className="he-night-empty"><CalendarPlus size={25}/><p>Nenhum próximo evento cadastrado.</p><button type="button" onClick={canEdit?onCreateEvent:()=>onNavigate('events')}>{canEdit?'Criar o primeiro evento':'Ver eventos'}</button></div>}
     </div>
    </section>
    <section className="he-night-box he-night-quick-panel">
     <header><div><Zap size={28}/><h3>Ações rápidas</h3></div></header>
     <div className="he-night-action-grid">
      <button type="button" onClick={canEdit?onCreateEvent:()=>onNavigate('events')}><CalendarPlus size={29}/><strong>{canEdit?'Criar evento':'Ver eventos'}</strong><span>{canEdit?'Agende um encontro':'Próximos encontros'}</span></button>
      <button type="button" onClick={canEdit?onCreateTask:()=>onNavigate('tasks')}><ListChecks size={29}/><strong>{canEdit?'Nova tarefa':'Ver compromissos'}</strong><span>{canEdit?'Adicione um compromisso':'Acompanhe as tarefas'}</span></button>
      <button type="button" onClick={()=>openSection('shopping')}><ShoppingBasket size={29}/><strong>{canEdit?'Registrar compra':'Ver compras'}</strong><span>Lista de compras do evento</span></button>
      <button type="button" onClick={onGoStock}><Package size={29}/><strong>{canEdit?'Atualizar estoque':'Ver estoque'}</strong><span>Gerencie quantidades</span></button>
     </div>
    </section>
   </div>
 </div>;
}