'use client';
import {useEffect,useState} from 'react';
import {Archive,CheckCircle2,ClipboardCheck,Clock3,Package,Plus,ShoppingBasket,ShieldCheck,TriangleAlert,UtensilsCrossed,X,Pencil,CalendarCheck2} from 'lucide-react';

const fmt=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
const stamp=v=>v?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const emptyCons=()=>({inventory_item_id:'',consumed:'',leftover:'',deduct:true,notes:''});
const emptyDamage=()=>({asset_id:'',quantity:'1',notes:''});
const free=a=>Math.max(0,Number(a.quantity)-Number(a.damaged_quantity||0)-Number(a.loaned_quantity||0)-Number(a.maintenance_quantity||0));

export default function EventCloseout({
 event,closeout=null,consumption=[],damages=[],stock=[],assets=[],tasks=[],shoppingItems=[],requirements=[],members=[],
 supabase,canEdit=false,onRefresh,onNotify
}){
 const [notes,setNotes]=useState('');
 const [leftoverNotes,setLeftoverNotes]=useState('');
 const [damageNotes,setDamageNotes]=useState('');
 const [cleanup,setCleanup]=useState('');
 const [cons,setCons]=useState([]);
 const [damageRows,setDamageRows]=useState([]);
 const [editing,setEditing]=useState(false);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 const pendingTasks=tasks.filter(t=>t.event_id===event.id&&t.status!=='done');
 const pendingPurchases=shoppingItems.filter(i=>i.event_id===event.id&&i.status==='pending');
 const pendingItems=requirements.filter(i=>i.event_id===event.id&&!i.is_done);
 const recordedConsumption=consumption.filter(c=>c.closeout_id===closeout?.id);
 const recordedDamages=damages.filter(d=>d.closeout_id===closeout?.id);
 const closer=members.find(m=>m.user_id===closeout?.closed_by)?.display_name||'Integrante do espaço';
 useEffect(()=>{
  setNotes(closeout?.notes||'');
  setLeftoverNotes(closeout?.leftover_notes||'');
  setDamageNotes(closeout?.damage_notes||'');
  setCleanup(closeout?.cleanup_notes||'');
  setEditing(false);setCons([]);setDamageRows([]);setError('');
 },[event.id,closeout?.id]);

 function setConsField(i,key,value){setCons(rows=>rows.map((x,j)=>j===i?{...x,[key]:value}:x));}
 function setDamageField(i,key,value){setDamageRows(rows=>rows.map((x,j)=>j===i?{...x,[key]:value}:x));}
 async function submit(e){
  e.preventDefault();if(!canEdit||working)return;
  setError('');
  const normalizedCons=[];
  const normalizedDamages=[];
  try{
   for(const row of cons){
    if(!row.inventory_item_id)throw new Error('Selecione o produto em todas as linhas de consumo.');
    const qty=Number(String(row.consumed||'0').replace(',','.'));
    const leftover=Number(String(row.leftover||'0').replace(',','.'));
    if(!Number.isFinite(qty)||qty<0||!Number.isFinite(leftover)||leftover<0)
     throw new Error('Revise as quantidades consumidas e as sobras.');
    if(!qty&&!leftover)continue;
    normalizedCons.push({inventory_item_id:row.inventory_item_id,consumed:qty,leftover,deduct:row.deduct,notes:row.notes});
   }
   for(const row of damageRows){
    if(!row.asset_id)throw new Error('Selecione o patrimônio em todas as avarias.');
    const qty=Number(row.quantity);
    if(!Number.isInteger(qty)||qty<1)throw new Error('Informe uma quantidade inteira para as avarias.');
    normalizedDamages.push({asset_id:row.asset_id,quantity:qty,notes:row.notes});
   }
  }catch(ex){setError(ex.message);return;}
  if(!closeout&&!window.confirm(
    'Encerrar "'+event.title+'"? O evento será concluído e as movimentações selecionadas serão aplicadas ao estoque e patrimônio uma única vez.'
  ))return;
  setWorking(true);
  const {error:dbError}=closeout?
   await supabase.rpc('update_event_closeout_notes',{
    p_event_id:event.id,p_notes:notes,p_leftovers:leftoverNotes,
    p_damages_notes:damageNotes,p_cleanup:cleanup
   }):
   await supabase.rpc('finish_event',{
    p_event_id:event.id,p_notes:notes,p_leftovers:leftoverNotes,
    p_damages_notes:damageNotes,p_cleanup:cleanup,
    p_consumption:normalizedCons,p_asset_damages:normalizedDamages
   });
  setWorking(false);
  if(dbError){setError(dbError.message);return;}
  setEditing(false);
  await onRefresh();
  onNotify(closeout?'Observações do encerramento atualizadas.':'Janta encerrada! Relatório e movimentações registrados.');
 }
 const report=!closeout||editing;
 return <section className="he-closeout">
   <div className="he-closeout-intro">
    <div className="he-closeout-intro-icon">{closeout?<CheckCircle2 size={26}/>:<CalendarCheck2 size={26}/>}</div>
    <div><h3>{closeout?'Relatório de encerramento':'Fechamento da janta'}</h3>
     <p>{closeout?'Um registro permanente do consumo, das sobras, das avarias e das pendências encontradas.':'Finalize o encontro, confira o que sobrou e registre qualquer pendência para a próxima janta.'}</p>
    </div>
    {closeout&&canEdit&&!editing&&<button type="button" className="he-closeout-edit" onClick={()=>setEditing(true)}><Pencil size={16}/> Ajustar observações</button>}
   </div>
   {closeout&&<div className="he-closeout-complete"><CheckCircle2 size={21}/>
    <div><strong>Janta encerrada em {stamp(closeout.closed_at)}</strong><span>Registrado por {closer}. Os consumos e danos foram contabilizados e não serão repetidos.</span></div>
   </div>}
   <div className="he-closeout-summary">
    {[
      {label:'Compromissos pendentes',value:closeout?closeout.pending_task_count:pendingTasks.length,Icon:ClipboardCheck},
      {label:'Compras pendentes',value:closeout?closeout.pending_shopping_count:pendingPurchases.length,Icon:ShoppingBasket},
      {label:'Materiais por conferir',value:closeout?closeout.pending_requirement_count:pendingItems.length,Icon:Package}
    ].map(({label,value,Icon})=><div className="he-closeout-kpi" key={label}><Icon size={19}/><strong>{fmt(value)}</strong><span>{label}</span></div>)}
   </div>
   {!closeout&&pendingTasks.length>0&&<div className="he-closeout-pending">
     <h4><Clock3 size={18}/> Ainda há tarefas pendentes</h4>
     <p>Elas continuarão abertas após o encerramento para que a limpeza e os preparativos finais sejam acompanhados.</p>
     <div>{pendingTasks.slice(0,6).map(t=><span key={t.id}>{t.title}</span>)}</div>
   </div>}
   {closeout&&Array.isArray(closeout.pending_task_titles)&&closeout.pending_task_titles.length>0&&
    <div className="he-closeout-pending"><h4><Clock3 size={18}/> Compromissos pendentes no encerramento</h4>
     <div>{closeout.pending_task_titles.map((t,i)=><span key={i}>{t}</span>)}</div>
     <p>Essas pendências são um retrato do momento do fechamento; os compromissos continuam editáveis em sua própria área.</p>
    </div>}
   {closeout&&!editing&&<>
    <div className="he-closeout-report-grid">
     <div className="he-closeout-report-panel"><h4><UtensilsCrossed size={18}/> Consumo e sobras</h4>
      {recordedConsumption.length?recordedConsumption.map(x=><div className="he-closeout-record" key={x.id}>
        <strong>{x.name}</strong><span>{fmt(x.consumed_quantity)} {x.unit} consumidos · {fmt(x.leftover_quantity)} {x.unit} sobraram</span>
        <small>{x.stock_deducted?'Consumo descontado do estoque':'Sem movimentação no estoque'}{x.notes?' · '+x.notes:''}</small>
       </div>):<p>Nenhum consumo detalhado registrado.</p>}
      {closeout.leftover_notes&&<p className="he-closeout-free-note">{closeout.leftover_notes}</p>}
     </div>
     <div className="he-closeout-report-panel"><h4><TriangleAlert size={18}/> Avarias e equipamentos</h4>
      {recordedDamages.length?recordedDamages.map(x=><div className="he-closeout-record" key={x.id}><strong>{x.name}</strong><span>{fmt(x.quantity)} avariado(s)</span>{x.notes&&<small>{x.notes}</small>}</div>):
       <p>Nenhum dano vinculado ao patrimônio.</p>}
      {closeout.damage_notes&&<p className="he-closeout-free-note">{closeout.damage_notes}</p>}
     </div>
    </div>
    <div className="he-closeout-report-grid">
     <div className="he-closeout-report-panel"><h4><ClipboardCheck size={18}/> Limpeza e próximos passos</h4><p>{closeout.cleanup_notes||'Sem observações de limpeza.'}</p></div>
     <div className="he-closeout-report-panel"><h4><Archive size={18}/> Observações gerais</h4><p>{closeout.notes||'Sem observações adicionais.'}</p></div>
    </div>
    <p className="he-closeout-footer"><ShieldCheck size={17}/> Relatório preservado no histórico deste evento. Para corrigir quantidades movimentadas, utilize as movimentações do Estoque e do Patrimônio.</p>
   </>}
   {report&&<form onSubmit={submit} className="he-closeout-form">
    {(!closeout&&event.status==='cancelled')?<div className="he-closeout-warning"><TriangleAlert size={18}/> Eventos cancelados não podem ser encerrados.</div>:null}
    {!closeout&&event.status==='completed'&&<div className="he-closeout-tip">Este evento já estava marcado como concluído. Você pode registrar agora o relatório que faltou.</div>}
    {!closeout&&<div className="he-closeout-form-card">
     <div className="he-closeout-form-header"><div><h4><UtensilsCrossed size={19}/> Consumo e sobras</h4><p>Registre os produtos usados. O desconto do estoque é opcional em cada linha.</p></div>
      {canEdit&&<button type="button" onClick={()=>setCons(rows=>[...rows,emptyCons()])}><Plus size={16}/> Adicionar produto</button>}
     </div>
     {!cons.length&&<p className="he-closeout-form-empty">Nenhum produto selecionado. Se não houver consumo a informar, deixe esta seção vazia.</p>}
     {cons.map((row,i)=><div className="he-closeout-line" key={i}>
      <div className="he-closeout-line-fields">
       <label className="he-closeout-wide">Produto do estoque<select value={row.inventory_item_id} required onChange={e=>setConsField(i,'inventory_item_id',e.target.value)}>
        <option value="">Selecione o produto</option>
        {stock.map(item=><option key={item.id} value={item.id}>{item.name} · {fmt(item.quantity)} {item.unit} disponíveis</option>)}
       </select></label>
       <label>Consumido<input type="number" min="0" step="any" value={row.consumed} placeholder="0" onChange={e=>setConsField(i,'consumed',e.target.value)}/></label>
       <label>Sobrou<input type="number" min="0" step="any" value={row.leftover} placeholder="0" onChange={e=>setConsField(i,'leftover',e.target.value)}/></label>
       <button type="button" className="he-closeout-delete" aria-label="Remover produto" onClick={()=>setCons(rows=>rows.filter((_,j)=>j!==i))}><X size={18}/></button>
      </div>
      <label className="he-closeout-check"><input type="checkbox" checked={row.deduct} onChange={e=>setConsField(i,'deduct',e.target.checked)}/> Descontar o consumo do estoque ao encerrar</label>
      <input className="he-closeout-inline-notes" maxLength={500} placeholder="Observação sobre o produto" value={row.notes} onChange={e=>setConsField(i,'notes',e.target.value)}/>
     </div>)}
    </div>}
    {!closeout&&<div className="he-closeout-form-card">
     <div className="he-closeout-form-header"><div><h4><TriangleAlert size={19}/> Danos no patrimônio</h4><p>Os danos registrados aqui também atualizarão a quantidade avariada de cada item.</p></div>
      {canEdit&&<button type="button" onClick={()=>setDamageRows(rows=>[...rows,emptyDamage()])}><Plus size={16}/> Registrar dano</button>}
     </div>
     {!damageRows.length&&<p className="he-closeout-form-empty">Nenhuma avaria detalhada. Você pode adicionar se necessário.</p>}
     {damageRows.map((row,i)=><div className="he-closeout-line" key={i}>
      <div className="he-closeout-line-fields">
       <label className="he-closeout-wide">Utensílio ou equipamento<select value={row.asset_id} required onChange={e=>setDamageField(i,'asset_id',e.target.value)}>
        <option value="">Selecione o item</option>
        {assets.filter(a=>!a.archived_at).map(asset=><option key={asset.id} value={asset.id}>{asset.name} · {fmt(free(asset))} disponíveis</option>)}
       </select></label>
       <label>Quantidade<input type="number" min="1" step="1" value={row.quantity} required onChange={e=>setDamageField(i,'quantity',e.target.value)}/></label>
       <button type="button" className="he-closeout-delete" aria-label="Remover dano" onClick={()=>setDamageRows(rows=>rows.filter((_,j)=>j!==i))}><X size={18}/></button>
      </div>
      <input className="he-closeout-inline-notes" maxLength={500} placeholder="O que aconteceu?" value={row.notes} onChange={e=>setDamageField(i,'notes',e.target.value)}/>
     </div>)}
    </div>}
    <div className="he-closeout-form-card">
     <div className="he-closeout-form-header"><div><h4><ClipboardCheck size={19}/> Observações de encerramento</h4><p>Esses textos podem ser ajustados mais tarde, sem lançar novamente as movimentações.</p></div></div>
     <div className="he-closeout-notes-grid">
      <label>O que sobrou?<textarea maxLength={4000} rows={3} placeholder="Ex.: sobraram refrigerantes, pão e guardanapos" value={leftoverNotes} onChange={e=>setLeftoverNotes(e.target.value)}/></label>
      <label>Materiais danificados<textarea maxLength={4000} rows={3} placeholder="Ex.: prato de vidro quebrado" value={damageNotes} onChange={e=>setDamageNotes(e.target.value)}/></label>
      <label>Limpeza e pendências<textarea maxLength={4000} rows={3} placeholder="Ex.: falta lavar a churrasqueira" value={cleanup} onChange={e=>setCleanup(e.target.value)}/></label>
      <label>Resumo e observações gerais<textarea maxLength={4000} rows={3} placeholder="Como foi a janta? O que melhorar?" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     </div>
    </div>
    {error&&<p className="he-closeout-error" role="alert">{error}</p>}
    <div className="he-closeout-submit">
     <span><ShieldCheck size={18}/> {closeout?'Apenas os textos serão atualizados.':'O encerramento é único, com registro auditável das movimentações.'}</span>
     <div>{editing&&<button type="button" className="he-closeout-cancel" onClick={()=>{setEditing(false);setNotes(closeout?.notes||'');setLeftoverNotes(closeout?.leftover_notes||'');setDamageNotes(closeout?.damage_notes||'');setCleanup(closeout?.cleanup_notes||'')}}>Cancelar</button>}
      {canEdit&&event.status!=='cancelled'&&<button className="he-closeout-finish" type="submit" disabled={working}><CheckCircle2 size={18}/>{working?'Salvando…':closeout?'Salvar observações':'Encerrar janta e gerar relatório'}</button>}
     </div>
    </div>
   </form>}
 </section>;
}