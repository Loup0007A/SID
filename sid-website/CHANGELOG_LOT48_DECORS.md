# Lot 48 : des décors de fêtes plus beaux

Pas de migration.

## Dossier Central : un vrai paysage pour chaque fête
Comme la Grande Chasse, chaque fête a maintenant un paysage complet en
plusieurs plans derrière le contenu (ciel, lointains, premier plan, lumières),
pensé pour se voir sur les côtés et à travers les cartes :

- **Halloween** : manoir hanté sur sa colline (fenêtres qui vacillent),
  cimetière et grille, arbre mort, citrouilles allumées, feux follets.
- **Noël** : montagnes enneigées, forêt de sapins, village et son église
  éclairés (fumée des cheminées), grand sapin décoré avec ses cadeaux,
  bonhomme de neige, réverbères.
- **Saint-Valentin** : toits au crépuscule (fenêtres allumées), pont des
  amoureux et ses cadenas, reflet de lune sur la rivière, banc des amoureux,
  lanternes en cœur qui montent dans le ciel.
- **Poisson d'avril** : fonds marins, rayons de lumière, récifs, coraux
  branchus et éventails, algues qui ondulent, étoiles de mer, banc de poissons.
- **Pâques** : soleil qui rayonne, nuages, collines et clocher, arbres en
  fleurs, prairie de tulipes et de pâquerettes, papillons.
- **1er mai** : sous-bois du matin, rayons entre les arbres, fougères.
- **Fête de la musique** : ville la nuit, guirlande de guinguette, scène avec
  projecteurs et musiciens, platines, foule et écrans de téléphones.
- **14 juillet** : vrais bouquets de feux d'artifice (fusée, gerbe, retombée),
  Paris, la tour et son phare, la Seine et ses reflets, pont, spectateurs.
- **11 novembre** : aube sobre, peupliers, brume, monument et drapeau.

Code dans `src/components/seasonal/scenes.tsx` (+ `scenes.css`), chargé
seulement quand la fête est affichée. Sur téléphone, le paysage est plus bas
et moins de choses bougent ; rien ne bouge si l'appareil demande moins
d'animations.

## Wiki
Chaque fête pose aussi un horizon sur la mer, derrière le contenu (manoir,
village enneigé, toits, phare et bateau, clocher, forêt, ville en fête, Paris
et ses feux d'artifice, monument).
