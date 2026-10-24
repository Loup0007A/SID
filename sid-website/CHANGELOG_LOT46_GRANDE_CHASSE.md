# Lot 46 : la Grande Chasse

**Migration : `supabase/migrations/0068_grande_chasse.sql`**, à lancer après
`0067` (peut être relancée).

> Ordre : `0067` puis `0068`. Si une migration plus ancienne est relancée un
> jour (`0061` surtout), relancer ensuite toutes celles qui la suivent, dans
> l'ordre. `0064`, `0065` et `0067` contiennent déjà la Grande Chasse : les
> relancer ne la retire pas.

Un événement spécial pour la semaine de l'anniversaire d'une célèbre série de
jeux de chasse au monstre. Tout est original au S.I.D. : nom, créature, dessins,
textes (aucun nom, logo ni monstre de la série). Pour renommer l'événement, il
suffit de changer les textes de `src/lib/events.ts` (nom, description) et de
`src/components/seasonal/GrandeChasse.tsx` (phrases du décor).

## 🏹 La Grande Chasse (du 9 au 15 mars)
Affichée automatiquement (heure de Paris), réglable dans **Modération →
Affichage événementiel** (auto / forcé / coupé), même réglage pour les trois
sites. La créature : **Brasombre**, la wyverne des cendres (trois robes :
Braise, Givre, Orage).

Sur le **Dossier Central** :
- fond de crépuscule : volcan, coulées de lave, Brasombre perchée sur sa
  falaise, campement des chasseurs (tentes, feu, marmite, séchoir) et cendres ;
- Brasombre survole la page une fois par visite (son ombre passe, la page
  tremble au passage) ;
- guirlande de fanions et de crocs sous la barre du haut ;
- phrase d'accueil (une spéciale le 11 mars, jour anniversaire) ;
- au pied de page, un cor de chasse : souffle dedans, et parfois Brasombre
  répond en survolant la page ;
- sur l'accueil, le **tableau de chasse** : trophées du jour et de la semaine,
  nombre de chasseurs, tes trophées, le top 5, des conseils et le compte à
  rebours de la fin de l'événement.

Sur la **Cartographie** : fanions, survol, sceau 🏹 et bords couleur de braise.
Sur le **Wiki** : fanions, survol, Brasombre perchée sur son piton, braises,
mer de lave et, sur l'accueil, la **proie du jour** (un mob déjà découvert,
le même pour tout le monde toute la journée).

## Le titre : Grand Veneur
L'énigme est dans la vitrine des titres. Pendant l'événement, des traces
griffues apparaissent sur le Dossier Central (une piste par jour au plus) : il
faut les suivre de page en page, puis affronter Brasombre dans une vraie
petite chasse (toucher ses points faibles quand ils brillent, la tête fait plus
mal ; esquiver ses charges, avec le bouton ou la barre d'espace ; trois cœurs,
elle entre en rage à 40 %). Trois chasses réussies, trois jours différents :
le titre est à toi. Le code de la chasse est brouillé comme celui des autres
titres.

**Pouvoir : Assaut de Brasombre** (10 minutes). L'ombre de la wyverne passe sur
le site de la cible, elle se pose en bas de l'écran, rugit (la page tremble) et
laboure l'écran de ses griffes. Réglages : sa robe (Braise, Givre, Orage), sa
fureur (un assaut par minute, toutes les 40 s ou toutes les 20 s), si la cible
peut la chasser à coups de clics (3, 5 ou 7 selon la fureur) et son cri (un
message de 60 caractères). Aperçu dans le panneau de lancement.

Le titre a son aura : braises qui montent et trois griffures.

## Technique
- `grande_chasse_board()` : chiffres du tableau de chasse (comptes invisibles
  exclus du top).
- Les dessins de l'événement (`chasseArt.tsx`) sont partagés par le décor, la
  chasse et la farce ; chaque partie n'est téléchargée que si elle sert.
- Rien n'est chargé hors saison.
