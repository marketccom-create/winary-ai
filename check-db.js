const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  const { data, error } = await supabase.from('bot_payment_configs').select('*');
  if (error) {
    console.error('Error fetching bot_payment_configs:', error);
  } else {
    console.log('bot_payment_configs records:', JSON.stringify(data, null, 2));
  }
}
run();
