# Lot 27 — Raids de boss et dragon (Donjons)

Migration : `supabase/migrations/0053_boss_raids.sql` (après 0052).

## Raid
- Mort face au gardien d'une île (jeu ouvert depuis le S.I.D.) : l'écran
  « Évanoui » propose **⚔️ Demander de l'aide (raid)**.
- Le S.I.D. ouvre un raid (30 min) et envoie une notification « ⚔️ X appelle
  à l'aide ! » à tous les membres actifs ; la page Donjons liste les raids en
  cours avec un bouton **Rejoindre**.
- L'allié arrive directement sur l'île du boss, avec les compétences de
  l'histoire jusqu'à ce chapitre (sans toucher à sa propre sauvegarde ni à sa
  limite du jour ; aider ne rapporte pas de point).
- Temps réel : Supabase Realtime (canal broadcast « raid:<id> »), relayé par
  la page du S.I.D. ; le jeu n'a aucune clé. Les joueurs se voient (silhouette
  colorée + pseudo), le boss est piloté par celui qui a appelé à l'aide, et
  les dégâts de chacun sont additionnés. PV du boss : +60 % par allié.
- Boss vaincu : le portail s'ouvre pour l'hôte (son île compte normalement),
  les alliés retournent à la liste des histoires.

## Dragon
- À partir de 90 de Puissance, le gardien est un **dragon** : il vole en
  cercle, plonge sur sa cible (cercle d'avertissement), se pose quelques
  secondes (le moment de frapper) et crache des gerbes de feu. PV ×1,9 par
  rapport au gardien normal. En raid, le dragon dépend de la Puissance de
  celui qui appelle à l'aide.
