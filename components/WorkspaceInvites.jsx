'use client';
import {useState} from 'react';
import {Link2,Copy,ShieldCheck,ShieldOff} from 'lucide-react';

export function InviteManager({supabase,workspaceId,workspaceName,onNotify}){
 const [link,setLink]=useState('');
 const [loading,setLoading]=useState(false);
 const [feedback,setFeedback]=useState('');
 async function generate(){
  if(loading)return;
  setLoading(true);setFeedback('');
  const {data,error}=await supabase.rpc('create_workspace_invite',{p_workspace:workspaceId});
  setLoading(false);
  if(error){setFeedback(error.message);return;}
  const url=new URL('/',window.location.origin);
  url.searchParams.set('convite',data);
  setLink(url.toString());
  setFeedback('Link criado! É válido por 30 dias. Criar outro invalida o anterior.');
  onNotify?.('Link de convite criado.');
 }
 async function copy(){
  if(!link)return;
  try{await navigator.clipboard.writeText(link);setFeedback('Link copiado! Pode compartilhar com os amigos.');}
  catch{setFeedback('Selecione e copie o endereço no campo abaixo.');}
 }
 async function revoke(){
  if(loading||!window.confirm('Revogar o link? Ele deixará de permitir novas entradas.'))return;
  setLoading(true);
  const {error}=await supabase.rpc('revoke_workspace_invite',{p_workspace:workspaceId});
  setLoading(false);
  if(error){setFeedback(error.message);return;}
  setLink('');setFeedback('Convite revogado.');
  onNotify?.('Convite revogado.');
 }
 return <section className="he-invites">
  <div className="he-invites-header">
   <div className="he-invites-symbol"><Link2 size={22}/></div>
   <div><h2>Convidar para o espaço</h2><p>Compartilhe um único link. A pessoa entra em <strong>{workspaceName}</strong> com a própria conta.</p></div>
  </div>
  <div className="he-invite-actions"><button className="hx-primary" type="button" disabled={loading} onClick={generate}><Link2 size={16}/>{link?'Gerar novo link':'Gerar link de convite'}</button>
   {link&&<button className="hx-secondary" type="button" onClick={copy}><Copy size={16}/> Copiar link</button>}
   {link&&<button className="hx-secondary" type="button" disabled={loading} onClick={revoke}><ShieldOff size={16}/> Revogar</button>}
  </div>
  {link&&<label className="he-invite-link-label">Link para compartilhar<input readOnly value={link} onFocus={e=>e.target.select()} aria-label="Link do convite"/></label>}
  {feedback&&<p role="status" className="he-invite-feedback">{feedback}</p>}
  <div className="he-invite-hint"><ShieldCheck size={17}/><span>Quem abrir o link poderá entrar como <strong>colaborador</strong>, depois de fazer login ou criar uma conta. O link não concede acesso de administrador.</span></div>
 </section>;
}
