import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized, forbidden } from '@/lib/auth';

async function requireAdmin(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return { error: unauthorized() };
  if (!payload.is_admin) return { error: forbidden() };
  return { payload };
}

// GET /api/admin/ssd-methods — Tous les moyens de paiement SSD (Administrateur)
export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = createAdminClient();
  const { data, error: dbErr } = await db
    .from('ssd_payment_methods')
    .select('*')
    .order('country_name', { ascending: true })
    .order('display_order', { ascending: true });

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST /api/admin/ssd-methods — Créer un nouveau moyen de paiement SSD
export async function POST(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const body = await req.json();
    const {
      country_name,
      country_code,
      country_prefix,
      country_flag,
      operator_id,
      operator_name,
      icon,
      merchant_phone,
      merchant_name,
      deposit_instructions,
      ssd_code_template,
      requires_sms_paste,
      is_active,
      display_order,
    } = body;

    if (!country_name || !operator_name || !operator_id) {
      return NextResponse.json({ error: 'Le pays, le nom du réseau et un ID opérateur sont requis' }, { status: 400 });
    }

    const db = createAdminClient();
    const { data, error: insertErr } = await db
      .from('ssd_payment_methods')
      .insert({
        country_name: country_name.trim(),
        country_code: (country_code || country_name.substring(0, 2)).toUpperCase().trim(),
        country_prefix: country_prefix ? (country_prefix.startsWith('+') ? country_prefix.trim() : `+${country_prefix.trim()}`) : '+225',
        country_flag: country_flag || '🌐',
        operator_id: operator_id.toUpperCase().trim(),
        operator_name: operator_name.trim(),
        icon: icon || '💳',
        merchant_phone: merchant_phone || '',
        merchant_name: merchant_name || '',
        deposit_instructions: deposit_instructions || '',
        ssd_code_template: ssd_code_template || '',
        requires_sms_paste: requires_sms_paste !== false,
        is_active: is_active !== false,
        display_order: Number(display_order) || 1,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/admin/ssd-methods — Modifier ou Basculer la visibilité (is_active) d'un moyen de paiement SSD
export async function PUT(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis pour la mise à jour' }, { status: 400 });
    }

    const db = createAdminClient();
    const { data, error: updateErr } = await db
      .from('ssd_payment_methods')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/admin/ssd-methods — Supprimer un moyen de paiement SSD
export async function DELETE(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const db = createAdminClient();
    const { error: deleteErr } = await db
      .from('ssd_payment_methods')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
