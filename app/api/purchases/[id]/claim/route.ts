import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { workRevenueCents } from '@/lib/data';

// POST /api/purchases/[id]/claim — récolter les gains après 8h
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

  const now = new Date();
  
  if (!purchase.next_allowed_at || new Date(purchase.next_allowed_at) > now) {
    return NextResponse.json(
      { error: `Le travail n'est pas encore terminé.` },
      { status: 400 }
    );
  }

  const earned = workRevenueCents(purchase.price_paid_cents);

  // Try using the atomic RPC function
  const { data: rpcData, error: rpcError } = await db.rpc('claim_work', {
    p_user_id: payload.sub,
    p_purchase_id: purchaseId,
    p_earned_cents: earned
  });

  if (!rpcError && rpcData && rpcData.length > 0) {
    return NextResponse.json({
      earnedCents: rpcData[0].earned_cents,
      newBalanceCents: rpcData[0].new_balance_cents,
    });
  }

  // Fallback if RPC is not yet installed
  // Atomic update using optimistic locking to prevent double-claiming
  const { data: updatedPurchase, error: updateErr } = await db.from('purchases').update({
    last_worked_at: null,
    next_allowed_at: null,
    total_earned_cents: purchase.total_earned_cents + earned,
    work_count: purchase.work_count + 1,
  })
    .eq('id', purchaseId)
    .eq('next_allowed_at', purchase.next_allowed_at)
    .select()
    .single();

  if (updateErr || !updatedPurchase) {
    return NextResponse.json({ error: 'Déjà récolté ou conflit.' }, { status: 400 });
  }

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
  });
}
