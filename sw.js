// Service worker: deixa o app abrir sem internet (no campo).
// App e bibliotecas do Firebase ficam guardados; mapa, clima e dados vão direto pela rede
// (os dados do Firestore já têm cache próprio no aparelho).
const CACHE = 'pastejo-v1';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png']).catch(() => {})));
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const doApp = u.origin === self.location.origin;
  const firebaseSdk = u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/');
  if (!doApp && !firebaseSdk) return;
  if (doApp) { // rede primeiro (pega atualizações); sem sinal, usa a cópia guardada
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await Promise.race([fetch(e.request), new Promise((_, rej) => setTimeout(() => rej('lento'), 4000))]);
        if (r && r.ok) c.put(e.request, r.clone());
        return r;
      } catch (err) {
        return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('./index.html')) || Response.error();
      }
    })());
  } else { // SDK do Firebase (versão fixa): cache primeiro
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
  }
});
