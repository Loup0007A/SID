# Lot 86 — Modération en onglets, base de données, devlog, dex et alliés

Migrations : `0103_outils_fondateur.sql` puis `0104_dex_allies.sql` (après 0102).
Les deux peuvent être relancées.

## Modération
- La page est découpée en onglets, comme Économie : Annonces, Sites et
  sections, Événements, Sanctions, et **Base de données** (fondateur seul).
- Base de données, en lecture seule :
  - **Construire une requête** : table, colonnes, conditions (égal, contient,
    commence par, vide, dans une liste…), toutes / au moins une, tri, pages de
    50 lignes. La requête SQL produite s'affiche et se copie ; la page se
    télécharge en CSV.
  - **Chercher un texte partout** : toutes les colonnes texte de toutes les
    tables ; « Voir les lignes » ouvre le constructeur sur le résultat.
  - Côté base : `founder_db_tables`, `founder_db_query`, `founder_db_search`,
    réservées au fondateur, noms de tables et colonnes vérifiés, valeurs
    échappées, délai maximum de 10 s (25 s pour la recherche).

## Devlog
- Nouvelle page `/dashboard/devlog` (menu Mon espace) : nouveautés par mois,
  filtre par étiquette, pastille « Nouveau » pendant 7 jours.
- Le fondateur ajoute, modifie et supprime les entrées depuis la page.

## Dex
- Toute carte tirée (renfort de quête ou allié) est enregistrée dans le dex,
  même si elle n'est pas gardée. Un personnage déjà connu garde ses meilleures
  statistiques ; le nombre de tirages est compté. Les cartes du lot 85 y sont
  reprises.
- Page `/dashboard/dex` (menu Jeu) et lien « Réutiliser une carte de mon dex »
  dans le panneau de puissance d'une quête.
- **Réutiliser un renfort** sur une autre quête à puissance globale :
  - prix entre un minimum et un maximum selon la qualité de la carte ;
    par défaut 5 000 à 25 000 zénis au rang E, 10 à 50 millions au rang Divin,
    rangs intermédiaires en suite géométrique ;
  - risque d'échec : 2 % au rang E, 25 % au rang Divin par défaut ;
  - payé même en cas d'échec ; la carte est alors bloquée 2 heures ;
  - l'argent va dans la cagnotte TVA.

## Alliés de simulation
- Sur chaque simulation, un panneau pour recruter et équiper un allié :
  Compagnons (Donjons), Sages (Intelligence), Artisans (Techniques). Même
  système de chances que les renforts ; prix réglable à part.
- Protections par jour et chance de réussite selon le rang :
  E 1 × 15 %, D 1 × 25 %, C 2 × 35 %, B 2 × 50 %, A 3 × 65 %, S 4 × 80 %,
  Divin 6 × 95 %. Une tentative consomme une protection, réussie ou non.
- Donjons : le Compagnon peut éviter la blessure (niveau 50+). Il est aussi
  enregistré dans les raids de boss rejoints ; la liste des raids affiche les
  compagnons et le jeu reçoit `allies` dans le message `sid-raid` « joined ».
- Intelligence et Techniques : un échec peut être annulé ; il ne compte alors
  pas dans la limite du jour (partie marquée `ally_saved`).

## Administration → Économie → Recrutement
- Nouveau bloc « Alliés de simulation et dex » : prix d'un tirage d'allié,
  prix de réutilisation (E et Divin, minimum et maximum), échecs (E et Divin),
  durée du blocage.

## À savoir
- Le jeu Donjons (site externe) reçoit `{ type: "sid-injury", protected: true }`
  quand le Compagnon protège ; il doit le gérer pour ne pas afficher la
  blessure. De même pour le champ `allies` des raids.
