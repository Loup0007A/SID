-- =====================================================================
-- 0133 — Devlog : faillites, quêtes et trajets programmés (Lot 102)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-102-faillites', 'central', 'Faillites : cessation de paiements',
   'Chaque entreprise paie des frais de fonctionnement chaque semaine. Leur montant suit l''argent en circulation dans le S.I.D. et se règle dans Administration → Économie. Quand la trésorerie passe sous zéro, l''entreprise entre en redressement judiciaire : 7 jours pour se renflouer, sans retrait, dividende, emprunt ni fermeture. Sinon elle est liquidée : son actif paie l''État, puis la banque, puis les actionnaires, et le fondateur ne peut plus créer d''entreprise pendant 30 jours.', 'nouveau', '2026-11-24 20:00+01'),
  ('lot-102-quetes-programmees', 'central', 'Quêtes programmées',
   'Une quête peut avoir une date et une heure de publication. Jusque-là, seuls son auteur et les gestionnaires des quêtes la voient, et personne ne peut s''y inscrire. À l''heure dite, elle apparaît et les membres concernés reçoivent une notification (réglable dans Réglages → Notifications, « Nouvelles quêtes »).', 'nouveau', '2026-11-24 20:00+01'),
  ('lot-102-trajets-programmes', 'carto', 'Trajets programmés',
   'Dans Itinéraire, on peut choisir les routes une à une, ajouter des pauses chronométrées aux étapes, puis partir maintenant ou programmer le trajet : heure de départ à la seconde, ou heure d''arrivée voulue (le départ est alors calculé). Un vol direct se programme aussi. Si le personnage est encore en route à l''heure dite, le trajet part dès son arrivée. La liste des trajets programmés permet de les annuler.', 'nouveau', '2026-11-24 20:00+01')
on conflict (slug) do nothing;
