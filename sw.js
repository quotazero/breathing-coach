// Service worker di Breathing Coach: funzionamento offline + notifiche push
const CACHE='bc-v0.9.7';
const CORE=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','favicon.png','about.html','privacy.html','centro.html','centro.webmanifest','qr.js'];
const CDN=['cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(CORE.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  const same=u.origin===location.origin;
  if(!same&&!CDN.includes(u.hostname))return;
  if(same&&u.pathname.endsWith('/admin.html'))return;
  if(r.mode==='navigate'){
    // pagina: rete per prima (max 4 s), poi copia salvata
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      try{
        const res=await Promise.race([fetch(r),new Promise((_,j)=>setTimeout(()=>j('t'),4000))]);
        if(res&&res.ok&&same){c.put(u.pathname.endsWith('.html')?u.pathname.split('/').pop():'index.html',res.clone()).catch(()=>{})}
        return res;
      }catch(_){
        return (await c.match(u.pathname.split('/').pop()||'index.html',{ignoreSearch:true}))||(await c.match('index.html'))||Response.error();
      }
    })());
    return;
  }
  // altre risorse: copia salvata subito, aggiornata in background
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const hit=await c.match(r,{ignoreSearch:same});
    const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone()).catch(()=>{});return res}).catch(()=>null);
    return hit||(await net)||Response.error();
  })());
});
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(_){d={body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'Breathing Coach',{
    body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',tag:'bc-reminder',data:{url:d.url||'./'}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'./';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){if('focus' in c)return c.focus()}
    return self.clients.openWindow(url)}));
});
