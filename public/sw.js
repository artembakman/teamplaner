self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || 'Teamplaner';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Es gibt eine neue Mitteilung.',
    icon: '/teamplaner-icon-192-v4.png',
    badge: '/teamplaner-icon-192-v4.png',
    tag: data.id || 'teamplaner',
    data: { url: data.url || '/' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => client.url.startsWith(self.location.origin));
    if (existing) return existing.focus().then(client => client.navigate(target));
    return self.clients.openWindow(target);
  }));
});
