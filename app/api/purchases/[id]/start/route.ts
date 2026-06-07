import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { WORK_COOLDOWN_HOURS } from '@/lib/data';

// POST /api/purchases/[id]/start — lancer un bot pour 8h
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const { id: purchaseId } = await params;
  const db = createAdminClient();

  const { data: purchase, error } = await db
    .from('purchases')
    .select('*')
    .eq('id', purchaseId)
    .eq('user_id', payload.sub)
    .single();

  if (error || !purchase) {
    return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 });
  }
  if (purchase.status === 'EXPIRED') {
    return NextResponse.json({ error: 'Ce bot est expiré' }, { status: 400 });
  }
  if (purchase.status === 'PENDING') {
    return NextResponse.json({ error: 'Ce bot est en attente de validation' }, { status: 400 });
  }

  const now = new Date();
  
  // If next_allowed_at is set, it means it's either working or claimable
  // We cannot start if it hasn't been claimed (i.e. next_allowed_at != null)
  if (purchase.next_allowed_at) {
    return NextResponse.json(
      { error: `Le bot est déjà en cours ou en attente de récolte.` },
      { status: 400 }
    );
  }

  const nextAllowedAt = new Date(now.getTime() + WORK_COOLDOWN_HOURS * 3600 * 1000);

  // Update purchase to START working
  await db.from('purchases').update({
    last_worked_at: now.toISOString(),
    next_allowed_at: nextAllowedAt.toISOString(),
  }).eq('id', purchaseId);

  return NextResponse.json({
    lastWorkedAt: now.toISOString(),
    nextAllowedAt: nextAllowedAt.toISOString(),
  });
}
