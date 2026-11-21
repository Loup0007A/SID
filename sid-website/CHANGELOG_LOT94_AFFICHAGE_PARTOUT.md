# Lot 94 — Réglages d'affichage sur les trois sites

Migrations (Dossier Central) : `0116_affichage_compte.sql`, puis
`0117_devlog_affichage.sql` (entrées du devlog : central, carto, wiki).

- Les trois sites ont des adresses différentes : le navigateur ne partage
  pas leur mémoire. Les réglages d'affichage sont donc gardés sur le compte
  (`profiles.display_prefs`, RPC `display_prefs_get` / `display_prefs_set`,
  valeurs vérifiées) et recopiés dans chaque navigateur.
- `src/lib/comfortPrefs.ts` et `src/components/ComfortSync.tsx` : fichiers
  identiques sur les trois sites. Le script du `<head>` pose les classes
  avant le premier affichage ; ComfortSync relit le compte à l'ouverture,
  envoie les réglages du navigateur à un compte qui n'en a pas encore, et
  suit le passage clair/sombre de l'appareil (thème « selon l'appareil »).
- Dossier Central : Réglages → Affichage enregistre sur le compte (« Enregistré
  sur ton compte. ») ; la note dit que les réglages valent sur les trois sites.
- Cartographie : mode sombre (table de nuit, cartouche du haut et feuilles de
  vélin en cuir sombre ; la carte, les plans de ville et d'étage restent des
  documents clairs), mode épuré (fond uni, sans ombres pleines ni ombre de
  la feuille, liserés seulement), texte, animations ; décors des fêtes coupés
  au besoin (l'élection garde son calque). Lien « Affichage » dans le
  lanceur d'applications. Tuiles du lanceur repeintes (ancien bleu).
- Wiki : mode sombre (herbier de nuit, fiches et planches en plaques
  sombres, étiquettes de parchemin gardées), mode épuré, texte, animations ;
  mêmes règles de décors. Entrée « Affichage » dans le menu (ordinateur et
  téléphone).
- `EventDecor.tsx` reste identique sur la Cartographie et le Wiki.
