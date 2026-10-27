# Lot 60 — Corrections et nouveautés

## À lancer dans Supabase (dépôt SID-map)

1. `supabase/migrations/0115_envers_reglages.sql` — correctif de L'Envers.
   **Ensuite, replacer la faille** (Applications → L'Envers → « Choisir sur la
   carte » ou « Au hasard ») : elle a pu être remise en 0;0.
2. `supabase/migrations/0116_notes_lieux.sql` — notes privées sur les lieux.

## Corrections

- **L'Envers** : « Enregistrer les réglages » (et « Fermer / Rouvrir ») remettait
  la faille en 0;0. Cause : `greatest(NULL, 0)` vaut 0 en PostgreSQL. Les
  coordonnées ne changent plus que si on en donne (placement, au hasard).
- **Ctrl+K sur téléphone** : plus aucun raccourci clavier proposé sur un écran
  tactile (bouton, pied de la palette, visite guidée, FAQ du Guide). Classe
  `.kbd-only` masquée en `(hover: none), (pointer: coarse)`.

## Dossier Central

- **Carte d'agent** (Mon dossier → « Ma carte d'agent ») : carte d'identité du
  S.I.D. dessinée dans le navigateur — photo (ou initiale), nom de code, rang,
  titre équipé, renommée, puissance, ancienneté, matricule, code-barres,
  signature, tampon « Accès autorisé » (« Fondateur » pour les fondateurs).
  Téléchargement en PNG, partage natif sur téléphone. `components/AgentCard.tsx`.
- **Évolution du portefeuille** (Banque) : solde de fin de journée sur 7, 30 ou
  90 jours, recalculé à rebours depuis le solde actuel avec le relevé ; bilan de
  la période, principales rentrées et dépenses par nature.
  `components/bank/WalletHistory.tsx`.
- **Mes raccourcis** (accueil) : jusqu'à 8 pages épinglées en haut de
  l'accueil, dans l'ordre choisi (gardé sur l'appareil).
  `components/PinnedShortcuts.tsx`.

## Cartographie

- **Cycle jour/nuit** à l'heure de Paris : aube rosée, plein jour, crépuscule,
  nuit bleue où les lieux s'allument comme des lanternes. Bouton avec l'heure à
  côté de Relief / Biomes / Textures pour l'éteindre (gardé sur l'appareil).
  `components/map/DayNight.tsx`.
- **Carnet de route** : une note privée par lieu (fiche du lieu → « Ajouter une
  note privée »), en quatre couleurs (kraft, danger, bon plan, à revoir). Un
  petit papier épinglé marque les lieux annotés. Personne d'autre ne voit les
  notes, pas même les admins (RLS). `components/map/PlaceNotes.tsx`.

## Wiki

- **Paliers de la collection** : médaille par catégorie (bronze 25 %, argent
  50 %, or 75 %, complète 100 %), palier suivant sur chaque carte, rang du
  Codex (de « Carnet vierge » à « Codex complet ») ; un bandeau célèbre chaque
  nouveau palier depuis la dernière visite. `lib/paliers.ts`.
- **Écouter la fiche** : la voix française de l'appareil lit le nom, le résumé,
  les informations et le texte (lecture, pause, reprise, arrêt). Bouton absent
  si l'appareil ne sait pas lire à voix haute. `components/ListenButton.tsx`.
