# Gestion complète d'entreprise ("de A à Z") — résumé

Ce lot corrige le manque : la première version de l'onglet Entreprise ne
permettait que trésorerie + prêts. Voici ce qui manquait et qui est
maintenant là.

## Migration `0036_business_full_management.sql`

- **Modifier les infos** de l'entreprise (nom, description) à tout moment.
- **Employés** : embaucher un membre avec un titre et un salaire (n'importe
  quelle fréquence, comme les salaires classiques), versé **automatiquement
  par la trésorerie de l'entreprise** (intégré au traitement quotidien
  unifié — se déclenche à la connexion de n'importe qui, rattrape les
  échéances manquées, s'arrête proprement si la trésorerie ne suit plus
  plutôt que de la mettre en négatif). Licenciement possible à tout moment.
- **Objets de boutique rattachés à l'entreprise** : à la création d'un
  objet, tu peux maintenant le rattacher à une de tes entreprises — le
  produit des ventes (TVA déduite) va dans sa trésorerie au lieu de ton
  portefeuille personnel. C'est la vraie "activité commerciale" de
  l'entreprise.
- **Dividendes** : verse un montant depuis la trésorerie, réparti
  automatiquement entre tous les actionnaires au prorata de leurs actions.
- **Registre complet** (`business_transactions`) consultable depuis la
  page : chaque mouvement de trésorerie (ventes, salaires, emprunts,
  dividendes, intérêts, apports...) y apparaît.
- **Fermeture / liquidation** : la trésorerie restante est répartie entre
  les actionnaires au prorata (comme une vraie liquidation), l'entreprise
  disparaît du marché, les employés sont licenciés. Bloqué tant qu'il
  reste une dette à rembourser.
- "Mes emplois" : si tu es employé d'une entreprise (pas forcément la
  tienne), tu vois ton poste et ton salaire.

## Fichiers

| Fichier | Changement |
|---|---|
| `src/types/business.ts` | `Business.is_closed`, nouveaux types `BusinessEmployee`, `MyEmployment`, `BusinessTransaction` |
| `src/types/database.ts` | `ShopItem.business_id` ajouté |
| `src/app/dashboard/business/page.tsx` | Réécrite en entier : édition, employés, dividendes, registre, fermeture |
| `src/app/dashboard/shop/page.tsx` | Sélecteur "Rattacher à une entreprise" à la création d'un objet |

Tout le reste (bourse sur `/dashboard/bank`, prêts d'entreprise, TVA/impôts)
reste inchangé par rapport au lot précédent.
