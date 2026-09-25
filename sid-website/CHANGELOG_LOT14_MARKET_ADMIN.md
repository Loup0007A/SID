# Vocabulaire, classement de puissance, bourse réaliste, stats & outils admin — résumé

Fichiers **nouveaux/modifiés uniquement**, à copier par-dessus ton repo (mêmes
chemins relatifs), sauf `apply_updates.py` qui n'est pas un fichier du site :
c'est un script à lancer une fois pour patcher les quelques fichiers existants
qui ne sont pas fournis en entier ci-dessous (voir étape 3).

## 1. Migrations SQL (dans l'ordre, à la suite de `0036_business_full_management.sql`)

1. **`0037_power_score_and_protections.sql`**
   - Classement de **puissance** : `profiles.power_score`, saisi à la main par
     un admin (`manage_users` ou `manage_economy`) via `set_power_score(user_id, score)`,
     journalisé dans `power_score_log`.
   - `list_leaderboard()` renvoie désormais aussi `power_score`.
   - **Correctif de sécurité** : la policy `profiles_update_self` permettait à
     n'importe quel membre de modifier n'importe quel champ de son propre
     profil via l'API — y compris `is_founder`, `reputation`, `member_rank`,
     `status`. Un trigger bloque maintenant ces colonnes pour les appels
     directs du navigateur (les fonctions `SECURITY DEFINER` existantes ne
     sont pas concernées).
   - Renomme "de la S.I.D." → "du S.I.D." dans les textes stockés en base
     (description des rôles, notification de candidature acceptée).

2. **`0038_realistic_market.sql`** — bourse réaliste :
   - **Cours piloté par l'activité réelle** ("le PIB de l'entreprise") :
     fonds propres, bénéfice des 7 derniers jours, dividendes des 30 derniers
     jours, une survaleur de départ qui décroît avec l'âge. Le cours suit
     cette valeur avec retour à la moyenne + volatilité + actualités.
   - **Frais en 2 parties** à l'achat : un pourcentage (caisse commune,
     redistribuée comme la TVA) + **0,50 Cr. par action, reversé
     immédiatement, à parts égales, aux comptes admin** (fondateur +
     `manage_users`) — exactement la part demandée.
   - **Anti-spéculation** : chaque achat crée un "lot" horodaté ; impossible
     de revendre avant 30 min (réglable) de détention. Fini l'aller-retour
     achat/revente instantané pour empocher la différence.
   - **Liquidité garantie** : une entreprise peut toujours racheter au moins
     une action — la caisse commune avance le manque de trésorerie si besoin,
     et un ordre trop gros est exécuté **partiellement** plutôt que rejeté.
   - `list_market_overview()`, `get_market_settings()`, `get_my_sellable_shares()`
     nouveaux ; `get_business_price_history()` corrigé (il renvoyait les 200
     points les plus **anciens** au lieu des plus récents).

3. **`0039_admin_tools.sql`** — outils d'administration :
   - **Annonces à la connexion** : `create_announcement`, `list_unread_announcements`,
     `acknowledge_announcement`, `deactivate_announcement`.
   - **Maintenance par section** : `set_maintenance('shop'|'chat'|'bank'|'quests'|'registrations', enabled, message)`.
     Bloque réellement les actions côté base (achats, bourse, emprunt, envoi
     de message, prise de quête, inscription) — pas juste un bandeau visuel.
   - **Sanctions** : `issue_sanction(user_id, type, reason, amount?, duration_minutes?)`
     avec `type` parmi `warning`, `mute`, `freeze` (gèle achats/bourse/emprunt/quêtes),
     `ban`, `fine` (amende directe). Expiration automatique des sanctions
     temporaires (`expire_sanctions()`, intégrée au traitement déjà déclenché
     à la connexion). `lift_sanction(id)` pour lever une sanction en avance.

