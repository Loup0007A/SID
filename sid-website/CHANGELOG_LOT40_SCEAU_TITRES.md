# Lot 40 : le sceau des titres

Le code reste entièrement public, mais ce qui dit **comment obtenir les titres**
est désormais brouillé :

| Avant (lisible) | Maintenant |
|---|---|
| `src/components/secrets/*.tsx` | `src/components/sceaux/s1.js` … `s6.js` (obfusqués) |
| « comment il a été obtenu » dans `src/lib/titles.ts` | `src/lib/cachet.js` (obfusqué) |
| libellés des sources dans la page admin Titres | `src/lib/cachet.js` |
| conditions dans `supabase/migrations/0061_titres_trolls.sql` | deux « parties scellées » qui se déchiffrent elles-mêmes quand la migration est lancée |
| tableau des conditions dans `CHANGELOG_LOT35` | retiré |

Rien ne change pour les membres ni dans la base : la migration scellée donne
exactement les mêmes fonctions, déclencheurs et colonnes que l'ancienne
(vérifié en comparant les deux sur une base de test), et les secrets ont été
rejoués dans le navigateur (anniversaire + récompense cachée, 404, CGU + clics,
abysses).

L'historique git a été réécrit pour que les anciennes versions lisibles
n'apparaissent plus dans les commits.

## Modifier un titre plus tard

Les sources lisibles sont chiffrées dans `scripts/scelle/coffre.bin`. Avec la
phrase secrète :

```bash
cd sid-website/scripts/scelle && npm install && cd ../..
SCELLE_CLE="…" node scripts/scelle/scelle.mjs ouvrir    # → .scelle/ (jamais commité)
# modifier .scelle/…
SCELLE_CLE="…" node scripts/scelle/scelle.mjs sceller   # régénère les fichiers brouillés + le coffre
node scripts/scelle/scelle.mjs verifier                 # les parties SQL scellées = .scelle/sql
```
