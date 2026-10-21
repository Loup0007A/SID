# Lot 41 : affichage de Noël

**Migration : `supabase/migrations/0064_decor_noel.sql`** (après 0063, peut être relancée).
Sans elle, rien ne s'affiche et la ligne Noël de Modération demande de la lancer.

## Réglage
Modération → Affichage événementiel → **🎄 Noël** : Automatique (du 1er décembre
au 6 janvier, heure de Paris), Toujours, ou Désactivé. Un seul réglage pour les
trois sites, comme Halloween.

## Dossier Central
- Fond d'hiver : nuit bleutée, aurore qui ondule doucement, étoile du berger.
- Neige qui tombe derrière le contenu (deux couches sur téléphone, trois sur ordinateur).
- Collines enneigées, sapins (un décoré et illuminé), chalet aux fenêtres allumées.
- Guirlande lumineuse accrochée sous la barre du haut.
- Traîneau du père Noël et ses rennes (nez rouge en tête) : passe une fois par
  visite ; une étoile filante de temps en temps.
- « S.I.D. » coiffé de neige, phrase de l'accueil selon la date (compte à rebours,
  réveillon, Noël, nouvel an, Épiphanie).
- Cadeau dans le pied de page : il s'ouvre et dit un petit mot.

## Cartographie
Guirlande sous la barre (fixe), sceau en sapin, givre sur les bords de la carte,
traîneau et quelques secondes de neige à l'arrivée. Ensuite plus rien n'est animé :
la carte reste aussi fluide qu'avant.

## Wiki
Étoile, neige, guirlande (qui scintille sur ordinateur), mer givrée sous une
aurore verte et bleue, cadeaux qui flottent sur les vagues, traîneau.

## Sobriété
Seuls des déplacements (transform) et des opacités sont animés ; sur écran
tactile, ampoules, fumée, aurore et cadeaux restent immobiles ; « réduire les
animations » coupe tout ce qui bouge.
