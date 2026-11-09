'use client';
import {useEffect,useMemo,useState} from 'react';
import {
 ArrowLeft,ArrowRight,CalendarDays,Users,Clock3,UtensilsCrossed,ClipboardList,
 ShoppingBasket,PackageCheck,Plus,Check,CheckCircle2,Trash2,Pencil,X,
 Search,ChevronRight,AlertCircle,Package,ClipboardCheck,Info,UserRound,Copy,CheckCheck
} from 'lucide-react';

const courses={main:'Prato principal',side:'Acompanhamento',drink:'Bebida',dessert:'Sobremesa',other:'Outro'};
const purchaseStatuses={pending:'Pendente',purchased:'Comprado',received:'Recebido'};
const statusLabels={planning:'Planejado',confirmed:'Confirmado',active:'Em andamento',completed:'Concluído',cancelled:'Cancelado'};
const fmtDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const num=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
const sections=[['overview','Visão geral'],['menu','Cardápio'],['items','Itens necessários'],['shopping','Compras'],['checklist','Checklist']];
const emptyItem={name:'',quantity:'1',unit:'un',course:'main',notes:''};
const emptyRequirement={name:'',quantity:'1',unit:'un',inventory_item_id:'',assigned_to:'',notes:''};
const emptyPurchase={name:'',quantity:'1',unit:'un',assigned_to:'',notes:'',status:'pending',estimated_unit_price:''};
const bulkUnitNames={un:'un',unidade:'un',unidades:'un',x:'un',kg:'kg',g:'g',l:'L',litro:'L',litros:'L',ml:'ml',pacote:'pacote',pacotes:'pacote',caixa:'caixa',caixas:'caixa',saco:'saco',sacos:'saco',garrafa:'garrafa',garrafas:'garrafa',fardo:'fardo',fardos:'fardo',lata:'lata',latas:'lata'};
function parseBulkInput(raw){
 return String(raw||'').split(/\r?\n/).map(value=>value.trim().replace(/^[•*\-]\s*/, '')).filter(Boolean).map(value=>{
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
 events=[], menuItems=[], requirements=[], shoppingItems=[], tasks=[], stock=[], members=[], userId, workspaceId, defaultEventId=null,
 supabase, canEdit=false, canDelete=false, onAddEvent, onEditEvent, onDeleteEvent,
 onRefresh, onNotify
}){
 const [openedId,setOpenedId]=useState(null);
 const [tab,setTab]=useState('overview');
 const [search,setSearch]=useState('');
 const [modal,setModal]=useState(null);
 const [form,setForm]=useState({});
 const [busy,setBusy]=useState(false);
 const [menuNoteEdit,setMenuNoteEdit]=useState(false);
 const [menuNote,setMenuNote]=useState('');
 const [taskTitle,setTaskTitle]=useState('');
 const [taskAssignedTo,setTaskAssignedTo]=useState('');
 const [shoppingShowDone,setShoppingShowDone]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{if(defaultEventId&&events.some(e=>e.id===defaultEventId)){setOpenedId(defaultEventId);setTab('overview');}},[defaultEventId,events]);
 const event=events.find(e=>e.id===openedId);
 const ordered=useMemo(()=>events.slice().sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date))),[events]);
 const dishes=menuItems.filter(m=>m.event_id===event?.id).slice().sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 const needed=requirements.filter(r=>r.event_id===event?.id).slice().sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 const eventTasks=tasks.filter(t=>t.event_id===event?.id);
 const memberName=id=>id?((id===userId)?'Você':(members.find(m=>m.user_id===id)?.display_name||'Integrante')):'Sem responsável';
 const shoppingList=shoppingItems.filter(r=>r.event_id===event?.id).slice().sort((a,b)=>Number(a.status!=='pending')-Number(b.status!=='pending')||String(a.created_at).localeCompare(String(b.created_at)));
 const buying=shoppingList.filter(r=>r.status==='pending');
 const purchased=shoppingList.filter(r=>r.status!=='pending');
 const shoppingProgress=shoppingList.length?Math.round(100*purchased.length/shoppingList.length):0;
 const resolved=needed.filter(r=>r.is_done).length;
 const allChecks=needed.length+shoppingList.length+eventTasks.length;
 const doneChecks=resolved+purchased.length+eventTasks.filter(t=>t.status==='done').length;
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
 async function toggleTask(task){
   if(!canEdit||busy)return;
   await execute(()=>supabase.from('tasks').update({status:task.status==='done'?'pending':'done'}).eq('workspace_id',workspaceId).eq('event_id',event.id).eq('id',task.id),'Tarefa atualizada.');
 }
 async function addTask(e){
   e.preventDefault();if(!canEdit||!taskTitle.trim()||busy)return;
   const ok=await execute(()=>supabase.from('tasks').insert({workspace_id:workspaceId,event_id:event.id,title:taskTitle.trim(),due_on:event.event_date,status:'pending',kind:'general',assigned_to:taskAssignedTo||null}),'Tarefa adicionada ao evento.');
   if(ok){setTaskTitle('');setTaskAssignedTo('');}
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
  return <div className={'ev-need-row ev-purchase-row '+(isDone?'checked':'')} key={r.id}>
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
   <div className="ev-overview-tiles">
      <button onClick={()=>setTab('menu')}><UtensilsCrossed size={20}/><span>Cardápio</span><strong>{dishes.length} itens</strong></button>
      <button onClick={()=>setTab('items')}><PackageCheck size={20}/><span>Itens necessários</span><strong>{needed.length}</strong></button>
      <button onClick={()=>setTab('shopping')}><ShoppingBasket size={20}/><span>A comprar</span><strong>{buying.length}</strong></button>
      <button onClick={()=>setTab('checklist')}><ClipboardCheck size={20}/><span>Resolvidos</span><strong>{doneChecks}/{allChecks}</strong></button>
   </div>
   <div className="ev-tabs" role="tablist" aria-label="Planejamento do evento">{sections.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} className={tab===key?'active':''} onClick={()=>{setTab(key);setError('')}}>{label}</button>)}</div>
   {tab==='overview'&&<div className="ev-columns">
      <section className="ev-panel"><div className="ev-panel-title"><div><h3><UtensilsCrossed size={19}/> O que será servido</h3><p>Organize pratos, bebidas e acompanhamentos.</p></div><button className="ev-link" onClick={()=>setTab('menu')}>Ver cardápio <ChevronRight size={16}/></button></div>
       {dishes.slice(0,5).map(d=><div className="ev-summary-row" key={d.id}><strong>{d.name}</strong><span>{courses[d.course]||'Outro'}</span></div>)}{!dishes.length&&empty}
       {canEdit&&<button className="ev-inline-add" onClick={()=>openForm('menu')}><Plus size={16}/> Adicionar prato ou bebida</button>}
      </section>
      <section className="ev-panel"><div className="ev-panel-title"><div><h3><ShoppingBasket size={19}/> O que falta resolver</h3><p>Produtos que precisam ser adquiridos para o encontro.</p></div><button className="ev-link" onClick={()=>setTab('shopping')}>Ver compras <ChevronRight size={16}/></button></div>
       {buying.slice(0,5).map(r=><div className="ev-summary-row" key={r.id}><strong>{r.name}</strong><span>{num(r.quantity)} {r.unit}</span></div>)}{!buying.length&&<p className="ev-muted ev-empty">Nada pendente de compra por enquanto.</p>}
       {canEdit&&<button className="ev-inline-add" onClick={()=>openForm('shopping')}><Plus size={16}/> Adicionar compra</button>}
      </section>
      <section className="ev-panel ev-span"><div className="ev-panel-title"><div><h3><Info size={19}/> Informações e observações</h3><p>Detalhes gerais da preparação.</p></div></div><p className="ev-notes">{event.notes||'Sem observações adicionais sobre o evento.'}</p></section>
    </div>}
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
   {tab==='checklist'&&<section className="ev-panel"><div className="ev-panel-title"><div><h3><ClipboardList size={20}/> Checklist da {event.title}</h3><p>Acompanhe tudo o que já foi providenciado.</p></div><span className="ev-progress-label">{doneChecks}/{allChecks} concluídos</span></div>
     <div className="ev-progress"><span style={{width:(allChecks?100*doneChecks/allChecks:0)+'%'}}/></div>
     <h4 className="ev-group-title">Materiais e utensílios</h4>{needed.map(r=><label key={r.id} className={'ev-checkline '+(r.is_done?'done':'')}><input type="checkbox" checked={!!r.is_done} disabled={!canEdit||busy} onChange={()=>patchRequirement(r,{is_done:!r.is_done})}/><span><strong>{r.name}</strong><small>{num(r.quantity)} {r.unit} · {r.is_done?'Pronto':'A providenciar'} · {memberName(r.assigned_to)}</small></span></label>)}{!needed.length&&<p className="ev-muted">Nenhum item necessário ainda.</p>}
     <h4 className="ev-group-title">Compras do evento</h4>
     {shoppingList.map(r=><label key={r.id} className={'ev-checkline '+(r.status!=='pending'?'done':'')}><input type="checkbox" checked={r.status!=='pending'} disabled={!canEdit||busy} onChange={()=>patchShopping(r,{status:r.status==='pending'?'purchased':'pending'})}/><span><strong>{r.name}</strong><small>{num(r.quantity)} {r.unit} · {purchaseStatuses[r.status]||'Pendente'} · {memberName(r.assigned_to)}</small></span></label>)}
     {!shoppingList.length&&<p className="ev-muted">Nenhuma compra cadastrada.</p>}
     <h4 className="ev-group-title">Tarefas de preparação</h4>{eventTasks.map(t=><label key={t.id} className={'ev-checkline '+(t.status==='done'?'done':'')}><input type="checkbox" checked={t.status==='done'} disabled={!canEdit||busy} onChange={()=>toggleTask(t)}/><span><strong>{t.title}</strong><small>Prazo: {fmtDate(t.due_on)} · Responsável: {memberName(t.assigned_to)}</small></span></label>)}{!eventTasks.length&&<p className="ev-muted">Nenhuma tarefa vinculada.</p>}
     {canEdit&&<form className="ev-add-task" onSubmit={addTask}><input value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Nova tarefa para este evento" required maxLength={160}/><select aria-label="Responsável pela tarefa" value={taskAssignedTo} onChange={e=>setTaskAssignedTo(e.target.value)}><option value="">Sem responsável</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m.user_id)}</option>)}</select><button className="ev-primary" disabled={busy||!taskTitle.trim()}><Plus size={16}/> Adicionar tarefa</button></form>}
   </section>}
   {error&&!modal&&<div role="alert" className="ev-error"><AlertCircle size={17}/>{error}</div>}
   {modal&&<div className="ev-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}>
    <div className="ev-modal" role="dialog" aria-modal="true" aria-labelledby="ev-modal-label">
     <div className="ev-modal-head"><div><span>{modal.type==='bulk'?'Lista de compras':modal.type==='menu'?'Cardápio':'Itens necessários'}</span>
      <h3 id="ev-modal-label">{modal.type==='bulk'?'Adicionar vários itens':modal.id?'Editar item':'Adicionar item'}</h3></div>
      <button type="button" title="Fechar" onClick={()=>setModal(null)}><X size={20}/></button>
     </div>
     {modal.type==='bulk'?<form onSubmit={submitForm}>
      <p className="ev-bulk-hint">Cole ou digite sua lista. Cada linha vira um item e aparece automaticamente nas compras.</p>
      <label>Itens (um por linha)
       <textarea required autoFocus className="ev-bulk-lines" rows={9} value={form.lines||''}
        onChange={e=>setForm({...form,lines:e.target.value})}
        placeholder={'5 kg de carne\n3 caixas de cerveja\n2 pacotes de carvão\nGuardanapos'}/>
      </label>
      <div className="ev-form-two">
       <label>Destino dos itens<select value={form.purchase_status||'buy'} onChange={e=>setForm({...form,purchase_status:e.target.value})}>
        {Object.entries(purchases).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
       <label>Responsável (pode definir depois)<select value={form.assigned_to||''} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
        <option value="">Sem responsável</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m.user_id)}</option>)}</select></label>
      </div>
      <small className="ev-bulk-tip">Exemplos: “5 kg de carne”, “3 caixas de cerveja” ou apenas “carvão” (1 unidade). Itens já cadastrados com o mesmo nome e unidade serão ignorados.</small>
      {error&&<div role="alert" className="ev-error"><AlertCircle size={16}/>{error}</div>}
      <div className="ev-actions"><button type="button" className="ev-secondary" onClick={()=>setModal(null)}>Cancelar</button>
       <button className="ev-primary" disabled={busy||!form.lines?.trim()}>{busy?'Adicionando…':'Adicionar lista inteira'}</button></div>
     </form>:<form onSubmit={submitForm}>
      {modal.type==='requirement'&&<label>Vincular produto do estoque<select value={form.inventory_item_id||''} onChange={e=>selectStock(e.target.value)}>
       <option value="">Sem vínculo com estoque</option>
       {stock.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(item=><option key={item.id} value={item.id}>{item.name} — {num(item.quantity)} {item.unit}</option>)}
      </select></label>}
      <label>Nome *<input required maxLength={180} value={form.name||''}
       placeholder={modal.type==='menu'?'Ex.: Churrasco, arroz, salada':'Ex.: Carne, carvão, refrigerante'}
       onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <div className="ev-form-two">
       <label>Quantidade *<input required type="number" step="any" min="0.001" value={form.quantity??1} onChange={e=>setForm({...form,quantity:e.target.value})}/></label>
       <label>Unidade<select value={form.unit||'un'} onChange={e=>setForm({...form,unit:e.target.value})}>
        {['un','kg','g','L','ml','pacote','caixa','saco','garrafa','fardo','lata','porção'].map(unit=><option key={unit} value={unit}>{unit}</option>)}</select></label>
      </div>
      {modal.type==='menu'?<label>Tipo no cardápio<select value={form.course||'main'} onChange={e=>setForm({...form,course:e.target.value})}>
        {Object.entries(courses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>:
       <><label>Situação de compra<select value={form.purchase_status||'buy'} onChange={e=>setForm({...form,purchase_status:e.target.value})}>
         {Object.entries(purchases).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <label>Quem vai providenciar?<select value={form.assigned_to||''} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
         <option value="">Sem responsável</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m.user_id)}</option>)}</select></label></>}
      <label>Observações<textarea rows={2} value={form.notes||''} placeholder="Detalhes ou instruções..." onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      {error&&<div role="alert" className="ev-error"><AlertCircle size={16}/>{error}</div>}
      <div className="ev-actions"><button type="button" className="ev-secondary" onClick={()=>setModal(null)}>Cancelar</button>
       <button className="ev-primary" disabled={busy}>{busy?'Salvando…':'Salvar item'}</button></div>
     </form>}
    </div>
   </div>}
 </div>;
}
