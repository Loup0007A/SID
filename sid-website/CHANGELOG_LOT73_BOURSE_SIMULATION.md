# Lot 73 — Graphiques de bourse, onglet Simulation

## À lancer dans Supabase

Dans l'ordre, après 0089 (les deux sont rejouables) :
1. `supabase/migrations/0090_bourse_graphiques.sql`
2. `supabase/migrations/0091_simulation_population.sql`

## 1. Graphiques de la bourse

Nouveau composant `StockChart`, utilisé pour l'indice (en-tête) et pour chaque
valeur. Il remplace `Candles` et la courbe d'indice maison.

- Périodes 1J, 5J, 1M, 6M, 1A, MAX.
  - 1J : la séance du jour (minuit à minuit, heure de Paris). L'axe couvre toute
    la journée et la courbe s'arrête à l'heure actuelle.
  - Les périodes courtes sont calculées depuis les échanges : 15 min (1J),
    1 h (5J), 4 h (1M).
  - Les périodes longues utilisent les bougies journalières, puis
    hebdomadaires au-delà de 200 jours.
- Ligne ou bougies, au choix.
- Couleurs des sites boursiers : vert `#26a69a` à la hausse, rouge `#ef5350` à
  la baisse. Elles sont appliquées partout : cote, carnet, échanges, boutons
  Acheter/Vendre, minicourbes.
- En-tête du graphique : dernier cours et variation (en z et en %) par rapport
  à la clôture de la veille (1J) ou au début de la période.
- Ligne pointillée de référence, avec son cours sur l'axe.
- Étiquette du dernier cours sur l'axe des prix, à droite.
- Volumes en barres sous la courbe.
- Survol : réticule, prix sur l'axe, ouverture/haut/bas/clôture et volume.
- Graduations « rondes ». L'axe s'élargit selon les montants affichés.
- S'adapte à la largeur (mobile compris).

RPC : `market_chart(p_business, p_range)`, `market_index_chart(p_range)`.

## 2. Administration → Simulation

### Vue d'ensemble
- Habitants, argent détenu, solde médian, inégalités (Gini et part des 10 % les
  plus riches), dépenses sur 7 jours, part des actions détenue par la
  population.
- Courbes sur 30 jours (relevé quotidien `sim_daily`) :
  - salaires, achats d'objets et ordres de bourse ;
  - argent détenu ;
  - inégalités.
- Classes : effectif, moyenne, salaire, part de l'argent.
- Humeurs du jour.
- Pyramide des âges.
- Dernières nouvelles : naissances, couples, arrivées, achats et ordres de
  500 z ou plus.

### Habitants
- Tableau trié par colonne, 25 par page.
- Filtres : classe, humeur, nom.
- Un clic ouvre la fiche de l'habitant :
  - solde, salaire, dépensé et reçu sur 30 jours ;
  - chance et ambition ;
  - famille (liens cliquables) ;
  - actions détenues ;
  - derniers faits.

### Pilotage
- Pause / reprise. En pause, aucun jour n'est simulé. À la reprise, les jours
  manqués ne sont pas rattrapés.
- Envie de dépenser et appétit pour la bourse (× 0,2 à × 3).
- Nombre maximum d'habitants.
- Événements à durée limitée, avec une intensité :
  - fête ;
  - crise ;
  - euphorie boursière ;
  - morosité ;
  - réglage libre.

  Ils sont listés avec leur état. Un événement en cours peut être arrêté.
- Prime exceptionnelle, pour tous ou pour une classe. Une confirmation
  affiche le montant total créé.
- Arrivée de nouveaux habitants, au hasard ou pour une classe donnée.

### Comportement
- L'humeur se garde souvent d'un jour à l'autre, et les événements la
  poussent dans un sens.
- Les habitants gardent un quart de leur salaire hebdomadaire de côté avant
  d'acheter.

RPC : `get_population_overview`, `sim_agent_detail`, `sim_set_settings`,
`sim_shock_start`, `sim_shock_end`, `sim_bonus`, `sim_add_agents`.
Réservées à la gestion de l'économie.
