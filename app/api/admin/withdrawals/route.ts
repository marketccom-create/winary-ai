import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// GET /api/admin/withdrawals — lister les retraits en attente
export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = createAdminClient();
  const { data, error: dbErr } = await db
    .from('transactions')
    .select('*, users(phone)')
    .eq('type', 'WITHDRAWAL')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json(
    (data || []).map((t: any) => ({
      id: t.id,
      userId: t.user_id,
      userPhone: t.users?.phone || 'Inconnu',
      type: t.type,
      status: t.status,
      amountCents: t.amount_cents,
      description: t.description,
      operator: t.operator,
      txReference: t.tx_reference,
      createdAt: t.created_at,
    }))
  );
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
    const { data: user, error: userErr } = await db
      .from('users')
      .select('balance_cents')
      .eq('id', tx.user_id)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Utilisateur introuvable pour le remboursement' }, { status: 404 });
    }

    const refundAmount = Math.abs(tx.amount_cents);
    const newBalance = user.balance_cents + refundAmount;

    // Perform refund
    await db.from('users').update({ balance_cents: newBalance }).eq('id', tx.user_id);

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
