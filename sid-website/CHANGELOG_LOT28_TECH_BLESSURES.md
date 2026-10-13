# Lot 28 — Blessures, arbre technologique, services suspendus

Migration : `supabase/migrations/0054_injuries_tech_tree.sql` (après 0053).

## Donjons (jeu 3D)
- Niveau Donjons (Puissance) **10+** : en mourant, le gardien récupère tous
  ses PV ; s'éloigner à plus de 70 m de lui aussi. En dessous de 10, il garde
  ses blessures. En raid, il les garde toujours.
- Niveau **50+** : chaque mort a 1 chance sur 2 de provoquer la **perte
  temporaire d'un membre** : écran de sang dans le jeu, la simulation se
  ferme, et la page Donjons affiche un écran taché de sang avec le compte à
  rebours. Le S.I.D. refuse toute nouvelle partie Donjons jusque-là
  (durée : réglage `simulation_injury_minutes`, 60 min par défaut).

## Services suspendus (Modération → maintenance)
- Même présentation que les simulations « en développement » : bandeau jaune
  et noir « Service suspendu » sur la tuile de l'accueil, bandeau en haut de
  la page, page grisée et inutilisable (l'administration garde l'accès).
  Sections : messagerie, quêtes, simulations, boutique, banque.

## Arbre technologique (nouvel onglet, groupe Entraînement)
- Points = 1 par simulation réussie (total des compétences), moins les
  achats ; dépenser ne baisse pas les facteurs.
- Missions : Primes de mission (+5 %/niv.) → Optimisation fiscale (−8 %
  d'impôt/niv.) → Niche fiscale (−10 % de TVA/niv.). Finances : Négociation
  salariale (+5 %/niv.) → Placements avisés (+10 % d'intérêts/niv.).
  Carrière : Promotion (100 pts, un rang de plus, jusqu'à S).
- Les bonus sont versés automatiquement à chaque récompense de quête,
  salaire, intérêt, impôt ou vente (ligne « Arbre techno : … » dans
  l'historique). Coûts et effets modifiables dans la table `tech_nodes`.

## Comptoir
- Donner un effet à un objet est réservé aux admins (permission
  `manage_economy`), en base comme dans le formulaire.
