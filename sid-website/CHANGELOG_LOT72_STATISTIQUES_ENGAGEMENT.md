# Lot 72 — Statistiques d'engagement : rétention, temps passé

## À lancer dans Supabase

`supabase/migrations/0089_statistiques_engagement.sql`, après 0088 (rejouable).

## Administration → Statistiques : trois nouveaux blocs

### Fréquentation
- Membres venus aujourd'hui, sur 7 jours et sur 30 jours, avec leur part de
  l'ensemble des membres.
- Fidélité : part des actifs du mois présents un jour donné (moyenne des
  actifs quotidiens ÷ actifs du mois).
- Nouveaux inscrits (7 et 30 jours).
- Retours : membres revenus cette semaine après au moins un mois d'absence.
- Courbe sur 30 jours : membres venus et inscriptions.

### Rétention (sur tout l'historique des visites)
- Taux de retour après l'inscription :
  - le lendemain ;
  - la 2e semaine (jours 7 à 13) ;
  - le 2e mois (jours 30 à 59).
- Cohortes : pour chaque semaine d'inscription (10 dernières), le % de ces
  inscrits revenus chacune des 8 semaines suivantes.
- Membres perdus : part des membres venus il y a 30 à 60 jours qui ne sont
  pas revenus ce mois-ci.
- Régularité : nombre de jours de visite sur 30 jours, par membre.
- À relancer : membres venus au moins 3 jours ces 60 derniers jours, mais
  plus vus depuis 14 jours.

### Temps passé (mesuré à partir du lancement de la migration)
- Durée d'une session (moyenne et médiane), temps par membre et par jour,
  sessions par jour, pages par session, heures cumulées sur 7 jours.
- Part du temps où l'onglet reste ouvert sans activité. Ce temps n'est pas
  compté.
- Courbe des minutes par membre et par jour.
- Pages où l'on reste, avec le temps par visite.
- Répartition des durées de session.
- Appareils : téléphone, tablette, ordinateur.
- Carte jour × heure du temps actif.
- Les membres les plus présents sur 7 jours.

## Comment le temps est mesuré

- Le signal de présence (toutes les 45 s) ouvre ou prolonge une session.
  Après 10 minutes sans signal, la session est close.
- Le temps entre deux signaux (2 minutes au plus) compte comme actif si le
  membre n'est pas absent, c'est-à-dire si l'onglet n'est pas caché et s'il
  a cliqué ou tapé dans les 5 dernières minutes. Il est aussi attribué à la
  page affichée.
- Les comptes du bac à sable ne sont pas comptés.
- Les données de plus d'un an sont effacées.
- Le site envoie le type d'appareil. Si la migration n'est pas encore
  lancée, il continue de fonctionner sans.

## Vérifié

- Sessions :
  - ouverture ;
  - temps actif ou absent ;
  - changement de page et temps attribué à la page quittée ;
  - écart plafonné et nouvelle session après une pause ;
  - ancien appel sans appareil ;
  - tables illisibles par les membres, statistiques réservées aux admins.
- Calculs vérifiés sur 36 agents de test, avec 10 semaines de visites et
  30 jours de sessions.
- Captures des trois blocs, `npm run build` sans erreur.
