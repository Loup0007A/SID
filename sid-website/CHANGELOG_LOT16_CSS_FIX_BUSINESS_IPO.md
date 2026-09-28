# Correctif CSS personnalisé + création d'entreprise pilotée par la mise de départ

Fichiers **modifiés uniquement**, à copier par-dessus ton repo (mêmes
chemins), à la suite du lot précédent (`0037`-`0042`). Pense à relancer
`npm run build` (ou `next dev`) après copie.

## 1. Pourquoi le CSS ne faisait rien

Deux bugs distincts, tous les deux dans `src/lib/profileCss.ts` :

1. **Les propriétés tapées sans sélecteur en tête de fichier cassaient tout
   le reste.** Ton exemple commençait par `border: ...; background: ...;`
   avant la première vraie règle (`.RANK-CARD-LETTER { ... }`) — le
   nettoyeur les collait au sélecteur suivant, obtenait un sélecteur
   absurde, et jetait tout le bloc. **Corrigé** : ces déclarations "nues"
   sont maintenant reconnues et appliquées directement à ta carte
   (`.profile-skin-xxx { border: ...; background: ...; }`), exactement
   comme on s'y attend intuitivement.
2. **`.RANK-CARD-LETTER` ne matchait rien** : les classes du site sont en
   minuscules (`rank-card-letter`), et un sélecteur CSS est sensible à la
   casse. **Corrigé en plus** : les sélecteurs de classe sont maintenant
   automatiquement mis en minuscules avant d'être appliqués (mais autant
   les écrire en minuscules directement).

Testé avec ton exemple exact (voir en bas) — il produit maintenant :

```css
.profile-skin-xxx {
  border: 1px solid rgba(212, 175, 55, 0.5);
  background: linear-gradient(180deg, #16181d 0%, #0b0c0e 100%);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6), 0 0 10px rgba(212, 175, 55, 0.15);
  border-radius: 6px;
}
.profile-skin-xxx .rank-card-letter {
  color: #d4af37;
  font-weight: bold;
}
.profile-skin-xxx .font-display {
  letter-spacing: 0.2em;
  color: #f3e5ab;
}
```

## 2. Réglages : champ pré-rempli + aperçu fidèle

- **Chaque champ est maintenant pré-rempli** avec un exemple basique et
  fonctionnel (pas juste un `placeholder` fantôme) — tu as le droit de le
  modifier, l'étoffer ou le vider complètement. Le bouton "Enregistrer"
  n'est plus grisé : tu peux sauvegarder l'exemple tel quel ou après
  modification.
- **"Classes disponibles ici"** (repliable) sous chaque champ : la liste
  exacte des classes utilisables pour CETTE zone, dans la bonne casse.
- **Aperçu réécrit** pour reprendre le VRAI balisage de chaque zone
  (organigramme / trombinoscope / classement / profil avec sa vraie carte
  de rang), au lieu d'un aperçu générique qui ne ressemblait à rien.
- La zone **"Profil"** cible maintenant précisément l'en-tête de ta fiche
  (carte de rang + pseudo) plutôt que toute la page — cohérent avec les 3
  autres zones, qui ciblent chacune une carte précise. Voir
  `src/app/dashboard/profile/[id]/page.tsx`.

## 3. Entreprise : plus de nombre d'actions / prix choisis à la main

`create_business` ne prend plus que 3 paramètres : nom, description,
**mise de départ**. Le reste en découle automatiquement, sur le même
principe que le cours au fil du temps (fondamentaux réels de l'entreprise,
voir migration `0038`) :

- Nombre d'actions **fixe** pour toutes les entreprises
  (`app_config.business_default_share_count`, 1000 par défaut).
- Prix de départ = mise ÷ nombre d'actions.
- La mise est prélevée sur le portefeuille du fondateur et devient les
  fonds propres de départ de l'entreprise (comme un vrai apport).
- Mise minimum configurable (`business_min_initial_investment`, 500 Cr. par
  défaut) pour éviter les entreprises-jouets à 1 Cr.

`src/app/dashboard/business/page.tsx` : le formulaire de création n'a plus
qu'un champ "Mise de départ", avec le nombre d'actions et le prix estimé
affichés en direct pendant la saisie.

## Fichiers de ce lot

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0043_business_ipo_by_investment.sql` **(nouveau)** | `create_business` par mise de départ + `get_market_settings` étendu |
| `src/lib/profileCss.ts` | Corrige les 2 bugs ci-dessus (testé) |
| `src/types/profileStyle.ts` | Exemples de CSS par défaut + liste des classes disponibles |
| `src/types/business.ts` | `MarketSettings.default_share_count` / `.min_initial_investment` |
| `src/app/dashboard/settings/page.tsx` | Champs pré-remplis, aperçu fidèle par zone |
| `src/app/dashboard/profile/[id]/page.tsx` | CSS "profil" scopé à la carte d'en-tête |
| `src/app/dashboard/business/page.tsx` | Formulaire de création simplifié (mise de départ uniquement) |
