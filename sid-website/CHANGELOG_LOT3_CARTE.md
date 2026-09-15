# Intégration carte (sid-map.vercel.app) — résumé

Fichiers **nouveaux/modifiés uniquement**. Prérequis impératif : les
migrations de sid-map (qui créent `map_places`, `map_routes`,
`city_buildings`, `character_positions`, `quests.place_id`, et la fonction
`list_active_positions()`) doivent déjà être appliquées sur le projet
Supabase partagé avant `0026_map_integration.sql`.

## Migration

**`0026_map_integration.sql`** ajoute :
- `character_positions.travel_started_at` — horodatage de départ, pour
  recalculer la progression sans dépendre d'un timer client.
- `character_positions.planned_path` — trajets à plusieurs segments
  (`[{route_id, to_place_id}, ...]`), segment 0 = segment actif (reflété
  par `route_id`). Nécessaire car un même "trajet" côté RP peut traverser
  plusieurs routes bout à bout ; ni sid-map ni le schéma initial ne
  stockaient cette suite d'étapes.
- `start_travel(p_planned_path)` — lance un trajet (calculé côté client via
  Dijkstra, voir plus bas) pour l'utilisateur connecté.
- `advance_my_travel()` — fait avancer/finalise le trajet en cours de
  l'utilisateur connecté (segment terminé → segment suivant, ou arrivée →
  `place_id` mis à jour). Appelée à la consultation du site (mêmes
  principes que `check_and_pay_my_salary` / `process_expired_quests` :
  pas de `pg_cron`), depuis `layout.tsx`, `quests/page.tsx` et `map/page.tsx`.

## Fichiers applicatifs

| Fichier | Rôle |
|---|---|
| `src/types/map.ts` **(nouveau)** | Types `MapPlace`, `MapRoute`, `CityBuilding`, `CharacterPosition`, `ActivePosition`, `TravelPlan` |
| `src/lib/pathfinding.ts` **(nouveau)** | Dijkstra sur le graphe `map_routes` (bidirectionnel), poids = `travel_minutes ?? max(5, longueur_tracé × 2)` — exactement la formule que tu as donnée, pour que les deux sites calculent le même temps |
| `src/app/dashboard/map/page.tsx` **(nouveau)** | Page "Carte" : éditer sa position (lieu / bâtiment / note libre / visibilité), voir la position de tout le monde (`list_active_positions`), compte à rebours live si en trajet |
| `src/app/dashboard/quests/page.tsx` | Sélecteur de lieu à la création d'une quête (`place_id`), affichage du lieu + ETA calculé sur chaque quête localisée, bouton "Lancer le trajet" |
| `src/types/database.ts` | `Quest.place_id` ajouté |
| `src/app/dashboard/layout.tsx` | Lien "Carte" dans la nav, appel de `advance_my_travel()` à chaque chargement du dashboard |

## Comportement du chronomètre

1. `Lancer le trajet` calcule le chemin le plus court (un ou plusieurs
   segments) et appelle `start_travel()`.
2. L'avancement réel est recalculé à partir de `travel_started_at` (pas
   d'écriture périodique nécessaire) — `advance_my_travel()` rafraîchit
   quand même `route_progress` tant que le segment n'est pas fini, pour
   rester compatible avec un éventuel affichage côté sid-map qui se
   fierait uniquement à cette colonne plutôt qu'à `travel_started_at`.
3. À l'arrivée du dernier segment, `place_id` est mis à jour automatiquement
   et le trajet est nettoyé (`route_id`/`route_progress`/`travel_started_at`/
   `planned_path` remis à `null`).
4. La page Carte affiche une barre de progression + un compte à rebours
   `mm:ss` recalculé chaque seconde côté client à partir de
   `travel_started_at`, sans dépendre d'un minuteur qui dérive.
