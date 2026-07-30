// Service Worker Firebase Messaging pour la réception en arrière-plan (PWA, Android, Desktop)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Configuration Firebase Service Worker (compat)
firebase.initializeApp({
  authDomain: "winar-d7cc2.firebaseapp.com",
  projectId: "winar-d7cc2",
  storageBucket: "winar-d7cc2.appspot.com",
  messagingSenderId: "108106858478676741285"
});

let messaging;
try {
  messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background Push reçu :', payload);

    const notificationTitle = payload.notification?.title || payload.data?.title || '⚡ WINARY AI Notification';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'Vous avez reçu une nouvelle mise à jour.',
      icon: payload.notification?.icon || payload.data?.icon || '/icons/WINARY%20ICON.png',
      badge: '/icons/WINARY%20ICON.png',
      vibrate: [200, 100, 200, 100, 300],
      tag: payload.data?.tag || 'winary-push',
      renotify: true,
      data: {
        url: payload.data?.url || '/'
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] FCM indisponible dans ce contexte', err);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
