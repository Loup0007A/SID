# Lot 61 — Contrôle technique

## À lancer dans Supabase (dépôt sid-website)

1. `supabase/migrations/0076_securite_fonctions.sql` — **important** (faille).
2. `supabase/migrations/0077_index.sql` — performances (rejouable sans risque).

## Ce qui a été contrôlé

- Dépendances (`npm audit`), versions de Next.js.
- Base : tables sans règles d'accès, règles d'écriture ouvertes, fonctions
  `SECURITY DEFINER` sans `search_path`, fonctions appelables sans être
  connecté, fonctions qui font confiance à un identifiant passé en paramètre,
  index des requêtes fréquentes.
- Tournée des pages des trois sites (membre, admin, visiteur) : erreurs JS,
  erreurs console, requêtes en échec, temps de chargement ; connexion réelle.
- En-têtes HTTP de sécurité.

## Corrections

### Faille : deux fonctions internes ouvertes à tous (0076)
- `credit_admins_equally(montant, raison)` versait n'importe quel montant aux
  admins, appelable depuis l'API **même sans être connecté**.
- `do_validate_quest_all_participants(quête, acteur)` validait et payait tous
  les participants d'une quête, l'« acteur » étant fourni par l'appelant.
- Accès retiré au public ; elles restent utilisées par les fonctions qui les
  appellent (impôts, validation groupée, quêtes expirées, bourse). Vérifié : un
  membre reçoit « permission denied », la validation groupée par un
  responsable fonctionne toujours.
- Tâches d'entretien (salaires, impôts, sanctions, quêtes expirées, économie
  du jour) : plus lançables par un visiteur non connecté.

### Next.js
- **Optimiseur d'images coupé** sur les trois sites (`images.unoptimized`) :
  aucune page n'utilise `next/image`, et `/_next/image` porte les failles
  critiques connues de Next 14 (exécution de code via SVG/AVIF, déni de
  service). L'adresse répond maintenant 404.
- **Wiki** : Next 14.2.15 → 14.2.35 (dernier correctif de la branche 14 ;
  corrige notamment le contournement du middleware, CVE-2025-29927).
- `source-map-js` mis à jour (carte, wiki).

### En-têtes de sécurité (trois sites)
`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` (pas
d'affichage dans un cadre d'un autre site : protection contre le
« clickjacking »), `Referrer-Policy: strict-origin-when-cross-origin`.

### Dossier Central : fichier de verrouillage
`package-lock.json` ajouté : Vercel installe toujours exactement les versions
testées (avant, chaque déploiement pouvait prendre des versions plus récentes).

### Index (0077)
Notifications (la cloche compte les non-lues à chaque page), messages par
conversation, « mes quêtes » par membre, achats par membre.

## Restant (non corrigé, à planifier)

- **Next.js 15/16** : une partie des avis de sécurité de Next 14 ne se corrige
  qu'en changeant de version majeure (déni de service des Server Components,
  empoisonnement de cache…). Migration lourde (React 19, API asynchrones) à
  faire à part. Sur Vercel, plusieurs de ces failles ne s'appliquent pas
  (optimisation d'images et cache gérés par la plateforme).
- **ESLint** n'est configuré sur aucun des trois sites (la vérification des
  types passe à chaque build).
