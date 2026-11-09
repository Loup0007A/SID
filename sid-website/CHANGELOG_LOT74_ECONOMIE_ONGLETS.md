# Lot 74 — Administration → Économie en onglets

Aucune migration.

La page empilait tout : files à valider, banque centrale, impôts, ventes des
entreprises, puis trois listes de cartes, une par membre et par réglage
(solde, renommée, niveaux). Elle mesurait environ 6 700 px avec 7 membres, et
grandissait à chaque inscription. Chaque onglet tient maintenant sur un écran.

## Onglets

- **À traiter** : retraits à valider, frais d'entreprise, raccourci vers les
  litiges. Un compteur sur l'onglet et sous le titre indique ce qui attend.
- **Banque centrale** : indicateurs, adaptation automatique, lien vers la
  réforme monétaire.
- **Impôts et amendes** :
  - caisse commune et TVA ;
  - avis d'impôt, avec annulation ;
  - amende à infliger.
- **Membres** : un seul tableau (solde, renommée, salaire, puissance).
  - Tri par colonne, recherche, 20 membres par page.
  - Un clic sur un membre ouvre sous sa ligne :
    - l'ajustement du solde (avec aperçu du nouveau solde) ;
    - la renommée ;
    - le salaire (définir, modifier, suspendre) ;
    - les cinq niveaux.
  - En tête de l'onglet : argent total des membres, salaires actifs (équivalent
    par semaine), bouton « Verser les salaires dus ».
- **Entreprises** : ventes de la semaine dans un tableau, les plus en retard
  d'abord.

L'onglet ouvert est gardé dans l'adresse (`#membres`, `#entreprises`…). Les
liens des notifications (`#retraits`, `#frais`) ouvrent « À traiter ».
Sur mobile, la barre d'onglets défile et les colonnes secondaires sont
masquées.

`PowerAdminSection` est supprimé : ses réglages sont dans la fiche du membre.
