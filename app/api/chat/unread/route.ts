import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';

export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();
  const { count, error } = await db
    .from('support_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', payload.sub)
    .eq('sender_role', 'ADMIN')
    .eq('is_read', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count || 0 });
}
