import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { WORK_COOLDOWN_HOURS, workRevenueCents } from '@/lib/data';

// POST /api/purchases/[id]/work — activer un bot
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const { id: purchaseId } = await params;
  const db = createAdminClient();

  const { data: purchase, error } = await db
    .from('purchases')
    .select('*')
    .eq('id', purchaseId)
    .eq('user_id', payload.sub)
    .single();

  if (error || !purchase) {
    return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 });
  }
  if (purchase.status === 'EXPIRED') {
    return NextResponse.json({ error: 'Ce bot est expiré' }, { status: 400 });
  }
  if (purchase.status === 'PENDING') {
    return NextResponse.json({ error: 'Ce bot est en attente de validation' }, { status: 400 });
  }

  const now = new Date();
  if (purchase.next_allowed_at && new Date(purchase.next_allowed_at) > now) {
    const remaining = new Date(purchase.next_allowed_at).getTime() - now.getTime();
    return NextResponse.json(
      { error: `Revenez dans ${Math.ceil(remaining / 3600000)}h` },
      { status: 429 }
    );
  }

  const earned = workRevenueCents(purchase.price_paid_cents);
  const nextAllowedAt = new Date(now.getTime() + WORK_COOLDOWN_HOURS * 3600 * 1000);

  // Update purchase
  await db.from('purchases').update({
    last_worked_at: now.toISOString(),
    next_allowed_at: nextAllowedAt.toISOString(),
    total_earned_cents: purchase.total_earned_cents + earned,
    work_count: purchase.work_count + 1,
  }).eq('id', purchaseId);

  // Update user balance
  const { data: user } = await db
    .from('users')
    .select('balance_cents')
    .eq('id', payload.sub)
    .single();
  const newBalance = (user?.balance_cents || 0) + earned;
  await db.from('users').update({ balance_cents: newBalance }).eq('id', payload.sub);

  // Transaction
  await db.from('transactions').insert({
    user_id: payload.sub,
    type: 'WORK_EARNING',
    status: 'COMPLETED',
    amount_cents: earned,
    description: `Gains ${purchase.bot_name}`,
  });

  return NextResponse.json({
    earnedCents: earned,
    newBalanceCents: newBalance,
    nextAllowedAt: nextAllowedAt.toISOString(),
  });
}
