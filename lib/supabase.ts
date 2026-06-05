import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Client côté NAVIGATEUR (clé publique) ────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Client côté SERVEUR (service_role — jamais exposé au navigateur) ─────────
export function createAdminClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
