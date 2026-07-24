import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// GET /api/admin/stats
export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = createAdminClient();

  const [
    { count: totalUsers },
    { count: pendingPurchases },
    { data: activePurchases },
    { count: pendingWithdrawals },
    { data: pendingWithdrawalsData },
    { data: completedWithdrawals },
    { count: pendingSupportMessages },
  ] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('purchases').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    db.from('purchases').select('price_paid_cents').eq('status', 'ACTIVE'),
    db.from('transactions').select('id', { count: 'exact', head: true })
      .eq('type', 'WITHDRAWAL').eq('status', 'PENDING'),
    db.from('transactions').select('user_id, amount_cents')
      .eq('type', 'WITHDRAWAL').eq('status', 'PENDING'),
    db.from('transactions').select('amount_cents')
      .eq('type', 'WITHDRAWAL').eq('status', 'COMPLETED'),
    db.from('support_messages').select('id', { count: 'exact', head: true })
      .eq('sender_role', 'USER').eq('is_read', false),
  ]);

  const totalRevenueCents = (activePurchases || []).reduce(
    (sum: number, p: any) => sum + p.price_paid_cents,
    0
  );

  const totalWithdrawalsCents = (completedWithdrawals || []).reduce(
    (sum: number, t: any) => sum + Math.abs(t.amount_cents),
    0
  );

  // Total montant des retraits PENDING (non encore approuvés)
  const pendingWithdrawalsTotalCents = (pendingWithdrawalsData || []).reduce(
    (sum: number, t: any) => sum + Math.abs(t.amount_cents),
    0
  );

  // Calcul du montant des retraits éligibles vs inéligibles
  const pendingUserIds = Array.from(new Set((pendingWithdrawalsData || []).map((t: any) => t.user_id).filter(Boolean)));
  let eligibleUserIdsSet = new Set<string>();

  if (pendingUserIds.length > 0) {
    const { data: eligibleCommissions } = await db
      .from('transactions')
      .select('user_id')
      .in('user_id', pendingUserIds)
      .eq('type', 'REFERRAL_BONUS')
      .eq('status', 'COMPLETED');

    eligibleUserIdsSet = new Set((eligibleCommissions || []).map((c: any) => c.user_id));
  }

  let eligiblePendingWithdrawalsTotalCents = 0;
  let ineligiblePendingWithdrawalsTotalCents = 0;

  (pendingWithdrawalsData || []).forEach((t: any) => {
    const amount = Math.abs(t.amount_cents || 0);
    if (eligibleUserIdsSet.has(t.user_id)) {
      eligiblePendingWithdrawalsTotalCents += amount;
    } else {
      ineligiblePendingWithdrawalsTotalCents += amount;
    }
  });

  return NextResponse.json({
    totalUsers: totalUsers || 0,
    activeUsers: totalUsers || 0,
    pendingPurchases: pendingPurchases || 0,
    totalRevenueCents,
    pendingWithdrawals: pendingWithdrawals || 0,
    pendingWithdrawalsTotalCents,
    eligiblePendingWithdrawalsTotalCents,
    ineligiblePendingWithdrawalsTotalCents,
    totalWithdrawalsCents,
    pendingSupportMessages: pendingSupportMessages || 0,
  });
}
