import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// GET /api/admin/withdrawals — lister tous les retraits avec éligibilité parrainage
export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = createAdminClient();
  const { data, error: dbErr } = await db
    .from('transactions')
    .select(`*, users(id, phone, first_name, last_name)`)
    .eq('type', 'WITHDRAWAL')
    .order('created_at', { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  // Pour chaque retrait, calculer le total des commissions de parrainage du user
  const enriched = await Promise.all(
    (data || []).map(async (t: any) => {
      const userId = t.user_id;

      const { data: commissions } = await db
        .from('transactions')
        .select('amount_cents')
        .eq('user_id', userId)
        .eq('type', 'REFERRAL_BONUS')
        .eq('status', 'COMPLETED');

      const commissionsCents = (commissions || []).reduce(
        (sum: number, c: any) => sum + (c.amount_cents || 0),
        0
      );

      const { count: approvedCount } = await db
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'WITHDRAWAL')
        .eq('status', 'COMPLETED');

      const { count: priorityBoostCount } = await db
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('bot_id', 'priority-boost')
        .eq('status', 'ACTIVE');

      return {
        id: t.id,
        userId,
        userPhone: t.users?.phone || 'Inconnu',
        userName: t.users?.first_name
          ? `${t.users.first_name} ${t.users.last_name || ''}`.trim()
          : '',
        type: t.type,
        status: t.status,
        amountCents: t.amount_cents,
        description: t.description,
        operator: t.operator,
        txReference: t.tx_reference,
        createdAt: t.created_at,
        commissionsCents,                    // Total commissions de parrainage
        isEligible: commissionsCents > 0,    // Éligible si au moins 1 filleul a acheté
        approvedWithdrawalsCount: approvedCount || 0, // Nombre de retraits déjà approuvés
        isPriorityBoost: (priorityBoostCount || 0) > 0, // VIP Priority Boost Actif
      };
    })
  );

  return NextResponse.json(enriched);
}


// POST /api/admin/withdrawals — approuver ou rejeter un retrait
export async function POST(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { transactionId, action, reason } = await req.json();
  if (!transactionId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const db = createAdminClient();

  // Fetch target transaction
  const { data: tx, error: findErr } = await db
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (findErr || !tx) {
    return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 });
  }

  if (tx.type !== 'WITHDRAWAL' || tx.status !== 'PENDING') {
    return NextResponse.json({ error: 'Cette transaction n\'est pas un retrait en attente' }, { status: 400 });
  }

  if (action === 'approve') {
    // Approve withdrawal -> COMPLETED
    const { error: updateErr } = await db
      .from('transactions')
      .update({ status: 'COMPLETED' })
      .eq('id', transactionId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  } else {
    // Reject withdrawal -> FAILED and Refund user balance
    const refundAmount = Math.abs(tx.amount_cents);

    // Perform refund using atomic RPC
    const { error: rpcError } = await db.rpc('increment_balance', {
      user_id: tx.user_id,
      amount_cents: refundAmount
    });

    if (rpcError) {
      // Fallback
      const { data: user, error: userErr } = await db
        .from('users')
        .select('balance_cents')
        .eq('id', tx.user_id)
        .single();

      if (userErr || !user) {
        return NextResponse.json({ error: 'Utilisateur introuvable pour le remboursement' }, { status: 404 });
      }

      const newBalance = user.balance_cents + refundAmount;
      await db.from('users').update({ balance_cents: newBalance }).eq('id', tx.user_id);
    }

    // Update transaction with status FAILED and rejection reason in description
    const reasonSuffix = reason?.trim() ? ` (Rejeté : ${reason.trim()})` : '';
    const newDesc = tx.description + reasonSuffix;

    const { error: updateErr } = await db
      .from('transactions')
      .update({ 
        status: 'FAILED',
        description: newDesc
      })
      .eq('id', transactionId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/withdrawals — supprimer un retrait rejeté de l'historique
export async function DELETE(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { transactionId } = await req.json();
  if (!transactionId) {
    return NextResponse.json({ error: 'transactionId manquant' }, { status: 400 });
  }

  const db = createAdminClient();

  // Vérifier que c'est bien un retrait FAILED avant suppression
  const { data: tx, error: findErr } = await db
    .from('transactions')
    .select('id, type, status')
    .eq('id', transactionId)
    .single();

  if (findErr || !tx) {
    return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 });
  }

  if (tx.type !== 'WITHDRAWAL' || tx.status !== 'FAILED') {
    return NextResponse.json({ error: 'Seuls les retraits rejetés peuvent être supprimés' }, { status: 400 });
  }

  const { error: deleteErr } = await db
    .from('transactions')
    .delete()
    .eq('id', transactionId);

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

