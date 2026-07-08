import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { BOTS, VALIDITY_DAYS, REFERRAL_RATE } from '@/lib/data';
import { createCheckoutSession } from '@/lib/senepay';

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

// POST /api/purchases — créer un achat (solde ou Sene-Pay)
export async function POST(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const { botId, operator, txReference } = await req.json();
  if (!botId || !operator) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const bot = BOTS.find(b => b.id === botId);
  if (!bot) return NextResponse.json({ error: 'Bot introuvable' }, { status: 404 });

  const db = createAdminClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VALIDITY_DAYS * 24 * 3600 * 1000);

  // ════════════════════════════════════════════════════════════════
  // OPTION 1: PAYMENT WITH ACCOUNT BALANCE
  // ════════════════════════════════════════════════════════════════
  if (operator === 'BALANCE') {
    // Check user balance
    const { data: user, error: userErr } = await db
      .from('users')
      .select('balance_cents')
      .eq('id', payload.sub)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    if (user.balance_cents < bot.priceCents) {
      return NextResponse.json({ error: 'Solde insuffisant pour cet achat' }, { status: 400 });
    }

    // Deduct balance
    const newBalance = user.balance_cents - bot.priceCents;
    await db
      .from('users')
      .update({ balance_cents: newBalance })
      .eq('id', payload.sub);

    // Create ACTIVE purchase
    const { data: purchase, error: purchaseErr } = await db
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
        status: 'ACTIVE',
        operator: 'BALANCE',
        tx_reference: 'Achat via Solde',
      })
      .select()
      .single();

    if (purchaseErr || !purchase) {
      return NextResponse.json({ error: purchaseErr?.message || 'Erreur création achat' }, { status: 500 });
    }

    // Create COMPLETED transaction
    await db.from('transactions').insert({
      user_id: payload.sub,
      type: 'BOT_PURCHASE',
      status: 'COMPLETED',
      amount_cents: -bot.priceCents,
      description: `Achat ${bot.name} (Solde)`,
      operator: 'BALANCE',
      tx_reference: 'Solde',
    });

    // Handle referral commission
    const { data: buyer, error: buyerErr } = await db
      .from('users')
      .select('referred_by_id, phone')
      .eq('id', payload.sub)
      .single();

    if (!buyerErr && buyer?.referred_by_id) {
      const commission = Math.floor(bot.priceCents * REFERRAL_RATE);
      const { data: sponsor } = await db
        .from('users')
        .select('id, balance_cents')
        .eq('id', buyer.referred_by_id)
        .single();

      if (sponsor) {
        await db
          .from('users')
          .update({ balance_cents: sponsor.balance_cents + commission })
          .eq('id', sponsor.id);

        await db.from('transactions').insert({
          user_id: sponsor.id,
          type: 'REFERRAL_BONUS',
          status: 'COMPLETED',
          amount_cents: commission,
          description: `Commission parrainage (${buyer.phone})`,
        });
      }
    }

    return NextResponse.json({
      purchase: mapPurchase(purchase),
      newBalanceCents: newBalance,
    }, { status: 201 });
  }

  // ════════════════════════════════════════════════════════════════
  // OPTION 2: PAYMENT WITH SENE-PAY CHECKOUT
  // ════════════════════════════════════════════════════════════════
  if (operator === 'SENEPAY') {
    // 1. Create a PENDING purchase in the DB
    const { data: purchase, error: purchaseErr } = await db
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
        operator: 'SENEPAY',
        tx_reference: 'Initialisation Sene-Pay',
      })
      .select()
      .single();

    if (purchaseErr || !purchase) {
      return NextResponse.json({ error: purchaseErr?.message || 'Erreur création achat' }, { status: 500 });
    }

    // 2. Create a PENDING transaction in the DB
    const { data: tx, error: txErr } = await db
      .from('transactions')
      .insert({
        user_id: payload.sub,
        type: 'BOT_PURCHASE',
        status: 'PENDING',
        amount_cents: -bot.priceCents,
        description: `Achat ${bot.name} (Sene-Pay)`,
        operator: 'SENEPAY',
        tx_reference: 'Initialisation Sene-Pay',
      })
      .select()
      .single();

    if (txErr || !tx) {
      // Clean up the purchase if transaction creation fails
      await db.from('purchases').delete().eq('id', purchase.id);
      return NextResponse.json({ error: txErr?.message || 'Erreur création transaction' }, { status: 500 });
    }

    // 3. Initiate Sene-Pay Checkout Session
    try {
      const host = req.headers.get('host') || 'winary-ai.vercel.app';
      const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
      const baseUrl = `${protocol}://${host}`;

      const session = await createCheckoutSession({
        amount: bot.priceCents / 100,
        currency: 'XOF',
        orderReference: purchase.id, // Use purchase UUID as order reference
        description: `Achat du robot ${bot.name}`,
        returnUrl: `${baseUrl}/products`,
        cancelUrl: `${baseUrl}/home`,
        webhookUrl: `${baseUrl}/api/webhooks/senepay`,
        metadata: {
          userId: payload.sub,
          purchaseId: purchase.id,
          transactionId: tx.id,
          type: 'BOT_PURCHASE',
        },
      });

      // 4. Update the references in both tables with session token
      await db
        .from('purchases')
        .update({ tx_reference: session.sessionToken })
        .eq('id', purchase.id);

      await db
        .from('transactions')
        .update({ tx_reference: session.sessionToken })
        .eq('id', tx.id);

      return NextResponse.json({
        purchase: mapPurchase(purchase),
        checkoutUrl: session.checkoutUrl,
      }, { status: 201 });
    } catch (senepayErr: any) {
      // Mark as FAILED
      await db
        .from('purchases')
        .update({ status: 'EXPIRED', tx_reference: `Échec Sene-Pay: ${senepayErr.message}` })
        .eq('id', purchase.id);

      await db
        .from('transactions')
        .update({ status: 'FAILED', description: `Échec Sene-Pay: ${senepayErr.message}` })
        .eq('id', tx.id);

      return NextResponse.json(
        { error: `Erreur Sene-Pay: ${senepayErr.message}` },
        { status: 500 }
      );
    }
  }

  // ════════════════════════════════════════════════════════════════
  // OPTION 3: MANUAL PAYMENTS (Backwards compatibility)
  // ════════════════════════════════════════════════════════════════
  const finalTxRef = txReference?.trim() || 'Achat Direct';

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
