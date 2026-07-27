import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';

export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();
  const { data: user, error } = await db
    .from('users')
    .select('*')
    .eq('id', payload.sub)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  const safeUser = {
    id: user.id,
    phone: user.phone,
    firstName: user.first_name,
    lastName: user.last_name,
    referralCode: user.referral_code,
    balanceCents: user.balance_cents,
    createdAt: user.created_at,
    isAdmin: user.is_admin,
  };

  return NextResponse.json({ user: safeUser });
}
