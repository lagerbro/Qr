// Стратегия: сначала сеть, потом кэш.
// Есть интернет — берём свежую версию с сайта и обновляем копию. Нет — открываем копию.
const CACHE = 'qr';
const SHARE = 'qr-share'; // сюда временно кладём то, что пришло через «Поделиться»
const FILES = ['./', './manifest.json', './icon-192.png', './icon-512.png'];
const TIMEOUT = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== SHARE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// «Поделиться» присылает POST с текстом и/или файлами. Сохраняем и открываем приложение.
async function handleShare(req) {
  const fd = await req.formData();
  const c = await caches.open(SHARE);
  for (const k of await c.keys()) await c.delete(k);
  const meta = { title: fd.get('title') || '', text: fd.get('text') || '', url: fd.get('url') || '', files: [] };
  let i = 0;
  for (const f of fd.getAll('files')) {
    if (!f || !f.size) continue;
    const key = 'f' + (i++);
    await c.put('./__share/' + key, new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream' } }));
    meta.files.push({ key, name: f.name || 'file', type: f.type || 'application/octet-stream' });
  }
  await c.put('./__share/meta', new Response(JSON.stringify(meta)));
  return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
}

const keyFor = req => req.mode === 'navigate' ? './' : req;

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method === 'POST' && url.pathname.endsWith('/share')) { e.respondWith(handleShare(req)); return; }
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok && res.type === 'basic') cache.put(keyFor(req), res.clone());
      return res;
    });
    const cached = await cache.match(keyFor(req), { ignoreSearch: true });
    if (!cached) return network;
    const timeout = new Promise(r => setTimeout(() => r(null), TIMEOUT));
    try { const res = await Promise.race([network, timeout]); if (res) return res; } catch (err) {}
    network.catch(() => {});
    return cached;
  })());
});
