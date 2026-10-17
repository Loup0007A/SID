# Lot 36 — Réglages des farces et Arène du Dragon en 3D

Migration : `supabase/migrations/0062_farces_options_arene.sql` (après 0061).
À lancer une fois dans Supabase (SQL Editor). Vérification :

```sql
select column_name from information_schema.columns
where table_name = 'troll_actions' and column_name = 'result';  -- 1 ligne
```

Jeu 3D (dépôt **3D-game-world**, déjà en ligne) : nouvelle page
`arena.html`, l'Arène du Dragon.

## Un panneau de réglages pour chaque farce
Sur la page **Titres**, sous le choix de la cible : les réglages du pouvoir et
un **aperçu** de ce que verra la cible (comme l'éditeur de nœuds de
l'Architecte, qui ne change pas).

| Pouvoir | Réglages |
|---|---|
| ⚡ Calcul forcé | 1 à 5 calculs par page, difficulté (niveau 20 à 80), une erreur remet ou non le compteur à zéro — aperçu avec un vrai calcul |
| 👻 Hantise | créature (fantôme, crâne, citrouille, chauve-souris, ovni), part des pages hantées (jusqu'à 35 % + 10 % par niveau, 75 % au plus), captures pour sortir, message de la fausse 404 |
| 🎁 Fête forcée | thème (non-anniversaire, carnaval, nouvel an, disco), bannière, densité de confettis, curseur |
| 🌊 Appel des abysses | vitesse de la chute, profondeur (obscurité), molette inversée ou non, créatures des profondeurs |
| 💰 Huissier | ton (officiel, menaçant, ridicule), liste des biens saisis, tampon (SAISI, CONFISQUÉ, VENDU, SOUS SCELLÉS), cadence des tampons |
| 💋 Flatterie | compliment (« … et Loup a les plus beaux mollets »), couleur (rouge, or, rose, vert), fréquence (chaque message, 1 sur 2, 1 sur 3) — aperçu de la messagerie |
| 🧭 Monde à l'envers | miroir, tête en bas, penché, toupie ; retournement toutes les 20 s à 3 min — bouton « voir le retournement » |
| 🪶 Réécriture | lexique (potager, pirate, bébé, médiéval) et jusqu'à 6 mots à soi — aperçu avant / après |
| 🎵 Rationnement | un clic toutes les 3 à 15 s, clavier compris ou non — aperçu cliquable |
| 📜 Avenant | jusqu'à 3 clauses à soi en tête du contrat, la case s'enfuit 0 à 5 fois, signature à recopier (« Lu et approuvé, X a toujours raison ») |

Les réglages sont vérifiés et bornés par la base (`_troll_params`) : rien
d'autre ne passe.

## 🐉 Défi du Dragon : l'arène 3D
- Le lanceur **devient le dragon** dans le monde 3D (démon, dragon noir ou
  drake) : vol libre, souffle de feu, morsure, rugissement qui étourdit.
- Sa cible est **convoquée** : grand écran « ROOOAAAR », entrer dans l'arène
  ou fuir (entrée automatique au bout de 15 s). Les joueurs ont des éclairs de
  lumière, une frappe au corps à corps et un bouclier contre le feu.
- Déroulé : attente (75 s, départ dès que tout le monde est là), cinématique
  d'entrée, combat de 2 min 30, fin.
- **Options payantes** (zénis, débités au lancement) :
  - **+1 000 000 par joueur en plus**, 5 au plus (6 joueurs en tout) ;
  - **tribune : 5 000 000** — tout le S.I.D. est convoqué pour regarder
    (bandeau, ouverture automatique au bout de 15 s, « Pas cette fois »),
    avec une caméra de retransmission : plans larges, poursuite, face au
    dragon, épaule d'un joueur, contre-plongée, vue du ciel, coupes sur le
    souffle et les chutes ;
  - **cinématique de fin : 5 000 000** — si le dragon gagne, il
    **carbonise** ou **dévore** le dernier joueur.
- Le récapitulatif du prix est affiché avec le solde ; **remboursé** si la
  bataille est annulée pendant l'attente (personne n'est venu, ou le dragon
  annule dans les 4 minutes).
- Fin : notification aux joueurs et au dragon, résultat dans « Tes farces
  récentes ». Si le dragon quitte en plein combat, les joueurs gagnent ; s'il
  disparaît (onglet fermé), les joueurs le constatent au bout de 15 s.
- Revenir sur le site pendant sa bataille : une pastille « Ton arène
  t'attend » (y retourner ou annuler).
- L'ancien duel en 2D est retiré.

## Réglages admin (table `app_config`, facultatifs)
`arena_max_extra` (5), `arena_price_player` (1000000),
`arena_price_tribune` (5000000), `arena_price_finale` (5000000). Le panneau
affiche les valeurs en vigueur.

## Temps réel
Les échanges de l'arène passent par Supabase Realtime, regroupés (au plus
3 paquets par seconde et par joueur, en étoile autour du dragon) : chaque
message envoyé et reçu compte dans le quota du projet (100 par seconde en
offre gratuite). Une bataille à 6 joueurs avec une dizaine de spectateurs
reste en dessous.

## Fichiers
- `src/lib/trollOptions.ts` (catalogues, valeurs par défaut, lecture des
  réglages, réécriture), `src/lib/arenaRelay.ts` (relais temps réel).
- `src/components/titles/TrollOptionsPanel.tsx` (panneaux et aperçus),
  `TrollPanel.tsx` (réglages, prix, résultat des batailles).
- `src/components/trolls/DragonArena.tsx` (convocation, tribune, pastille,
  jeu en plein écran) ; `DragonDuel.tsx` supprimé.
- Effets mis à jour pour lire les réglages : `GateEffects.tsx`,
  `AmbientEffects.tsx`, messagerie (flatterie).
