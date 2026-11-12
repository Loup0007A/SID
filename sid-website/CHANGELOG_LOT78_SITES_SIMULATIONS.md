# Lot 78 — Fermer la Cartographie ou le Wiki, adresses des simulations

## À lancer dans Supabase

`supabase/migrations/0095_sites_simulations.sql`, après 0094 (rejouable,
ne change aucune valeur déjà posée).

## 1. Fermer la Cartographie ou le Wiki

Administration → Modération → **Sites et rubriques** (nouveau nom de
« Rubriques du site ») : un bloc « Sites » en tête, avec une case pour la
Cartographie et une pour le Wiki.

### Un site fermé
- affiche « Site fermé » aux membres, avec un lien de retour vers le Dossier
  Central ;
- garde ouvertes la connexion (avec un bandeau « Site fermé aux membres ») et
  les pages légales ;
- reste ouvert à l'équipe, avec un bandeau : permission « Gérer les
  comptes », `manage_map` pour la Cartographie, administrateurs du Wiki ;
- n'a plus de lien depuis le Dossier Central : recherche (Ctrl K), page
  Carte.

### Fonctionnement
- Chaque site relit l'état au chargement de la page : la fermeture et la
  réouverture valent au prochain chargement, sans attendre le cache.
- La fermeture est un affichage : les données restent protégées par la base
  comme avant.
- Chaque changement est inscrit au journal d'audit (« Cartographie et Wiki »).
- En SQL : `map_enabled` et `wiki_enabled`, `on` ou `off`.

## 2. Adresses des simulations

Les adresses des simulations se règlent dans `app_config` :

| Clé | Simulation |
| --- | --- |
| `sim_url_donjons` | Donjons |
| `sim_url_intelligence` | Intelligence |
| `sim_url_techniques` | Techniques |
| `sim_url_arena` | Arène du Défi du Dragon |

### Valeurs
- **Vide** : l'adresse du code (`src/lib/simulationSites.ts`), comme avant.
- **Adresse `https://…`** : la remplace. Une adresse mal écrite est ignorée.
- **`off`** : simulation débranchée, bouton « Lancer » grisé.

### Fonctionnement
- **Arène** : sans réglage, elle suit les Donjons (`arena.html` à la même
  adresse), ou `NEXT_PUBLIC_ARENA_URL`.
- **Ce qui suit la nouvelle adresse** :
  - l'iframe de la partie ;
  - la vérification de l'origine des messages envoyés par la simulation ;
  - l'état « branchée » donné par `GET /api/simulations`.
- **Délai** : 5 minutes au plus, ou tout de suite avec
  `POST /api/config/revalidate`.

SETUP.md (sections 4 et 5) et API_SIMULATIONS.md (section 5) sont à jour.

## RPC

- `sites_set(p_map boolean, p_wiki boolean)` : ouvrir ou fermer les deux
  sites (permission « Gérer les comptes »).
- `public_config()` renvoie aussi `map_enabled`, `wiki_enabled` et les
  `sim_url_*`.
