/* South Street Connect — service worker (scope /connect).
 * Notifications for new messages and incoming calls. A call notification is
 * re-sent by the server every few seconds while it rings (sound + vibration,
 * like a phone), with "رد" / "رفض" buttons; "رفض" declines without opening the
 * app. Network first: the app always shows live data; offline, the last loaded
 * screen is used. */
const CACHE = 'ss-connect-v4'; // v4: drops a cached error page
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
  if (req.method !== 'GET' || req.mode !== 'navigate') return; // API calls, live stream, audio: straight to the network
  event.respondWith(
    fetch(req)
      .then(async (res) => {
        // Only a good page is kept; on an error (firewall, server restart) show the last good one.
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/connect', copy)).catch(() => undefined);
          return res;
        }
        return (await caches.match('/connect')) || res;
      })
      .catch(() => caches.match('/connect'))
  );
});

async function closeTag(tag) {
  const list = await self.registration.getNotifications({ tag });
  list.forEach((n) => n.close());
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'South Street Connect', body: event.data ? event.data.text() : '' };
  }

  // If the app is open and visible, it rings by itself: no notification needed for messages.
  const show = async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = windows.some((w) => w.visibilityState === 'visible' && w.url.includes('/connect'));

    if (data.kind === 'call-end') {
      await closeTag(data.tag);
      return self.registration.showNotification(data.title || 'مكالمة فائتة', {
        body: data.body || '',
        tag: `${data.tag}-missed`,
        icon: '/icons/connect-192.png',
        badge: '/icons/connect-192.png',
        dir: 'rtl',
        lang: 'ar',
        data: { url: data.url || '/connect' },
      });
    }

    if (data.kind === 'call') {
      return self.registration.showNotification(data.title || 'مكالمة واردة', {
        body: data.body || 'مكالمة صوتية واردة',
        tag: data.tag,
        renotify: true, // ring again on every repeat
        requireInteraction: true,
        silent: false,
        vibrate: [700, 300, 700, 300, 700, 300, 700, 300, 700],
        timestamp: Date.now(),
        icon: '/icons/connect-192.png',
        badge: '/icons/connect-192.png',
        dir: 'rtl',
        lang: 'ar',
        actions: [
          { action: 'answer', title: 'رد' },
          { action: 'decline', title: 'رفض' },
        ],
        data: { url: data.url || '/connect', callId: data.callId || '' },
      });
    }

    if (visible) return undefined;
    return self.registration.showNotification(data.title || 'South Street Connect', {
      body: data.body || '',
      tag: data.tag || 'ss-connect',
      renotify: true,
      vibrate: [120],
      icon: '/icons/connect-192.png',
      badge: '/icons/connect-192.png',
      dir: 'rtl',
      lang: 'ar',
      data: { url: data.url || '/connect' },
    });
  };
  event.waitUntil(show());
});

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const data = n.data || {};
  n.close();

  if (event.action === 'decline' && data.callId) {
    if (String(data.callId).startsWith('test-')) return; // ringing test: nothing to tell the server
    event.waitUntil(
      fetch('/api/connect/call', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', id: data.callId }),
      }).catch(() => undefined)
    );
    return;
  }

  let url = data.url || '/connect';
  if (data.callId) url = `/connect?call=${encodeURIComponent(data.callId)}${event.action === 'answer' ? '&answer=1' : ''}`;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('/connect') && 'focus' in client) {
          client.postMessage({ type: 'open', url, callId: data.callId || '', answer: event.action === 'answer' });
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
