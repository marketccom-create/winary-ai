import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// ─── GET /api/admin/announcements — toutes les annonces ──────────────────────
export async function GET(req: Request) {
  const { error, payload } = await requireAdmin(req);
  if (error) return error;

  const db = createAdminClient();
  const { data, error: dbErr } = await db
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json(
    (data || []).map(mapAnn)
  );
}

// ─── POST /api/admin/announcements — créer ────────────────────────────────────
export async function POST(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json();
  const { title, content, ctaLabel, ctaUrl, imageUrl, headerColor, isActive } = body;

  if (!title || !content) {
    return NextResponse.json({ error: 'Titre et contenu requis' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error: dbErr } = await db
    .from('announcements')
    .insert({
      title,
      content,
      cta_label: ctaLabel || '',
      cta_url: ctaUrl || '',
      image_url: imageUrl || '',
      header_color: headerColor || '',
      is_active: isActive !== undefined ? isActive : true,
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json(mapAnn(data), { status: 201 });
}

// ─── PUT /api/admin/announcements — modifier ──────────────────────────────────
export async function PUT(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json();
  const { id, title, content, ctaLabel, ctaUrl, imageUrl, headerColor, isActive } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID requis' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error: dbErr } = await db
    .from('announcements')
    .update({
      title,
      content,
      cta_label: ctaLabel ?? '',
      cta_url: ctaUrl ?? '',
      image_url: imageUrl ?? '',
      header_color: headerColor ?? '',
      is_active: isActive,
    })
    .eq('id', id)
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json(mapAnn(data));
}

// ─── DELETE /api/admin/announcements?id=xxx ───────────────────────────────────
export async function DELETE(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  const db = createAdminClient();
  const { error: dbErr } = await db.from('announcements').delete().eq('id', id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

function mapAnn(a: any) {
  return {
    id: a.id,
    title: a.title,
    content: a.content,
    ctaLabel: a.cta_label,
    ctaUrl: a.cta_url,
    imageUrl: a.image_url,
    headerColor: a.header_color,
    isActive: a.is_active,
    createdAt: a.created_at,
  };
}
