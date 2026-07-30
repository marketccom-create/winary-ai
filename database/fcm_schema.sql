-- ════════════════════════════════════════════════════════════════
-- WINARY AI — Table FCM Push Tokens (Supabase SQL)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  fcm_token     TEXT UNIQUE NOT NULL,
  user_agent    TEXT,
  is_admin      BOOLEAN DEFAULT false,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_is_admin ON fcm_tokens(is_admin);
