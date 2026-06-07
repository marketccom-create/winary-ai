import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { WELCOME_BONUS_CENTS } from '@/lib/data';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'winary-ai-secret-change-in-production-32chars'
);

function generateReferralCode() {
  return 'WIN-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(req: Request) {
  try {
    const { phone, password, referralCode, fullName } = await req.json();
    if (!phone || !password || !fullName || !fullName.trim()) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const db = createAdminClient();

    // Check phone not already taken
    const { data: existing } = await db.from('users').select('id').eq('phone', phone).single();
    if (existing) {
      return NextResponse.json({ error: 'Ce numéro est déjà utilisé' }, { status: 409 });
    }

    // Find referrer
    let referrerId = null;
    if (referralCode && referralCode.trim() !== '') {
      const { data: referrer } = await db
        .from('users')
        .select('id')
        .eq('referral_code', referralCode.trim())
        .single();
      if (!referrer) {
        return NextResponse.json({ error: 'Code de parrainage invalide' }, { status: 400 });
      }
      referrerId = referrer.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newReferralCode = generateReferralCode();

    // Create user
    const { data: newUser, error: createErr } = await db
      .from('users')
      .insert({
        phone,
        password_hash: passwordHash,
        referral_code: newReferralCode,
        referred_by_id: referrerId,
        balance_cents: WELCOME_BONUS_CENTS,
        is_admin: false,
        full_name: fullName.trim(),
      })
      .select()
      .single();

    if (createErr || !newUser) {
      console.error(createErr);
      return NextResponse.json({ error: 'Erreur création compte' }, { status: 500 });
    }

    // Welcome bonus transaction
    await db.from('transactions').insert({
      user_id: newUser.id,
      type: 'WELCOME_BONUS',
      status: 'COMPLETED',
      amount_cents: WELCOME_BONUS_CENTS,
      description: 'Cadeau de bienvenue',
    });

    const token = await new SignJWT({ sub: newUser.id, phone: newUser.phone, is_admin: false })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(JWT_SECRET);

    const safeUser = {
      id: newUser.id,
      phone: newUser.phone,
      fullName: newUser.full_name,
      referralCode: newUser.referral_code,
      balanceCents: newUser.balance_cents,
      createdAt: newUser.created_at,
      isAdmin: false,
    };

    return NextResponse.json({ user: safeUser, token }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
