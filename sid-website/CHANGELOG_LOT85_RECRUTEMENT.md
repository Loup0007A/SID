# Lot 85 — Puissance globale et recrutement de renforts

## À lancer dans Supabase

`supabase/migrations/0102_recrutement.sql`, après 0101. Rejouable.

## Puissance globale

- Nouvelle case **« Puissance globale »** dans le formulaire de quête.
- Les prérequis (Intelligence, Puissance, Technique, Puissance globale) se
  comparent à la **somme des participants** et de leurs renforts. Ils
  peuvent dépasser 100.
- Tout le monde peut prendre la mission, sans prérequis personnels (le lieu
  reste exigé).
- Le **premier rapport** ne se rend qu'une fois la puissance réunie.
- Sous la fiche : jauges de puissance réunie, détail par participant, et
  renforts de chacun.
- Sans la case, rien ne change : prérequis personnels, 100 au plus.

## Recrutement

- Réservé aux participants d'une quête à puissance globale.
- Un tirage coûte le prix fixé par l'administration, payé même si personne
  ne répond.
- **Bonus de chance ×1 à ×10** : multiplie les chances des rangs D à Divin.
  Les tirages ratés diminuent d'abord, puis le rang E. Prix : prix ×
  k^(ln 4,8 / ln 5), donc ×5 → 4,8 fois le prix, ×10 → 9,43 fois.
- Le personnage tiré a un nom, un rang et trois facteurs selon le rang
  (E : 3 à 12 … S : 72 à 95, Divin : 120 à 200). Sa puissance globale est
  leur moyenne.
- **Trois renforts au plus** par membre et par quête. Au quatrième, il faut
  choisir lesquels garder (au moins un). Les autres sont supprimés, sans
  remboursement. Pas de nouveau tirage avant ce choix.
- Un renfort S ou Divin prévient les autres participants (notification
  « Renforts recrutés »).
- Quitter la quête supprime ses renforts.

## Chances

Réglées dans **Administration → Économie → Recrutement** : chance d'un rang
E (« 1 sur 2 »), d'un rang Divin (« 1 sur 1 000 000 ») et prix du tirage.
Les rangs D à S suivent une suite géométrique entre les deux :

| Rang | ×1 | ×5 | ×10 |
|---|---|---|---|
| Divin | 1 / 1 000 000 | 1 / 200 000 | 1 / 100 000 |
| S | 1 / 112 246 | 1 / 22 449 | 1 / 11 225 |
| A | 1 / 12 599 | 1 / 2 520 | 1 / 1 260 |
| B | 1 / 1 414 | 1 / 283 | 1 / 141 |
| C | 1 / 159 | 1 / 32 | 1 / 16 |
| D | 1 / 18 | 28,1 % | 56,1 % |
| E | 50 % | 50 % | 36,8 % |
| Raté | 43,7 % | 18,4 % | 0 |

Des réglages dont les chances dépasseraient 100 % sont refusés.

## Sécurité

- Renforts et tirages ne s'écrivent que par `quest_gacha_draw` et
  `quest_cards_keep`. Le tirage est fait par la base.
- Les renforts en attente de choix ne sont visibles que par leur
  propriétaire.
- Réglages : permission « Gérer l'économie ».
