import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// GET /api/admin/withdrawals/settings — obtenir le statut de restriction des retraits le week-end
export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = createAdminClient();
  const { data } = await db
    .from('bot_payment_configs')
    .select('is_active')
    .eq('bot_id', 'GLOBAL_WITHDRAWAL_WEEKEND')
    .maybeSingle();

  return NextResponse.json({
    allowWeekendWithdrawals: data?.is_active === true,
  });
}

// POST /api/admin/withdrawals/settings — activer ou désactiver les retraits le week-end
export async function POST(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json();
  const allowWeekendWithdrawals = Boolean(body.allowWeekendWithdrawals);

  const db = createAdminClient();
  const { error: upsertErr } = await db
    .from('bot_payment_configs')
    .upsert({
      bot_id: 'GLOBAL_WITHDRAWAL_WEEKEND',
      bot_name: 'GLOBAL_WITHDRAWAL_WEEKEND',
      is_active: allowWeekendWithdrawals,
    }, { onConflict: 'bot_id' });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    allowWeekendWithdrawals,
  });
}
