# Lot 76 — Roue du jour, pénalité d'absence, affichage sur téléphone

## À lancer dans Supabase

`supabase/migrations/0093_roue_absences.sql`, après 0092 (rejouable).

## 1. Roue du jour

Un tour gratuit par jour, remis à zéro à minuit (heure de Paris).

### Série et chances
- **Série** : nombre de jours de visite d'affilée. Un jour manqué la remet à 1.
- **Gains** : définis par les admins dans Administration → Économie → Roue
  du jour. Cinq types : zénis, renommée, objet de la boutique, titre, rien.
- **Chances** : chaque gain a un poids au 1er jour de série et un poids à la
  série maximale (30 jours, réglable). Entre les deux, le poids évolue en
  ligne droite.
  - Chance d'un gain = son poids ÷ la somme des poids.
  - Un gain rare sort plus souvent avec la série si son poids à 30 jours est
    plus grand que son poids au 1er jour.
- **Série minimale** : un gain peut n'apparaître qu'à partir d'une série
  donnée (par exemple le gros lot dès 7 jours).
- **Disponibilité** : un objet épuisé sort de la roue. Un titre déjà au niveau
  maximum sort de la roue pour ce membre seulement.
- **Réformes monétaires** : les montants en zénis les suivent. Le nom des gains
  en zénis et en renommée est le montant lui-même, toujours à jour.

### Gains de départ

| Gain | Poids 1er jour → 30 jours | Dès |
| --- | --- | --- |
| 50 z | 30 → 16 | |
| 150 z | 22 → 16 | |
| +5 renommée | 14 → 10 | |
| Rien | 16 → 6 | |
| 400 z (rare) | 10 → 16 | |
| +20 renommée (rare) | 5 → 10 | |
| 1 500 z (épique) | 2,5 → 9 | 3 jours |
| 5 000 z (légendaire) | 0,5 → 4 | 7 jours |

Chances des gains épiques et légendaires réunis : 0 % au 1er jour, 7,5 %
à 13 jours, 15 % à 30 jours.

### Côté membre
- **Ouverture** : au premier passage du jour, la roue s'ouvre sur l'accueil.
  Elle attend la fin de la visite guidée. « Plus tard » la referme jusqu'au
  lendemain.
- **Rappel** : tant que le tour n'est pas joué, « À faire » affiche « Roue du
  jour à tourner ».
- **Page Roue du jour** (Le S.I.D.) :
  - la roue ;
  - la série ;
  - les chances de chaque gain aujourd'hui, demain et à 30 jours ;
  - les 14 derniers tours.
- **Tirage** : il se fait sur le serveur, puis la roue s'arrête sur la part
  gagnée. Chaque part est proportionnelle à la chance du gain.
- **Remise des gains** :
  - zénis : versés sur le solde ;
  - renommée : ajoutée tout de suite ;
  - objet : arrive comme un achat à 0 z, à livrer comme d'habitude ;
  - titre : attribué, ou monté d'un niveau.

### Côté admin (onglet Roue du jour)
- Ouvrir ou fermer la roue, régler la série maximale.
- Gains : chances à 1, 7 et 30 jours, nombre de fois gagné en 30 jours,
  création, modification, suppression. Pendant la saisie, la chance s'affiche
  en direct.
- Statistiques : tours du jour et sur 30 jours, zénis distribués, derniers
  tours, plus longues séries en cours.
- Chaque modification est inscrite au journal d'audit.

## 2. Pénalité d'absence

### Calcul
Après 7 jours complets sans visite, chaque jour d'absence coûte
**200 z × le nombre de jours d'absence** :
- 1 400 z pour le 7ᵉ jour, 1 600 z pour le 8ᵉ, et ainsi de suite ;
- soit 3 000 z au bout de 8 jours, 16 800 z au bout de 14 jours, 88 800 z au
  bout de 30.

Le jour est compté une fois terminé : revenir dans la journée suffit à ne pas
payer pour ce jour-là.

### Ordre des prélèvements
1. **Actions**, au cours du jour, la plus grosse ligne d'abord. Les ordres
   ouverts du membre sont annulés. Les actions reviennent à l'entreprise
   (actions en trésorerie). Si la dernière action vaut plus que le reste
   dû, l'entreprise rend la monnaie, si sa trésorerie le permet.
2. **Épargne** en banque.
3. **Solde**.
4. **Dette** : le reste devient un emprunt, avec les intérêts habituels.

Les parts 2 à 4 vont dans la caisse commune.

### Prévenir le membre
- Notification (et push) à 5 jours d'absence, puis à 6 (« dernier jour avant
  la pénalité »).
- Notification à chaque prélèvement, avec le détail et le montant du
  lendemain.
- Page Banque : « Absence prolongée : −X z en 30 jours », avec le détail.
  Tant qu'il n'y a pas eu de prélèvement, une simple ligne rappelle la règle.
- La règle figure aussi dans le Guide et dans les astuces de la Banque.

### Côté admin (onglet Absences)
- Activer ou couper la pénalité, régler le délai (7) et le montant par jour
  (200).
- Membres absents depuis au moins 4 jours : jours d'absence, prochain
  prélèvement, actions, épargne, solde, dette, montant déjà pris.
- Dispense jusqu'à une date, avec une raison (vacances, examens…).
- Derniers prélèvements.

### Démarrage
- Les absences comptent à partir du jour de la migration
  (`inactivity_start_day`) : personne n'est pénalisé pour une absence plus
  ancienne. Les premiers prélèvements tombent donc au plus tôt 7 jours après.
- Les comptes en bac à sable et les comptes non actifs ne sont pas concernés.
- Une réforme monétaire réduit le montant par jour comme les autres tarifs.

## 3. Affichage sur téléphone

### Méthode
Chaque page du tableau de bord a été contrôlée à 390, 360 et 320 px de
large, avec des textes longs : pseudos sans espace, liens, noms d'entreprise.
Les pages principales ont aussi été vérifiées sur captures.

### Corrections
- **Mots très longs** : ils passent à la ligne partout au lieu de sortir du
  cadre (pseudos, liens, notifications, journal d'audit).
- **Profil, fiche admin d'un membre, classement** : un pseudo long ne déborde
  plus.
- **Statistiques** : le tableau « Quand on vient » défile dans son cadre au
  lieu d'élargir la page.
- **Bourse** :
  - le graphique se resserre jusqu'à 320 px ;
  - les dates de l'axe ne se chevauchent plus et ne sont plus coupées aux
    bords ;
  - « début de période » ne passe plus sur « Aucun échange ».
- **Administration → Économie** :
  - la barre d'onglets s'estompe sur les bords pour montrer qu'elle défile ;
  - dans le tableau des membres, les montants ne se coupent plus en deux
    lignes et la dernière colonne n'est plus tronquée.
- **Boutique** : les onglets passent à la ligne au lieu d'être coupés.
- **Modération** : le message d'une section suspendue prend toute la largeur.
- **Roue du jour (admin)** : le formulaire de modification s'ouvre à l'écran.

## RPC

- Roue : `wheel_status`, `wheel_spin`, `wheel_admin`, `wheel_prize_save`,
  `wheel_prize_delete`, `wheel_settings_save`, `member_streak`.
- Absences : `my_inactivity`, `inactivity_admin`, `inactivity_settings_save`,
  `inactivity_exempt`.
- `process_inactivity` est appelée chaque jour par `run_scheduled_jobs`.
