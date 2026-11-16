# Lot 83 — Organigramme

## À lancer dans Supabase

Dossier Central : `supabase/migrations/0100_organigramme.sql`, après 0099.
Rejouable. L'organigramme existant est conservé ; seul l'ordre des postes
est remis à plat (0, 1, 2… sous chaque supérieur, dans l'ordre actuel).

## Ce qui change pour tout le monde

- **Cartes de poste** : titre, titulaire (avatar et pseudo, lien vers son
  dossier), mission, équipe rattachée, « Système indépendant ». Un poste
  vacant a un cadre en pointillés. Ton poste porte « Toi ».
- **Deux vues sur ordinateur** :
  - « Arbre » : de haut en bas, traits de liaison continus ;
  - « Liste » : en retrait.

  Sur téléphone, toujours la Liste. Le choix est retenu.
- **Arbre plus étroit** : des sous-postes qui n'ont eux-mêmes aucun
  sous-poste s'empilent sous leur supérieur au lieu de s'aligner. Un arbre
  plus large que l'écran défile, et s'ouvre centré sur le sommet.
- **Replier une branche** : bouton « N sous-postes » sur la carte, retenu
  d'une visite à l'autre ; « Tout déplier » en haut.
- **« Ton poste : … »** : déplie le chemin jusqu'à ton poste, le centre et
  le fait briller.
- **Comptes invisibles** : leur poste apparaît vacant pour les autres
  membres, comme avant.

## Gérer l'organigramme (permission « Organigramme »)

Bouton « Modifier », puis sur chaque carte :
- **‹ ›** (ou **˄ ˅** quand les postes sont empilés) : changer l'ordre ;
- **+** : ajouter un sous-poste ;
- **crayon** : tout modifier dans une fenêtre :
  - titre (60 caractères) ;
  - mission (240) ;
  - titulaire ;
  - équipe ;
  - supérieur. La liste n'y propose ni le poste lui-même ni ses
    sous-postes, et la base refuse aussi toute boucle.

« + Poste au sommet » crée un poste sans supérieur.

### Suppression

Dans la fenêtre de modification, avec confirmation. **Ses sous-postes ne
sont plus effacés** : ils remontent d'un niveau, à la place du poste
supprimé.

### Journal d'audit

Créations, modifications (titre, titulaire, déplacement) et suppressions
y sont notées.

### Autres corrections

- Un membre titulaire d'un poste, ou une équipe rattachée, peut de nouveau
  être supprimé : le poste reste, vacant ou sans équipe.
- Plus d'écriture directe dans la table : tout passe par `org_node_save`,
  `org_node_move` et `org_node_delete`, qui vérifient les droits et les
  données.

## Réglages → CSS personnalisé → Organigramme

L'aperçu montre la nouvelle carte. Classes utilisables : `org-card-title`
(toujours aussi `font-display`), `org-card-holder`, `org-card-name`,
`org-card-mission`, `org-card-team`. Un CSS déjà enregistré continue de
s'appliquer à la carte entière.
