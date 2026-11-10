'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,Users,UtensilsCrossed,ClipboardList,ShoppingBasket,PackageCheck,Plus,Check,CheckCircle2,Trash2,Pencil,X,Search,ChevronRight,AlertCircle,Package,ClipboardCheck,Info,UserRound,Copy,CheckCheck} from 'lucide-react';
import EventCloseout from './EventCloseout';

const courses={main:'Prato principal',side:'Acompanhamento',drink:'Bebida',dessert:'Sobremesa',other:'Outro'};
const purchaseStatuses={pending:'Pendente',purchased:'Comprado',received:'Recebido'};
const statusLabels={planning:'Planejado',confirmed:'Confirmado',active:'Em andamento',completed:'Concluído',cancelled:'Cancelado'};
const fmtDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const num=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
const eventSectionLabels={overview:'Visão geral',menu:'Cardápio',items:'Itens necessários',shopping:'Compras',commitments:'Compromissos',closeout:'Fechamento da janta'};
const eventPhaseLabels={before:'Antes do evento',during:'Durante o evento',after:'Depois do evento'};
const taskStatusLabels={pending:'Pendente',in_progress:'Em andamento',done:'Concluído'};
const emptyItem={name:'',quantity:'1',unit:'un',course:'main',notes:''};
const emptyRequirement={name:'',quantity:'1',unit:'un',inventory_item_id:'',assigned_to:'',notes:''};
const emptyPurchase={name:'',quantity:'1',unit:'un',assigned_to:'',notes:'',status:'pending',estimated_unit_price:''};
const emptyTask={title:'',event_phase:'before',assigned_to:'',due_on:'',status:'pending',notes:''};
const bulkUnitNames={un:'un',unidade:'un',unidades:'un',x:'un',kg:'kg',g:'g',l:'L',litro:'L',litros:'L',ml:'ml',pacote:'pacote',pacotes:'pacote',caixa:'caixa',caixas:'caixa',saco:'saco',sacos:'saco',garrafa:'garrafa',garrafas:'garrafa',fardo:'fardo',fardos:'fardo',lata:'lata',latas:'lata'};
function parseBulkInput(raw){
 return String(raw||'').split(/\r?\n/).map(value=>value.trim().replace(/^[•*-]\s*/, '')).filter(Boolean).map(value=>{
  let name=value,quantity=1,unit='un';
  const match=value.match(/^(\d+(?:[.,]\d+)?)\s*(unidades?|un|kg|ml|g|litros?|l|pacotes?|caixas?|sacos?|garrafas?|fardos?|latas?|x)?\s+(.+)$/i);
  if(match){
   quantity=Number(match[1].replace(',','.'));
   unit=bulkUnitNames[(match[2]||'un').toLowerCase()]||'un';
   name=match[3].replace(/^de\s+/i,'').trim();
  }
  if(!name||!Number.isFinite(quantity)||quantity<=0||name.length>180)throw new Error('Revise a lista: use nomes de até 180 caracteres e quantidades positivas.');
  return {name,quantity,unit};
 });
}

