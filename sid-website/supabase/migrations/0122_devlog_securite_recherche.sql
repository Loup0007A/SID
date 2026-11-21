-- =====================================================================
-- 0122 — Devlog : sécurité, recherche commune, appareils, Carto hors ligne (Lot 96)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-96-securite', 'central', 'Tes données mieux gardées',
   'Les champs que tu masques sur ton dossier (prénom, nom, âge, armes…) ne sont plus envoyés aux autres membres, même en coulisses. Sans être connecté, plus rien du jeu n''est lisible à part l''accueil. Les sanctions ne peuvent plus être levées que par la gestion des comptes. Dans « Mes données », tu vois maintenant les appareils où ton compte est ouvert et tu peux en déconnecter un, et l''export contient tout ce qui est lié à ton compte, y compris les nouveautés récentes (sondages, enchères, exploration…).', 'amelioration', '2026-11-22 03:00+01'),
  ('lot-96-recherche', 'central', 'Une recherche pour les trois sites',
   'Ctrl+K (ou la loupe) cherche maintenant aussi dans les fiches du Wiki et les lieux de la Cartographie que tu as découverts. Sur le Wiki et la Carto, le bouton « Trois sites » ou Ctrl+K fait la même chose, membres, quêtes et Comptoir compris.', 'nouveau', '2026-11-22 03:00+01'),
  ('lot-96-carto', 'carto', 'La carte sans réseau',
   'La carte s''ouvre même sans réseau : tu retrouves la dernière version vue, avec un bandeau qui dit de quand datent les données. Les trajets et les achats reprennent quand le réseau revient. Le bouton « Trois sites » (ou Ctrl+K) cherche un lieu, une fiche du Wiki ou un membre.', 'nouveau', '2026-11-22 03:00+01'),
  ('lot-96-wiki', 'wiki', 'Chercher sur les trois sites',
   'Le bouton « Trois sites » (ou Ctrl+K) cherche en même temps dans le Wiki, les lieux de la Cartographie que tu as parcourus et le Dossier Central.', 'nouveau', '2026-11-22 03:00+01')
on conflict (slug) do nothing;
