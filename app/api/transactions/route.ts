import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { MIN_WITHDRAWAL_CENTS } from '@/lib/data';

// GET /api/transactions
export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();
  const { data, error } = await db
    .from('transactions')
    .select('*')
    .eq('user_id', payload.sub)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const transactions = (data || []).map(mapTx);
  return NextResponse.json({ transactions });
}

// POST /api/transactions — retrait
export async function POST(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const { amountCents, provider, phone } = await req.json();
  if (!amountCents || !provider || !phone) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }
  if (amountCents < MIN_WITHDRAWAL_CENTS) {
    return NextResponse.json({ error: 'Minimum 3 000 XOF' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: user } = await db
    .from('users')
    .select('balance_cents')
    .eq('id', payload.sub)
    .single();

  if (!user || user.balance_cents < amountCents) {
    return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });
  }

  const newBalance = user.balance_cents - amountCents;
  await db.from('users').update({ balance_cents: newBalance }).eq('id', payload.sub);

  const { data: tx, error } = await db
    .from('transactions')
    .insert({
      user_id: payload.sub,
      type: 'WITHDRAWAL',
      status: 'PENDING',
      amount_cents: -amountCents,
      description: `Retrait ${provider} vers ${phone}`,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transaction: mapTx(tx), newBalanceCents: newBalance });
}

function mapTx(t: any) {
  return {
    id: t.id,
    userId: t.user_id,
    type: t.type,
    status: t.status,
    amountCents: t.amount_cents,
    description: t.description,
    operator: t.operator,
    txReference: t.tx_reference,
    createdAt: t.created_at,
  };
}
