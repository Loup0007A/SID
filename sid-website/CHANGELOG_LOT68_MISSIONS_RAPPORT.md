# Lot 68 — Missions à cocher, rapport en parties

## À lancer dans Supabase

`supabase/migrations/0083_quetes_missions.sql` (rejouable).

## Quêtes

- Sur la fiche d'une quête prise, chaque mission (objectif) a sa case. Le
  participant la coche quand il l'a menée. Le compteur « Missions 2/3 » et
  le texte barré montrent où il en est.
- Le rapport a une partie par mission, plus un bilan facultatif. La fenêtre
  indique quelles missions sont déjà cochées. Pour une quête sans mission,
  le rapport reste d'un seul bloc.
- Il faut au moins 20 caractères écrits en tout ; les titres des missions ne
  comptent pas. Une partie est limitée à 2 000 caractères, le bilan à 4 000.
- Le commanditaire voit l'avancement de chaque participant (barre « 2/3 ») et
  lit les rapports mission par mission. Les Chroniques aussi.
- Un rapport écrit avant ce lot devient le bilan quand on le rouvre.
- Le texte complet (un titre par mission) reste enregistré dans `report`.
  La notification et les anciennes pages le lisent d'un bloc.
- Comme les autres colonnes d'une participation, les cases cochées et les
  parties ne se modifient que par les fonctions de la base.

## Vérifié

- 17 scénarios SQL : cocher, décocher, mission inconnue, non-participant,
  modification directe refusée, longueurs, notification unique, lecture par
  le commanditaire, quête sans mission.
- Parcours dans le navigateur : cocher une mission, rédiger et remettre le
  rapport, le lire côté commanditaire.
