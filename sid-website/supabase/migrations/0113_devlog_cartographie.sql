-- =====================================================================
-- 0113 — Devlog : nouvelle tenue de la Cartographie, créatures, météo des
-- lieux, intérieurs (Lot 92). Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-92-carto-tenue', 'carto', 'La Cartographie en terre cuite',
   'Nouvelle tenue : une table en terre cuite semée de lignes de niveau et de roses des vents, de la poussière dorée qui monte, des instruments en cuir liserés d''or et une barre du haut en cartouche de vélin. Chaque évent garde ses couleurs.

Les intérieurs changent aussi : une coupe du bâtiment pour passer d''un étage à l''autre, des plans sur vélin avec leurs sols et leur mobilier, des escaliers qui mènent vraiment quelque part, et des villes avec remparts, quartiers nommés et toits.', 'nouveau', '2026-11-21 22:00+01'),
  ('lot-92-carto-monde', 'carto', 'Créatures, météo des lieux et propriétaires',
   'Certaines créatures ne rôdent plus que là où elles vivent, et certains lieux leur sont fermés. Une créature encore inconnue peut apparaître : le premier qui la signale la révèle dans le Wiki.

Certains lieux ont maintenant leur propre météo : un désert toujours dans le sable, une côte sans neige… Elle compte pour les trajets.

Un bâtiment peut enfin appartenir à un membre, qui en aménage l''intérieur.', 'nouveau', '2026-11-21 22:00+01')
on conflict (slug) do nothing;
