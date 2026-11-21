# Lot 89 — Les alliés agissent pendant les parties

Touche quatre dépôts : le Dossier Central, Potions (Intelligence),
Techniques et 3D-game-world (Donjons). Migration : `0109_devlog_allies_simulations.sql`
(entrée du devlog seulement), après 0108. Peut être relancée.

## Principe
- Chaque allié de simulation a une **spécialité**, tirée de son nom ; un
  allié Divin en a deux. Sa **force** (1 à 10) vient du rang, de l'éveil et
  de ses facteurs.
- Au lancement d'une partie (et quand on rejoint un raid), la page de la
  simulation lit l'allié équipé et passe ses pouvoirs au jeu dans
  l'adresse (`sid_allie`, détail dans `API_SIMULATIONS.md`, section 9).
- Les pouvoirs agissent à chaque niveau, 101 compris. La protection
  quotidienne (annuler un échec, éviter une blessure) reste en plus.

## Sages (Intelligence : Potions, Énigmes, Problème)
- **Clairvoyant** : indices à la demande. Potions : une propriété cachée,
  sinon une page arrachée du carnet, sinon le dernier mélange dans le
  brouillard. Énigmes et Problème : longueur et début de la réponse.
- **Gardien du sablier** : minutes en plus sur la tentative (75 min du 101
  comprises) et secondes en plus par énigme.
- **Mentor** : erreurs pardonnées. Énigme remplacée après une mauvaise
  réponse ou un temps dépassé ; chaudron refroidi avant l'explosion, ou
  5 essais rendus ; une tentative de plus au problème.
- **Érudit** : pages du carnet rendues, lexique fourni, brouillard levé
  (force 6) ; forme de chaque réponse aux énigmes ; « plus grand / plus
  petit » au problème, avec le nombre de chiffres (force 4).

## Artisans (Techniques)
- **Horloger** : tous les délais et tolérances des ateliers allongés,
  minutes en plus sur le circuit.
- **Gabarit** : cibles, couloir et écarts de nuance agrandis, répétitions
  en moins dans chaque atelier.
- **Contremaître** : un atelier raté est validé s'il atteint un seuil
  (80 − 3 × force). Au 101, il empêche la fin de la tentative.
- **Second d'atelier** : fait un à trois ateliers à la place du joueur
  (90 / 100), au choix, depuis la consigne.

## Compagnons (Donjons)
- Un cristal à la couleur de la spécialité suit le héros.
- **Lame** : tire sur l'ennemi le plus proche, dégâts du héros augmentés.
- **Bouclier** : coups absorbés au début de chaque île, une garde rendue à
  intervalle régulier, dégâts reçus réduits.
- **Soigneur** : soin continu, relève plus rapide après une mort, relève
  sur place (force 4 et plus) qui évite aussi la blessure.
- **Éclaireur** : vitesse, butin plus fréquent, effets du butin plus longs,
  colonne de lumière sur la relique ou l'artefact le plus proche.

## Dans le S.I.D.
- Bloc de l'allié (page de la simulation) : spécialité, force et effets.
- Dex : chaque allié de simulation affiche sa spécialité et ses effets.
