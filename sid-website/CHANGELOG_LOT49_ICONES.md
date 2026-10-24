# Lot 49 : des icônes dessinées à la place des émojis, colombes et fleurs redessinées

Pas de migration.

## Une bibliothèque d'icônes du S.I.D.
Plus de 150 icônes dessinées à la main, toutes dans le même style
(« autocollant » : couleurs franches, contour sombre, petit reflet), dans
`src/components/icons/sidIcons.tsx`. On s'en sert partout avec
`<SidIcon name="…" />` (taille par défaut : celle du texte).

Elles remplacent les émojis de l'interface du Dossier Central :

- tuiles de l'accueil et menu (chaque page a son icône : `icon` dans
  `src/lib/navigation.ts`), sites de simulation, événements, titres (badge,
  carte, popup « Nouveau titre », ruban d'événement) ;
- « En ligne maintenant », notifications (l'émoji en tête du titre devient une
  icône), bannières (annonce, maintenance, chantier, CGU, bac à sable),
  boutons et messages des pages (banque, boutique, entreprise, quêtes, carte,
  profil, messagerie, simulations, administration, statistiques…) ;
- farces et leurs réglages (créatures de la hantise, fêtes, réécriture,
  dragon et ses fins), arène du dragon, Grande Chasse (podium, piste),
  anniversaires et chasses des fêtes (titres scellés, re-scellés).

Les textes déjà écrits (base de données, anciennes chaînes) passent par
`<GlyphText>` / `<Glyph>` : un émoji connu devient son icône, un émoji inconnu
reste tel quel. **Ce que les membres écrivent eux-mêmes (messages, pseudos,
icônes des lieux de la carte…) n'est pas touché.** Le curseur de fête choisi
par le farceur reste un émoji.

Les anciennes images `public/icons/<page>.png` ne sont plus utilisées (plus
d'image cassée quand le fichier manque).

## Colombes, fleurs et particules redessinées
- **Colombe** de l'armistice (et de la Trêve) : vraie colombe de profil,
  deux ailes aux rémiges découpées qui battent, queue en éventail, œil
  brillant, rameau d'olivier avec feuilles et olives.
- **Pigeon** du 1er mai : gris-bleu, cou irisé vert et violet, barres sur
  l'aile, œil orange, brin de muguet dans le bec.
- **Bleuet** : fleurons dentelés sur deux rangs, cœur sombre aux étamines
  violettes ; au pied du 11 novembre, des bleuets sur leur tige avec feuilles
  et boutons.
- **Muguet** : feuilles larges à nervure claire, hampe arquée, six clochettes
  festonnées de taille décroissante, bouton au bout.
- **Pâques** : tulipes à trois pétales (quatre couleurs) avec feuille, et
  pâquerettes à quatorze pétales bordés de rose.
- Les **caractères** ♥ ♪ ♫ ✿ ❄ des particules sont remplacés par de petits
  dessins (`src/components/seasonal/minis.tsx`) : cœurs avec reflet, croches
  et doubles croches, fleurs de cerisier, pétales, bulles, clochettes,
  flocons, étincelles, bleuets. Ils prennent la couleur du texte, donc les
  couleurs des décors ne changent pas. Concernés : décors des fêtes,
  guirlandes, survols (Cupidon, notes), auras des titres (Flatteur, Cupidon,
  Lutin, Maestro, Veilleur…), farces Coup de foudre et Fanfare et leurs
  aperçus, traînée du curseur.

## Wiki et Cartographie
- Mêmes icônes (copie de `sidIcons.tsx` et `SidIcon.tsx`) : menu et
  catégories du Wiki, boutons des fiches (Favori, Partager, Imprimer,
  Signaler, 3D…), titres de sections, podium des découvreurs, porte-armure ;
  sur la Cartographie, lanceur d'applications, titres des fenêtres, consignes
  des modes, panneaux (présences, montures, cristaux, itinéraire…), marqueurs
  de présence, de quête et de territoire, sceau de l'événement.
- Décors des fêtes : mêmes colombe, pigeon, bleuets, muguet, cœurs et notes
  que sur le Dossier Central (`src/components/eventArt.tsx`).
