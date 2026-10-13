# Lot 26 — Donjons : la puissance monte à chaque île

- Le jeu 3D (dépôt 3D-game-world) envoie un résultat à la fin de **chaque
  chapitre (île)**, plus seulement à la fin d'une histoire (≈ 3 h de jeu) :
  chaque île terminée = +1 Puissance.
- Une réussite compte toujours, même si la tentative avait commencé
  longtemps avant (partie reprise depuis une sauvegarde) : auparavant le
  S.I.D. l'écartait comme « tentative commencée avant la partie ».
- Migration `0052_donjons_chapitres.sql` : niveau Donjons réglé par l'admin
  = N îles → histoires 1 à N/10 marquées terminées dans le jeu.
- Jeu 3D : Échos beaucoup plus forts (PV ×1,8, dégâts ×1,7, vitesse ×1,4,
  repèrent de plus loin, plus nombreux) et TOUS attaquent à distance :
  projectiles en cloche (slimes, roi en éventail, cracheur en rafale),
  traits rapides (givre, feu follet, ombre), rochers (golem), salves du
  gardien dès la phase 1. Chaque tir est annoncé par un bref éclat (0,4 s).
  Réglage : constante `BUFF` en haut de `src/entities/slimes.js`.
