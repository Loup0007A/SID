-- =====================================================================
-- 0124 — Devlog : Gazette, Calendrier, Carnet de voyage (Lot 97)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-97-gazette', 'central', 'La Gazette',
   'Chaque semaine, la Gazette raconte ce qui s''est passé : nouvelles recrues, quêtes réussies et leurs héros, réputation gagnée, hausses et baisses de la bourse, ventes aux enchères, mariages, résultats des sondages, découvertes du Wiki et de la Cartographie. La semaine en cours se remplit au fil des jours ; les anciennes éditions restent consultables.', 'nouveau', '2026-11-22 12:00+01'),
  ('lot-97-calendrier', 'central', 'Le Calendrier',
   'Un calendrier du mois : échéances des quêtes, fins d''enchères, clôtures de sondages, anniversaires, tes impôts et les événements du jeu. Chaque date peut partir dans ton agenda (téléphone, Google, Outlook…) avec « Ajouter à mon agenda ».', 'nouveau', '2026-11-22 12:00+01'),
  ('lot-97-carnet', 'carto', 'Le carnet de voyage',
   'Le bouton « Carnet » de la barre ouvre ton carnet de voyage : lieux parcourus, découvertes à ton nom, distance parcourue, et chaque arrivée notée au fil de tes trajets. Tu peux écrire une note sur chaque lieu, visible par toi seul. Le carnet s''ouvre aussi sans réseau.', 'nouveau', '2026-11-22 12:00+01')
on conflict (slug) do nothing;
