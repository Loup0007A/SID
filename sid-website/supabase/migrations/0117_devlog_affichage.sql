-- =====================================================================
-- 0117 — Devlog : réglages d'affichage sur les trois sites (Lot 94)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-94-affichage', 'central', 'Un affichage pour les trois sites',
   'Mode sombre, mode épuré, taille du texte, animations calmes et décors des fêtes se règlent une fois dans Réglages → Affichage, et suivent ton compte : ils valent aussi sur la Cartographie et le Wiki, sur tous tes appareils. « Selon l''appareil » laisse chaque appareil choisir entre clair et sombre.', 'nouveau', '2026-11-21 23:30+01'),
  ('lot-94-affichage-carto', 'carto', 'Mode sombre et mode épuré',
   'Les réglages d''affichage du Dossier Central valent maintenant ici : table de nuit et feuilles en cuir sombre, ou mode épuré (fond uni, sans motif ni ombres, sans décors des fêtes), taille du texte et animations calmes. Le lien « Affichage » du lanceur d''applications y mène.', 'nouveau', '2026-11-21 23:30+01'),
  ('lot-94-affichage-wiki', 'wiki', 'Mode sombre et mode épuré',
   'Les réglages d''affichage du Dossier Central valent maintenant ici : herbier de nuit aux fiches sombres, ou mode épuré (fond uni, sans motif ni ombres, sans décors des fêtes), taille du texte et animations calmes. Le menu propose « Affichage » pour les changer.', 'nouveau', '2026-11-21 23:30+01')
on conflict (slug) do nothing;
