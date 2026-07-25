import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { BOTS, enrichBot } from '@/lib/data';

// GET /api/bots — liste des bots avec configs SSD et statut Winpay
export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();
  const { data: configs } = await db.from('bot_payment_configs').select('*');

  // Winpay status global setting
  const winpaySetting = (configs || []).find((c: any) => c.bot_id === 'GLOBAL_WINPAY');
  const isWinpayActive = winpaySetting ? winpaySetting.is_active !== false : true;

  const filteredConfigs = (configs || []).filter((c: any) => c.bot_id !== 'GLOBAL_WINPAY');

  const bots = BOTS.map(bot => enrichBot(bot));

  return NextResponse.json({ bots, configs: filteredConfigs, isWinpayActive });
}
