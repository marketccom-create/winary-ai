-- ════════════════════════════════════════════════════════════════
-- WINARY AI — Configuration Supabase Realtime pour Chat WhatsApp
-- Exécutez cette commande dans Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- Activer la publication en temps réel Supabase Realtime sur la table support_messages
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;

-- Vérification de l'activation
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
