import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function GET() {
  const diagnostics: Record<string, any> = {};

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  diagnostics.env = {
    SUPABASE_URL: supabaseUrl || '❌ MISSING',
    SERVICE_KEY_LENGTH: serviceRoleKey?.length || 0,
  };

  // Test 1: Raw fetch to Supabase REST API (bypass @supabase/supabase-js)
  try {
    const url = `${supabaseUrl}/rest/v1/users?phone=eq.%2B22901010101&select=id,phone,password_hash,is_admin`;
    const res = await fetch(url, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    });
    const text = await res.text();
    diagnostics.rawFetch = {
      status: res.status,
      statusText: res.statusText,
      bodyPreview: text.slice(0, 500),
    };

    if (res.ok) {
      try {
        const users = JSON.parse(text);
        diagnostics.usersFound = users.length;
        if (users.length > 0) {
          const user = users[0];
          diagnostics.adminUser = {
            id: user.id,
            phone: user.phone,
            is_admin: user.is_admin,
            hashPrefix: user.password_hash?.slice(0, 25),
          };
          // Test bcrypt
          const valid = await bcrypt.compare('admin123', user.password_hash);
          diagnostics.bcrypt_admin123 = valid;
        }
      } catch (e: any) {
        diagnostics.parseError = e.message;
      }
    }
  } catch (err: any) {
    diagnostics.rawFetchError = {
      message: err.message,
      cause: err.cause?.message || 'none',
      code: err.cause?.code || 'none',
    };

    // Test 2: Can we reach the Supabase URL at all?
    try {
      const pingRes = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { 'apikey': serviceRoleKey },
      });
      diagnostics.pingSupabase = { status: pingRes.status };
    } catch (pingErr: any) {
      diagnostics.pingError = {
        message: pingErr.message,
        cause: pingErr.cause?.message || 'none',
      };
    }

    // Test 3: Can we reach google.com? (general network test)
    try {
      const googleRes = await fetch('https://www.google.com');
      diagnostics.googleTest = { status: googleRes.status, ok: '✅ Internet works' };
    } catch (googleErr: any) {
      diagnostics.googleTest = { error: googleErr.message };
    }
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
