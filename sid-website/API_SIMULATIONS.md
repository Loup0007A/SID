# API des simulations

Ce document s'adresse aux trois sites qui font progresser la puissance des
membres. Il explique ce que chaque site doit faire pour envoyer ses
résultats au S.I.D.

| Tuile du S.I.D. | Dépôt du site | Facteur gagné | Identifiant |
|---|---|---|---|
| Donjons | `Loup0007A/3D-game-world` | Puissance | `donjons` |
| Intelligence | `Loup0007A/Potions` | Intelligence | `intelligence` |
| Techniques | `Loup0007A/Techniques` | Technique | `techniques` |

La **puissance globale** d'un membre est la moyenne de ses trois facteurs
(chacun entre 0 et 100). Une simulation réussie rapporte **exactement
1 point** au facteur correspondant ; une simulation ratée n'en rapporte
aucun et n'en fait pas perdre.

---

## 1. Comment se déroule une partie

1. Dans le S.I.D., le membre ouvre la tuile et clique sur **Lancer la
   simulation**.
2. Le S.I.D. crée la partie et affiche ton site dans une **iframe**, avec
   deux paramètres ajoutés à l'adresse :
   - `sid_run` : le **jeton** de la partie (64 caractères hexadécimaux) ;
   - `sid_api` : l'adresse de l'API, par exemple
     `https://ton-sid.vercel.app/api/simulations`.
3. *(Facultatif)* Ton site vérifie le jeton et récupère le pseudo du joueur
   (section 3).
4. Quand la partie se termine, ton site **prévient le S.I.D.** une seule
   fois, en indiquant si la partie est réussie ou non (section 2).
