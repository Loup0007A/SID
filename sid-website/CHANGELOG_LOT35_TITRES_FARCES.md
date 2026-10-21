# Lot 35 — Titres secrets et pouvoirs de farce

Migration : `supabase/migrations/0061_titres_trolls.sql` (après 0060).
À lancer une fois dans Supabase (SQL Editor). Les déclencheurs liés aux autres
sites se posent tout seuls si leurs tables existent.

Simulations mises à jour (déjà en ligne) : dépôts **Potions** et
**Techniques** (niveau caché 101). Donjons avait déjà son niveau 101.

> 🔒 Les conditions d'obtention sont scellées (voir `scripts/scelle/`). Les
> membres ne voient que des énigmes sur la page Titres.

## Pour les membres
- **Titres** (`/dashboard/titles`, Mon espace) : la vitrine des 12 titres
  (énigme tant qu'il est verrouillé, nombre de porteurs), le titre équipé et
  son **pouvoir de farce**.
- Le titre équipé s'affiche sur le dossier (aura animée propre à chaque
  titre), au trombinoscope, au classement et dans la messagerie.
- Obtenir un titre : grande révélation animée, notification 🏅, et il
  s'équipe tout seul si aucun ne l'était.
- **Anniversaire** (Mon dossier) : jour et mois, facultatif. Le jour J, un 🎂
  apparaît à côté du nom (dossier) et l'accueil affiche « Anniversaire
  aujourd'hui ». La date n'est jamais montrée.

## Les 12 titres
| Titre | Pouvoir |
|---|---|
| 🐉 Fléau Draconique | **Défi du Dragon** : se changer en dragon et provoquer un membre ou tout le S.I.D. en duel (frapper les écailles, parer le souffle) — ou fuir |
| 🕸️ Architecte du Réseau | **Réseau détraqué** : éditeur de nœuds pour rebrancher les liens d'un membre, logique fixe / rotation / va-et-vient / chaos, 10 min |
| ⚡ Éclair Vivant | **Calcul forcé** : 3 calculs mentaux du niveau 50 avant chaque page, 10 min |
| 👻 Fantôme 404 (niv. I à V) | **Hantise** : fausses pages 404 avec un fantôme à attraper ; plus fréquent et plus long par niveau |
| 🎁 Grand Mécène (niv. I à V) | **Fête forcée** : confettis à chaque clic, bannière, curseur ; tout le S.I.D. dès le niveau 3 |
| 🌊 Abyssal | **Appel des abysses** : défilement inversé, la page coule, 10 min |
| 💰 Magnat Insatiable | **Huissier** : avis de saisie puis tampons « SAISI », 10 min |
| 💋 Lèche-Bottes Boursier | **Flatterie obligatoire** : chaque message de la cible finit par « … et X est le meilleur ! », 10 min |
| 🧭 Arpenteur des Mondes | **Monde à l'envers** : site en miroir, retournements, 10 min |
| 🪶 Scribe Infini | **Réécriture** : les mots du site changent (quêtes → patates…), 10 min |
| 🎵 Métronome | **Rationnement** : un clic toutes les 8 s, 10 min |
| 📜 Lecteur des Petites Lignes | **Avenant obligatoire** : un contrat absurde à signer avant chaque page, 10 min |

## Garde-fous
- Un pouvoir ne s'utilise qu'avec son titre **équipé**.
- Recharge : 3 h (dragon : 2 h), 24 h pour viser tout le S.I.D.
- Une seule farce à la fois par membre, puis 30 min de répit.
- La cible voit toujours qui la trolle et le temps restant (petite pastille en
  bas à gauche) ; un mot la prévient quand c'est fini.
- Les pages d'administration ne sont jamais bloquées (calcul, contrat,
  fantôme) : un admin peut toujours couper les farces.
- Rien n'est réellement modifié : les messages flattés gardent leur texte, la
  mention est stockée à part.

## Administration
- **Titres & farces** (`/dashboard/admin/titles`) : interrupteur général,
  farces en cours (arrêter), boucliers (un membre protégé ne subit plus rien),
  donner / retirer un titre (pratique pour tester avec le bac à sable),
  porteurs de chaque titre.
- Journal d'audit : titre donné / retiré, farce arrêtée, bouclier, interrupteur.
- Fiche d'un membre : nouvelles sources « Titres » et « Farces » dans le journal.
- Réglage `trolls_enabled` (table `app_config`, 1 par défaut) : interrupteur
  des farces. Les autres réglages des titres sont dans la partie scellée.

## Simulations : niveau caché 101
- **Techniques — le Circuit Fulgurant** : s'ouvre après les 100 niveaux (porte
  cachée). Les neuf ateliers d'une traite, réglés au-delà du
  niveau 100, sans second essai, 40 minutes.
- **Intelligence — l'Épreuve de l'Archive** : s'ouvre quand potions, énigmes
  et problème sont à 100. Les trois épreuves du niveau 100 enchaînées,
  75 minutes, une seule tentative au problème.
- Le S.I.D. n'accepte `niveau=101` que si les 100 niveaux sont vraiment
  validés côté serveur (`level_locked` sinon).

## Divers
- Données personnelles : export (Mes données) complété (titres, farces,
  anniversaire, cadeaux) ; CGU et politique de confidentialité mentionnent les
  titres, les farces et l'anniversaire facultatif (sur les trois sites).
- Correctif : la page Notifications ne lève plus d'erreur temps réel quand on
  y revient (canal déjà abonné).
