# Lot 99 — Audit de sécurité

## À lancer dans Supabase, en priorité

1. Dossier Central `0127_audit_securite_correctifs.sql`
2. Dossier Central `0128_devlog_audit_securite.sql`

Les deux peuvent être relancées. Puis :
`AUDIT_URL=<chaîne de connexion> bash scripts/audit-securite.sh` doit finir
par « BILAN 0 échec(s) ». Tant que la 0127 n'est pas lancée, « Réinitialiser
le mot de passe » et « Confirmer l'adresse » (Comptes) répondent « Lance
d'abord la migration 0127 ».

## Ce qui a été contrôlé

- Base : règles d'accès de chaque table (lecture et écriture), 493 fonctions
  appelables par un membre (droits, paramètres qui désignent un autre
  membre), déclencheurs, stockage, configuration.
- Argent : 32 fonctions essayées avec des montants et quantités négatifs,
  nuls ou démesurés, en membre sans droits ; roue du jour et récompense
  d'accueil appelées six fois en même temps. Tout est refusé ou compté une
  seule fois.
- Pages et routes serveur des trois sites : routes /api, clé service_role,
  HTML injecté, liens, redirections, CSS des membres, en-têtes, dépendances.

## Corrigé

| Gravité | Problème | Correctif |
| --- | --- | --- |
| Critique | Un membre pouvait s'ajouter lui-même à n'importe quelle conversation (privée, groupe, candidature) dont il connaissait l'identifiant, et en lire tous les messages. | Seul le créateur ajoute des participants ; dans un groupe, un participant ajoute d'autres membres. Une conversation privée reste à deux. |
| Haute | Prendre une mission directement par l'API permettait de s'inscrire déjà « validé », avec un rapport, sur une quête close ou privée. | Déclencheur : statut remis à « assigné », rapport vidé, quête ouverte et non privée exigée (sauf responsables). |
| Haute | La gestion des comptes (y compris un compte de test) pouvait réinitialiser le mot de passe d'un fondateur ou d'un autre administrateur, et donc prendre son compte. | `admin_peut_gerer_compte(cible)` : jamais un fondateur ni un administrateur, sauf par un fondateur ; jamais depuis un compte de test. Mot de passe temporaire tiré au hasard cryptographique (14 caractères). |
| Moyenne | Le recrutement pouvait modifier n'importe quelle fiche (pas seulement les candidatures) ; la gestion des comptes pouvait modifier la fiche d'un fondateur. | Recrutement limité aux fiches en attente ; fiche d'un fondateur modifiable par lui ou un fondateur. |
| Moyenne | CSS des fiches : `url()` contournable par un échappement CSS ou `image-set()` (charger une image extérieure révèle l'adresse IP des visiteurs) ; un sélecteur `~`/`+` ou une règle imbriquée sortait de la carte ; la carte pouvait être agrandie ou déplacée pour couvrir la page. | Refus à l'enregistrement et au nettoyage ; `contain: paint` imposé à la carte ; ni position, transformation, z-index ni marge négative sur la carte elle-même. |
| Basse | Stockage : avatars, images d'objets et de la carte acceptaient tout fichier, de toute taille (une page HTML pouvait y être hébergée). | Images seulement (PNG, JPEG, WebP, GIF), 5 Mo (10 Mo pour la carte). |
| Basse | Connexion de la Carto : `?next=/\site.com` renvoyait vers un autre site. | Chemin interne strict. |
| Basse | Étal du marché noir : son propriétaire pouvait le déplacer dans n'importe quel lieu. | Ni lieu ni propriétaire modifiables par le joueur. |
| Basse | Messagerie et commentaires de la carte sans limite d'envoi. | 40 messages et 10 commentaires par minute. |
| Info | Secret des notifications push comparé en temps variable ; client service_role inutilisé dans la Carto. | Comparaison en temps constant ; client retiré. |

`scripts/audit-securite.sql` vérifie maintenant ces intrusions (conversation,
mission close, CSS échappé) et les fonctions SECURITY DEFINER dont un test
de `current_user` serait sans effet. Sur la base d'avant le lot, il signale
3 échecs ; après, 0.

## À décider, non changé

- **Next 14** : 14.2.35 est la dernière version 14, et `npm audit` signale
  encore des failles (dont deux critiques). Les plus graves touchent
  l'optimiseur d'images (coupé sur les trois sites), les Server Actions
  (aucune) et les serveurs Windows ; restent surtout des dénis de service et
  empoisonnements de cache. Correctif complet : passer à Next 15.5 (gros
  chantier : `cookies()`, `headers()` et `params` deviennent asynchrones).
- **Brouillard de la carte** : les tables `map_places`, `map_routes` et
  `city_buildings` sont lisibles en entier par tout membre (positions des
  lieux pas encore explorés). Les restreindre casserait les noms des lieux
  de quête ; à trancher selon le jeu.
- **Simulations** : le résultat d'une partie est envoyé par le navigateur du
  joueur avec son jeton ; un joueur peut annoncer une réussite pour sa
  propre partie. Limite de conception des trois sites de simulation.
- **CSP** : images et connexions ne sont pas restreintes à une liste de
  domaines (images extérieures du Wiki et de la boutique).

## Toujours à faire de ton côté (Lots 96-98)

- Migrations 0120 à 0126 du Dossier Central et 0121-0122 de la Carto.
- Limites de connexion de Supabase (Authentication → Rate Limits).
- Ancien commit `f181690` toujours servi par GitHub (demande au support).
