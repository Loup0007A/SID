# Lot 50 : refonte visuelle du Wiki et de la Cartographie

Pas de migration. Rien ne change dans le fonctionnement : seulement l'apparence.

## Wiki → « le Codex », le cabinet du chasseur la nuit
- **Ambiance** : fond vert sapin, surfaces pleines de feutre, texte couleur
  os, filets et boutons laiton. Fini le verre dépoli et les vagues, qui
  passaient par-dessus le contenu.
- **Typographie** : Young Serif pour les titres et les numéros (chiffres
  elzéviriens), Schibsted Grotesk pour le texte.
- **Une couleur par catégorie**, partout (onglets, numéros, cases, planches) :
  Lieux vert-de-gris, Armes acier, Mobs sanguine, Objets ambre, Skills arcane.
- **Emblèmes gravés** (`src/components/Emblem.tsx`) à la place des anciennes
  icônes bleues (les images de `public/icons` restent, mais ne sont plus
  affichées).
- **Accueil = « La collection »** : un tiroir par catégorie, une case par
  fiche. Une case découverte montre l'image de la fiche, une case vide est un
  « ? » en pointillés. Puis le registre des découvertes (numéro, image, nom,
  découvreur), les meilleurs découvreurs et le vestiaire.
- **Catégories** : en-tête avec le compte des découvertes, filtres en
  pastilles, fiches en « planches » (numéro en tête, image sous passe-partout,
  rareté en losanges). Les fiches non découvertes sont des planches en
  pointillés.
- **Fiche** : colonne « fiche signalétique » collée à gauche (catégorie, grand
  numéro, rareté, découvreur, tags, infos, actions) et colonne de lecture à
  droite (titre, résumé, modèle 3D ou image, texte en 68 caractères par
  ligne). Sur téléphone : numéro et titre d'abord, puis l'image, la fiche
  signalétique et le texte. Navigation précédente/suivante par numéro.
- En-tête, menus, barre du bas du téléphone, recherche, profils, favoris,
  tags, aide, connexion et administration suivent le même thème.
- Les décors des fêtes posent toujours leur ciel (Halloween, Noël, Grande
  Chasse…).

## Cartographie → « l'Atlas », la table du cartographe
- **La carte est une feuille d'atlas** : mer en petites ondes à la plume,
  quadrillage à l'encre, terres en vélin lavées à l'aquarelle de la couleur de
  chaque région, bordées d'encre, ombre côtière bleue, hachures fines ; noms
  des régions en petites capitales, noms des lieux en Alegreya avec un halo
  de vélin ; lieux en médaillons crème à double filet ; routes en pointillés
  d'encre sanguine (les routes d'une autre couleur gardent leur couleur) ;
  filet de bordure en damier et marge de la feuille ; rose des vents gravée.
- **Sélection, mesure, tracés et itinéraire** : encre de Prusse, lisible sur
  le vélin. Présences, quêtes et drapeaux de territoire redessinés pour le
  papier.
- **Autour** : une table d'encre bleue (lampe et grain de cuir, rien ne
  bouge), barre du haut avec sceau laiton, fenêtres en « chemises de cuir » à
  double filet laiton, actions principales au sceau de cire, petites
  capitales au lieu des capitales.
- **Typographie** : Alegreya SC (titres, étiquettes), Alegreya (noms de
  lieux, textes de fiche), Alegreya Sans (interface).
- **Plan de ville** sur vélin quadrillé, quartiers lavés, bâtiments en
  médaillons ; page d'un lieu avec médaillon et titre de fiche.
