const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  console.log("Testing RPC 'exec_sql' with simple query...");
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1 AS test;' });
    if (error) {
      console.error('RPC Error:', error);
    } else {
      console.log('RPC Success:', data);
    }
  } catch (e) {
    console.error('Catch Error:', e);
  }
}
run();
