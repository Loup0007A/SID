# Lot 92 — Cartographie : nouvelle tenue, créatures, météo des lieux, intérieurs

Migrations : Cartographie `0120_creatures_meteo_lieux_proprietes.sql`
(après 0119), puis Dossier Central `0113_devlog_cartographie.sql`
(entrées du devlog).

## Apparence (Cartographie)
- Troisième style de la famille, après le Dossier Central (bleu roi) et le
  Wiki (herbier) : un atlas en terre cuite. Lignes de niveau, roses des
  vents, vagues et sommets en transparence ; poussière dorée qui monte.
- Instruments en cuir d'encre liserés d'or ; carte, plans, fiches et
  connexion sur vélin à gros contour et ombre pleine ; barre du haut en
  cartouche de vélin ; boutons or qui s'enfoncent.
- Chaque évent a son fond (mêmes thèmes que le Wiki), panneaux à l'encre de
  l'évent ; élection prise par la force en rouge sang.

## Créatures
- Gestion de la carte : créatures qui rôdent (fiches Mobs du Wiki), fréquence,
  lieux et biomes permis ou interdits, lieux interdits à toutes.
- Apparition immédiate (départ, durée de 1 à 24 h) et renvoi de la créature
  en cours.
- Créature inconnue : rôde sans nom ni image ; le premier signalement la
  révèle dans le Wiki (le signaleur en devient le découvreur).

## Météo des lieux
- Temps fixe, temps interdits ou probabilités propres pour un lieu.
- Temps du lieu visible sur sa fiche ; liste des lieux au temps particulier
  dans le panneau Météo.
- Les trajets qui partent d'un tel lieu ou y arrivent prennent son temps.

## Propriétaires
- Un lieu-bâtiment de la carte du monde peut être donné à un membre ; tous
  les bâtiments des villes aussi (avant : les maisons seulement).
- Le propriétaire aménage les étages et modifie description et image.
- Notification « Nouvelle propriété » (type `propriete`, icône maison sur le
  Dossier Central).

## Intérieurs refaits
- Coupe du bâtiment (toit, étages, sol, sous-sols) pour passer d'un étage à
  l'autre.
- Plan sur vélin : murs d'encre, sols et mobilier selon le type de pièce
  (16 types : chambre, salon, cuisine, salle, couloir, escalier, autel,
  cave, boutique, atelier, bibliothèque, bain, réserve, trésor, cour,
  autre), escaliers qui mènent à l'étage relié.
- Édition : dessiner, déplacer, agrandir, renommer, changer le type,
  supprimer ; renommer ou supprimer un étage.
- Maquette 3D dessinée étage par étage.
- Plan de ville : remparts, quartiers hachurés et nommés, toits colorés selon
  le type, sceau du propriétaire.
