# Page d'accueil en icônes, monnaie en « z », journal d'audit, défilement mémorisé

Ce lot a été préparé **directement sur ton dépôt GitHub** (`Loup0007A/SID`),
puis vérifié avec le vrai compilateur de ton projet et un vrai `next build`
(aucune erreur, aucun avertissement). Copie le contenu du dossier
`sid-website/` par-dessus le tien.

## À faire, dans l'ordre

1. Copier les fichiers.
2. Supabase → SQL Editor : coller **`supabase/VERIFIER_MIGRATIONS.sql`** et
   l'exécuter (voir « Deux bugs corrigés » plus bas).
   - Tout est à `true` → exécute `0047_currency_lowercase_z.sql` puis
     `0048_audit_log.sql`.
   - Au moins un `false` → ne lance rien et envoie-moi le résultat.
3. Ajouter tes icônes dans `public/icons/` quand tu veux (voir point 2).

## 1. Monnaie : « z » minuscule

- 31 affichages convertis dans 10 fichiers (`Z` → `z`). J'ai relu chaque
  ligne une par une. Le `Z` de `LineChart.tsx` n'a pas été touché : il ne
  s'agit pas de la monnaie mais de la commande qui referme le tracé des
  courbes.
- `0047_currency_lowercase_z.sql` fait la même chose dans la base
  (messages d'erreur des fonctions, notifications, registres déjà
  enregistrés). Elle convertit aussi les anciens « Cr. » restants, et peut
  être rejouée sans effet.

## 2. Page d'accueil en icônes (fin de la barre latérale)

- `/dashboard` affiche maintenant une grille d'icônes regroupées en 4
  rubriques (Mon espace, Le S.I.D., Économie, Administration). Chaque
  membre ne voit que les pages auxquelles il a accès. Sous la grille : ton
  solde (cliquable vers la Banque) et tes missions en cours.
  L'ancien bloc « Panneau des missions » a été retiré de l'accueil : il
  reste sur la page Quêtes.
- La barre latérale et le menu mobile sont remplacés par une barre du haut
  fixe : logo (retour à l'accueil), bouton « ← Accueil » + nom de la page
  en cours, cloche, ⚙️ Réglages (qui n'était plus affiché nulle part dans
  ta version), déconnexion.
- **Tes icônes** : dépose un PNG par page dans `public/icons/`, nommé
  exactement comme indiqué dans `public/icons/LISEZMOI.md` (ex.
  `quests.png`, `bank.png`…). Tant qu'un fichier manque, un emoji s'affiche
  à la place : tu peux les ajouter un par un, sans toucher au code. Carré,
  fond transparent, 128×128 px ou plus.
- Toute la liste des pages est dans **`src/lib/navigation.ts`** : pour
  renommer une page, changer sa description ou en ajouter une, c'est une
  seule ligne.

## 3. Le site garde l'endroit où tu te trouvais

`ScrollMemory.tsx` retient la position de défilement de chaque page et te
ramène au même endroit quand tu y reviens (bouton ← Accueil, icône, ou
bouton Précédent du navigateur), même si la page met un moment à charger
son contenu. La mémoire dure le temps de l'onglet.

Testé dans un vrai Chrome sur une copie de la barre et de la grille : une
page défilée à 1500 px, quittée puis rouverte, revient à 1500 px alors que
son contenu n'arrive qu'après coup ; l'accueil revient lui aussi à sa
position, y compris avec le bouton Précédent. Ce test a révélé un piège que
j'ai corrigé : en quittant une page, sa position était parfois écrasée par
celle de la page suivante, encore vide.

## 4. Le « truc utile » : un journal d'audit

Nouvelle page **Administration → Journal d'audit**. Chaque action sensible y
est enregistrée automatiquement, avec qui l'a faite, sur qui, et quand :
bannir/muter/geler, changement de rang ou de puissance, rôles et
permissions, sanctions et fin de sanction, ajustements de solde et de
renommée, suspension d'une section du site, réinitialisation de mot de
passe, confirmation d'email à la main.

- L'enregistrement passe par des déclencheurs en base : impossible
  d'oublier de journaliser une action, et rien à reprogrammer quand tu
  ajoutes une fonctionnalité.
- Personne ne peut écrire, modifier ou effacer une entrée depuis le site
  (un membre ne peut pas fabriquer une fausse trace). Lecture réservée à
  la permission `manage_users`.
- Filtre par type d'action, recherche, chargement par pages de 50.
- Testé sur ta vraie structure de base : chaque action ci-dessus produit
  bien son entrée, et une simple visite (mise à jour de « vu pour la
  dernière fois ») n'en produit aucune.

## 5. Deux bugs corrigés dans d'anciennes migrations

Pour tester ce lot sérieusement, j'ai rejoué **toutes tes migrations, de
0001 à 0048**, sur une base vide qui imite Supabase. Ça a révélé deux
erreurs dans des migrations que je t'avais fournies :

- **`0038_realistic_market.sql`** : elle changeait le type de retour de
  `sell_business_shares`, ce que Postgres refuse sans supprimer d'abord
  l'ancienne version. Corrigé.
- **`0039_admin_tools.sql`** : une règle de sécurité du chat utilisait la
  colonne `is_frozen` avant que le fichier ne la crée. Corrigé.

Sur Supabase, une migration qui plante est annulée en entier. Il est donc
possible que, chez toi, 0038 ou 0039 (et celles qui en dépendent) ne soient
pas réellement en base, même si le site semble fonctionner. D'où la requête
`VERIFIER_MIGRATIONS.sql` de l'étape 2. Après correction, les 48 migrations
passent dans l'ordre sans erreur.

## 6. Petit plus

`.gitignore` ajouté : ton dépôt n'en avait pas, donc un « ajouter tous les
fichiers » aurait envoyé sur GitHub les dossiers générés (`node_modules`,
`.next`), qui pèsent très lourd, et éventuellement un fichier `.env` avec
tes clés.

## Fichiers

| Fichier | |
|---|---|
| `src/lib/navigation.ts` | **nouveau** — liste de toutes les pages |
| `src/components/NavIcon.tsx` | **nouveau** — icône PNG ou emoji de secours |
| `src/components/ScrollMemory.tsx` | **nouveau** — mémoire de défilement |
| `src/app/dashboard/admin/audit/page.tsx` | **nouveau** — journal d'audit |
| `src/app/dashboard/layout.tsx` | barre du haut à la place de la barre latérale |
| `src/app/dashboard/page.tsx` | page d'accueil en icônes |
| `src/app/api/admin/{reset-password,confirm-email}/route.ts` | écrivent dans le journal |
| 10 pages et composants | monnaie `Z` → `z` |
| `supabase/migrations/0038…`, `0039…` | corrigées |
| `supabase/migrations/0047…`, `0048…` | **nouvelles** |
| `supabase/VERIFIER_MIGRATIONS.sql` | **nouveau** — à exécuter en premier |
| `public/icons/LISEZMOI.md` | **nouveau** — noms des fichiers d'icônes |
| `.gitignore` | **nouveau** |
