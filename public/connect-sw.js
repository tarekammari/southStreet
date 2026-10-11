/* South Street Connect — service worker (scope /connect).
 * Shows notifications for new messages and incoming calls, and opens the app
 * on tap. Network first: the app always shows live data; if the network is
 * down, the last loaded app screen is used. */
const CACHE = 'ss-connect-v1';
const SHELL = ['/connect', '/icons/connect-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return; // API calls, audio, scripts: straight to the network
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('/connect', copy)).catch(() => undefined);
        return res;
      })
      .catch(() => caches.match('/connect'))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'South Street Connect', body: event.data ? event.data.text() : '' };
  }
  const isCall = data.kind === 'call';
  event.waitUntil(
    self.registration.showNotification(data.title || 'South Street Connect', {
      body: data.body || '',
      tag: data.tag || 'ss-connect',
      renotify: true,
      requireInteraction: isCall,
      vibrate: isCall ? [600, 300, 600, 300, 600] : [120],
      icon: '/icons/connect-192.png',
      badge: '/icons/connect-192.png',
      dir: 'rtl',
      lang: 'ar',
      data: { url: data.url || '/connect' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/connect';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('/connect') && 'focus' in client) {
          client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
