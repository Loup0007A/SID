# Lot 75 — Validation des réformes, objectif de ventes automatique

## À lancer dans Supabase

`supabase/migrations/0092_safeupdate_objectif_auto.sql`, après 0091 (rejouable).

La réforme restée « en attente » après l'erreur n'a pas été appliquée : il
suffit de la valider à nouveau.

## 1. « DELETE requires a WHERE clause » à la validation d'une réforme

Supabase charge l'extension `safeupdate` pour tous les appels du site. Elle
refuse tout `DELETE` ou `UPDATE` sans `WHERE`, même à l'intérieur d'une
fonction. La validation d'une réforme vidait une table temporaire avec
`delete from _reform_wallets;`, d'où l'erreur. La base locale de test
n'avait pas cette extension.

Ajout d'une clause `WHERE` dans les trois fonctions concernées, sans autre
changement :
- `_reform_apply` : validation d'une réforme (6 requêtes) ;
- `sim_process_day` : le 1er janvier, quand les habitants simulés vieillissent
  d'un an ;
- `economy_update` : réindexation des salaires de la population simulée.

Toutes les fonctions du site, de la carte et du wiki ont été passées au
crible. Les tests se font maintenant avec `safeupdate`, chargé comme sur
Supabase.

## 2. Objectif de ventes hebdomadaire des entreprises

`app_config.business_min_weekly_revenue` :

| Valeur | Effet |
| --- | --- |
| > 0 | objectif fixe |
| 0 | objectif automatique |
| < 0 | aucune faillite |

### Calcul automatique
- 40 % des ventes hebdomadaires médianes des entreprises ouvertes depuis au
  moins 7 jours, mesurées sur 4 semaines.
- Les ventes passées sont converties en zénis d'aujourd'hui, en tenant
  compte des réformes.
- L'objectif reste entre 10 % et 200 % de la base indexée sur les prix
  (`econ_base_business_min_weekly_revenue` × indice / 100).
- Avec moins de 3 entreprises mesurables, l'objectif est cette base.
- Arrondi à 50 z, recalculé chaque jour.
- Le pourcentage se règle avec `business_min_weekly_auto_share` (0,4).

### Changements de comportement
- Un objectif fixe ne suit plus l'indice des prix : la banque centrale n'y
  touche plus.
- Une réforme monétaire réduit l'objectif fixe comme les autres seuils ;
  elle ne touche pas aux modes automatique et désactivé.

### Interface
- **Administration → Économie → Entreprises** : choix Automatique / Fixe /
  Aucun.
  - Automatique : le détail du calcul est affiché.
  - Fixe : la valeur automatique est indiquée pour comparaison.
  - Chaque changement est inscrit au journal d'audit.
- **Page Entreprise (fondateur)** :
  - sans objectif, « aucune faillite possible » s'affiche ;
  - en automatique, une ligne explique d'où vient l'objectif.
- **Page Banque centrale** : « aucun » quand il n'y a pas d'objectif.
- Les textes de la banque centrale et du tutoriel ne parlent plus de seuil
  indexé.

RPC : `business_min_status()`, `business_min_set(p_mode, p_amount)` (gestion
de l'économie), `business_weekly_minimum()`.
