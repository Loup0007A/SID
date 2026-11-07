# Lot 69 — Économie réelle : banque centrale, bourse à carnet d'ordres, impôts à payer, frais d'entreprise, litiges

## À lancer dans Supabase

Dans l'ordre, après 0083 (toutes rejouables) :

1. `supabase/migrations/0084_economie_reelle.sql`
2. `supabase/migrations/0085_bourse_carnet.sql`
3. `supabase/migrations/0086_litiges_frais.sql`

## Banque centrale (0084, page « Banque centrale »)

- Chaque achat payé est relevé : boutique, cadeaux, enchères adjugées,
  achats de la population.
- Une fois par jour, la base calcule :
  - l'**indice des prix** : prix payé de chaque objet comparé à son prix de
    référence, pondéré par la dépense sur 14 jours. Un objet nouveau entre au
    niveau du jour. Le relevé est lissé quand il y a peu d'achats ;
  - le **cours du zéni** = 10 000 ÷ indice (100 au départ) ;
  - la masse monétaire (portefeuilles, épargne, trésoreries, population,
    caisse commune), les dettes, l'inflation et la croissance monétaire sur
    30 jours.
- **Adaptation automatique** (`app_config.econ_auto`, coupable depuis
  Administration → Économie) :
  - taux directeur hebdomadaire par la règle de Taylor (cible 1 % sur
    30 jours). Il fixe l'intérêt de l'épargne ; l'emprunt coûte 1 point de
    plus par semaine ;
  - taux de l'impôt sur la fortune et sur les sociétés ;
  - abattement, seuil de faillite et plafonds d'emprunt multipliés par
    l'indice ;
  - salaires de la population indexés sur les prix.
  Les salaires et récompenses fixés par les admins ne bougent pas.
- La page publique `/dashboard/economie` montre :
  - le cours du zéni, l'indice, l'inflation et les taux ;
  - la répartition de la monnaie et le panier des objets les plus achetés ;
  - ce qui suit le cours, et le détail du calcul.

## Impôts à payer à la main (0084)

- Les impôts ne sont plus prélevés. Chaque semaine arrive un avis :
  - **impôt sur la fortune** : portefeuille + épargne au-delà de
    l'abattement, payé depuis le portefeuille ou l'épargne (Banque →
    « Impôts et amendes ») ;
  - **impôt sur les sociétés** : bénéfice de la semaine (ventes − salaires,
    intérêts, frais, litiges), payé par le fondateur depuis la trésorerie
    (page Entreprise).
- Un avis se paie sous 7 jours, avec un rappel 2 jours avant.
- Un avis impayé à l'échéance :
  - est saisi avec 10 % de majoration (l'épargne d'abord, puis le
    portefeuille ou la trésorerie), même si le solde passe en négatif ;
  - compte comme une faute : +10 % sur tous les impôts du membre pendant
    2 mois, cumulable jusqu'à +200 %.
- Côté admin : vue des avis en attente, payés et saisis, avec annulation
  possible.
- La TVA reste automatique.

## Bourse à carnet d'ordres (0085, page « Bourse »)

- Les actions s'échangent entre investisseurs par **ordres à cours limité**
  (valables 1, 7 ou 30 jours) ou **au marché** (immédiat, 5 % de marge au
  plus).
- Priorité au meilleur prix, puis au plus ancien ordre. L'échange se fait au
  prix de l'ordre déjà posé. Le cours est le prix du dernier échange.
- Toutes les heures, la **population tient le marché** :
  - elle affiche des prix d'achat et de vente autour de son estimation
    (cours, fondamentaux, actualités) ;
  - l'écart est plus large pour une petite entreprise ;
  - elle passe des ordres qui font bouger le cours.
- L'entreprise propose ses actions pas encore vendues un peu au-dessus du
  cours.
- Pas d'échange avec soi-même. Les actions mises en vente sont bloquées. La
  détention minimale de 30 min et les frais restent : 0,2 % de chaque côté,
  plus 0,5 z par action achetée.
- **Coupe-circuit** : un échange à plus de 20 % de la clôture de la veille
  suspend la cotation une heure.
