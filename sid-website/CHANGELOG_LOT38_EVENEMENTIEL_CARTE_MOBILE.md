# Lot 38 — Fonctionnalités de la carte et du wiki rétablies, affichage événementiel, carte fluide sur téléphone

Pas de nouvelle migration (la 0063 du lot 37 suffit).

## Ce qui s'était passé
Les nouveautés de la Cartographie (visite guidée, centre d'aide, fenêtres
flottantes, favoris, mesure, sélection multiple, thème animé, icônes) et du
Wiki (onglet Profils, porte-armure, apparence des armes) vivaient sur les
branches `guide-accompagnement` et `claude/profils-armor-stand`, promues en
production sur Vercel. Les mises à jour des CGU (lots 34, 35, 37) ont été
poussées sur `main`, d'où part la production : elle avait donc perdu ces
fonctionnalités. Les deux branches sont maintenant fusionnées dans `main`
(rien n'avait été effacé de git).

## Affichage événementiel (3 sites)
- Modération → **Affichage événementiel** (ex-« Décor saisonnier ») règle
  Halloween pour le Dossier Central, la Cartographie et le Wiki d'un coup.
- Carte : toile d'araignée, chauves-souris, sceau en citrouille, bords teintés.
- Wiki : lune, chauves-souris, citrouilles sur les vagues, mer orangée.
- Les chauves-souris quittent la page après leur vol (plus d'animation cachée).

## Carte sur téléphone
Détails dans le README de la Cartographie (« Fluidité sur téléphone ») :
gestes déplacés par la carte graphique sans React, calques mémorisés,
animations continues coupées, niveau de détail, vue de départ plein écran,
panneau de lieu en bas d'écran, fenêtres chargées à la demande, barre du haut
compacte.
