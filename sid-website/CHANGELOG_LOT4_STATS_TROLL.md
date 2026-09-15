# Statistiques admin + commandes de troll — résumé

Fichiers **nouveaux/modifiés uniquement**.

## Migration

**`0027_admin_stats_and_activity.sql`** ajoute :
- `profiles.last_seen_at` + table `activity_log` (une ligne par membre/jour) —
  nécessaires pour "actifs aujourd'hui", "visites", "heure la plus active".
- `record_visit()` — appelée à chaque chargement du dashboard (dans
  `layout.tsx`, même principe que le salaire/le trajet : pas de cron).
- `get_admin_stats()` — un seul appel qui renvoie toutes les statistiques en
  JSON, réservé à la permission `manage_users`.

## Correspondance avec ta liste d'exemples

Ta liste est un modèle générique (pensé pour un groupe d'amis/photos) ; je l'ai
adaptée à ce qui existe réellement dans le schéma de la S.I.D. :

| Ta liste | Implémenté comme |
|---|---|
| 👥 Membres inscrits | ✅ tel quel |
| 🟢 Amis actifs aujourd'hui | ✅ "Actifs aujourd'hui" (`last_seen_at`) |
| 📅 Visites semaine/mois | ✅ tel quel (`activity_log`) |
| 💬 Messages envoyés | ✅ tel quel |
| 😂 Réactions / likes | ❌ pas de système de réaction sur les messages actuellement — non implémenté (dis-moi si tu veux que je l'ajoute, c'est un ajout à part) |
| 📸 Photos publiées | ❌ pas de partage de photos dans le chat — remplacé par **🛒 Achats en boutique** |
| 🏆 Membre le plus actif | ✅ (classé par messages envoyés) |
| 🔥 Série de jours actifs | ✅ tel quel |
| 🎮 Parties/activités organisées | remplacé par **Quêtes créées / accomplies** |
| 📊 Classement selon une activité | déjà couvert par `/dashboard/leaderboard` (argent/renommée/quêtes) |
| 🕐 Heure la plus active | ✅ tel quel |
| 📈 Évolution de l'activité | ✅ graphique en barres, 8 dernières semaines |
| 🎉 Événements organisés | pas de table dédiée — non implémenté |
| Carte thermique | ✅ grille jour × heure, messages envoyés |

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/types/stats.ts` **(nouveau)** | Type `AdminStats` |
| `src/app/dashboard/admin/stats/page.tsx` **(nouveau)** | Page "Statistiques", cartes + graphique + heatmap |
| `src/types/database.ts` | `Profile.last_seen_at` ajouté |
| `src/app/dashboard/layout.tsx` | Lien "Statistiques" (perm `manage_users`), appel de `record_visit()` |

---

## Commandes de troll dans le chat

**Aucune donnée stockée en base** : une commande tapée dans le champ de
message n'est jamais insérée dans `chat_messages` (pas de pollution de
l'historique, rien à modérer). Elle est diffusée aux autres participants du
salon **actuellement connectés** via un *broadcast* Supabase Realtime
(éphémère, pas de nouvelle table), et jouée immédiatement en local pour
l'expéditeur.

- `/shake`, `/earthquake`, `/invert`, `/spin`, `/glitch`, `/party`, `/drunk`,
  `/gravity` → animations CSS pures (classes ajoutées/retirées sur `<body>`).
- `/rain`, `/confetti` → particules DOM générées et retirées après quelques secondes.
- `/matrix` → pluie de caractères sur un `<canvas>` plein écran (~4 s).
- `/boom` → flash blanc + tremblement.
- `/jumpscare` → gros emoji 👻 qui apparaît en plein écran (pas d'image
  effrayante, comme demandé) + léger tremblement.
- `/404` → fausse page d'erreur 404 en overlay (~3 s).
- `/rickroll` → **pas de vraie chanson/vidéo** (droits d'auteur + faisable
  uniquement en clair côté client) : à la place, un overlay "Tu viens de te
  faire avoir 🕺" dans le même esprit.
- `/troll` → tire une des commandes ci-dessus au hasard.

Un bouton "😈 /commandes" au-dessus du champ de saisie affiche la liste
cliquable. Un membre **mute** ne peut pas non plus utiliser ces commandes
(même logique que pour les vrais messages).

### Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/trollEffects.ts` **(nouveau)** | Moteur des effets (aucune dépendance, DOM/canvas natifs) |
| `src/app/globals.css` | Ajout des animations CSS des effets (fichier complet fourni, à remplacer) |
| `src/app/dashboard/chat/page.tsx` | Détection des commandes, diffusion broadcast, bouton "commandes" |