- **Indice SID** : moyenne pondérée par la capitalisation, base 1 000.
- Bougies journalières, historique des échanges, carnet avec profondeur.
  Toucher un prix du carnet le reprend dans le formulaire.
- La population reçoit aussi les dividendes et sa part en cas de
  liquidation.
- Banque → « Mes actions » renvoie vers la bourse.

## Objet passé au nom d'une entreprise (0086)

- Boutique → « Mes objets en vente » → « Transférer ». Un objet vendu au nom
  de son créateur passe à l'une de ses entreprises : les ventes suivantes
  vont à la trésorerie. Pas de retour possible.
- `shop_items.business_id` ne se modifie plus à la main, sauf par un admin
  « Économie ».

## Frais d'entreprise (0086)

- Dans la fiche d'un objet, le fondateur ou un employé peut cliquer sur
  « Faire payer par l'entreprise » et indiquer un motif. La somme est mise
  de côté sur la trésorerie.
- Un admin « Économie » valide ou refuse (Administration → Économie →
  « Frais d'entreprise ») :
  - validé : l'achat passe au prix du jour, l'objet arrive dans les achats
    du demandeur avec « Payé par … », et l'écart de prix est réglé sur la
    trésorerie ;
  - refusé ou annulé : la somme revient en trésorerie.
- Interdit : acheter un objet de sa propre entreprise, ou son propre objet.
- Une demande est signalée quand le vendeur est lié à l'entreprise.
- Un admin ne valide pas les frais de sa propre entreprise s'il existe un
  autre admin.
- Une fermeture ou une faillite annule d'abord les demandes en attente.

## Litiges et amendes (0086, page « Litiges »)

- **Ouvrir un litige** contre un membre ou une entreprise (c'est son
  fondateur qui répond). On indique une catégorie, un objet, les faits et la
  somme réclamée.
- Frais de dossier : 25 z de départ, indexés sur le cours du zéni. Ils sont
  remboursés si le litige aboutit.
- Trois litiges ouverts au plus par membre.
- Les parties échangent dans un fil. Les juges (admins « Économie » ou
  « Membres ») peuvent y poser des questions.
- Issues possibles :
  - **accord** : le défendeur paie la somme réclamée ;
  - **retrait** par le demandeur ;
  - **décision** d'un juge qui n'est pas partie au litige : plainte fondée
    (somme accordée prise au défendeur, même en négatif) ou rejetée, avec,
    au besoin, une amende pour l'une des parties.
- **Amendes** : un admin peut en infliger une à un membre ou à une
  entreprise (Administration → Économie). Elle suit le circuit des impôts :
  7 jours pour payer, sinon saisie +10 % et une faute.
- Une amende d'entreprise ne réduit pas le bénéfice imposable.

## Autres

- Notifications : nouveaux types `tax`, `dispute` et `market`, avec leurs
  icônes. Une fois les ordres exécutés, la notification est regroupée.
- Menu : Bourse, Banque centrale, Litiges, avec deux nouvelles icônes.
- Le tutoriel, l'aide des pages et le guide sont à jour.
- Une liquidation volontaire paie aussi la part de la population. Avant,
  cette part disparaissait.

## Vérifié

- 155 scénarios SQL sur une copie locale de la base :
  - 0084 (38) : indice, politique monétaire, avis, saisie, fautes, plafond,
    impôt sur les sociétés ;
  - 0085 (37) : premier placement, ordres limités, teneur de marché,
    coupe-circuit, séances rattrapées, échéances, fermeture ;
  - 0086 (80) : transfert, frais (droits, prix du jour, refus, annulation,
    fermeture), amendes (paiement, saisie sur trésorerie), litiges (accord,
    retrait, décision, amende, limites, confidentialité).
- Lots 67 et 68 rejoués : faillites, retraits et rapports de mission
  inchangés.
- Une simulation de 60 séances de bourse : le cours converge de 25 vers la
  valeur des fondamentaux (≈ 100).
- Parcours dans le navigateur :
  - achat sur le carnet, ordre limité posé puis annulé ;
  - avis d'impôt payé depuis la banque ;
  - demande de frais depuis la boutique ;
  - file des admins ;
  - litige vu par le demandeur et par le juge ;
  - bourse sur mobile.
- `npm run build` sans erreur.
