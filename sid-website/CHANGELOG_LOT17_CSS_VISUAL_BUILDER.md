# Réglages : éditeur visuel (sans code) + animations — résumé

Fichiers **nouveaux/modifiés uniquement**, à copier par-dessus ton repo
(mêmes chemins), à la suite du lot précédent.

## Ce qui change

La page Réglages propose maintenant, pour chacune des 4 zones (organigramme,
trombinoscope, classement, profil), un **éditeur visuel** en premier —
couleurs (bordure, fond uni ou dégradé, lueur, accent) via des sélecteurs de
couleur, curseurs (épaisseur, arrondi, intensité, angle), et une **galerie
de 6 animations** à un clic : Lueur pulsée, Pulsation douce, Flottement,
Reflet brillant, Aura arc-en-ciel, Néon clignotant (sur le texte).

Le mode "CSS avancé" (celui du lot précédent, corrigé) reste disponible en
second onglet pour qui préfère écrire son CSS à la main.

## Comment ça marche, techniquement (rien ne change côté sécurité)

L'éditeur visuel ne fait que **générer du texte CSS** à partir des réglages
choisis, puis l'enregistre exactement comme avant, via le même
`set_profile_css` — **aucune migration, aucun changement de base de
données**. Ce texte généré repasse donc par le même nettoyeur déjà en place
(`src/lib/profileCss.ts`, testé au tour précédent) à chaque affichage,
exactement comme du CSS tapé à la main.

Les animations elles-mêmes (les `@keyframes`) sont désormais définies une
fois pour toutes dans `globals.css` — jamais par un membre. Le CSS généré
se contente de les *référencer* par leur nom
(`animation: profile-glow-pulse 2.4s ease-in-out infinite;`) et de régler
leur couleur via des propriétés CSS ordinaires. Comme le nettoyeur retire
déjà systématiquement toute règle `@keyframes` tapée par un membre (voir
lot précédent), rien ne change à cette protection : les seules animations
qui existent sont celles que j'ai écrites moi-même dans `globals.css`.

Pour permettre de rouvrir l'éditeur visuel plus tard avec les mêmes
réglages (sans les redemander), les options choisies sont encodées dans un
commentaire CSS en tête du texte généré (`/*BUILDER:{...}*/`) — ce
commentaire est automatiquement supprimé par le nettoyeur avant affichage,
il n'est donc jamais visible des autres membres ; la page Réglages le relit
juste pour reconstituer les curseurs/couleurs. Si le CSS enregistré n'a pas
ce commentaire (parce qu'il a été écrit à la main), la page ouvre
directement le mode avancé pour ne jamais écraser du CSS par surprise.

Testé : les 6 animations × les 4 zones passent correctement par le
nettoyeur (commentaire bien retiré de l'affichage final, réglages bien
reconstitués depuis le texte brut enregistré).

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/profileCssBuilder.ts` **(nouveau)** | Génère le CSS à partir des options (testé) |
| `src/components/CssBuilderPanel.tsx` **(nouveau)** | Le formulaire (couleurs, curseurs, galerie d'animations) |
| `src/app/dashboard/settings/page.tsx` | Éditeur visuel par défaut, CSS avancé en second onglet |
| `src/app/globals.css` | Ajout des 6 `@keyframes profile-*` (statiques, partagées) |
