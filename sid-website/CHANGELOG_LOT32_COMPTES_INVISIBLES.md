# Lot 32 — Comptes invisibles

Migration : `supabase/migrations/0058_comptes_invisibles.sql` (après 0057).

## Ce que fait un compte invisible
- Il n'apparaît plus aux autres membres : trombinoscope, rôles, classement,
  carte, organigramme (son poste s'affiche vacant), profil public
  (« introuvable »), et listes de choix (nouvelle conversation, ajout à un
  groupe, bénéficiaire d'une quête, embauche dans une entreprise).
- Ce qu'il écrit ou fait reste signé de son nom (messages, quêtes,
  boutique, raids…). Il peut toujours écrire aux autres.
- Le membre lui-même et la gestion des comptes (`manage_users`) le voient
  toujours, avec un badge 👻.

## Qui peut l'activer
- Le membre : **Mon dossier → Compte invisible** (enregistré tout de suite).
- La gestion des comptes : **Administration des comptes → Rendre
  invisible / Rendre visible**.
- Personne d'autre (protégé en base, même pour la permission `recruit`).
- Chaque changement est inscrit au journal d'audit (« Compte rendu
  invisible / visible », par le membre ou par l'administration).

## Carte
- Un compte invisible est retiré de la carte (y compris sur SID-map) et y
  reste masqué tant qu'il est invisible. Redevenu visible, il réapparaît.

## Sécurité
- `get_visible_profile` utilise désormais l'utilisateur connecté au lieu du
  paramètre `viewer` envoyé par le navigateur (on ne peut plus se faire
  passer pour quelqu'un d'autre pour lire les champs masqués).
