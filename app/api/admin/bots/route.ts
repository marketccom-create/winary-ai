import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// GET /api/admin/bots — configs SSD
export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = createAdminClient();
  const { data } = await db.from('bot_payment_configs').select('*');
  return NextResponse.json(data || []);
}

// PUT /api/admin/bots — mettre à jour toutes les configs SSD
export async function PUT(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json();
  const configs = Array.isArray(body) ? body : body.configs;
  const isWinpayActive = Array.isArray(body) ? true : body.isWinpayActive;
  const isSenepayActive = Array.isArray(body) ? false : body.isSenepayActive;

  if (!Array.isArray(configs)) {
    return NextResponse.json({ error: 'Format invalide' }, { status: 400 });
  }

  const db = createAdminClient();
  for (const cfg of configs) {
    await db.from('bot_payment_configs').upsert({
      bot_id: cfg.botId,
      bot_name: cfg.botName,
      ssd_code_mtn: cfg.ssdCodeMTN || '',
      ssd_code_moov: cfg.ssdCodeMoov || '',
      merchant_phone_mtn: cfg.merchantPhoneMTN || '',
      merchant_phone_moov: cfg.merchantPhoneMoov || '',
      ...(cfg.ssdCodeOrange !== undefined ? { ssd_code_orange: cfg.ssdCodeOrange } : {}),
      ...(cfg.ssdCodeWave !== undefined ? { ssd_code_wave: cfg.ssdCodeWave } : {}),
      ...(cfg.merchantPhoneOrange !== undefined ? { merchant_phone_orange: cfg.merchantPhoneOrange } : {}),
      ...(cfg.merchantPhoneWave !== undefined ? { merchant_phone_wave: cfg.merchantPhoneWave } : {}),
    }, { onConflict: 'bot_id' });
  }

  if (isWinpayActive !== undefined) {
    await db.from('bot_payment_configs').upsert({
      bot_id: 'GLOBAL_WINPAY',
      bot_name: 'GLOBAL_WINPAY',
      is_active: isWinpayActive,
    }, { onConflict: 'bot_id' });
  }

  if (isSenepayActive !== undefined) {
    await db.from('bot_payment_configs').upsert({
      bot_id: 'GLOBAL_SENEPAY',
      bot_name: 'GLOBAL_SENEPAY',
      is_active: isSenepayActive,
    }, { onConflict: 'bot_id' });
  }

  const isWinpay2Active = body.isWinpay2Active;
  const winpay2WhatsappPhone = body.winpay2WhatsappPhone;
  if (isWinpay2Active !== undefined || winpay2WhatsappPhone !== undefined) {
    await db.from('bot_payment_configs').upsert({
      bot_id: 'GLOBAL_WINPAY2',
      bot_name: 'GLOBAL_WINPAY2',
      is_active: isWinpay2Active ?? true,
      merchant_phone_mtn: winpay2WhatsappPhone || '+1 (709) 506-4087',
    }, { onConflict: 'bot_id' });
  }

  const isWinpayOneActive = body.isWinpayOneActive;
  const winpayOneSlackWebhookUrl = body.winpayOneSlackWebhookUrl;
  const winpayOneDiscordWebhookUrl = body.winpayOneDiscordWebhookUrl;
  const winpayOneWhatsappPhone1 = body.winpayOneWhatsappPhone1 || body.winpayOneWhatsappPhone;
  const winpayOneWhatsappApiKey1 = body.winpayOneWhatsappApiKey1 || body.winpayOneWhatsappApiKey;
  const winpayOneWhatsappPhone2 = body.winpayOneWhatsappPhone2;
  const winpayOneWhatsappApiKey2 = body.winpayOneWhatsappApiKey2;
  const winpayOneWhatsappPhone3 = body.winpayOneWhatsappPhone3;
  const winpayOneWhatsappApiKey3 = body.winpayOneWhatsappApiKey3;

  if (
    isWinpayOneActive !== undefined ||
    winpayOneSlackWebhookUrl !== undefined ||
    winpayOneDiscordWebhookUrl !== undefined ||
    winpayOneWhatsappPhone1 !== undefined ||
    winpayOneWhatsappApiKey1 !== undefined ||
    winpayOneWhatsappPhone2 !== undefined ||
    winpayOneWhatsappApiKey2 !== undefined ||
    winpayOneWhatsappPhone3 !== undefined ||
    winpayOneWhatsappApiKey3 !== undefined
  ) {
    await db.from('bot_payment_configs').upsert({
      bot_id: 'GLOBAL_WINPAYONE',
      bot_name: 'GLOBAL_WINPAYONE',
      is_active: isWinpayOneActive ?? true,
      merchant_phone_mtn: winpayOneSlackWebhookUrl || '',
      merchant_phone_moov: winpayOneDiscordWebhookUrl || '',
      merchant_phone_orange: winpayOneWhatsappPhone1 || '',
      merchant_phone_wave: winpayOneWhatsappApiKey1 || '',
      ssd_code_orange: winpayOneWhatsappPhone2 || '',
      ssd_code_wave: winpayOneWhatsappApiKey2 || '',
      ssd_code_mtn: winpayOneWhatsappPhone3 || '',
      ssd_code_moov: winpayOneWhatsappApiKey3 || '',
    }, { onConflict: 'bot_id' });
  }

  return NextResponse.json({ success: true });
}
