# API des simulations

Les trois simulations du tableau de bord affichent tes sites dans une
iframe. Une simulation réussie rapporte **exactement 1 point** au facteur
correspondant (100 maximum) ; une simulation ratée n'en rapporte aucun et
n'en fait pas perdre.

| Tuile | Site | Épreuves reconnues | Facteur |
|---|---|---|---|
| Donjons | https://loup0007a.github.io/3D-game-world/ (`Loup0007A/3D-game-world`) | `mondes-vivants` | Puissance |
| Intelligence | https://intelligence-seven-henna.vercel.app/ (`Loup0007A/Potions`) | `potions`, `enigmes`, `probleme` | Intelligence |
| Techniques | https://techniques-delta.vercel.app/ (`Loup0007A/Techniques`) | `techniques` | Technique |

La **puissance globale** d'un membre est la moyenne de ses trois facteurs.

**Tes trois sites n'ont rien à changer** : le S.I.D. comprend le format de
résultat qu'ils utilisent déjà (section 2).

---

## 1. Comment se déroule une partie

1. Dans le S.I.D., le membre ouvre la tuile et clique sur **Lancer la
   simulation**.
2. Le S.I.D. crée une partie et affiche le site dans l'iframe, avec trois
   paramètres ajoutés à l'adresse :
   - `sid_run` : le **jeton** de la partie (64 caractères hexadécimaux) ;
   - `sid_api` : l'adresse de l'API (`…/api/simulations`) ;
   - `email` : l'e-mail du membre, pour que le site ne le redemande pas
     (Potions et le jeu 3D le reprennent directement, Techniques le
     pré-remplit).
