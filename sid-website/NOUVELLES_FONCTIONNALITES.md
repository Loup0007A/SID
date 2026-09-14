# Nouvelles fonctionnalités — notice d'installation

Ce dossier contient uniquement les fichiers **nouveaux ou modifiés**. Copie-les
par-dessus les fichiers existants du repo (mêmes chemins relatifs), puis suis
les étapes ci-dessous.

## 1. Migrations SQL (dans l'ordre, comme d'habitude)

Exécute dans le SQL Editor de Supabase, à la suite de `0013_merge_politique.sql` :

1. `0014_quest_beneficiary_and_bulk_complete.sql` — une quête peut être prise
   "pour soi" ou "pour quelqu'un d'autre" (la récompense part alors sur le
   portefeuille du bénéficiaire choisi) ; validation d'une quête pour un seul
   participant OU pour tous ses participants d'un coup.
2. `0015_chat_group_add_members.sql` — n'importe quel participant d'un salon
   de **groupe** peut désormais y ajouter d'autres membres (un DM reste limité
   à 2 personnes).
3. `0016_shop_marketplace_promos.sql` — un objet de boutique peut être remis
   en vente / retiré à volonté par son créateur, avec prix modifiable en
   permanence et prix promo optionnel (avec date de fin facultative). L'argent
   des achats est désormais reversé au créateur de l'objet.
4. `0017_salaries.sql` — système de salaire récurrent (montant par défaut
   2500 Cr., fréquence journalière/hebdo/bi-hebdo/mensuelle).
5. `0018_moderation_mute.sql` — ajoute le mute (empêche d'envoyer des
   messages en chat sans bannir le compte).
6. `0019_salary_check_on_login.sql` — **remplace le déclenchement pg_cron**
   par une vérification à la connexion : chaque membre, en arrivant sur son
   tableau de bord, déclenche le versement de son propre salaire s'il est
   dû (rattrape aussi les versements manqués s'il ne s'est pas connecté
   depuis un moment). Plus simple, aucune dépendance à une extension
   Supabase. Le bouton "Verser les salaires dus maintenant" dans
   `/dashboard/admin/economy` reste disponible pour un versement groupé
   immédiat sans attendre que chacun se connecte.

## 2. Variable d'environnement supplémentaire

La réinitialisation de mot de passe (dashboard admin) appelle l'API
d'administration Supabase Auth, qui nécessite la clé **service_role /
secret** côté serveur (jamais exposée au navigateur) :

```
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx...
```

Si tu utilises l'intégration Vercel native, cette variable existe déjà sous
ce nom (ou `SUPABASE_SECRET_KEY`) — rien à faire. Sinon, ajoute-la dans
Supabase → Project Settings → API → clé `service_role`, puis dans les
variables d'environnement de ton hébergement (Vercel → Settings →
Environment Variables). Redéploie après ajout.

## 3. `npm install`

Le fichier `package.json` a été mis à jour (ajout de `server-only`, utilisé
par le client d'administration côté serveur). Relance `npm install`.

## 4. Récapitulatif fonctionnel

| Demande | Où | Détail |
|---|---|---|
| Quête "pour soi / pour quelqu'un d'autre" | `/dashboard/quests` | Choix au moment de "Prendre la mission" ; la récompense va au bénéficiaire choisi |
| Terminer une quête pour tous ses participants | `/dashboard/quests` (managers) | Bouton "Gérer les participants" → "Tout valider" |
| Ajouter des membres à un groupe | `/dashboard/chat` | Bouton "Ajouter des membres" visible sur les salons de type groupe |
| Masquer les objets en rupture de stock | `/dashboard/shop` | Un objet à stock = 0 (et non "illimité") disparaît de la vitrine |
| Dashboard admin (bannir/mute/reset mdp) | `/dashboard/admin/users` | Réservé à la permission `manage_users` |
| Changer son mot de passe + photo de profil | `/dashboard/profile` | Nouvelles sections en haut de page |
| Remettre en vente / retirer un objet, prix permanent, promos | `/dashboard/shop` → "Mes objets en vente" | Visible pour le créateur de l'objet (même sans `manage_shop` permanent) |
| Salaire récurrent (2500 Cr. par défaut) | `/dashboard/admin/economy` | Section "Salaires", réservée à `manage_economy` |

## 5. Limites connues

- La réinitialisation de mot de passe génère un mot de passe temporaire
  affiché une seule fois à l'admin (à communiquer au membre) plutôt que
  d'envoyer un email — plus simple si le SMTP n'est pas configuré (voir
  README, section 4).
- Un salaire n'est versé qu'à la connexion du membre concerné (ou via le
  bouton admin "Verser maintenant") : si personne ne se connecte jamais,
  rien ne se déclenche tout seul — c'est le compromis attendu en échange de
  ne pas dépendre de `pg_cron`.
- Le système de vente/promo suppose qu'un objet a toujours un `created_by`
  (c'est le cas pour tout objet créé après cette mise à jour) : les objets
  déjà existants dans ta base continueront de fonctionner à l'identique
  (pas de reversement si `created_by` est NULL).
