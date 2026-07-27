import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Custom fetch with a 5-second timeout
function fetchWithTimeout(url: string, options: any = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 5000);
  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => clearTimeout(id));
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const report: any = {
    timestamp: new Date().toISOString(),
    supabaseUrlExists: !!supabaseUrl,
    supabaseServiceKeyExists: !!supabaseKey,
    databaseConnection: 'unknown',
    execSqlFunctionExists: 'unknown',
    constraintCheck: 'unknown',
    errors: []
  };

  if (!supabaseUrl || !supabaseKey) {
    report.errors.push('Missing Supabase credentials in .env.local');
    return NextResponse.json(report, { status: 500 });
  }

  // Create a database client with timeout configuration
  const db = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchWithTimeout }
  });

  try {
    // 1. Test basic connection by reading a config with a timeout
    const { data: configs, error: configErr } = await db.from('bot_payment_configs').select('bot_id').limit(1);
    if (configErr) {
      report.databaseConnection = 'failed';
      report.errors.push(`Config read error: ${configErr.message}`);
    } else {
      report.databaseConnection = 'success';
    }
  } catch (e: any) {
    report.databaseConnection = 'failed';
    report.errors.push(`Config read exception (likely timeout): ${e.message || e}`);
  }

  // 2. Test if exec_sql RPC function exists
  if (report.databaseConnection === 'success') {
    try {
      const { data, error } = await db.rpc('exec_sql', { sql: 'SELECT 1 AS value;' });
      if (error) {
        report.execSqlFunctionExists = false;
        report.errors.push(`exec_sql RPC error: ${error.message}`);
      } else {
        report.execSqlFunctionExists = true;
        report.execSqlTestResult = data;
      }
    } catch (e: any) {
      report.execSqlFunctionExists = false;
      report.errors.push(`exec_sql RPC exception: ${e.message || e}`);
    }
  }

  // 3. Test insert into purchases with custom operator
  if (report.databaseConnection === 'success') {
    try {
      const { data: user } = await db.from('users').select('id').limit(1).single();
      
      if (user) {
        const dummyPurchase = {
          user_id: user.id,
          bot_id: 'test-bot-diagnostic',
          bot_name: 'Diagnostic Bot',
          price_paid_cents: 0,
          expires_at: new Date(Date.now() + 1000 * 60).toISOString(),
          status: 'PENDING',
          operator: 'WINPAY2',
          tx_reference: 'DIAGNOSTIC_TEST'
        };

        const { data: inserted, error: insertErr } = await db
          .from('purchases')
          .insert(dummyPurchase)
          .select()
          .single();

        if (insertErr) {
          report.constraintCheck = 'violated';
          report.errors.push(`Insert failed: ${insertErr.message}`);
        } else {
          report.constraintCheck = 'allowed';
          // Clean up the dummy row
          await db.from('purchases').delete().eq('id', inserted.id);
        }
      } else {
        report.constraintCheck = 'unknown (no user found to test with)';
      }
    } catch (e: any) {
      report.constraintCheck = 'error';
      report.errors.push(`Insert exception: ${e.message || e}`);
    }
  }

  return NextResponse.json(report);
}
