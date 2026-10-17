/* ASTRAEON — service worker de la app instalada.
 * - Código (html/js/css): red primero, con copia en caché para jugar sin conexión.
 * - Modelos y texturas: caché primero; solo se vuelven a descargar si cambia la huella de activos.
 */
const params = new URL(self.location.href).searchParams;
const BUILD = params.get('b') || 'dev';
const ASSETS = params.get('a') || 'dev';
const CORE = `astraeon-core-${BUILD}`;
const HEAVY = `astraeon-assets-${ASSETS}`;
const HEAVY_RE = /\/(assets\/(models|models-m|textures)|previews|icons)\//;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CORE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest']).catch(() => undefined)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('astraeon-') && k !== CORE && k !== HEAVY) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // siempre a la red
  if (HEAVY_RE.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(HEAVY);
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(new Request(url.origin + url.pathname), res.clone()).catch(() => undefined);
      return res;
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(CORE);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) c.put(req, res.clone()).catch(() => undefined);
      return res;
    } catch {
      return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')) || Response.error();
    }
  })());
});
