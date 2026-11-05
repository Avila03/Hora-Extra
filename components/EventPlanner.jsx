'use client';
import {useState} from 'react';
import {ArrowLeft,CalendarDays,Users,Utensils,ClipboardCheck,ShoppingCart,Package,CheckCircle2} from 'lucide-react';

const templates={
  'Preparação do local':[
    ['Limpar os banheiros','Banheiros'],['Conferir iluminação e tomadas','Salão'],['Organizar mesas e cadeiras','Salão'],['Verificar se há papel e sabonete','Banheiros']
  ],
  'Cozinha e serviço':[
    ['Conferir louças, copos e talheres','Depósito'],['Higienizar bancadas e utensílios','Cozinha'],['Gelar bebidas','Cozinha'],['Separar ingredientes e temperos','Cozinha']
  ],
  'Encerramento':[
    ['Recolher e conferir louças e copos','Depósito'],['Guardar alimentos e bebidas','Cozinha'],['Limpar as mesas e o salão','Salão'],['Conferir portas, luzes e equipamentos','Salão']
  ]
};
const dateString=(d)=> d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data';
const makeId=()=>globalThis.crypto?.randomUUID?.()||String(Date.now()+Math.random());
const currency=(n)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default function EventPlanner({event,tasks,shopping,stock,canEdit,onBack,onSaveEvent,onSaveTask,onSaveShopping,onEditTask,onEditShopping,onEditEvent}) {
  const [editingMenu,setEditingMenu]=useState(false);
  const [menu,setMenu]=useState(event.menu||'');
  const belonging=(row)=>row.eventId===event.id||(!row.eventId&&row.event===event.title);
  const eventTasks=tasks.filter(belonging);
  const eventShopping=shopping.filter(belonging);
  const completed=eventTasks.filter(x=>x.done).length;
  const missing=stock.filter(x=>Number(x.qty)<=Number(x.min));
  const addTemplate=(name)=>{
    if(!canEdit)return;
    const existing=new Set(eventTasks.map(x=>x.name.toLocaleLowerCase('pt-BR')));
    for(const [title,area] of templates[name]){
      if(existing.has(title.toLocaleLowerCase('pt-BR')))continue;
      onSaveTask({id:makeId(),name:title,area,event:event.title,eventId:event.id,date:event.date,done:false});
      existing.add(title.toLocaleLowerCase('pt-BR'));
    }
  };
  const suggestPurchases=()=>{
    if(!canEdit)return;
    const existing=new Set(eventShopping.filter(x=>!x.done).map(x=>x.name.toLocaleLowerCase('pt-BR')));
    for(const item of missing){
      if(existing.has(item.name.toLocaleLowerCase('pt-BR')))continue;
      const quantity=Math.max(1,Number(item.min)-Number(item.qty));
      onSaveShopping({id:makeId(),name:item.name,qty:quantity,unit:item.unit||'un',price:0,event:event.title,eventId:event.id,done:false});
      existing.add(item.name.toLocaleLowerCase('pt-BR'));
    }
  };
  const saveMenu=()=>{onSaveEvent({...event,menu});setEditingMenu(false)};
  return <div className="planner">
    <button className="btn backlink" onClick={onBack}><ArrowLeft size={17}/> Todos os eventos</button>
    <div className="card planner-hero">
      <div className="planner-top"><div><span className="tag">{event.status||'Planejado'}</span><h2>{event.title}</h2></div><button className="btn" disabled={!canEdit} onClick={onEditEvent}>Editar evento</button></div>
      <div className="planner-meta"><span><CalendarDays size={16}/> {dateString(event.date)}</span><span><Users size={16}/> {event.guests||0} convidados</span></div>
    </div>
    <div className="planner-stats">
      <div className="card"><span className="muted">Preparativos feitos</span><strong>{completed} / {eventTasks.length}</strong><div className="progress"><div style={{width:(eventTasks.length?100*completed/eventTasks.length:0)+'%'}}/></div></div>
      <div className="card"><span className="muted">Itens para comprar</span><strong>{eventShopping.filter(x=>!x.done).length}</strong></div>
      <div className="card"><span className="muted">Estimativa de compras</span><strong>{currency(eventShopping.filter(x=>!x.done).reduce((sum,x)=>sum+Number(x.qty||0)*Number(x.price||0),0))}</strong></div>
    </div>
    <div className="planner-grid">
      <section className="card">
        <div className="sectiontitle"><h2><Utensils size={19}/> Cardápio</h2><button className="mini" disabled={!canEdit} onClick={()=>{setMenu(event.menu||'');setEditingMenu(!editingMenu)}}>Editar</button></div>
        {editingMenu?<div className="stack"><textarea className="fullinput" value={menu} rows={4} onChange={e=>setMenu(e.target.value)} placeholder="Ex.: churrasco, arroz, saladas e sobremesa"/><div className="actions"><button className="btn primary" onClick={saveMenu}>Salvar cardápio</button><button className="btn" onClick={()=>setEditingMenu(false)}>Cancelar</button></div></div>:<p className="menu-note">{event.menu||'Ainda não foi definido um cardápio.'}</p>}
      </section>
      <section className="card">
        <div className="sectiontitle"><h2><Package size={19}/> Conferência de estoque</h2></div>
        <p className="details">Os itens abaixo estão no mínimo ou abaixo do mínimo. A sugestão de compras é de reposição geral; ainda não calcula porções por convidado.</p>
        {missing.length?missing.slice(0,5).map(item=><div className="item" key={item.id}><div><strong>{item.name}</strong><small>{item.qty} {item.unit} disponíveis · mínimo {item.min}</small></div><span className="pill warn">Repor</span></div>):<p className="muted">Nenhum estoque abaixo do mínimo.</p>}
        <div className="quick"><button disabled={!canEdit||!missing.length} onClick={suggestPurchases}>Gerar sugestões de compra</button></div>
      </section>
      <section className="card">
        <div className="sectiontitle"><h2><ClipboardCheck size={19}/> Checklist do evento</h2><button className="mini" disabled={!canEdit} onClick={()=>onEditTask()}>+ Tarefa</button></div>
        <div className="template-actions">{Object.keys(templates).map(name=><button className="mini" key={name} disabled={!canEdit} onClick={()=>addTemplate(name)}>+ {name}</button>)}</div>
        {eventTasks.length?eventTasks.map(task=><div className="taskrow" key={task.id}><label><input type="checkbox" checked={!!task.done} disabled={!canEdit} onChange={()=>onSaveTask({...task,done:!task.done})}/><span><strong style={{textDecoration:task.done?'line-through':'none'}}>{task.name}</strong><small className="muted" style={{display:'block',marginTop:4}}>{task.area||'Geral'}</small></span></label><button className="mini" disabled={!canEdit} onClick={()=>onEditTask(task)}>Editar</button></div>):<p className="details">Comece com um modelo acima ou adicione suas tarefas.</p>}
        {eventTasks.length>0&&<p className="details"><CheckCircle2 size={14} style={{verticalAlign:'middle'}}/> {completed} tarefa(s) concluída(s).</p>}
      </section>
      <section className="card">
        <div className="sectiontitle"><h2><ShoppingCart size={19}/> Compras do evento</h2><button className="mini" disabled={!canEdit} onClick={()=>onEditShopping()}>+ Item</button></div>
        {eventShopping.length?eventShopping.map(item=><div className="taskrow" key={item.id}><label><input type="checkbox" checked={!!item.done} disabled={!canEdit} onChange={()=>onSaveShopping({...item,done:!item.done})}/><span><strong style={{textDecoration:item.done?'line-through':'none'}}>{item.name}</strong><small className="muted" style={{display:'block',marginTop:4}}>{item.qty} {item.unit} · {currency(item.price)} por {item.unit}</small></span></label><button className="mini" disabled={!canEdit} onClick={()=>onEditShopping(item)}>Editar</button></div>):<p className="details">Nenhuma compra vinculada a este evento.</p>}
      </section>
    </div>
  </div>;
}
