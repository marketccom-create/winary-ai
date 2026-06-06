import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function GET() {
  const diagnostics: Record<string, any> = {};

  // 1. Check environment variables
  diagnostics.env = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ SET (' + process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 30) + '...)' : '❌ MISSING',
    ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ SET (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : '❌ MISSING',
    SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : '❌ MISSING',
    JWT_SECRET: process.env.JWT_SECRET ? '✅ SET' : '❌ MISSING (using default)',
  };

  // 2. Test database connection
  try {
    const db = createAdminClient();
    
    // 2a. Try to query the users table
    const { data: users, error: usersError } = await db
      .from('users')
      .select('id, phone, is_admin, password_hash')
      .limit(5);

    if (usersError) {
      diagnostics.db = { status: '❌ ERROR', error: usersError.message, code: usersError.code, hint: usersError.hint };
    } else {
      diagnostics.db = { status: '✅ CONNECTED', userCount: users?.length || 0 };
      
      // 2b. Check if admin user exists
      const adminUser = users?.find(u => u.phone === '+22901010101');
      if (adminUser) {
        diagnostics.adminUser = {
          exists: true,
          id: adminUser.id,
          phone: adminUser.phone,
          isAdmin: adminUser.is_admin,
          hashPrefix: adminUser.password_hash?.slice(0, 20) + '...',
          hashLength: adminUser.password_hash?.length,
        };

        // 2c. Test bcrypt compare
        const valid = await bcrypt.compare('admin123', adminUser.password_hash);
        diagnostics.bcryptTest = { password: 'admin123', valid };
      } else {
        diagnostics.adminUser = { exists: false, allPhones: users?.map(u => u.phone) };
      }
    }

    // 2d. Check tables existence
    const { data: tables, error: tablesError } = await db
      .from('users')
      .select('id')
      .limit(1);
    diagnostics.tablesCheck = tablesError ? '❌ users table error: ' + tablesError.message : '✅ users table OK';

  } catch (err: any) {
    diagnostics.db = { status: '❌ EXCEPTION', message: err.message };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
