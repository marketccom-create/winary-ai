import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';

export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();
  const { data, error } = await db
    .from('support_messages')
    .select('*')
    .eq('user_id', payload.sub)
    .order('created_at', { ascending: true });

  // Marquer les messages de l'admin comme lus
  await db
    .from('support_messages')
    .update({ is_read: true })
    .eq('user_id', payload.sub)
    .eq('sender_role', 'ADMIN')
    .eq('is_read', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const { content } = await req.json();
  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'Message vide' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('support_messages')
    .insert({
      user_id: payload.sub,
      sender_role: 'USER',
      content: content.trim(),
      is_read: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
