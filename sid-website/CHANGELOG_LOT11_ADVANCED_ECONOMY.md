# Économie avancée : dette, banque, salaires globaux, notifications — résumé

## Migration `0033_advanced_economy.sql`

### Dette (solde négatif + intérêts)
- Le solde ne peut PAS devenir négatif par accident (achat, financement de
  quête) : ces actions restent bloquées si les fonds sont insuffisants,
  comme avant.
- Le solde négatif apparaît uniquement via un **emprunt volontaire** à la
  banque (`borrow_money`) : le montant est crédité immédiatement, et
  enregistré comme "principal" de dette (`wallets.debt_principal`).
- Chaque jour (traité à la connexion de n'importe qui, voir plus bas), des
  intérêts sont calculés sur ce principal (2%/jour par défaut) et
  **directement prélevés sur le solde** — c'est ce prélèvement qui peut le
  faire passer en négatif si l'argent emprunté a déjà été dépensé.
- **Tant que le solde est négatif, les achats en boutique sont bloqués**
  (`purchase_item` vérifie `balance >= 0` avant toute chose).
- `repay_loan` réduit le principal (et donc les futurs intérêts) ; le
  déblocage des achats suit dès que le solde remonte à 0 ou plus (pas
  besoin d'avoir fini de rembourser tout le principal).
- Plafond d'emprunt cumulé : 50 000 Cr. par défaut.

### Banque (épargne)
- Nouvelle table `bank_accounts`, séparée du portefeuille.
- Déposer transfère du portefeuille vers l'épargne et **relance le
  décompte des intérêts** (comme demandé : "tant qu'on ne dépose pas à
  nouveau").
- Intérêts : 1%/jour par défaut, composés, avec rattrapage si le membre
  n'a pas visité le site depuis plusieurs jours.
- Retirer transfère l'épargne vers le portefeuille sans relancer le
  décompte.

### Salaires "tous versés à la connexion"
- `process_daily_economy()` (appelée par n'importe quel membre qui se
  connecte, dans `layout.tsx`) traite désormais les salaires **de tout le
  monde**, pas seulement de la personne connectée — exactement ce que tu
  as demandé. Elle traite aussi, dans la foulée, les intérêts bancaires et
  de dette de tout le monde.
- Remplace l'ancien `check_and_pay_my_salary` (qui ne traitait que son
  propre salaire) dans `layout.tsx`.

### Notifications "argent reçu"
- Nouveau déclencheur générique sur `transactions` : tout crédit (montant
  positif) génère une notification, sauf les mouvements internes
  (dépôt/retrait bancaire, qui ne sont pas vraiment de l'"argent reçu").
  Couvre salaire, récompense de quête, vente en boutique, ajustement
  admin, intérêts bancaires, emprunt — sans avoir à modifier chaque
  fonction individuellement.
- Nouveau type `money_received` (+ `salary_paid` désormais réellement
  utilisé, il ne l'était pas avant).

## Réglages ajustables (table `app_config`, sans redéploiement)

```sql
update public.app_config set value = '0.03' where key = 'debt_daily_interest_rate'; -- 3%/jour
update public.app_config set value = '0.015' where key = 'bank_daily_interest_rate'; -- 1.5%/jour
update public.app_config set value = '100000' where key = 'max_debt_principal';
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/app/dashboard/bank/page.tsx` **(nouveau)** | Portefeuille + épargne + emprunt/remboursement |
| `src/types/database.ts` | `Wallet.debt_principal` + nouveau type `BankAccount` |
| `src/types/notifications.ts` | Types `quest_failed` et `money_received` ajoutés |
| `src/app/dashboard/notifications/page.tsx` | Icône pour `money_received` |
| `src/app/dashboard/layout.tsx` | Lien "Banque" + appel `process_daily_economy()` |

---

## Questions avant de construire "Entreprise" + actions en bourse

Cette partie touche à des mécaniques financières qu'il vaut mieux bien
cadrer avant de coder (se tromper coûterait cher à reprendre une fois des
entreprises créées) :

1. **Une entreprise par membre, ou plusieurs ?** Est-ce que chaque membre
   avec la permission "Entreprise" a automatiquement UNE entreprise, ou
   doit-il en créer une (comme un objet de boutique) ? Peut-on être
   plusieurs fondateurs/associés sur une même entreprise ?

2. **Cours de l'action — indexé sur quoi ?** Deux options principales :
   - **(a)** Indexé sur les fonds réels de l'entreprise (valeur totale ÷
     nombre d'actions émises) — prévisible, pas de spéculation possible.
   - **(b)** Fonds réels + une composante de marché (l'achat/la vente fait
     bouger le prix, comme une vraie bourse) — plus vivant, mais demande
     un vrai mécanisme d'échange (carnet d'ordres simplifié ou形 AMM).
   Je penche pour (b) en plus simple (offre/demande basique), mais dis-moi.

3. **Qui peut acheter des actions, et où va l'argent ?**
   - À l'émission (IPO) : l'argent va au fonds de l'entreprise.
   - Ensuite, quand un membre revend ses actions à un autre : l'argent
     va-t-il au vendeur (marché secondaire, normal) ou une partie repart
     à l'entreprise (commission) ?

4. **Prêts d'entreprise** : même mécanique que les prêts personnels
   (solde négatif + intérêts) mais sur le compte de l'entreprise plutôt
   que le portefeuille personnel du fondateur ? Ou l'entreprise emprunte
   et c'est le·s fondateur·s qui sont personnellement responsables si elle
   ne rembourse pas ?

5. **Nombre d'actions et prix de départ** : fixés par le créateur de
   l'entreprise à sa création, ou une valeur par défaut identique pour
   toutes (ex : 1000 actions à 10 Cr.) ?

Dès que tu précises ces points, je construis la partie "Entreprise" (fonds
séparés, prêts, page dédiée) et le système d'actions dans la banque
(graphique de cours + valeur estimée).
