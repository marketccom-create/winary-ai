-- Exécutez ce script dans l'éditeur SQL de Supabase pour créer la table de messagerie

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('USER', 'ADMIN')),
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Désactivation RLS (car accès API côté serveur en service_role)
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