export default function EventHub({
 events=[], menuItems=[], requirements=[], shoppingItems=[], tasks=[], stock=[], assets=[],closeouts=[],closeoutConsumption=[],closeoutDamages=[],members=[], userId, workspaceId, defaultEventId=null, defaultEventSection='overview',focusShoppingId=null,
 supabase, canEdit=false, canDelete=false, onAddEvent, onEditEvent, onDeleteEvent,
 onRefresh, onNotify
}){
 const [openedId,setOpenedId]=useState(null);
 const lastOpenedFromDashboard=useRef(null);
 const [tab,setTab]=useState('overview');
 const [search,setSearch]=useState('');
 const [modal,setModal]=useState(null);
 const [form,setForm]=useState({});
 const [busy,setBusy]=useState(false);
 const [menuNoteEdit,setMenuNoteEdit]=useState(false);
 const [menuNote,setMenuNote]=useState('');
 const [shoppingShowDone,setShoppingShowDone]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!defaultEventId){lastOpenedFromDashboard.current=null;return;}
  const section=['overview','menu','items','shopping','commitments','closeout'].includes(defaultEventSection)?defaultEventSection:'overview';
  const key=defaultEventId+':'+section;
  if(key!==lastOpenedFromDashboard.current&&events.some(e=>e.id===defaultEventId)){
   lastOpenedFromDashboard.current=key;
   setOpenedId(defaultEventId);
   setTab(section);
  }
 },[defaultEventId,defaultEventSection,events]);
 useEffect(()=>{
  if(!focusShoppingId||tab!=='shopping'||!openedId)return;
  const frame=requestAnimationFrame(()=>document.getElementById('he-shopping-'+focusShoppingId)?.scrollIntoView({behavior:'smooth',block:'center'}));
  return()=>cancelAnimationFrame(frame);
 },[focusShoppingId,tab,openedId,shoppingItems.length]);
 const event=events.find(e=>e.id===openedId);
 const eventCloseout=closeouts.find(c=>c.event_id===event?.id)||null;
 const ordered=useMemo(()=>{
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const past=e=>String(e.event_date)<today||['completed','cancelled'].includes(e.status);
  return events.slice().sort((a,b)=>Number(past(a))-Number(past(b))||(past(a)
    ?String(b.event_date).localeCompare(String(a.event_date))
    :String(a.event_date).localeCompare(String(b.event_date))));
 },[events]);
 const dishes=menuItems.filter(m=>m.event_id===event?.id).slice().sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 const needed=requirements.filter(r=>r.event_id===event?.id).slice().sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 const eventTasks=tasks.filter(t=>t.event_id===event?.id).slice().sort((a,b)=>({before:0,during:1,after:2}[a.event_phase||'before']??0)-({before:0,during:1,after:2}[b.event_phase||'before']??0)||Number(a.status==='done')-Number(b.status==='done')||String(a.created_at).localeCompare(String(b.created_at)));
 const finishedTasks=eventTasks.filter(t=>t.status==='done').length;
 const tasksProgress=eventTasks.length?Math.round(100*finishedTasks/eventTasks.length):0;
 const memberName=id=>id?((id===userId)?'Você':(members.find(m=>m.user_id===id)?.display_name||'Integrante')):'Sem responsável';
 const shoppingList=shoppingItems.filter(r=>r.event_id===event?.id).slice().sort((a,b)=>Number(a.status!=='pending')-Number(b.status!=='pending')||String(a.created_at).localeCompare(String(b.created_at)));
 const buying=shoppingList.filter(r=>r.status==='pending');
 const purchased=shoppingList.filter(r=>r.status!=='pending');
 const shoppingProgress=shoppingList.length?Math.round(100*purchased.length/shoppingList.length):0;
 const stockById=useMemo(()=>Object.fromEntries(stock.map(s=>[s.id,s])),[stock]);

 function openEvent(row){setOpenedId(row.id);setTab('overview');setSearch('');setMenuNoteEdit(false);setMenuNote(row.menu_notes||'');setError('');}
 function back(){setOpenedId(null);setModal(null);setTab('overview');setSearch('');setError('');}
 function openForm(type,row){
  if(!canEdit)return;
  setError('');
  if(type==='bulkShopping'||type==='bulkRequirement'){
   setForm({lines:'',assigned_to:''});setModal({type,id:null});return;
  }
  setModal({type,id:row?.id||null});
  const defaults=type==='menu'?emptyItem:type==='requirement'?emptyRequirement:emptyPurchase;
  setForm(row?{
   ...defaults,name:row.name,quantity:String(row.quantity),unit:row.unit,
   notes:row.notes||'',assigned_to:row.assigned_to||'',
   ...(type==='menu'?{course:row.course||'main'}:
   type==='requirement'?{inventory_item_id:row.inventory_item_id||''}:
   {status:row.status||'pending',estimated_unit_price:row.estimated_unit_price??''})
  }:{...defaults});
 }
 function openTaskForm(row=null,preset=''){
  if(!canEdit)return;
  setError('');
  setModal({type:'task',id:row?.id||null});
  setForm(row?{
   title:row.title||'',event_phase:row.event_phase||'before',
   assigned_to:row.assigned_to||'',due_on:row.due_on||'',
   status:row.status||'pending',notes:row.notes||''
  }:{...emptyTask,title:preset,due_on:event?.event_date||''});
 }
 function selectStock(id){
   const item=stockById[id];
   setForm(f=>({...f,inventory_item_id:id,name:item?.name||f.name,unit:item?.unit||f.unit}));
 }
 async function execute(action,success){
  setBusy(true);setError('');
  try {
    const {error:dbError,data:changed}=await action();
    if(dbError)throw dbError;
    if(Array.isArray(changed)&&changed.length===0)throw new Error('Nenhum registro foi alterado. Atualize a página e tente novamente.');
    await onRefresh();
    if(success)onNotify(success);
    return true;
  }catch(e){setError(e?.message||'Não foi possível salvar.');return false;}
  finally{setBusy(false);}
 }
 async function submitForm(e){
  e.preventDefault();if(!canEdit||!event||busy)return;
  if(modal.type==='task')return submitTask();
  if(modal.type==='bulkShopping'||modal.type==='bulkRequirement')return submitBulk();
  const name=(form.name||'').trim(),quantity=Number(String(form.quantity).replace(',','.'));
  if(!name||!Number.isFinite(quantity)||quantity<=0){setError('Preencha o nome e uma quantidade válida.');return;}
  const isMenu=modal.type==='menu';
  const isRequirement=modal.type==='requirement';
  const table=isMenu?'menu_items':isRequirement?'event_requirements':'shopping_items';
  let payload;
  if(isMenu)payload={name,quantity,unit:form.unit||'un',course:form.course||'other',notes:form.notes?.trim()||null};
  else if(isRequirement)payload={name,quantity,unit:form.unit||'un',inventory_item_id:form.inventory_item_id||null,assigned_to:form.assigned_to||null,notes:form.notes?.trim()||null};
  else{
   const price=form.estimated_unit_price===''?null:Number(String(form.estimated_unit_price).replace(',','.'));
   if(price!==null&&(!Number.isFinite(price)||price<0)){setError('Informe um preço válido.');return;}
   payload={name,quantity,unit:form.unit||'un',assigned_to:form.assigned_to||null,status:form.status||'pending',estimated_unit_price:price,notes:form.notes?.trim()||null};
  }
  const id=modal.id;
  const ok=await execute(()=>id?
    supabase.from(table).update(payload).eq('id',id).eq('event_id',event.id).eq('workspace_id',workspaceId).select('id'):
    supabase.from(table).insert({...payload,workspace_id:workspaceId,event_id:event.id}).select('id'),
    isMenu?'Cardápio atualizado.':isRequirement?'Item necessário salvo.':'Compra salva.');
  if(ok)setModal(null);
 }
 async function submitBulk(){
  if(!canEdit||busy||!event)return;
  try{
   const parsed=parseBulkInput(form.lines);
   if(!parsed.length){setError('Cole pelo menos um item, um por linha.');return;}
   if(parsed.length>80){setError('Adicione no máximo 80 itens por vez.');return;}
   const isPurchase=modal.type==='bulkShopping';
   const table=isPurchase?'shopping_items':'event_requirements';
   const current=isPurchase?shoppingList:needed;
   const existing=new Set(current.map(r=>r.name.trim().toLocaleLowerCase('pt-BR')+'|'+r.unit));
   const rows=[];
   for(const item of parsed){
    const key=item.name.toLocaleLowerCase('pt-BR')+'|'+item.unit;
    if(existing.has(key))continue;
    existing.add(key);
    rows.push({...item,workspace_id:workspaceId,event_id:event.id,assigned_to:form.assigned_to||null});
   }
   if(!rows.length){setError('Todos esses itens já estão cadastrados nesta lista.');return;}
   const skipped=parsed.length-rows.length;
   const ok=await execute(()=>supabase.from(table).insert(rows).select('id'),
     rows.length+' itens adicionados '+(isPurchase?'às compras':'aos itens necessários')+(skipped?' · '+skipped+' duplicado(s) ignorado(s)':'')+'.');
   if(ok)setModal(null);
  }catch(e){setError(e?.message||'Não foi possível interpretar a lista.');}
 }
 async function submitTask(){
  if(!canEdit||!event||busy)return;
  const title=(form.title||'').trim();
  if(!title||title.length>160){setError('Informe um compromisso com até 160 caracteres.');return;}
  const payload={
   title,event_phase:form.event_phase||'before',assigned_to:form.assigned_to||null,
   due_on:form.due_on||null,status:form.status||'pending',
   kind:'general',notes:form.notes?.trim()||null
  };
  const ok=await execute(()=>modal.id?
   supabase.from('tasks').update(payload).eq('workspace_id',workspaceId).eq('event_id',event.id).eq('id',modal.id).select('id'):
   supabase.from('tasks').insert({...payload,workspace_id:workspaceId,event_id:event.id}).select('id'),
   modal.id?'Compromisso atualizado.':'Compromisso adicionado à janta.');
  if(ok)setModal(null);
 }
 async function patchTask(row,values){
  if(!canEdit||busy)return;
  await execute(()=>supabase.from('tasks').update(values).eq('workspace_id',workspaceId)
   .eq('event_id',event.id).eq('id',row.id).select('id'),
   values.status==='done'?'Compromisso concluído.':'Compromisso atualizado.');
 }
 async function claimTask(row){
  if(!canEdit||busy||row.assigned_to||!userId)return;
  await execute(()=>supabase.from('tasks').update({assigned_to:userId,status:'in_progress'})
   .eq('workspace_id',workspaceId).eq('event_id',event.id).eq('id',row.id)
   .is('assigned_to',null).select('id'),'Você assumiu o compromisso.');
 }
 async function claimRequirement(row){
  if(!canEdit||busy||row.assigned_to||!userId)return;
  const ok=await execute(()=>supabase.from('event_requirements').update({assigned_to:userId})
    .eq('workspace_id',workspaceId).eq('event_id',event.id).eq('id',row.id)
    .is('assigned_to',null).select('id'),'Agora você é responsável por '+row.name+'.');
  return ok;
 }
 async function claimShopping(row){
  if(!canEdit||busy||row.assigned_to||!userId)return;
  await execute(()=>supabase.from('shopping_items').update({assigned_to:userId})
    .eq('workspace_id',workspaceId).eq('event_id',event.id).eq('id',row.id)
    .is('assigned_to',null).select('id'),'Você assumiu a compra de '+row.name+'.');
 }
 async function removeRow(table,row){
  if(!canDelete||busy||!window.confirm('Excluir este item do evento?'))return;
  await execute(()=>supabase.from(table).delete().eq('workspace_id',workspaceId).eq('event_id',event.id).eq('id',row.id).select('id'),'Item excluído.');
 }
 async function patchRequirement(row,values){
  if(!canEdit||busy)return;
  await execute(()=>supabase.from('event_requirements').update(values)
    .eq('workspace_id',workspaceId).eq('event_id',event.id).eq('id',row.id).select('id'),
    values.is_done===true?'Item necessário pronto.':'Item necessário atualizado.');
 }
 async function patchShopping(row,values){
  if(!canEdit||busy)return;
  await execute(()=>supabase.from('shopping_items').update(values)
    .eq('workspace_id',workspaceId).eq('event_id',event.id).eq('id',row.id).select('id'),
    values.status==='purchased'?'Compra marcada como realizada.':'Compra atualizada.');
 }
 async function saveNote(e){
   e.preventDefault();if(!canEdit||busy)return;
   const ok=await execute(()=>supabase.from('events').update({menu_notes:menuNote.trim()||null}).eq('id',event.id).eq('workspace_id',workspaceId),'Observações do cardápio salvas.');
   if(ok)setMenuNoteEdit(false);
 }
 const requirementRow=(r)=> {
  const match=stockById[r.inventory_item_id];
  const shortage=match&&match.unit===r.unit?Math.max(0,Number(r.quantity)-Number(match.quantity)):null;
  return <div className={'ev-need-row '+(r.is_done?'checked':'')} key={r.id}>
   <label className="ev-check" title="Marcar como pronto"><input type="checkbox" aria-label={'Disponível: '+r.name}
     checked={!!r.is_done} disabled={!canEdit||busy} onChange={()=>patchRequirement(r,{is_done:!r.is_done})}/><span><Check size={15}/></span></label>
   <div className="ev-need-main"><strong>{r.name}</strong><p>{num(r.quantity)} {r.unit}{r.notes?' · '+r.notes:''}</p>
    <small className={'ev-owner-chip '+(r.assigned_to?'taken':'unassigned')}><UserRound size={13}/>{r.assigned_to?'Responsável: '+memberName(r.assigned_to):'Aguardando responsável'}</small>
    {match&&<small className="ev-stock-info"><Package size={13}/> Estoque: {num(match.quantity)} {match.unit}{shortage!==null&&shortage>0?' · faltam '+num(shortage)+' '+r.unit:''}</small>}
   </div>
   <div className="ev-need-side">
    <span className={'ev-logistic-status '+(r.is_done?'ready':'pending')}>{r.is_done?'Pronto':'A providenciar'}</span>
    <div className="ev-owner-actions"><select aria-label={'Atribuir responsável para '+r.name} value={r.assigned_to||''} disabled={!canEdit||busy}
      onChange={e=>patchRequirement(r,{assigned_to:e.target.value||null})}>
      <option value="">Sem responsável</option>
      {members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m.user_id)}</option>)}
    </select>
    {canEdit&&!r.assigned_to&&<button className="ev-claim-btn" disabled={busy} onClick={()=>claimRequirement(r)}><UserRound size={14}/> Assumir</button>}</div>
    {canEdit&&<button className="ev-icon-btn" title="Editar item necessário" aria-label={'Editar '+r.name} onClick={()=>openForm('requirement',r)}><Pencil size={16}/></button>}
    {canDelete&&<button className="ev-icon-btn danger" title="Excluir item necessário" aria-label={'Excluir '+r.name} onClick={()=>removeRow('event_requirements',r)}><Trash2 size={16}/></button>}
   </div>
  </div>;
 };
 const shoppingRow=(r)=>{
  const isDone=r.status!=='pending';
  return <div id={'he-shopping-'+r.id} className={'ev-need-row ev-purchase-row '+(isDone?'checked':'')+(focusShoppingId===r.id?' he-notice-focused':'')} key={r.id}>
   <label className="ev-check" title="Marcar como comprado"><input type="checkbox" aria-label={'Comprado: '+r.name}
    checked={isDone} disabled={!canEdit||busy} onChange={()=>patchShopping(r,{status:isDone?'pending':'purchased'})}/><span><Check size={15}/></span></label>
   <div className="ev-need-main"><strong>{r.name}</strong><p>{num(r.quantity)} {r.unit}{r.notes?' · '+r.notes:''}{r.estimated_unit_price!==null&&r.estimated_unit_price!==undefined?' · previsão '+(Number(r.estimated_unit_price)*Number(r.quantity)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):''}</p>
    <small className={'ev-owner-chip '+(r.assigned_to?'taken':'unassigned')}><UserRound size={13}/>{r.assigned_to?'Compra: '+memberName(r.assigned_to):'Compra sem responsável'}</small>
   </div>
   <div className="ev-need-side">
    <div className="ev-owner-actions"><select aria-label={'Responsável pela compra de '+r.name} value={r.assigned_to||''} disabled={!canEdit||busy} onChange={e=>patchShopping(r,{assigned_to:e.target.value||null})}>
     <option value="">Sem responsável</option>
     {members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m.user_id)}</option>)}
    </select>
    {canEdit&&!r.assigned_to&&<button className="ev-claim-btn" disabled={busy} onClick={()=>claimShopping(r)}><UserRound size={14}/> Assumir</button>}</div>
    <select className={'ev-status-select status-'+r.status} aria-label={'Situação da compra de '+r.name} value={r.status} disabled={!canEdit||busy} onChange={e=>patchShopping(r,{status:e.target.value})}>
     {Object.entries(purchaseStatuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}
    </select>
    {canEdit&&<button className="ev-icon-btn" title="Editar compra" aria-label={'Editar compra '+r.name} onClick={()=>openForm('shopping',r)}><Pencil size={16}/></button>}
    {canDelete&&<button className="ev-icon-btn danger" title="Excluir compra" aria-label={'Excluir compra '+r.name} onClick={()=>removeRow('shopping_items',r)}><Trash2 size={16}/></button>}
   </div>
  </div>;
 };
 const empty=<p className="ev-muted ev-empty">Nenhum item cadastrado ainda.</p>;

 if(!event)return <div className="ev-hub">
   <div className="ev-list-top"><div><h2>Próximos encontros</h2><p>Entre em um evento para planejar o cardápio, as compras e os preparativos.</p></div>{canEdit&&<button className="ev-primary" onClick={onAddEvent}><Plus size={17}/> Novo evento</button>}</div>
   <div className="ev-search"><Search size={17}/><input aria-label="Buscar eventos" placeholder="Pesquisar eventos..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
   <div className="ev-event-grid">
    {ordered.filter(r=>[r.title,r.event_type,r.status].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))).map(r=>
     <article key={r.id} className="ev-event-card">
      <div className="ev-event-card-top"><span className="ev-date"><CalendarDays size={15}/>{fmtDate(r.event_date)}</span><span className={'ev-pill '+r.status}>{statusLabels[r.status]||r.status}</span></div>
      <h3>{r.title}</h3><p><Users size={15}/> {r.guests||0} convidados {r.start_time?' · '+String(r.start_time).slice(0,5):''}</p>
      <div className="ev-event-card-actions"><button className="ev-primary" onClick={()=>openEvent(r)}>Abrir evento <ArrowRight size={17}/></button>{canEdit&&<button className="ev-icon-btn" title="Editar evento" onClick={()=>onEditEvent(r)}><Pencil size={16}/></button>}{canDelete&&<button className="ev-icon-btn danger" title="Excluir evento" onClick={()=>onDeleteEvent(r)}><Trash2 size={16}/></button>}</div>
     </article>)}
    {!events.length&&<div className="ev-panel ev-no-event"><CalendarDays size={32}/><h3>Seu primeiro evento começa aqui</h3><p>Crie uma janta, festa ou encontro para organizar tudo em um só lugar.</p>{canEdit&&<button className="ev-primary" onClick={onAddEvent}><Plus size={16}/> Criar evento</button>}</div>}
   </div>
 </div>;

 return <div className="ev-hub">
   <button className="ev-back" onClick={back}><ArrowLeft size={17}/> Todos os eventos</button>
   <div className="ev-hero">
     <div><span className={'ev-pill '+event.status}>{statusLabels[event.status]||event.status}</span><h2>{event.title}</h2><p>{event.event_type||'Encontro'} · <CalendarDays size={15}/> {fmtDate(event.event_date)} {event.start_time?' · '+String(event.start_time).slice(0,5):''} · <Users size={15}/> {event.guests||0} convidados</p></div>
     {canEdit&&<button className="ev-hero-edit" onClick={()=>onEditEvent(event)}><Pencil size={16}/> Editar evento</button>}
   </div>
   <div className="ev-overview-tiles" aria-label="Acessar as áreas do evento">
      <button type="button" className={tab==='menu'?'active':''} aria-label="Abrir cardápio do evento" onClick={()=>{setTab('menu');setError('')}}><UtensilsCrossed size={20}/><span>Cardápio</span><strong>{dishes.length} {dishes.length===1?'item':'itens'}</strong><ChevronRight className="ev-tile-arrow" size={17}/></button>
      <button type="button" className={tab==='items'?'active':''} aria-label="Abrir itens necessários do evento" onClick={()=>{setTab('items');setError('')}}><PackageCheck size={20}/><span>Itens necessários</span><strong>{needed.filter(r=>r.is_done).length}/{needed.length} prontos</strong><ChevronRight className="ev-tile-arrow" size={17}/></button>
      <button type="button" className={tab==='shopping'?'active':''} aria-label="Abrir compras do evento" onClick={()=>{setTab('shopping');setError('')}}><ShoppingBasket size={20}/><span>Compras</span><strong>{buying.length} pendentes</strong><ChevronRight className="ev-tile-arrow" size={17}/></button>
      <button type="button" className={tab==='commitments'?'active':''} aria-label="Abrir compromissos do evento" onClick={()=>{setTab('commitments');setError('')}}><ClipboardCheck size={20}/><span>Compromissos</span><strong>{finishedTasks}/{eventTasks.length} concluídos</strong><ChevronRight className="ev-tile-arrow" size={17}/></button>
   </div>
   {tab==='overview'
    ?<div className="ev-overview-heading"><h3>Visão geral</h3><p>Um resumo do planejamento. Use os cartões acima para abrir cada área.</p></div>
    :<div className="ev-detail-heading"><button type="button" className="ev-back-to-overview" onClick={()=>{setTab('overview');setError('')}}><ArrowLeft size={17}/> Visão geral</button><span className="ev-detail-separator">/</span><strong>{eventSectionLabels[tab]}</strong></div>}
   {tab==='overview'&&<div className="ev-columns ev-summary-grid">
     <section className="ev-panel ev-summary-panel">
      <div className="ev-panel-title"><div><h3><UtensilsCrossed size={19}/> Cardápio</h3><p>Pratos, bebidas e acompanhamentos previstos para o encontro.</p></div><span className="ev-summary-count">{dishes.length} {dishes.length===1?'item':'itens'}</span></div>
      {dishes.slice(0,3).map(d=><div className="ev-summary-row" key={d.id}><strong>{d.name}</strong><span>{courses[d.course]||'Outro'}</span></div>)}
      {!dishes.length&&<p className="ev-muted ev-empty">Nenhum prato ou bebida cadastrado.</p>}
      {dishes.length>3&&<p className="ev-summary-more">E mais {dishes.length-3} {dishes.length-3===1?'item':'itens'}.</p>}
     </section>
     <section className="ev-panel ev-summary-panel">
      <div className="ev-panel-title"><div><h3><PackageCheck size={19}/> Itens necessários</h3><p>Utensílios e materiais que precisam estar disponíveis.</p></div><span className="ev-summary-count">{needed.filter(r=>r.is_done).length}/{needed.length} prontos</span></div>
      {needed.filter(r=>!r.is_done).slice(0,3).map(r=><div className="ev-summary-row" key={r.id}><strong>{r.name}</strong><span>{num(r.quantity)} {r.unit} · {memberName(r.assigned_to)}</span></div>)}
      {needed.length>0&&needed.every(r=>r.is_done)&&<p className="ev-muted ev-empty">Todos os materiais estão prontos.</p>}
      {!needed.length&&<p className="ev-muted ev-empty">Nenhum material necessário cadastrado.</p>}
      {needed.filter(r=>!r.is_done).length>3&&<p className="ev-summary-more">E mais {needed.filter(r=>!r.is_done).length-3} a providenciar.</p>}
     </section>
     <section className="ev-panel ev-summary-panel">
      <div className="ev-panel-title"><div><h3><ShoppingBasket size={19}/> Compras</h3><p>Produtos que precisam ser adquiridos para o encontro.</p></div><span className="ev-summary-count">{purchased.length}/{shoppingList.length} comprados</span></div>
      {buying.slice(0,3).map(r=><div className="ev-summary-row" key={r.id}><strong>{r.name}</strong><span>{num(r.quantity)} {r.unit} · {memberName(r.assigned_to)}</span></div>)}
      {shoppingList.length>0&&!buying.length&&<p className="ev-muted ev-empty">Todas as compras foram concluídas.</p>}
      {!shoppingList.length&&<p className="ev-muted ev-empty">Nenhuma compra cadastrada.</p>}
      {buying.length>3&&<p className="ev-summary-more">E mais {buying.length-3} compras pendentes.</p>}
     </section>
     <section className="ev-panel ev-summary-panel">
      <div className="ev-panel-title"><div><h3><ClipboardCheck size={19}/> Compromissos</h3><p>Preparação, organização e limpeza da janta.</p></div><span className="ev-summary-count">{finishedTasks}/{eventTasks.length} concluídos</span></div>
      {eventTasks.filter(t=>t.status!=='done').slice(0,3).map(t=><div className="ev-summary-row" key={t.id}><strong>{t.title}</strong><span>{memberName(t.assigned_to)} · {eventPhaseLabels[t.event_phase||'before']}</span></div>)}
      {eventTasks.length>0&&finishedTasks===eventTasks.length&&<p className="ev-muted ev-empty">Todos os compromissos concluídos.</p>}
      {!eventTasks.length&&<p className="ev-muted ev-empty">Nenhum compromisso cadastrado.</p>}
      {eventTasks.length-finishedTasks>3&&<p className="ev-summary-more">E mais {eventTasks.length-finishedTasks-3} compromissos em aberto.</p>}
     </section>
     <section className="ev-panel ev-span ev-summary-notes"><div className="ev-panel-title"><div><h3><Info size={19}/> Informações e observações</h3><p>Detalhes gerais da preparação.</p></div></div><p className="ev-notes">{event.notes||'Sem observações adicionais sobre o evento.'}</p></section>
   </div>}
   {tab==='overview'&&<section className={'he-closeout-entry '+(eventCloseout?'is-closed':'')}>
      <div className="he-closeout-entry-icon">{eventCloseout?<CheckCircle2 size={24}/>:<ClipboardCheck size={24}/>}</div>
      <div className="he-closeout-entry-copy">
       <strong>{eventCloseout?'Janta encerrada e arquivada':'Fechamento da janta'}</strong>
       <p>{eventCloseout?'Consulte consumo, sobras, avarias e pendências registradas no encerramento.':event.status==='completed'?'O evento já está concluído, mas ainda não possui relatório de fechamento.':'Registre as sobras, o consumo e os materiais danificados ao finalizar o encontro.'}</p>
      </div>
      <button type="button" onClick={()=>{setTab('closeout');setError('')}}>{eventCloseout?'Ver relatório':canEdit?'Iniciar fechamento':'Ver fechamento'} <ArrowRight size={16}/></button>
    </section>}
   {tab==='closeout'&&<EventCloseout event={event} closeout={eventCloseout}
      consumption={closeoutConsumption} damages={closeoutDamages} stock={stock} assets={assets}
      tasks={tasks} shoppingItems={shoppingItems} requirements={requirements} members={members}
      supabase={supabase} canEdit={canEdit} onRefresh={onRefresh} onNotify={onNotify}/>}
   {tab==='menu'&&<section className="ev-panel"><div className="ev-panel-title"><div><h3><UtensilsCrossed size={20}/> Cardápio da {event.title}</h3><p>Liste tudo o que será servido.</p></div>{canEdit&&<button className="ev-primary" onClick={()=>openForm('menu')}><Plus size={16}/> Adicionar</button>}</div>
     <div className="ev-menu-grid">{dishes.map(d=><div key={d.id} className="ev-menu-item"><span className="ev-course">{courses[d.course]||'Outro'}</span><strong>{d.name}</strong><p>{num(d.quantity)} {d.unit}{d.notes?' · '+d.notes:''}</p><div className="ev-small-actions">{canEdit&&<button onClick={()=>openForm('menu',d)}><Pencil size={15}/> Editar</button>}{canDelete&&<button onClick={()=>removeRow('menu_items',d)}><Trash2 size={15}/> Excluir</button>}</div></div>)}</div>
     {!dishes.length&&empty}
     <div className="ev-menu-notes"><h4>Observações do cardápio</h4>{menuNoteEdit?<form onSubmit={saveNote}><textarea rows={3} value={menuNote} onChange={e=>setMenuNote(e.target.value)}/><div className="ev-actions"><button type="button" className="ev-secondary" onClick={()=>setMenuNoteEdit(false)}>Cancelar</button><button disabled={busy} className="ev-primary">Salvar observações</button></div></form>:<div><p>{event.menu_notes||'Nenhuma observação informada.'}</p>{canEdit&&<button className="ev-link" onClick={()=>{setMenuNote(event.menu_notes||'');setMenuNoteEdit(true)}}><Pencil size={15}/> Editar observações</button>}</div>}</div>
   </section>}

   {tab==='items'&&<section className="ev-panel ev-requirements-panel"><div className="ev-panel-title"><div><h3><PackageCheck size={19}/> Itens necessários · {event.title}</h3>
     <p>Utensílios, equipamentos e materiais que precisam estar disponíveis no dia. Ex.: garfos, liquidificador, sacos de lixo e guardanapos de pano.</p></div>
     {canEdit&&<div className="ev-header-actions"><button className="ev-secondary" onClick={()=>openForm('bulkRequirement')}><Copy size={16}/> Adicionar vários</button><button className="ev-primary" onClick={()=>openForm('requirement')}><Plus size={16}/> Item necessário</button></div>}</div>
     {needed.map(requirementRow)}
     {!needed.length&&<div className="ev-shopping-empty"><PackageCheck size={27}/><strong>O que precisa estar disponível?</strong><p>Cadastre materiais e utensílios do encontro: garfos, copos, liquidificador, toalhas e sacos de lixo.</p>{canEdit&&<button className="ev-primary" onClick={()=>openForm('requirement')}><Plus size={16}/> Adicionar item necessário</button>}</div>}
     <p className="ev-helper">Esta lista é um checklist de materiais, independente da lista de compras. Você pode atribuir quem vai levar ou organizar cada item.</p>
   </section>}
   {tab==='shopping'&&<section className="ev-panel ev-shopping-panel">
      <div className="ev-panel-title"><div><h3><ShoppingBasket size={20}/> Lista de compras · {event.title}</h3>
        <p>O que realmente precisa ser comprado para o evento: carnes, cerveja, carvão, ingredientes e outros produtos.</p></div>
        {canEdit&&<div className="ev-header-actions"><button className="ev-secondary" onClick={()=>openForm('bulkShopping')}><Copy size={16}/> Colar lista</button><button className="ev-primary" onClick={()=>openForm('shopping')}><Plus size={16}/> Compra</button></div>}
      </div>
      <div className="ev-shopping-summary"><div className="ev-shopping-summary-title"><strong>{purchased.length} de {shoppingList.length} comprados</strong><span>{shoppingProgress}% concluído</span></div>
       <div className="ev-progress"><span style={{width:shoppingProgress+'%'}}/></div>
       <div className="ev-shopping-info"><span>{buying.length} itens para comprar</span><span>{buying.filter(r=>!r.assigned_to).length} sem responsável</span></div>
      </div>
      <h4 className="ev-group-title">Pendentes de compra ({buying.length})</h4>
      {buying.map(shoppingRow)}
      {!buying.length&&shoppingList.length>0&&<div className="ev-complete"><CheckCircle2 size={27}/><strong>Lista concluída!</strong><p>Todos os produtos desta lista já foram comprados.</p></div>}
      {!shoppingList.length&&<div className="ev-shopping-empty"><ShoppingBasket size={27}/><strong>Crie a lista de compras</strong><p>Você pode adicionar um produto ou colar todos de uma só vez, com quantidades e responsáveis.</p>{canEdit&&<button className="ev-primary" onClick={()=>openForm('bulkShopping')}><Copy size={16}/> Colar lista</button>}</div>}
      {purchased.length>0&&<div className="ev-shopping-purchased"><button className="ev-purchased-toggle" onClick={()=>setShoppingShowDone(v=>!v)} aria-expanded={shoppingShowDone}>
       <CheckCheck size={17}/> Comprados ({purchased.length}) <ChevronRight size={16} style={{transform:shoppingShowDone?'rotate(90deg)':undefined}}/>
      </button>{shoppingShowDone&&purchased.map(shoppingRow)}</div>}
      <p className="ev-helper">Compras e itens necessários são listas independentes. Marcar uma compra como realizada não altera o estoque nem o checklist de materiais.</p>
   </section>}
   {tab==='commitments'&&<section className="ev-panel ev-commitments-panel">
    <div className="ev-panel-title"><div><h3><ClipboardList size={20}/> Compromissos · {event.title}</h3>
      <p>Distribua os trabalhos da janta. Cada pessoa sabe o que precisa fazer antes, durante e depois do encontro.</p></div>
      {canEdit&&<button className="ev-primary" onClick={()=>openTaskForm()}><Plus size={16}/> Novo compromisso</button>}
    </div>
    <div className="ev-commitment-progress"><div className="ev-shopping-summary-title">
      <strong>{finishedTasks} de {eventTasks.length} concluídos</strong><span>{tasksProgress}%</span>
    </div><div className="ev-progress"><span style={{width:tasksProgress+'%'}}/></div></div>
    {['before','during','after'].map(phase=>{
      const phaseTasks=eventTasks.filter(t=>(t.event_phase||'before')===phase);
      return <div key={phase} className="ev-commitment-group">
       <div className="ev-commitment-group-title"><h4>{eventPhaseLabels[phase]}</h4><span>{phaseTasks.filter(t=>t.status==='done').length}/{phaseTasks.length} feitos</span></div>
       {phaseTasks.map(t=><div key={t.id} className={'ev-need-row ev-task-row '+(t.status==='done'?'checked':'')}>
        <label className="ev-check" title="Marcar compromisso como concluído"><input type="checkbox" checked={t.status==='done'} disabled={!canEdit||busy}
         aria-label={'Concluir: '+t.title} onChange={()=>patchTask(t,{status:t.status==='done'?'pending':'done'})}/><span><Check size={15}/></span></label>
        <div className="ev-need-main"><strong>{t.title}</strong>
         <p>{t.notes||'Compromisso da janta'}{t.due_on?' · Prazo: '+fmtDate(t.due_on):''}</p>
         <small className={'ev-owner-chip '+(t.assigned_to?'taken':'unassigned')}><UserRound size={13}/>{t.assigned_to?'Responsável: '+memberName(t.assigned_to):'Sem responsável'}</small>
        </div>
        <div className="ev-need-side">
         <select className={'ev-status-select status-'+t.status} aria-label={'Situação de '+t.title} disabled={!canEdit||busy} value={t.status}
           onChange={e=>patchTask(t,{status:e.target.value})}>{Object.entries(taskStatusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
         <div className="ev-owner-actions">
          <select aria-label={'Responsável por '+t.title} disabled={!canEdit||busy} value={t.assigned_to||''}
           onChange={e=>patchTask(t,{assigned_to:e.target.value||null})}>
           <option value="">Sem responsável</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m.user_id)}</option>)}
          </select>
          {canEdit&&!t.assigned_to&&<button className="ev-claim-btn" disabled={busy} onClick={()=>claimTask(t)}><UserRound size={14}/> Assumir</button>}
         </div>
         {canEdit&&<button className="ev-icon-btn" aria-label={'Editar '+t.title} title="Editar compromisso" onClick={()=>openTaskForm(t)}><Pencil size={16}/></button>}
         {canDelete&&<button className="ev-icon-btn danger" aria-label={'Excluir '+t.title} title="Excluir compromisso" onClick={()=>removeRow('tasks',t)}><Trash2 size={16}/></button>}
        </div>
       </div>)}
       {!phaseTasks.length&&<p className="ev-commitment-group-empty">Nenhum compromisso nesta etapa.</p>}
      </div>;
    })}
    {!eventTasks.length&&canEdit&&<div className="ev-task-suggestions"><strong>Sugestões para começar</strong><p>Toque em um exemplo para criar e atribuir o compromisso.</p>
      <div>{['Limpar o balcão','Retirar o lixo','Organizar as mesas','Varrer o pátio','Lavar a louça'].map(title=><button type="button" key={title} onClick={()=>openTaskForm(null,title)}><Plus size={14}/>{title}</button>)}</div>
    </div>}
    <p className="ev-helper">Os compromissos desta janta também aparecem em Compromissos, no menu principal, com o evento identificado.</p>
   </section>}
   {error&&!modal&&<div role="alert" className="ev-error"><AlertCircle size={17}/>{error}</div>}
   {modal&&<div className="ev-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}>
    <div className="ev-modal" role="dialog" aria-modal="true" aria-labelledby="ev-modal-label">
     <div className="ev-modal-head"><div><span>{modal.type==='task'?'Compromissos da janta':modal.type==='menu'?'Cardápio':modal.type==='shopping'||modal.type==='bulkShopping'?'Compras':'Materiais e utensílios'}</span>
      <h3 id="ev-modal-label">{modal.type==='task'?(modal.id?'Editar compromisso':'Novo compromisso'):modal.type==='bulkShopping'?'Colar lista de compras':modal.type==='bulkRequirement'?'Adicionar vários materiais':modal.id?'Editar item':'Adicionar item'}</h3></div>
      <button type="button" title="Fechar" aria-label="Fechar" onClick={()=>setModal(null)}><X size={20}/></button>
     </div>
     {modal.type==='task'?<form onSubmit={submitForm}>
      <label>O que precisa ser feito? *<input autoFocus required maxLength={160} value={form.title||''}
       placeholder="Ex.: Limpar o balcão, retirar o lixo" onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <div className="ev-form-two">
       <label>Quando?<select value={form.event_phase||'before'} onChange={e=>setForm({...form,event_phase:e.target.value})}>
        {Object.entries(eventPhaseLabels).map(([k,v])=><option value={k} key={k}>{v}</option>)}
       </select></label>
       <label>Responsável<select value={form.assigned_to||''} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
        <option value="">Sem responsável</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m.user_id)}</option>)}
       </select></label>
      </div>
      <div className="ev-form-two">
       <label>Prazo<input type="date" value={form.due_on||''} onChange={e=>setForm({...form,due_on:e.target.value})}/></label>
       <label>Situação<select value={form.status||'pending'} onChange={e=>setForm({...form,status:e.target.value})}>
        {Object.entries(taskStatusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
       </select></label>
      </div>
      <label>Observações<textarea rows={3} value={form.notes||''} placeholder="Ex.: Levar os sacos de lixo até a lixeira externa"
       onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      {error&&<div role="alert" className="ev-error"><AlertCircle size={16}/>{error}</div>}
      <div className="ev-actions"><button type="button" className="ev-secondary" onClick={()=>setModal(null)}>Cancelar</button>
       <button className="ev-primary" disabled={busy||!form.title?.trim()}>{busy?'Salvando…':'Salvar compromisso'}</button></div>
     </form>:(modal.type==='bulkShopping'||modal.type==='bulkRequirement'?<form onSubmit={submitForm}>
      <p className="ev-bulk-hint">{modal.type==='bulkShopping'?'Cole os produtos que serão comprados. Cada linha vira uma compra independente.':'Cole os utensílios e materiais que devem estar disponíveis para o evento.'}</p>
      <label>Itens (um por linha)
       <textarea required autoFocus className="ev-bulk-lines" rows={9} value={form.lines||''}
        onChange={e=>setForm({...form,lines:e.target.value})}
        placeholder={modal.type==='bulkShopping'?'5 kg de carne\n3 caixas de cerveja\n2 pacotes de carvão':'20 garfos\n1 liquidificador\n5 sacos de lixo\n15 guardanapos de pano'}/>
      </label>
      <label>Responsável (pode definir depois)<select value={form.assigned_to||''} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
       <option value="">Sem responsável</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m.user_id)}</option>)}
      </select></label>
      <small className="ev-bulk-tip">Exemplos: “5 kg de carne”, “3 caixas de cerveja” ou apenas “carvão” (1 unidade). Itens repetidos nesta mesma lista serão ignorados.</small>
      {error&&<div role="alert" className="ev-error"><AlertCircle size={16}/>{error}</div>}
      <div className="ev-actions"><button type="button" className="ev-secondary" onClick={()=>setModal(null)}>Cancelar</button>
       <button className="ev-primary" disabled={busy||!form.lines?.trim()}>{busy?'Adicionando…':'Adicionar lista inteira'}</button></div>
     </form>:<form onSubmit={submitForm}>
      {modal.type==='requirement'&&<label>Localizar no estoque (se houver)<select value={form.inventory_item_id||''} onChange={e=>selectStock(e.target.value)}>
       <option value="">Não vincular ao estoque</option>
       {stock.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(item=><option key={item.id} value={item.id}>{item.name} — {num(item.quantity)} {item.unit}</option>)}
      </select></label>}
      <label>Nome *<input required maxLength={180} value={form.name||''}
       placeholder={modal.type==='menu'?'Ex.: Churrasco, arroz, salada':modal.type==='requirement'?'Ex.: Garfos, liquidificador, guardanapos':'Ex.: Carne, cerveja, carvão'}
       onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <div className="ev-form-two">
       <label>Quantidade *<input required type="number" step="any" min="0.001" value={form.quantity??1} onChange={e=>setForm({...form,quantity:e.target.value})}/></label>
       <label>Unidade<select value={form.unit||'un'} onChange={e=>setForm({...form,unit:e.target.value})}>
        {['un','kg','g','L','ml','pacote','caixa','saco','garrafa','fardo','lata','porção'].map(unit=><option key={unit} value={unit}>{unit}</option>)}</select></label>
      </div>
      {modal.type==='menu'?<label>Tipo no cardápio<select value={form.course||'main'} onChange={e=>setForm({...form,course:e.target.value})}>
       {Object.entries(courses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>:<>
       {modal.type==='shopping'&&<div className="ev-form-two">
        <label>Situação<select value={form.status||'pending'} onChange={e=>setForm({...form,status:e.target.value})}>
         {Object.entries(purchaseStatuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select></label>
        <label>Preço unitário previsto (R$)<input type="number" step="0.01" min="0" value={form.estimated_unit_price??''} placeholder="Sem valor" onChange={e=>setForm({...form,estimated_unit_price:e.target.value})}/></label>
       </div>}
       <label>{modal.type==='shopping'?'Quem vai comprar?':'Quem vai levar ou organizar?'}<select value={form.assigned_to||''} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
        <option value="">Sem responsável</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m.user_id)}</option>)}
       </select></label>
      </>}
      <label>Observações<textarea rows={2} value={form.notes||''} placeholder="Detalhes ou instruções..." onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      {error&&<div role="alert" className="ev-error"><AlertCircle size={16}/>{error}</div>}
      <div className="ev-actions"><button type="button" className="ev-secondary" onClick={()=>setModal(null)}>Cancelar</button>
       <button className="ev-primary" disabled={busy}>{busy?'Salvando…':'Salvar item'}</button></div>
     </form>)}
    </div>
   </div>}
 </div>;
}
