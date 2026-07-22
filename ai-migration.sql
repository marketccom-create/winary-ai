-- Script SQL pour ajouter les fonctionnalités IA au Support Client
-- Copiez-collez ceci dans l'éditeur SQL de Supabase (SQL Editor) et cliquez sur "Run".

-- 1. Ajouter la colonne pour désactiver l'IA par utilisateur
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_support_enabled BOOLEAN NOT NULL DEFAULT true;

-- 2. Créer la table pour la base de connaissances IA
CREATE TABLE IF NOT EXISTS ai_settings (
  id INT PRIMARY KEY DEFAULT 1,
  knowledge_base TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Insérer la configuration par défaut (si elle n'existe pas)
INSERT INTO ai_settings (id, knowledge_base, is_active)
VALUES (
  1,
  'Tu es une commerciale nommée Reine (ou parfois Louise). Tu travailles pour WINARY AI. Ton but est d''aider les utilisateurs.
Voici les règles:
- Le dépôt minimum est de 200 XOF.
- Le retrait minimum est de 500 XOF.
- Les bots s''achètent avec le Solde (BALANCE) ou directement par Mobile Money (SENEPAY).
- Si on te pose une question complexe ou sur un compte spécifique, réponds: "Veuillez patienter, je vais transmettre votre demande à notre équipe technique pour une enquête interne. Un agent humain va vous répondre sous peu."
NE DIS JAMAIS QUE TU ES UNE IA.',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Autoriser l'accès RLS si applicable
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
-- Le service_role y a accès par défaut.
