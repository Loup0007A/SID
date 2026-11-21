# Lot 96 — Contrôles de sécurité, recherche commune, appareils, Carto hors ligne

## À lancer dans Supabase

Sur la base en service, dans cet ordre, **après** toutes les autres migrations :

1. Dossier Central `0120_securite_droits.sql`
2. Cartographie `0121_batiments_proprietaire.sql`
3. Dossier Central `0121_recherche_appareils_export.sql`
4. Dossier Central `0122_devlog_securite_recherche.sql`

Toutes peuvent être relancées. Les sites déjà déployés fonctionnent avant et
après ces migrations.

## Contrôle 1 — Droits de la base

`scripts/audit-securite.sh` (nouveau) a trouvé sur la base d'avant le lot :

| Problème | Correction |
|---|---|
| Un membre gelé, banni ou muet pouvait lever lui-même sa sanction (`is_frozen`, `freeze_until`, `ban_until`, `mute_until` de sa fiche), et changer sa date d'inscription ou l'expiration d'un compte de test. | Réservés à la gestion des comptes (`protect_profile_sensitive_columns`). |
| Sans session, avec la clé publique (visible dans le code) : toutes les fiches actives (prénom, nom, âge…), rôles, groupes, entreprises, cours, Comptoir, et 197 fonctions du jeu (classement avec les soldes, trombinoscope…). | Sans session, il reste l'accueil public (quêtes publiques, maintenance) et 5 fonctions des pages publiques. Les nouvelles fonctions ne sont plus ouvertes sans session par défaut. |
| Les champs masqués d'une fiche (prénom, nom, âge, armes, équipement, description, rôle voulu) étaient envoyés à tous les membres ; seul l'affichage les cachait. Pareil pour les réglages (affichage, notifications, heures calmes). | Lisibles seulement par le membre et la gestion des comptes (`my_profile`, `profiles_full`, `get_visible_profile`, `list_roster`). |
| `get_visible_profile(cible, lecteur)` : sans session, le lecteur était choisi par l'appelant (on pouvait se faire passer pour un admin). | Le lecteur est toujours la session. |
| Le propriétaire d'un bâtiment pouvait changer son type, sa taille, sa position. | Seulement la description et l'image. |
| L'auteur d'un message pouvait changer sa date. | Salon, auteur et date fixés à l'envoi. |

Rien d'autre : toutes les tables ont leurs règles d'accès, toutes les
fonctions SECURITY DEFINER fixent leur `search_path`, les tâches planifiées
sont protégées contre les appels répétés.

## Contrôle 2 — Secrets dans le code public

`npm run secrets` (nouveau, identique dans les trois dépôts) lit tout
l'historique git (toutes branches) et le build : 154, 31 et 73 commits, aucun
secret, phrase du sceau absente (cherchée telle quelle et en base64), aucun
fichier `.env` ni source lisible des titres dans l'historique, aucune clé
`service_role` dans le JavaScript envoyé aux navigateurs.

Limite : GitHub peut garder un temps les anciens commits d'avant une
réécriture de l'historique (accessibles par leur identifiant). Le script ne
voit que l'historique actuel.

## Contrôle 3 — En-têtes, cookies, débit, dépendances

- `en-tetes-securite.js`, commun aux trois sites : le Wiki et la Carto
  reçoivent la politique de contenu (CSP) et COOP du Dossier Central ; HSTS
  (deux ans) et Permissions-Policy (caméra, micro, position, paiement… coupés)
  sur les trois.
- Cookie `sid-confort` marqué `Secure` en HTTPS (il ne contient que les
  réglages d'affichage). Les cookies de session Supabase restent lisibles par
  la page : c'est nécessaire au client Supabase dans le navigateur.
- `/api/config/revalidate` demande une session (sans, on pouvait vider le
  cache en boucle).
- Limite de débit en base (`_limite_debit`) : recherche 30 / 10 s, appareils
  20 / min, export 5 / 10 min. Connexions : limites de Supabase (SETUP.md).
- `npm audit` : corrections sans risque appliquées. Restent les failles de
  Next 14.2.35 (dernière 14) corrigées seulement en Next 15 ou 16 : déni de
  service par les Server Components, empoisonnement de cache, SSRF via
  WebSocket… L'optimiseur d'images (plusieurs failles) est coupé sur les
  trois sites et aucun n'utilise d'action serveur ni de serveur personnalisé,
  ce qui écarte une partie de la liste. Passer à Next 15 est un chantier à
  part (API asynchrones, React 19).

## Fonctionnalités

- **Recherche commune** : Ctrl+K sur le Dossier Central trouve aussi les
  fiches du Wiki et les lieux et bâtiments de la Carto. Sur le Wiki et la
  Carto, Ctrl+K ou le bouton « Trois sites » ouvre la même recherche. Mêmes
  règles que chaque site : fiches découvertes, lieux parcourus par le membre
  (brouillard), comptes invisibles exclus.
- **Carto hors ligne** : la carte, les villes et les bâtiments déjà vus
  s'ouvrent sans réseau, avec un bandeau « Hors ligne : données du … ». Les
  copies sont au nom du membre et effacées à la déconnexion.
- **Appareils connectés** (« Mes données ») : navigateur, date de connexion,
  dernière activité ; déconnecter un appareil ou tous les autres. L'accès en
  cours de l'appareil déconnecté expire dans l'heure au plus.
- **Export** : toute table liée au membre y entre, y compris les plus récentes
  (sondages, enchères, mariages, exploration, propositions du Wiki…), et la
  liste des appareils.
