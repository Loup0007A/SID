# Icônes

Les icônes des pages ne sont plus des images à déposer ici : elles sont
dessinées en SVG dans `src/components/icons/sidIcons.tsx` (une centaine,
toutes dans le même style), et chaque page choisit la sienne dans
`src/lib/navigation.ts` (champ `icon`).

Pour changer l'icône d'une page : mettre un autre nom de la liste. Pour une
nouvelle icône : l'ajouter dans `sidIcons.tsx` (carré de 48 × 48).
