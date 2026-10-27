# Lot 59 — Surprises

Aucune migration SQL : tout passe par les règles d'accès existantes.

## Dossier Central

### Palette de recherche (Ctrl+K)
- Loupe dans l'en-tête (barre « Rechercher Ctrl K » sur grand écran), ou
  **Ctrl+K / ⌘K** n'importe où, ou la touche **/** hors d'un champ.
- Cherche les **pages** (selon les permissions), les **membres**, les
  **quêtes** ouvertes, les **objets du Comptoir**, et des **actions** : rejouer
  la visite guidée, rouvrir le dossier d'intégration, masquer/réactiver les
  astuces, se déconnecter. Liens vers la Cartographie et le Wiki.
- Insensible aux accents, mots dans le désordre, lettres dans l'ordre
  (« mdos » → Mon dossier). Le groupe qui contient la meilleure réponse passe
  en premier : Entrée ouvre le résultat le plus proche.
- Sans recherche : les derniers éléments ouverts (gardés sur l'appareil).
- Clavier complet (↑ ↓ Tab Entrée Échap), annoncée aux lecteurs d'écran
  (combobox + listbox), le focus revient où il était à la fermeture.
- `components/palette/CommandPalette.tsx`.

### Liens directs
- `/dashboard/quests?quete=<id>` : la quête défile à l'écran et brille.
- `/dashboard/shop?objet=<id>` : la fiche de l'objet s'ouvre.
- `lib/deeplink.ts` (`useDeepLink`) : fonctionne quel que soit l'ordre
  d'arrivée de l'adresse et des données ; la palette prévient la page même
  quand on reste sur la même page.

### Rapport « Depuis ta dernière visite »
- Sur l'accueil, après 45 min d'absence : argent gagné / dépensé, renommée,
  titres gagnés, nouvelles quêtes, nouveaux agents, nouveautés du Comptoir, et
  la plus belle rentrée. Chaque case mène à la bonne page. « Classer le
  rapport » le range jusqu'à la prochaine visite.
- Repère de visite gardé sur l'appareil (`sid-visite-v1`), 30 jours au plus.
- `components/SinceLastVisit.tsx`.

### Courbe de renommée
- Dans « Mon dossier » : la renommée après chacun des 20 derniers
  mouvements, recalculée depuis le total. Survol : le mouvement et le total
  à ce moment.

### Tuto et Guide
- La visite guidée mentionne la palette ; trois nouvelles questions
  fréquentes (palette, rapport, quêtes sur place depuis la carte).

## Cartographie

- **Un parchemin par lieu** (au lieu de parchemins empilés), avec le nombre de
  quêtes et un halo doré qui respire. Accessible au clavier.
- **Tableau des quêtes du lieu** : rang, description, récompense, renommée,
  places prises / max, échéance. Sur place : **Prendre la quête** directement
  depuis la carte. Ailleurs : **Y aller** ouvre l'itinéraire vers le lieu.
  Lien vers la quête sur le Dossier Central (lien direct). Échap ferme.

## Wiki

- **L'énigme du jour** sur l'accueil : l'image floutée et assombrie d'une fiche
  illustrée déjà découverte (la même pour tous, heure de Paris), quatre propositions (les
  leurres viennent de la même catégorie), un indice (l'image se précise,
  tags et début du résumé sans le nom), une réponse par jour, **série de jours réussis** et record
  gardés sur l'appareil. L'image se révèle en couleur à la réponse.
  `lib/enigme.ts` (tirage côté serveur), `components/EnigmeDuJour.tsx`.
- **Flèches ← →** sur une fiche : fiche précédente / suivante (pages
  préchargées). Petites touches affichées sous la fiche sur ordinateur.
