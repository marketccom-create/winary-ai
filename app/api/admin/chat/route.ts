import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';

// GET all conversations (grouped by user)
export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload || !payload.is_admin) return unauthorized();

  const db = createAdminClient();
  
  const { data: msgs, error } = await db
    .from('support_messages')
    .select('*, users(first_name, last_name, phone)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by user_id
  const convos = new Map();
  for (const m of (msgs || [])) {
    if (!convos.has(m.user_id)) {
      convos.set(m.user_id, {
        userId: m.user_id,
        userPhone: m.users?.phone,
        userName: m.users?.first_name ? `${m.users.first_name} ${m.users.last_name || ''}` : null,
        lastMessage: m.content,
        lastMessageAt: m.created_at,
        unreadCount: 0,
      });
    }
    if (m.sender_role === 'USER' && !m.is_read) {
      convos.get(m.user_id).unreadCount++;
    }
  }

  return NextResponse.json({ conversations: Array.from(convos.values()) });
}
