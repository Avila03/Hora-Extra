'use client';
import {useState} from 'react';
import {ArrowRight, Building2, Check, LogOut, Plus, RefreshCw, ShieldCheck, Users} from 'lucide-react';
import BrandSignature from './BrandSignature';

export default function WorkspaceChooser({
 spaces=[], user, onSelect, onCreate, onRefresh, onSignOut,
 creating=false, initialName='Hora Extra', inviteError='', invitedWorkspaceId=null,
 onNameChange, currentName
}){
 const [opening,setOpening]=useState(null);
 function select(spaceId){if(opening)return;setOpening(spaceId);Promise.resolve(onSelect(spaceId)).finally(()=>setOpening(null));}
 const name=currentName??initialName;
 return <main className="he-choose-page">
  <div className="he-choose-shell">
   <header className="he-choose-header"><BrandSignature compact/><button type="button" className="he-choose-exit" onClick={onSignOut}><LogOut size={16}/> Sair</button></header>
   <section className="he-choose-intro"><span className="he-choose-eyebrow">BEM-VINDO AO HORA EXTRA</span><h1>Escolha seu espaço</h1><p>Olá, {user?.email?.split('@')[0]||'integrante'}! Selecione o espaço que deseja acessar.</p></section>
   {inviteError&&<div className="he-choose-warning" role="alert">O convite não pôde ser utilizado: {inviteError}</div>}
   {invitedWorkspaceId&&spaces.some(s=>s.id===invitedWorkspaceId)&&<p className="he-choose-invite-notice"><Check size={17}/> Convite aceito! O novo espaço está destacado abaixo.</p>}
   {spaces.length>0?<div className="he-choose-grid">{spaces.map(space=>{
    const invited=space.id===invitedWorkspaceId;
    return <button type="button" key={space.id} className={'he-choose-card'+(invited?' invited':'')} onClick={()=>select(space.id)} disabled={!!opening}>
     <span className="he-choose-card-icon"><Building2 size={26} strokeWidth={1.6}/></span>
     <span className="he-choose-card-main"><strong>{space.name}</strong><small>{space.created_by===user?.id?'Você é o proprietário':'Espaço compartilhado'}</small></span>
     {invited&&<span className="he-choose-new-tag">Novo convite</span>}
     <ArrowRight size={19} className="he-choose-card-arrow"/>
    </button>;
   })}</div>:<div className="he-choose-empty"><Users size={29}/><strong>Você ainda não participa de nenhum espaço</strong><p>Crie um espaço para começar ou abra o link de convite enviado por alguém da equipe.</p></div>}
   <div className="he-choose-footer">
    <section className="he-choose-create"><div className="he-choose-create-icon"><Plus size={23}/></div><div><h2>Criar novo espaço</h2><p>Tenha seus próprios eventos, compromissos, estoque e equipe.</p></div>
     <form onSubmit={onCreate}><label htmlFor="he-new-space">Nome do espaço</label><div className="he-choose-create-controls"><input id="he-new-space" type="text" required maxLength={120} placeholder="Ex.: Churrasqueira da turma" value={name} onChange={e=>onNameChange(e.target.value)}/><button type="submit" className="hx-primary" disabled={creating}><Plus size={16}/>{creating?'Criando…':'Criar espaço'}</button></div></form>
    </section>
    <section className="he-choose-help"><ShieldCheck size={17}/><p>Recebeu um convite? Abra o link enviado pelo responsável. Seu espaço aparecerá aqui automaticamente.</p><button type="button" onClick={onRefresh}><RefreshCw size={15}/> Atualizar</button></section>
   </div>
  </div>
 </main>;
}
