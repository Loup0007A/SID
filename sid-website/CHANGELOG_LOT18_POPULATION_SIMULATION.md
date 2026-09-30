# Simulation de population — résumé

Fichiers **nouveaux uniquement**, à copier par-dessus ton repo (mêmes
chemins), à la suite du lot précédent. Un seul ajout manuel requis (étape 2).

## 1. Migration SQL

`supabase/migrations/0044_population_simulation.sql` — teste de bout en
bout (seeding, 200+ jours simulés, salaires, achats, mise en couple,
naissances, plafond de population), voir le détail plus bas.

## 2. Un lien à ajouter à la main dans `src/app/dashboard/layout.tsx`

Dans le tableau `NAV`, ajoute cette ligne (par exemple juste après la ligne
`"/dashboard/admin/stats"`) :

```tsx
{ href: "/dashboard/admin/simulation", label: "Simulation", perm: ["manage_economy"] },
```

Je ne l'ai pas patché automatiquement cette fois pour ne pas risquer de
mal recoller sur ta version actuelle du fichier (déjà modifiée plusieurs
fois manuellement depuis les derniers lots) — un copier-coller d'une ligne
est plus sûr.

## Comment ça marche

- **100 habitants simulés** au départ (pas de vrais comptes, pas de
  connexion) — un bouton "Initialiser la population" les crée. Chacun a :
  prénom, nom, âge, sexe, classe sociale, salaire hebdomadaire, solde,
  chance et ambition (les "traits caractéristiques"), une humeur re-tirée
  chaque jour, et **la possibilité d'avoir un enfant** (trait individuel,
  tiré à 85% de chances à la création).
- **Répartition demandée** : 16 % pauvre (200 Cr./sem.), 74 % moyen
  (1000 Cr./sem.), 10 % aisé (2500 Cr./sem.), 2 % riche (10 000 Cr./sem.) —
  les pourcentages totalisant 102 %, ils sont automatiquement ramenés à
  100 % au tirage. Vérifié sur 100 habitants : répartition conforme aux
  proportions attendues.
- **Chaque jour simulé**, pour chaque habitant : salaire versé (proraté
  par jour), nouvelle humeur tirée (Radin/Neutre/Dépensier/Généreux/Inspiré
  — modifie sa probabilité d'achat et la part de son solde qu'il dépense),
  et éventuellement un achat **réel** : un objet de la VRAIE boutique
  (stock, TVA, reversement au vendeur ou à l'entreprise liée) ou des
  actions d'une VRAIE entreprise cotée (même mécanique d'impact sur le
  cours que pour un joueur, alimente le VRAI historique de cours) — la
  population fait donc vraiment vivre le marché construit dans les lots
  précédents.
- **Les habitants "riches" paient deux fois plus de taxes** (TVA sur leurs
  achats, frais de courtage sur leurs actions) que les autres classes.
- **Couples et naissances** : petite chance quotidienne qu'un célibataire
  se mette en couple ; puis petite chance quotidienne qu'un couple ait un
  enfant (si les deux partenaires peuvent avoir des enfants) — l'enfant
  **devient adulte immédiatement** (né à 18 ans, hérite de la classe
  sociale d'un des deux parents au hasard, et d'une chance/ambition
  proches de la moyenne des parents). Un plafond de population (150 par
  défaut, réglable) arrête les naissances une fois atteint, sans jamais
  faire disparaître personne.
- **Aucun job planifié** : comme le reste du site, la simulation rattrape
  les jours écoulés à l'ouverture de la page Simulation (plafonné à 60
  jours par ouverture, pour rester rapide) — pas de charge supplémentaire
  sur la connexion des joueurs.
- **Tableau filtrable** (par classe, par nom) de tous les habitants, et un
  **graphique en courbe** en bas de page (objets achetés / actions
  achetées / naissances, 30 derniers jours) — réutilise le composant
  `LineChart` déjà en place.

## Détail technique (pour toi, pas pour les joueurs)

Les habitants simulés ne sont volontairement PAS de vrais comptes
(`profiles`) : ça évite de polluer le trombinoscope, les permissions, la
messagerie, etc. avec 100+ faux membres. Leurs achats affectent pour de
vrai `shop_items`, `businesses` (trésorerie, cours, historique) et la
caisse commune `tax_pool`, mais leurs propres soldes/actions détenues sont
suivis dans des tables séparées (`sim_agents`, `sim_shareholdings`,
`sim_events`) — accès réservé à la permission `manage_economy`, comme le
reste des écrans d'administration économique.

Constat du test de charge (200+ jours simulés sur une seule entreprise) :
les habitants n'achètent des actions QUE dans le stock disponible à la
vente (`shares_in_treasury`) — une fois épuisé, plus personne ne peut en
acheter tant qu'un vrai actionnaire n'en revend pas. C'est voulu et
réaliste (comme une vraie introduction en bourse à flottant limité), pas un
bug : avec plusieurs entreprises réelles, les achats se répartissent
naturellement entre elles.
