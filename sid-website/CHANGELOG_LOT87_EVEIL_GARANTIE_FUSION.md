# Lot 87 — Éveil, garantie, tirage ×10, fusion, collection

Migration : `0105_gacha_plus.sql` (après 0104). Peut être relancée.

## Éveil
- Retirer un personnage déjà présent dans le dex l'éveille d'un niveau (5 au
  plus, ★ sur la carte). Les doublons tirés avant ce lot comptent.
- Chaque niveau : +5 % aux trois facteurs (carte de quête, réutilisation,
  allié de raid), +3 points de réussite pour un allié, une protection de plus
  par jour aux niveaux 3 et 5, 10 % de risque d'échec en moins à la
  réutilisation (−50 % au niveau 5).

## Garantie
- Après 50 tirages sans rang A ou mieux, le suivant donne au moins un rang A.
  Compteur séparé pour les renforts et pour chaque simulation, affiché dans la
  fenêtre de tirage et dans l'historique. Réglable (0 la désactive).

## Tirage ×10
- Choix « 1 tirage » / « 10 tirages » dans la fenêtre de recrutement, avec
  10 % de remise par défaut (réglable). Résultats en grille, triés du meilleur
  au moins bon, avec les pastilles Nouveau / Éveil / Garantie. Sur une
  simulation, toucher une carte l'équipe. Sur une quête, au-delà de trois
  renforts, le choix des trois à garder s'ouvre comme avant.

## Fusion
- Dans le dex, « Fusionner 5 cartes » : cinq cartes du même rang et du même
  type (ni Divin, ni équipées) donnent une carte du rang au-dessus. Les cartes
  fusionnées restent dans la collection mais ne servent plus ; les retirer
  les ramène. Nombre de cartes réglable.

## Dex en onglets
- Cartes, Collection (personnages découverts par type et par rang, sur 180
  par rang), Historique (tirages, dépenses, garanties, réutilisations,
  fusions) et Classement des collectionneurs.

## Administration → Économie → Recrutement
- Nouveau bloc « Garantie, tirage ×10 et fusion ».

## Base
- `quest_gacha_draw_n`, `sim_gacha_draw_n` (1 à 10 tirages) ; les anciennes
  fonctions à un tirage restent.
- `dex_fuse`, `dex_collection`, `dex_leaderboard`, `gacha_history`,
  `gacha_pity_left`, `gacha_extra_set`.
- Tables `gacha_pity`, `dex_fusions` ; colonnes `dex_entries.level`,
  `dex_entries.fused_at`, `quest_gacha_draws.pity`.
