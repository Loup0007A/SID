# Lot 66 — Notifications, alertes, souhaits et cadeaux, mariages

## À lancer dans Supabase (dépôt sid-website)

1. `supabase/migrations/0080_encheres_sondages.sql` s'il n'a pas encore été lancé.
2. `supabase/migrations/0081_notifications_souhaits_mariages.sql` (rejouable).

0081 active `pg_cron` s'il est disponible sur le projet, et y inscrit la tâche
`sid_jobs_minute` (une fois par minute). Sans pg_cron, les mêmes tâches
tournent quand un membre a le site ouvert.

## Rapport de la semaine (accueil)

Le « Rapport de situation » ne revient plus après chaque absence de 45 minutes.
Il paraît le vendredi à 18 h (heure de Paris) et couvre les sept jours écoulés.
Il reste affiché jusqu'à « Classer le rapport », puis revient le vendredi suivant.

## Notifications

- Les petites rentrées d'argent du même jour (moins de 500 z, réglable :
  `app_config.notif_group_threshold`) forment une seule notification non lue,
  avec « Voir le détail ». Un seul push, pour la première rentrée du groupe.
  Une notification lue ferme le groupe, et la suivante en ouvre un nouveau.
- Les salaires et les grosses sommes gardent leur propre notification.
- Les remboursements et les ventes aux enchères n'envoient plus « Argent reçu »
  en plus de la notification de l'enchère.
- La page est triée par jour (Aujourd'hui, Hier, puis la date).
- Depuis la page Notifications, la cloche et le bouton « Retour » ramènent à la
  page d'avant.
- Une notification s'efface 7 jours après le premier passage du membre sur le
  site. Un membre absent garde les siennes jusqu'à son retour, avec un plafond
  de 90 jours.

## Alertes d'activité

Le bouton « Normal » range l'alerte et crée une exception pour ce membre et ce
genre d'alerte. Pour les gros montants, l'exception ne vaut que pour le même
motif : « Reversement des impôts/TVA (part admin) » cesse d'alerter, mais un
« Ajustement manuel » alerte toujours. Les alertes couvertes par une exception
sont classées d'office (onglet « Ignorées ») et ne préviennent plus personne.
La liste « Exceptions » permet de les réactiver.

## Statistiques admin

Nouvelles rubriques :
- membres : nouveaux, venus, endormis, fidélité, courbe sur 8 semaines ;
- richesse : solde médian, part des 10 % les plus riches, soldes négatifs,
  les 5 plus riches ;
- d'où vient l'argent sur 30 jours ;
- enchères, sondages, cadeaux et souhaits ;
- alertes par genre ;
- notifications envoyées par type ;
- mariages.

## Boutique : souhaits et cadeaux

- Le cœur sur un objet l'ajoute à « Souhaits » (onglet). Tu es prévenu quand
  il revient en stock ou passe aux enchères.
- La liste d'un membre est visible des autres, ce qui permet de lui offrir un
  objet qu'il a demandé.
- « Offrir à un membre » se trouve dans la fiche d'un objet. Tu paies, l'autre
  reçoit l'objet dans « Mes achats », marqué « Offert par… » avec ton mot.
  Un objet à effet donne son effet à celui qui le reçoit. Les membres qui ont
  souhaité l'objet apparaissent en premier dans la liste.

## Sondages programmés

- Champ « Publication » : le sondage reste invisible des membres jusqu'à la
  date choisie, et la notification part à ce moment-là.
- Les admins le voient dans « Programmés », avec « Publier maintenant ».

## Enchères

Chaque enchérisseur reçoit un rappel 10 minutes avant la fin d'une vente. Le
message lui dit s'il est en tête.

## Mariages (`/dashboard/mariage`)

- Un membre fait sa demande : il choisit qui, l'alliance (or jaune, argent,
  or rose, ébène et or) et écrit une promesse.
- L'autre dit oui, avec sa propre promesse, ou décline.
- Une fois l'union acceptée :
  - elle est inscrite au registre avec un numéro d'acte ;
  - le livret d'union s'ouvre la première fois ;
  - les autres demandes de chacun des deux tombent.
- Les autres membres peuvent laisser un mot de félicitations : un mot par
  membre, modifiable.
- L'un des deux peut mettre fin à l'union. L'administration peut l'annuler.
- La page reste réservée aux admins jusqu'au bouton « Dévoiler à tous », dans
  Modération → Pages en aperçu. Pendant l'aperçu, seuls des admins peuvent se
  demander en mariage entre eux.

## Vérifié

- 70 scénarios SQL sur une copie locale de la base :
  - regroupement et durée de vie des notifications ;
  - exceptions d'alerte ;
  - souhaits et cadeaux (débit, TVA, stock) ;
  - sondages programmés : invisibles par la liste et par la table ;
  - rappels d'enchère, une seule fois ;
  - droits et cas d'erreur des mariages ;
  - accès refusé aux fonctions internes.
- Build Next.
- Captures sur ordinateur et iPhone. Parcours testés : cloche → Notifications
  → retour à la page d'avant, et demande en mariage → « Dire oui » → ouverture
  du livret.
