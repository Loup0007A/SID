# Lot 88 — Exploration, météo, propositions, Wiki refait, devlog par site

Touche les trois dépôts. Migrations, dans cet ordre :

1. Dossier Central : `0107_devlog_sites.sql` (après 0106).
2. Wiki : `0211_wiki_propositions.sql` (après 0210).
3. Cartographie : `0118_exploration.sql`, puis `0119_meteo_incursions.sql`
   (après 0117 ; elles utilisent les tables du Wiki).

Toutes peuvent être relancées.

## Devlog (Dossier Central)
- Un onglet par site : Dossier Central, Cartographie, Wiki. Le formulaire du
  fondateur choisit le site de l'entrée.
- Entrées de la Cartographie et du Wiki reprises de l'historique de leurs
  dépôts (depuis l'ouverture de chacun).

## Brouillard d'exploration (Cartographie + Wiki)
- La carte ne montre que ce que le personnage a parcouru : les lieux visités
  et les routes suivies, entourés d'un bord encré. Les lieux à une route d'un
  lieu visité apparaissent en « ? » (« Lieu inexploré ») : on peut s'y rendre.
- Les positions actuelles comptent comme visitées.
- Le premier membre à atteindre un lieu créé après la migration en devient
  le découvreur (affiché sur la fiche du lieu). Les comptes de test ne
  découvrent rien.
- Une fiche du Wiki peut être liée à des lieux (édition de la fiche,
  « Lieux de la carte »). Si elle n'est pas découverte, le premier membre qui
  atteint un de ces lieux la découvre pour tout le monde. La fiche du lieu,
  sur la carte, liste les fiches liées.
- Bouton « Exploration » : pourcentage, régions, meilleurs explorateurs.
  Pour la gestion de la carte : brouillard actif ou non, rayon dévoilé, et
  « Voir la carte comme un membre » (la gestion voit tout par défaut).
- Le brouillard est un affichage : les lieux restent lisibles par la base.

## Météo et incursions (Cartographie + Wiki)
- Chaque biome a son temps, tiré au sort toutes les 3 heures selon son type
  (le même pour tout le monde) : pluie ×1,15, brouillard ×1,25, orage ×1,5,
  neige ×1,4, blizzard ×1,7, canicule ×1,25, tempête de sable ×1,6, cendres
  ×1,5, vent arrière ×0,9.
- Un trajet (route ou vol) prend la pire météo traversée au moment du départ ;
  la durée de chaque étape est figée au départ. Le calcul d'itinéraire en
  tient compte.
- Effets dessinés sur la carte (pluie qui tombe, brouillard, neige, sable,
  cendres) et médaillon au centre de chaque biome. Bouton « Météo » : temps
  actuel et suivant par biome. La gestion de la carte peut couper la météo ou
  imposer un temps à un biome pour quelques heures.
- Incursions : toutes les 6 heures, 60 % de chances (réglable) qu'une
  créature découverte du Wiki (catégorie Mobs) parcoure la carte pendant
  3 heures. Bandeau sur la carte, médaillon qui avance, cercle d'observation.
- Signaler : être arrêté sur un lieu à moins de 8 % de la taille du monde de
  la créature. Un signalement par incursion et par membre, +2 de renommée
  (réglable).
- Un responsable des quêtes peut publier une quête de chasse (type
  « chasse », sans argent, renommée selon la rareté, échéance à la fin de
  l'incursion).
- Wiki : section « Où l'observer » sur la fiche (signalements et lieux liés,
  sur une petite carte).

## Propositions de modification (Wiki)
- Bouton « Proposer une modification » sur chaque fiche découverte : nom,
  résumé, tags, fiche technique, texte, avec aperçu et vue des changements,
  plus un mot pour l'équipe.
- Page « Propositions » (menu) : ses propositions et leur réponse ; pour les
  admins du Wiki, la file à relire, avec les changements surlignés mot à mot.
  Accepter publie la fiche (l'ancienne version reste dans l'historique),
  refuser renvoie un mot à l'auteur. Notification dans les deux cas.
- Une proposition acceptée rapporte 5 de renommée (réglage
  `wiki_settings.proposal_reputation`) ; les auteurs sont crédités sur la
  fiche (« Avec les contributions de »).
- 5 propositions en attente au plus par membre, une par fiche.

## Wiki refait
- Planches montées : chaque spécimen sous passe-partout, quatre coins de
  laiton, étiquette de papier épinglée (numéro, nom, rareté). Fiche non
  découverte : monture vide et étiquette à remplir.
- Même monture, en grand, pour l'image d'une fiche ; lettrine au début du
  texte.
- La collection devient un cabinet à tiroirs (porte-étiquette de laiton et
  poignée). Miniatures montées dans « Dernières découvertes ».
