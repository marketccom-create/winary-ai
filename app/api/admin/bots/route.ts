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

  const configs = await req.json();
  if (!Array.isArray(configs)) {
    return NextResponse.json({ error: 'Format invalide' }, { status: 400 });
  }

  const db = createAdminClient();
  for (const cfg of configs) {
    await db.from('bot_payment_configs').upsert({
      bot_id: cfg.botId,
      bot_name: cfg.botName,
      ssd_code_mtn: cfg.ssdCodeMTN,
      ssd_code_moov: cfg.ssdCodeMoov,
      merchant_phone_mtn: cfg.merchantPhoneMTN,
      merchant_phone_moov: cfg.merchantPhoneMoov,
    }, { onConflict: 'bot_id' });
  }

  return NextResponse.json({ success: true });
}
