# Lot 93 — Réglages refaits, mode sombre, mode épuré

Migrations : `0114_reglages_notifications.sql`, puis `0115_devlog_reglages.sql`
(entrée du devlog), après 0113.

## Page Réglages
- Sommaire par sujet (colonne collante sur ordinateur, pastilles qui
  défilent sur téléphone) ; l'adresse garde le sujet ouvert
  (`#apparence`, `#notifications`, `#confort`, `#confidentialite`,
  `#compte`, `#guide`).
- **Apparence** : les quatre places (organigramme, trombinoscope,
  classement, fiche) en tuiles avec leur état ; sept styles prêts (Sobre,
  Or impérial, Néon, Braise, Givre, Forêt, Arc-en-ciel) ; éditeur visuel
  regroupé (bordure, fond, lueur et accent, animation) ou CSS ; aperçu en
  direct sur le fond du site ; barre d'enregistrement qui signale les
  modifications non enregistrées ; « Appliquer aux 4 places ».
- **Notifications** : push de cet appareil ; pour chaque sujet, partout,
  sur le site seulement ou jamais ; heures calmes (pas de push entre deux
  heures, heure de Paris). Quêtes, candidatures, appels de raid, annonces,
  sanctions, impôts, litiges et absences restent toujours reçus.
- **Affichage** (cet appareil) : thème clair, sombre ou selon l'appareil ;
  mode épuré ; taille du texte (normale, grande, très grande) ; animations
  vivantes ou calmes ; décors des fêtes ; curseur.
- **Confidentialité** : présence en ligne, compte invisible, champs
  masqués (déplacés depuis Mon dossier).
- **Compte** : adresse de connexion, mot de passe (avec force), déconnexion
  de tous les appareils, lien vers Mes données.
- **Guide** : astuces de première visite (afficher, revoir), visite guidée.

## Mode sombre
- Fond de nuit, cartes en plaques sombres à texte clair ; accents des
  évents gardés ; fiches de quête et cartes de rang gardent leur papier ;
  coup d'État : nuit rouge sang.

## Mode épuré
- Fond uni sans motif ni particules, contours fins sans ombre pleine,
  titres sans contour, étiquettes droites, pas de guirlandes ni de décors
  des fêtes (le décor de l'élection reste pour le thème du coup d'État).

## Ailleurs
- Mon dossier garde la fiche, la photo, l'anniversaire et les achats ; un
  lien mène aux Réglages.
- Le lien « Ce que les autres voient de toi » de l'accueil ouvre
  Réglages → Confidentialité ; la visite guidée montre les notifications
  dans Réglages.
- Réglages d'affichage posés avant le premier affichage (script du
  `<head>`, `src/lib/comfortPrefs.ts`).
