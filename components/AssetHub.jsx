'use client';
import {useMemo,useState} from 'react';
import {
  Archive,ArchiveRestore,ArrowRight,ArrowRightLeft,Boxes,Check,ChevronDown,
  Clock3,History,Package,Plus,Search,ShieldCheck,TriangleAlert,
  UserRound,Wrench,X,Pencil,CalendarClock,ClipboardList
} from 'lucide-react';

const n=value=>Number(value||0).toLocaleString('pt-BR');
const date=value=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR'):'Sem prazo';
const stamp=value=>value?new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const activityLabels={create:'Cadastro',adjust:'Ajuste de cadastro',loan:'Empréstimo',return:'Devolução',damage:'Avaria',repair_start:'Enviado para manutenção',repair_finish:'Conserto concluído',archive:'Arquivado',restore:'Reativado'};
const available=a=>Math.max(0,Number(a.quantity||0)-Number(a.damaged_quantity||0)-Number(a.loaned_quantity||0)-Number(a.maintenance_quantity||0));
const kinds=[
 {value:'loan',label:'Emprestar',icon:ArrowRightLeft},
 {value:'return',label:'Registrar devolução',icon:ArrowRight},
 {value:'damage',label:'Registrar avaria',icon:TriangleAlert},
 {value:'repair_start',label:'Enviar para manutenção',icon:Wrench},
 {value:'repair_finish',label:'Concluir manutenção',icon:Check}
];

