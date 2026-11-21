-- =====================================================================
-- 0119 — Devlog : lisibilité, appareil neuf, téléphone (Lot 95)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-95-lisibilite', 'central', 'Plus lisible, partout',
   'Les textes estompés, les pastilles et les liens posés sur le fond bleu ou sur les cartes ont été foncés ou éclaircis pour se lire sans effort. En mode sombre, les champs de saisie sont sombres eux aussi. Sur un nouvel appareil, ton mode sombre ou épuré s''affiche dès l''ouverture. Les animations peuvent suivre le réglage « réduire les animations » de ton téléphone ou de ton ordinateur (Réglages → Affichage → Selon l''appareil), et c''est le choix par défaut. Sur téléphone, les longs mots ne font plus déborder les sondages et les petits liens sont plus faciles à toucher.', 'amelioration', '2026-11-22 02:00+01'),
  ('lot-95-lisibilite-carto', 'carto', 'Plus lisible, la nuit aussi',
   'Le fond terre cuite est un peu plus profond pour que le texte crème se lise mieux. En mode sombre, le plan de ville est baissé comme sous une lampe et la coupe des bâtiments n''est plus un bloc blanc. Les filtres de quartier sont plus faciles à toucher.', 'amelioration', '2026-11-22 02:00+01'),
  ('lot-95-lisibilite-wiki', 'wiki', 'Plus lisible, la nuit aussi',
   'Le vert du fond est un peu plus profond et les textes posés dessus plus clairs. En mode sombre, les champs et les boutons ne sont plus des rectangles crème. Les statuts des propositions se lisent sur toutes les fiches, et la fiche technique ne déborde plus sur téléphone.', 'amelioration', '2026-11-22 02:00+01')
on conflict (slug) do nothing;
