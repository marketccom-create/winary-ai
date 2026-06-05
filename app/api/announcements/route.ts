import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';

// GET /api/announcements — annonces actives (utilisateurs)
export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();
  const { data, error } = await db
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const announcements = (data || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    ctaLabel: a.cta_label,
    ctaUrl: a.cta_url,
    imageUrl: a.image_url,
    headerColor: a.header_color,
    isActive: a.is_active,
    createdAt: a.created_at,
  }));

  return NextResponse.json(announcements);
}
