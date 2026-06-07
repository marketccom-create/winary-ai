import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { BOTS, VALIDITY_DAYS } from '@/lib/data';

// GET /api/purchases — mes achats
export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();
  const { data, error } = await db
    .from('purchases')
    .select('*')
    .eq('user_id', payload.sub)
    .order('purchased_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Map snake_case → camelCase
  const purchases = (data || []).map(mapPurchase);
  return NextResponse.json({ purchases });
}

// POST /api/purchases — créer une commande en attente
export async function POST(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const { botId, operator, txReference } = await req.json();
  if (!botId || !operator) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }
  
  const finalTxRef = txReference?.trim() || 'Achat Direct';

  const bot = BOTS.find(b => b.id === botId);
  if (!bot) return NextResponse.json({ error: 'Bot introuvable' }, { status: 404 });

  const db = createAdminClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VALIDITY_DAYS * 24 * 3600 * 1000);

  const { data: purchase, error } = await db
    .from('purchases')
    .insert({
      user_id: payload.sub,
      bot_id: bot.id,
      bot_name: bot.name,
      price_paid_cents: bot.priceCents,
      purchased_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      total_earned_cents: 0,
      work_count: 0,
      status: 'PENDING',
      operator,
      tx_reference: finalTxRef,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create pending transaction
  await db.from('transactions').insert({
    user_id: payload.sub,
    type: 'BOT_PURCHASE',
    status: 'PENDING',
    amount_cents: -bot.priceCents,
    description: `Achat ${bot.name} (${operator}) - Réf: ${finalTxRef}`,
    operator,
    tx_reference: finalTxRef,
  });

  return NextResponse.json({ purchase: mapPurchase(purchase) }, { status: 201 });
}

function mapPurchase(p: any) {
  return {
    id: p.id,
    userId: p.user_id,
    botId: p.bot_id,
    botName: p.bot_name,
    pricePaidCents: p.price_paid_cents,
    purchasedAt: p.purchased_at,
    expiresAt: p.expires_at,
    lastWorkedAt: p.last_worked_at,
    nextAllowedAt: p.next_allowed_at,
    totalEarnedCents: p.total_earned_cents,
    workCount: p.work_count,
    status: p.status,
    operator: p.operator,
    txReference: p.tx_reference,
  };
}
