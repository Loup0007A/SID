# S.I.D. — Plateforme communautaire

Site communautaire RP avec hiérarchie/organigramme, quêtes & économie, rôles &
permissions, messagerie privée/groupe, boutique, et gestion des candidatures.

Stack : **Next.js 14 (TypeScript, App Router) + Tailwind CSS + Supabase (Postgres, Auth, Realtime, Storage)**.

---

## 0. À propos du point "compte espion caché"

Le cahier des charges initial demandait un compte totalement dissimulé pouvant
lire tous les messages privés des membres. Ce projet **ne contient pas ça** :
à la place, il y a un rôle **Fondateur**, transparent, avec des permissions
étendues sur les données structurelles (quêtes, boutique, organigramme,
candidatures, rôles). Ce rôle **ne peut pas lire le contenu des salons de
discussion privés** dont il ne fait pas partie — comme sur Discord, un admin
voit qu'un salon existe mais pas son contenu, sauf s'il y est invité. C'est
une garantie technique (règles PostgreSQL RLS), pas juste une convention.

Tu choisis toi-même l'identifiant et le mot de passe du compte Fondateur à
l'étape 6 ci-dessous — rien n'est codé en dur dans le projet.

---

## 1. Prérequis

- [Node.js](https://nodejs.org/) 18 ou plus (20+ recommandé)
- Un compte [Supabase](https://supabase.com/) (gratuit)
- Un compte [Vercel](https://vercel.com/) si tu veux déployer en ligne (gratuit, optionnel)

---

## 2. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com/) → **New project**.
2. Choisis un nom (ex: `sid`), une région proche de tes joueurs, et un mot de
   passe de base de données (garde-le, tu n'en auras normalement pas besoin
   au quotidien).
3. Attends la fin du provisionnement (~2 min).

---

## 3. Exécuter le schéma de base de données

1. Dans le tableau de bord Supabase, ouvre **SQL Editor**.
2. Exécute, **dans l'ordre**, chaque fichier du dossier `supabase/migrations/`
   (copie le contenu d'un fichier, colle-le dans l'éditeur SQL, clique **Run**,
   passe au suivant), de `0001_init.sql` jusqu'au dernier fichier numéroté du
   dossier.

Tu peux vérifier que tout s'est bien passé dans **Table Editor** : tu dois
voir les tables `profiles`, `roles`, `quests`, `shop_items`, `chat_messages`,
`salaries`, etc.

> Alternative pour les habitués : avec la [Supabase CLI](https://supabase.com/docs/guides/cli)
> installée, `supabase link` puis `supabase db push` appliquent les mêmes
> fichiers automatiquement.

---

## 4. Configurer l'authentification

Dans **Authentication → Providers**, la méthode Email est activée par défaut,
c'est suffisante.

Pour simplifier les tests (pas de serveur mail à configurer) : va dans
**Authentication → Settings** et désactive **"Confirm email"**. Les comptes
seront alors utilisables immédiatement après inscription (ils resteront
quand même bloqués tant qu'un recruteur n'a pas validé leur candidature,
grâce au statut `pending`).

Pour la production, tu peux laisser la confirmation email active et
configurer un fournisseur SMTP dans **Authentication → Settings → SMTP**.

---

## 5. Configurer les variables d'environnement

Deux cas de figure :

**Si tu as connecté Supabase à Vercel via le Marketplace ("Connect Supabase")**
: les variables sont déjà générées automatiquement (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEY`,
des variables `POSTGRES_*`, etc.). Le code les reconnaît directement, tu n'as
rien à faire de plus — passe à l'étape 6. (Les variables `POSTGRES_*` et
`SUPABASE_JWT_SECRET` ne sont pas utilisées par ce projet, tu peux les ignorer.)

**Sinon, configuration manuelle :**
1. Dans Supabase : **Project Settings → API**.
2. Copie `Project URL` et la clé `anon public`.
3. Copie le fichier `.env.example` en `.env.local` à la racine du projet, et
   remplis-le :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx...
```

Dans les deux cas, la clé `service_role`/`secret` est utilisée côté serveur
par la route d'administration `/api/admin/reset-password` (réinitialisation
de mot de passe depuis le dashboard admin) — **ne la mets jamais dans du code
exécuté dans le navigateur.**

---

## 6. Installer et lancer le site en local

```bash
npm install
npm run dev
```

Le site est accessible sur [http://localhost:3000](http://localhost:3000).

### Créer le compte Fondateur

1. Va sur `/register` et crée un compte normalement (c'est le tien).
2. Dans Supabase → **Table Editor → profiles**, trouve la ligne
   correspondant à ton compte (repère-toi via l'email dans **Authentication → Users**
   pour récupérer l'UUID, ou via ton `nickname`).
3. Édite la ligne : mets `status` sur `active` et `is_founder` sur `true`.
4. Reconnecte-toi : tu as maintenant accès à tout le panneau d'administration
   (rôles, équipes, organigramme, recrutement, économie, administration des
   comptes).

Ensuite, en tant que Fondateur, tu peux traiter les autres candidatures
normalement depuis `/dashboard/admin/applications`, et attribuer des rôles
(État-Major, Officier Recruteur, Maître des Quêtes, Intendant, Agent…) depuis
`/dashboard/admin/roles`.

---

## 7. Déployer en ligne (Vercel)

1. Pousse ce projet sur un dépôt GitHub.
2. Sur [vercel.com](https://vercel.com/), **New Project** → importe le dépôt.
3. Renseigne les variables d'environnement de l'étape 5 dans les
   réglages Vercel (**Settings → Environment Variables**).
4. Déploie. Le site est en ligne en quelques minutes, avec un lien
   `https://ton-projet.vercel.app` (domaine personnalisé possible).

---

## 8. Tour du propriétaire — fonctionnalités

| Fonctionnalité | Où | Qui peut faire quoi |
|---|---|---|
| Panneau public de quêtes | `/` (page d'accueil, sans connexion) | Visible par n'importe qui, pour les quêtes marquées "publique" |
| Organigramme | `/dashboard/org-chart` | Tout membre voit l'arbre ; permission `manage_org_chart` pour l'éditer |
| Trombinoscope | `/dashboard/members` | Tout membre, avec les champs masqués respectés |
| Quêtes | `/dashboard/quests` | Tout membre voit/rejoint (pour soi ou pour un autre membre) ; permission `manage_quests` pour créer/valider (individuellement ou en masse) |
| Boutique | `/dashboard/shop` | Tout membre achète ; le créateur d'un objet gère sa propre fiche de vente (prix, promo, on/off) ; permission `manage_shop` pour créer/retirer définitivement |
| Économie | `/dashboard/admin/economy` | Permission `manage_economy` : ajuster manuellement les soldes, définir des salaires récurrents |
| Rôles & équipes | `/dashboard/admin/roles` | Permissions `manage_roles` / `manage_teams` |
| Recrutement | `/dashboard/admin/applications` | Permission `recruit` : éditer le dossier, discuter, accepter/refuser |
| Messagerie | `/dashboard/chat` | Chaque membre ne voit que les salons dont il fait partie ; n'importe quel participant d'un groupe peut y ajouter des membres |
| Administration des comptes | `/dashboard/admin/users` | Permission `manage_users` : bannir/débannir, mute/démute, réinitialiser un mot de passe |
| Mon dossier | `/dashboard/profile` | Chaque membre édite ses infos, choisit les champs à cacher, change sa photo de profil et son mot de passe |

### Rôles créés par défaut

`Fondateur`, `État-Major`, `Officier Recruteur`, `Maître des Quêtes`,
`Intendant`, `Agent`. Modifiables librement depuis `/dashboard/admin/roles`
(renommer, changer les permissions, en créer d'autres).

### Système de permissions

8 permissions indépendantes, combinables sur un même rôle :
`manage_roles`, `manage_org_chart`, `manage_quests`, `manage_shop`,
`manage_teams`, `manage_economy`, `recruit`, `manage_users`.

### Confidentialité des comptes

Chaque membre peut, dans `/dashboard/profile`, cacher certains champs
(nom/prénom IRL, âge, armes, équipement, description, rôle voulu) aux autres
membres. Seuls les comptes avec la permission `manage_users` (et le membre
lui-même) voient toujours tout. Le trombinoscope (`/dashboard/members`)
applique cette confidentialité via la fonction SQL `list_roster()`.

### Quêtes : bénéficiaire de la récompense et validation groupée

En prenant une mission, un membre choisit si la récompense lui revient ou si
elle revient à un autre membre (ex : il agit "pour le compte de" quelqu'un
d'autre en RP). Un manager (`manage_quests`) peut valider un participant à la
fois, ou valider **tous les participants inscrits** d'un coup (ce qui marque
aussi la quête comme "terminée").

### Boutique : remise en vente, prix et promos

Le créateur d'un objet (même sans permission `manage_shop` permanente) peut,
depuis l'onglet "Mes objets en vente" : le retirer/remettre en vente, changer
son prix à tout moment, et définir un prix promotionnel avec une date de fin
optionnelle. Les objets à stock 0 (hors stock "illimité") disparaissent
automatiquement de la vitrine. L'argent de chaque achat est reversé au
créateur de l'objet.

### Salaires récurrents

Un membre avec la permission `manage_economy` peut attribuer à quelqu'un un
salaire versé automatiquement (montant par défaut : 2500 Cr., fréquence
journalière/hebdomadaire/bi-hebdomadaire/mensuelle). Le versement se
déclenche **à la connexion du membre concerné** (pas de dépendance à un job
planifié type `pg_cron`, qui n'est pas disponible sur tous les plans
Supabase) — avec rattrapage automatique des versements manqués si le membre
ne s'est pas connecté depuis un moment. Le bouton "Verser les salaires dus
maintenant" dans `/dashboard/admin/economy` permet un versement groupé
immédiat sans attendre.

### Administration des comptes

Depuis `/dashboard/admin/users` (permission `manage_users`) : bannir/débannir
un compte, le mute (bloque l'envoi de messages en chat sans le bannir), et
réinitialiser son mot de passe (génère un mot de passe temporaire à
communiquer au membre, via la route serveur `/api/admin/reset-password` qui
utilise la clé `service_role`).

---

## 9. Sécurité — comment ça marche

Toute la sécurité repose sur les politiques **Row Level Security (RLS)** de
Postgres (fichier `0001_init.sql` et les correctifs suivants), pas sur le
code du site : même si quelqu'un appelle directement l'API Supabase en
contournant l'interface, les mêmes règles s'appliquent. En résumé :

- Un membre ne voit un salon de discussion et ses messages que s'il en est participant.
- Les quêtes/objets "publics" sont lisibles sans connexion ; "membres" nécessite un compte actif ; "privé" nécessite d'être participant, créateur, ou d'avoir la permission de gestion.
- Les mouvements d'argent (achats, récompenses, salaires, ajustements) passent par des fonctions SQL dédiées qui vérifient les permissions et évitent les soldes négatifs.
- La seule route qui utilise la clé `service_role` (réinitialisation de mot de passe) revérifie elle-même la permission `manage_users` côté serveur avant d'agir — la clé n'est jamais exposée au navigateur.

---

## 10. Limites connues / pistes d'évolution

- **Notifications** : pas d'email/push quand une quête est validée ou qu'un message arrive.
- **Modération du chat** : pas de suppression/édition de message (le mute existe en revanche).
- **Recherche/pagination** : les listes (quêtes, boutique, membres) chargent tout d'un coup ; à paginer si la communauté grandit beaucoup.
- **Design mobile** : la mise en page est responsive mais pensée desktop-first à l'origine.
- **Salaire** : ne se déclenche qu'à la connexion du bénéficiaire (voir section 8) — pas de versement pour un membre qui ne se connecte jamais.

---

## 11. Structure du projet

```
sid-website/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # accueil publique + panneau de quêtes
│   │   ├── login/                    # connexion
│   │   ├── register/                 # formulaire de candidature
│   │   ├── api/admin/reset-password/ # route serveur (clé service_role)
│   │   └── dashboard/                # espace connecté (protégé)
│   │       ├── layout.tsx            # navigation + garde d'accès + salaire à la connexion
│   │       ├── org-chart/
│   │       ├── quests/
│   │       ├── shop/
│   │       ├── chat/
│   │       ├── profile/
│   │       └── admin/
│   │           ├── applications/
│   │           ├── roles/
│   │           ├── economy/
│   │           └── users/
│   ├── components/                   # QuestCard, OrgTree, badges…
│   ├── lib/supabase/                 # clients navigateur/serveur/admin
│   └── types/database.ts             # types partagés
└── supabase/migrations/              # schéma SQL (à exécuter dans Supabase)
```

---

## 12. Note sur `npm audit`

`npm audit` peut signaler des avertissements sur Next.js — ce sont des
alertes larges couvrant de nombreuses versions ; le projet utilise la
dernière version corrigée de la branche 14.x. Une migration vers Next 15/16
est possible plus tard mais implique de retester l'App Router (non fait ici
pour rester sur une base stable et connue).
