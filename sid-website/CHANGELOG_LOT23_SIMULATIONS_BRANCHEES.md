# Les trois simulations branchées sur l'API

Suite du lot 22, dans la même pull request. **Aucune migration à exécuter en
plus** de la `0049`, et **aucun changement dans tes trois sites**.

## Ce qui change

- Les trois tuiles sont branchées et le bandeau « En développement » est
  retiré :
  - Donjons : https://loup0007a.github.io/3D-game-world/
  - Intelligence : https://intelligence-seven-henna.vercel.app/
  - Techniques : https://techniques-delta.vercel.app/
- **`GET /api`** : l'adresse que tes sites appellent déjà
  (`https://sid-quest.vercel.app/api?...`) existe maintenant et enregistre
  leurs résultats.
- La page d'une simulation comprend aussi le message `sid-quest-resultat`
  de tes sites. Elle ignore les tentatives annulées (`statut=invalide`) et
  celles d'une autre épreuve.
- Le jeu reste affiché après un résultat : le bilan apparaît au-dessus et
  une nouvelle partie s'ouvre aussitôt. Le joueur enchaîne les niveaux, et
  chaque niveau réussi compte, jusqu'à 10 par jour et par simulation.
- L'e-mail du membre est transmis au site pour qu'il ne le redemande pas.
- Correctif : en cas d'erreur du serveur, la partie reste ouverte au lieu
  d'être abandonnée (le résultat suivant compte encore).

## Ce qui n'est volontairement pas compté

Un résultat qui n'appartient pas à une partie lancée depuis le S.I.D. ne
rapporte rien, même avec un e-mail et une signature `sig` valides. Cette
signature est calculée dans le navigateur avec un sel public : n'importe qui
pourrait en fabriquer pour n'importe quelle adresse. Détails : section 6 de
`API_SIMULATIONS.md`.

## Testé

Avec le vrai code de tes sites (Potions et Techniques complets, et le module
de résultats du jeu 3D), servi en local et affiché dans la vraie page du
S.I.D. :

- **Potions** : niveau réussi (+1 Intelligence), puis niveau raté dans la
  même iframe après une navigation interne qui fait disparaître le jeton de
  l'adresse (échec bien enregistré), puis tentative abandonnée (ignorée).
- **Techniques** : niveau réussi, +1 Technique.
- **Jeu 3D** : histoire terminée, +1 Puissance.
- **Requêtes directes `GET /api`** :
  - avec jeton : comptées ;
  - sans jeton : reçues mais pas comptées ;
  - un résultat de Potions envoyé avec un jeton de Donjons : refusé ;
  - une vieille tentative : ignorée.
- Compilation TypeScript et `next build` réussis.

Pas testé : les vrais sites en ligne. Cet environnement n'a pas accès à
Internet ; le premier essai réel se fera chez toi après la fusion.
