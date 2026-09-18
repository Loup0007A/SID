# Masquage des quêtes terminées — résumé

Les quêtes au statut `completed` (accomplie) ou `failed` (échouée) ne
s'affichent plus :
- sur le panneau principal `/dashboard/quests` (uniquement `open` et
  `in_progress` désormais) ;
- dans "Mes missions en cours" du tableau de bord (`/dashboard`), qui ne
  garde que les quêtes encore actives parmi celles auxquelles le membre
  participe.

Le panneau public de la page d'accueil et "Panneau des missions" filtraient
déjà sur `open`/`in_progress`, donc rien à changer de ce côté.

Ces quêtes ne sont pas supprimées : elles restent en base (historique,
transactions, statistiques) — juste plus affichées dans les listes actives.

## Fichiers

| Fichier | Changement |
|---|---|
| `src/app/dashboard/quests/page.tsx` | Filtre `status in (open, in_progress)` sur la requête principale |
| `src/app/dashboard/page.tsx` | Même filtre appliqué à "Mes missions en cours" |
