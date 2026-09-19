/* global self, URL */
// Push only: do not intercept requests or cache pages, API responses or private files.
self.addEventListener('push', event => {
  let message = {};
  try { message = event.data?.json() || {}; } catch { /* Display a fallback for malformed payloads. */ }
  event.waitUntil(self.registration.showNotification(typeof message.title === 'string' ? message.title : 'Madinaty Deals', {
    body: typeof message.body === 'string' ? message.body : 'New updates from Madinaty Deals',
    icon: '/madinaty-deals-newlogo1-transparent.png',
    tag: typeof message.tag === 'string' ? message.tag : undefined,
    data: { url: typeof message.url === 'string' ? message.url : '/' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  let target = new URL('/', self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || '/', self.location.origin);
    if (candidate.origin === self.location.origin && !candidate.username && !candidate.password) target = candidate;
  } catch { /* Open the homepage for invalid targets. */ }
  event.waitUntil(self.clients.openWindow(target.href));
});
