# Lot 53 : le tuto du Dossier Central

**Migration : `supabase/migrations/0072_tutoriel.sql`**, à lancer après `0071` (peut être relancée).

## Dossier d'intégration
À sa première arrivée sur l'accueil, un nouvel agent (inscrit depuis moins de
7 jours) reçoit son dossier : une chemise kraft glisse sur la table, le
tampon « Confidentiel » tombe, la chemise s'ouvre sur sa fiche d'agent tapée
à la machine (photo, nom de code, rang, date d'entrée), puis le tampon
« Agent actif ». Ordre de mission : commencer la visite, ou plus tard.
Un clic pendant l'animation la termine d'un coup.
Les membres déjà inscrits voient à la place une invitation sur l'accueil.

## Visite guidée (24 étapes, 8 chapitres)
Le Dossier Central, ton dossier, les quêtes, la carte, l'entraînement,
l'argent, les autres agents, les secrets. La visite change de page toute
seule, assombrit l'écran, entoure l'élément au feutre rouge et l'explique
sur une fiche de papier trombonée. Flèches du clavier, Entrée, Échap.
Sur téléphone, la fiche se pose en bas de l'écran. Si un élément manque (pas
de quête ouverte…), la fiche l'explique quand même. La progression est
gardée en base : on reprend où on s'était arrêté, sur n'importe quel appareil.
Tous les chiffres (taux, limites, salaire…) viennent de la base.

## Bouton « ? » (en-tête)
Visite guidée (ou reprendre), astuce de la page, Guide du S.I.D. (avec le
compte des premiers pas), revoir le dossier d'intégration, réafficher les
astuces.

## Astuce de première visite
Sur chaque page (et chaque page d'administration), une fiche scotchée
résume l'essentiel à la première visite ; « Me montrer » lance la visite du
chapitre concerné seulement.

## Guide du S.I.D. (`/dashboard/guide`, Mon espace)
Le manuel complet en 12 chapitres, avec lexique et questions fréquentes ;
chaque chapitre peut être montré en direct. **Premiers pas** vérifiés par la
base : dossier complété, position posée, mission prise, simulation réussie,
point dépensé, message envoyé, argent placé ou dépensé.
**Prime d'intégration** : visite terminée + 5 premiers pas → 1 000 z, une
seule fois (pas pour les comptes du bac à sable).
Réglages : `app_config.onboarding_reward` et `onboarding_reward_min_steps`.

## Pour ajouter une étape ou une astuce
Tout le texte est dans `src/lib/tuto/content.ts` ; un élément de page se
désigne par `data-tuto="…"`.
