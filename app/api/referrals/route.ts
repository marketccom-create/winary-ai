import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';

// GET /api/referrals
export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();

  // Get user's referral code
  const { data: user } = await db
    .from('users')
    .select('referral_code')
    .eq('id', payload.sub)
    .single();

  // Get direct referees
  const { data: referees } = await db
    .from('users')
    .select('id, phone, created_at')
    .eq('referred_by_id', payload.sub);

  // For each referee, find their most recent active purchase
  const refereesData = await Promise.all(
    (referees || []).map(async (ref: any) => {
      const { data: purchase } = await db
        .from('purchases')
        .select('bot_name')
        .eq('user_id', ref.id)
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle();

      return {
        id: ref.id,
        phone: (ref.phone as string).slice(0, 6) + 'XXXX',
        botName: purchase?.bot_name || 'Aucun',
        commissionCents: 0, // Calculated below
        date: ref.created_at,
      };
    })
  );

  // Total referral commissions earned
  const { data: commTxs } = await db
    .from('transactions')
    .select('amount_cents')
    .eq('user_id', payload.sub)
    .eq('type', 'REFERRAL_BONUS')
    .eq('status', 'COMPLETED');

  const totalCommissionCents = (commTxs || []).reduce(
    (sum: number, t: any) => sum + t.amount_cents,
    0
  );

  return NextResponse.json({
    code: user?.referral_code || '',
    referees: refereesData,
    totalCommissionCents,
  });
}
