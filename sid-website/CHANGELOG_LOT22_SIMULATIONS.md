# Puissance calculée (Intelligence, Puissance, Technique) + simulations

Ce lot s'ajoute au lot 21 (page d'accueil en icônes) et le contient : la
pull request de ce lot suffit pour tout récupérer.

## À faire dans Supabase, dans l'ordre

1. SQL Editor : exécuter `supabase/VERIFIER_MIGRATIONS.sql`.
2. Exécuter, dans l'ordre, les migrations encore à `false` : `0047`, `0048`,
   puis **`0049_member_stats_simulations.sql`**. La 0049 refuse de
   s'exécuter (sans rien modifier) si la 0048 n'est pas passée avant.

## 1. La puissance devient calculée

- Chaque membre a trois facteurs entre 0 et 100 : **Intelligence**,
  **Puissance** et **Technique**.
- La **puissance globale** est leur moyenne (100 maximum, une décimale) et
  se recalcule toute seule. Elle n'est plus saisie à la main.
- Les anciennes valeurs saisies à la main sont sauvegardées dans la table
  `power_score_legacy` avant d'être remplacées, et tout le monde repart à 0.
- Économie → Puissance : l'administration corrige désormais les trois
  facteurs ; chaque correction apparaît dans le journal d'audit.
- Classement → Puissance : score sur 100 et détail des trois facteurs sous
  chaque membre.

## 2. Les trois tuiles « Entraînement »

- Nouvelle rubrique sur l'accueil : **Donjons** (→ Puissance),
  **Intelligence** (→ Intelligence) et **Techniques** (→ Technique), avec
  un bandeau de chantier jaune et noir « En développement », plus une carte
  qui résume tes trois facteurs.
- Chaque tuile mène à sa page : bandeau, tes facteurs, résultats du jour,
  dernières parties, bouton **Lancer la simulation**. Ce bouton reste grisé
  tant qu'aucun site n'est branché.
- Les simulations peuvent être suspendues depuis Modération, comme la
  boutique.
- Icônes : `public/icons/donjons.png`, `intelligence.png`, `techniques.png`
  (voir `public/icons/LISEZMOI.md`).

## 3. L'API pour tes trois sites

Tout est expliqué dans **`API_SIMULATIONS.md`**, avec le code à copier dans
chaque site. En résumé :

- le S.I.D. ouvre le site dans une iframe, avec un jeton à usage unique
  dans l'adresse (`sid_run`) ;
- en fin de partie, le site envoie une ligne :
  `window.parent.postMessage({ type: "sid:simulation-result", token, success }, "*")` ;
- +1 point si réussite, 0 sinon ; 100 maximum.

Les adresses de l'API :

- `GET /api/simulations` : sommaire ;
- `GET /api/simulations/run` : le site vérifie le jeton et récupère le
  pseudo du joueur ;
- `POST /api/simulations/result` : enregistre le résultat ;
- `POST /api/simulations/start` : interne, utilisée par la page du S.I.D.

Pour brancher un site, il suffit de remplir `url` dans
`src/lib/simulationSites.ts`. Pour retirer le bandeau, passer
`inDevelopment` à `false`.

## Règles anti-triche

- Un jeton ne rapporte qu'une fois.
- Une partie dure au moins 20 s et expire au bout de 6 h.
- 10 résultats comptés par jour et par simulation.
- Relancer abandonne la partie en cours.
- Aucun membre ne peut modifier lui-même ses facteurs, sa puissance ou ses
  parties.

Limite honnête : tes sites sur GitHub Pages tournent entièrement dans le
navigateur. Un joueur qui ouvre les outils de développement peut donc
déclarer gagnée sa propre partie en cours sans la jouer. Les règles
ci-dessus limitent le gain à 1 point par partie et 10 par jour. Pour aller
plus loin, il faut une vérification côté serveur ; une signature
facultative est déjà prévue pour ça (section 6 de `API_SIMULATIONS.md`).

## Ce qui a été testé

- **Les 49 migrations** : rejouées dans l'ordre sur une base vide qui imite
  Supabase, droits par défaut compris.
- **Les règles en base** : lancement, résultat trop rapide, réussite, échec,
  jeton réutilisé ou inventé, partie expirée, relance, limite du jour,
  plafond de 100, compte gelé, simulations suspendues, correction par un
  admin, recalcul de la puissance (40/33/30 → 34,3).
- **Les tentatives de triche**, en tant que membre connecté : s'attribuer un
  point, modifier ses facteurs, sa puissance ou ses parties. Toutes sont
  refusées.
- **L'API** : de vraies requêtes HTTP sur une imitation complète de Supabase
  (base, API, connexion), avec chaque code de réponse et la signature
  facultative.
- **Le parcours complet dans Chrome** : Bob ouvre Donjons et lance la partie.
  Un faux jeu, servi depuis un autre domaine dans l'iframe, vérifie son
  jeton puis annonce sa victoire. Le S.I.D. enregistre +1 Puissance, affiche
  le message et referme l'iframe.
- **Les vérifications de ton projet** : compilation TypeScript et
  `next build`.

## Fichiers

| Fichier | |
|---|---|
| `supabase/migrations/0049_member_stats_simulations.sql` | **nouveau** |
| `src/lib/simulationSites.ts` | **nouveau** — réglages des 3 simulations (url, bandeau) |
| `src/lib/simulationServer.ts` | **nouveau** — jetons, signature, CORS (serveur uniquement) |
| `src/app/api/simulations/…` | **nouveau** — `route.ts`, `start/`, `run/`, `result/` |
| `src/app/dashboard/simulations/[kind]/page.tsx` | **nouveau** — page d'une simulation |
| `src/components/ConstructionTape.tsx` | **nouveau** — bandeau de chantier |
| `src/components/MemberStatBars.tsx` | **nouveau** — puissance et facteurs |
| `src/types/simulationRuns.ts` | **nouveau** |
| `src/lib/navigation.ts`, `src/app/dashboard/page.tsx` | rubrique Entraînement |
| `src/app/dashboard/leaderboard/page.tsx`, `src/types/database.ts` | puissance sur 100 + facteurs |
| `src/components/PowerAdminSection.tsx` | correction des 3 facteurs |
| `src/app/dashboard/admin/{audit,moderation}/page.tsx` | nouveaux libellés |
| `src/app/globals.css` | style du bandeau |
| `API_SIMULATIONS.md` | **nouveau** — mode d'emploi de l'API |
| `public/icons/LISEZMOI.md`, `supabase/VERIFIER_MIGRATIONS.sql` | mis à jour |
