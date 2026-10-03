# Augmentation de capital selon l'activité — résumé

Fichiers **modifiés uniquement**, à copier par-dessus ton repo (mêmes
chemins), à la suite du lot précédent.

## Ce qui change

Une entreprise dont le **chiffre d'affaires des 7 derniers jours** dépasse
**5 % de sa capitalisation boursière** (réglable) reçoit automatiquement
**2 % d'actions neuves** (réglable), ajoutées au stock disponible à
l'achat (`shares_in_treasury`) — comme une vraie entreprise qui lève plus
de capital quand elle grossit. Vérifié **une fois par semaine** par
entreprise (pas à chaque tick), intégré au traitement déjà déclenché à la
connexion de n'importe quel membre — toujours aucun job planifié.

Ça n'enrichit ni ne dilue personne d'un coup de baguette magique : les
actions neuves ne valent quelque chose que si quelqu'un les achète ensuite
— l'argent versé entre alors dans la vraie trésorerie de l'entreprise, ce
qui fait remonter sa valeur intrinsèque via les fonds propres, exactement
le même calcul que pour le reste du marché (voir le lot sur la bourse
réaliste).

Testé : une entreprise active grossit de 2 % exactement au bon rythme
(une fois par semaine, jamais plus souvent même si on redéclenche le
traitement juste après), une entreprise inactive ne grossit jamais.

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0045_business_activity_growth.sql` **(nouveau)** | `process_business_growth()`, intégrée à `process_daily_economy()` |
| `src/types/business.ts` | `MarketSettings` : 2 nouveaux champs (seuil, % d'augmentation) |
| `src/app/dashboard/business/page.tsx` | Note explicative sous les stats de chaque entreprise |
| `src/app/dashboard/bank/page.tsx` | Valeurs par défaut du type `MarketSettings` mises à jour (sinon erreur de build, comme la dernière fois) |

## Réglages (table `app_config`)

```sql
update app_config set value = '0.08' where key = 'business_growth_revenue_threshold_pct'; -- 8% au lieu de 5%
update app_config set value = '0.03' where key = 'business_growth_share_increase_pct';     -- +3% au lieu de +2%
update app_config set value = '14'   where key = 'business_growth_min_interval_days';      -- toutes les 2 semaines
```
