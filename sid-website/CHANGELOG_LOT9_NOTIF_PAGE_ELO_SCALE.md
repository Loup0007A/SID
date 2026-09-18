# Notifications en page dédiée + Elo mis à l'échelle — résumé

## 1. Notifications : plus de menu déroulant, une vraie page

Après plusieurs allers-retours sur le positionnement (débordement, ancrage
qui ne suivait pas le scroll…), la solution la plus robuste est simplement
de ne plus avoir de panneau positionné du tout : la cloche est maintenant
un lien direct vers `/dashboard/notifications`, exactement comme les autres
onglets du site.

- `src/components/NotificationBell.tsx` : simple `<Link>` avec juste le
  badge de compteur non lu, tenu à jour en direct (Realtime + repli en
  sondage). Plus aucune logique de positionnement.
- `src/app/dashboard/notifications/page.tsx` **(nouveau)** : liste complète
  des notifications, "Tout marquer lu", clic = marque comme lue + navigue
  vers le lien associé.

## 2. Renommée : le facteur Elo s'ajuste au "poids" de la renommée en jeu

Migration **`0032_reputation_elo_scaling.sql`**.

Le facteur K (32 par défaut, comme les classements Elo classiques) est
maintenant multiplié par un facteur d'échelle basé sur la renommée moyenne
des membres qui en ont déjà (> 0) :

```
facteur = 1 + (renommée moyenne des membres > 0) / 1000
K_effectif = 32 × facteur
```

- Personne n'a encore de renommée → facteur = 1 → comportement Elo classique
  (gains/pertes de quelques points).
- Ton exemple (2 membres, 100 000 de renommée à eux deux, donc 50 000 de
  moyenne) → facteur ≈ 51 → K_effectif ≈ 1632. Un gain qui aurait été de 16
  points devient de l'ordre de 800 à 1600 selon la difficulté de la quête
  par rapport au niveau du joueur (upset improbable = proche du haut de la
  fourchette, victoire "attendue" = proche de 0).

Le calcul reste un vrai Elo (l'écart entre le rang de la quête et le niveau
du joueur détermine toujours la part gagnée/perdue) — seule l'**échelle**
grossit avec la communauté, pour que la renommée reste significative même
quand elle s'accumule. Si tu veux une progression plus ou moins agressive,
les deux nombres à ajuster sont dans `compute_reputation_delta` (le `32.0`
de base) et `get_reputation_scale_factor` (le diviseur `1000.0`).

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/components/NotificationBell.tsx` | Simplifié en lien direct |
| `src/app/dashboard/notifications/page.tsx` **(nouveau)** | Page de notifications complète |
| `supabase/migrations/0032_reputation_elo_scaling.sql` **(nouveau)** | Mise à l'échelle du calcul de renommée |
