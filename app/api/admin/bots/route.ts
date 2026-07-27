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
      merchant_phone_mtn: winpay2WhatsappPhone || '+1 (825) 927-8218',
    }, { onConflict: 'bot_id' });
  }

  return NextResponse.json({ success: true });
}
