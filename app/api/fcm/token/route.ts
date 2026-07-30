import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// Memory fallback store in case Supabase table fcm_tokens is pending creation
export const memoryFcmTokens: Map<string, { fcmToken: string; userId?: string; isAdmin?: boolean; updatedAt: Date }> = new Map();

// POST /api/fcm/token — Enregistrer un jeton FCM Push
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fcmToken, userId, isAdmin, userAgent } = body;

    if (!fcmToken) {
      return NextResponse.json({ error: 'Jeton FCM manquant' }, { status: 400 });
    }

    // 1. Enregistrement en mémoire (Backup haute disponibilité)
    memoryFcmTokens.set(fcmToken, {
      fcmToken,
      userId,
      isAdmin: Boolean(isAdmin),
      updatedAt: new Date(),
    });

    // 2. Enregistrement dans Supabase SQL table `fcm_tokens`
    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.from('fcm_tokens').upsert(
        {
          fcm_token: fcmToken,
          user_id: userId || null,
          is_admin: Boolean(isAdmin),
          user_agent: userAgent || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'fcm_token' }
      );
    } catch (dbErr) {
      console.warn('[FCM Token API] Sauvegarde DB échouée, jeton conservé en mémoire fallback:', dbErr);
    }

    return NextResponse.json({ success: true, message: 'Jeton FCM enregistré avec succès' });
  } catch (error: any) {
    console.error('[FCM Token API Error]:', error);
    return NextResponse.json({ error: error.message || 'Erreur enregistrement token' }, { status: 500 });
  }
}
