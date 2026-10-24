// Offline support for the installed Hesap app.
// Calculator pages: taken from the website when it answers within 3 s (so an uploaded update shows on the
// next open), otherwise from the copy saved on the phone. Icons and fonts: from the saved copy.
// To make phones re-download the icons or manifest after changing them, change CACHE (e.g. 'hesap-v2').
const CACHE = 'hesap-v1';
const CORE = ['./', './index.html', './Hesap%20EX.html', './Hesap%20Scientific.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mine = url.origin === location.origin;
  if (mine && (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/'))) e.respondWith(pageFirst(e));
  else if (mine || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(savedFirst(req));
});

async function pageFirst(e) {
  const req = e.request, cache = await caches.open(CACHE);
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  e.waitUntil(net.catch(() => {}));   // let a slow download finish and refresh the saved copy
  const slow = new Promise((_, fail) => setTimeout(() => fail(new Error('slow')), 3000));
  try {
    return await Promise.race([net, slow]);
  } catch (err) {
    const saved = await cache.match(req, { ignoreSearch: true });
    if (saved) return saved;
    return net.catch(async () => (await cache.match('./Hesap%20EX.html')) || Response.error());
  }
}
async function savedFirst(req) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(req);
  if (saved) return saved;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
