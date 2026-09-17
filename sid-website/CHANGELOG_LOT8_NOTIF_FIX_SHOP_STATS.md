# Notifications ancrées dynamiquement + stats par objet de boutique — résumé

## 1. Notifications enfin bien positionnées

Le portail (lot précédent) réglait le débordement, mais le panneau utilisait
encore des offsets fixes (`top-16 right-3`) qui ne "collaient" pas
forcément à la cloche — notamment sur mobile, où le menu déroulant contient
désormais beaucoup d'onglets et peut être très long.

**Correctif** : la position du panneau est maintenant calculée dynamiquement
à partir des coordonnées réelles du bouton cloche à l'écran
(`getBoundingClientRect()`), recalculée à chaque ouverture et si la fenêtre
est redimensionnée ou la page défile. Il apparaît désormais toujours
directement sous la cloche, où qu'elle soit affichée.

Fichier modifié : `src/components/NotificationBell.tsx`.

## 2. Statistiques par objet de boutique

Migration **`0031_shop_item_stats.sql`** : nouvelle fonction
`get_shop_item_stats(item_id)`, réservée au créateur de l'objet (le
"vendeur") ou à `manage_shop`. Renvoie :
- quantité totale vendue
- revenu total généré
- nombre d'acheteurs uniques
- évolution des ventes (quantité + revenu par semaine, 8 dernières semaines)

Dans `/dashboard/shop` → "Mes objets en vente", un bouton "📊 Statistiques de
vente" par objet ouvre un panneau avec ces chiffres + un petit graphique en
barres des ventes hebdomadaires (même style visuel que les graphiques du
dashboard admin).

Fichiers : `supabase/migrations/0031_shop_item_stats.sql` (nouveau),
`src/types/stats.ts` (ajout de `ShopItemStats`), `src/app/dashboard/shop/page.tsx`
(bouton + panneau de stats).
