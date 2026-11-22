# Lot 97 — La Gazette, le Calendrier, le Carnet de voyage

## À lancer dans Supabase

Dans cet ordre, après celles du Lot 96 :

1. Cartographie `0122_carnet_de_voyage.sql`
2. Dossier Central `0123_gazette_calendrier.sql`
3. Dossier Central `0124_devlog_gazette_calendrier_carnet.sql`

Toutes peuvent être relancées.

## La Gazette (Dossier Central, rubrique « Le S.I.D. »)

L'édition de la semaine, du lundi au dimanche : la une (le fait le plus
marquant), quelques chiffres, nouvelles recrues, quêtes réussies et leurs
héros, réputation gagnée, plus fortes hausses et baisses de la bourse,
enchères adjugées, mariages, sondages clos (option en tête, jamais les
votants), découvertes du Wiki et de la Cartographie, annonces. La semaine en
cours se remplit au fil des jours ; les éditions précédentes restent
consultables.

- Les comptes invisibles n'apparaissent nulle part.
- Un lieu de la Carto découvert par quelqu'un mais pas encore parcouru par le
  lecteur reste « un lieu que tu n'as pas encore exploré » (brouillard).
- Calculée à la demande (`gazette()`), sans table ni tâche planifiée.

## Le Calendrier (Dossier Central, rubrique « Le S.I.D. »)

Le mois en grille (points de couleur sur téléphone) et la liste des dates :
échéances des quêtes visibles, fins d'enchères, clôtures de sondages (« À
voter » si tu n'as pas voté), anniversaires, tes impôts, événements du jeu
(Halloween, Noël, élection…). Filtres par type. « Ajouter à mon agenda » (une
date ou tout le mois) donne un fichier .ics, fabriqué dans le navigateur, que
le téléphone, Google Agenda ou Outlook savent ouvrir ; les anniversaires y
reviennent chaque année.

## Le Carnet de voyage (Cartographie, bouton « Carnet »)

- Chiffres : lieux parcourus sur le total, découvertes à ton nom, kilomètres
  parcourus en trajet, nombre d'étapes.
- Étapes : chaque arrivée dans un lieu, avec le lieu de départ, jour par jour.
  Elles commencent avec la migration 0122 ; les lieux parcourus avant sont
  dans l'onglet « Lieux parcourus » (date de première visite).
- Une note par lieu, visible par toi seul.
- Lisible sans réseau (comme la carte, Lot 96).
- Le carnet et les notes entrent dans l'export de « Mes données ».
