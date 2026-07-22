import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// GET /api/admin/users — liste enrichie
export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = createAdminClient();
  const { data: users, error: dbErr } = await db
    .from('users')
    .select('id, phone, referral_code, balance_cents, is_admin, created_at, referred_by_id, first_name, last_name, ai_support_enabled')
    .order('created_at', { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  // Enrich with referral count and commissions earned
  const enriched = await Promise.all(
    (users || []).map(async (u: any) => {
      const { count } = await db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by_id', u.id);
        
      const { data: commissions } = await db
        .from('transactions')
        .select('amount_cents')
        .eq('user_id', u.id)
        .eq('type', 'REFERRAL_BONUS');
        
      const { data: withdrawals } = await db
        .from('transactions')
        .select('amount_cents')
        .eq('user_id', u.id)
        .eq('type', 'WITHDRAWAL')
        .eq('status', 'COMPLETED');
        
      const totalCommissions = (commissions || []).reduce((acc: number, curr: any) => acc + curr.amount_cents, 0);
      const totalWithdrawals = (withdrawals || []).reduce((acc: number, curr: any) => acc + Math.abs(curr.amount_cents), 0);
      const withdrawalsCount = (withdrawals || []).length;

      return {
        id: u.id,
        phone: u.phone,
        firstName: u.first_name,
        lastName: u.last_name,
        referralCode: u.referral_code,
        balanceCents: u.balance_cents,
        commissionsCents: totalCommissions,
        withdrawalsTotalCents: totalWithdrawals,
        withdrawalsCount: withdrawalsCount,
        isAdmin: u.is_admin,
        createdAt: u.created_at,
        referralsCount: count || 0,
        ai_support_enabled: u.ai_support_enabled,
      };
    })
  );

  return NextResponse.json(enriched);
}

// PATCH /api/admin/users — modifier solde ou statut
export async function PATCH(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { userId, balanceCents, status, aiSupportEnabled } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 });

  const db = createAdminClient();
  const { data: user, error: findErr } = await db
    .from('users')
    .select('balance_cents')
    .eq('id', userId)
    .single();

  if (findErr || !user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

  const updates: Record<string, any> = {};
  if (aiSupportEnabled !== undefined) {
    updates.ai_support_enabled = aiSupportEnabled;
  }
  if (balanceCents !== undefined) {
    const delta = balanceCents - user.balance_cents;
    updates.balance_cents = balanceCents;
    // Record admin adjustment
    await db.from('transactions').insert({
      user_id: userId,
      type: 'ADMIN_ADJUSTMENT',
      status: 'COMPLETED',
      amount_cents: delta,
      description: 'Ajustement administrateur',
    });
  }

  await db.from('users').update(updates).eq('id', userId);
  return NextResponse.json({ success: true });
}
