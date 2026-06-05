import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { BOTS, enrichBot } from '@/lib/data';

// GET /api/bots — liste des bots avec configs SSD
export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();
  const { data: configs } = await db.from('bot_payment_configs').select('*');

  const bots = BOTS.map(enrichBot);

  return NextResponse.json({ bots, configs: configs || [] });
}
