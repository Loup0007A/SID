# Monnaie en Z (zenis) + email / mot de passe + petites protections

## À faire, dans cet ordre

1. Copie les fichiers de ce dossier par-dessus ton repo (mêmes chemins).
2. À la racine du projet : `python3 rename_currency.py --dry-run` pour voir
   ce qui changera, puis `python3 rename_currency.py` pour l'appliquer.
3. Supabase → SQL Editor : exécute `supabase/migrations/0046_currency_zenis.sql`.
4. Supabase → Authentication → URL Configuration : ajoute dans les
   « Redirect URLs » `https://TON-SITE/login` et `https://TON-SITE/reset-password`
   (sans ça, les liens des emails retombent sur l'URL du site par défaut).

## 1. « Cr. » devient « Z »

- `rename_currency.py` remplace le mot isolé `Cr.` par `Z` dans tout
  `src/**/*.ts(x)` et `README.md` (« 12 Cr. » → « 12 Z », « Cr./action » →
  « Z/action »). Les mots comme « Créateur » ou « Crédit » ne sont jamais
  touchés. Idempotent, avec un mode `--dry-run`. Je l'ai passé sur les
  fichiers que j'ai écrits dans cette conversation : 22 occurrences dans
  6 fichiers, plus aucune ensuite.
- `0046_currency_zenis.sql` fait la même chose pour ce qui est déjà en base :
  les messages d'erreur et textes construits par les fonctions SQL
  (emprunt, bourse, création d'entreprise, notification « argent reçu »…),
  et les textes déjà enregistrés (notifications, registre des entreprises).
  Il relit la définition actuelle de chaque fonction concernée plutôt que
  de la recopier, donc elle garde ses droits et son `search_path`.
  Testé sur une vraie base : idempotent, ne touche pas aux fonctions sans « Cr. ».
- Les anciennes migrations et les CHANGELOG ne sont pas modifiés (archives).

## 2. Email de confirmation

- **Renvoyer l'email** (délai de 60 s entre deux envois) et **saisir le code**
  reçu, directement depuis la page de connexion quand le compte n'est pas
  confirmé, et depuis l'écran « Dossier transmis » après l'inscription.
  Composant : `ResendConfirmation.tsx`.
- Le champ « code » ne marche que si ton modèle d'email Supabase contient
  `{{ .Token }}` ; sinon, le lien cliquable continue de faire le travail.
- **Confirmer l'email à la main** : nouveau bouton dans Administration →
  comptes (route `/api/admin/confirm-email`, même sécurité que la
  réinitialisation de mot de passe : permission revérifiée côté serveur).

## 3. Mot de passe oublié

- Lien « Mot de passe oublié ? » sur la connexion → `/forgot-password`
  (envoie un lien, avec un message identique que l'adresse existe ou non)
  → `/reset-password` (choix du nouveau mot de passe, 8 caractères min.).
- Bouton « Voir / Masquer » sur le champ mot de passe de la connexion.

## 4. Petites protections

- `middleware.ts` : un visiteur non connecté qui ouvre `/dashboard/...` est
  renvoyé vers `/login` avant tout affichage (la vérification n'existait
  que côté navigateur).
- Pages `not-found.tsx` (404) et `error.tsx` (erreur inattendue) à l'image
  du site, au lieu des pages blanches par défaut.

## Ce que je n'ai pas pu vérifier

Les écrans d'email et de mot de passe oublié dépendent de ton projet
Supabase (modèles d'email, URLs autorisées, limites d'envoi) : j'ai vérifié
que le code compile et suit l'API de `supabase-js`, mais pas testé un vrai
envoi d'email. À essayer une fois chez toi : inscription → renvoi → code,
puis « mot de passe oublié ».
