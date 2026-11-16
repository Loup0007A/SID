# Lot 80 — Lieu inconnu, chat Admin, élection du Dictateur

## À lancer dans Supabase, dans cet ordre

1. Cartographie : `supabase/migrations/0116_lieu_inconnu.sql`, après 0115.
2. Dossier Central : `supabase/migrations/0097_chat_admin.sql`, après 0096.
3. Dossier Central : `supabase/migrations/0098_election.sql`, après 0097
   (partie du titre scellée).

Les trois migrations sont rejouables.

## 1. Lieu inconnu (L'Envers de la Cartographie)

Nouvelle section **« Effacer sa trace »** dans le panneau de L'Envers, avec le
bouton **« Brouiller ma position »**.

### Pour les autres membres
- Le membre apparaît comme un bug de la carte : un carré de pluie Matrix
  (glyphes verts qui défilent, déchirures rouge et cyan) avec l'étiquette
  « LIEU INCONNU ».
- Le carré saute d'un endroit à l'autre toutes les 2 à 5 secondes.
- Dans « Présences », son lieu s'affiche « Lieu inconnu », en texte qui se
  corrompt.
- Son vrai lieu n'est jamais envoyé : la base renvoie la ligne sans lieu ni
  trajet, et il n'est plus lisible par la table ni par le temps réel.

### Pour lui
- Il garde sa position normale, avec un cadre glitché autour de son marqueur.
- « Ma position » et la page Carte du Dossier Central indiquent : « Pour les
  autres : Lieu inconnu ».

### Règles
- **Activer** : seulement avec un accès à L'Envers, c'est-à-dire faille
  trouvée depuis moins d'une heure, Chemin sans fin en cours, ou admin de
  L'Envers.
- **Couper** : à tout moment, depuis L'Envers ou depuis « Ma position »
  (« Rétablir ma position »).
- Une écriture directe dans la table est refusée : tout passe par
  `position_glitch()`.
- Les autres membres voient le changement tout de suite, sans recharger la
  page.
- **Respect des réglages d'animation** : si le système demande moins
  d'animations, le texte reste fixe et le marqueur ne tremble plus.

## 2. Chat Admin

Nouveau salon **Admin** en tête de la messagerie.

### Membres
- Les comptes actifs au grade Fondateur (rôle ou statut) et ceux qui ont
  « Gérer les comptes ».
- Jamais un compte de test.
- La base tient la liste à jour à chaque changement de rôle, de permission,
  de statut ou de compte de test. Un membre qui perd son droit perd le salon
  tout de suite.
- Personne ne peut s'y ajouter à la main ni créer un autre salon Admin.

### Réservé au maître du salon (Kuro, `app_config.admin_chat_owner`)
- **Épingler / désépingler** un message.
  - Les messages épinglés s'affichent en haut du salon, avec « Voir dans le
    fil ».
  - Les longs messages sont repliés, avec « Lire en entier ».
  - Sur téléphone, le bandeau commence replié.
- **Liens vers les autres lieux du S.I.D.** : le bouton « Lien » propose les
  pages du site (y compris l'administration), des raccourcis (retraits à
  valider, caisse commune), la Cartographie, le Wiki, les simulations, ou une
  adresse libre. Le lien s'affiche comme un bouton.
  - Seuls les liens du maître deviennent des boutons. Chez les autres, le
    texte reste tel quel.
- **Supprimer** n'importe quel message du salon.

### Écriture
- Plusieurs lignes : Entrée envoie, Maj + Entrée va à la ligne.
- Modifier un message garde aussi les sauts de ligne.

### Règles d'or de base
Posées au nom de Kuro et épinglées dès que son compte existe :

1. Vérifier le motif de chaque retrait avant de le valider.
2. Jamais pour soi.
3. Toute sanction a un motif écrit.
4. En cas de doute, demander ici ; une décision lourde se prend à deux.
5. Une erreur se corrige et se signale.
6. Vérifier le journal d'audit avant d'accuser.
7. Ni faveur ni représailles.
8. Ce qui se dit ici reste ici.

Kuro peut les modifier ou en épingler d'autres.

## 3. Élection du Dictateur

Mini-événement de fête, sans vote. Le S.I.D. désigne l'élu ; il reçoit
l'annonce, le décor et le titre de l'événement, aucun grade ni droit.

### Réglage
Modération → Affichage événementiel → Élection du Dictateur :
- l'élu, choisi parmi les membres actifs ou laissé vide pour plus tard ;
- le début (compte à rebours), la proclamation et la fin de l'affichage.

L'affichage « Automatique » suit ces dates.

### Avant la proclamation
- **Décor** : projecteurs, confettis, fanions pourpre et or.
- **Accueil** : phrase d'annonce et compte à rebours.
- **Pied de page** : une couronne qui lance des confettis.
- Personne ne voit le nom de l'élu : le serveur ne le donne qu'à l'heure dite.

### À la proclamation
- **Cérémonie** : « Le Conseil du S.I.D. a délibéré. » → « Le nouveau
  Dictateur est… » → portrait couronné, nom, confettis, « Vive le
  Dictateur ! ».
  - Une fois par membre et par élection. Elle s'ouvre même sur une page
    déjà ouverte, sans recharger.
  - L'accueil propose « Revoir la proclamation ».
- **Accueil** : portrait de l'élu jusqu'à la fin de l'affichage.
- **Titre** : l'élu reçoit le titre « Dictateur ».
- **Annonce** : tout le S.I.D. est prévenu par une notification.
- **Sans élu** : la page annonce que le Conseil délibère encore.

Une nouvelle date de proclamation compte comme une nouvelle élection.

**Cartographie et Wiki** : fanions, confettis et une étiquette (date de la
proclamation, puis « Vive …, Dictateur du S.I.D. ! »). Sur téléphone,
l'étiquette n'apparaît que sur le Wiki.

### Titre « Dictateur »
- Pourpre et or, aura de confettis et couronne.
- La remise au moment de la proclamation est dans la partie scellée de 0098,
  comme les autres titres.
- **Pouvoir : Décret du Dictateur** (10 minutes).
  - Roulement de tambours, puis un parchemin se déroule sur le site de la
    cible : « Par ordre du Dictateur … », le texte du décret, le sceau.
  - La cible doit contresigner pour le refermer.
  - Un nouveau décret tombe toutes les trois minutes.
  - Réglages :
    - texte du décret (80 caractères, `{cible}` = son pseudo, sinon tiré au
      hasard) ;
    - sceau or, pourpre ou noir ;
    - pluie de confettis.

## RPC

- Cartographie : `position_glitch(p_on)` ; `list_active_positions()` réécrite.
- Chat : `admin_chat_open()`, `admin_chat_pin()`, `admin_chat_delete()`.
- Élection : `election_status()` (public), `election_admin()`,
  `election_set()`.
