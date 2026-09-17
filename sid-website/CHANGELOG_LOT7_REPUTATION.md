# Renommée via les quêtes (fixe ou façon Elo) — résumé

## Migration `0030_quest_reputation_elo.sql`

- `quests.reputation_reward` (int, nullable) : si renseigné à la création,
  gain fixe identique pour tous, **perdu** (même montant) en cas d'échec.
  Si laissé vide (défaut) → calcul automatique.
- `compute_reputation_delta(difficulty, current_reputation, success)` :
  calcul façon Elo. Chaque rang de quête a une "cote" (E=800 → S=1800, un
  peu comme un classement d'échecs), comparée à la renommée actuelle du
  membre (`1000 + reputation`, la renommée affichée partant de 0 pour rester
  lisible). Réussir une quête au-dessus de son niveau rapporte gros ;
  réussir une quête largement en dessous rapporte peu ; échouer une quête
  "facile" pour son niveau coûte cher, échouer une quête très difficile
  coûte peu.
- `validate_quest_participant` / `do_validate_quest_all_participants` :
  appliquent désormais le gain de renommée du **participant** (pas
  forcément le bénéficiaire de l'argent, qui peut être quelqu'un d'autre)
  en plus du paiement existant.
- `reject_quest_participant(quest_id, user_id)` **(nouveau)** : un manager
  peut désormais marquer un participant précis comme ayant échoué (statut
  `rejected`), avec la perte de renommée correspondante.
- Trigger `apply_quest_failure_penalties` : quand une quête entière passe
  au statut `failed` (expiration sans objectif atteint, ou décision du
  créateur via "Marquer en échec"), tous les participants pas encore
  validés perdent automatiquement de la renommée et sont marqués `rejected`.
- Notification `quest_failed` (nouveau type) envoyée dans les deux cas
  d'échec, symétrique à `quest_validated`.

## Fichiers applicatifs

| Fichier | Changement |
|---|---|
| `src/types/database.ts` | `Quest.reputation_reward` ajouté |
| `src/app/dashboard/quests/page.tsx` | Champ "Renommée gagnée" à la création ; bouton "Rejeter" à côté de "Valider" dans la gestion des participants ; badge 🏅 sur chaque carte de quête |

## Note sur le positionnement du panneau de notifications

Ta capture montre encore le panneau débordant sous la sidebar — c'est
exactement le bug corrigé dans le lot précédent (passage en `position:
fixed`, ancré en haut à droite de l'écran). Si tu as bien redéployé
`src/components/NotificationBell.tsx` avec ce correctif et que le problème
persiste, dis-le-moi avec une capture après déploiement : ce serait alors
un souci différent (peut-être un cache de build) qu'il faudra creuser.
