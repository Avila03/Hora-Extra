'use client';
import {useCallback,useEffect,useRef,useState} from 'react';

export const defaultNotificationPreferences={
 assignments:true,reminders:true,events:true,shopping:false,
 stock:true,team:false,summaries:false
};

export function useNotificationInbox(supabase,workspaceId,userId){
 const [items,setItems]=useState([]);
 const [unread,setUnread]=useState(0);
 const [prefs,setPrefs]=useState(defaultNotificationPreferences);
 const [hasPrefs,setHasPrefs]=useState(false);
 const [loading,setLoading]=useState(true);
 const [loadingMore,setLoadingMore]=useState(false);
 const [hasMore,setHasMore]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const requestRef=useRef(0);

 const refresh=useCallback(async()=>{
  if(!supabase||!workspaceId||!userId)return;
  const request=++requestRef.current;
  const [n,p,c]=await Promise.all([
   supabase.from('notifications').select('id,workspace_id,user_id,actor_id,kind,title,body,entity_type,entity_id,event_id,created_at,read_at')
     .eq('workspace_id',workspaceId).eq('user_id',userId).order('created_at',{ascending:false}).range(0,99),
   supabase.from('notification_preferences')
     .select('assignments,reminders,events,shopping,stock,team,summaries')
     .eq('workspace_id',workspaceId).eq('user_id',userId).maybeSingle(),
   supabase.from('notifications').select('id',{count:'exact',head:true})
     .eq('workspace_id',workspaceId).eq('user_id',userId).is('read_at',null)
  ]);
  if(request!==requestRef.current)return;
  const problem=n.error||p.error||c.error;
  if(problem){setError(problem.message);setLoading(false);return;}
  setError('');
  setItems(n.data||[]);
  setHasMore((n.data||[]).length===100);
  setUnread(c.count||0);
  setPrefs({...defaultNotificationPreferences,...(p.data||{})});
  setHasPrefs(!!p.data);
  setLoading(false);
 },[supabase,workspaceId,userId]);

 useEffect(()=>{
  requestRef.current++;
  if(!supabase||!workspaceId||!userId){
   setItems([]);setUnread(0);setHasMore(false);setPrefs(defaultNotificationPreferences);
   setHasPrefs(false);setLoading(false);setError('');return;
  }
  setItems([]);setUnread(0);setHasMore(false);setPrefs(defaultNotificationPreferences);setHasPrefs(false);setLoading(true);
  refresh();
  // The database scheduler delivers reminders offline; this refresh also catches imminent ones.
  supabase.rpc('refresh_my_reminders',{p_workspace:workspaceId}).then(()=>refresh());
  const channel=supabase.channel('hora-extra-notify-'+workspaceId+'-'+userId)
    .on('postgres_changes',{event:'*',schema:'public',table:'notifications',
       filter:'user_id=eq.'+userId},payload=>{
         if(payload.new?.workspace_id===workspaceId||payload.old?.workspace_id===workspaceId)refresh();
       }).subscribe();
  const interval=setInterval(refresh,90000);
  const onVisible=()=>{if(document.visibilityState==='visible')refresh();};
  document.addEventListener('visibilitychange',onVisible);
  return ()=>{
   requestRef.current++;
   clearInterval(interval);
   document.removeEventListener('visibilitychange',onVisible);
   supabase.removeChannel(channel);
  };
 },[supabase,workspaceId,userId,refresh]);

 async function loadMore(){
  if(!supabase||!workspaceId||!userId||loadingMore||!hasMore)return;
  setLoadingMore(true);
  const offset=items.length;
  const {data,error:problem}=await supabase.from('notifications')
   .select('id,workspace_id,user_id,actor_id,kind,title,body,entity_type,entity_id,event_id,created_at,read_at')
   .eq('workspace_id',workspaceId).eq('user_id',userId)
   .order('created_at',{ascending:false}).range(offset,offset+99);
  setLoadingMore(false);
  if(problem){setError(problem.message);return;}
  setItems(previous=>{
   const known=new Set(previous.map(x=>x.id));
   return [...previous,...(data||[]).filter(x=>!known.has(x.id))];
  });
  setHasMore((data||[]).length===100);
 }
 async function markRead(item){
  if(!supabase||!workspaceId||!userId||!item||item.read_at)return true;
  const timestamp=new Date().toISOString();
  const {error:problem}=await supabase.from('notifications')
   .update({read_at:timestamp}).eq('id',item.id)
   .eq('workspace_id',workspaceId).eq('user_id',userId).is('read_at',null);
  if(problem){setError(problem.message);return false;}
  setItems(prev=>prev.map(n=>n.id===item.id?{...n,read_at:timestamp}:n));
  setUnread(prev=>Math.max(0,prev-1));
  return true;
 }
 async function markAllRead(){
  if(!supabase||!workspaceId||!userId||!unread)return true;
  const timestamp=new Date().toISOString();
  const {error:problem}=await supabase.from('notifications')
    .update({read_at:timestamp}).eq('workspace_id',workspaceId)
    .eq('user_id',userId).is('read_at',null);
  if(problem){setError(problem.message);return false;}
  setItems(prev=>prev.map(n=>n.read_at?n:{...n,read_at:timestamp}));
  setUnread(0);
  return true;
 }
 async function updatePreference(key,value){
  if(!supabase||!workspaceId||!userId||saving||!(key in defaultNotificationPreferences))return false;
  setSaving(true);setError('');
  const patch={[key]:!!value,updated_at:new Date().toISOString()};
  const request=hasPrefs
   ?supabase.from('notification_preferences').update(patch).eq('workspace_id',workspaceId)
     .eq('user_id',userId).select('user_id')
   :supabase.from('notification_preferences').insert({
      workspace_id:workspaceId,user_id:userId,...defaultNotificationPreferences,...patch
     }).select('user_id');
  const {error:problem,data}=await request;
  setSaving(false);
  if(problem||!data?.length){setError(problem?.message||'Não foi possível salvar suas preferências.');return false;}
  setPrefs(prev=>({...prev,[key]:!!value}));setHasPrefs(true);
  return true;
 }
 return {items,unread,prefs,loading,loadingMore,hasMore,saving,error,refresh,loadMore,markRead,markAllRead,updatePreference};
}
