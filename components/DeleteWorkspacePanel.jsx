'use client';
import {useState} from 'react';
import {AlertTriangle,Trash2,ChevronDown,ChevronUp} from 'lucide-react';

export default function DeleteWorkspacePanel({workspaceName,onDelete}){
 const [expanded,setExpanded]=useState(false);
 const [typed,setTyped]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function deleteSpace(e){
  e.preventDefault();
  if(busy||typed!==workspaceName)return;
  setBusy(true);setError('');
  try{
   const result=await onDelete(typed);
   if(result!==true)setError('A exclusão não foi concluída. Confira o aviso exibido no aplicativo.');
  }catch(err){setError(err?.message||'Não foi possível excluir o espaço.');}
  finally{setBusy(false);}
 }
 return <section className="he-danger-panel" aria-label="Excluir espaço">
  <button type="button" className="he-danger-trigger" onClick={()=>{setExpanded(v=>!v);setTyped('');setError('');}} aria-expanded={expanded}>
   <span><Trash2 size={17}/> Excluir espaço</span>{expanded?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
  </button>
  {expanded&&<form onSubmit={deleteSpace} className="he-danger-content">
   <div className="he-danger-alert"><AlertTriangle size={20}/><div><strong>Essa ação é permanente.</strong>
    <p>Todos os eventos, compromissos, compras, itens de estoque, patrimônio, convites e integrantes de <strong>{workspaceName}</strong> serão excluídos. Outros espaços e a sua conta não serão afetados.</p>
   </div></div>
   <label htmlFor="he-delete-confirm">Para confirmar, digite exatamente: <strong>{workspaceName}</strong>
    <input id="he-delete-confirm" value={typed} autoComplete="off" maxLength={120} placeholder={workspaceName}
      onChange={e=>setTyped(e.target.value)}/>
   </label>
   {error&&<p role="alert" className="he-danger-error">{error}</p>}
   <div className="he-danger-actions">
    <button type="button" className="hx-secondary" onClick={()=>{setExpanded(false);setTyped('');setError('');}}>Cancelar</button>
    <button type="submit" className="he-danger-delete" disabled={busy||typed!==workspaceName}>
      <Trash2 size={16}/>{busy?'Excluindo…':'Excluir permanentemente'}
    </button>
   </div>
  </form>}
 </section>;
}