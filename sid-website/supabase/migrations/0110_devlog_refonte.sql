-- =====================================================================
-- 0110 — Devlog : refonte visuelle du Dossier Central (Lot 90)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-90', 'central', 'Nouvelle tenue pour le Dossier Central',
   'Le Dossier Central change de tête : fond bleu roi semé d''éclats du sceau, petits éclats qui tombent, cartes crème à gros contour et ombre pleine, boutons qui s''enfoncent au clic, nouvelle police.

Chaque évent a maintenant ses couleurs, son motif et ses particules : flocons sur fond rouge à Noël, chauves-souris sur fond orange à Halloween, cœurs à la Saint-Valentin, poissons et bulles le 1er avril, œufs et fleurs à Pâques, muguet le 1er mai, notes à la Fête de la musique, feux d''artifice le 14 juillet, bleuets et coquelicots le 11 novembre, braises pendant la Grande Chasse, étoiles et confettis pour l''élection. Les guirlandes, les passages (traîneau, Cupidon, Brasombre…) et les surprises du pied de page restent.', 'nouveau', '2026-11-21 18:00+01')
on conflict (slug) do nothing;
