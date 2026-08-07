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
  const CUTOFF_DATE = '2026-08-07T20:45:00.000Z';

  const [
    { data: allUsers },
    { count: pendingPurchases },
    { data: activePurchases },
    { count: pendingWithdrawals },
    { data: pendingWithdrawalsData },
    { data: completedWithdrawals },
    { count: pendingSupportMessages },
    { data: priorityBoostPurchases },
  ] = await Promise.all([
    db.from('users').select('id, created_at'),
    db.from('purchases').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    db.from('purchases').select('id, user_id, bot_id, price_paid_cents, purchased_at').eq('status', 'ACTIVE'),
    db.from('transactions').select('id', { count: 'exact', head: true })
      .eq('type', 'WITHDRAWAL').eq('status', 'PENDING'),
    db.from('transactions').select('id, user_id, amount_cents, created_at')
      .eq('type', 'WITHDRAWAL').eq('status', 'PENDING'),
    db.from('transactions').select('id, user_id, amount_cents, created_at')
      .eq('type', 'WITHDRAWAL').eq('status', 'COMPLETED'),
    db.from('support_messages').select('id', { count: 'exact', head: true })
      .eq('sender_role', 'USER').eq('is_read', false),
    db.from('purchases').select('user_id').eq('bot_id', 'priority-boost').eq('status', 'ACTIVE'),
  ]);

  const userCreatedAtMap = new Map<string, string>();
  (allUsers || []).forEach((u: any) => {
    userCreatedAtMap.set(u.id, u.created_at);
  });

  // Priority Boost User Set
  const priorityBoostUserIdsSet = new Set((priorityBoostPurchases || []).map((p: any) => p.user_id));

  // User Counts
  const totalUsers = (allUsers || []).length;
  let newUsersCount = 0;
  let oldUsersCount = 0;
  (allUsers || []).forEach((u: any) => {
    if (u.created_at >= CUTOFF_DATE) {
      newUsersCount++;
    } else {
      oldUsersCount++;
    }
  });

  // Revenue Totals & Segmentation
  let totalRevenueCents = 0;
  let priorityBoostRevenueCents = 0;
  let newSegmentRevenueCents = 0;
  let oldSegmentRevenueCents = 0;

  (activePurchases || []).forEach((p: any) => {
    const amount = p.price_paid_cents || 0;
    totalRevenueCents += amount;

    const userCreatedAt = userCreatedAtMap.get(p.user_id) || '';
    const isPriorityUser = priorityBoostUserIdsSet.has(p.user_id) || p.bot_id === 'priority-boost';
    const isNew = (p.purchased_at >= CUTOFF_DATE) || (userCreatedAt >= CUTOFF_DATE);

    if (isPriorityUser) {
      priorityBoostRevenueCents += amount;
    }
    if (isNew) {
      newSegmentRevenueCents += amount;
    } else {
      oldSegmentRevenueCents += amount;
    }
  });

  // Completed Withdrawals & Segmentation
  let totalWithdrawalsCents = 0;
  let priorityBoostWithdrawalsCents = 0;
  let newSegmentWithdrawalsCents = 0;
  let oldSegmentWithdrawalsCents = 0;

  (completedWithdrawals || []).forEach((t: any) => {
    const amount = Math.abs(t.amount_cents || 0);
    totalWithdrawalsCents += amount;

    const userCreatedAt = userCreatedAtMap.get(t.user_id) || '';
    const isPriorityUser = priorityBoostUserIdsSet.has(t.user_id);
    const isNew = (t.created_at >= CUTOFF_DATE) || (userCreatedAt >= CUTOFF_DATE);

    if (isPriorityUser) {
      priorityBoostWithdrawalsCents += amount;
    }
    if (isNew) {
      newSegmentWithdrawalsCents += amount;
    } else {
      oldSegmentWithdrawalsCents += amount;
    }
  });

  // Pending Withdrawals & Segmentation
  let pendingWithdrawalsTotalCents = 0;
  let priorityBoostPendingWithdrawalsCents = 0;
  let newSegmentPendingWithdrawalsCents = 0;
  let oldSegmentPendingWithdrawalsCents = 0;

  (pendingWithdrawalsData || []).forEach((t: any) => {
    const amount = Math.abs(t.amount_cents || 0);
    pendingWithdrawalsTotalCents += amount;

    const userCreatedAt = userCreatedAtMap.get(t.user_id) || '';
    const isPriorityUser = priorityBoostUserIdsSet.has(t.user_id);
    const isNew = (t.created_at >= CUTOFF_DATE) || (userCreatedAt >= CUTOFF_DATE);

    if (isPriorityUser) {
      priorityBoostPendingWithdrawalsCents += amount;
    }
    if (isNew) {
      newSegmentPendingWithdrawalsCents += amount;
    } else {
      oldSegmentPendingWithdrawalsCents += amount;
    }
  });

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
    newUsersCount,
    oldUsersCount,
    priorityBoostUsersCount: priorityBoostUserIdsSet.size,
    activeUsers: totalUsers || 0,
    pendingPurchases: pendingPurchases || 0,
    
    // Revenue Segmented Accounting
    totalRevenueCents,
    priorityBoostRevenueCents,
    newSegmentRevenueCents,
    oldSegmentRevenueCents,
    
    // Withdrawals Completed Accounting
    totalWithdrawalsCents,
    priorityBoostWithdrawalsCents,
    newSegmentWithdrawalsCents,
    oldSegmentWithdrawalsCents,

    // Pending Withdrawals Accounting
    pendingWithdrawals: pendingWithdrawals || 0,
    pendingWithdrawalsTotalCents,
    priorityBoostPendingWithdrawalsCents,
    newSegmentPendingWithdrawalsCents,
    oldSegmentPendingWithdrawalsCents,
    eligiblePendingWithdrawalsTotalCents,
    ineligiblePendingWithdrawalsTotalCents,
    pendingSupportMessages: pendingSupportMessages || 0,
  });
}

