// Service Worker for Admin Web Push & Background Notifications (Android, iOS PWA, Windows)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle push notification events
self.addEventListener('push', (event) => {
  let data = { title: '💰 Nouveau Paiement Validé !', body: 'Un nouveau paiement a été validé.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Un nouveau bot a été activé avec succès !',
    icon: '/icons/WINARY%20ICON.png',
    badge: '/icons/WINARY%20ICON.png',
    vibrate: [300, 100, 300, 100, 400],
    tag: 'payment-notification',
    renotify: true,
    data: {
      url: data.url || '/admin',
    },
    actions: [
      { action: 'open', title: '👀 Ouvrir Admin' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '💰 Nouveau Paiement Validé !', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/admin');
      }
    })
  );
});
