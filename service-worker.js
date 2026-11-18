const CACHE_NAME = "armaadha-pwa-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async url => {
      try { const r = await fetch(url, {cache:"reload"}); if (r.ok) await cache.put(url,r); } catch(e) {}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => (k.startsWith("b-arch-class-fund-") || k.startsWith("armaadha-pwa-")) && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const req=event.request, url=new URL(req.url);
  if(req.method!=="GET" || url.origin!==self.location.origin) return;
  event.respondWith((async()=>{
    try {
      const response=await fetch(req);
      if(response && response.ok && req.destination!=="document") {
        const cache=await caches.open(CACHE_NAME); cache.put(req,response.clone());
      }
      return response;
    } catch(e) {
      const cached=await caches.match(req); if(cached)return cached;
      const fallback=await caches.match("./index.html");
      if(req.mode==="navigate" && fallback)return fallback;
      throw e;
    }
  })());
});
