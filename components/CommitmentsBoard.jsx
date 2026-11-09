'use client';
import {useEffect,useMemo,useState} from 'react';
import {CalendarDays,Check,CheckCircle2,ClipboardList,Hand,Plus,Search,ShoppingBasket,Trash2,Pencil,UserRound,Clock3,Wrench} from 'lucide-react';

const kindLabels={general:'Tarefa',purchase:'Compra',maintenance:'Manutenção'};
const statusLabels={pending:'A fazer',in_progress:'Em andamento',done:'Concluído'};
const kindIcons={general:ClipboardList,purchase:ShoppingBasket,maintenance:Wrench};
const dateLabel=value=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR'):'Sem prazo';
const initialForm={title:'',kind:'general',assigned_to:'',due_on:'',event_id:'',notes:'',status:'pending'};

export default function CommitmentsBoard({
 tasks=[],members=[],events=[],userId,workspaceId,supabase,canEdit=false,canDelete=false,onRefresh,onNotify,createRequest=0,onCreateRequestHandled,focusTaskId=null
}){
 const [filter,setFilter]=useState('all');
 const [kindFilter,setKindFilter]=useState('all');
 const [query,setQuery]=useState('');
 const [modal,setModal]=useState(null);
 const [form,setForm]=useState(initialForm);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!focusTaskId)return;
  setFilter('all');setKindFilter('all');setQuery('');
  const frame=requestAnimationFrame(()=>document.getElementById('he-task-'+focusTaskId)?.scrollIntoView({behavior:'smooth',block:'center'}));
  return()=>cancelAnimationFrame(frame);
 },[focusTaskId]);

 const names=useMemo(()=>Object.fromEntries(members.map(member=>[member.user_id,
   member.user_id===userId?'Você':(member.display_name||'Integrante')
 ])),[members,userId]);
 const eventNames=useMemo(()=>Object.fromEntries(events.map(event=>[event.id,event.title])),[events]);
 const counts={pending:tasks.filter(x=>x.status==='pending').length,
   progress:tasks.filter(x=>x.status==='in_progress').length,
   done:tasks.filter(x=>x.status==='done').length,
   mine:tasks.filter(x=>x.assigned_to===userId&&x.status!=='done').length};
 const visible=useMemo(()=>tasks.filter(task=>{
  if(filter==='mine'&&task.assigned_to!==userId)return false;
  if(filter==='free'&&task.assigned_to)return false;
  if(filter==='pending'&&task.status==='done')return false;
  if(filter==='done'&&task.status!=='done')return false;
  if(kindFilter!=='all'&&(task.kind||'general')!==kindFilter)return false;
  const haystack=[task.title,task.notes,names[task.assigned_to],eventNames[task.event_id]].join(' ').toLocaleLowerCase('pt-BR');
  return haystack.includes(query.trim().toLocaleLowerCase('pt-BR'));
 }).sort((a,b)=>{
  const aDone=a.status==='done'?1:0,bDone=b.status==='done'?1:0;
  return aDone-bDone||String(a.due_on||'9999-12-31').localeCompare(String(b.due_on||'9999-12-31'))||String(b.created_at).localeCompare(String(a.created_at));
 }),[tasks,filter,kindFilter,query,names,eventNames,userId]);

 function open(row=null){
  if(!canEdit)return;
  setError('');
  setModal(row?.id?{id:row.id}:{});setForm(row?{
   title:row.title||'',kind:row.kind||'general',assigned_to:row.assigned_to||'',due_on:row.due_on||'',
   event_id:row.event_id||'',notes:row.notes||'',status:row.status||'pending'
  }:{...initialForm});
 }
 useEffect(()=>{
  if(createRequest>0){
   if(canEdit)open();
   onCreateRequestHandled?.();
  }
 },[createRequest,canEdit,onCreateRequestHandled]);
 async function run(action,success){
  if(working)return false;
  setWorking(true);setError('');
  try {
   const {error:dbError,data}=await action();
   if(dbError)throw dbError;
   if(Array.isArray(data)&&data.length===0)throw new Error('Nenhum registro foi alterado. Atualize a lista e tente novamente.');
   await onRefresh();
   if(success)onNotify(success);
   return data===undefined?true:data;
  }catch(e){const message=e?.message||'Não foi possível salvar a alteração.';setError(message);onNotify(message);return false;}
  finally{setWorking(false);}
 }
 async function save(e){
  e.preventDefault();
  if(!canEdit||!form.title.trim()||working)return;
  const payload={
   title:form.title.trim(),kind:form.kind,assigned_to:form.assigned_to||null,
   due_on:form.due_on||null,event_id:form.event_id||null,notes:form.notes.trim()||null,status:form.status
  };
  const result=await run(()=>modal.id
   ?supabase.from('tasks').update(payload).eq('workspace_id',workspaceId).eq('id',modal.id).select('id')
   :supabase.from('tasks').insert({...payload,workspace_id:workspaceId}).select('id'),
   modal.id?'Compromisso atualizado.':'Compromisso criado.');
  if(result!==false)setModal(null);
 }
 async function assignToMe(task){
  if(!canEdit||task.assigned_to)return;
  const result=await run(()=>supabase.from('tasks')
   .update({assigned_to:userId,status:task.status==='done'?'done':'in_progress'})
   .eq('workspace_id',workspaceId).eq('id',task.id).is('assigned_to',null).select('id'),
   'Compromisso assumido por você.');
  if(Array.isArray(result)&&result.length===0){setError('Outra pessoa já assumiu este compromisso. Atualize a lista.');}
 }
 async function setStatus(task,status){
  if(!canEdit||task.status===status)return;
  await run(()=>supabase.from('tasks').update({status}).eq('workspace_id',workspaceId).eq('id',task.id).select('id'),
   status==='done'?'Compromisso concluído.':'Status atualizado.');
 }
 async function remove(task){
  if(!canDelete||working||!window.confirm('Excluir este compromisso?'))return;
  await run(()=>supabase.from('tasks').delete().eq('workspace_id',workspaceId).eq('id',task.id).select('id'),'Compromisso excluído.');
 }
 return <div className="cm-board">
  <div className="cm-intro"><div><span className="cm-eyebrow">Organização compartilhada</span><h2>Quem ficou responsável pelo quê?</h2><p>Combine os preparativos, distribua as compras e acompanhe o que já foi feito.</p></div>
   {canEdit&&<button className="hx-primary" onClick={()=>open()}><Plus size={17}/> Novo compromisso</button>}
  </div>
  <div className="cm-metrics">
   <div><Clock3 size={18}/><span>A fazer</span><strong>{counts.pending}</strong></div>
   <div><Hand size={18}/><span>Em andamento</span><strong>{counts.progress}</strong></div>
   <div><CheckCircle2 size={18}/><span>Concluídos</span><strong>{counts.done}</strong></div>
   <div><UserRound size={18}/><span>Meus pendentes</span><strong>{counts.mine}</strong></div>
  </div>
  <div className="cm-toolbar">
   <div className="cm-filters" aria-label="Filtrar compromissos">
    {[['all','Todos'],['mine','Meus'],['free','Sem responsável'],['pending','Em aberto'],['done','Concluídos']].map(([key,label])=><button key={key} onClick={()=>setFilter(key)} className={filter===key?'on':''}>{label}</button>)}
   </div>
   <div className="cm-utilities"><label className="cm-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar compromissos"/></label>
    <select aria-label="Tipo de compromisso" value={kindFilter} onChange={e=>setKindFilter(e.target.value)}>
     <option value="all">Todos os tipos</option><option value="general">Tarefas</option><option value="purchase">Compras</option><option value="maintenance">Manutenção</option>
    </select>
   </div>
  </div>
  {error&&!modal&&<p className="cm-error" role="alert">{error}</p>}
  <div className="cm-list">{visible.map(task=>{
   const Icon=kindIcons[task.kind]||ClipboardList;
   return <article id={'he-task-'+task.id} key={task.id} className={'cm-card '+(task.status==='done'?'done':'')+(focusTaskId===task.id?' he-notice-focused':'')}>
    <div className="cm-card-main"><span className={'cm-kind '+(task.kind||'general')}><Icon size={15}/>{kindLabels[task.kind]||kindLabels.general}</span>
     <h3>{task.title}</h3>{task.notes&&<p>{task.notes}</p>}
     <div className="cm-card-meta"><span><CalendarDays size={15}/>{dateLabel(task.due_on)}</span>
      {task.event_id&&<span>Evento: {eventNames[task.event_id]||'Evento vinculado'}</span>}
      <span className={task.assigned_to?'cm-owner':'cm-no-owner'}><UserRound size={15}/>{task.assigned_to?(names[task.assigned_to]||'Integrante'):'Sem responsável'}</span>
     </div>
    </div>
    <div className="cm-card-actions"><span className={'cm-status '+task.status}>{statusLabels[task.status]||'A fazer'}</span>
     {canEdit&&<div className="cm-buttons">
      {!task.assigned_to&&<button onClick={()=>assignToMe(task)} disabled={working} className="cm-take"><Hand size={15}/> Assumir</button>}
      {task.status!=='done'?<button onClick={()=>setStatus(task,'done')} disabled={working}><Check size={16}/> Concluir</button>:
       <button onClick={()=>setStatus(task,'pending')} disabled={working}>Reabrir</button>}
      <button aria-label={'Editar '+task.title} title="Editar" onClick={()=>open(task)} disabled={working}><Pencil size={15}/></button>
      {canDelete&&<button aria-label={'Excluir '+task.title} title="Excluir" onClick={()=>remove(task)} disabled={working}><Trash2 size={15}/></button>}
     </div>}
    </div>
   </article>;
  })}
  {!visible.length&&<div className="cm-empty"><CheckCircle2 size={28}/><strong>Nenhum compromisso por aqui</strong><p>{filter==='mine'?'Você ainda não assumiu compromissos neste filtro.':'Cadastre uma tarefa, uma compra ou uma manutenção para organizar com a equipe.'}</p>{canEdit&&<button onClick={()=>open()} className="hx-primary"><Plus size={16}/> Criar compromisso</button>}</div>}
  </div>
  {modal&&<div className="hx-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}>
   <div className="hx-dialog cm-dialog" role="dialog" aria-modal="true" aria-label={modal.id?'Editar compromisso':'Novo compromisso'}>
    <div className="cm-modal-head"><div><span className="cm-eyebrow">Compromissos</span><h2>{modal.id?'Editar compromisso':'Novo compromisso'}</h2></div><button className="hx-secondary" type="button" onClick={()=>setModal(null)}>Fechar</button></div>
    <form onSubmit={save}><div className="hx-formgrid">
     <label className="wide">O que precisa ser feito?<input required autoFocus maxLength={160} placeholder="Ex.: Comprar as carnes para sábado" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
     <label>Tipo<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}><option value="general">Tarefa</option><option value="purchase">Compra</option><option value="maintenance">Manutenção</option></select></label>
     <label>Responsável<select value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
      <option value="">Sem responsável</option>{members.map(member=><option key={member.user_id} value={member.user_id}>{member.user_id===userId?'Eu (assumir)':(member.display_name||'Integrante '+member.user_id.slice(0,6))}</option>)}
     </select></label>
     <label>Até quando?<input type="date" value={form.due_on} onChange={e=>setForm({...form,due_on:e.target.value})}/></label>
     <label>Evento (se houver)<select value={form.event_id} onChange={e=>setForm({...form,event_id:e.target.value})}><option value="">Geral, sem evento</option>{events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
     <label>Situação<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="pending">A fazer</option><option value="in_progress">Em andamento</option><option value="done">Concluído</option></select></label>
     <label className="wide">Observações<textarea rows={3} placeholder="Informações úteis para quem vai executar" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    </div>
    {error&&<p className="cm-error" role="alert">{error}</p>}
    <div className="hx-buttons"><button type="button" className="hx-secondary" onClick={()=>setModal(null)}>Cancelar</button><button className="hx-primary" disabled={working}>{working?'Salvando…':'Salvar compromisso'}</button></div>
    </form>
   </div>
  </div>}
 </div>;
}
