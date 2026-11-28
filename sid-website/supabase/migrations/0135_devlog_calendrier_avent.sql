-- =====================================================================
-- 0135 — Devlog : calendrier de l'avent (Lot 103)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-103-calendrier-avent', 'central', 'Calendrier de l''avent',
   'Du 1er au 24 décembre, une case s''ouvre chaque jour avec un mini-jeu : baby-foot, bowling, glouton, casse-cadeaux, traîneau, bataille de boules de neige, pile de cadeaux… 3 essais par case et par jour. Ton meilleur score de chaque case rapporte jusqu''à 1 000 points, plus 100 si tu la joues le jour de son ouverture. Le classement se clôt le 25 décembre ; les récompenses (zénis, renommée, avantages temporaires) sont fixées par l''administration et affichées sur la page.', 'nouveau', '2026-11-28 20:00+01')
on conflict (slug) do nothing;