3. À la fin de chaque tentative, le site prévient le S.I.D. de deux façons
   (c'est déjà dans leur code) :
   - message `sid-quest-resultat` envoyé à la page du S.I.D. ;
   - requête `GET https://sid-quest.vercel.app/api?…`.
4. Le S.I.D. enregistre le résultat, affiche le bilan (« +1 Intelligence »)
   au-dessus du jeu, et **ouvre aussitôt une nouvelle partie** : le joueur
   peut enchaîner les niveaux dans la même iframe, et chaque niveau réussi
   compte, dans la limite du jour.

Le message et la requête arrivent souvent tous les deux : le premier arrivé
est enregistré, l'autre est reconnu comme déjà traité. Un même résultat ne
compte jamais deux fois.

---

## 2. Ce que le S.I.D. compte

Les sites envoient notamment `epreuve`, `statut`, `reussi` et `debut`.

| Champ reçu | Effet |
|---|---|
| `statut=reussi` (ou `reussi=1`) | réussite : +1 au facteur |
| `statut=echoue`, `explosion`, `temps_ecoule`… | échec : 0 point |
| `statut=invalide` | ignoré : tentative annulée (page quittée ou rechargée), la partie reste ouverte |
| `epreuve` d'une autre simulation | ignoré (un résultat de Potions ne peut pas valider une partie de Donjons) |
| `debut` plus de 10 min avant la partie S.I.D. | ignoré (vieille tentative renvoyée au rechargement) |
| pas de jeton `sid_run` | **jamais compté** (voir section 6) |

Le jeton arrive tout seul dans la requête `GET /api` : tes sites recopient
dans leurs résultats les paramètres d'adresse qu'ils ne connaissent pas, dont
`sid_run`. Potions et Techniques le perdent quand le joueur change de page
dans le site (leur navigation réécrit l'adresse). Ce n'est pas grave : le
message `sid-quest-resultat`, lui, est toujours relayé par la page du S.I.D.,
qui connaît le jeton de la partie en cours.

---

## 3. Les adresses de l'API

Toutes acceptent les appels depuis n'importe quel domaine (CORS ouvert),
répondent en JSON et n'utilisent aucun cookie : seul le jeton compte.

### `GET /api?…` — format des trois sites

Exemple :
`/api?epreuve=potions&statut=reussi&reussi=1&debut=2026-10-13T10:00:00.000Z&sid_run=<jeton>&…`

| Code | Signification |
|---|---|
| 200 | Enregistré (`counted: true`) |
| 202 | Reçu mais pas compté : pas de jeton, tentative annulée ou trop ancienne (`message` explique) |
| 400 | Épreuve inconnue |
| 404 | Jeton inconnu |
| 409 | Déjà enregistré, ou épreuve d'une autre simulation |
| 410 / 425 / 429 | Partie expirée / envoyée trop tôt / limite du jour atteinte |

Les sites l'appellent en mode « no-cors » et ne lisent pas la réponse : elle
sert au diagnostic (onglet Réseau des outils de développement).

### `GET /api/simulations`

Sommaire de l'API et état des trois simulations.

### `GET /api/simulations/run?token=<jeton>`

Infos sur une partie : simulation, état (`playable`), pseudo du joueur.

### `POST /api/simulations/result` — format générique

Corps `{ "token": "<jeton>", "success": true }`. Utile pour un futur site
qui n'utiliserait pas le format ci-dessus ; il peut aussi envoyer à la page
du S.I.D. le message
`{ type: "sid:simulation-result", token, success }`.

---

## 4. Les règles appliquées par le S.I.D.

- **Un jeton = une partie = un résultat.** Un jeton déjà utilisé, inventé ou
  expiré ne rapporte rien.
- **Durée minimale** : 20 secondes entre l'ouverture de la partie et le
  résultat.
- **Validité** : une partie expire au bout de 6 heures.
- **Limite** : 10 résultats comptés par jour et par simulation. Au-delà, le
  jeu reste jouable mais le S.I.D. indique que les parties ne comptent plus.
- **Plafond** : un facteur ne dépasse jamais 100.
- Un compte gelé, ou les simulations suspendues depuis Modération,
  empêchent de lancer une partie.

Les trois valeurs chiffrées se changent dans Supabase (table `app_config`) :

```sql
update app_config set value = '30'  where key = 'simulation_min_seconds';         -- durée minimale (s)
update app_config set value = '120' where key = 'simulation_run_ttl_minutes';     -- validité (min)
update app_config set value = '5'   where key = 'simulation_max_results_per_day'; -- résultats par jour
```

---

## 5. Brancher, débrancher, bandeau

Tout se règle dans `src/lib/simulationSites.ts`, pour chaque simulation :

- `url` : adresse du site (`null` = bouton **Lancer** grisé) ;
- `inDevelopment: true` : remet le bandeau de chantier « En développement » ;
- `epreuves` : valeurs du champ `epreuve` acceptées pour cette simulation.

Un site doit accepter d'être affiché dans une iframe : c'est le cas par
défaut sur Vercel et GitHub Pages. Dans l'iframe, il peut exécuter du
JavaScript, verrouiller la souris, passer en plein écran et utiliser une
manette.

---

## 6. Sécurité : ce qu'il faut savoir

**Pourquoi un résultat sans jeton n'est jamais compté.** Tes sites calculent
leur « signature » (`sig`) dans le navigateur, avec un sel (`sid-quest-v2`)
écrit en clair dans leur code. N'importe qui peut donc fabriquer une requête
`GET /api?...&reussi=1&email=quelquun@exemple.fr` avec une signature valide,
sans jouer, et au nom de n'importe qui. Si le S.I.D. créditait ces
requêtes, un seul lien suffirait pour mettre tout le monde à 100. Seule une
partie ouverte depuis le S.I.D., par le membre connecté, peut donc
rapporter un point.

**La limite qui reste.** Les sites tournent entièrement dans le navigateur
du joueur. Quelqu'un qui ouvre les outils de développement peut déclarer
gagnée **sa propre** partie en cours sans la jouer. Ce que le S.I.D.
garantit malgré tout :

- au plus 1 point par partie ;
- au moins 20 secondes par partie ;
- au plus 10 résultats comptés par jour et par simulation ;
- personne ne peut modifier directement ses facteurs, sa puissance ou ses
  parties ;
- chaque partie est conservée (table `simulation_runs`) et lisible par les
  administrateurs.

**Pour aller plus loin : la signature serveur.** Si un jour un site
vérifie ses parties sur son propre serveur (par exemple une fonction
Vercel), il peut signer ses résultats :

1. Dans Vercel, côté S.I.D., ajoute la variable `SIMULATION_SECRET_DONJONS`
   (ou `_INTELLIGENCE`, `_TECHNIQUES`) avec un long texte aléatoire.
2. Le serveur du site calcule
   `HMAC-SHA256(secret, "<jeton>.<1 ou 0>")` en hexadécimal et l'envoie :
   en-tête `X-SID-Signature` pour `POST /api/simulations/result`, ou
   paramètre `sid_sig` pour `GET /api`.

```js
import { createHmac } from "crypto";
const signature = createHmac("sha256", process.env.SIMULATION_SECRET)
  .update(`${token}.${success ? 1 : 0}`)
  .digest("hex");
```

Dès que ce secret existe, le S.I.D. **refuse** tout résultat de cette
simulation sans signature valide. Ne le configure donc que pour un site
qui a vraiment un serveur : un site statique ne peut pas cacher un secret.
