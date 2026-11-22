# Lot 100 : passage à Next 16

Les trois sites (Dossier Central, Wiki, Carto) passent de Next 14.2 à
**Next 16.4.6** et de React 18 à **React 19**. Next 14 n'est plus corrigé :
plusieurs failles connues (déni de service surtout) n'y seront jamais
réparées. `npm audit` ne signale plus rien sur Next.

## Ce qui change dans le code

- **Client Supabase serveur** (`src/lib/supabase/server.ts`) : `cookies()`
  est maintenant asynchrone, donc `createClient()` aussi. Chaque appel
  s'écrit `await createClient()`.
- **Pages du Wiki et de la Carto** : `params` et `searchParams` sont
  maintenant des promesses (`await props.params`).
- **`middleware.ts` devient `proxy.ts`** (nouveau nom chez Next 16, même
  rôle : garde de session et cookie des réglages d'affichage).
- **Build avec webpack** : `next build --webpack` et `next dev --webpack`.
  Next 16 utilise Turbopack par défaut, mais la configuration webpack des
  sites reste nécessaire : couche JSX des titres scellés et polyfills
  modernes (Dossier Central), modules `node:` de @gltf-transform (Wiki).
- **Purge du cache de configuration** : `revalidateTag("public-config", "max")`.
  Le second argument est obligatoire avec Next 16.
- **Lint** : `next lint` n'existe plus. `npm run lint` lance ESLint avec
  `eslint.config.mjs`. Les nouvelles règles propres au React Compiler (que
  les sites n'utilisent pas) sont coupées.
- Quelques types adaptés à React 19 (`useRef` avec valeur initiale,
  `React.JSX.Element`, `RefObject<… | null>`).

## Vérifié

- Build, vérification de types et lint sans erreur sur les trois sites.
- Tests d'affichage : Dossier Central 128, Wiki 100, Carto 51, tous passés.
- En-têtes de sécurité inchangés, `/_next/image` toujours en 404, routes
  d'administration toujours fermées sans session.

## À savoir pour Vercel

Next 16 demande Node 20.9 ou plus récent. `package.json` le dit
(`engines`), et Vercel suit ce champ plutôt que le réglage du projet.
`vercel.json` fixe la commande de build à `npm run build` : une commande
« next build » réglée à la main dans Vercel lancerait Turbopack, qui ignore
la configuration webpack, et le build échouerait.
