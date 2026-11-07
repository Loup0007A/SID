# Lot 70 — Réforme monétaire

## À lancer dans Supabase

`supabase/migrations/0087_reforme_monetaire.sql`, après 0084 à 0086
(rejouable).

## Ce que c'est

Quand les prix ont trop monté, une réforme multiplie tous les montants du
S.I.D. par un même facteur (× 0,8 pour −20 %). Le pouvoir d'achat de chacun
ne change pas ; le cours du zéni remonte.

Page : Administration → **Réforme monétaire** (admins « Économie »), aussi
accessible depuis Administration → Économie.

## Préparer une réforme

1. **De combien ?** On choisit de baisser ou d'augmenter, et le pourcentage
   (champ ou curseur).
   - Le bouton « Ramener le zéni à 100 » calcule le pourcentage qui annule
     la hausse des prix depuis le départ.
   - Une phrase montre l'effet : « un objet à 1 000 z passe à 800 z… », et
     le cours du zéni avant / après.
2. **Qu'est-ce qui change ?** 13 cartes à activer ou désactiver. Chacune
   donne le nombre de montants et le total avant → après (ou des exemples
   de prix) :
   - portefeuilles, épargne, emprunts ;
   - trésoreries et cours des actions (carnet d'ordres et historique de
     bourse ajustés, comme après une division d'actions) ;
   - salaires des membres et des employés ;
   - prix de la boutique ; marché noir, Envers et montures ; enchères en
     cours ;
   - récompenses des quêtes ouvertes ;
   - population simulée ; caisse commune ;
   - montants en attente : retraits, frais d'entreprise, avis d'impôt et
     amendes, litiges ;
   - seuils et tarifs : prime d'intégration, mise de départ, frais de
     bourse, seuils d'alerte, prix de l'arène.
3. **Sauf…** On ajoute des exceptions par recherche :
   - une quête : sa récompense ne bouge pas ;
   - un objet : son prix et ses enchères ne bougent pas ;
   - un membre : son portefeuille, son épargne, sa dette et son salaire ne
     bougent pas ;
   - une entreprise : sa trésorerie, sa dette, son action et ses salaires
     ne bougent pas.
   Pour garder *toutes* les quêtes (ou tous les objets), on désactive leur
   carte.
4. **Pourquoi ?** Le motif, lu par tous les membres. Les prix peuvent être
   arrondis au zéni (99,99 z × 0,8 donne 80 z).

L'aperçu se recalcule à chaque réglage. La réforme s'enregistre en
brouillon, puis on l'envoie pour vérification.

## Vérification obligatoire

- Rien ne change tant qu'un admin « Économie » n'a pas validé la réforme :
  - si d'autres admins « Économie » existent, ce doit être l'un d'eux, et
    ils sont prévenus ;
  - si son auteur est le seul admin « Économie », il passe lui-même par
    l'écran de vérification.
- Le vérificateur voit l'aperçu recalculé au moment de sa lecture et coche
  trois points (ampleur, catégories et exceptions, montants). Il valide, ou
  refuse avec une note que l'auteur reçoit.
- Modifier une réforme déjà envoyée la renvoie en brouillon. Une validation
  sur une version périmée est refusée.
- Validée, la réforme s'applique en une seule transaction :
  - chaque membre reçoit une notification avec son portefeuille avant /
    après, et une ligne « Réforme monétaire n° … » dans son historique ;
  - la décision est inscrite au journal d'audit.
- Une réforme appliquée peut servir de base à la **réforme inverse** (même
  périmètre, facteur inverse), qui repasse par la vérification.

## Banque centrale

- La banque centrale mesure l'effet réel de la réforme sur les prix et sur
  la monnaie, exceptions comprises. Elle en tient compte :
  - l'inflation, la croissance monétaire et les salaires de la population
    ne réagissent pas à la réforme ;
  - l'indice des prix change simplement d'échelle.
- Les prix relevés des 14 derniers jours sont ramenés à la nouvelle
  échelle.
- Avec l'adaptation automatique, l'abattement, le chiffre d'affaires
  minimum et les plafonds d'emprunt suivent déjà l'indice : la réforme les
  laisse à la banque centrale.
- La page Banque centrale liste les réformes appliquées.
- Une réforme ne déclenche ni « Argent reçu », ni alerte de gros mouvement.
  Elle ne compte pas dans le bilan « Depuis ta dernière visite ».

## Vérifié

- 57 scénarios SQL :
  - droits, brouillon, exceptions invalides ;
  - aperçu ;
  - vérification par un autre admin, version périmée, refus avec note,
    admin seul ;
  - application catégorie par catégorie, exceptions intactes, arrondis,
    enchère en cours, montants en attente, réglages ;
  - indice et inflation après réforme, notifications, alertes, journal,
    réforme inverse.
- Lot 69 rejoué (155 scénarios).
- Parcours dans le navigateur :
  - préparation par un admin (−20 %, population exclue, une quête en
    exception) ;
  - soldes inchangés avant la validation ;
  - vérification et validation par un second admin ;
  - application ;
  - page publique et notification d'un membre.
- `npm run build` sans erreur.
