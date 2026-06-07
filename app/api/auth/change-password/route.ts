import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'winary-ai-secret-change-in-production-32chars'
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    let payload;
    try {
      const { payload: decoded } = await jose.jwtVerify(token, JWT_SECRET);
      payload = decoded;
    } catch (e) {
      return NextResponse.json({ error: 'Session invalide ou expirée' }, { status: 401 });
    }

    const { oldPassword, newPassword } = await req.json();
    if (!oldPassword || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Nouveau mot de passe invalide (minimum 6 caractères)' }, { status: 400 });
    }

    const userId = payload.sub as string;
    const db = createAdminClient();
    
    // Fetch user to verify old password
    const { data: user, error: fetchErr } = await db
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (fetchErr || !user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Ancien mot de passe incorrect' }, { status: 401 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const { error: updateErr } = await db
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', userId);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Change password error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
