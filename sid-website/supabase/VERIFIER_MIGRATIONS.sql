-- =========================================================
-- À coller dans Supabase -> SQL Editor AVANT d'exécuter 0047 et 0048.
-- Vérifie que chaque migration récente est bien présente en base : une
-- ligne par migration, "true" = appliquée.
--
-- Pourquoi : 0038 et 0039 contenaient chacune une erreur (corrigée dans
-- ce lot) qui pouvait les faire échouer ENTIÈREMENT à l'exécution, sans
-- que rien ne casse visiblement sur le site.
--
--  - Tout est à true : exécute simplement 0047 puis 0048.
--  - Au moins un false : ne lance rien d'autre, envoie-moi le résultat ;
--    certaines migrations ne peuvent pas être rejouées deux fois, je te
--    donnerai l'ordre exact à suivre selon ce qui manque.
-- =========================================================

select migration, appliquee from (values
  ('0037 puissance + protections',  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'power_score')),
  ('0038 bourse réaliste',          exists (select 1 from pg_proc where proname = 'process_market')),
  ('0039 outils admin',             exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'announcements')),
  ('0040 statistiques (fuseau)',    exists (select 1 from pg_proc where proname = 'stats_timezone')),
  ('0041 trajets obligatoires',     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'character_positions' and column_name = 'spawned')),
  ('0042 CSS des profils',          exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profile_styles')),
  ('0043 création par mise',        exists (select 1 from pg_proc where proname = 'create_business' and pronargs = 3)),
  ('0044 simulation',               exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sim_agents')),
  ('0045 croissance des actions',   exists (select 1 from pg_proc where proname = 'process_business_growth')),
  ('0048 journal d''audit (après)', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'audit_log'))
) as t(migration, appliquee);
