# Nouveau lot de fonctionnalités — résumé

Fichiers **nouveaux/modifiés uniquement**, à copier par-dessus ton repo actuel
(mêmes chemins). Migrations à exécuter dans l'ordre, à la suite de la
dernière que tu as déjà appliquée (`0019`).

## Migrations

1. **`0020_widen_numeric_precision.sql`** — les montants liés aux achats
   (`shop_items.price/sale_price`, `purchases.total_price`, `transactions.amount`,
   `quests.reward`, `salaries.amount`) passent à 15 chiffres avant la virgule
   (`numeric(15,2)`) ; `wallets.balance` (qui cumule) passe à `numeric(18,2)`.
2. **`0021_quest_capacity_trigger.sql`** — corrige le bug de dépassement de
   `max_participants` : la vérification se faisait côté client (lire le
   compteur puis insérer), ce qui laissait une fenêtre de course entre deux
   personnes cliquant en même temps. Un trigger + verrou côté base rend
   désormais la vérification atomique, quel que soit le nombre de clics
   simultanés.
3. **`0022_dm_labels.sql`** — nouvelle fonction `list_dm_partner_names()`
   pour afficher "MP — Pseudo" au lieu de "Message privé" générique.
4. **`0023_message_editing_formatting.sql`** — ajoute l'édition/suppression
   (douce) des messages, et une mise en forme basique par message : gras,
   italique, couleur.
5. **`0024_leaderboard_reputation.sql`** — ajoute une statistique
   "renommée" (`profiles.reputation`) et la fonction `list_leaderboard()`
   (argent / renommée / quêtes accomplies).
6. **`0025_quest_expiry_and_funding.sql`** — le plus gros morceau :
   - **Financement par le créateur** : par défaut (`funded_by_creator = true`),
     chaque récompense de quête est désormais prélevée sur le portefeuille du
     créateur au moment de la validation (et non plus créée depuis rien). Le
     créateur peut décocher cette option à la création pour revenir à l'ancien
     comportement ("financée par la S.I.D.").
   - **Expiration automatique** : à l'échéance, si le nombre de participants
     requis est atteint → validation + paiement automatiques. Avec une marge
     d'1 place manquante (ex. 9/10) → la quête attend la décision du créateur
     ("valider quand même" / "marquer en échec"), affichée en haut de
     `/dashboard/quests`. En dessous de la marge → échec automatique, sans
     paiement. Ce contrôle se déclenche à la consultation de la page (même
     mécanisme que le salaire à la connexion, pas de `pg_cron`).

**Point 2 de ta liste** (transfert acheteur → vendeur à l'achat) : déjà en
place depuis la migration `0016` du lot précédent — rien à rejouer si tu
l'avais déjà appliquée, sinon vérifie qu'elle est bien passée.

## Fichiers applicatifs modifiés

| Fichier | Changement |
|---|---|
| `src/types/database.ts` | Nouveaux champs (`reputation`, `funded_by_creator`, `pending_expiry_confirmation`, `edited_at`, `is_deleted`, `is_bold`, `is_italic`, `color`) + nouveaux types (`DmPartner`, `LeaderboardEntry`) |
| `src/app/dashboard/quests/page.tsx` | Case "financée par moi-même", bandeau de décision pour les quêtes expirées proches de l'objectif, appel de `process_expired_quests()` au chargement |
| `src/app/dashboard/chat/page.tsx` | Labels "MP — Pseudo", boutons Modifier/Supprimer au survol de ses propres messages, barre gras/italique/couleur à la rédaction |
| `src/app/dashboard/leaderboard/page.tsx` **(nouveau)** | Classement à onglets (argent / renommée / quêtes accomplies) |
| `src/app/dashboard/layout.tsx` | Lien "Classement" ajouté à la navigation |
| `src/app/dashboard/admin/economy/page.tsx` | Nouvelle section "Renommée" (ajustement manuel, comme le solde) |

## Point 8 (mapping / sid-map.vercel.app)

En attente, comme convenu — envoie-moi la structure modifiée de la base
(localisation, routes…) et je m'en occupe.
