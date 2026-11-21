-- =====================================================================
-- 0115 — Devlog : Réglages refaits, mode sombre et mode épuré (Lot 93)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-93-reglages', 'central', 'Réglages refaits',
   'Les Réglages rangent maintenant tout ce qui te concerne : apparence de ta fiche, notifications, affichage, confidentialité, compte et guide.

Apparence : des styles prêts en un clic (Or impérial, Néon, Braise, Givre…), un aperçu en direct sur le fond du site, et « Appliquer aux 4 places ».

Notifications : pour chaque sujet, partout, sur le site seulement ou jamais, et des heures calmes sans push. Les quêtes, sanctions, annonces et impôts arrivent toujours.

Affichage : mode sombre, mode épuré (fond uni, sans motif, ombres ni décors), taille du texte, animations calmes. Ces réglages valent pour l''appareil.', 'nouveau', '2026-11-21 23:00+01')
on conflict (slug) do nothing;
