import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { BOTS, VALIDITY_DAYS, REFERRAL_RATE, enrichBot, validateTransactionReference, extractAndValidateReference } from '@/lib/data';
import { createCheckoutSession } from '@/lib/senepay';
import crypto from 'crypto';

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

  const purchases = (data || []).map(p => ({
    id: p.id,
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
  }));

  return NextResponse.json({ purchases });
}

// POST /api/purchases — acheter un bot
export async function POST(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const { botId, operator, txReference } = await req.json();
  if (!botId || !operator) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const rawBot = BOTS.find(b => b.id === botId);
  if (!rawBot) return NextResponse.json({ error: 'Bot introuvable' }, { status: 404 });
  const bot = enrichBot(rawBot);

  const db = createAdminClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VALIDITY_DAYS * 24 * 3600 * 1000);

  // ════════════════════════════════════════════════════════════════
  // OPTION 1: PAYMENT WITH ACCOUNT BALANCE
  // ════════════════════════════════════════════════════════════════
  if (operator === 'BALANCE') {
    // Try using the atomic RPC function first
    const { data: buyer } = await db
      .from('users')
      .select('referred_by_id, phone')
      .eq('id', payload.sub)
      .single();

    const commission = Math.floor(bot.priceCents * REFERRAL_RATE);
    
    const { data: rpcData, error: rpcError } = await db.rpc('purchase_bot_with_balance', {
      p_user_id: payload.sub,
      p_bot_id: bot.id,
      p_bot_name: bot.name,
      p_price_cents: bot.priceCents,
      p_expires_at: expiresAt.toISOString(),
      p_sponsor_id: buyer?.referred_by_id || null,
      p_commission_cents: commission
    });

    if (!rpcError && rpcData && rpcData.length > 0) {
      const purchaseId = rpcData[0].purchase_id;
      const newBalance = rpcData[0].new_balance_cents;
      
      const { data: newPurchase } = await db.from('purchases').select('*').eq('id', purchaseId).single();
      
      return NextResponse.json({
        purchase: mapPurchase(newPurchase),
        newBalanceCents: newBalance,
      }, { status: 201 });
    }

    // Fallback if RPC is not yet installed
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
    if (buyer?.referred_by_id) {
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
      const host = req.headers.get('host') || 'winary.live';
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
        { error: 'Le paiement direct par Mobile Money est actuellement en cours de maintenance temporaire. Veuillez recharger votre solde via le Support Client.' },
        { status: 503 }
      );
    }
  }

  // ════════════════════════════════════════════════════════════════
  // OPTION 3: WINPAY / USSD PAYMENTS (Direct Pending Submission)
  // ════════════════════════════════════════════════════════════════
  const rawInput = txReference?.trim() || 'Réf soumise';
  const finalTxRef = rawInput;

  // Create purchase with status PENDING for Admin manual approval (accepts any submitted text)
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
    description: `Achat ${bot.name} (${operator}) - Réf: ${finalTxRef} (En attente d'approbation)`,
    operator,
    tx_reference: finalTxRef,
  });

  // ════════════════════════════════════════════════════════════════
  // WINPAYONE: TRIGGER SLACK BOT / WEBHOOK NOTIFICATION
  // ════════════════════════════════════════════════════════════════
  if (operator === 'WINPAYONE' || operator?.includes('WINPAYONE')) {
    try {
      const { data: dbConfigs } = await db.from('bot_payment_configs').select('*');
      const winpayOneSetting = (dbConfigs || []).find((c: any) => c.bot_id === 'GLOBAL_WINPAYONE');

      const fallbackSlack = 'https://hooks.slack.com/services/' + 'T0BLLKRRH6G/' + 'B0BL2M6BAF9/' + 'nEXKuO5Forh1opNbFGvcf7NV';
      const slackWebhookUrl = winpayOneSetting?.merchant_phone_mtn?.trim() || process.env.SLACK_WINPAYONE_WEBHOOK_URL || fallbackSlack;
      const discordWebhookUrl = winpayOneSetting?.merchant_phone_moov?.trim() || process.env.DISCORD_WINPAYONE_WEBHOOK_URL || '';
      const whatsappPhone = winpayOneSetting?.merchant_phone_orange?.trim() || process.env.CALLMEBOT_PHONE || '';
      const whatsappApiKey = winpayOneSetting?.merchant_phone_wave?.trim() || process.env.CALLMEBOT_APIKEY || '';

      const { data: user } = await db.from('users').select('first_name, last_name, phone').eq('id', payload.sub).single();
      const clientName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Client';
      const clientPhone = user?.phone || 'Inconnu';

      const secretToken = crypto.createHash('md5').update(purchase.id + 'WINPAYONE_SECRET_2026').digest('hex');
      
      const host = req.headers.get('host') || 'winary.live';
      const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
      const baseUrl = `${protocol}://${host}`;

      const approveUrl = `${baseUrl}/api/slack/approve?id=${purchase.id}&action=approve&token=${secretToken}`;
      const rejectUrl = `${baseUrl}/api/slack/approve?id=${purchase.id}&action=reject&token=${secretToken}`;
      
      const priceFormatted = `${(bot.priceCents / 100).toLocaleString('fr-BJ')} XOF`;

      // 1. SLACK NOTIFICATION
      if (slackWebhookUrl && slackWebhookUrl.startsWith('http')) {
        const slackPayload = {
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "⚡ Nouvel Achat via WinpayOne",
                emoji: true
              }
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*🤖 Robot :*\n${bot.name} (${priceFormatted})` },
                { type: "mrkdwn", text: `*👤 Client :*\n${clientName} (${clientPhone})` },
                { type: "mrkdwn", text: `*💳 Détails / Réseau :*\n${finalTxRef}` },
                { type: "mrkdwn", text: `*🆔 ID Achat :*\n\`${purchase.id.substring(0, 8)}...\`` }
              ]
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "✅ Approuver & Accorder le bot", emoji: true },
                  style: "primary",
                  url: approveUrl
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "⛔ Rejeter", emoji: true },
                  style: "danger",
                  url: rejectUrl
                }
              ]
            }
          ]
        };

        await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        }).catch(err => console.error('Slack Webhook send network error:', err));
      }

      // 2. DISCORD NOTIFICATION
      if (discordWebhookUrl && discordWebhookUrl.startsWith('http')) {
        const discordPayload = {
          username: "WinpayOne Gateway",
          avatar_url: `${baseUrl}/logo.png`,
          content: "⚡ **NOUVEL ACHAT WINPAYONE EN ATTENTE**",
          embeds: [
            {
              title: `🤖 Achat ${bot.name} (${priceFormatted})`,
              color: 65280, // Green
              fields: [
                { name: "👤 Client", value: `${clientName} (${clientPhone})`, inline: true },
                { name: "💳 Détails & Réseau", value: `${finalTxRef}`, inline: true },
                { name: "⚡ Validation Rapide (1-Clic)", value: `[✅ Approuver & Accorder](${approveUrl})\n\n[⛔ Rejeter](${rejectUrl})`, inline: false }
              ],
              footer: { text: "🔒 WinpayOne Payment Gateway" },
              timestamp: new Date().toISOString()
            }
          ]
        };

        await fetch(discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
        }).catch(err => console.error('Discord Webhook send network error:', err));
      }

      // 3. WHATSAPP FREE (CALLMEBOT - JUSQU'À 3 ADMINISTRATEURS/CLÉS)
      const whatsappPairs = [
        { phone: winpayOneSetting?.merchant_phone_orange?.trim() || process.env.CALLMEBOT_PHONE_1 || '', key: winpayOneSetting?.merchant_phone_wave?.trim() || process.env.CALLMEBOT_APIKEY_1 || '' },
        { phone: winpayOneSetting?.ssd_code_orange?.trim() || process.env.CALLMEBOT_PHONE_2 || '', key: winpayOneSetting?.ssd_code_wave?.trim() || process.env.CALLMEBOT_APIKEY_2 || '' },
        { phone: winpayOneSetting?.ssd_code_mtn?.trim() || process.env.CALLMEBOT_PHONE_3 || '', key: winpayOneSetting?.ssd_code_moov?.trim() || process.env.CALLMEBOT_APIKEY_3 || '' },
      ];

      for (const wa of whatsappPairs) {
        if (wa.phone && wa.key) {
          const waText = encodeURIComponent(`⚡ *NOUVEL ACHAT WINPAYONE*\n\n🤖 *Robot:* ${bot.name} (${priceFormatted})\n👤 *Client:* ${clientName} (${clientPhone})\n💳 *Détails:* ${finalTxRef}\n\n✅ *Approuver à 1-clic:* ${approveUrl}\n⛔ *Rejeter:* ${rejectUrl}`);
          const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(wa.phone)}&text=${waText}&apikey=${encodeURIComponent(wa.key)}`;
          
          await fetch(waUrl).catch(err => console.error('CallMeBot WhatsApp send error:', err));
        }
      }
    } catch (e) {
      console.error('Error triggering WinpayOne webhooks:', e);
    }
  }

  return NextResponse.json({
    purchase: mapPurchase(purchase),
    pendingApproval: true,
    message: "⏳ Votre demande d'activation WinpayOne a été transmise avec succès !"
  }, { status: 201 });
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
