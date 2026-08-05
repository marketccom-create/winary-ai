import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';

// GET /api/ssd-methods — Récupérer les moyens de paiement SSD actifs pour l'utilisateur
export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();
  const { data, error } = await db
    .from('ssd_payment_methods')
    .select('*')
    .eq('is_active', true)
    .order('country_name', { ascending: true })
    .order('display_order', { ascending: true });

  if (error) {
    console.warn('ssd_payment_methods notice:', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json(data || []);
}
