# Lot 84 — Boîtes chanceuses et nouveaux effets d'objets

## À lancer dans Supabase

Dossier Central : `supabase/migrations/0101_boites_chanceuses.sql`, après
0100. Rejouable.

## Boîtes chanceuses

### Confectionner une boîte

Comptoir → Nouvel objet → **Boîte chanceuse**. Pour les vendeurs du
comptoir, comme les objets.

- **Fiche** : nom, description, prix d'une ouverture, visibilité, vendeur
  (toi ou une de tes entreprises), image. Sans image, une boîte dessinée
  s'affiche.
- **Contenu** : tes propres objets, vendus au même nom que la boîte. Autant
  d'objets différents que tu veux (60 au plus), avec un nombre
  d'exemplaires pour chacun.
- **Chances** : chaque exemplaire restant a la même chance de sortir.
- **Stock** : les exemplaires mis en boîte sortent du stock de l'objet s'il
  est limité. Ils y reviennent si tu les retires de la boîte ou si tu
  supprimes la boîte.
- **Objets réservés aux boîtes** : à la création d'un objet, la case
  « Réservé aux boîtes chanceuses » le crée hors vente. On ne peut alors
  l'obtenir qu'en ouvrant une boîte.

### Pour l'acheteur

- **Vitrine** : badge « Boîte chanceuse », filtre « Boîtes chanceuses ».
  Seule information affichée : combien de personnes l'ont ouverte.
- **Ouvrir la boîte** :
  - le paiement suit les règles d'un achat (TVA, part du vendeur, solde
    négatif bloquant) ;
  - la boîte tremble, puis l'objet obtenu apparaît ;
  - « En ouvrir une autre » relance tout de suite.
- **Mes achats** : l'objet gagné y est rangé, avec « Gagné dans « … » ».
  Les objets à effet gagnés se retrouvent avec les autres, prêts à servir.
- **Ce qui ne marche pas avec une boîte** : l'offrir, la payer en frais
  d'entreprise, la revendre ou la mettre aux enchères, en faire un lot de
  la roue. La base refuse aussi ces cas.
- **Boîte vide** : elle quitte la vitrine. Si le vendeur la remplit, elle
  revient, et ceux qui l'avaient en souhait sont prévenus.

### Pour le vendeur (et l'administration du comptoir)

Mes objets en vente → la boîte :
- personnes, ouvertures, exemplaires restants ;
- pour chaque objet : restants sur mis, sortis, chance actuelle ;
- derniers tirages (qui a eu quoi) ;
- « Modifier la boîte et son contenu » : fiche, prix, exemplaires restants
  de chaque objet, ajout ou retrait d'objets.

Personne d'autre ne peut lire le contenu, même en interrogeant la base.

## Nouveaux effets d'objets (admins)

À la création d'un objet, ou plus tard dans « Mes objets en vente » :

| Effet | Réglage | Ce que fait un exemplaire |
|---|---|---|
| Réinitialisation des délais | — | Efface les délais d'attente des simulations (comme avant) |
| Soin | — | Guérit les blessures de simulation |
| Bouclier anti-farces | durée, 1 à 168 h | Arrête les farces en cours contre toi et t'en protège pendant la durée choisie |
| Renommée | points, 1 à 1 000 | Ajoute ces points de renommée |
| Clé de la faille | — | Ouvre L'Envers de la Cartographie, comme si tu venais de trouver la faille (durée réglée dans L'Envers) |

### Utilisation

Chaque exemplaire s'utilise une fois, depuis **Mes achats → Tes objets à
effet**. La réinitialisation s'utilise aussi depuis la page d'une
simulation.

Si l'effet ne peut pas servir, rien n'est consommé : pas de blessure, faille
refermée, ou bouclier de l'administration déjà posé.

### Boucliers

- Un bouclier acheté s'ajoute à un bouclier encore actif.
- Un bouclier posé par l'administration reste sans limite de durée, même
  par-dessus un bouclier acheté.
- La page Titres affiche la fin du bouclier.

## Sécurité

Avant, un membre pouvait créer lui-même une ligne d'achat sans payer. Il
recevait ainsi les objets à effet gratuitement. C'est fermé : tous les
achats passent par les fonctions du comptoir.

## Technique

- **Colonnes** :
  - `shop_items` : `kind` (`item` ou `box`), `box_buyers` (public),
    `effect_value` ;
  - `purchases.box_id` (boîte d'origine) ;
  - `member_consumables.power` ;
  - `troll_shields` : `expires_at` et `source`.
- **Tables** : `shop_box_contents` et `shop_box_draws`, lisibles par le
  vendeur et `manage_shop`, plus les tirages de chacun.
- **Fonctions** : `shop_box_save`, `shop_box_open`, `shop_box_details`,
  `my_consumables`, `use_item_effect`.
- **Farces** : `launch_troll`, `my_trolls`, `troll_status` et
  `set_troll_shield` tiennent compte de la fin des boucliers.
