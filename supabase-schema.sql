-- ════════════════════════════════════════════════════════════════
-- WINARY AI — Schéma de base de données Supabase
-- Exécutez ce script dans : supabase.com → SQL Editor → New query
-- ════════════════════════════════════════════════════════════════

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Table : users ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  referral_code   TEXT UNIQUE NOT NULL,
  referred_by_id  UUID REFERENCES users(id),
  balance_cents   BIGINT NOT NULL DEFAULT 0,
  is_admin        BOOLEAN NOT NULL DEFAULT false,
  first_name      TEXT,
  last_name       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Table : purchases ───────────────────────────────────────
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
  operator            TEXT CHECK (operator IN ('MTN','MOOV','SENEPAY','BALANCE')),
  tx_reference        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Table : transactions ────────────────────────────────────
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

-- ─── Table : announcements ───────────────────────────────────
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

-- ─── Table : bot_payment_configs ─────────────────────────────
CREATE TABLE IF NOT EXISTS bot_payment_configs (
  bot_id              TEXT PRIMARY KEY,
  bot_name            TEXT NOT NULL,
  ssd_code_mtn        TEXT NOT NULL DEFAULT '',
  ssd_code_moov       TEXT NOT NULL DEFAULT '',
  merchant_phone_mtn  TEXT NOT NULL DEFAULT '',
  merchant_phone_moov TEXT NOT NULL DEFAULT ''
);

-- ════════════════════════════════════════════════════════════════
-- DONNÉES INITIALES
-- ════════════════════════════════════════════════════════════════

-- Compte ADMIN
-- Mot de passe : Admin@2024 (vous pouvez le changer dans l'app ou ici)
-- Hash bcrypt de "Admin@2024" :
INSERT INTO users (phone, password_hash, referral_code, balance_cents, is_admin)
VALUES (
  '+22901010101',
  '$2b$10$3aBcQfNFNmvNXQRx8.HNmuOrHsK5cO1oXl/JEtRj1HfAQl7fS0pIy',
  'ADMIN001',
  0,
  true
)
ON CONFLICT (phone) DO NOTHING;

-- Annonce de bienvenue par défaut
INSERT INTO announcements (title, content, cta_label, cta_url, is_active)
VALUES (
  '🎉 Bienvenue sur WINARY AI !',
  'Rejoignez notre communauté WhatsApp officielle pour les dernières annonces, promotions exclusives et support en direct. Investissez intelligemment avec nos bots IA et maximisez vos revenus !',
  '📱 Rejoindre le groupe WhatsApp',
  'https://chat.whatsapp.com/VOTRE_LIEN_ICI',
  true
)
ON CONFLICT DO NOTHING;

-- Configurations SSD des bots (à mettre à jour dans l'admin)
INSERT INTO bot_payment_configs (bot_id, bot_name, ssd_code_mtn, ssd_code_moov, merchant_phone_mtn, merchant_phone_moov)
VALUES
  ('gam-1', 'Gam 1', '*880*1*4000*97001122#',   '*155*1*4000*95001122#',   '97001122', '95001122'),
  ('gam-2', 'Gam 2', '*880*1*10000*97001122#',  '*155*1*10000*95001122#',  '97001122', '95001122'),
  ('gam-3', 'Gam 3', '*880*1*30000*97001122#',  '*155*1*30000*95001122#',  '97001122', '95001122'),
  ('gam-4', 'Gam 4', '*880*1*85000*97001122#',  '*155*1*85000*95001122#',  '97001122', '95001122'),
  ('gam-5', 'Gam 5', '*880*1*200000*97001122#', '*155*1*200000*95001122#', '97001122', '95001122'),
  ('gam-6', 'Gam 6', '*880*1*600000*97001122#', '*155*1*600000*95001122#', '97001122', '95001122')
ON CONFLICT (bot_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- SÉCURITÉ (Row Level Security)
-- Désactivée car on utilise service_role côté serveur uniquement
-- ════════════════════════════════════════════════════════════════
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_payment_configs ENABLE ROW LEVEL SECURITY;

-- Le service_role bypasse le RLS → accès total depuis les API Routes
-- Les utilisateurs n'accèdent JAMAIS directement à Supabase (tout passe par les API Routes)
