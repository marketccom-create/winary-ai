import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { createCheckoutSession } from '@/lib/senepay';

export async function POST(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  try {
    const { amount } = await req.json();
    const amountNum = parseFloat(amount);

    if (isNaN(amountNum) || amountNum < 200) {
      return NextResponse.json(
        { error: 'Montant invalide (minimum 200 XOF)' },
        { status: 400 }
      );
    }

    const amountCents = Math.floor(amountNum * 100);

    // Determine the base URL dynamically based on the request host
    const host = req.headers.get('host') || 'winary.live';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const db = createAdminClient();

    // 1. Create a PENDING transaction in our DB
    const { data: tx, error: txError } = await db
      .from('transactions')
      .insert({
        user_id: payload.sub,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount_cents: amountCents,
        description: 'Recharge via Sene-Pay',
      })
      .select()
      .single();

    if (txError || !tx) {
      return NextResponse.json(
        { error: `Erreur lors de la création de la transaction: ${txError?.message}` },
        { status: 500 }
      );
    }

    // 2. Create the Sene-Pay Checkout Session
    try {
      const session = await createCheckoutSession({
        amount: amountNum,
        currency: 'XOF',
        orderReference: tx.id, // Use our transaction UUID as orderReference
        description: `Recharge de compte WINARY AI`,
        returnUrl: `${baseUrl}/home`,
        cancelUrl: `${baseUrl}/home`,
        webhookUrl: `${baseUrl}/api/webhooks/senepay`,
        metadata: {
          userId: payload.sub,
          transactionId: tx.id,
          type: 'DEPOSIT',
        },
      });

      // 3. Update the transaction with Sene-Pay's sessionToken as reference
      await db
        .from('transactions')
        .update({ tx_reference: session.sessionToken })
        .eq('id', tx.id);

      return NextResponse.json({
        checkoutUrl: session.checkoutUrl,
        sessionToken: session.sessionToken,
      });
    } catch (senepayErr: any) {
      // Rollback or mark transaction as FAILED
      await db
        .from('transactions')
        .update({ status: 'FAILED', description: `Échec initiation Sene-Pay: ${senepayErr.message}` })
        .eq('id', tx.id);

      return NextResponse.json(
        { error: `Erreur Sene-Pay: ${senepayErr.message}` },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
