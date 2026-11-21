# Lot 95 — Lisibilité, appareil neuf, téléphone, outils de contrôle

Migrations (Dossier Central) : `0118_affichage_animations_auto.sql` (les
animations acceptent « selon l'appareil »), puis `0119_devlog_lisibilite.sql`.
Sans la 0118, le choix « Selon l'appareil » des animations reste sur
l'appareil (le compte ignore la valeur), rien ne casse.

## Mode sombre et mode épuré, page par page
- Audit des trois sites, chaque page en clair, sombre, épuré et sombre + épuré
  (captures et mesure de chaque texte).
- Dossier Central : champs de saisie (`inputClass`, `bg-creme`) sombres en
  mode sombre ; feuilles de quête et faire-part baissés (`brightness`) ;
  bouton « Voir » du mot de passe à la couleur du champ (`.champ-bouton`) ;
  touches « Ctrl K » en encre dans le bouton de recherche.
- Wiki : champs, boutons secondaires et étiquettes de planche sombres ;
  statuts des propositions lisibles sur fiche crème comme sur plaque sombre
  (`--st-ok`).
- Cartographie : coupe des bâtiments sombre, texte « Aucun étage » visible
  (il était crème sur crème) ; plan de ville baissé en mode sombre.

## Contrastes (WCAG AA, 4,5:1)
- `scripts/fonds.mjs` (trois sites) : le fond de chaque thème est assombri,
  teinte gardée, juste assez pour que le texte crème atteigne 4,6:1
  (`lisible()`) ; l'accent « sur carte » atteint 6:1. Le bleu du Dossier
  Central ne change pas ; le vert du Wiki, la terre cuite de la Carto et les
  fonds d'évents trop clairs (Halloween, Pâques, Saint-Valentin…) foncent.
- Textes estompés : `text-paper/60` et semblables gardent au moins 80 %
  d'opacité (Tailwind `textColor.paper`), et les `color: rgb(var(--c-paper) / .6)`
  des feuilles de style sont relevés de la même façon.
- Jetons relevés : `--c-blue`, `--c-red`, `--c-green-300`, `--c-yellow-300`
  sur le fond ; `--c-yellow-*`, `--c-paper-dark` sur carte ; textes du Wiki
  sur le vert (`--t-o6`…`--t-o8`, `--t-brass3`, `--cat-mobs`).
- Bourse : hausse et baisse en jetons (`text-hausse`, `text-baisse`) lisibles
  sur le fond, sur carte et en sombre ; boutons Acheter / Vendre en encre.
- Devlog : pastilles claires fixes à texte encre. Boutique : pastilles « rare »
  et « boîte » en encre. Arbre technologique : cartes verrouillées lisibles.
- Mesure (toutes les pages, 4 modes) : textes sous le seuil 1 915 → 120
  (Dossier Central), 296 → 10 (Wiki), 26 → 0 (Carto). Les restes : pastilles
  rouges à 4,4:1, couleurs choisies par les membres ou les admins (titres,
  styles de fiche, marquées `data-contraste-libre`), bandeaux de type des
  quêtes. Surfaces claires en mode sombre : 139 → 33 et 107 → 44 ; les
  restes sont voulus (choix surlignés en jaune, étiquettes de planche).

## Appareil neuf : plus de passage du clair au sombre
- Middleware des trois sites (`src/lib/comfortCookie.ts`, identique) : à la
  première page d'un membre connecté sans cookie `sid-confort`, lit ses
  réglages sur le compte (700 ms au plus) et les pose dans ce cookie, que le
  script du `<head>` lit quand la mémoire locale est vide. Une fois par
  appareil et par site.

## Animations selon l'appareil
- Nouveau choix « Selon l'appareil » (par défaut) : animations calmes si le
  système demande de réduire les animations. ComfortSync suit le changement.

## Fichiers communs
- `npm run communs` (script identique dans les trois dépôts) compare les
  fichiers partagés avec ceux des deux autres sites (GitHub, ou copies
  locales avec `SID_DIRS`), et `-- --copier` les recopie.

## Tests d'affichage
- `npm run test:affichage` (Playwright, identique sur les trois sites, pages
  dans `tests/pages.ts`) : classes posées avant React (mémoire locale, cookie,
  système), aucun texte sous 3:1 (entre 3 et 4,5 : listé), aucune grande
  surface claire en sombre, pas de défilement horizontal à 360 px. Pages de
  membre avec `SID_TEST_COOKIE`.

## Migrations rejouées
- `scripts/rejouer-migrations.sh` : toutes les migrations des trois sites sur
  une base jetable, puis une seconde fois. Les 154 passent sur base vide ; les
  119 marquées « Peut être relancée » se relancent ; 35 anciennes (0001 à 0058
  du Dossier Central, 0200-0201 du Wiki, 0100 à 0105 de la Carto) sont à
  passer une seule fois. L'ordre d'une installation neuve est écrit dans
  `supabase/ORDRE_MIGRATIONS.txt` (la 0026 du Dossier Central a besoin des
  tables de la Cartographie).

## Cartographie, performances
- Mesure sur téléphone moyen émulé (processeur ÷4, 4G) : carte du monde
  affichée en ~3,6 s, 0 ms bloquée pendant le glissé (déjà en transformation
  CSS). Fenêtre des créatures, carte d'incursion et export d'image chargés à
  la demande (−4 ko au démarrage). Le reste du temps : téléchargement du code
  et des polices, puis les données.

## Téléphone (360 px)
- Sondages : un mot très long passe à la ligne au lieu de pousser la carte
  hors de l'écran ; `overflow-wrap: break-word` sur les trois sites.
- Wiki : champs de la fiche technique qui rétrécissent.
- Petits liens et boutons agrandis à 24 px de haut (pieds de page, « Mot de
  passe oublié ? », « Supprimer », filtres de quartier, « Passer la visite »…).
