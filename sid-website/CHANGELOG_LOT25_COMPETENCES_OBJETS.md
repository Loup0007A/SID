# Lot 25 — Compétences, niveaux, objets, vitrine, prérequis

Migration : `supabase/migrations/0051_skills_items_prerequisites.sql` (après 0050).

## Intelligence = moyenne des trois compétences
- Chaque épreuve a ses propres points (0 à 100, +1 par réussite) : Potions,
  Énigmes, Problème, Techniques, Donjons (table `member_skills`).
- Intelligence = moyenne de Potions, Énigmes et Problème ; Puissance = Donjons ;
  Technique = Techniques. Les facteurs deviennent décimaux (ex. 26,7).
- Reprise : les points d'intelligence déjà gagnés sont donnés aux trois
  compétences (l'intelligence ne change pas).
- L'API enregistre l'épreuve jouée (`epreuve`), obligatoire pour l'Intelligence.

## Niveaux réglés par l'administration
- Admin → Économie → « Niveaux & puissance » : un champ par compétence.
- `set_member_levels` met à jour les points ET la progression dans les sites
  (niveau débloqué dans Potions/Techniques, histoires terminées dans Donjons),
  appliquée à la prochaine ouverture depuis le S.I.D. Journal d'audit :
  « Niveaux modifiés ».

## Objet « réinitialisation des délais »
- Au comptoir, l'administration choisit l'effet « Réinitialise une fois les
  délais d'attente de toutes les compétences » (réservé à `manage_shop`).
- Chaque exemplaire acheté s'utilise une fois depuis la page d'une simulation.

## Vitrine
- Le vendeur d'un objet peut le supprimer (bouton 🗑 dans la vitrine et dans
  « Mes objets en vente ») : il disparaît, les achats passés restent.

## Prérequis des quêtes
- Formulaire de quête : Intelligence, Puissance, Technique et Puissance
  globale minimum. Affichés sur la carte de la quête ; le bouton « Prendre la
  mission » est grisé tant qu'ils ne sont pas atteints, et la base refuse
  l'inscription (un responsable des quêtes peut inscrire quelqu'un d'autre).
