/* Hora Extra — minimal Web Push service worker. Does not cache pages or user data. */
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});

self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let data={};
    try{data=event.data?.json()||{};}catch{data={title:'Hora Extra',body:event.data?.text()||'Você tem um novo aviso.'};}
    const url=new URL(typeof data.url==='string'?data.url:'/',self.location.origin);
    const safeUrl=url.origin===self.location.origin?url.href:self.location.origin+'/';
    await self.registration.showNotification(String(data.title||'Hora Extra').slice(0,160),{
      body:String(data.body||'Você recebeu um novo aviso.').slice(0,600),
      icon:'/apple-icon.png',
      badge:'/icon.svg',
      tag:'he-'+(data.id||'notification'),
      renotify:false,
      data:{url:safeUrl}
    });
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const raw=event.notification.data?.url||'/';
    const url=new URL(raw,self.location.origin);
    const safeUrl=url.origin===self.location.origin?url.href:self.location.origin+'/';
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if(new URL(client.url).origin!==self.location.origin)continue;
      try{
        if('navigate' in client)await client.navigate(safeUrl);
        return await client.focus();
      }catch{/* a janela não pôde navegar: segue para abrir uma nova abaixo */}
    }
    if(self.clients.openWindow)return self.clients.openWindow(safeUrl);
  })());
});
