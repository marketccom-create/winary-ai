import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { JWT_SECRET } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export async function POST(req: Request) {
  try {
    const { phone, password } = await req.json();
    if (!phone || !password) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: user, error } = await db
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Numéro ou mot de passe incorrect' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Numéro ou mot de passe incorrect' }, { status: 401 });
    }

    const token = await new SignJWT({ sub: user.id, phone: user.phone, is_admin: user.is_admin })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

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

    return NextResponse.json({ user: safeUser, token });
  } catch (err: any) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
