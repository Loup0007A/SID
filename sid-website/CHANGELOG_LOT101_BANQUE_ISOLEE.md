# Lot 101 : banque isolée

Migrations : `0129_banque_isolee.sql`, `0130_devlog_banque_isolee.sql`.

Une banque à part, hors de l'économie du S.I.D. Son argent ne compte pas dans
la masse monétaire, ne rapporte pas d'intérêts, n'est ni taxé, ni saisi
(impôts, faillites, absences), et n'est pas touché par les farces.

## Mise en service

1. Lancer `0129` puis `0130` dans l'éditeur SQL de Supabase.
2. Désigner le directeur, dans l'éditeur SQL seulement :

   ```sql
   select public.banque_isolee_designer_directeur('TonPseudo');
   ```

   Ce doit être un fondateur. Aucune clé du site, même la clé « service », ne
   peut appeler cette fonction. Pour retirer le directeur :
   `select public.banque_isolee_designer_directeur(null);`
3. Le directeur ouvre **Administration → Banque isolée**
   (`/dashboard/admin/banque-isolee`, ou le lien « Diriger » dans la page Banque).

## Fonctionnement

- **Accès** : donné par le directeur, membre par membre, avec un plafond
  propre ou le plafond par défaut (1 000 z au départ).
- **Dépôt** : de l'épargne vers la banque isolée, immédiat.
- **Retrait**, vers l'épargne seulement :
  1. le membre demande un montant ;
  2. il confirme en retapant le montant, dans les 15 minutes. La somme est
     alors mise de côté ;
  3. le directeur accepte ou refuse (note obligatoire pour refuser) ;
  4. 48 h d'attente, pendant lesquelles le directeur peut encore bloquer ;
  5. versement sur l'épargne (tâches de fond). Un membre gelé attend son dégel.

  Plafond sur 7 jours glissants. Trois demandes au plus en attente du
  directeur. Le membre peut annuler tant que rien n'est versé.
- **Retrait de l'accès** : les demandes en cours sont annulées, puis tout le
  solde est soit **détruit**, soit **renvoyé sur l'épargne**. Le directeur
  retape le pseudo du membre pour confirmer.
- Le membre est prévenu à chaque étape (notifications « Banque isolée »,
  toujours envoyées), et l'accès donné ou retiré apparaît dans son journal du
  compte. L'export de ses données comprend la banque isolée.

## Réforme monétaire

Tant qu'un directeur existe, aucune réforme ne s'applique sans sa validation,
en plus de la vérification habituelle par un admin « Économie ». Pour chaque
réforme, le directeur décide si la banque isolée est convertie aussi (soldes,
retraits en cours et plafonds) ou laissée telle quelle. Toute modification de
la réforme annule sa validation. Le rapport de la réforme appliquée indique ce
qui a été fait.

## Sécurité

- Les tables ne sont lisibles par personne directement : tout passe par des
  fonctions qui vérifient le rôle (membre avec accès, ou directeur).
- `scripts/audit-securite.sql`, partie 10 : un membre ordinaire ne peut ni se
  désigner directeur, ni se donner accès, ni lire la direction ou les
  retraits, ni déclencher les versements. Vérifié : chaque essai détecte bien
  une faille ouverte exprès.
- Correctif relevé par l'audit : les styles de fiche (migration 0042) étaient
  lisibles sans session ; ils sont maintenant réservés aux membres connectés.

## Aussi

- Page Banque : les totaux « Rentrées » et « Dépenses » du relevé utilisent les
  couleurs du thème (ils étaient illisibles en mode épuré et en contraste
  renforcé). La page Banque est ajoutée aux tests d'affichage.
