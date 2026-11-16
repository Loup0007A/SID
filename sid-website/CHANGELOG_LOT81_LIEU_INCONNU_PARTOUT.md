# Lot 81 — Lieu inconnu : disparaître de la carte, buguer partout

## À lancer dans Supabase

Cartographie : `supabase/migrations/0117_lieu_inconnu_partout.sql`, après 0116.
Rejouable.

## Sur la Cartographie

- Un membre brouillé depuis L'Envers n'a plus aucun marqueur sur la carte des
  autres, ni à un lieu, ni en trajet. Le carré qui sautait d'un endroit à
  l'autre est retiré.
- Il reste dans « Présences », comme un bug : pseudo et avatar brouillés,
  « Lieu inconnu », « ?? » à la place de l'heure.
- Lui voit encore son marqueur, en fantôme (transparent, qui clignote) dans
  le cadre qui grésille.

## Sur les trois sites

Tant qu'il est brouillé, tout ce qui le concerne bugue, pour tout le monde :

- **Pseudo** : reflets rouge et cyan, et par à-coups des glyphes façon Matrix
  à la place des lettres. Partout où il s'affiche dans un texte : messagerie
  (auteur et mentions), profils, trombinoscope, classements, listes, Wiki
  (profils, découvertes, commentaires)…
- **Avatar** : reflets rouge et cyan, tranches qui se décalent par moments.
- **Position** : « Lieu inconnu » dans « Qui est où » (page Carte du Dossier
  Central), et une ligne « Position : Lieu inconnu » sur sa fiche de profil
  (Dossier Central et Wiki).
- Le vrai texte reste en place pour les lecteurs d'écran.
- **Moins d'animations** (réglage du système) : les reflets restent, sans
  brouillage ni tranches.

Les comptes invisibles et les membres qui ont masqué leur position ne sont
jamais concernés.

### Délais

- Rétablir sa position : le brouillage s'arrête dans la minute sur les pages
  ouvertes, tout de suite sur la Cartographie de celui qui l'a fait.
- Activer le brouillage : visible sur les pages ouvertes ou rechargées
  ensuite (au plus 20 secondes de cache côté serveur).

## Technique

- `glitched_members()` (0117) : pseudo et avatar des membres brouillés, sans
  identifiant ni lieu ; ouvert aussi sans session pour le rendu serveur.
- `src/brand/glitch.ts` : la couche JSX du Lot 77 enveloppe ces pseudos dans
  `GlitchName` et ajoute `gl-avatar` aux `<img>` de leur avatar. Seulement
  dans les balises de texte (pas `option`, `textarea`, `title`, ni le SVG).
  Ajouter `data-noglitch` sur une balise l'exclut.
- `src/lib/glitch.ts`, `src/components/glitch/` : liste, composants
  `GlitchText` / `GlitchName` / `GlitchWhere`, relecture (`GlitchSync`). Ces
  fichiers, `src/brand/` et le bloc `.gl` de `globals.css` sont identiques
  dans les trois sites.