export default function AssetHub({assets=[],loans=[],history=[],areas=[],members=[],supabase,workspaceId,canEdit=false,canAdmin=false,onAdd,onEdit,onRefresh,onNotify}){
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('active');
 const [modal,setModal]=useState(null);
 const [type,setType]=useState('loan');
 const [qty,setQty]=useState('1');
 const [person,setPerson]=useState('');
 const [due,setDue]=useState('');
 const [details,setDetails]=useState('');
 const [loanId,setLoanId]=useState('');
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 const [historyAsset,setHistoryAsset]=useState(null);
 const locationById=useMemo(()=>Object.fromEntries(areas.map(a=>[a.id,a.name])),[areas]);
 const nameById=useMemo(()=>Object.fromEntries(members.map(m=>[m.user_id,m.display_name||'Integrante'])),[members]);
 const openLoans=loans.filter(l=>Number(l.returned_quantity)<Number(l.quantity));
 const totals=assets.filter(a=>!a.archived_at).reduce((v,a)=>({
  total:v.total+Number(a.quantity||0),
  available:v.available+available(a),
  borrowed:v.borrowed+Number(a.loaned_quantity||0),
  damaged:v.damaged+Number(a.damaged_quantity||0),
  repair:v.repair+Number(a.maintenance_quantity||0)
 }),{total:0,available:0,borrowed:0,damaged:0,repair:0});
 const visible=assets.filter(a=>(filter==='archived'?!!a.archived_at:!a.archived_at)&&
  [a.name,a.notes,locationById[a.area_id]].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))));
 const list=history.filter(h=>!historyAsset||h.asset_id===historyAsset).slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,60);
 const selectedLoans=modal?openLoans.filter(l=>l.asset_id===modal.id):[];

 function openMovement(asset,kind='loan'){
  if(!canEdit)return;
  setModal(asset);setType(kind);setQty('1');setPerson('');setDue('');setDetails('');
  setLoanId(openLoans.find(l=>l.asset_id===asset.id)?.id||'');setError('');
 }
 async function saveMovement(e){
  e.preventDefault();if(!modal||!canEdit||working)return;
  const quantity=Number(qty);
  if(!Number.isInteger(quantity)||quantity<1){setError('Informe uma quantidade inteira maior que zero.');return;}
  if(type==='loan'&&!person.trim()){setError('Informe o nome da pessoa que retirará o item.');return;}
  if(type==='return'&&!loanId){setError('Selecione o empréstimo para a devolução.');return;}
  setWorking(true);setError('');
  const {error:dbError}=await supabase.rpc('record_asset_action',{
    p_asset_id:modal.id,p_kind:type,p_quantity:quantity,
    p_person:type==='loan'?person.trim():null,
    p_notes:details.trim()||null,p_loan_id:type==='return'?loanId:null,
    p_due_on:type==='loan'&&due?due:null,p_event_id:null
  });
  setWorking(false);
  if(dbError){setError(dbError.message);return;}
  setModal(null);await onRefresh();onNotify('Movimentação registrada no histórico do patrimônio.');
 }
 async function toggleArchived(asset){
  if(!canAdmin||working)return;
  if(!asset.archived_at&&(Number(asset.loaned_quantity)>0||Number(asset.maintenance_quantity)>0)){
   onNotify('Devolva os itens emprestados e conclua a manutenção antes de arquivar.');return;
  }
  if(!asset.archived_at&&!window.confirm('Arquivar "'+asset.name+'"? O histórico será preservado.'))return;
  setWorking(true);setError('');
  const {error:dbError}=await supabase.from('assets').update({archived_at:asset.archived_at?null:new Date().toISOString()})
    .eq('workspace_id',workspaceId).eq('id',asset.id).select('id');
  setWorking(false);
  if(dbError){onNotify(dbError.message);return;}
  onNotify(asset.archived_at?'Item reativado.':'Item arquivado sem perder seu histórico.');
  await onRefresh();
 }
 return <div className="he-assets-hub">
  <div className="he-assets-title">
   <div><span className="he-assets-eyebrow">GESTÃO DO ESPAÇO</span>
    <h2>Patrimônio e utensílios</h2>
    <p>Saiba o que está disponível, quem levou cada item e quais precisam de reparos.</p></div>
   {canEdit&&<button type="button" className="hx-primary" onClick={onAdd}><Plus size={17}/> Novo item</button>}
  </div>
  <div className="he-assets-metrics">
   {[['Itens cadastrados',totals.total,Boxes],['Disponíveis',totals.available,Check],['Emprestados',totals.borrowed,ArrowRightLeft],['Avariados',totals.damaged,TriangleAlert],['Em manutenção',totals.repair,Wrench]].map(([label,value,Icon])=>
    <div className="he-assets-metric" key={label}><Icon size={20}/><small>{label}</small><strong>{n(value)}</strong></div>)}
  </div>
  <div className="he-assets-toolbar">
   <label className="he-assets-search"><Search size={18}/><input aria-label="Pesquisar patrimônio" placeholder="Buscar utensílios ou equipamentos..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <div className="he-assets-filters" role="group" aria-label="Filtro de patrimônio">
    <button type="button" className={filter==='active'?'active':''} onClick={()=>setFilter('active')}>Em uso</button>
    <button type="button" className={filter==='archived'?'active':''} onClick={()=>setFilter('archived')}>Arquivados</button>
   </div>
  </div>
  <div className="he-assets-grid">
   {visible.map(asset=>{
    const remaining=available(asset),currentLoans=openLoans.filter(l=>l.asset_id===asset.id);
    return <article className={'he-asset-card '+(asset.archived_at?'archived':'')} key={asset.id}>
     <div className="he-asset-card-header"><span className="he-asset-icon"><Package size={24}/></span>
      <div className="he-asset-info"><h3>{asset.name}</h3><p>{locationById[asset.area_id]||'Local não definido'}</p></div>
      <span className={'he-asset-status '+(asset.archived_at?'quiet':remaining===0?'warn':'ready')}>
       {asset.archived_at?'Arquivado':remaining===0?'Indisponível':'Disponível'}
      </span>
     </div>
     <div className="he-asset-numbers">
      <div><strong>{n(asset.quantity)}</strong><small>Total</small></div>
      <div><strong>{n(remaining)}</strong><small>Disponíveis</small></div>
      <div><strong>{n(asset.loaned_quantity)}</strong><small>Emprestados</small></div>
      <div><strong>{n(asset.damaged_quantity)}</strong><small>Avariados</small></div>
     </div>
     {Number(asset.maintenance_quantity)>0&&<p className="he-asset-repair"><Wrench size={15}/>{n(asset.maintenance_quantity)} em manutenção</p>}
     {currentLoans.length>0&&<p className="he-asset-borrowing"><UserRound size={15}/>{currentLoans.map(l=>l.borrower_name).join(', ')}</p>}
     {asset.notes&&<p className="he-asset-notes">{asset.notes}</p>}
     <div className="he-asset-card-actions">
      {!asset.archived_at&&canEdit&&<button type="button" className="he-asset-main-btn" onClick={()=>openMovement(asset)}><ArrowRightLeft size={16}/> Movimentar</button>}
      <button type="button" onClick={()=>setHistoryAsset(historyAsset===asset.id?null:asset.id)}><History size={16}/> Histórico</button>
      {canEdit&&<button type="button" title="Editar cadastro" aria-label={'Editar '+asset.name} onClick={()=>onEdit(asset)}><Pencil size={16}/></button>}
      {canAdmin&&<button type="button" aria-label={(asset.archived_at?'Reativar ':'Arquivar ')+asset.name} title={asset.archived_at?'Reativar':'Arquivar'} onClick={()=>toggleArchived(asset)}><Archive size={16}/></button>}
     </div>
    </article>;
   })}
   {!visible.length&&<div className="he-assets-empty"><Boxes size={30}/><strong>{filter==='archived'?'Nenhum item arquivado':'Nenhum patrimônio encontrado'}</strong><p>Cadastre copos, utensílios e equipamentos para acompanhar a disponibilidade.</p>{canEdit&&filter==='active'&&<button type="button" className="hx-primary" onClick={onAdd}><Plus size={16}/> Cadastrar item</button>}</div>}
  </div>
  <div className="he-assets-bottom">
   <section className="he-assets-panel">
    <div className="he-assets-panel-heading"><div><ArrowRightLeft size={21}/><h3>Empréstimos em aberto</h3></div><span>{openLoans.length}</span></div>
    {openLoans.length===0?<p className="he-assets-muted">Nenhum item emprestado atualmente.</p>:
     openLoans.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,30).map(loan=>{
      const asset=assets.find(a=>a.id===loan.asset_id);
      const pending=Number(loan.quantity)-Number(loan.returned_quantity);
      const overdue=loan.due_on&&loan.due_on<new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
      return <div className="he-assets-loan-row" key={loan.id}>
       <div><strong>{asset?.name||'Item'}</strong><small><UserRound size={14}/>{loan.borrower_name} · {n(pending)} pendente(s) {loan.due_on?' · até '+date(loan.due_on):''}</small></div>
       {overdue&&<span className="he-asset-overdue">Atrasado</span>}
       {canEdit&&asset&&!asset.archived_at&&<button type="button" onClick={()=>{openMovement(asset,'return');setLoanId(loan.id);setQty(String(pending));}}>Devolver <ArrowRight size={14}/></button>}
      </div>;
     })}
   </section>
   <section className="he-assets-panel" id="he-asset-history">
    <div className="he-assets-panel-heading"><div><History size={21}/><h3>{historyAsset?'Histórico do item':'Movimentações recentes'}</h3></div>
     {historyAsset&&<button type="button" onClick={()=>setHistoryAsset(null)}>Todos <X size={15}/></button>}
    </div>
    {!list.length?<p className="he-assets-muted">As movimentações registradas aparecerão aqui.</p>:list.map(move=><div className="he-assets-history-row" key={move.id}>
     <span className="he-assets-history-symbol"><ClipboardList size={17}/></span><div><strong>{activityLabels[move.kind]||'Movimentação'} · {move.asset_name}</strong>
      <small>{move.quantity? n(move.quantity)+' unidade(s) · ':''}{move.borrower_name?move.borrower_name+' · ':''}{stamp(move.created_at)}</small>
      {move.details&&<p>{move.details}</p>}
      <small>Registrado por {nameById[move.created_by]||'Integrante'}</small>
     </div></div>)}
   </section>
  </div>
  {modal&&<div className="he-asset-overlay" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}>
   <div className="he-asset-dialog" role="dialog" aria-modal="true" aria-labelledby="he-asset-dialog-heading">
    <div className="he-asset-dialog-head"><div><span>Patrimônio</span><h2 id="he-asset-dialog-heading">Movimentar {modal.name}</h2></div>
     <button type="button" aria-label="Fechar" onClick={()=>setModal(null)}><X size={19}/></button></div>
    <form onSubmit={saveMovement}>
     <label>O que aconteceu?
      <select value={type} onChange={e=>{const value=e.target.value;setType(value);setQty('1');setError('');}}>
       {kinds.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}
      </select>
     </label>
     {type==='return'&&<label>Empréstimo
      <select value={loanId} onChange={e=>setLoanId(e.target.value)} required>
       <option value="">Selecione um empréstimo</option>
       {selectedLoans.map(l=><option value={l.id} key={l.id}>{l.borrower_name} · {n(Number(l.quantity)-Number(l.returned_quantity))} pendente(s)</option>)}
      </select>
     </label>}
     {type==='loan'&&<label>Quem está levando?<input value={person} maxLength={120} onChange={e=>setPerson(e.target.value)} placeholder="Nome da pessoa" required/></label>}
     <div className="he-asset-field-pair">
      <label>Quantidade<input type="number" min="1" step="1" required value={qty} onChange={e=>setQty(e.target.value)}/></label>
      {type==='loan'&&<label>Data prevista de devolução<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>}
     </div>
     <label>Observações<textarea rows={3} maxLength={1000} placeholder="Detalhes da movimentação" value={details} onChange={e=>setDetails(e.target.value)}/></label>
     <p className="he-assets-modal-help"><ShieldCheck size={17}/> Esta ação atualiza os quantitativos e entra no histórico do espaço.</p>
     {error&&<p className="he-assets-modal-error" role="alert">{error}</p>}
     <div className="he-asset-dialog-actions"><button type="button" className="hx-secondary" onClick={()=>setModal(null)}>Cancelar</button><button type="submit" className="hx-primary" disabled={working}>{working?'Registrando…':'Registrar movimentação'}</button></div>
    </form>
   </div>
  </div>}
 </div>;
}
