# SETUP — configurer le jeu

Ce fichier liste, une par une, les valeurs à régler pour lancer le jeu ou le
renommer : nom du RP, des trois sites, de la monnaie, adresses, sites et
rubriques ouverts, adresses des simulations. L'installation elle-même (Supabase, Vercel, compte Fondateur) est
dans [README.md](README.md).

Prérequis : migrations passées jusqu'à `0137_avent_jeux_entrainement.sql`
(Dossier Central), celles du Wiki (jusqu'à `0212_wiki_nouvelles_fiches.sql`), puis
celles de la Cartographie (jusqu'à `0123_trajets_programmes.sql`). Sur une base déjà
en service, lancer les 0120 à 0137 du Dossier Central **après** toutes les autres. La 0118 de la
Cartographie utilise les tables du Wiki : passer le Wiki avant. Installation neuve des trois sites :
suivre `supabase/ORDRE_MIGRATIONS.txt` (vérifié par `scripts/rejouer-migrations.sh`).

Sécurité (Lot 96), après chaque lot qui touche la base ou les secrets :

- `AUDIT_URL=<chaîne de connexion> bash scripts/audit-securite.sh` : droits de
  la base (doit finir par « BILAN 0 échec(s) ») ;
- `SCELLE_CLE=<phrase du sceau> npm run secrets` dans chaque dépôt : aucun
  secret dans l'historique git ni dans le build ;
- Supabase → Authentication → Rate Limits : garder des limites basses pour les
  connexions et les inscriptions (la page de connexion passe directement par
  Supabase, pas par le site).

---

## 1. Identité du jeu

Toutes ces valeurs sont dans la table `app_config` (une ligne par clé). Elles
servent aux **trois sites** : Dossier Central, Cartographie, Wiki.

Pour en changer une : Supabase → **SQL Editor** →

```sql
update public.app_config set value = 'Nouvelle valeur' where key = 'la_cle';
```

Une valeur vide reprend la valeur d'origine.

### 1.1 `rp_name` — sigle ou nom court du RP

- Origine : `S.I.D.`
- Remplace « S.I.D. » partout : en-têtes, titres d'onglet, nom de l'application
  installée sur téléphone, textes, notifications.
- Le nom de l'indice boursier suit : « Indice SID » devient « Indice » + le
  sigle sans ses points (`O.R.D.R.E.` → « Indice ORDRE »).

```sql
update public.app_config set value = 'S.I.D.' where key = 'rp_name';
```

### 1.2 `rp_full_name` — nom complet

- Origine : `Système International Dictatorial`
- Ce que veut dire le sigle (page d'accueil publique, Guide, dossier d'intégration).

```sql
update public.app_config set value = 'Système International Dictatorial' where key = 'rp_full_name';
```

### 1.3 `site_name` — nom du site principal

- Origine : `Dossier Central`

```sql
update public.app_config set value = 'Dossier Central' where key = 'site_name';
```

### 1.4 `map_name` — nom du site de la carte

- Origine : `Cartographie`

```sql
update public.app_config set value = 'Cartographie' where key = 'map_name';
```

### 1.5 `wiki_name` — nom du wiki

- Origine : `Wiki`
- Remplace le mot « Wiki » seul (pas « Wikipédia »).

```sql
update public.app_config set value = 'Wiki' where key = 'wiki_name';
```

### 1.6 `rp_gender`, `site_gender`, `map_gender`, `wiki_gender` — genre des noms

- Origine : `m`, `m`, `f`, `m` (le S.I.D., le Dossier Central, la
  Cartographie, le Wiki).
- Valeurs : `m` (masculin), `f` (féminin), `pl` (pluriel).
- Choisit l'article devant chaque nom : « du », « de la », « des », « le »,
  « la », « les », « au », « à la », « aux ». Devant une voyelle ou un h, au
  singulier : « de l' », « l' », « à l' ».
- `rp_gender` vaut pour `rp_name` et `rp_full_name`.

| Réglage | « Banque du S.I.D. » devient |
| --- | --- |
| `rp_name` = `O.R.D.R.E.`, `rp_gender` = `m` | « Banque de l'O.R.D.R.E. » |
| `rp_name` = `Guilde`, `rp_gender` = `f` | « Banque de la Guilde » |
| `rp_name` = `Veilleurs`, `rp_gender` = `pl` | « Banque des Veilleurs » |

```sql
update public.app_config set value = 'f' where key = 'rp_gender';
```

### 1.7 `site_description` — description

- Origine : `Plateforme communautaire du S.I.D.`
- Texte lu par les moteurs de recherche et les aperçus de liens.

```sql
update public.app_config set value = 'Plateforme communautaire du S.I.D.' where key = 'site_description';
```

### 1.8 `currency_name` — monnaie, au singulier

- Origine : `zéni`
- La majuscule en début de phrase est gérée (« Zéni » → « Crédit »).

```sql
update public.app_config set value = 'zéni' where key = 'currency_name';
```

### 1.9 `currency_plural` — monnaie, au pluriel

- Origine : `zénis`
- À écrire en entier : le pluriel n'est pas deviné (`crédits`, `écus`, `pesos`…).

```sql
update public.app_config set value = 'zénis' where key = 'currency_plural';
```

### 1.10 `currency_symbol` — symbole

- Origine : `z`
- Remplace le « z » écrit après un montant : « 1 500 z » → « 1 500 cr ». Un
  « z » qui ne suit pas un nombre n'est pas touché.

```sql
update public.app_config set value = 'z' where key = 'currency_symbol';
```

### 1.11 `contact_email` — adresse de contact

- Origine : vide.
- Affichée dans les conditions d'utilisation et la politique de
  confidentialité. Vide : la variable `NEXT_PUBLIC_CONTACT_EMAIL` de chaque
  site, sinon la messagerie du site seule.

```sql
update public.app_config set value = 'contact@exemple.fr' where key = 'contact_email';
```

### 1.12 `url_site` — adresse du site principal

- Origine : `site_url` si elle existait déjà, sinon `https://sid-quest.vercel.app`.
- Liens « Dossier Central » de la carte et du wiki, « Mes données »,
  inscription depuis le wiki.
- `site_url` (notifications push, migration 0079) doit contenir la même
  adresse. Pour changer les deux :

```sql
update public.app_config set value = 'https://mon-site.vercel.app' where key in ('url_site', 'site_url');
```

### 1.13 `url_map` — adresse de la carte

- Origine : `https://sid-map.vercel.app`
- Liens vers la carte depuis le Dossier Central (recherche, page Carte).

```sql
update public.app_config set value = 'https://sid-map.vercel.app' where key = 'url_map';
```

### 1.14 `url_wiki` — adresse du wiki

- Origine : `https://sid-wiki.vercel.app`
- Lien vers le wiki depuis la recherche du Dossier Central (Ctrl K).

```sql
update public.app_config set value = 'https://sid-wiki.vercel.app' where key = 'url_wiki';
```

### Tout d'un coup

À copier, modifier, puis exécuter :

```sql
update public.app_config as c set value = v.value
from (values
  ('rp_name',          'S.I.D.'),
  ('rp_full_name',     'Système International Dictatorial'),
  ('site_name',        'Dossier Central'),
  ('map_name',         'Cartographie'),
  ('wiki_name',        'Wiki'),
  ('rp_gender',        'm'),
  ('site_gender',      'm'),
  ('map_gender',       'f'),
  ('wiki_gender',      'm'),
  ('site_description', 'Plateforme communautaire du S.I.D.'),
  ('currency_name',    'zéni'),
  ('currency_plural',  'zénis'),
  ('currency_symbol',  'z'),
  ('contact_email',    ''),
  ('url_site',         'https://sid-quest.vercel.app'),
  ('site_url',         'https://sid-quest.vercel.app'),
  ('url_map',          'https://sid-map.vercel.app'),
  ('url_wiki',         'https://sid-wiki.vercel.app')
) as v(key, value)
where c.key = v.key;
```

Vérifier : `select public.public_config();`

---

## 2. Délai avant affichage

| Site | Délai | Pour l'appliquer tout de suite |
| --- | --- | --- |
| Dossier Central | 5 minutes au plus | `curl -X POST https://<adresse-du-site>/api/config/revalidate` |
| Wiki | 5 minutes au plus | redéployer le site sur Vercel |
| Cartographie | 10 minutes au plus | redéployer le site sur Vercel |

Une page déjà ouverte change au prochain chargement.

---

## 3. Ce que le renommage change, et ce qu'il ne change pas

Le code et la base gardent les noms d'origine. Les sites les remplacent au
moment de l'affichage.

**Change :**
- tout le texte affiché par les trois sites, y compris les textes venus de
  la base : notifications, motifs des mouvements d'argent, annonces, fiches
  du wiki ;
- les titres d'onglet, le nom de l'application installée sur téléphone ;
- les notifications push ;
- le texte des partages (carte d'agent, fiche du wiki).

**Ne change pas :**
- **les données enregistrées** : rien n'est réécrit en base, et revenir aux
  valeurs d'origine rétablit l'affichage d'origine. L'export « Mes données »
  contient les textes tels qu'ils sont en base ;
- **les accords** : seul l'article devant le nom suit son genre (section
  1.6). « Le Dossier Central est ouvert » devient « Les Archives est ouvert ».
  Un nom qui se lit comme l'original (masculin singulier pour le RP) évite le
  problème ; sinon, corriger les phrases concernées dans le code ;
- **les images** (section 6) ;
- **les emails de connexion** envoyés par Supabase (section 7) ;
- **les simulations** hébergées à part (Donjons, Intelligence, Techniques,
  arène) : sites séparés, à renommer dans leurs propres dépôts. Leur adresse,
  elle, se règle ici (section 5).

---

## 4. Sites et rubriques ouverts

Administration → **Modération** → **Sites et rubriques**. Décocher puis
**Enregistrer**.

### 4.1 Cartographie et Wiki

Un site fermé :
- affiche « Site fermé » aux membres, sur toutes ses pages sauf la
  connexion et les pages légales ;
- reste ouvert à l'équipe, avec un bandeau : permission « Gérer les
  comptes », ou les droits d'édition du site (`manage_map` pour la
  Cartographie, administrateurs du Wiki) ;
- n'a plus de lien depuis le Dossier Central (recherche Ctrl K, page Carte).

Effet au prochain chargement de page. La fermeture est un affichage : les
données restent protégées comme avant par la base, pas davantage.

En SQL (`on` ou `off`) :

```sql
update public.app_config set value = 'off' where key = 'wiki_enabled';
update public.app_config set value = 'on' where key = 'map_enabled';
```

### 4.2 Rubriques du Dossier Central

Effet immédiat.

Une rubrique masquée :
- disparaît des menus, de l'accueil, de la recherche (Ctrl K) et des
  épingles ;
- disparaît de la visite guidée, des premiers pas et du Guide ;
- affiche « Rubrique fermée » aux membres qui ouvrent son adresse ;
- reste visible pour l'équipe (permission « Gérer les comptes »), avec un
  bandeau.

Effets en plus :

| Rubrique | Effet en plus |
| --- | --- |
| Titres | plus de fenêtre « titre débloqué » |
| Roue du jour | la roue ne s'ouvre plus sur l'accueil |
| Sondages | plus de sondage mis en avant sur l'accueil |
| Quêtes | plus de missions en cours sur l'accueil |
| Carte | plus de lien vers la Cartographie dans la recherche |

Toujours présents : Mon dossier, Notifications, Réglages, Mes données, et
toute l'Administration.

Masquer une rubrique ne bloque pas ses actions côté serveur. Pour couper
une fonction (boutique, banque, messagerie, quêtes), utiliser **Suspendre une
section**, juste en dessous dans Modération.

En SQL, la liste est dans `tabs_hidden`, un tableau JSON de clés (celles de
`src/lib/navigation.ts`) :

```sql
update public.app_config set value = '["titles", "roue"]' where key = 'tabs_hidden';
```

---

## 5. Adresses des simulations

Chaque simulation est un site à part, affiché dans le Dossier Central. Son
adresse se règle dans `app_config` :

| Clé | Simulation | Adresse du code |
| --- | --- | --- |
| `sim_url_donjons` | Donjons | `https://loup0007a.github.io/3D-game-world/` |
| `sim_url_intelligence` | Intelligence (potions, énigmes, problème) | `https://intelligence-seven-henna.vercel.app/` |
| `sim_url_techniques` | Techniques | `https://techniques-delta.vercel.app/` |
| `sim_url_arena` | Arène du « Défi du Dragon » | `arena.html` à côté des Donjons |

- **Vide** : l'adresse du code.
- **Une adresse** (`https://…`) : la remplace. Une adresse mal écrite est
  ignorée.
- **`off`** : simulation débranchée, bouton « Lancer » grisé (sauf l'arène,
  qui reprend l'adresse du code).

```sql
update public.app_config set value = 'https://mes-donjons.vercel.app/' where key = 'sim_url_donjons';
```

- **Arène** : sans `sim_url_arena`, elle suit les Donjons (variable
  `NEXT_PUBLIC_ARENA_URL` si elle est posée, sinon `arena.html` à la même
  adresse que les Donjons).
- **Délai** : 5 minutes au plus, ou tout de suite avec
  `curl -X POST https://<adresse-du-site>/api/config/revalidate`.
- **Résultats** : chaque partie donne au site de la simulation l'adresse de
  l'API du Dossier Central (paramètre `sid_api`, voir API_SIMULATIONS.md). Si
  le code d'une simulation contient lui-même l'adresse du Dossier Central,
  la changer aussi dans son dépôt quand `url_site` change.

---

## 6. Images

À remplacer à la main, mêmes noms et mêmes tailles :

| Site | Fichiers |
| --- | --- |
| Dossier Central | `src/app/favicon.ico`, `public/logo.png`, `public/logo.webp`, `public/icons/app-192.png`, `public/icons/app-512.png`, `public/icons/apple-touch-180.png` (voir `public/icons/LISEZMOI.md`) |
| Cartographie | `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `public/apple-touch-icon.png` |
| Wiki | `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `public/icons/apple-touch-icon.png` (voir `public/icons/LISEZ-MOI.txt`) |

### 6.1 Couleurs et fonds du Dossier Central

Les couleurs du site, le motif du fond et les particules qui tombent sont
générés par `scripts/fonds.mjs`, une entrée par thème : `sid` (hors évents)
puis un thème par évent (`noel`, `halloween`…) et `election_force`
(élection prise par la force). Le Wiki et la Cartographie ont chacun leur
`scripts/fonds.mjs`, mêmes champs, thème de base `wiki` et `carto`.

| Champ | Rôle |
| --- | --- |
| `fond` | couleur du fond |
| `haut`, `bas` | halo clair (en haut à gauche) et halo sombre (en bas à droite) |
| `encre` | traits, ombres pleines, texte des cartes |
| `creme`, `creme2` | cartes et leur dégradé |
| `accent`, `accent2` | rouge et jaune du thème ; `accentCarte` : le rouge lisible sur une carte |
| `colors`, `shapes` | couleurs et formes du motif |
| `particle`, `sens`, `pcolors` | forme, sens (1 : tombent, -1 : montent) et couleurs des particules |

Après un changement :

```bash
node scripts/fonds.mjs
```

Le script réécrit `public/fonds/*.svg` et `src/app/fonds.css`, à mettre en
ligne avec le reste. Le thème affiché suit l'affichage événementiel
(Modération → Événements) ; si plusieurs évents sont affichés en même temps,
l'ordre de `src/lib/fondTheme.ts` décide.

---

## 7. Emails de connexion

Supabase → **Authentication** → **Email Templates** : confirmation
d'inscription, mot de passe oublié, changement d'email. Remplacer le nom du
jeu dans l'objet et le texte de chaque modèle.

---

## 8. Variables d'environnement (Vercel)

Les trois sites utilisent le **même** projet Supabase.

| Variable | Sites | Rôle |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | les trois | adresse du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | les trois | clé publique (Dossier Central : `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` marche aussi) |
| `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SECRET_KEY`) | Dossier Central, Cartographie | clé serveur, jamais dans le navigateur |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Dossier Central | notifications push |
| `PUSH_WEBHOOK_SECRET` | Dossier Central | même texte que `app_config.push_webhook_secret` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | les trois | contact, si `contact_email` est vide |
| `NEXT_PUBLIC_ARENA_URL` | Dossier Central | adresse de l'arène, si `sim_url_arena` est vide et qu'elle n'est pas hébergée avec les Donjons |
| `NEXT_PUBLIC_DOSSIER_CENTRAL_URL` | Wiki | lien « Pas encore de compte ? » ; vide : `url_site` + `/register` |

Notifications push : régler aussi `site_url` et `push_webhook_secret` dans
`app_config` (voir l'en-tête de `supabase/migrations/0079_push.sql`). Le test
se fait depuis Mon dossier → Notifications push.

---

## 9. Autres réglages

Déjà modifiables depuis le site :

| Réglage | Où |
| --- | --- |
| Taux, impôts, plafonds d'emprunt | Administration → Économie (pilotage automatique ou manuel) |
| Valeur de la monnaie | Administration → Réforme monétaire |
| Objectif hebdomadaire des entreprises | Administration → Économie → Entreprises |
| Roue du jour | Administration → Économie → Roue du jour |
| Pénalité d'absence | Administration → Économie → Absences |
| Seuils des alertes | Administration → Alertes |
| Annonces, maintenance, décors des fêtes, pages en aperçu | Administration → Modération |
| Cartographie et Wiki ouverts, rubriques présentes | Administration → Modération → Sites et rubriques |
| Farces | Administration → Titres & farces |
| Élection du Dictateur : élu, manière (proclamé ou par la force), début, proclamation, fin | Administration → Modération → Affichage événementiel |
| Créatures de la carte (lesquelles, où, fréquence, apparition), météo d'un lieu, propriétaire d'un bâtiment | Cartographie : Météo → Gérer les créatures ; fiche du lieu |

Chaque membre règle lui-même, dans **Réglages** : les notifications qu'il reçoit (partout, sur le site seulement, jamais ; heures calmes sans push), sa confidentialité, son mot de passe, l'apparence de sa fiche, et l'affichage (mode sombre, mode épuré, taille du texte, animations — vivantes, calmes ou selon l'appareil —, décors des fêtes), gardé sur son compte (`profiles.display_prefs`, migrations 0116 et 0118) et posé dès la première page sur un appareil neuf (cookie `sid-confort`) et appliqué aussi sur la Cartographie et le Wiki. Toujours reçues, quoi qu'il choisisse : quêtes, candidatures, appels de raid, annonces, sanctions, impôts, litiges, absences (`_notif_mutable`, migration 0114).

Le reste se règle en SQL. Liste complète :

```sql
select key, value from public.app_config order by key;
```

Exemple, la répartition hebdomadaire de la caisse commune : part des
fondateurs (comptes au grade Fondateur) et part des entreprises ouvertes.
Ce qui n'est pas versé reste dans la caisse.

```sql
update public.app_config set value = '0.8' where key = 'tax_admin_share';
update public.app_config set value = '0.2' where key = 'tax_business_share';
```

Autre exemple, le fuseau horaire des statistiques et du passage au jour suivant :

```sql
update public.app_config set value = 'Europe/Paris' where key = 'stats_timezone';
```

Les clés en `*_last_*` (`jobs_last_run`, `economy_last_daily`…) sont tenues
par les tâches automatiques : ne pas les modifier.

### Salon Admin de la messagerie

Le salon réunit les comptes au grade Fondateur et ceux qui ont « Gérer les
comptes ». Un seul compte en est le maître : il épingle les messages, pose
des liens vers les autres pages du S.I.D. et peut supprimer n'importe quel
message du salon. Ce compte est dans `admin_chat_owner` (identifiant ou
pseudo ; à l'installation : Kuro).

```sql
update public.app_config set value = 'Kuro' where key = 'admin_chat_owner';
```

Lien dans un message du maître : `[[/dashboard/admin/audit|Journal d'audit]]`
(le bouton « Lien » de la messagerie l'écrit tout seul).
