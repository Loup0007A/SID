# Lot 57 : animation de connexion, accueil direct

Pas de migration.

- **Animation de connexion** (≈ 1,6 s) sur les trois sites, juste après une
  connexion réussie, avec le nom de l'agent dès qu'il est connu :
  - Dossier Central : le sceau du S.I.D. est scanné, le tampon « Accès
    autorisé » tombe (« Bienvenue, Bob · ouverture du dossier ») ;
  - Cartographie : une rose des vents se trace à la plume et l'aiguille
    trouve le nord (« L'Atlas s'ouvre · Bon voyage, Bob. ») ;
  - Wiki : la couverture du Codex s'ouvre sur ses pages (« Le Codex s'ouvre ·
    Bonne chasse, Bob. »).
  La page d'arrivée se charge pendant l'animation. Avec « réduire les
  animations » (réglage de l'appareil), elle ne dure qu'un instant.
- **Dossier Central** : un membre connecté qui ouvre la page d'accueil
  publique (la racine du site) arrive directement sur `/dashboard`. Les
  visiteurs voient toujours la page publique.
