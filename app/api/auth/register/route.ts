import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { JWT_SECRET } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { WELCOME_BONUS_CENTS } from '@/lib/data';

function generateReferralCode() {
  return 'WIN-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(req: Request) {
  try {
    const { phone, password, referralCode, firstName, lastName } = await req.json();
    if (!phone || !password || !firstName || !firstName.trim() || !lastName || !lastName.trim()) {
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
    
    // Create user with retry for referral code collision
    let newUser = null;
    let createErr = null;
    let retries = 3;

    while (retries > 0) {
      const newReferralCode = generateReferralCode();
      const result = await db
        .from('users')
        .insert({
          phone,
          password_hash: passwordHash,
          referral_code: newReferralCode,
          referred_by_id: referrerId,
          balance_cents: WELCOME_BONUS_CENTS,
          is_admin: false,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        })
        .select()
        .single();

      if (!result.error) {
        newUser = result.data;
        break;
      }

      // Check if it's a unique violation for referral_code (code 23505)
      if (result.error.code === '23505' && result.error.message.includes('referral_code')) {
        retries--;
        createErr = result.error;
      } else {
        createErr = result.error;
        break;
      }
    }

    if (!newUser) {
      console.error(createErr);
      return NextResponse.json({ error: 'Erreur création compte, veuillez réessayer' }, { status: 500 });
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
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    const safeUser = {
      id: newUser.id,
      phone: newUser.phone,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
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
