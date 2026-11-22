# Lot 98 — Journal du compte, alerte de nouvel appareil, rappels, épingles, contraste renforcé, comparateur du Wiki

## À lancer dans Supabase

Dans cet ordre, après celles du Lot 97 :

1. Dossier Central `0125_journal_rappels_epingles.sql`
2. Dossier Central `0126_devlog_journal_rappels_epingles.sql`

Les deux peuvent être relancées. Rien à lancer pour le Wiki ni la Cartographie.

## Journal du compte (Mes données)

Ce qui s'est passé sur le compte depuis un an, du plus récent au plus ancien,
filtrable (connexions, réglages et données, équipe) :

- connexions, avec l'appareil (« Chrome sur Windows ») et l'adresse IP ;
- sessions fermées depuis « Appareils connectés » ;
- réglages : surnom, photo, fiche, confidentialité, notifications, affichage,
  conditions acceptées ; « par l'équipe » quand un admin les a changés ;
- export des données, demandes de suppression du compte ;
- actions de l'équipe sur le compte, liste fermée : rôle reçu ou retiré,
  permission du rôle, session fermée, dispense d'absence, visibilité. Rien
  d'interne (notes, alertes, journal d'audit complet) n'y apparaît ;
- événements de Supabase Auth des 90 derniers jours (compte créé, mot de
  passe changé, lien de récupération demandé, identifiants modifiés,
  déconnexion), lus dans `auth.audit_log_entries` s'il existe.

Technique : table `journal_compte` (lisible seulement par `journal_mon_compte()`),
remplie par `_journal_noter()` ; un déclencheur sur `profiles` note les
réglages. La même chose par la même personne dans les 10 minutes ne fait
qu'une ligne. Lignes de plus d'un an effacées.

## Alerte de nouvel appareil

`_appareils_scanner()` relève les sessions ouvertes depuis son dernier
passage : chaque minute avec `run_scheduled_jobs` (pg_cron), et à chaque
lecture du journal. Chaque session donne une ligne « Connexion » dans le
journal. Un navigateur et un système jamais vus sur le compte
(`appareils_connus`) envoient une notification « Connexion depuis un nouvel
appareil » (type `securite`, aussi en push, non désactivable). La première
connexion d'un compte ne déclenche rien, ni les sessions déjà ouvertes au
moment de la migration.

Limite : l'appareil est reconnu par son navigateur et son système. Un second
ordinateur Windows avec Chrome ne déclenche pas d'alerte.

## Rappels personnels (Calendrier)

« + Rappel », ou un clic sur un jour vide : titre, date, heure ou « toute la
journée », note, notification. La notification (`rappel`, réglable dans
Réglages → Notifications) part à l'heure dite, ou à 8 h pour un rappel sur la
journée ; un rappel en retard de plus de 24 h (tâches arrêtées) n'est pas
envoyé. Le lien de la notification ouvre le Calendrier sur le bon jour
(`?jour=AAAA-MM-JJ`). Modifier, supprimer, ajouter à l'agenda (.ics).
300 rappels à venir au plus.

## Épingles

- On épingle un membre (sa fiche), une quête (liste des quêtes), un lieu
  (fenêtre du lieu sur la carte, intérieur, plan de ville) ou un bâtiment.
- Les favoris du Wiki sont les épingles des fiches. Les lieux favoris de la
  carte, gardés jusqu'ici sur un seul appareil, deviennent des épingles du
  compte (recopiés une fois, au premier passage sur la carte).
- Affichage : accueil du Dossier Central (sous les raccourcis), et en tête
  de la recherche Ctrl+K sur les trois sites quand rien n'est tapé.
- `mes_epingles()` ne renvoie que ce que le membre voit encore (mêmes règles
  que la recherche : comptes invisibles, quêtes privées, brouillard de la
  carte). 40 épingles au plus, hors favoris du Wiki. Lisible hors ligne sur
  la Carto.
- Code : `src/components/Epingles.tsx`, identique sur les trois sites.

## Contraste renforcé

Réglages → Affichage → Contraste : Normal, Renforcé, Selon l'appareil (suit
« augmenter le contraste » du système, `prefers-contrast: more`, choix par
défaut). Classe `contraste-fort` sur `<html>`, posée avant le premier
affichage comme les autres réglages, sur les trois sites :

- textes estompés pleins (variable `--attenue` dans `tailwind.config.ts`) ;
- fond uni, sans motif ni particules ; cartes pleines ;
- bordures fines marquées ; cadre de focus de 3 px ;
- couleurs choisies par un membre ou un admin (`data-contraste-libre` :
  titres, rôles) remplacées par la couleur du texte, sauf dans les aperçus.

Les tests d'affichage ont deux modes de plus (contraste, sombre + contraste),
où aucun texte ne doit être sous 4,5:1 (3:1 pour les grands titres).

## Comparateur (Wiki)

`/comparer?a=mobs/001&b=mobs/004` : bouton « Comparer » sur chaque fiche
découverte, entrée du menu. Fiche signalétique alignée par intitulé, rareté,
mots-clés (communs en gras), résumé. Deux nombres de même unité : le plus
grand est marqué ▲. Fiches non découvertes refusées. Sans table.
