import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// GET /api/admin/users/[id]/details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  const db = createAdminClient();

  const { data: user } = await db
    .from('users')
    .select('*, sponsor:referred_by_id(phone)')
    .eq('id', id)
    .single();

  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

  const { data: purchases } = await db
    .from('purchases')
    .select('*')
    .eq('user_id', id)
    .order('purchased_at', { ascending: false });

  const { data: referees } = await db
    .from('users')
    .select('phone, created_at')
    .eq('referred_by_id', id);

  return NextResponse.json({
    user: {
      id: user.id,
      phone: user.phone,
      referralCode: user.referral_code,
      balanceCents: user.balance_cents,
      isAdmin: user.is_admin,
      createdAt: user.created_at,
      sponsorPhone: (user.sponsor as any)?.phone || 'Aucun',
    },
    purchases: (purchases || []).map((p: any) => ({
      id: p.id,
      botName: p.bot_name,
      pricePaidCents: p.price_paid_cents,
      status: p.status,
      workCount: p.work_count,
      totalEarnedCents: p.total_earned_cents,
      purchasedAt: p.purchased_at,
      operator: p.operator,
      txReference: p.tx_reference,
    })),
    referees: referees || [],
  });
}
