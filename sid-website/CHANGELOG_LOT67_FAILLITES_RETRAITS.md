# Lot 67 — Faillite des entreprises, retraits validés par l'administration

## À lancer dans Supabase

`supabase/migrations/0082_faillites_retraits.sql`, après 0080 et 0081
(rejouable).

## Faillite

- Chaque entreprise est jugée par semaines de 7 jours, à compter de sa
  création. Celles qui existent déjà commencent leur première semaine au
  lancement de la migration : aucune ne tombe d'un coup.
- Si les ventes d'une semaine sont sous **2 000 z**, l'entreprise fait
  faillite :
  1. les retraits en attente et les enchères en cours sont annulés (les
     enchérisseurs sont remboursés) ;
  2. la trésorerie rembourse d'abord la dette de l'entreprise, sinon
     emprunter puis couler ferait de l'argent gratuit ;
  3. le reste est réparti entre tous les actionnaires au prorata de leurs
     actions, y compris la population simulée. Sans actionnaire, il va à
     la caisse commune ;
  4. l'entreprise est fermée et ses objets sont retirés de la vente ;
  5. le fondateur et les actionnaires sont prévenus, avec leur part.
- Comptent comme ventes : la vitrine, les cadeaux, les enchères et les
  ventes à la population. Les deux dernières n'étaient pas comptées jusqu'ici,
  ni pour la croissance ni pour le cours de l'action. Les achats du fondateur
  dans sa propre entreprise ne comptent pas.
- Le fondateur est prévenu deux jours avant la fin d'une semaine
  insuffisante.
- Page Entreprise : jauge « Ventes de la semaine » avec l'échéance.
  Administration → Économie : la même jauge pour toutes les entreprises,
  les plus en retard d'abord.
- Le seuil se règle dans `app_config.business_min_weekly_revenue`. 0 désactive
  la règle.
- La vérification tourne une fois par heure (pg_cron, ou les visites du site).

## Retraits validés

- Concernés : les retraits d'épargne (Banque) et de trésorerie d'entreprise.
  Chacun devient une demande. La somme est mise de côté tout de suite pour
  qu'elle ne soit pas dépensée deux fois.
- Les admins « Économie » reçoivent une notification regroupée. Ils valident
  ou refusent, avec un motif facultatif, dans Administration → Économie →
  « Retraits à valider ».
- Validé : l'argent arrive dans le portefeuille. Refusé ou annulé par le
  membre : la somme retourne à l'épargne ou à la trésorerie.
- Un admin ne valide pas son propre retrait, sauf s'il est le seul admin
  « Économie ».
- Chaque décision est inscrite au journal d'audit.
- Une fermeture volontaire ou une faillite remet d'abord les retraits en
  attente dans la trésorerie, avant la répartition.

## Vérifié

- 45 scénarios SQL sur une copie locale de la base :
  - demande, validation, refus, annulation, droits ;
  - faillite avec dette, actionnaires et population simulée ;
  - faillite sans actionnaire, ou avec une dette plus grosse que la
    trésorerie ;
  - semaine réussie, avertissement unique, entreprise neuve épargnée ;
  - fermeture volontaire avec un retrait en attente ;
  - règle désactivée.
- Build Next.
- Captures de Banque, Entreprise et Économie.
