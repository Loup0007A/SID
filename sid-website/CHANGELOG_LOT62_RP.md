# Lot 62 — Jeu de rôle : messagerie et quêtes

## À lancer dans Supabase (dépôt sid-website)

`supabase/migrations/0078_rp.sql` — **contient aussi un correctif de sécurité**
(voir plus bas). Rejouable sans risque.

## Messagerie RP

Au-dessus du champ de saisie, la façon de parler :

| Mode | Raccourci | Affichage |
|---|---|---|
| Parler | (texte normal) | bulle habituelle |
| Action | `/me …` | ligne de récit centrée : « ✦ Bob pousse la porte… » |
| Hors-RP | `((…))` ou `/hrp …` | petite ligne discrète « HRP Bob : … » |
| Narration | `/narr …` | encadré de parchemin « Le récit » — **maîtres du jeu** seulement (responsables des quêtes, admins) |
| Dés | `/des 2d6+1`, `/des d100`, bouton « Dés » | carte avec chaque dé et le total ; réussite / échec critique au d20 |

- **Dés tirés par le serveur** (`rp_roll`) : impossibles à truquer ; un lancer
  ne se modifie pas (il peut être supprimé). 1 à 20 dés, 2 à 1000 faces,
  modificateur ±999.
- Règles en base (`guard_chat_kind`) : on ne peut ni insérer un faux lancer,
  ni narrer sans en avoir le droit, ni changer le type d'un message.
- Les commandes de farce des admins (`/shake`…) ne changent pas.

## Quêtes RP

- **Ordre de mission** : à la création, un **commanditaire** (« Le Conseil des
  Marchands ») et jusqu'à 8 **objectifs**, affichés en cases à cocher sur la
  fiche de la quête.
- **Rapport de mission** : sous une quête prise, « Rédiger mon rapport de
  mission » ouvre une feuille confidentielle (20 à 4000 caractères, modifiable).
  La participation passe « rendue » et le commanditaire est notifié (lien
  direct vers la quête). Les responsables lisent les rapports dans « Gérer les
  participants ».
- **Chroniques du S.I.D.** (bas de la page des quêtes) : les missions
  accomplies et les rapports de leurs participants validés, en frise.
- Le Guide explique la messagerie RP et le rapport (FAQ).

## Correctif de sécurité (dans 0078)

La règle d'accès laissait un participant **modifier sa propre participation**
directement depuis l'API : il pouvait se marquer « validé », ou déplacer sa
participation vers une autre quête (en contournant la prise « sur place » et
la limite de places). Désormais seuls les responsables (et les fonctions du
site) changent le statut, la quête ou le membre ; le participant peut toujours
choisir à qui reverser sa récompense.
