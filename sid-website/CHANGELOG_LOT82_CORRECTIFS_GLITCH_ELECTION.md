# Lot 82 — Correctifs : avatar brouillé, élu introuvable

## À lancer dans Supabase

Dossier Central : `supabase/migrations/0099_pseudos_propres.sql`, après 0098.
Rejouable. À lancer avant de réenregistrer l'élection : Modération envoie
maintenant l'identifiant de l'élu, que seule 0099 sait lire.

## 1. Avatar d'un membre en lieu inconnu

L'image était recoupée en permanence (contour aplati là où dépassaient les
reflets), puis réduite à une bande à chaque à-coup, et le visage virait au
vert.

Maintenant :
- au repos, l'avatar reste rond, avec un reflet rouge et cyan qui suit son
  contour ;
- par moments, une déchirure fine le traverse et il se décale de quelques
  pixels ; reflets plus forts et contraste un instant ;
- le placement de l'image n'est plus jamais modifié.

Sur la Cartographie, un membre sans photo garde ses initiales lisibles :
c'est le rond qui bugue, plus les lettres.

## 2. « Membre introuvable » en réglant l'élection

Cause : le pseudo enregistré gardait un espace en fin (souvent ajouté par le
clavier du téléphone à l'inscription). La liste de Modération le proposait
tel quel, mais la recherche retirait l'espace du côté du formulaire
seulement.

- **Modération** : l'élu choisi dans la liste part avec son identifiant.
- **Recherche par pseudo** : sans tenir compte des majuscules, des espaces
  autour ni des caractères invisibles. Les accents restent distincts
  (« Elodie » ne trouve pas « Élodie »).
- **Compte suspendu ou en attente** : message « Ce compte n'est pas actif ».
- **Pseudos existants** : nettoyés une fois par 0099. Ensuite, chaque pseudo
  est nettoyé à l'inscription et à chaque modification.
- **Salon Admin** : le maître (Kuro) est retrouvé de la même façon. S'il ne
  l'était pas, les règles d'or sont posées au passage de 0099.
