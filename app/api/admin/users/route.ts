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
    .select('id, phone, referral_code, balance_cents, is_admin, created_at, referred_by_id')
    .order('created_at', { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  // Enrich with referral count
  const enriched = await Promise.all(
    (users || []).map(async (u: any) => {
      const { count } = await db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by_id', u.id);
      return {
        id: u.id,
        phone: u.phone,
        referralCode: u.referral_code,
        balanceCents: u.balance_cents,
        isAdmin: u.is_admin,
        createdAt: u.created_at,
        referralsCount: count || 0,
      };
    })
  );

  return NextResponse.json(enriched);
}

// PATCH /api/admin/users — modifier solde ou statut
export async function PATCH(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { userId, balanceCents, status } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 });

  const db = createAdminClient();
  const { data: user, error: findErr } = await db
    .from('users')
    .select('balance_cents')
    .eq('id', userId)
    .single();

  if (findErr || !user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

  const updates: Record<string, any> = {};
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
