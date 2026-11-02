// Only the public offline notice and install icons are cached. Never cache sessions,
// the admin HTML, APIs, bookings, customer data or uploads.
const CACHE = 'mora-admin-shell-v2';
const SHELL = [
  '/admin-offline.html',
  '/pwa/mora-192.png',
  '/pwa/mora-512.png',
  '/pwa/mora-maskable-512.png',
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('mora-admin-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) => cache.match(event.request))
        .then((response) => response || fetch(event.request)),
    );
    return;
  }
  if (event.request.mode === 'navigate' && /^\/admin(?:\/|\?|$)/.test(url.pathname))
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match('/admin-offline.html')),
    );
});
