# Lot 58 — Accessibilité et décors

Aucune migration SQL.

## Décors

- **Manoir d'Halloween (Dossier Central)** : sur un écran large et peu haut,
  le paysage était recadré par le haut et les toits des tours disparaissaient.
  La hauteur du paysage suit maintenant aussi la largeur de l'écran
  (`.sc-land`, `.gc-land`) : plus aucun décor de fête n'est rogné par le haut.
  Le manoir gagne un liseré de lune sur les toits, des girouettes et des
  croisillons aux fenêtres.
- **Manoir du Wiki** : la pointe de la tour gauche sortait du cadre du dessin
  (toujours coupée). Manoir réduit et recentré, avec liseré, girouettes,
  oculus et porte éclairée (fichier identique dans la Cartographie).

## Accessibilité (audit axe-core WCAG 2.1 AA sur les trois sites)

### Les trois sites
- **Étiquettes de formulaire** : `LabelLinker` relie chaque étiquette orpheline
  au champ qui la suit (une centaine de champs : connexion, inscription,
  réglages, banque, admin…). Un lecteur d'écran annonce enfin le nom du champ,
  et cliquer l'étiquette place le curseur dans le champ.
- **Contrastes** : les textes `text-paper/30` à `/55` passent à `/65`,
  `text-ink/50–60` à `/75`, les textes indicatifs (placeholder) à `/50`.
  Liens du pied de page et petites mentions désormais lisibles (≥ 4,5:1).

### Dossier Central
- Lien « Aller au contenu » (visible au premier Tab) et zone principale
  `#contenu`.
- Contour de focus doré pour la navigation au clavier (liens, boutons,
  onglets, cases, curseurs, champs).
- Messagerie : titre de page pour les lecteurs d'écran ; Comptoir : niveaux de
  titres corrigés ; jauges de la page Technologies annoncées (« Niveau x sur y »).
- Annonces : vraie boîte de dialogue, focus sur « J'ai compris ».
- Nouveau titre : boîte de dialogue nommée, focus sur « Équiper », Échap ferme.

### Cartographie
- Zone principale et titre de page sur la carte.
- Panneau Applications : boîte de dialogue, Échap ferme.
- Fiche de lieu : niveaux de titres corrigés.

### Wiki
- Lien « Aller au contenu ».
- Filtres de catégorie : `aria-current` à la place d'un `aria-pressed` invalide
  sur des liens ; rareté annoncée (`role="img"`) ; bloc d'informations de la
  fiche nommé.
