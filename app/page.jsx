'use client';
import {useEffect,useMemo,useState,useRef} from 'react';
import {createClient} from '@supabase/supabase-js';
import {House,CalendarDays,Package,Utensils,ShoppingCart,ClipboardList,Wrench,MapPin,Users,LogOut,RefreshCw,ArrowUpDown,Plus,Trash2,Pencil,Menu} from 'lucide-react';
import StockDashboard from '../components/StockDashboard';
import EventHub from '../components/EventHub';
import CommitmentsBoard from '../components/CommitmentsBoard';
import OverviewDashboard from '../components/OverviewDashboard';
import BrandSignature from '../components/BrandSignature';
import {InviteManager} from '../components/WorkspaceInvites';
import DeleteWorkspacePanel from '../components/DeleteWorkspacePanel';
import WorkspaceChooser from '../components/WorkspaceChooser';
import './live.css';
import './stock.css';
import './events.css';
import './commitments.css';
import './brand.css';
import './spaces.css';
import './workspace-chooser.css';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase=URL&&KEY?createClient(URL,KEY):null;
const sections=[
 {key:'events',label:'Eventos',icon:CalendarDays,fields:[['title','Evento','text',true],['event_date','Data','date',true],['start_time','Horário','time'],['guests','Convidados','number'],['event_type','Tipo','text'],['status','Situação','select:planning|confirmed|active|completed|cancelled'],['menu_notes','Cardápio','textarea'],['notes','Observações','textarea']]},
 {key:'inventory_items',label:'Estoque',icon:Package,fields:[['name','Produto','text',true],['category','Categoria','select:Bebidas|Alimentos|Ingredientes|Temperos|Limpeza|Descartáveis|Outros'],['quantity','Quantidade inicial','number'],['min_quantity','Estoque mínimo','number'],['unit','Unidade','select:un|kg|g|L|ml|pacote'],['area_id','Local de armazenamento','area'],['expires_on','Validade','date'],['price','Custo unitário','number']]},
 {key:'assets',label:'Patrimônio',icon:Utensils,fields:[['name','Item','text',true],['quantity','Quantidade','number'],['damaged_quantity','Avariados','number'],['notes','Observações','textarea']]},
 {key:'tasks',label:'Compromissos',icon:ClipboardList,fields:[['title','Tarefa','text',true],['due_on','Prazo','date'],['status','Situação','select:pending|done'],['notes','Observações','textarea']]},
];
const tableNames=[...sections.map(s=>s.key),'memberships','inventory_movements','areas','menu_items','event_requirements','shopping_items'];
const ranks={viewer:0,collaborator:1,admin:2,owner:3};
const roleLabels={owner:'Proprietário',admin:'Administrador',collaborator:'Colaborador',viewer:'Visualizador'};
const statuses={planning:'Planejado',confirmed:'Confirmado',active:'Em andamento',completed:'Concluído',cancelled:'Cancelado',pending:'Pendente',purchased:'Comprado',received:'Recebido',done:'Concluída'};
const number=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'—';
function clean(row){return Object.fromEntries(Object.entries(row).filter(([,v])=>v!==''&&v!==undefined&&v!==null));}
function AuthScreen({onAuth}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(e){e.preventDefault();setBusy(true);setMessage('');const {error,data}=signup?await supabase.auth.signUp({email:email.trim(),password}):await supabase.auth.signInWithPassword({email:email.trim(),password});setBusy(false);if(error)setMessage(error.message);else if(signup&&!data.session)setMessage('Cadastro enviado. Se a confirmação por e-mail estiver ativa, confirme o endereço antes de entrar. Depois, abra o convite novamente.');else onAuth(data.user);}
 return <main className="hx-auth"><div className="hx-auth-card"><BrandSignature /><h1>{signup?'Criar conta':'Bem-vindo de volta'}</h1><p>{typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('convite')?'Entre ou crie sua conta para participar do espaço pelo convite.':'Organize os encontros, tarefas e compras do seu espaço.'}</p><form onSubmit={submit}><label>E-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" required minLength={6} autoComplete={signup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="hx-primary" disabled={busy}>{busy?'Processando…':signup?'Cadastrar':'Entrar'}</button></form>{message&&<p role="status" className="hx-message">{message}</p>}<button className="hx-link" onClick={()=>{setSignup(!signup);setMessage('')}}>{signup?'Já tenho conta':'Criar uma conta'}</button></div></main>;
}
export default function Home(){
 const [eventToOpen,setEventToOpen]=useState(null);
 const activeSpaceRef=useRef(null);
 const [spacesUserId,setSpacesUserId]=useState(null);
 const [invitedWorkspaceId,setInvitedWorkspaceId]=useState(null);
 const [user,setUser]=useState(undefined),[workspace,setWorkspace]=useState(null),[workspaces,setWorkspaces]=useState([]),[membership,setMembership]=useState(null),[spacesReady,setSpacesReady]=useState(false),[inviteWorking,setInviteWorking]=useState(false),[inviteError,setInviteError]=useState(''),[data,setData]=useState({}),[tab,setTab]=useState('overview'),[busy,setBusy]=useState(false),[toast,setToast]=useState(''),[modal,setModal]=useState(null),[form,setForm]=useState({}),[workspaceName,setWorkspaceName]=useState('Hora Extra'),[mobile,setMobile]=useState(false),[search,setSearch]=useState(''),[stockView,setStockView]=useState('stock');
 useEffect(()=>{if(!supabase){setUser(null);return;}supabase.auth.getUser().then(({data,error})=>setUser(error?null:data.user));const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')window.sessionStorage.removeItem('horaextra:selected-space');setUser(session?.user||null)});return()=>subscription.unsubscribe()},[]);
 const notify=msg=>{setToast(msg);};

 async function loadSpaces(preferredId=null,chooseNewest=false){
  if(!supabase||!user)return;
  const {data:spaces,error}=await supabase.from('workspaces').select('id,name,created_by,created_at').order('created_at',{ascending:true});
  if(error){notify(error.message);activeSpaceRef.current=null;setWorkspace(null);setMembership(null);setWorkspaces([]);setSpacesUserId(user.id);setSpacesReady(true);return;}
  const available=spaces||[];
  setWorkspaces(available);
  const remembered=window.sessionStorage.getItem('horaextra:selected-space');
  const selectedId=preferredId||(remembered?.startsWith(user.id+':')?remembered.slice(user.id.length+1):null);
  const chosen=chooseNewest?(available[available.length-1]||null):(available.find(s=>s.id===selectedId)||null);
  activeSpaceRef.current=chosen?.id||null;
  if(chosen)window.sessionStorage.setItem('horaextra:selected-space',user.id+':'+chosen.id);
  setWorkspace(chosen);
  if(chosen){
   const {data:m,error:memberError}=await supabase.from('memberships').select('*').eq('workspace_id',chosen.id).eq('user_id',user.id).maybeSingle();
   if(memberError)notify(memberError.message);
   setMembership(m||null);
  }else setMembership(null);
  setSpacesUserId(user.id);setSpacesReady(true);
 }
 async function switchWorkspace(id){
  activeSpaceRef.current=null;setSpacesReady(false);setWorkspace(null);setMembership(null);
  setData({});setTab('overview');setEventToOpen(null);setMobile(false);
  await loadSpaces(id);
 }
 function showWorkspaceChooser(){
  window.sessionStorage.removeItem('horaextra:selected-space');
  activeSpaceRef.current=null;setWorkspace(null);setMembership(null);setData({});
  setTab('overview');setEventToOpen(null);setMobile(false);
 }
 async function signOut(){
  window.sessionStorage.removeItem('horaextra:selected-space');
  await supabase.auth.signOut();
 }
 useEffect(()=>{
  if(!supabase||!user){activeSpaceRef.current=null;setWorkspace(null);setMembership(null);setWorkspaces([]);setData({});setSpacesUserId(null);setInvitedWorkspaceId(null);setSpacesReady(false);return;}
  let cancelled=false;
  (async()=>{
   setSpacesReady(false);setInviteError('');
   let joined=null;
   const invite=new URLSearchParams(window.location.search).get('convite');
   if(invite){
    window.sessionStorage.removeItem('horaextra:selected-space');
    setInviteWorking(true);
    const {data:joinedId,error}=await supabase.rpc('join_workspace_by_link',{p_token:invite});
    if(cancelled)return;
    setInviteWorking(false);
    if(error){setInviteError(error.message);notify('Convite inválido ou expirado: '+error.message);}
    else{
     joined=joinedId;
     setInvitedWorkspaceId(joinedId);
     window.history.replaceState(null,'',window.location.pathname+window.location.hash);
     notify('Você entrou no espaço! Bem-vindo à equipe.');
    }
   }
   if(!cancelled)await loadSpaces();
  })();
  return()=>{cancelled=true;};
 },[user?.id]);

 const role=membership?.role||'viewer',can=level=>ranks[role]>=ranks[level];
 async function refresh(){if(!supabase||!workspace)return;const expectedId=workspace.id;setBusy(true);const results=await Promise.all(tableNames.map(t=>supabase.from(t).select('*').eq('workspace_id',expectedId).limit(1000)));if(activeSpaceRef.current!==expectedId)return;const failure=results.find(r=>r.error);if(failure)notify(failure.error.message);else setData(Object.fromEntries(results.map((r,i)=>[tableNames[i],r.data||[]])));setBusy(false);}
 useEffect(()=>{if(workspace?.id)refresh()},[workspace?.id]);

 async function createWorkspace(e){
  e.preventDefault();
  if(!workspaceName.trim()||busy)return;
  setBusy(true);
  const {error}=await supabase.from('workspaces').insert({name:workspaceName.trim(),created_by:user.id});
  setBusy(false);
  if(error){notify(error.message);return;}
  setWorkspaceName('Hora Extra');setData({});setTab('overview');
  notify('Novo espaço criado!');
  await loadSpaces(null,true);
 }
 async function save(e){e.preventDefault();if(!can('collaborator'))return;setBusy(true);const section=sections.find(s=>s.key===modal.table);const values={};for(const [key,,type] of section.fields){if(form[key]===''||form[key]===undefined||form[key]===null)continue;values[key]=type==='number'?Number(form[key]):form[key];}const payload=clean({...values,...(modal.edit?{}:{workspace_id:workspace.id})});if(section.key==='inventory_items'&&modal.edit){delete payload.quantity;if(form.area_id==='')payload.area_id=null;}const q=modal.edit?supabase.from(section.key).update(payload).eq('id',modal.id).eq('workspace_id',workspace.id):supabase.from(section.key).insert(payload);const {error}=await q;setBusy(false);if(error)return notify(error.message);setModal(null);notify('Registro salvo.');refresh();}
 async function remove(section,row){if(!can('admin')||!confirm('Excluir este registro?'))return;const {error}=await supabase.from(section).delete().eq('workspace_id',workspace.id).eq('id',row.id);if(error)notify(error.message);else refresh();}
 async function move(item,delta,reason){if(!can('collaborator'))return false;const {error}=await supabase.rpc('record_inventory_movement',{p_item_id:item.id,p_delta:delta,p_reason:reason});if(error){notify(error.message);return false;}notify('Movimentação registrada.');refresh();return true;}

 async function deleteWorkspaceConfirmed(confirmedName){
  if(!workspace||!user||role!=='owner')return false;
  const targetId=workspace.id;
  setBusy(true);
  const {error}=await supabase.rpc('delete_workspace',{p_workspace:targetId,p_confirmation:confirmedName});
  setBusy(false);
  if(error){notify(error.message);return false;}
  window.sessionStorage.removeItem('horaextra:selected-space');
  activeSpaceRef.current=null;
  setWorkspace(null);setMembership(null);setData({});setTab('overview');setEventToOpen(null);setMobile(false);
  setSpacesReady(false);
  setInvitedWorkspaceId(null);
  notify('Espaço excluído permanentemente.');
  await loadSpaces();
  return true;
 }
 async function removeMember(row){if(!confirm('Remover acesso desta pessoa?'))return;const {error}=await supabase.rpc('remove_member',{p_workspace:workspace.id,p_user:row.user_id});if(error)notify(error.message);else refresh();}
 function open(section,row){if(!can('collaborator'))return;const defaults=Object.fromEntries(section.fields.filter(([, ,type])=>type.startsWith('select:')).map(([key,,type])=>[key,type.slice(7).split('|')[0]]));setModal({table:section.key,id:row?.id||null,edit:!!row?.id});setForm({...defaults,...(row||{})});}
 const current=sections.find(s=>s.key===(tab==='inventory_items'&&stockView==='assets'?'assets':tab));
 const rows=(data[current?.key]||[]).filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(search.toLowerCase())));
 const stats=useMemo(()=>({events:(data.events||[]).filter(x=>!['completed','cancelled'].includes(x.status)).length,low:(data.inventory_items||[]).filter(x=>Number(x.quantity)<=Number(x.min_quantity)).length,tasks:(data.tasks||[]).filter(x=>x.status!=='done').length,expenses:(data.shopping_items||[]).filter(x=>x.status==='pending').reduce((s,x)=>s+Number(x.quantity)*Number(x.estimated_unit_price||0),0)}),[data]);
 if(!supabase)return <main className="hx-auth"><div className="hx-auth-card"><h1>Configuração pendente</h1><p>Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no ambiente da Vercel ou .env.local.</p><a href="/demo">Abrir demonstração</a></div></main>;
 if(user===undefined)return <div className="hx-loading">Carregando Hora Extra…</div>;
 if(!user)return <AuthScreen onAuth={setUser}/>;

 if(!spacesReady||spacesUserId!==user.id||inviteWorking)return <div className="hx-loading" role="status">{inviteWorking?'Entrando no espaço pelo convite…':'Carregando seus espaços…'}</div>;
 if(!workspace)return <WorkspaceChooser
  spaces={workspaces}
  user={user}
  invitedWorkspaceId={invitedWorkspaceId}
  inviteError={inviteError}
  creating={busy}
  currentName={workspaceName}
  onNameChange={setWorkspaceName}
  onSelect={switchWorkspace}
  onCreate={createWorkspace}
  onRefresh={()=>loadSpaces()}
  onSignOut={signOut}
 />;
 const navigation=[{key:'overview',label:'Visão geral',icon:House},...['tasks','events','inventory_items'].map(key=>sections.find(s=>s.key===key))];
 const navigate=(key)=>{setTab(key);setMobile(false);setSearch('');if(key!=='events')setEventToOpen(null);};
 const openEventFromDashboard=(id)=>{setEventToOpen(id);navigate('events');};
 async function toggleShoppingFromDashboard(row){
  if(!can('collaborator'))return;
  const nextStatus=row.status==='pending'?'purchased':'pending';
  const {error}=await supabase.from('shopping_items').update({status:nextStatus})
    .eq('workspace_id',workspace.id).eq('id',row.id).select('id');
  if(error)notify(error.message);else refresh();
}
 const shopping=data.shopping_items||[];
 const purchased=shopping.filter(r=>r.status!=='pending').length;
 const shoppingPercentage=shopping.length?Math.round(100*purchased/shopping.length):0;
 return <div className="hx-app">

 <aside className="hx-sidebar">
  <BrandSignature workspaceName={workspace.name}/>
  <button type="button" className="he-choose-again" onClick={showWorkspaceChooser}>Escolher</button>
  <nav aria-label="Navegação principal">{navigation.map(({key,label,icon:Icon})=><button key={key} className={tab===key?'active':''} onClick={()=>navigate(key)}><Icon size={20} strokeWidth={1.85}/>{label}</button>)}</nav>
  <div className="he-sidebar-rule"/>
  <button className={'he-sidebar-team '+(tab==='equipe'?'active':'')} onClick={()=>navigate('equipe')}><Users size={19}/> Espaços e equipe</button>
  <div className="hx-user"><div className="he-user-avatar">{user.email?.slice(0,2).toUpperCase()}</div><div className="he-user-details"><span>{user.email}</span><small>{roleLabels[role]}</small></div><button className="he-user-logout" title="Sair" aria-label="Sair da conta" onClick={signOut}><LogOut size={18}/></button></div>
 </aside>
 <main className="hx-main">
  <header className="hx-header">
   <div><span className="he-page-accent"/><h1>{tab==='equipe'?'Equipe':navigation.find(n=>n.key===tab)?.label}</h1><p className="he-page-subtitle">{tab==='overview'?'Acompanhe compromissos, eventos, compras e estoque em um só lugar.':tab==='tasks'?'Organize quem ficou responsável por cada compromisso.':tab==='events'?'Planeje os encontros e compartilhe os preparativos.':tab==='inventory_items'?'Controle produtos, insumos e patrimônio do espaço.':'Gerencie as pessoas e permissões do espaço.'}</p></div>
   <div className="hx-header-actions"><div className="he-header-avatar" title={user.email}>{user.email?.slice(0,2).toUpperCase()}</div><button className="hx-secondary" onClick={refresh} disabled={busy}><RefreshCw size={16}/> <span>Atualizar</span></button>{current&&current.key!=='inventory_items'&&current.key!=='events'&&current.key!=='tasks'&&can('collaborator')&&<button className="hx-primary" onClick={()=>open(current)}><Plus size={17}/> Adicionar</button>}</div>
  </header>
  {tab==='overview'&&<OverviewDashboard events={data.events||[]} tasks={data.tasks||[]} shoppingItems={data.shopping_items||[]} stock={data.inventory_items||[]} members={data.memberships||[]} userId={user.id} canEdit={can('collaborator')} onNavigate={navigate} onOpenEvent={openEventFromDashboard} onToggleShopping={toggleShoppingFromDashboard}/>}

 {tab==='events'&&<EventHub events={data.events||[]} menuItems={data.menu_items||[]} requirements={data.event_requirements||[]} shoppingItems={data.shopping_items||[]} tasks={data.tasks||[]} stock={data.inventory_items||[]} members={data.memberships||[]} userId={user.id} workspaceId={workspace.id} supabase={supabase} canEdit={can('collaborator')} canDelete={can('admin')} onAddEvent={()=>open(sections.find(s=>s.key==='events'))} onEditEvent={event=>open(sections.find(s=>s.key==='events'),event)} onDeleteEvent={event=>remove('events',event)} onRefresh={refresh} onNotify={notify} defaultEventId={eventToOpen}/>}
 {tab==='inventory_items'&&<div className="hx-stock-switch" role="group" aria-label="Área do estoque"><button className={stockView==='stock'?'on':''} onClick={()=>setStockView('stock')}>Produtos e insumos</button><button className={stockView==='assets'?'on':''} onClick={()=>setStockView('assets')}>Patrimônio e utensílios</button></div>}
 {tab==='inventory_items'&&stockView==='stock'&&<StockDashboard items={data.inventory_items||[]} movements={data.inventory_movements||[]} areas={data.areas||[]} memberships={data.memberships||[]} canEdit={can('collaborator')} canDelete={can('admin')} onAdd={()=>open(sections.find(s=>s.key==='inventory_items'))} onEdit={item=>open(sections.find(s=>s.key==='inventory_items'),item)} onDelete={item=>remove('inventory_items',item)} onMove={move}/>}
 {tab==='tasks'&&<CommitmentsBoard tasks={data.tasks||[]} members={data.memberships||[]} events={data.events||[]} userId={user.id} workspaceId={workspace.id} supabase={supabase} canEdit={can('collaborator')} canDelete={can('admin')} onRefresh={refresh} onNotify={notify}/>}
 {current&&current.key!=='inventory_items'&&current.key!=='events'&&current.key!=='tasks'&&<section className="hx-panel"><div className="hx-panel-head"><div><h2>{current.label}</h2><p className="hx-muted">{rows.length} registro(s) · {roleLabels[role]}</p></div><input className="hx-search" placeholder="Pesquisar..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="hx-tablewrap"><table><thead><tr><th>Nome</th><th>Informações</th><th>Situação / Quantidade</th><th>Ações</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.title||r.name}</strong></td><td>{r.event_date?date(r.event_date):r.due_on?date(r.due_on):r.expires_on?date(r.expires_on):r.next_due_on?date(r.next_due_on):r.notes||r.category||r.kind||'—'}</td><td>{r.status?statuses[r.status]||r.status:r.quantity!==undefined?number(r.quantity)+' '+(r.unit||'un'):'—'}</td><td><div className="hx-row-actions">{current.key==='inventory_items'&&can('collaborator')&&<button title="Registrar movimentação" onClick={()=>move(r)}><ArrowUpDown size={16}/></button>}{can('collaborator')&&<button title="Editar" onClick={()=>open(current,r)}><Pencil size={16}/></button>}{can('admin')&&<button title="Excluir" onClick={()=>remove(current.key,r)}><Trash2 size={16}/></button>}</div></td></tr>)}{rows.length===0&&<tr><td colSpan="4">Nenhum registro encontrado.</td></tr>}</tbody></table></div>{current.key==='inventory_items'&&(data.inventory_movements||[]).length>0&&<><h3>Movimentações recentes</h3>{data.inventory_movements.slice(-12).reverse().map(m=><div className="hx-item" key={m.id}><strong>{m.delta>0?'+':''}{number(m.delta)} · {m.reason}</strong><span>{new Date(m.created_at).toLocaleString('pt-BR')}</span></div>)}</>}</section>}

 {tab==='equipe'&&<div className="he-team-page">
  <div className="hx-grid">
   <section className="hx-panel">
    <h2>Integrantes de {workspace.name}</h2>
    <p className="hx-muted">Todos que entraram pelo link aparecem aqui automaticamente.</p>
    {(data.memberships||[]).map(m=><div className="hx-item hx-member" key={m.user_id}><div>
     <strong>{m.user_id===user.id?'Você':m.display_name||'Integrante'}</strong><span>{roleLabels[m.role]}</span>
     </div>{can('admin')&&m.role!=='owner'&&(m.role!=='admin'||role==='owner')&&m.user_id!==user.id&&<button className="hx-secondary" onClick={()=>removeMember(m)}>Remover</button>}</div>)}
   </section>
   {can('admin')?<InviteManager key={workspace.id} supabase={supabase} workspaceId={workspace.id} workspaceName={workspace.name} onNotify={notify}/>:
    <section className="hx-panel"><h2>Compartilhar o espaço</h2><p className="hx-muted">Peça o link de convite a um administrador. Não é necessário cadastrar e-mail por e-mail.</p></section>}
  </div>
  <section className="hx-panel he-create-space"><div><h2>Criar outro espaço</h2><p className="hx-muted">Cada espaço terá seus próprios eventos, estoque, tarefas e integrantes.</p></div>
   <form onSubmit={createWorkspace}><label>Nome do novo espaço<input required maxLength={120} value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} placeholder="Ex.: Casa de praia"/></label>
    <button className="hx-primary" disabled={busy}><Plus size={16}/> Criar espaço</button></form>
  </section>
  {role==='owner'&&<DeleteWorkspacePanel key={workspace.id} workspaceName={workspace.name} onDelete={deleteWorkspaceConfirmed}/>}
 </div>}

 {toast&&<div className="hx-toast" role="status" onClick={()=>setToast('')}>{toast} ×</div>}

 </main>
 <nav className="he-mobile-bottom" aria-label="Navegação no celular">{navigation.map(({key,label,icon:Icon})=><button type="button" key={key} className={tab===key?'active':''} onClick={()=>navigate(key)}><Icon size={21} strokeWidth={1.9}/><span>{label}</span></button>)}<button type="button" className={mobile||tab==='equipe'?'active':''} onClick={()=>setMobile(v=>!v)} aria-label="Abrir mais opções"><Menu size={21}/><span>Mais</span></button></nav>
 {mobile&&<div className="he-mobile-sheet"><div className="he-mobile-sheet-heading"><BrandSignature compact/><button type="button" className="hx-secondary" onClick={()=>setMobile(false)}>Fechar</button></div><p>{user.email} · {roleLabels[role]}</p><button type="button" onClick={showWorkspaceChooser}><House size={17}/> Escolher</button><button type="button" onClick={()=>navigate('equipe')}><Users size={17}/> Espaços e equipe</button><button type="button" onClick={signOut}><LogOut size={17}/> Sair da conta</button></div>}
 {modal&&<div className="hx-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}><div className="hx-dialog" role="dialog" aria-modal="true"><h2>{modal.edit?'Editar':'Cadastrar'} · {current?.label}</h2><form onSubmit={save}><div className="hx-formgrid">{current?.fields.filter(([key])=>!(modal.edit&&current.key==='inventory_items'&&key==='quantity')).map(([key,label,type,required])=><label key={key} className={type==='textarea'?'wide':''}>{label}{type==='area'?<select value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})}><option value="">Sem local definido</option>{(data.areas||[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>:type.startsWith('select:')?<select value={form[key]??type.slice(7).split('|')[0]} onChange={e=>setForm({...form,[key]:e.target.value})}>{type.slice(7).split('|').map(v=><option key={v} value={v}>{statuses[v]||v}</option>)}</select>:type==='textarea'?<textarea rows={3} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})}/>:<input required={!!required} type={type} step={type==='number'?'any':undefined} min={type==='number'?0:undefined} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})}/>}</label>)}</div><div className="hx-buttons"><button type="button" className="hx-secondary" onClick={()=>setModal(null)}>Cancelar</button><button className="hx-primary" disabled={busy}>Salvar</button></div></form></div></div>}
 </div>;
}
