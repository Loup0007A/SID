# Déplacement forcé (fin de la téléportation) + CSS personnalisé — résumé

Fichiers **nouveaux/modifiés uniquement**, à copier par-dessus ton repo
(mêmes chemins), à la suite du lot précédent (`0037`-`0040`).

## 1. Migrations SQL

### `0041_forced_travel.sql` — plus de téléportation sur la carte

- Un membre pose son **point de départ une seule fois** (`set_initial_position`)
  — ce n'est pas un trajet, il n'y a encore nulle part "d'où" partir.
- Ensuite, tout changement de **lieu** passe obligatoirement par
  `start_travel` (le système de trajet chronométré déjà utilisé pour se
  rendre sur une quête) : `set_initial_position` refuse de rejouer une fois
  posé, et `start_travel` refuse si le point de départ n'a jamais été posé.
- Bâtiment / note libre / visibilité restent modifiables à tout moment
  (`update_position_prefs`) — ce ne sont pas des déplacements.
- **Verrou en base** (triggers `trg_protect_character_position*`) : même un
  appel direct à l'API (en contournant complètement l'interface) ne peut
  plus modifier `place_id`/`route_id`/`route_progress`/`travel_started_at`/
  `planned_path`/`spawned` — seules les fonctions ci-dessus le peuvent.
  Testé : un `UPDATE` direct sur `place_id` échoue même avec tous les droits
  accordés sur la table.
- Rétrocompatible : les membres qui avaient déjà une position sont marqués
  `spawned = true` automatiquement, ils n'ont rien à refaire.

### `0042_profile_css.sql` — CSS personnalisé par membre

- Table `profile_styles` : un CSS **par membre et par zone** —
  `org_chart`, `roster` (trombinoscope), `leaderboard`, `profile`. Les 4
  sont indépendantes (`set_profile_css('roster', '...')` ne touche pas les
  3 autres).
- `set_profile_css(section, css)` : 8000 caractères max, refuse `@import`,
  `url()`, `expression()`, `-moz-binding`, `behavior`, `javascript:` déjà à
  l'enregistrement (défense en profondeur).
- `get_profile_css_for(section, user_ids[])` : récupère en un seul appel le
  CSS d'une liste de membres (utilisé par les pages qui affichent plusieurs
  personnes à la fois).

## 2. La vraie protection : le nettoyage au moment de l'affichage

Le filtrage en base est une sécurité supplémentaire, pas LA protection : ce
qui compte, c'est que **seul le résultat nettoyé soit injecté**, à chaque
affichage — voir `src/lib/profileCss.ts` (testé en isolation avec Node/TypeScript) :

- retire les commentaires ;
- supprime toute règle `@...` autre que `@media` (donc `@import`,
  `@font-face`, `@keyframes`… disparaissent avec tout leur bloc) ;
- retire les déclarations contenant `url()`, `expression()`, `-moz-binding`,
  `behavior`, `javascript:`, ainsi que `position: fixed`/`sticky` (qui
  pourrait sinon recouvrir le reste de la page) ;
- **préfixe chaque sélecteur** par la classe unique du membre
  (`.profile-skin-<id> ...`), pour qu'une règle ne matche jamais que
  l'intérieur de sa propre carte/ligne/fiche — même `body { ... }` devient
  inoffensif une fois préfixé ;
- plafonne le nombre de règles et la profondeur de récursion (`@media`
  imbriqués), pour rester rapide même avec des dizaines de membres affichés
  à la fois (testé : 1000 règles filtrées à 400 en quelques ms, aucune
  entrée malformée ne fait planter ou boucler le nettoyeur).

C'est un nettoyeur "au mieux" (pas un vrai parseur CSS conforme à la
spec) — largement suffisant pour un site communautaire privé, mais je ne le
recommanderais pas tel quel pour un site grand public sans relecture
supplémentaire.

## 3. Fichiers applicatifs fournis en entier

| Fichier | Rôle |
|---|---|
| `src/lib/profileCss.ts` **(nouveau)** | Nettoyeur/scopeur de CSS (testé) |
| `src/components/ProfileStyle.tsx` **(nouveau)** | Injecte le CSS nettoyé d'un membre (`<style>`) |
| `src/components/SettingsButton.tsx` **(nouveau)** | Bouton ⚙️ à côté de la cloche de notifications |
| `src/app/dashboard/settings/page.tsx` **(nouveau)** | 4 éditeurs de CSS (un par zone) avec aperçu en direct |
| `src/app/dashboard/map/page.tsx` | Réécrite : plus de téléportation, flux "point de départ" → "trajet" |
| `src/app/dashboard/org-chart/page.tsx`, `src/components/OrgTree.tsx` | CSS `org_chart` appliqué à la carte de chaque titulaire |
| `src/app/dashboard/members/page.tsx` | CSS `roster` appliqué à chaque carte du trombinoscope |
| `src/app/dashboard/leaderboard/page.tsx` | CSS `leaderboard` appliqué à chaque ligne |
| `src/app/dashboard/profile/[id]/page.tsx` | CSS `profile` appliqué à la fiche vue par les autres |
| `src/types/map.ts` | `CharacterPosition.spawned` ajouté |
| `src/types/admin.ts`, `src/types/profileStyle.ts` | Types associés |

## 4. Script de patch (`apply_updates.py`, mis à jour)

Ajoute maintenant aussi, dans `src/app/dashboard/layout.tsx` :
- le lien "Modération" (déjà présent dans le lot précédent),
- la bannière d'annonces,
- **le bouton ⚙️ Réglages**, posé juste à côté de la cloche de
  notifications, à chacun de ses deux emplacements (barre latérale desktop
  + barre du haut mobile).

Toujours idempotent — relance-le sans crainte si tu avais déjà lancé la
version précédente du lot.

## 5. Limites connues

- Le sélecteur `@keyframes` n'est pas autorisé (pas d'animations CSS pour
  l'instant) — évite de laisser un `@keyframes` dans ton CSS, il sera
  simplement retiré avec le reste du bloc.
- `@import`/`@charset` en tout début de fichier, sans accolades, fait
  disparaître aussi la règle suivante avec eux (comportement "prudent" du
  nettoyeur : il préfère tout retirer plutôt que mal interpréter) — évite
  simplement de les utiliser.
- L'aperçu de la page Réglages est générique (mêmes classes que le vrai
  rendu, mais pas la mise en page exacte de chaque zone) — le rendu réel
  sur l'organigramme/trombinoscope/classement/profil peut légèrement
  différer selon le contexte.
