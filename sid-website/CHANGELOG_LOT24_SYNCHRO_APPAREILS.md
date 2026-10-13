# Lot 24 — Progression des simulations synchronisée entre appareils

## Ce qui change

La progression des trois simulations (niveaux débloqués, délais entre
tentatives, histoires et sauvegardes du jeu 3D) suit maintenant le membre
d'un appareil à l'autre : on commence sur le téléphone, on continue sur
l'ordinateur.

- `supabase/migrations/0050_simulation_progress.sql` : table
  `simulation_progress` (une ligne par membre et par simulation) et fonctions
  `get_simulation_progress` / `save_simulation_progress`, réservées au
  serveur, identifiées par le jeton de partie.
- `src/app/api/simulations/progress/route.ts` : `GET` et `POST`.
- `public/sid-sync.js` : le script que chaque site charge ; il fusionne la
  progression au chargement et renvoie chaque modification.
- `supabase/VERIFIER_MIGRATIONS.sql`, `API_SIMULATIONS.md` (section 6).

Une ligne ajoutée dans le `<head>` des trois sites (PR dans chaque dépôt) :

```html
<script src="https://sid-quest.vercel.app/sid-sync.js" async></script>
```

## Limites

- Ne fonctionne que quand le site est ouvert **depuis le S.I.D.** (c'est le
  jeton de partie qui identifie le membre). Ouvert seul, le site garde sa
  progression locale comme avant ; elle sera fusionnée la première fois
  qu'il sera ouvert depuis le S.I.D. sur cet appareil.
- Les réglages propres à un appareil (qualité graphique, sensibilité) ne sont
  volontairement pas synchronisés.

## Mise en place

1. Fusionner la PR du S.I.D. et exécuter `0050_simulation_progress.sql`
   (après 0047 → 0049) dans Supabase.
2. Fusionner les PR des trois sites (Potions, Techniques, 3D-game-world).
