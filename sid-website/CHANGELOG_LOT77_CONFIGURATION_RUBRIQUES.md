# Lot 77 — Noms du jeu dans app_config, rubriques du site

## À lancer dans Supabase

`supabase/migrations/0094_configuration_site.sql`, après 0093 (rejouable,
ne change aucune valeur déjà posée).

## 1. Noms du jeu dans app_config

Le nom du RP, des trois sites, de la monnaie et les adresses se règlent dans
`app_config`, une clé par valeur. **SETUP.md** les liste une par une, avec la
requête SQL de chacune.

| Clé | Origine |
| --- | --- |
| `rp_name`, `rp_full_name` | S.I.D., Système International Dictatorial |
| `site_name`, `map_name`, `wiki_name` | Dossier Central, Cartographie, Wiki |
| `rp_gender`, `site_gender`, `map_gender`, `wiki_gender` | m, m, f, m |
| `site_description` | Plateforme communautaire du S.I.D. |
| `currency_name`, `currency_plural`, `currency_symbol` | zéni, zénis, z |
| `contact_email` | vide |
| `url_site`, `url_map`, `url_wiki` | adresses Vercel actuelles (`url_site` reprend `site_url` si elle existe) |

### Fonctionnement
- Le code et la base gardent les textes d'origine. Les trois sites les
  remplacent à l'affichage : tout le texte rendu (contenu, `title`,
  `aria-label`, `placeholder`, `alt`), y compris les textes venus de la base
  (notifications, motifs, annonces, fiches du wiki).
- Aussi : titres d'onglet, nom de l'application installée (manifeste),
  notifications push, textes de partage.
- **Article** : il suit le genre réglé. Avec `O.R.D.R.E.` (m), « Banque du
  S.I.D. » devient « Banque de l'O.R.D.R.E. ». Avec `Archives` (pl), « le
  Dossier Central » devient « les Archives ».
- **Monnaie** : mots entiers seulement (« zénith » n'est pas touché), majuscule
  gérée. Le symbole change après un montant (« 12 z ») et dans « (z) ».
- **Wiki** : le mot seul (« Wikipédia » n'est pas touché).
- **Configuration d'origine** : aucun texte n'est copié ni modifié.

### Délai
- Dossier Central : 5 minutes au plus, ou tout de suite avec
  `POST /api/config/revalidate`.
- Wiki : 5 minutes au plus.
- Cartographie : 10 minutes au plus.

### Liens
Les adresses écrites en dur sont remplacées par `url_site`, `url_map` et
`url_wiki` :
- Dossier Central : liens vers la carte et le wiki ;
- Cartographie, Wiki : liens « Dossier Central », « Mes données » et
  inscription.

L'adresse de contact des conditions d'utilisation vient de `contact_email`,
sinon de `NEXT_PUBLIC_CONTACT_EMAIL`.

### Limites (détaillées dans SETUP.md)
- Seul l'article suit le genre, pas les accords du reste de la phrase.
- Images, emails de connexion Supabase et simulations hébergées à part : à
  changer à la main.

## 2. Rubriques du site (Modération)

Nouvelle section **Rubriques du site** dans Administration → Modération :
une case par rubrique du Dossier Central.

### Une rubrique masquée
- disparaît des menus, de l'accueil, de la recherche (Ctrl K) et des
  épingles ;
- disparaît de la visite guidée (chapitres renumérotés), des premiers pas,
  du Guide et des astuces de page ;
- affiche « Rubrique fermée » aux membres qui ouvrent son adresse ;
- reste visible pour l'équipe (permission « Gérer les comptes »), avec un
  bandeau « Rubrique masquée aux membres ».

### Effets en plus

| Rubrique | Effet |
| --- | --- |
| Titres | plus de fenêtre « titre débloqué » |
| Roue du jour | la roue ne s'ouvre plus sur l'accueil |
| Sondages | plus de sondage mis en avant |
| Quêtes | plus de missions en cours sur l'accueil |
| Carte | plus de lien vers la Cartographie dans la recherche |

### Règles
- Toujours présents : Mon dossier, Notifications, Réglages, Mes données,
  Administration.
- Masquer ne bloque pas les actions côté serveur : « Suspendre une section »,
  juste en dessous, reste l'outil pour couper une fonction.
- Chaque changement est inscrit au journal d'audit (« Rubriques du site »).

## 3. Cartographie et Wiki

Même mécanisme dans les deux dépôts :
- `src/lib/brand.ts` et `src/brand/` : copies de ceux du Dossier Central, à
  garder identiques ;
- titres et manifeste tirés de `app_config` ;
- liens vers le Dossier Central tirés de `url_site`.

Dans le Wiki, le lien « Pas encore de compte ? » s'affiche maintenant même
sans `NEXT_PUBLIC_DOSSIER_CENTRAL_URL` : il mène à `url_site/register`.

## RPC

- `public_config()` : les valeurs publiques, lisibles sans connexion.
- `site_tabs_set(p_hidden text[])` : rubriques masquées (permission « Gérer
  les comptes »).
