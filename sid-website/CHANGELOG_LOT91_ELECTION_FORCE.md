# Lot 91 — Élection prise par la force, refonte du Wiki

Migrations : `0111_election_force.sql`, puis `0112_devlog_force_wiki.sql`
(entrées du devlog), après 0110.

## Élection du Dictateur : par la force
- Nouveau choix dans Modération → Affichage événementiel → Élection :
  « Proclamé » (comme avant) ou « Par la force ». Secret jusqu'à la
  proclamation, comme le nom de l'élu (`election_status` ne renvoie
  `mode` qu'une fois la proclamation passée).
- Même titre « Dictateur », même attribution (`_election_award` intact).
- Par la force, à la proclamation :
  - fond rouge sang (thème `election_force` de `scripts/fonds.mjs`,
    gouttes qui tombent, panneaux d'alerte en motif) ;
  - alarme rouge qui pulse sur les bords de l'écran ;
  - bande d'alerte jaune et noire qui défile à la place des fanions ;
  - cérémonie de coup d'État (« Alerte. Alerte. », stroboscope rouge,
    bouton « Se soumettre ») à la place des confettis ;
  - tableau de l'élection en version alerte ;
  - la notification envoyée à tous devient
    « 🚨 ALERTE — Coup d'État au S.I.D. » (une fois par proclamation).
- Journal d'audit : « (par la force) » après l'élection.
- `election_set` prend un 5e paramètre `p_mode` (`election` par défaut) ;
  l'ancienne signature à 4 paramètres est supprimée.

## Cartographie et Wiki
- `ElectionLayer.tsx` (identique dans les deux) : bande d'alerte, alarme et
  étiquette « Coup d'État » en mode force ; fond rouge sang sur le Wiki.

## Wiki : refonte visuelle
- Même famille que le Dossier Central (contours encre de 3 px, ombres
  pleines, boutons qui s'enfoncent), autre thème : un herbier.
  - Fond vert d'eau semé de fougères, plumes, ammonites, scarabées et
    champignons ; feuilles qui tombent en se balançant.
  - Fiches, blocs, champs et onglets en parchemin ; barre du haut encre
    avec un liseré or ; menus déroulants encre.
  - Couleurs des catégories plus vives sur le fond, plus foncées sur le
    parchemin.
- Chaque évent garde ses couleurs, son motif et ses particules sur le Wiki.
- Générateur : `scripts/fonds.mjs` du Wiki (`node scripts/fonds.mjs`).
