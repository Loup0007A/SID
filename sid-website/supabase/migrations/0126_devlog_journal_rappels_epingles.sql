-- =====================================================================
-- 0126 — Devlog : journal du compte, alerte de nouvel appareil, rappels,
-- épingles, contraste renforcé, comparateur du Wiki (Lot 98)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-98-journal', 'central', 'Journal du compte',
   'Dans Mes données, le journal du compte montre ce qui s''est passé sur ton compte depuis un an : connexions avec l''appareil et l''adresse utilisés, sessions fermées, réglages changés, export de tes données, mot de passe changé, et ce que l''équipe a fait sur ton compte (rôle, dispense…). Toi seul le vois.', 'nouveau', '2026-11-22 18:00+01'),
  ('lot-98-appareil', 'central', 'Alerte de nouvel appareil',
   'Une connexion à ton compte depuis un navigateur ou un appareil jamais utilisé t''envoie une notification, aussi en push. Si ce n''est pas toi : ferme la session dans Mes données et change ton mot de passe. Cette notification ne peut pas être coupée.', 'nouveau', '2026-11-22 18:00+01'),
  ('lot-98-rappels', 'central', 'Rappels dans le Calendrier',
   'Le bouton « + Rappel » du Calendrier, ou un clic sur un jour vide, ajoute ton propre rappel : une heure précise ou toute la journée, avec une note. Tu reçois une notification à l''heure dite (à 8 h pour un rappel sur la journée). Les rappels se modifient, se suppriment et partent dans ton agenda comme le reste.', 'nouveau', '2026-11-22 18:00+01'),
  ('lot-98-epingles', 'central', 'Épingles',
   'Épingle un membre (sur sa fiche), une quête, un lieu ou un bâtiment de la Cartographie. Tes épingles s''affichent sur l''accueil et en tête de la recherche (Ctrl+K) sur les trois sites. Les favoris du Wiki comptent comme épingles, et les lieux favoris de la carte aussi : ils suivent maintenant ton compte au lieu de rester sur un seul appareil.', 'nouveau', '2026-11-22 18:00+01'),
  ('lot-98-contraste', 'central', 'Contraste renforcé',
   'Réglages → Affichage → Contraste : « Renforcé » rend les textes estompés pleins, marque les bordures, retire le motif derrière le texte et épaissit le cadre autour de l''élément sélectionné au clavier. « Selon l''appareil » suit le réglage « augmenter le contraste » de ton système. Vaut pour les trois sites.', 'amelioration', '2026-11-22 18:00+01'),
  ('lot-98-comparer', 'wiki', 'Comparer deux fiches',
   'Le bouton « Comparer » d''une fiche, ou le menu, met deux fiches découvertes côte à côte : fiche signalétique alignée ligne à ligne, rareté, mots-clés en commun. Quand deux valeurs sont des nombres de même unité, la plus grande est marquée. L''adresse de la page se partage.', 'nouveau', '2026-11-22 18:00+01')
on conflict (slug) do nothing;
