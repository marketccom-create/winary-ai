import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Configuration Firebase Client pour Winary AI (projet : winar-d7cc2)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || undefined,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'winar-d7cc2.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'winar-d7cc2',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'winar-d7cc2.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '108106858478676741285',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || undefined,
};

// Initialisation de l'application Firebase Client (Singleton)
export function getFirebaseApp() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

/**
 * Demande l'autorisation Push Notification et enregistre le Jeton FCM auprès de l'API WINARY AI
 */
export async function requestAndRegisterFcmToken(userId?: string, isAdmin: boolean = false): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('[FCM] Notifications non supportées sur ce navigateur');
      return null;
    }

    const supported = await isSupported();
    if (!supported) {
      console.log('[FCM] Firebase Messaging non supporté sur ce navigateur');
      return null;
    }

    const app = getFirebaseApp();
    if (!app) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Permission de notification refusée');
      return null;
    }

    const messaging = getMessaging(app);
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BD2O59Urs-BDnsbCldGDtLC9FVPifLxzXqIKH9nM5i3UqK7Kro9betAl_YZV8b5U2-ijkd6_hzYn2Xw7fKdQSYE';

    // Enregistrement du Service Worker
    let swRegistration: ServiceWorkerRegistration | undefined = undefined;
    if ('serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => undefined);
    }

    const fcmToken = await getToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (fcmToken) {
      console.log('[FCM] Jeton FCM obtenu avec succès :', fcmToken.slice(0, 18) + '...');
      
      // Enregistrement du token côté serveur
      await fetch('/api/fcm/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fcmToken,
          userId,
          isAdmin,
          userAgent: navigator.userAgent,
        }),
      }).catch(err => console.error('[FCM] Erreur enregistrement jeton serveur:', err));

      return fcmToken;
    }
  } catch (error) {
    console.error('[FCM Erreur]:', error);
  }
  return null;
}

/**
 * Écouteur de messages Push en premier plan (Foreground Notifications)
 */
export async function listenToForegroundFcmMessages(callback: (payload: any) => void) {
  try {
    if (typeof window === 'undefined') return;
    const supported = await isSupported();
    if (!supported) return;

    const app = getFirebaseApp();
    if (!app) return;

    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      console.log('[FCM Foreground Message]:', payload);
      callback(payload);
    });
  } catch (err) {
    console.warn('[FCM Foreground Error]:', err);
  }
}
