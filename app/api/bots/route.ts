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
    // Ensure GLOBAL_SENEPAY is inactive by default
    await db.rpc('exec_sql', {
      sql: `INSERT INTO bot_payment_configs (bot_id, bot_name, is_active) 
            VALUES ('GLOBAL_SENEPAY', 'GLOBAL_SENEPAY', false) 
            ON CONFLICT (bot_id) DO UPDATE SET is_active = false;`
    });
    // Ensure ssd_payment_methods table exists for multi-country SSD payments
    await db.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ssd_payment_methods (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          country_name TEXT NOT NULL,
          country_code TEXT NOT NULL,
          country_prefix TEXT NOT NULL,
          country_flag TEXT NOT NULL DEFAULT '🌐',
          operator_id TEXT NOT NULL UNIQUE,
          operator_name TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT '💳',
          merchant_phone TEXT NOT NULL DEFAULT '',
          merchant_name TEXT NOT NULL DEFAULT '',
          deposit_instructions TEXT NOT NULL DEFAULT '',
          ssd_code_template TEXT NOT NULL DEFAULT '',
          payment_mode TEXT NOT NULL DEFAULT 'BOTH',
          requires_sms_paste BOOLEAN NOT NULL DEFAULT true,
          is_active BOOLEAN NOT NULL DEFAULT true,
          display_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        ALTER TABLE ssd_payment_methods ADD COLUMN IF NOT EXISTS merchant_name TEXT NOT NULL DEFAULT '';
        ALTER TABLE ssd_payment_methods ADD COLUMN IF NOT EXISTS deposit_instructions TEXT NOT NULL DEFAULT '';
        ALTER TABLE ssd_payment_methods ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'BOTH';
        ALTER TABLE ssd_payment_methods ADD COLUMN IF NOT EXISTS requires_sms_paste BOOLEAN NOT NULL DEFAULT true;

        INSERT INTO ssd_payment_methods (country_name, country_code, country_prefix, country_flag, operator_id, operator_name, icon, merchant_phone, merchant_name, deposit_instructions, ssd_code_template, is_active, display_order)
        VALUES
          ('Bénin', 'BJ', '+229', '🇧🇯', 'MTN_BJ', 'MTN MoMo BJ', '🟡', '22646410950', 'Winary Bénin', 'Effectuez le transfert USSD puis copiez le SMS.', '*880*1*3*1*4*22646410950*{AMOUNT}*1#', true, 1),
          ('Bénin', 'BJ', '+229', '🇧🇯', 'MOOV_BJ', 'Moov Money BJ', '🔵', '22646410950', 'Winary Bénin', 'Effectuez le transfert USSD puis copiez le SMS.', '*855*1*1*3*2*22646410950*22646410950*{AMOUNT}#', true, 2),
          ('Bénin', 'BJ', '+229', '🇧🇯', 'CELTIIS_BJ', 'Celtiis Cash BJ', '🟣', '22990000000', 'Winary Bénin', 'Effectuez le transfert puis copiez le SMS.', '*880*{AMOUNT}#', true, 3),
          ('Côte d’Ivoire', 'CI', '+225', '🇨🇮', 'ORANGE_CI', 'Orange Money CI', '🟧', '0700000000', 'Winary CI', 'Envoyez {AMOUNT} FCFA sur le 0700000000 (Nom: Winary CI) puis copiez-collez le SMS de confirmation ici.', '*144*1*1*{AMOUNT}#', true, 1),
          ('Côte d’Ivoire', 'CI', '+225', '🇨🇮', 'MTN_CI', 'MTN MoMo CI', '🟡', '0500000000', 'Winary CI', 'Envoyez {AMOUNT} FCFA sur le 0500000000 (Nom: Winary CI) puis copiez-collez le SMS de confirmation ici.', '*133*{AMOUNT}#', true, 2),
          ('Côte d’Ivoire', 'CI', '+225', '🇨🇮', 'MOOV_CI', 'Moov Money CI', '🔵', '0100000000', 'Winary CI', 'Envoyez {AMOUNT} FCFA sur le 0100000000 (Nom: Winary CI) puis copiez-collez le SMS de confirmation ici.', '*155*1*1*{AMOUNT}#', true, 3),
          ('Côte d’Ivoire', 'CI', '+225', '🇨🇮', 'WAVE_CI', 'Wave CI', '🌊', '0700000000', 'Winary CI', 'Envoyez {AMOUNT} FCFA via Wave sur le 0700000000 (Nom: Winary CI) puis copiez-collez le message de confirmation ici.', 'https://wave.com/pay', true, 4),
          ('Burkina Faso', 'BF', '+226', '🇧🇫', 'ORANGE_BF', 'Orange Money BF', '🟧', '70000000', 'Winary BF', 'Envoyez {AMOUNT} FCFA sur le 70000000 puis copiez le SMS.', '*144*1*1*{AMOUNT}#', true, 1),
          ('Burkina Faso', 'BF', '+226', '🇧🇫', 'MOOV_BF', 'Moov Money BF', '🟡', '60000000', 'Winary BF', 'Envoyez {AMOUNT} FCFA sur le 60000000 puis copiez le SMS.', '*555*1*1*{AMOUNT}#', true, 2),
          ('Burkina Faso', 'BF', '+226', '🇧🇫', 'TELECEL_BF', 'Telecel Cash BF', '🔴', '78000000', 'Winary BF', 'Envoyez {AMOUNT} FCFA sur le 78000000 puis copiez le SMS.', '*777*{AMOUNT}#', true, 3)
        ON CONFLICT (operator_id) DO NOTHING;
      `
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

  const winpayOneSetting = (dbConfigs || []).find((c: any) => c.bot_id === 'GLOBAL_WINPAYONE');
  const isWinpayOneActive = winpayOneSetting ? winpayOneSetting.is_active !== false : true;
  const winpayOneSlackWebhookUrl = winpayOneSetting?.merchant_phone_mtn || process.env.SLACK_WINPAYONE_WEBHOOK_URL || '';
  const winpayOneDiscordWebhookUrl = winpayOneSetting?.merchant_phone_moov || process.env.DISCORD_WINPAYONE_WEBHOOK_URL || '';
  const winpayOneWhatsappPhone1 = winpayOneSetting?.merchant_phone_orange || process.env.CALLMEBOT_PHONE_1 || '22994585431';
  const winpayOneWhatsappApiKey1 = winpayOneSetting?.merchant_phone_wave || process.env.CALLMEBOT_APIKEY_1 || '2472352';
  const winpayOneWhatsappPhone2 = winpayOneSetting?.ssd_code_orange || process.env.CALLMEBOT_PHONE_2 || '';
  const winpayOneWhatsappApiKey2 = winpayOneSetting?.ssd_code_wave || process.env.CALLMEBOT_APIKEY_2 || '';
  const winpayOneWhatsappPhone3 = winpayOneSetting?.ssd_code_mtn || process.env.CALLMEBOT_PHONE_3 || '';
  const winpayOneWhatsappApiKey3 = winpayOneSetting?.ssd_code_moov || process.env.CALLMEBOT_APIKEY_3 || '';

  const rawConfigs = (dbConfigs || []).filter((c: any) => !['GLOBAL_WINPAY', 'GLOBAL_SENEPAY', 'GLOBAL_WINPAY2', 'GLOBAL_WINPAYONE'].includes(c.bot_id));

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

  return NextResponse.json({
    bots,
    configs,
    isWinpayActive,
    isSenepayActive,
    isWinpay2Active,
    winpay2WhatsappPhone,
    isWinpayOneActive,
  });
}
