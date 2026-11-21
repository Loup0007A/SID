-- =====================================================================
-- 0112 — Devlog : élection prise par la force, refonte du Wiki (Lot 91)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-91-force', 'central', 'Coup d''État possible',
   'Le prochain Dictateur ne sera peut-être pas proclamé : il peut aussi prendre le pouvoir par la force. Personne ne le saura avant l''heure dite.

Si c''est le cas, tout passe au rouge sang : alarme, bandes d''alerte, cérémonie de coup d''État et alerte envoyée à tout le S.I.D. Le titre reste le même : Dictateur.', 'nouveau', '2026-11-21 20:00+01'),
  ('lot-91-wiki', 'wiki', 'Nouvelle tenue pour le Wiki',
   'Le Wiki devient un herbier : fond vert d''eau semé de fougères, plumes, ammonites et scarabées, feuilles qui tombent, fiches en parchemin à gros contour.

Chaque évent a ses couleurs et ses particules, comme sur le Dossier Central. Si le Dictateur prend le pouvoir par la force, le Wiki passe aussi au rouge.', 'nouveau', '2026-11-21 20:00+01')
on conflict (slug) do nothing;
