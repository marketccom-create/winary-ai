import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';
import { BOTS, VALIDITY_DAYS } from '@/lib/data';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// POST /api/admin/users/[id]/grant-bot — octroyer manuellement un bot
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin(req);
  if (authError) return authError;

  const { id: userId } = await params;
  const { botId, reason } = await req.json();

  if (!botId) {
    return NextResponse.json({ error: 'ID du bot manquant' }, { status: 400 });
  }

  const bot = BOTS.find(b => b.id === botId);
  if (!bot) {
    return NextResponse.json({ error: 'Bot introuvable' }, { status: 404 });
  }

  const db = createAdminClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VALIDITY_DAYS * 24 * 3600 * 1000);

  // Vérifier si l'utilisateur existe
  const { data: user, error: userErr } = await db
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  // Create ACTIVE purchase
  const { data: purchase, error: purchaseErr } = await db
    .from('purchases')
    .insert({
      user_id: userId,
      bot_id: bot.id,
      bot_name: bot.name,
      price_paid_cents: bot.priceCents,
      purchased_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      total_earned_cents: 0,
      work_count: 0,
      status: 'ACTIVE',
      operator: 'MANUAL',
      tx_reference: `Admin Grant: ${reason || 'Problème SenePay'}`,
    })
    .select()
    .single();

  if (purchaseErr || !purchase) {
    return NextResponse.json({ error: purchaseErr?.message || 'Erreur création achat' }, { status: 500 });
  }

  // Create COMPLETED transaction for history
  await db.from('transactions').insert({
    user_id: userId,
    type: 'BOT_PURCHASE',
    status: 'COMPLETED',
    amount_cents: -bot.priceCents,
    description: `Achat ${bot.name} (Octroi Admin)`,
    operator: 'MANUAL',
    tx_reference: `Admin Grant: ${reason || 'Problème SenePay'}`,
  });

  return NextResponse.json({ success: true, purchase });
}
