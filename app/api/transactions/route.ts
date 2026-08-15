import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { MIN_WITHDRAWAL_CENTS } from '@/lib/data';
import { sendFcmPushToUser, sendFcmPushToAdmin } from '@/lib/fcm-admin';

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

  // Schedule restriction (Monday to Friday or 7d/7, 8h to 21h)
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Porto-Novo',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
  const hourStr = parts.find(p => p.type === 'hour')?.value;
  const hour = parseInt(hourStr || '0', 10);

  // Check if weekend withdrawal restriction is lifted in admin settings
  const { data: weekendCfg } = await db
    .from('bot_payment_configs')
    .select('is_active')
    .eq('bot_id', 'GLOBAL_WITHDRAWAL_WEEKEND')
    .maybeSingle();

  const allowWeekend = weekendCfg?.is_active === true;

  if (!allowWeekend && (weekday === 'Sat' || weekday === 'Sun')) {
    return NextResponse.json({ error: 'Les retraits ne sont pas possibles les week-ends.' }, { status: 400 });
  }
  if (hour < 8 || hour >= 21) {
    return NextResponse.json({
      error: allowWeekend
        ? 'Les retraits sont uniquement ouverts de 08h à 21h.'
        : 'Les retraits sont uniquement ouverts du Lundi au Vendredi, de 08h à 21h.'
    }, { status: 400 });
  }

  const { data: user } = await db
    .from('users')
    .select('balance_cents')
    .eq('id', payload.sub)
    .single();

  if (!user || user.balance_cents < amountCents) {
    return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });
  }

  const newBalance = user.balance_cents - amountCents;
  
  // Update with condition to prevent race condition if balance changed
  const { data: updateData, error: updateError } = await db
    .from('users')
    .update({ balance_cents: newBalance })
    .eq('id', payload.sub)
    .gte('balance_cents', amountCents)
    .select();

  if (updateError || !updateData || updateData.length === 0) {
     return NextResponse.json({ error: 'Erreur lors du retrait, veuillez réessayer' }, { status: 409 });
  }

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

  const formattedAmount = `${(amountCents / 100).toLocaleString('fr-BJ')} XOF`;

  // Notifications FCM Push (Client & Admin)
  sendFcmPushToUser(payload.sub, {
    title: '💸 Demande de retrait soumise',
    body: `Votre demande de retrait de ${formattedAmount} via ${provider} (${phone}) est en cours de traitement.`,
    url: '/account',
  }).catch(err => console.error('FCM Withdrawal push error:', err));

  sendFcmPushToAdmin({
    title: `💸 Nouveau Retrait (${formattedAmount})`,
    body: `Client: ${payload.phone || 'Client'} | ${provider}: ${phone}`,
    url: '/admin?tab=withdrawals',
  }).catch(err => console.error('FCM Admin withdrawal push error:', err));

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
