# Correctif positionnement + notifications multi-plateformes — résumé

## 1. Bug de positionnement du panneau de notifications (corrigé)

**Cause :** le panneau s'ouvrait en `position: absolute` ancré au bouton
🔔, avec une largeur (320px) supérieure à celle de la sidebar (256px). Il
débordait donc hors de la sidebar et se superposait au contenu principal
("SOLDE DU DOSSIER"), exactement comme sur tes captures.

**Correctif :** le panneau est maintenant en `position: fixed`, ancré en
haut à droite de l'écran (indépendant de l'endroit où se trouve le bouton
cloche) — il ne peut plus déborder ni se superposer à rien, que ce soit en
version desktop (sidebar) ou mobile (barre du haut).

Fichier modifié : `src/components/NotificationBell.tsx`.

## 2. "De vraies notifications, comme Discord" — ce qui est possible et comment

Techniquement, un site web ne peut pas envoyer de notifications système
exactement comme l'app native Discord (App Store/Play Store) — mais il peut
s'en approcher fortement via les **notifications push du navigateur**
(c'est ce qui avait déjà été mis en place) :

| Plateforme | Fonctionne comment |
|---|---|
| **Ordinateur** (Chrome, Edge, Firefox) | ✅ Directement, aucune manipulation particulière une fois le push configuré (voir le changelog précédent pour les clés VAPID) |
| **Android** | ✅ Directement, dans Chrome ou en PWA installée |
| **iPhone/iPad** | ⚠️ Apple **n'autorise les notifications que pour un site ajouté à l'écran d'accueil** — jamais pour un onglet Safari classique, même avec la permission navigateur accordée. C'est une restriction du système, pas une limite de ce site. |

### Ce qui a été ajouté pour qu'iOS soit possible

- **`public/manifest.json`** — fichier manifeste requis pour qu'iOS propose
  "Sur l'écran d'accueil" et traite le site comme une app installée.
- **`src/app/layout.tsx`** — lien vers le manifeste + balises spécifiques
  Apple (`apple-mobile-web-app-capable`, icône d'écran d'accueil, etc.).
- **`src/lib/push.ts`** — détection iOS + détection "déjà installé" ou non
  (`needsIosInstallFirst()`), et enregistrement du service worker dès
  l'arrivée sur le dashboard (`registerServiceWorker()`), plus tôt qu'avant.
- **`src/app/dashboard/profile/page.tsx`** — sur iPhone/iPad non installé,
  le bouton "Activer" est remplacé par des instructions pas à pas
  (Partager → Sur l'écran d'accueil → rouvrir depuis l'icône).

### Ce qui ne change pas

Le reste de l'infrastructure push (clés VAPID, `pg_net`, table `app_config`)
est celle déjà mise en place précédemment — si tu ne l'as pas encore
configurée, ces instructions sont dans `CHANGELOG_LOT5_NOTIFICATIONS.md`.
Sans cette config, la cloche 🔔 in-app continue de fonctionner normalement
quelle que soit la plateforme ; seul le vrai push navigateur en dépend.

### Limite honnête à connaître

Même une fois tout configuré, sur iPhone : chaque membre doit **installer
le site sur son écran d'accueil lui-même** (impossible de le faire à sa
place) et le rouvrir depuis cette icône avant d'activer les notifications —
ce n'est pas automatique comme une app téléchargée depuis l'App Store.
