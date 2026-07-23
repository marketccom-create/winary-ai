import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';
import { REFERRAL_RATE } from '@/lib/data';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// GET /api/admin/purchases — tous les achats avec téléphone user
export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = createAdminClient();
  const { data, error: dbErr } = await db
    .from('purchases')
    .select(`*, users(phone, first_name, last_name)`)
    .order('purchased_at', { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json(
    (data || []).map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      userPhone: p.users?.phone || 'Inconnu',
      userName: p.users?.first_name ? `${p.users.first_name} ${p.users.last_name || ''}`.trim() : '',
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
    }))
  );
}

// POST /api/admin/purchases — approuver ou rejeter
export async function POST(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { purchaseId, action, reason } = await req.json();
  if (!purchaseId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: purchase, error: findErr } = await db
    .from('purchases')
    .select('*, users(id, referred_by_id, phone)')
    .eq('id', purchaseId)
    .single();

  if (findErr || !purchase) {
    return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 });
  }
  if (purchase.status !== 'PENDING') {
    return NextResponse.json({ error: 'Cet achat n\'est pas en attente' }, { status: 400 });
  }

  if (action === 'approve') {
    await db.from('purchases').update({ status: 'ACTIVE' }).eq('id', purchaseId);
    await db.from('transactions')
      .update({ status: 'COMPLETED' })
      .eq('user_id', purchase.user_id)
      .eq('type', 'BOT_PURCHASE')
      .eq('tx_reference', purchase.tx_reference);

    // Referral commission
    const buyer = purchase.users as any;
    if (buyer?.referred_by_id) {
      const commission = Math.floor(purchase.price_paid_cents * REFERRAL_RATE);
      const { data: sponsor } = await db
        .from('users')
        .select('id, balance_cents')
        .eq('id', buyer.referred_by_id)
        .single();
      if (sponsor) {
        await db.from('users').update({
          balance_cents: sponsor.balance_cents + commission,
        }).eq('id', sponsor.id);
        await db.from('transactions').insert({
          user_id: sponsor.id,
          type: 'REFERRAL_BONUS',
          status: 'COMPLETED',
          amount_cents: commission,
          description: `Commission parrainage (${buyer.phone})`,
        });
      }
    }
  } else {
    // reject
    const reasonSuffix = reason?.trim() ? ` (Rejeté : ${reason.trim()})` : '';
    const newTxRef = (purchase.tx_reference || '') + reasonSuffix;

    await db.from('purchases')
      .update({ status: 'EXPIRED', tx_reference: newTxRef })
      .eq('id', purchaseId);

    await db.from('transactions')
      .update({ 
        status: 'FAILED',
        tx_reference: newTxRef,
        description: `Achat ${purchase.bot_name} (${purchase.operator}) - Réf: ${newTxRef}`
      })
      .eq('user_id', purchase.user_id)
      .eq('type', 'BOT_PURCHASE')
      .eq('tx_reference', purchase.tx_reference);
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/purchases — rejeter les demandes PENDING en attente (sauf les 3 plus récentes)
export async function DELETE(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const PROTECTED_COUNT = 3; // Les N plus récents sont protégés du rejet en masse

  const db = createAdminClient();

  // Récupérer tous les achats en attente, triés du plus récent au plus ancien
  const { data: pending, error: fetchErr } = await db
    .from('purchases')
    .select('id, user_id, bot_name, operator, tx_reference, purchased_at')
    .eq('status', 'PENDING')
    .order('purchased_at', { ascending: false }); // Plus récents en premier

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!pending || pending.length === 0) {
    return NextResponse.json({ success: true, count: 0, protected: 0 });
  }

  // Séparer : les PROTECTED_COUNT premiers sont protégés, le reste est rejeté
  const toProtect = pending.slice(0, PROTECTED_COUNT);
  const toReject  = pending.slice(PROTECTED_COUNT);

  if (toReject.length === 0) {
    return NextResponse.json({ success: true, count: 0, protected: toProtect.length });
  }

  const rejectNote = ' (Rejeté : Non abouti)';
  for (const p of toReject) {
    await db.from('purchases')
      .update({ status: 'EXPIRED', tx_reference: (p.tx_reference || '') + rejectNote })
      .eq('id', p.id);

    await db.from('transactions')
      .update({
        status: 'FAILED',
        description: `Achat ${p.bot_name} (${p.operator}) - Non abouti`,
      })
      .eq('user_id', p.user_id)
      .eq('type', 'BOT_PURCHASE')
      .eq('tx_reference', p.tx_reference);
  }

  return NextResponse.json({ success: true, count: toReject.length, protected: toProtect.length });
}

