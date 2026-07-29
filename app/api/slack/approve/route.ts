import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { REFERRAL_RATE } from '@/lib/data';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function generateToken(purchaseId: string): string {
  return crypto.createHash('md5').update(purchaseId + 'WINPAYONE_SECRET_2026').digest('hex');
}

// GET & POST /api/slack/approve — Valider ou rejeter un achat depuis le bouton Slack
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const purchaseId = searchParams.get('id');
  const action = searchParams.get('action');
  const token = searchParams.get('token');

  if (!purchaseId || !action || !['approve', 'reject'].includes(action)) {
    return new NextResponse('Paramètres invalides', { status: 400 });
  }

  const expectedToken = generateToken(purchaseId);
  if (token !== expectedToken) {
    return new NextResponse('Token de sécurité invalide', { status: 403 });
  }

  const db = createAdminClient();
  const { data: purchase, error: findErr } = await db
    .from('purchases')
    .select('*, users(id, referred_by_id, phone, first_name, last_name)')
    .eq('id', purchaseId)
    .single();

  if (findErr || !purchase) {
    return new NextResponse('Achat introuvable', { status: 404 });
  }

  if (purchase.status !== 'PENDING') {
    const isAlreadyActive = purchase.status === 'ACTIVE';
    return new NextResponse(renderHtmlResponse(
      isAlreadyActive ? '✅ Déjà Approuvé' : '⚠️ Déjà Traité',
      `Cet achat a déjà été ${isAlreadyActive ? 'approuvé et le bot est actif' : 'traité (statut : ' + purchase.status + ')'}.`,
      isAlreadyActive ? '#065F46' : '#991B1B'
    ), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (action === 'approve') {
    // 1. Activer l'achat du bot
    await db.from('purchases').update({ status: 'ACTIVE' }).eq('id', purchaseId);

    // 2. Marquer la transaction comme COMPLETED
    await db.from('transactions')
      .update({ status: 'COMPLETED' })
      .eq('user_id', purchase.user_id)
      .eq('type', 'BOT_PURCHASE')
      .eq('tx_reference', purchase.tx_reference);

    // 3. Commission parrainage s'il y a lieu
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

    return new NextResponse(renderHtmlResponse(
      '✅ Achat Approuvé avec Succès !',
      `Le bot <strong>${purchase.bot_name}</strong> a été activé instantanément pour le client (${buyer?.phone || 'Client'}).`,
      '#065F46'
    ), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  } else {
    // Rejet
    const newTxRef = (purchase.tx_reference || '') + ' (Rejeté via Slack)';
    await db.from('purchases')
      .update({ status: 'EXPIRED', tx_reference: newTxRef })
      .eq('id', purchaseId);

    await db.from('transactions')
      .update({ 
        status: 'FAILED',
        tx_reference: newTxRef,
        description: `Achat ${purchase.bot_name} (${purchase.operator}) - Rejeté via Slack`
      })
      .eq('user_id', purchase.user_id)
      .eq('type', 'BOT_PURCHASE')
      .eq('tx_reference', purchase.tx_reference);

    return new NextResponse(renderHtmlResponse(
      '⛔ Demande d\'achat Rejetée',
      `La demande d'activation pour le bot <strong>${purchase.bot_name}</strong> a été annulée.`,
      '#991B1B'
    ), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

export async function POST(req: Request) {
  // Support Slack Interactive Component Payload if configured in Slack App
  try {
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);
    const payloadStr = params.get('payload');
    if (!payloadStr) return NextResponse.json({ ok: true });

    const payload = JSON.parse(payloadStr);
    const actionValue = payload?.actions?.[0]?.value;
    if (actionValue) {
      const [action, purchaseId] = actionValue.split(':');
      if (purchaseId && action) {
        const secretToken = generateToken(purchaseId);
        const url = `${new URL(req.url).origin}/api/slack/approve?id=${purchaseId}&action=${action}&token=${secretToken}`;
        await fetch(url);
      }
    }
  } catch (e) {
    console.error('Slack POST payload error:', e);
  }
  return NextResponse.json({ text: "✅ Action Slack enregistrée avec succès." });
}

function renderHtmlResponse(title: string, message: string, bgColor: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0F172A;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: ${bgColor};
      padding: 36px 28px;
      border-radius: 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      max-width: 440px;
      width: 100%;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 12px; }
    p { font-size: 14px; opacity: 0.9; line-height: 1.5; margin: 0 0 24px; }
    .badge {
      background: rgba(255,255,255,0.2);
      color: white;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: 99px;
      font-size: 12px;
      display: inline-block;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${title.includes('Approuvé') ? '⚡' : '⛔'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="badge">WinpayOne — Notification Slack</div>
  </div>
</body>
</html>`;
}
