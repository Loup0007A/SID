# Lot 33 — Bac à sable (comptes de test)

Migration : `supabase/migrations/0059_bac_a_sable.sql` (après 0058).
Nécessite la clé `SUPABASE_SERVICE_ROLE_KEY` côté serveur (déjà utilisée
pour la réinitialisation des mots de passe).

## Pour qui
La gestion des comptes (`manage_users`) : nouvelle tuile **Bac à sable**
dans l'administration (`/dashboard/admin/sandbox`).

## Créer un compte de test
- Surnom (facultatif), durée (1 h à 7 jours), rang (E à S), zénis de départ.
- Permissions au choix, **jamais plus que celles de l'admin** qui le crée
  (contrôlé en base). Sans permission : un simple membre.
- Le compte est actif tout de suite et **invisible** des autres membres
  (et le reste : il ne peut pas se rendre visible).
- Identifiants affichés (email `sandbox-…@sid-quest.test` et mot de passe).

## Tester
- **Entrer dans le bac à sable** : ouvre le compte de test dans ce
  navigateur. Un bandeau jaune et noir rappelle le compte, le temps restant
  et ses permissions, avec **Revenir à <admin>** pour retrouver sa session.
- Ou coller les identifiants dans une fenêtre privée / un autre appareil
  pour garder les deux comptes ouverts (ex. tester la messagerie).
- **Identifiants** : génère un nouveau mot de passe pour un compte existant.

## Limites de sécurité
- Un compte de test ne peut pas créer d'autre compte de test ni ouvrir la
  page Bac à sable.
- Seuls les comptes créés par le bac à sable peuvent être effacés par lui.
- Expiré : plus aucune permission, écran « Compte de test expiré ».

## Nettoyage
- **Supprimer** (ou automatiquement à l'ouverture de la page, une fois
  expiré) : le compte est effacé avec ce qu'il a créé ou envoyé (quêtes,
  messages, entreprises, salons…) ; ses autres liens (poste de
  l'organigramme, relecture…) sont vidés.
- Journal d'audit : « Compte de test créé » (permissions, rang, durée,
  solde) et « Compte de test effacé ».
