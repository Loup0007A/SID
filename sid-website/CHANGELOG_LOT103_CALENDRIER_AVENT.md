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

## Ajouts (salle d'essai, graphismes)

- **Salle d'essai** (Administration → Avent) : chaque mini-jeu se lance sans
  passer par le serveur, même pour une case pas encore ouverte. Aucun essai
  consommé, aucun score enregistré, aucun effet sur le classement. Le
  meilleur score d'essai s'affiche à côté du jeu jusqu'au rechargement.
- **Graphismes** : décors (ciel étoilé, collines, village, guirlande, toit),
  sprites redessinés (lutins, bonshommes de neige, rennes, Père Noël,
  paquets à nœud, glouton et lutins du labyrinthe), particules, textes de
  points, secousses et éclairs aux moments forts. Moteur commun dans
  `moteur.ts` (`Effets`, `ciel`, `collines`, `sapin`, `bille`, `etoile`).
  Les règles et les scores ne changent pas.

## Réglages de difficulté (migration 0136)

- **Bowling** : trois appuis (départ, direction, puissance), verglas qui
  fait dériver la boule à chaque lancer (flèche sur la piste), gestes plus
  rapides à chaque manche, quilles qui ne tombent que si elles sont heurtées
  assez fort. 10 points par quille, strike +100, spare +50 (1 000 au plus).
- **Baby-foot** : chaque barre bouge seule (un doigt par barre, la barre la
  plus proche de la souris, ou ↑ ↓ / 1 2 3 puis ← → au clavier).
- **Bataille de boules de neige** : chaque lutin touché accélère le jeu de
  4,5 % (croissance exponentielle, ×4 au plus) ; un bonhomme touché la fait
  redescendre un peu.
- **Glouton** : vitesse exponentielle d'un niveau à l'autre (glouton ×1,10,
  lutins ×1,15, peur ×0,82).
- **Casse-cadeaux** : 2 à 12 points par paquet (+50 par niveau), paquets à
  2 ou 3 coups en haut, boule qui accélère à chaque renvoi, luge qui
  rétrécit.
- **Pile de cadeaux** : 25 points par paquet, 40 pour un dépôt parfait.
- **Traîneau** : consigne de départ lisible (pastille sombre sur la neige).
