# Lot 45 : rapidité de chargement

Aucune migration à lancer.

## Ce qui ralentissait
- **Chaque page attendait le serveur d'authentification**, parfois trois ou
  quatre fois de suite : une fois dans le middleware (avant même d'envoyer la
  page), puis dans le layout, dans le chargement du profil, et dans la page.
- **Le profil était chargé en file indienne** (session → profil → rôles →
  permissions), et chaque page le rechargeait juste après le layout.
- **Les pages chargeaient leurs données l'une après l'autre** (jusqu'à dix
  requêtes à la suite pour les quêtes).
- **Tout était téléchargé et exécuté à chaque page**, même hors saison ou sans
  farce en cours : décors d'Halloween, de Noël et des fêtes, effets des 20
  farces, arène du dragon, secrets des titres (code brouillé coûteux), mini-jeu
  de la 404, traînée du curseur.
- La page d'accueil publique était recalculée à chaque visite.

## Ce qui a changé
- **Middleware** : ne regarde plus que la présence du cookie de session (plus
  d'appel réseau) et ne s'occupe que de `/dashboard`. Le jeton est rafraîchi
  par le navigateur ; les données restent protégées par la base (RLS).
- **Session lue sur place** (`src/lib/session.ts`) au lieu de
  `auth.getUser()` côté navigateur.
- **Profil + permissions** (`loadCurrentUser`) : une seule série de requêtes
  en parallèle (rôles et permissions d'un coup), partagée entre le layout et
  la page.
- **Tableau de bord** : la page se monte tout de suite (invisible le temps que
  le profil arrive) et charge ses données en même temps ; aux ouvertures
  suivantes, le profil du dernier passage s'affiche immédiatement puis est
  remplacé par la version à jour (effacé à la déconnexion, jamais gardé pour
  un compte non actif ou de test).
- **Entretien** (économie du jour, trajet, visite, détecteur d'alertes) : en
  parallèle, une fois la page affichée, et l'économie / le détecteur au plus
  toutes les 5 / 3 minutes par navigateur (ils rattrapent le temps écoulé).
- **Pages** (accueil, quêtes, messagerie, banque, boutique, profil, dossier
  d'un membre, entreprises, carte, données, réglages) : requêtes en parallèle.
- **Chargement à la demande** (`src/components/lazy/`,
  `src/components/seasonal/Seasonal.tsx`) : décors seulement pendant leur
  événement, effets seulement quand une farce vise le membre, secrets des
  titres une fois la page affichée, traînée du curseur seulement avec une
  souris. Le code du layout du tableau de bord passe de 133 ko à 29 ko.
- **Code scellé** : chaînes encodées en base64 au lieu de rc4 (toujours
  illisible, mais ~10 fois plus rapide à décoder au chargement).
- **Accueil public** : préparé à l'avance et servi par le CDN (mis à jour
  toutes les 30 s).
- Petites choses : logo en WebP (31 → 3 ko), images du dossier public gardées
  un jour par le navigateur, décor gardé le temps de la visite, une seule
  requête pour les sections suspendues, l'horloge des farces ne tourne que
  s'il y en a.

## Mesures (avant → après)
Base de test avec 85 ms d'aller-retour vers Supabase. « Prêt » = la page
affiche son contenu.

| Page | Ordinateur | Téléphone (processeur ×4, 4G) |
|---|---|---|
| Tableau de bord, première visite | 1,3 s → 0,75–1 s | 1,6–2,6 s → 1–1,3 s |
| Tableau de bord | 1,4 s → 0,5 s | 1,8 s → 0,75 s |
| Quêtes | 1,1 s → 0,2–0,4 s | 1,6 s → 0,6–0,8 s |
| Profil | 1,6 s → 0,5 s | 3,5 s → 0,9 s |
| Notifications | 1,7 s → 0,3 s | 2,9 s → 0,9 s |
| Banque / Boutique / Messagerie | ~1,15 s → 0,25–0,45 s | ~1,7 s → 0,6–0,75 s |
| Accueil public | 0,7 s → 0,2–0,3 s | 1,1 s → 0,5 s |

Délai avant la première réponse du serveur : ~80 ms → ~5 ms.
