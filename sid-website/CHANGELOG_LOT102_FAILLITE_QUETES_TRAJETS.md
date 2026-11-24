# Lot 102 : faillites réalistes, quêtes et trajets programmés

Migrations (site central) : `0131_faillite_cessation_paiements.sql`,
`0132_quetes_programmees.sql`, `0133_devlog_faillite_quetes_trajets.sql`.
Migration Cartographie : `0123_trajets_programmes.sql` (dépôt sid-map).

Ordre conseillé : 0123 côté Carto, puis 0131, 0132, 0133 ici (même base).
0132 lance les trajets programmés seulement si 0123 est en place : l'ordre
inverse marche aussi.

## Faillites : cessation de paiements

Avant, une semaine de ventes sous un seuil liquidait l'entreprise, même avec
une trésorerie pleine. Désormais :

- **Frais de fonctionnement** chaque semaine, payés par la trésorerie (qui
  peut passer sous zéro). Montant commun à toutes les entreprises :
  `taux × masse monétaire ÷ membres actifs`, 10 z au moins. Taux par défaut
  3 %, réglable de 0 à 50 % dans **Administration → Économie** (aperçu du
  montant avant d'enregistrer). L'argent va à la population simulée.
- **Redressement judiciaire** dès que la trésorerie passe sous zéro (après
  remise des retraits en attente) : 7 jours. Pendant ce temps : cotation
  suspendue, ni retrait, ni dividende, ni emprunt, ni frais d'entreprise, ni
  fermeture. Les ventes et les apports du fondateur continuent. Sauvée dès que
  la trésorerie couvre une semaine de frais, ou à l'échéance si elle est à
  zéro ou plus.
- **Liquidation judiciaire** sinon : l'actif paie l'État (impôts et amendes
  dus), puis la banque (dette), puis les actionnaires au prorata. Le fondateur
  ne peut plus créer d'entreprise pendant 30 jours.
- **Avertissements** : 2 jours avant des frais non couverts ; à l'ouverture
  de la procédure, à J-2 et à l'issue (fondateur, actionnaires, admins
  Économie).
- La fiche de l'entreprise montre les frais, les semaines couvertes et la
  procédure en cours. L'administration Économie liste la santé de toutes les
  entreprises.

## Quêtes programmées

Champ « Publier le » dans le formulaire de quête (date et heure). Avant, la
quête n'est visible que par son auteur et les admins Quêtes, avec le badge
« Programmée » ; personne ne peut s'y inscrire. Elle apparaît à la seconde
près, et les membres sont prévenus dans la minute (type de notification
« Nouvelles quêtes », réglable). L'échéance doit tomber après la publication.

## Trajets programmés (Cartographie)

Voir `CHANGELOG_LOT102_TRAJETS_PROGRAMMES.md` dans le dépôt sid-map.
