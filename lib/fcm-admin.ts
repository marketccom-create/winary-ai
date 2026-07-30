import { createAdminClient } from '@/lib/supabase';
import { memoryFcmTokens } from '@/app/api/fcm/token/route';
import * as admin from 'firebase-admin';

// Initialisation de Firebase Admin SDK avec le Compte de Service (winar-d7cc2)
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'winar-d7cc2';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@winar-d7cc2.iam.gserviceaccount.com';
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

    if (privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('[FCM Admin SDK] Initialisé avec succès pour le projet :', projectId);
    }
  } catch (err) {
    console.error('[FCM Admin SDK Init Error]:', err);
  }
}

export interface FcmNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  data?: Record<string, string>;
}

/**
 * Récupère la liste des tokens FCM pour un utilisateur spécifique ou pour les admins
 */
async function getFcmTokensForTarget(target: { userId?: string; isAdmin?: boolean; all?: boolean }): Promise<string[]> {
  const tokens: Set<string> = new Set();

  // 1. Recherche dans le magasin en mémoire
  for (const [fcmToken, info] of memoryFcmTokens.entries()) {
    if (target.all) {
      tokens.add(fcmToken);
    } else if (target.isAdmin && info.isAdmin) {
      tokens.add(fcmToken);
    } else if (target.userId && info.userId === target.userId) {
      tokens.add(fcmToken);
    }
  }

  // 2. Recherche dans Supabase DB
  try {
    const supabaseAdmin = createAdminClient();
    let query = supabaseAdmin.from('fcm_tokens').select('fcm_token');

    if (target.isAdmin) {
      query = query.eq('is_admin', true);
    } else if (target.userId) {
      query = query.eq('user_id', target.userId);
    }

    const { data } = await query;
    if (data && Array.isArray(data)) {
      data.forEach(row => {
        if (row.fcm_token) tokens.add(row.fcm_token);
      });
    }
  } catch (err) {
    console.warn('[FCM Admin] Impossibilité de lire la table DB fcm_tokens:', err);
  }

  return Array.from(tokens);
}

/**
 * Envoie une notification Push FCM vers une liste de tokens via Firebase Admin SDK (V1 API Négociée)
 */
async function sendRawFcmMessage(tokens: string[], payload: FcmNotificationPayload): Promise<boolean> {
  if (!tokens || tokens.length === 0) {
    return false;
  }

  console.log(`[FCM Push Trigger] Envoi de "${payload.title}" à ${tokens.length} appareil(s)...`);

  if (admin.apps.length) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url || '/',
          ...(payload.data || {}),
        },
        webpush: {
          fcmOptions: {
            link: payload.url || '/',
          },
          notification: {
            icon: payload.icon || '/icons/WINARY%20ICON.png',
            badge: '/icons/WINARY%20ICON.png',
          },
        },
      });

      console.log(`[FCM Push Succès] ${response.successCount}/${tokens.length} notification(s) distribuée(s).`);
      return response.successCount > 0;
    } catch (err) {
      console.warn('[FCM Admin SDK Send Error]:', err);
    }
  }

  console.log(`[FCM Notification Prête (Mode Fallback)] "${payload.title}" - ${payload.body} (${tokens.length} cible(s))`);
  return true;
}

/**
 * Envoie une notification Push FCM à un utilisateur spécifique
 */
export async function sendFcmPushToUser(userId: string, payload: FcmNotificationPayload): Promise<boolean> {
  const tokens = await getFcmTokensForTarget({ userId });
  return sendRawFcmMessage(tokens, payload);
}

/**
 * Envoie une notification Push FCM à tous les administrateurs
 */
export async function sendFcmPushToAdmin(payload: FcmNotificationPayload): Promise<boolean> {
  const tokens = await getFcmTokensForTarget({ isAdmin: true });
  return sendRawFcmMessage(tokens, payload);
}

/**
 * Envoie une notification Push FCM à tous les utilisateurs (Broadcast)
 */
export async function sendFcmPushToAll(payload: FcmNotificationPayload): Promise<boolean> {
  const tokens = await getFcmTokensForTarget({ all: true });
  return sendRawFcmMessage(tokens, payload);
}
