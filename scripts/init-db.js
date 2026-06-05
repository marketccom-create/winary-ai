/**
 * WINARY AI — Script d'initialisation de la base de données Supabase
 * Exécute : node scripts/init-db.js
 * 
 * Ce script crée toutes les tables si elles n'existent pas encore.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  referral_code   TEXT UNIQUE NOT NULL,
  referred_by_id  UUID REFERENCES users(id),
  balance_cents   BIGINT NOT NULL DEFAULT 0,
  is_admin        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  bot_id              TEXT NOT NULL,
  bot_name            TEXT NOT NULL,
  price_paid_cents    BIGINT NOT NULL,
  purchased_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  last_worked_at      TIMESTAMPTZ,
  next_allowed_at     TIMESTAMPTZ,
  total_earned_cents  BIGINT NOT NULL DEFAULT 0,
  work_count          INT NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','EXPIRED')),
  operator            TEXT CHECK (operator IN ('MTN','MOOV')),
  tx_reference        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  type          TEXT NOT NULL CHECK (type IN ('DEPOSIT','WITHDRAWAL','BOT_PURCHASE','WORK_EARNING','REFERRAL_BONUS','WELCOME_BONUS','ADMIN_ADJUSTMENT')),
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','FAILED','CANCELLED')),
  amount_cents  BIGINT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  operator      TEXT,
  tx_reference  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  cta_label     TEXT NOT NULL DEFAULT '',
  cta_url       TEXT NOT NULL DEFAULT '',
  image_url     TEXT NOT NULL DEFAULT '',
  header_color  TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot_payment_configs (
  bot_id              TEXT PRIMARY KEY,
  bot_name            TEXT NOT NULL,
  ssd_code_mtn        TEXT NOT NULL DEFAULT '',
  ssd_code_moov       TEXT NOT NULL DEFAULT '',
  merchant_phone_mtn  TEXT NOT NULL DEFAULT '',
  merchant_phone_moov TEXT NOT NULL DEFAULT ''
);

INSERT INTO users (phone, password_hash, referral_code, balance_cents, is_admin)
VALUES (
  '+22901010101',
  '$2b$10$3aBcQfNFNmvNXQRx8.HNmuOrHsK5cO1oXl/JEtRj1HfAQl7fS0pIy',
  'ADMIN001',
  0,
  true
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO announcements (title, content, cta_label, cta_url, is_active)
VALUES (
  '🎉 Bienvenue sur WINARY AI !',
  'Rejoignez notre communauté WhatsApp officielle pour les dernières annonces et promotions exclusives. Investissez intelligemment avec nos bots IA !',
  '📱 Rejoindre le groupe WhatsApp',
  'https://chat.whatsapp.com/VOTRE_LIEN_ICI',
  true
)
ON CONFLICT DO NOTHING;

INSERT INTO bot_payment_configs (bot_id, bot_name, ssd_code_mtn, ssd_code_moov, merchant_phone_mtn, merchant_phone_moov)
VALUES
  ('gam-1', 'Gam 1', '*880*1*4000*97001122#',   '*155*1*4000*95001122#',   '+22997001122', '+22995001122'),
  ('gam-2', 'Gam 2', '*880*1*10000*97001122#',  '*155*1*10000*95001122#',  '+22997001122', '+22995001122'),
  ('gam-3', 'Gam 3', '*880*1*30000*97001122#',  '*155*1*30000*95001122#',  '+22997001122', '+22995001122'),
  ('gam-4', 'Gam 4', '*880*1*85000*97001122#',  '*155*1*85000*95001122#',  '+22997001122', '+22995001122'),
  ('gam-5', 'Gam 5', '*880*1*200000*97001122#', '*155*1*200000*95001122#', '+22997001122', '+22995001122'),
  ('gam-6', 'Gam 6', '*880*1*600000*97001122#', '*155*1*600000*95001122#', '+22997001122', '+22995001122')
ON CONFLICT (bot_id) DO NOTHING;
`;

async function initDB() {
  console.log('🔄 Connexion à Supabase...');
  console.log('   URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  // Split SQL into individual statements and execute them
  const statements = SQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 10);

  let success = 0;
  let errors = 0;

  for (const stmt of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
      if (error) {
        // Try direct query if RPC not available
        console.log('   ⚠️', stmt.slice(0, 60) + '...');
        errors++;
      } else {
        success++;
      }
    } catch (e) {
      errors++;
    }
  }

  if (errors > 0) {
    console.log('\n⚠️  Méthode RPC non disponible. Utilisez le SQL Editor Supabase.');
    console.log('   Fichier SQL : supabase-schema.sql');
    console.log('\n   COMMENT FAIRE :');
    console.log('   1. Allez sur https://supabase.com/dashboard/project/ooxqvhcguuynamaoefqc/sql');
    console.log('   2. Cliquez "New query"');
    console.log('   3. Collez le contenu de supabase-schema.sql');
    console.log('   4. Cliquez Run (▶)');
  } else {
    console.log('\n✅ Base de données initialisée avec succès !');
    console.log('   Tables créées : users, purchases, transactions, announcements, bot_payment_configs');
    console.log('   Compte admin créé : +22901010101 / Admin@2024');
  }
}

initDB().catch(console.error);
