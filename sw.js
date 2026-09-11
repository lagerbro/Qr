// Стратегия: сначала сеть, потом кэш.
// Есть интернет — всегда берём свежую версию с сайта и обновляем копию в памяти.
// Нет интернета — открываем сохранённую копию. Номер версии менять больше не нужно.
const CACHE = 'qr';
const FILES = ['./', './manifest.json', './icon-192.png', './icon-512.png'];
const TIMEOUT = 3000; // если сеть тормозит дольше 3 с — открываем копию, чтобы не ждать

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // убираем кэши старых версий (qr-v1, qr-v2 ...)
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function keyFor(req) {
  // страница с параметрами (?text=... из «Поделиться») хранится как одна и та же страница
  return req.mode === 'navigate' ? './' : req;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(keyFor(req), res.clone());
      return res;
    });
    const cached = await cache.match(keyFor(req), { ignoreSearch: true });
    if (!cached) return network;                      // первого запуска без копии — только сеть
    const timeout = new Promise(r => setTimeout(() => r(null), TIMEOUT));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
    } catch (err) {}
    network.catch(() => {});                          // сеть не успела — копия, а обновление докачается в фоне
    return cached;
  })());
});
