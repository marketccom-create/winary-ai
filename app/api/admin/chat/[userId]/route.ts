import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const payload = await verifyAuth(req);
  if (!payload || !payload.is_admin) return unauthorized();

  const db = createAdminClient();
  
  // Mark as read
  await db.from('support_messages')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('sender_role', 'USER');

  const { data, error } = await db
    .from('support_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const payload = await verifyAuth(req);
  if (!payload || !payload.is_admin) return unauthorized();

  const { content } = await req.json();
  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'Message vide' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('support_messages')
    .insert({
      user_id: userId,
      sender_role: 'ADMIN',
      content: content.trim(),
      is_read: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
