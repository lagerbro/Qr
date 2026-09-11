// Меняй номер версии при каждом обновлении файлов — иначе телефоны будут показывать старую копию
const CACHE = 'qr-v2';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Сначала кэш — работает без интернета
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request)));
});
