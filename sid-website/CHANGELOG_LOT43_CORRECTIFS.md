# Lot 43 : correctifs (dragon, 404, retour à la position, abysses, nuée)

**Migration : `supabase/migrations/0066_farces_remise_a_niveau.sql`** (peut être relancée).

## Défi du Dragon : ne s'ouvrait pas pour le lanceur, solde à 0
Cause : `0061` avait été (re)lancée après `0062`, ce qui remettait d'anciennes
versions de sept fonctions (farces en cours, statut, lancement…). Le lanceur ne
voyait pas son arène, la cible n'était pas convoquée comme joueur, et le solde
des options restait à 0. `0066` remet les bonnes versions.
**Règle : après avoir (re)lancé 0061, relancer 0066.**
Vérifié : le lanceur entre dans l'arène en dragon, la cible est convoquée, les
options (tribune…) sont payées sur le solde.

## Page 404 (et autres secrets) mal affichées
Le code scellé est illisible pour Tailwind, qui ne générait donc pas certaines
classes (fond du mini-jeu 404 transparent, compteur des abysses couché…).
Le sceau écrit maintenant la liste de ces classes dans
`src/components/sceaux/classes.ts`.

## Retour à la position
La position n'est plus remise qu'après un retour arrière (ou un rechargement),
jamais en ouvrant une page par un lien, et jamais pendant qu'on fait défiler :
si la page met plus d'environ une seconde à être prête, ou dès qu'on touche,
clique ou fait défiler, on abandonne.

## Abysses
- Plus de vide pour qui a déjà le titre, ni dans les 24 h qui suivent un essai.
- Il faut insister trois fois vers le bas, tout en bas de la page (un petit
  signe apparaît à la deuxième).
- iPhone : le bas de page est mieux détecté (barre d'outils de Safari) et un
  geste du doigt compte pour une insistance.
- Farce « Appel des abysses » sur téléphone : la page coule en continu (plus
  d'à-coups), le doigt inversé garde son élan, et la descente s'arrête pendant
  qu'on touche l'écran.

## Nuée (farce d'Halloween)
Les chauves-souris apparaissent vraiment au hasard : une à la fois ou en petit
groupe, de n'importe quel côté, à n'importe quelle hauteur, avec leur propre
vitesse et leur propre vol.
