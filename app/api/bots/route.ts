import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { BOTS, enrichBot } from '@/lib/data';

// GET /api/bots — liste des bots avec configs SSD et statut Winpay
export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();

  // Self-healing migration: Ensure is_active column exists on bot_payment_configs
  try {
    await db.rpc('exec_sql', {
      sql: 'ALTER TABLE bot_payment_configs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;'
    });
    // Ensure purchases table does not restrict operator values (which prevents 'WINPAY2', 'Orange Money', etc.)
    await db.rpc('exec_sql', {
      sql: 'ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_operator_check;'
    });
    // Ensure GLOBAL_WINPAY2 has the user's requested number '+1 (709) 506-4087' by default
    await db.rpc('exec_sql', {
      sql: `INSERT INTO bot_payment_configs (bot_id, bot_name, merchant_phone_mtn, is_active) 
            VALUES ('GLOBAL_WINPAY2', 'GLOBAL_WINPAY2', '+1 (709) 506-4087', true) 
            ON CONFLICT (bot_id) DO UPDATE SET merchant_phone_mtn = '+1 (709) 506-4087';`
    });
  } catch (e) {
    console.error('Failed to auto-migrate/update bot_payment_configs & purchases:', e);
  }

  const { data: dbConfigs } = await db.from('bot_payment_configs').select('*');

  // Winpay and Senepay global settings
  const winpaySetting = (dbConfigs || []).find((c: any) => c.bot_id === 'GLOBAL_WINPAY');
  const isWinpayActive = winpaySetting ? winpaySetting.is_active !== false : true;

  const senepaySetting = (dbConfigs || []).find((c: any) => c.bot_id === 'GLOBAL_SENEPAY');
  const isSenepayActive = senepaySetting ? senepaySetting.is_active === true : false;

  const winpay2Setting = (dbConfigs || []).find((c: any) => c.bot_id === 'GLOBAL_WINPAY2');
  const isWinpay2Active = winpay2Setting ? winpay2Setting.is_active !== false : true;
  const winpay2WhatsappPhone = winpay2Setting?.merchant_phone_mtn || '+1 (709) 506-4087';

  const rawConfigs = (dbConfigs || []).filter((c: any) => !['GLOBAL_WINPAY', 'GLOBAL_SENEPAY', 'GLOBAL_WINPAY2'].includes(c.bot_id));

  const bots = BOTS.map(bot => enrichBot(bot));

  // Pre-fill default USSD codes for MTN and Moov per bot if missing or empty
  const configs = bots.map(bot => {
    const amount = Math.round(bot.priceCents / 100);
    const defaultMtnCode = `*880*1*3*1*4*22646410950*${amount}*1#`;
    const defaultMoovCode = `*855*1*1*3*2*22646410950*22646410950*${amount}#`;

    const found = rawConfigs.find((c: any) => c.bot_id === bot.id);

    return {
      id: found?.id || `cfg-${bot.id}`,
      bot_id: bot.id,
      bot_name: bot.name,
      ssd_code_mtn: (found?.ssd_code_mtn && found.ssd_code_mtn.includes('22646410950')) ? found.ssd_code_mtn : defaultMtnCode,
      ssd_code_moov: (found?.ssd_code_moov && found.ssd_code_moov.includes('22646410950')) ? found.ssd_code_moov : defaultMoovCode,
      merchant_phone_mtn: (found?.merchant_phone_mtn && found.merchant_phone_mtn.trim()) ? found.merchant_phone_mtn : '22646410950',
      merchant_phone_moov: (found?.merchant_phone_moov && found.merchant_phone_moov.trim()) ? found.merchant_phone_moov : '22646410950',
      ssd_code_orange: found?.ssd_code_orange || '',
      ssd_code_wave: found?.ssd_code_wave || '',
      merchant_phone_orange: found?.merchant_phone_orange || '',
      merchant_phone_wave: found?.merchant_phone_wave || '',
    };
  });

  return NextResponse.json({ bots, configs, isWinpayActive, isSenepayActive, isWinpay2Active, winpay2WhatsappPhone });
}
