/* Service worker: la app abre al instante y sin conexión (stale-while-revalidate).
   Al publicar cambios, sube VERSION para forzar la actualización. */
const VERSION = 'gfc-v1.1.1';
const ARCHIVOS = [
  './', 'index.html', 'styles.css', 'app.js', 'db.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Solo cacheamos GET de nuestro propio origen; el backend (Apps Script) va siempre por red.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const cacheada = await cache.match(req, { ignoreSearch: true });
      const red = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cacheada);
      return cacheada || red;
    })
  );
});