5. Le S.I.D. enregistre le résultat, affiche « +1 Puissance » (ou le
   message d'échec) et referme l'iframe.

Si ton site est ouvert **en dehors** du S.I.D. (sans `sid_run` dans
l'adresse), il fonctionne normalement mais n'envoie rien : pratique pour le
tester.

---

## 2. Le code à copier dans ton site

Un petit module suffit. Dépose-le par exemple dans `src/sid.js` :

```js
// Lien avec le S.I.D. — voir API_SIMULATIONS.md dans le dépôt du S.I.D.
const params = new URLSearchParams(window.location.search);
const token = params.get("sid_run");
const api = params.get("sid_api");
let sent = false;

export const sid = {
  /** true si le jeu a été lancé depuis le S.I.D. */
  connected: Boolean(token && api) && window.parent !== window,

  /** Infos sur la partie : { ok, kind, status, playable, nickname, ... } ou null. */
  async player() {
    if (!this.connected) return null;
    try {
      const res = await fetch(`${api}/run?token=${encodeURIComponent(token)}`);
      return await res.json();
    } catch {
      return null;
    }
  },

  /** À appeler UNE fois, à la fin de la partie : finish(true) si réussie, finish(false) sinon. */
  finish(success) {
    if (!this.connected || sent) return;
    sent = true;
    window.parent.postMessage({ type: "sid:simulation-result", token, success: Boolean(success) }, "*");
  },
};
```

Utilisation dans le jeu :

```js
import { sid } from "./sid.js";

const info = await sid.player();
if (info?.playable) afficherMessage(`Bonne chance, ${info.nickname} !`);

// … quand le joueur gagne :
sid.finish(true);
// … quand il perd :
sid.finish(false);
```

C'est la page du S.I.D. qui reçoit ce message et le transmet à l'API : ton
site n'a besoin de rien d'autre. La page n'écoute que l'iframe qu'elle
affiche, depuis l'adresse déclarée pour cette simulation (section 5).

### Variante : envoyer le résultat directement

Si ton site a son propre serveur, ou n'est pas affiché dans une iframe, il
peut appeler l'API lui-même :

```js
await fetch(`${api}/result`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token, success: true }),
});
```

Envoie quand même le `postMessage` ensuite : le S.I.D. comprendra que le
résultat est déjà enregistré et mettra simplement son affichage à jour.

---

## 3. Les adresses de l'API

Toutes acceptent les appels depuis n'importe quel domaine (CORS ouvert) et
répondent en JSON. Aucune n'utilise de cookie : seul le jeton compte.

### `GET /api/simulations`

Sommaire de l'API et état des trois simulations. Utile pour vérifier que
le S.I.D. répond.

### `GET /api/simulations/run?token=<jeton>`

```json
{ "ok": true, "kind": "donjons", "status": "started", "playable": true,
  "nickname": "Bob", "started_at": "…", "expires_at": "…" }
```

`playable` vaut `false` si la partie est déjà terminée, abandonnée ou
expirée.

### `POST /api/simulations/result`

Corps : `{ "token": "<jeton>", "success": true }`. `success` doit être un
vrai booléen (`true` / `false`), pas un texte.

| Code | `result` / `error` | Signification |
|---|---|---|
| 200 | `ok` | Enregistré. `points_awarded` vaut 1, ou 0 si échec ou facteur déjà à 100. |
| 400 | `invalid_json`, `invalid_token`, `invalid_success` | Requête mal formée. |
| 401 | `invalid_signature` | Signature manquante ou fausse (seulement si un secret est configuré, section 6). |
| 404 | `not_found` | Jeton inconnu. |
| 409 | `already_completed` | Le résultat de cette partie a déjà été envoyé. |
| 410 | `expired` | Partie trop ancienne (plus de 6 h) : il faut en relancer une. |
| 425 | `too_fast` | Envoyé moins de 20 s après le lancement. La partie reste ouverte. |
| 429 | `daily_limit` | Limite du jour atteinte pour cette simulation. |

Chaque réponse contient aussi un champ `message` en français, prêt à
afficher.

---

## 4. Les règles appliquées par le S.I.D.

- **Un jeton = une partie = un résultat.** Un jeton déjà utilisé, inventé
  ou expiré ne rapporte rien.
- **Relancer abandonne** la partie en cours de la même simulation.
- **Durée minimale** : 20 secondes entre le lancement et le résultat.
- **Validité** : une partie expire au bout de 6 heures.
- **Limite** : 10 résultats comptés par jour et par simulation.
- **Plafond** : un facteur ne dépasse jamais 100.
- Un membre au compte gelé, ou des simulations suspendues depuis
  Modération, empêchent de lancer une partie.

Les trois valeurs chiffrées se changent dans Supabase (table `app_config`) :

```sql
update app_config set value = '30'  where key = 'simulation_min_seconds';         -- durée minimale (s)
update app_config set value = '120' where key = 'simulation_run_ttl_minutes';     -- validité (min)
update app_config set value = '5'   where key = 'simulation_max_results_per_day'; -- résultats par jour
```

---

## 5. Brancher un site au S.I.D.

Tout se règle dans `src/lib/simulationSites.ts` :

```ts
donjons: {
  …
  url: "https://loup0007a.github.io/3D-game-world/", // adresse du site
  inDevelopment: true,                                // bandeau « En développement »
},
```

- `url: null` : le bouton **Lancer** reste grisé (c'est le cas aujourd'hui).
- `inDevelopment: true` : bandeau de chantier sur la tuile et la page.
- Les deux sont indépendants : renseigne l'`url` pour tester le branchement
  en gardant le bandeau, puis passe `inDevelopment` à `false` pour ouvrir la
  simulation à tous.

Ton site doit accepter d'être affiché dans une iframe. C'est le cas par
défaut sur GitHub Pages ; évite simplement d'ajouter un en-tête
`X-Frame-Options: DENY`. Dans l'iframe, ton site peut exécuter du
JavaScript, verrouiller la souris, passer en plein écran et utiliser une
manette.

---

## 6. Sécurité : ce qu'il faut savoir

Tes sites publiés sur GitHub Pages tournent **entièrement dans le
navigateur** du joueur. Un joueur qui ouvre les outils de développement peut
donc envoyer `success: true` pour **sa propre partie en cours**, sans
l'avoir jouée. Aucun réglage du S.I.D. ne peut l'empêcher complètement tant
que le jeu ne vérifie pas la partie sur un serveur.

Ce que le S.I.D. garantit malgré tout :

- impossible de gagner un point sans avoir lancé une partie depuis le S.I.D. ;
- au plus 1 point par partie lancée, et un jeton ne sert qu'une fois ;
- au moins 20 secondes par partie, au plus 10 résultats comptés par jour et
  par simulation ;
- personne ne peut modifier directement ses facteurs, sa puissance ou ses
  parties ;
- chaque partie est conservée (table `simulation_runs`) et lisible par les
  administrateurs.

### Pour aller plus loin : la signature

Si un jour un de tes sites a son propre serveur (par exemple une fonction
Vercel) qui vérifie vraiment la partie, il peut **signer** le résultat :

1. Dans Vercel, côté S.I.D., ajoute la variable `SIMULATION_SECRET_DONJONS`
   (ou `_INTELLIGENCE`, `_TECHNIQUES`) avec un long texte aléatoire.
2. Le serveur de ton site, qui connaît le même secret, ajoute l'en-tête
   `X-SID-Signature` à sa requête `POST /api/simulations/result` :

```js
import { createHmac } from "crypto";
const signature = createHmac("sha256", process.env.SIMULATION_SECRET)
  .update(`${token}.${success ? 1 : 0}`)
  .digest("hex");
```

Dès que le secret existe, le S.I.D. **refuse** tout résultat de cette
simulation sans signature valide. Ne configure donc ce secret que pour un
site qui a vraiment un serveur : un site statique ne peut pas cacher un
secret.
