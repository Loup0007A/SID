# Lot 39 : un seul système de trajet (Cartographie + Dossier Central)

## Le problème

Les deux sites écrivaient la position des personnages dans la même table
(`character_positions`) avec deux logiques différentes :

| | Site principal (avant) | Cartographie (avant) |
|---|---|---|
| Lancer | `start_travel` : vide le lieu, pas de durée | `start_journey` : garde le lieu, durée avec monture |
| Terminer | `advance_my_travel`, seulement au chargement d'une page | `arrive_at_destination`, toutes les 5 s |
| Plusieurs étapes | oui | non (l'itinéraire se calculait mais ne se lançait pas) |

Conséquences :
- un trajet lancé sur le site, puis la carte ouverte : arrivée immédiate, parfois
  au point de départ ;
- un trajet lancé sur la carte dans le sens « retour » d'une route : le site le
  terminait au point de départ ;
- sur le site, le compte à rebours restait à 0:00 et l'étape suivante ne partait
  qu'au rechargement de la page (temps perdu) ;
- un vol (Cartographie) n'était pas vu comme un trajet par le site, qui
  proposait d'en lancer un autre par-dessus ;
- un membre placé depuis la carte pouvait se « téléporter » en choisissant un
  nouveau point de départ sur le site.

## La correction

**Migration `SID-map/sid-map/supabase/migrations/0113_trajets_unifies.sql`** (une
seule fois, dans Supabase ; peut être relancée sans risque). Une seule logique
côté serveur, utilisée par les deux sites, avec les mêmes noms de fonctions :

- pendant un trajet, le lieu reste celui du départ de l'étape en cours ;
- l'itinéraire complet est enregistré, chaque étape avec sa durée figée au départ
  (monture comprise) ;
- l'étape suivante démarre à l'heure exacte où la précédente se termine, même si
  personne n'a la page ouverte ;
- durée d'une route sans temps renseigné : longueur du tracé × 2 (5 min minimum),
  partout pareil (avant : 30 min sur la carte) ;
- on ne peut pas repartir pendant un trajet, ni lancer un itinéraire qui ne part
  pas de sa position, ni rechoisir un point de départ ;
- les trajets déjà en cours au moment de la migration sont repris correctement ;
- notification « Arrivée à destination » quel que soit le site.

**Cartographie**
- Itinéraire : le départ est ta position, bouton « Partir » (plusieurs étapes).
- Fiche d'un lieu : bouton « Y aller » qui ouvre l'itinéraire vers ce lieu.
- « En voyage » : destination finale, étape en cours, temps total restant.

**Site principal (page Carte, page Quêtes)**
- Le trajet avance tout seul pendant que la page est ouverte : étape suivante,
  puis message « Tu es arrivé à … ».
- Vols et trajets lancés depuis la Cartographie reconnus.
- Destination finale, étape en cours et temps total affichés.

## Tests

Base locale (migrations de la carte + du site + 0113), puis navigateur :
itinéraire de 3 étapes lancé depuis la carte, suivi sur le site, enchaînement
automatique des étapes, arrivée signalée ; trajet lancé depuis le site, suivi
sur la carte ; route prise à l'envers ; monture (durée divisée) ; vol ; ancien
trajet en cours repris par la migration ; refus de repartir en route, de partir
d'ailleurs et de se téléporter.
