import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyWebhookSignature } from '@/lib/senepay';
import { REFERRAL_RATE } from '@/lib/data';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-senepay-signature') || '';

  // 1. Verify the Sene-Pay signature
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const { event, status, orderReference, transactionId, metadata } = payload;

    // Check if the event is supported
    if (event !== 'checkout.session.completed' && event !== 'checkout.session.failed') {
      return NextResponse.json({ received: true, message: 'Événement non géré' });
    }

    const type = metadata?.type;
    const db = createAdminClient();

    if (event === 'checkout.session.completed') {
      // ════════════════════════════════════════════════════════════════
      // CASE 1: DEPOSIT (Recharge)
      // ════════════════════════════════════════════════════════════════
      if (type === 'DEPOSIT') {
        const txId = metadata?.transactionId || orderReference;

        // Fetch transaction to check if it's already processed
        const { data: tx, error: txErr } = await db
          .from('transactions')
          .select('*')
          .eq('id', txId)
          .single();

        if (txErr || !tx) {
          return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 });
        }

        if (tx.status === 'COMPLETED') {
          return NextResponse.json({ received: true, message: 'Déjà traité' });
        }

        // Update transaction status
        const { error: updateTxErr } = await db
          .from('transactions')
          .update({
            status: 'COMPLETED',
            tx_reference: transactionId, // Store Sene-Pay's transaction ID
          })
          .eq('id', txId);

        if (updateTxErr) {
          return NextResponse.json({ error: updateTxErr.message }, { status: 500 });
        }

        // Credit user balance
        const { data: user, error: userErr } = await db
          .from('users')
          .select('balance_cents')
          .eq('id', tx.user_id)
          .single();

        if (userErr || !user) {
          return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
        }

        const newBalance = user.balance_cents + tx.amount_cents;
        await db
          .from('users')
          .update({ balance_cents: newBalance })
          .eq('id', tx.user_id);

        return NextResponse.json({ received: true, message: 'Dépôt crédité' });
      }

      // ════════════════════════════════════════════════════════════════
      // CASE 2: BOT PURCHASE
      // ════════════════════════════════════════════════════════════════
      if (type === 'BOT_PURCHASE') {
        const purchaseId = metadata?.purchaseId;
        const txId = metadata?.transactionId;

        if (!purchaseId || !txId) {
          return NextResponse.json({ error: 'ID Achat/Transaction manquant dans les métadonnées' }, { status: 400 });
        }

        // Fetch purchase and user details
        const { data: purchase, error: purchaseErr } = await db
          .from('purchases')
          .select('*, users(id, referred_by_id, phone)')
          .eq('id', purchaseId)
          .single();

        if (purchaseErr || !purchase) {
          return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 });
        }

        if (purchase.status !== 'PENDING') {
          return NextResponse.json({ received: true, message: 'Achat déjà traité' });
        }

        // Update purchase and transaction status
        await db
          .from('purchases')
          .update({
            status: 'ACTIVE',
            tx_reference: `${purchase.tx_reference} / SenePay: ${transactionId}`,
          })
          .eq('id', purchaseId);

        await db
          .from('transactions')
          .update({
            status: 'COMPLETED',
            tx_reference: transactionId,
          })
          .eq('id', txId);

        // Calculate and grant referral commission
        const buyer = purchase.users as any;
        if (buyer?.referred_by_id) {
          const commission = Math.floor(purchase.price_paid_cents * REFERRAL_RATE);
          
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

        return NextResponse.json({ received: true, message: 'Achat activé et parrainage traité' });
      }
    } else if (event === 'checkout.session.failed') {
      // ════════════════════════════════════════════════════════════════
      // CASE 3: FAILED TRANSACTION
      // ════════════════════════════════════════════════════════════════
      if (type === 'DEPOSIT') {
        const txId = metadata?.transactionId || orderReference;
        await db
          .from('transactions')
          .update({ status: 'FAILED', description: 'Recharge échouée via Sene-Pay' })
          .eq('id', txId);
      } else if (type === 'BOT_PURCHASE') {
        const purchaseId = metadata?.purchaseId;
        const txId = metadata?.transactionId;

        if (purchaseId) {
          await db
            .from('purchases')
            .update({ status: 'EXPIRED', tx_reference: 'Échec paiement Sene-Pay' })
            .eq('id', purchaseId);
        }
        if (txId) {
          await db
            .from('transactions')
            .update({ status: 'FAILED', description: 'Achat bot échoué via Sene-Pay' })
            .eq('id', txId);
        }
      }

      return NextResponse.json({ received: true, message: 'Échec enregistré' });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur interne' }, { status: 500 });
  }
}
