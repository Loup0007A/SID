# Lot 44 : les fêtes de l'année (+ traînée du curseur)

**Migration : `supabase/migrations/0067_evenements.sql`**, à lancer après `0066`
(peut être relancée).

> Ordre : `0066` puis `0067`. Si une migration plus ancienne est relancée un
> jour (`0061` surtout), relancer ensuite toutes celles qui la suivent, dans
> l'ordre. `0064` et `0065` contiennent déjà les dernières versions des
> fonctions d'affichage et des titres d'événement : les relancer ne retire
> aucune fête.

## Sept nouveaux événements
Même principe que Halloween et Noël : affichés automatiquement (heure de Paris),
réglables dans **Modération → Affichage événementiel** (auto / forcé / coupé),
même réglage pour le Dossier Central, la Cartographie et le Wiki.

| Événement | Période automatique |
|---|---|
| 💘 Saint-Valentin | du 10 au 14 février |
| 🐟 Poisson d'avril | le 1er avril |
| 🥚 Pâques | du Vendredi saint au lundi de Pâques (date calculée chaque année) |
| 🌿 1er mai | le 1er mai |
| 🎵 Fête de la musique | le 21 juin |
| 🎆 14 juillet | les 13 et 14 juillet |
| 🕊️ 11 novembre | le 11 novembre (affichage sobre) |

Sur le **Dossier Central** : fond de saison, particules, guirlande sous la barre
du haut, un survol une fois par visite (Cupidon, poisson, cloches, pigeon,
notes, Patrouille de France, colombe), une phrase d'accueil et une surprise au
pied de page.
Sur la **Cartographie** : guirlande, survol, sceau et bords teintés.
Sur le **Wiki** : guirlande, survol, objets sur les vagues, mer teintée (et feux
d'artifice le 14 juillet).

## Un titre par événement
Chaque événement a son titre, qui ne s'obtient que pendant l'événement (l'énigme
est dans la vitrine des titres). Chacun donne un pouvoir de farce, avec ses
réglages et son aperçu :

- **Coup de foudre** (Saint-Valentin) : cœurs partout, ton nom dans un grand cœur.
- **Poisson d'avril** : poissons collés à l'écran, fausses notifications.
- **Cloches de Pâques** : des œufs en chocolat s'entassent en bas de l'écran.
- **Grève générale** (1er mai) : les boutons se mettent en grève, manifestation.
- **Fanfare** (fête de la musique) : notes, et le site danse en rythme.
- **Feu d'artifice** (14 juillet) : feux d'artifice, Patrouille de France.
- **Trêve** (11 novembre) : l'inverse d'une farce. Des bleuets, une colombe, ton
  message, et pendant ce temps personne ne peut viser la personne.

Les titres ont aussi leur aura (cœurs, poissons, œufs, muguet, notes,
étincelles, bleuets).

## Traînée du curseur (ordinateur)
Avec une souris uniquement : une petite traînée suit le curseur et un éclat
apparaît au clic, aux couleurs de la fête du moment. Un seul calque, dessiné
seulement quand il y a quelque chose à montrer (à l'arrêt, plus rien ne
tourne). Réglable dans **Réglages → Curseur** (traînée + clic, clic seulement,
désactivé), propre à chaque navigateur ; coupé si le système demande moins
d'animations.
