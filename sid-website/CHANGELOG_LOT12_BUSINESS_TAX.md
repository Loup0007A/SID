# Entreprises, bourse, impôts & TVA — résumé

## Où trouver quoi

- **`/dashboard/bank`** (tout le monde) : portefeuille, épargne, emprunt
  personnel, **+ nouvelle section Bourse** (acheter/vendre des actions de
  n'importe quelle entreprise, graphique de cours, valeur estimée).
- **`/dashboard/business`** (permission `entreprise` uniquement) : créer
  une entreprise, gérer sa trésorerie (apport/retrait) et ses prêts
  d'entreprise. J'ai déplacé la bourse vers la Banque en relisant ta
  phrase : *"il y a un système d'action **dans la banque**"* — donc
  accessible à tous les investisseurs, pas seulement aux fondateurs.

## Migration `0034_business_system.sql`

- Nouvelle permission `entreprise` (à cocher sur un rôle depuis
  `/dashboard/admin/roles`, comme les autres).
- Table `businesses` : trésorerie, dette, nombre d'actions, actions encore
  disponibles à l'achat, cours actuel.
- Marché simplifié (choix par défaut, cf. message précédent) : chaque
  achat/vente se fait **directement contre la trésorerie de l'entreprise**
  (pas de mise en relation acheteur/vendeur) — le cours bouge d'environ 1%
  par action échangée (réglable : `app_config.business_share_price_impact`).
- Prêt d'entreprise : même mécanique que la dette personnelle (0033), mais
  sur la trésorerie de l'entreprise, gérable par le fondateur ou
  `manage_economy`.
- `list_businesses()`, `get_business_price_history()`,
  `get_my_shareholdings()` pour l'affichage.

## Migration `0035_taxes_and_vat.sql`

- **TVA** (5% par défaut) : prélevée sur chaque vente en boutique, sur la
  part du vendeur (l'acheteur paie toujours le prix affiché). Alimente une
  caisse commune (`tax_pool`).
- **Impôt hebdomadaire** (2%/semaine par défaut) : prélevé sur le solde
  positif de chaque membre, ajouté à la même caisse.
- **Redistribution automatique chaque semaine** (rattrapage si personne ne
  s'est connecté depuis plusieurs semaines, même logique que les
  salaires) : **80% aux admins** (fondateur ou permission `manage_users`,
  à parts égales), **20% aux entreprises** (à parts égales entre elles).
  Se déclenche à la connexion de n'importe quel membre, intégré à
  `process_daily_economy()` — pas de job planifié requis.
- Aperçu visible dans `/dashboard/admin/economy` : caisse actuelle, taux,
  prochaine échéance.

## Réglages ajustables (table `app_config`)

```sql
update public.app_config set value = '0.07' where key = 'vat_rate'; -- 7% de TVA
update public.app_config set value = '0.03' where key = 'weekly_wealth_tax_rate';
update public.app_config set value = '0.7' where key = 'tax_admin_share';
update public.app_config set value = '0.3' where key = 'tax_business_share';
update public.app_config set value = '0.02' where key = 'business_share_price_impact'; -- impact du cours par action
update public.app_config set value = '500000' where key = 'max_business_debt_principal';
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0034_business_system.sql` **(nouveau)** | Entreprises, actions, prêts |
| `supabase/migrations/0035_taxes_and_vat.sql` **(nouveau)** | TVA + impôt + redistribution |
| `src/types/business.ts` **(nouveau)** | Types `Business`, historique de cours, actions détenues, statut fiscal |
| `src/app/dashboard/business/page.tsx` **(nouveau)** | Création + gestion d'entreprise |
| `src/types/database.ts` | Permission `entreprise` ajoutée |
| `src/app/dashboard/admin/roles/page.tsx` | `entreprise` ajoutée à la liste des permissions cochables |
| `src/app/dashboard/layout.tsx` | Liens "Banque" et "Entreprise" (ce dernier réservé à la permission) |
| `src/app/dashboard/bank/page.tsx` | Section Bourse ajoutée |
| `src/app/dashboard/admin/economy/page.tsx` | Aperçu de la caisse d'impôts |
