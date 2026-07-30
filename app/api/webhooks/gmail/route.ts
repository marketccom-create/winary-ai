import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { REFERRAL_RATE } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/gmail — Reçoit les notifications d'emails MyTouchPoint (succès de paiement)
 * et active automatiquement le bot du client sans intervention humaine.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const secret = req.headers.get('x-gmail-secret') || body.secret || '';
    
    // Contenu de l'email transmis (Titre, corps, expediteur)
    const emailSubject = (body.subject || body.title || '').toString();
    const emailBody = (body.body || body.content || body.text || JSON.stringify(body)).toString();
    const sender = (body.from || body.sender || '').toString();

    console.log(`[Gmail Webhook Received]: Subject="${emailSubject}", Sender="${sender}"`);

    // Vérification du mot de clé MyTouchPoint ou Transfert
    const isTouchPoint = 
      emailSubject.toLowerCase().includes('touchpoint') || 
      emailBody.toLowerCase().includes('touchpoint') ||
      emailSubject.toLowerCase().includes('transfert') ||
      sender.toLowerCase().includes('touchpoint');

    if (!isTouchPoint && !body.force) {
      return NextResponse.json({ message: 'Email ignoré (non MyTouchPoint)' }, { status: 200 });
    }

    // Extraction des numéros de téléphone (formats 8 ou 10 chiffres Bénin/BFA)
    const phoneMatches = emailBody.match(/(?:229|226)?\d{8,10}/g) || [];
    const db = createAdminClient();

    // Recherche des achats en attente (status = PENDING)
    const { data: pendingPurchases } = await db
      .from('purchases')
      .select('*, users(id, referred_by_id, phone, first_name, last_name)')
      .eq('status', 'PENDING')
      .order('purchased_at', { ascending: false });

    if (!pendingPurchases || pendingPurchases.length === 0) {
      return NextResponse.json({ message: 'Aucun achat en attente' }, { status: 200 });
    }

    let matchedPurchase = null;

    // Tentative de correspondance entre le numéro de téléphone dans l'email et le client
    for (const p of pendingPurchases) {
      const clientPhoneRaw = (p.users as any)?.phone || '';
      const clientPhoneClean = clientPhoneRaw.replace(/[^0-9]/g, '');

      for (const match of phoneMatches) {
        const matchClean = match.replace(/[^0-9]/g, '');
        if (
          clientPhoneClean.includes(matchClean) || 
          matchClean.includes(clientPhoneClean) ||
          (matchClean.length >= 8 && clientPhoneClean.endsWith(matchClean.slice(-8)))
        ) {
          matchedPurchase = p;
          break;
        }
      }
      if (matchedPurchase) break;
    }

    // Si aucune correspondance par numéro, prendre le plus récent achat PENDING si l'email confirme le succès
    if (!matchedPurchase && (emailBody.toLowerCase().includes('réussi') || emailBody.toLowerCase().includes('succès'))) {
      matchedPurchase = pendingPurchases[0];
    }

    if (!matchedPurchase) {
      return NextResponse.json({ message: 'Aucun achat PENDING correspondant trouvé' }, { status: 200 });
    }

    // 1. Activer le bot
    await db.from('purchases')
      .update({
        status: 'ACTIVE',
        tx_reference: `${matchedPurchase.tx_reference || ''} [Validé via Gmail API ${new Date().toLocaleTimeString('fr-FR')}]`
      })
      .eq('id', matchedPurchase.id);

    // 2. Marquer la transaction comme COMPLETED
    await db.from('transactions')
      .update({ status: 'COMPLETED' })
      .eq('user_id', matchedPurchase.user_id)
      .eq('type', 'BOT_PURCHASE')
      .eq('tx_reference', matchedPurchase.tx_reference);

    // 3. Verser la commission de parrainage (35%) au parrain
    const buyer = matchedPurchase.users as any;
    if (buyer?.referred_by_id) {
      const commission = Math.floor(matchedPurchase.price_paid_cents * REFERRAL_RATE);
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
          description: `Commission parrainage (${buyer.phone}) - Auto Gmail`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `🎉 Bot ${matchedPurchase.bot_name} activé automatiquement pour ${buyer?.phone || 'le client'} via Gmail API !`,
      purchaseId: matchedPurchase.id
    });
  } catch (error: any) {
    console.error('[Gmail Webhook Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ACTIVE',
    service: 'Gmail API / Webhook Auto-Approve Listener',
    time: new Date().toISOString()
  });
}
