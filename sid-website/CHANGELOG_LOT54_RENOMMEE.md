# Lot 54 : la renommée réparée

**Migration : `supabase/migrations/0073_renommee.sql`**, à lancer après `0072` (peut être relancée).

## Ce qui ne marchait pas
- **Présence sur le lieu d'une quête** (1 h sur la Cartographie) : la
  validation exigeait la permission « gestion des quêtes » du membre lui-même
  et échouait toujours en silence. Ni récompense, ni renommée.
- **Valider deux fois** le même participant le payait et lui donnait la
  renommée deux fois ; **rejeter deux fois** la retirait deux fois ;
  **rejeter un participant déjà validé** lui retirait de la renommée en plus.
- **« Valider tout le monde »** (et la validation automatique à l'échéance)
  validait aussi les participants **déjà rejetés** : sanctionnés, puis payés.
- Les quêtes **sans limite de places** n'expiraient jamais ; et les
  participants rejetés comptaient pour atteindre l'objectif.
- Le calcul pouvait arrondir à **0** : une quête réussie ne rapportait rien.
- **Rien ne se voyait** : la notification ne donnait pas le montant, et aucune
  page ne montrait sa renommée ni d'où elle venait.

## Maintenant
- Tous les mouvements passent par un seul endroit et sont enregistrés
  (table `reputation_events`) : quête réussie, échouée, présence, sanction
  annulée, correction de l'administration.
- Un participant n'est validé ou rejeté **qu'une fois**. Valider quelqu'un qui
  avait été rejeté **annule d'abord sa sanction**. Impossible de rejeter
  quelqu'un déjà validé.
- Calcul automatique : au moins **+1** en cas de réussite, **−1** en cas
  d'échec.
- Quête sans limite de places arrivée à échéance : son **créateur décide**
  (valider / échouer) s'il y a des participants, sinon elle échoue (personne
  n'est pénalisé). Les participants rejetés ne comptent plus dans l'objectif.
- Le créateur d'une quête peut valider ou rejeter ses participants (en plus
  de la gestion des quêtes).
- **Présence 1 h sur place** : la quête est validée (récompense + renommée),
  une seule fois. Message de la Cartographie mis à jour.
- **À l'écran** :
  - chaque fiche de quête : « Renommée : +16 si réussie · −8 si échouée »,
    puis « Réussie pour toi · +16 de renommée » une fois jouée ;
  - **Mon dossier** : ta renommée, ta place au classement et l'historique de
    chaque gain ou perte ;
  - notifications : « … a été validée : récompense versée, +16 de renommée. »
- Guide du S.I.D. mis à jour.

L'historique ne commence qu'à cette migration (les anciens mouvements
n'étaient enregistrés nulle part) ; les totaux, eux, ne changent pas.
