# Lot 79 — Reversement des impôts aux fondateurs

## À lancer dans Supabase

`supabase/migrations/0096_impots_fondateurs.sql`, après 0095 (rejouable).

## Qui touche la part admin

Chaque semaine, la caisse commune (TVA, impôts, amendes, frais de dossier,
frais de bourse, pénalités d'absence) est répartie :

- 80 % aux admins (`tax_admin_share`) ;
- 20 % aux entreprises ouvertes (`tax_business_share`).

La part admin des frais de courtage (par action achetée) suit la même règle.

| | Avant | Maintenant |
| --- | --- | --- |
| Part admin | tout compte actif avec « Gérer les comptes » (modérateurs compris), y compris un compte de test qui avait cette permission | les comptes actifs au **grade Fondateur** (rôle « Fondateur » ou statut fondateur), jamais un compte de test |

## Ce qui n'est pas versé reste dans la caisse

- Les centimes d'arrondi : les parts sont arrondies au centime inférieur.
- La part admin s'il n'y a aucun fondateur actif.
- La part entreprises s'il n'y a aucune entreprise ouverte.

Avant, la caisse était remise à zéro et ces montants disparaissaient. Pour
les frais de courtage, ces montants vont aussi dans la caisse.

## Affichage

- **Administration → Économie → Impôts** :
  - répartition en vigueur ;
  - liste des fondateurs qui touchent la part admin ;
  - avertissement s'il n'y en a aucun.
- **Bourse** : les frais par action achetée sont indiqués « versés aux
  fondateurs ».

Le motif du mouvement reste « Reversement des impôts/TVA (part admin) », pour
ne pas casser les exemptions d'alertes déjà posées sur ce motif.

## RPC

- `_tax_founders()` (interne) : fondateurs qui touchent la part admin.
- `process_weekly_taxes()` et `credit_admins_equally()` réécrites.
- `get_tax_pool_status()` renvoie aussi `admin_share`, `business_share`,
  `founders` et `open_businesses`.
