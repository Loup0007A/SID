# Lot 34 — Journal par membre, alertes, CGU et données personnelles

Migration : `supabase/migrations/0060_journal_alertes_donnees.sql` (après 0059).
À lancer **une seule fois** dans Supabase (SQL Editor). Elle sert aussi la
Cartographie et le Wiki (même base).

Variable facultative sur les trois projets Vercel : `NEXT_PUBLIC_CONTACT_EMAIL`
(une adresse de contact affichée dans les CGU et la politique de
confidentialité ; sans elle, les textes renvoient vers la messagerie et les
fondateurs).

## Administration
### Fiche d'un membre (`/dashboard/admin/members/<id>`)
- Accès : bouton **Fiche** dans Comptes, clic sur un nom, ou lien
  « Fiche d'administration » sur un profil (staff).
- En-tête : rang, rôles, banni / muet / invisible / compte de test,
  dernière visite, CGU acceptées ou non.
- Chiffres : solde, banque, entrées / sorties sur 7 jours, puissance,
  messages (24 h / 7 j), visites, quêtes, simulations, sanctions, alertes.
- Actions directes : bannir, rendre muet, invisible, réinitialiser le mot de
  passe ; liens vers le dossier public, l'économie, les rôles, les sanctions
  et le journal d'audit complet.
- **Journal** : tout ce que la personne a fait ou subi, dans l'ordre
  (actions d'admin, transactions, achats, quêtes, simulations, techno,
  raids, sanctions, alertes, connexions…). Filtres par source et période.
  Les messages sont **comptés par jour, jamais lus**.

### Alertes (`/dashboard/admin/alerts`, permission `manage_users`)
- Détection automatique (toutes les 3 minutes au plus, quand un membre
  visite le site) : gros montant, enrichissement rapide, rafale de
  messages, simulations en série ou trop rapides, achats en rafale, admin
  qui enchaîne les actions, auto-attribution (un admin qui se donne de
  l'argent / un rang), sanctions répétées, nouveau compte très actif,
  compte dormant qui se réveille, demande de suppression.
- Badge ⚠️ dans l'en-tête avec le nombre d'alertes ouvertes, et **une**
  notification récapitulative par admin (pas une par alerte).
- Résoudre / ignorer / rouvrir ; les seuils se règlent en bas de la page.
- Une même alerte n'est pas recréée en double (clé de déduplication).

### Comptes (`/dashboard/admin/users`)
- Filtre par statut (actifs, en attente, bannis, refusés, invisibles), tri
  (plus récents, dernière visite, nom), dernière visite affichée, badge 🧪
  pour les comptes de test, bouton **Fiche**.

## Membres
- **Accueil** : bandeau « À faire » (missions en cours, notifications non
  lues, candidatures à traiter, alertes et demandes de suppression pour les
  admins) ; « Mes missions en cours » remonte en haut.
- **Mes données** (`/dashboard/privacy`, menu Mon espace) : ce que le site
  garde, qui voit quoi, **téléchargement de toutes ses données** (JSON,
  les trois sites), état des CGU, **demande de suppression du compte**
  (annulable tant qu'elle n'est pas traitée).
- Inscription : case « J'accepte les CGU et la politique de
  confidentialité » obligatoire. Les comptes existants voient un bandeau
  pour accepter la version du 15 octobre 2026.
- Pied de page : CGU · Confidentialité · Mes données.
- Titre de l'onglet du navigateur = nom de la page.

## Pages publiques
- `/cgu` et `/confidentialite`, lisibles sans compte, sur les trois sites
  (même texte, adapté à chaque site).
- Nouvelle version des textes = changer `TERMS_VERSION` / `TERMS_DATE` dans
  `src/components/legal/LegalContent.tsx` (copie identique dans les trois
  dépôts) : tout le monde devra ré-accepter.

## Suppression d'un compte
1. Le membre demande la suppression (Mes données) → alerte + bandeau sur sa
   fiche.
2. Un admin ouvre la fiche : **Supprimer définitivement** (efface dossier,
   messages, argent, objets, activité, entreprises fondées, puis le compte de
   connexion) ou **Refuser** avec un motif.
3. Impossible pour un fondateur, ni sur soi-même, ni sans demande en cours.
   Le journal d'audit garde la trace « Compte supprimé ».
Délai annoncé aux membres : 30 jours au plus.

## Conservation des données (automatique, une fois par jour)
- Journal de connexions : 13 mois.
- Notifications lues : 6 mois.
- Alertes traitées : 1 an.
- Journal d'audit : 3 ans.

## Divers
- Polices auto-hébergées (`@fontsource`) : plus d'appel à Google Fonts
  (adresse IP des visiteurs non transmise à Google).
- Libellés du journal d'audit déplacés dans `src/lib/auditLabels.ts`
  (partagés avec la fiche membre).
