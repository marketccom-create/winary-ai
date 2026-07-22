import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = createAdminClient();
  const { data, error: dbErr } = await db
    .from('ai_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json();
  const db = createAdminClient();
  
  const { data, error: dbErr } = await db
    .from('ai_settings')
    .upsert({
      id: 1,
      knowledge_base: body.knowledge_base,
      is_active: body.is_active
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json(data);
}
