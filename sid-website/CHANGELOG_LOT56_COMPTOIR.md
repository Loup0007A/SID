# Lot 56 : refonte du Comptoir, astuces désactivables

**Migration : `supabase/migrations/0075_astuces_off.sql`**, à lancer après `0074` (peut être relancée).

## Comptoir du S.I.D.
- **Images bien cadrées** : l'objet est montré **en entier**, quelle que soit
  la forme de la photo (portrait, panoramique, fond blanc), posé sur un fond
  tiré de la photo elle-même. Fini les bagues coupées en deux.
- **Vitrine** : recherche, filtres (en promo, avec un effet, dernières
  pièces, avec leur nombre), tri (nouveautés, prix, nom). Chaque carte :
  pastilles « −25 % », « Effet », « Plus que 3 », le vendeur (ou son
  entreprise), prix barré et date de fin de promo.
- **Fiche d'objet** (toucher une carte ou « Acheter ») : grande image,
  description complète, **quantité**, total et **ta bourse après achat** ;
  bouton grisé si tu n'as pas assez de zénis. Sur téléphone, la fiche monte
  du bas de l'écran.
- **Mes achats** : tout ce que tu as acheté, avec le total dépensé.
- **Mes objets en vente** : prix, promo, fin de promo et **stock** modifiables
  sur une ligne, retirer / remettre en vente, ventes (chiffres + courbe).
- **Nouvel objet** : glisser-déposer de l'image et **aperçu en direct** de la
  carte telle qu'elle apparaîtra en vitrine.
- Messages de confirmation en bas de l'écran ; avertissement si le solde est
  négatif (achats bloqués).

## Tuto : couper les astuces
- Chaque astuce en haut de page a un bouton **« Ne plus afficher les
  astuces »**.
- Menu **?** : interrupteur **« Astuces en haut des pages »** (pour les
  rallumer), et « Revoir les astuces déjà lues ». « Astuce de cette page »
  marche même quand elles sont coupées.
- Le réglage suit le membre d'un appareil à l'autre.

## Correctif
- Certaines actions du tuto n'étaient jamais enregistrées (astuce lue,
  « Plus tard » de l'invitation, étape en cours de la visite) : un appel à la
  base partait sans être envoyé. C'est réparé : une astuce lue ne revient
  plus, et la visite se reprend là où on l'a laissée.
- Le tuto et le Guide disaient que tout agent peut vendre au Comptoir : seuls
  les membres qui en ont le droit le peuvent. Textes corrigés.