4. **`0040_stats_timezone_fix.sql`** (déjà présent dans ce lot précédent,
   renuméroté) — corrige le décalage d'heures et fournit des séries
   complètes (jours/semaines sans activité à 0 au lieu d'être absents).

## 2. Fichiers applicatifs fournis en entier

| Fichier | Rôle |
|---|---|
| `src/components/LineChart.tsx` **(nouveau)** | Graphique en courbe (SVG, lissé, tooltip tactile/souris) réutilisé partout où il y avait des barres |
| `src/components/PowerAdminSection.tsx` **(nouveau)** | Bloc admin pour définir le score de puissance d'un membre |
| `src/components/AnnouncementBanner.tsx` **(nouveau)** | Modale affichée à la connexion pour les annonces non lues |
| `src/components/MaintenanceNotice.tsx` **(nouveau)** | Bandeau "section fermée" réutilisable (déjà branché sur `/dashboard/bank`) |
| `src/types/business.ts` | + `MarketEntry`, `MarketSettings`, `SellResult` |
| `src/types/stats.ts` | + champs fuseau horaire, série quotidienne, argent en circulation… |
| `src/types/admin.ts` **(nouveau)** | Types `Announcement`, `MaintenanceFlag`, `Sanction` |
| `src/app/dashboard/leaderboard/page.tsx` | Onglet "Puissance" ajouté |
| `src/app/dashboard/admin/stats/page.tsx` | Courbes au lieu de barres, carte thermique cliquable/survolable (le survol affiche maintenant l'activité sous la carte, plus de doute sur l'heure la plus active), nouvelles cartes (argent en circulation, entreprises actives, caisse d'impôts) |
| `src/app/dashboard/bank/page.tsx` | Bourse réécrite : cours + valeur intrinsèque en courbe, variation 24h, badge "sur/sous-évaluée", nombre d'actions revendables tout de suite, message de vente partielle |
| `src/app/dashboard/admin/moderation/page.tsx` **(nouveau)** | Page unique : annonces, interrupteurs de maintenance, sanctions |

## 3. Script de patch pour les fichiers existants non fournis en entier

`apply_updates.py` modifie, **à la racine du projet** (là où se trouve
`package.json`) :

```bash
python3 apply_updates.py
```

- Remplace "de la S.I.D." → "du S.I.D." (et variantes grammaticales) dans
  tout `src/**/*.ts(x)` et `README.md`.
- Ajoute `power_score` à `src/types/database.ts`.
- Insère `<PowerAdminSection />` dans `src/app/dashboard/admin/economy/page.tsx`.
- Remplace le graphique en barres des ventes par objet dans
  `src/app/dashboard/shop/page.tsx` par une courbe.
- Ajoute le lien "Modération" et la bannière d'annonces dans
  `src/app/dashboard/layout.tsx`.

Le script est **idempotent** : le relancer ne casse rien s'il a déjà tourné.
Si une des ancres attendues ne se trouve pas (fichier déjà modifié à la
main entre-temps), le script s'arrête avec un message clair plutôt que de
mal patcher.

## 4. Pour aller plus loin (non fait ici, budget de ce lot)

- `MaintenanceNotice` n'est branché que sur `/dashboard/bank` à titre de
  démonstration — l'ajouter à `/dashboard/shop`, `/dashboard/chat`,
  `/dashboard/quests` est un simple `<MaintenanceNotice sectionKey="shop" />`
  en haut de chaque page (les actions sont déjà bloquées côté base dans
  tous les cas, avec ou sans ce bandeau).
- Le bouton "Mute"/"Bannir" rapide de `/dashboard/admin/users` ne pose pas
  `mute_until`/`ban_until` (il reste "définitif" comme avant) ; pour une
  sanction **temporaire**, passer par la nouvelle page Modération.
- Le "1/2 $" a été traduit en 0,50 Cr. (l'économie du site est en Crédits,
  pas en dollars) — ajustable via `app_config.market_admin_fee_per_share`.
