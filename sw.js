const C="zb-v16";const SHELL=["/","/sefarim","/meldungen","/zmanim","/more","/shiurim","/quiz","/info","/site.js?v=2","/styles.css?v=12","/home.css?v=14","/logo-sm.webp","/icon-192.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{const r=e.request,u=new URL(r.url);if(r.method!=="GET"||u.origin!==location.origin||u.pathname.startsWith("/api/"))return;
if(u.pathname.startsWith("/f/")){e.respondWith(caches.open(C).then(async c=>{const h=await c.match(r);if(h)return h;const n=await fetch(r);if(n.ok&&n.status===200&&!r.headers.get("range")&&/image/.test(n.headers.get("content-type")||""))c.put(r,n.clone());return n}));return}
e.respondWith(fetch(r).then(n=>{if(n.ok){const cp=n.clone();caches.open(C).then(c=>c.put(r,cp))}return n}).catch(()=>caches.match(r).then(h=>h||caches.match("/"))))});
