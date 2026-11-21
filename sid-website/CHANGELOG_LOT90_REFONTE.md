# Lot 90 — Refonte visuelle du Dossier Central

Dossier Central seulement (la Cartographie et le Wiki ne changent pas).
Migration : `0110_devlog_refonte.sql` (entrée du devlog), après 0109.

## Fond
- Bleu roi (#2F5BD8), deux halos, rosaces d'éclats du sceau en
  transparence, petits éclats qui tombent (`FondParticules`, coupés si
  l'appareil demande moins d'animations).
- Motifs et couleurs générés par `scripts/fonds.mjs` (`public/fonds/*.svg`,
  `src/app/fonds.css`) ; voir SETUP.md, section 6.1.

## Cartes et éléments
- Cartes crème, contour marine de 3 px, ombre pleine décalée ; fiches de
  quête en papier kraft avec le même contour.
- Barre du haut aux couleurs du fond, floutée, posée sur un trait ; boutons
  de la barre en pastilles crème.
- Boutons pleins : contour marine et ombre pleine, ils s'enfoncent au clic.
- Champs crème à contour marine ; onglets, recherche et tri de la
  boutique et des quêtes dans le même style.
- Panneaux qui restent sombres (tableau des missions, messagerie, fiche
  d'objet, recherche Ctrl K, cartes de recrutement) : marine plein, contour.
- Accueil public : grand titre « S.I.D. » en autocollant, logo dans son
  sceau, présentation dans une carte.
- Police : Archivo (titres plus gras et serrés, texte normal) ;
  JetBrains Mono garde les chiffres et les étiquettes.

## Couleurs à deux niveaux
- Les noms de couleurs du site (paper, ink, blue, red, white…) lisent des
  variables qui changent selon l'endroit : sur le fond, texte crème et
  accents clairs ; sur une carte, texte marine et accents foncés. Une même
  classe reste lisible dans les deux cas.
- Couleurs ajoutées : `gold`, `ok`, `ko` (or, gain, perte), `encre`,
  `creme`, `fond`, `accent`, `accent-2`.

## Évents
- Chaque évent a son fond, son motif et ses particules : Noël (rouge,
  flocons), Halloween (orange, chauves-souris), Saint-Valentin (rose,
  cœurs qui montent), 1er avril (turquoise, poissons et bulles), Pâques
  (vert, œufs et fleurs), 1er mai (vert, muguet), Fête de la musique
  (violet, notes qui montent), 14 juillet (bleu nuit, feux d'artifice),
  11 novembre (kaki, bleuets et coquelicots), Grande Chasse (rouge braise,
  griffures, braises qui montent), élection (pourpre, étoiles, cocardes,
  confettis).
- Le thème est choisi au rendu serveur (`getFondTheme`, gardé 5 minutes)
  puis suivi dans le navigateur quand l'affichage change.
- Les anciens décors de fond (collines, chalet, cimetière, vallée…) sont
  remplacés par le nouveau fond ; guirlandes, passages (traîneau,
  chauves-souris, Cupidon, Brasombre…), phrases d'accueil, tableaux et
  surprises du pied de page restent.
- Descriptions de Modération → Événements mises à jour.
