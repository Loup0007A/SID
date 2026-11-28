# Lot 103 : calendrier de l'avent

Migrations : `0134_calendrier_avent.sql`, `0135_devlog_calendrier_avent.sql`
(après 0133). Rejouables.

## Pour les membres (Le S.I.D. → Calendrier de l'avent)

- 24 cases, une par jour à partir du 1er décembre (heure de Paris). Une case
  ouverte reste jouable jusqu'à la clôture (25 décembre, 0 h).
- Chaque case lance un mini-jeu à score, dessiné aux couleurs du thème
  choisi. Les 7 premières :
  1. Baby-foot des lutins (match de 90 s)
  2. Bowling des bonshommes de neige (5 manches)
  3. Le Glouton du réveillon (labyrinthe, 3 vies)
  4. Casse-cadeaux (casse-briques, 3 vies)
  5. Le Traîneau (serpent)
  6. Bataille de boules de neige (45 s)
  7. Pile de cadeaux (empilement)
- Doigt, souris ou clavier. 3 essais par case et par jour ; une partie
  abandonnée compte.
- Points d'une case : 1 000 × ton meilleur score ÷ le meilleur score de la
  case, plus 100 si tu l'as jouée le jour de son ouverture. Le classement
  additionne les cases. Les comptes en bac à sable jouent sans être classés.
- La page montre le classement, les récompenses prévues, le podium de
  chaque case et les avantages en cours.
- Notification « Calendrier de l'avent » (réglable) : case du jour ouverte,
  récompense reçue.

## Pour les admins Économie (Administration → Avent)

- Date d'ouverture de la case 1, heure de clôture, essais par jour, bonus du
  jour, calendrier ouvert ou en pause.
- Jeu de chaque case (un jeu peut resservir ; sans jeu : « Bientôt »).
- Récompenses par tranche de rangs, sans chevauchement :
  - zénis (suivent les réformes monétaires) ;
  - renommée ;
  - un avantage temporaire, de 1 h à 90 jours :
    - bouclier anti-farces ;
    - roue doublée : les gains en zénis de la roue du jour sont doublés ;
    - renommée majorée : chaque gain de renommée reçoit un supplément
      de 5 à 200 %.
- Distribution en un clic après la clôture, une seule fois par édition.
  Les gagnants sont prévenus ; les admins sont prévenus à la clôture.
- Parties rejetées par le contrôle des scores, avec le motif.

## Contrôle des scores

Chaque partie est ouverte et fermée par le serveur. Selon le jeu : durée
minimale (sauf score nul), score maximal, score par seconde de jeu. Un
score impossible est refusé et noté.

## Édition suivante

Changer l'année de la date d'ouverture démarre une nouvelle édition :
scores, annonces et distribution repartent de zéro (les anciens restent en
base).
