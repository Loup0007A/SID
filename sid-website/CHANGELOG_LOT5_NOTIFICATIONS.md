# Commandes admin-only, stats d'achats, notifications (in-app + push) — résumé

## 1. Commandes de troll réservées aux admins

`chat/page.tsx` charge désormais les permissions (`loadCurrentUser`) et
n'autorise l'exécution/l'affichage des commandes qu'aux membres ayant
`manage_users` (ou fondateur). Pour un non-admin : le bouton "😈 /commandes"
n'apparaît même pas, et si jamais il tape `/shake` quand même, le message
n'est ni exécuté ni envoyé — juste un rappel "Seuls les admins peuvent
utiliser les commandes de troll."

## 2. Stats d'achats supplémentaires

`get_admin_stats()` (migration `0028`) renvoie maintenant en plus :
- 🥇 objet le plus vendu (nom + quantité)
- 💸 meilleur acheteur (pseudo + total dépensé)
- 🏪 meilleur vendeur (pseudo + total encaissé sur ses ventes)
- 📈 évolution hebdomadaire des achats (nombre + valeur, 8 dernières semaines,
  affiché en graphique en barres comme celui des messages)

## 3. Centre de notifications (fonctionnalité indispensable, jusqu'ici absente)

### In-app (fonctionne immédiatement, sans configuration)

Migration **`0028_notifications_and_purchase_stats.sql`** : table
`notifications` + triggers qui la remplissent automatiquement :
- 💬 nouveau message reçu (agrégé par salon : "×3" plutôt que 3 lignes)
- ✅ quête validée (récompense versée)
- 📋 candidature acceptée/refusée
- ⏳ quête expirée proche de l'objectif, en attente de ta décision (créateur)
- 🧭 arrivée à destination (carte)

Cloche 🔔 ajoutée dans la barre latérale (desktop) et la barre du haut
(mobile) — `src/components/NotificationBell.tsx`. Live via Realtime, avec un
repli en sondage toutes les 45 s si Realtime n'est pas actif sur la table.

### Push navigateur (optionnel, nécessite une configuration manuelle)

Migration **`0029_push_notifications.sql`** ajoute l'infrastructure : table
`push_subscriptions`, table `app_config` (à remplir toi-même), et un trigger
qui appelle `POST /api/push/send` via l'extension `pg_net` à chaque nouvelle
notification.

**Important — comme `pg_cron` précédemment, `pg_net` n'est pas garanti
disponible sur tous les projets Supabase.** Le bloc d'activation échoue
silencieusement si l'extension n'existe pas, et le trigger avale ses propres
erreurs : **sans configuration, la cloche in-app continue de fonctionner
normalement**, seul le push navigateur ne partira pas.

#### Mise en place du push (à faire une fois)

1. **Génère les clés VAPID** (une seule fois, à garder précieusement) :
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Variables d'environnement** à ajouter (Vercel → Settings → Environment
   Variables) :
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # clé publique générée ci-dessus
   VAPID_PRIVATE_KEY=...              # clé privée générée ci-dessus
   VAPID_SUBJECT=mailto:toi@example.com
   PUSH_WEBHOOK_SECRET=...            # une chaîne aléatoire que tu choisis
   ```
3. **Dans le SQL Editor Supabase**, une fois le site déployé :
   ```sql
   insert into public.app_config (key, value) values
     ('site_url', 'https://ton-site.vercel.app'),
     ('push_webhook_secret', 'la_même_valeur_que_PUSH_WEBHOOK_SECRET');
   ```
4. Redéploie le site (pour que les variables d'environnement soient prises
   en compte). Chaque membre active ensuite le push lui-même depuis
   `/dashboard/profile` (section "Notifications" → "Activer sur cet
   appareil") — c'est par appareil/navigateur, pas par compte.

Si tu préfères ne pas mettre ça en place tout de suite, ignore l'étape push :
tout le reste (cloche in-app, stats, commandes) fonctionne indépendamment.

### Fichiers

| Fichier | Rôle |
|---|---|
| `src/types/notifications.ts` **(nouveau)** | Type `AppNotification` |
| `src/components/NotificationBell.tsx` **(nouveau)** | Cloche + dropdown |
| `src/lib/push.ts` **(nouveau)** | Abonnement/désabonnement push côté client |
| `public/sw.js` **(nouveau)** | Service worker (affiche la notif, gère le clic) |
| `src/app/api/push/send/route.ts` **(nouveau)** | Envoie réellement le push (appelée par le trigger via `pg_net`, protégée par secret) |
| `src/app/dashboard/layout.tsx` | Cloche intégrée (desktop + mobile) |
| `src/app/dashboard/profile/page.tsx` | Section "Notifications" (activer/désactiver le push) |
| `package.json` | Ajout de `web-push` (+ `@types/web-push`) |

`npm install` à relancer après avoir copié le nouveau `package.json`.
