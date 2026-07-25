import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// POST /api/admin/broadcast — Envoyer un message Support + Notification Push Pop-up à TOUS les utilisateurs
export async function POST(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { title, message } = await req.json();

  if (!message || !message.trim()) {
    return NextResponse.json({ error: 'Le contenu du message est obligatoire.' }, { status: 400 });
  }

  const db = createAdminClient();
  const trimmedMsg = message.trim();
  const msgTitle = title?.trim() || '📢 Message Important';

  // 1. Récupérer tous les utilisateurs
  const { data: users, error: usersErr } = await db.from('users').select('id');
  if (usersErr) {
    return NextResponse.json({ error: usersErr.message }, { status: 500 });
  }

  // 2. Insérer le message de support dans le chat de chaque utilisateur
  if (users && users.length > 0) {
    const supportInserts = users.map(u => ({
      user_id: u.id,
      sender_role: 'ADMIN',
      content: trimmedMsg,
      is_read: false,
    }));

    const { error: batchErr } = await db.from('support_messages').insert(supportInserts);
    if (batchErr) {
      console.error('Erreur lors de l\'insertion des messages support de masse:', batchErr);
    }
  }

  // 3. Créer une notification Pop-up active (Announcement) pour affichage immédiat à l'écran
  const { error: annErr } = await db.from('announcements').insert({
    title: msgTitle,
    content: trimmedMsg,
    cta_label: '💬 Ouvrir le Support',
    cta_url: '/account',
    header_color: 'linear-gradient(135deg, #1A56DB, #7C3AED)',
    is_active: true,
  });

  if (annErr) {
    console.error('Erreur lors de la création de la notification pop-up:', annErr);
  }

  return NextResponse.json({
    success: true,
    recipientCount: users?.length || 0,
    message: `Message diffusé avec succès à ${users?.length || 0} utilisateur(s) via Chat Support et Notification Pop-up !`
  });
}
