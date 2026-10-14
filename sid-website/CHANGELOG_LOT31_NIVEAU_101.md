# Lot 31 — Niveau caché 101 et rang Divin

Migration : `supabase/migrations/0057_rang_divin.sql` (après 0056).

## Donjons (jeu 3D) : « Le Trône de l'Archive »
- N'apparaît qu'une fois les 100 niveaux terminés (Puissance 100) : une carte
  dorée « Niveau caché · 101 » s'ajoute au hub, et la fin du niveau 100
  propose d'y entrer.
- **Solo uniquement** : pas de bouton d'appel à l'aide, aucun raid possible.
- Cinématiques (bandes noires, plans de caméra, sous-titres ; Espace pour
  avancer, Échap ou « Passer » pour sauter) avant chaque épreuve et à la
  victoire.
- Cinq épreuves dans l'arène du Trône :
  1. trois Chimères (bond + gerbe de feu) ;
  2. trois Wyvernes d'Orage (vol, éclairs) et une Chimère ;
  3. le Béhémoth de Cristal (secousses, jets de rochers) et deux Wyvernes ;
  4. les Trois Dragons (feu, givre, néant) ;
  5. **le Primordial** : dragon couronné, pluie de météores, appelle des
     wyvernes en renfort.
- Ultra dur : monstres +60 % de PV, +40 % de dégâts, régénération réduite de
  moitié, aucun artefact légendaire. Toutes les compétences sont acquises au
  départ. Mourir relance l'épreuve en cours (pas tout le niveau) ; les
  blessures du niveau 50+ s'appliquent toujours.

## S.I.D.
- Nouveau rang **Divin** (au-dessus de S), avec sa carte de rang dorée animée
  (profil, profil public).
- Réussir le niveau 101 en Donjons (Puissance 100 requise, vérifié côté
  serveur) fait passer au rang Divin : notification « ✦ Tu es devenu Divin »
  et ligne `rank_divine` dans le journal d'audit.
- L'arbre technologique ne monte toujours que jusqu'à S ; les admins peuvent
  aussi attribuer Divin depuis la page Rôles.
