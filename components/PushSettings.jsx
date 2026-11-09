'use client';
import {useEffect,useState} from 'react';
import {BellRing,BellOff,CheckCircle2,Smartphone,Send,ShieldCheck,AlertCircle} from 'lucide-react';

// Public signing key: safe to ship to browsers. Private VAPID key is in Supabase Vault.
const VAPID_PUBLIC_KEY='BNnAwuhqpFAtXHKL35ZWpoKJlvUr65SA6qzrFE4m07vYkgYKma_5CB3M_iHWjV7gbvKL0PkBsrcD4SxR4XnzHL4';

function toAppServerKey(value){
 const padded=(value+'='.repeat((4-value.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');
 const binary=atob(padded);
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}
function isIos(){return typeof navigator!=='undefined'&&/iPad|iPhone|iPod/.test(navigator.userAgent);}
function isStandalone(){
 return typeof window!=='undefined'&&(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true);
}
function hasPushSupport(){
 return typeof window!=='undefined'&&'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window&&window.isSecureContext;
}
export async function removeDeviceSubscriptionsForLogout(supabase,userId){
 if(!hasPushSupport()||!supabase||!userId)return;
 try{
  const reg=await navigator.serviceWorker.getRegistration('/');
  const subscription=await reg?.pushManager?.getSubscription();
  if(subscription){
   // Remove only this physical subscription, across this user's spaces.
   await supabase.from('push_subscriptions').delete()
     .eq('user_id',userId).eq('endpoint',subscription.endpoint);
  }
 }catch{ /* Signing out should remain possible even with denied push permission. */ }
}
export default function PushSettings({supabase,workspaceId,userId}){
 const [supported,setSupported]=useState(false);
 const [installed,setInstalled]=useState(false);
 const [onIos,setOnIos]=useState(false);
 const [permission,setPermission]=useState('default');
 const [enabled,setEnabled]=useState(false);
 const [busy,setBusy]=useState(false);
 const [testing,setTesting]=useState(false);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  async function check(){
   setLoading(true);setError('');setEnabled(false);setMessage('');
   const can=hasPushSupport(),ios=isIos(),standalone=isStandalone();
   if(!active)return;
   setSupported(can);setOnIos(ios);setInstalled(standalone);
   setPermission(can?Notification.permission:'unsupported');
   if(!can||!supabase||!userId||!workspaceId){setLoading(false);return;}
   try{
    const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    const subscription=await reg.pushManager?.getSubscription();
    if(!subscription){if(active)setEnabled(false);return;}
    const {data, error:dbError}=await supabase.from('push_subscriptions').select('id')
      .eq('workspace_id',workspaceId).eq('user_id',userId)
      .eq('endpoint',subscription.endpoint).maybeSingle();
    if(dbError)throw dbError;
    if(active)setEnabled(!!data&&Notification.permission==='granted');
   }catch(ex){if(active)setError(ex?.message||'Não foi possível verificar o dispositivo.');}
   finally{if(active)setLoading(false);}
  }
  check();
  return()=>{active=false};
 },[supabase,workspaceId,userId]);

 async function enable(){
  if(busy||!supabase||!workspaceId||!userId||!hasPushSupport())return;
  if(isIos()&&!isStandalone()){setError('Adicione o Hora Extra à Tela de Início e abra-o pelo ícone antes de ativar.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   // Request permission immediately in response to this click (required by iOS).
   const permissionResult=await Notification.requestPermission();
   setPermission(permissionResult);
   if(permissionResult!=='granted')throw new Error('Permissão negada. Autorize o Hora Extra em Ajustes → Notificações do iPhone.');
   const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
   let subscription=await reg.pushManager.getSubscription();
   if(!subscription){
    subscription=await reg.pushManager.subscribe({
     userVisibleOnly:true,
     applicationServerKey:toAppServerKey(VAPID_PUBLIC_KEY)
    });
   }
   const keys=subscription.toJSON().keys;
   if(!keys?.auth||!keys?.p256dh)throw new Error('O dispositivo não disponibilizou as chaves de notificações.');
   const {error:dbError}=await supabase.from('push_subscriptions').upsert({
    workspace_id:workspaceId,user_id:userId,endpoint:subscription.endpoint,
    p256dh:keys.p256dh,auth_key:keys.auth,
    device_label:isIos()?'iPhone / iPad':'Navegador',
    updated_at:new Date().toISOString()
   },{onConflict:'workspace_id,user_id,endpoint'});
   if(dbError)throw dbError;
   setEnabled(true);
   setMessage('Notificações ativadas neste aparelho! Você pode enviar um teste abaixo.');
  }catch(ex){
   setError(ex?.message||'Não foi possível ativar as notificações push.');
  }finally{setBusy(false);}
 }
 async function disable(){
  if(busy||!supabase||!workspaceId||!userId)return;
  setBusy(true);setMessage('');setError('');
  try{
   const reg=await navigator.serviceWorker.getRegistration('/');
   const subscription=await reg?.pushManager.getSubscription();
   if(subscription){
    const {error:dbError}=await supabase.from('push_subscriptions').delete()
      .eq('workspace_id',workspaceId).eq('user_id',userId)
      .eq('endpoint',subscription.endpoint);
    if(dbError)throw dbError;
   }
   // Keep the browser-level subscription intact if this device follows other spaces.
   setEnabled(false);setMessage('Push desativado neste espaço para este dispositivo.');
  }catch(ex){setError(ex?.message||'Não foi possível desativar o push.');}
  finally{setBusy(false);}
 }
 async function sendTest(){
  if(!enabled||testing||!supabase)return;
  setTesting(true);setError('');setMessage('');
  const {data,error:rpcError}=await supabase.rpc('send_my_push_test',{p_workspace:workspaceId});
  setTesting(false);
  if(rpcError){setError(rpcError.message);return;}
  setMessage(data?'Notificação de teste enviada para a fila. Confira a Central de Notificações e a tela bloqueada.':'Já enviamos um teste neste minuto. Tente novamente mais tarde.');
 }
 const missingInstall=onIos&&!installed;
 return <section className="he-push-settings">
   <div className="he-push-header">
    <div className="he-push-symbol"><Smartphone size={24}/></div>
    <div><h3>Notificações no iPhone e em outros aparelhos</h3><p>Receba seus avisos na tela bloqueada, mesmo com o Hora Extra fechado.</p></div>
   </div>
   <div className="he-push-device-state">
    <div className="he-push-state-copy"><span className={'he-push-state-indicator '+(enabled?'enabled':'')}/>
     <div><strong>{loading?'Verificando aparelho…':enabled?'Push ativado neste aparelho':permission==='denied'?'Notificações bloqueadas':missingInstall?'Instale o aplicativo na Tela de Início':'Push não ativado'}</strong>
      <small>{enabled?'Você receberá os tipos de aviso que escolheu acima.':missingInstall?'Abra o site no Safari, toque em Compartilhar → Adicionar à Tela de Início e abra o ícone.':'As notificações internas continuarão funcionando normalmente.'}</small>
     </div>
    </div>
    <div className="he-push-action">
     {enabled?<button type="button" className="he-push-off" onClick={disable} disabled={busy||loading}><BellOff size={16}/>{busy?'Aguarde…':'Desativar neste espaço'}</button>:
      <button type="button" className="he-push-on" onClick={enable} disabled={busy||loading||!supported||missingInstall||permission==='denied'}><BellRing size={16}/>{busy?'Ativando…':'Ativar notificações'}</button>}
    </div>
   </div>
   {!supported&&<p className="he-push-instructions"><AlertCircle size={17}/> Seu navegador não oferece Web Push. No iPhone é necessário iOS 16.4 ou superior e o aplicativo adicionado à Tela de Início.</p>}
   {permission==='denied'&&<p className="he-push-instructions"><AlertCircle size={17}/> Altere a permissão em Ajustes → Notificações → Hora Extra no iPhone. Em outros navegadores, abra as configurações de permissão do site.</p>}
   {enabled&&<button className="he-push-test" type="button" disabled={testing||busy} onClick={sendTest}><Send size={16}/>{testing?'Enviando…':'Enviar uma notificação de teste'}</button>}
   {error&&<p role="alert" className="he-push-error">{error}</p>}
   {message&&<p role="status" className="he-push-success"><CheckCircle2 size={16}/>{message}</p>}
   <p className="he-push-disclaimer"><ShieldCheck size={16}/> As notificações são privadas e controladas por espaço. Você pode desativar este aparelho a qualquer momento.</p>
  </section>;
}