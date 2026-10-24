# Lot 47 : le ciel de Varyexis

**Migration : `supabase/migrations/0069_ciel_varyexis.sql`**, à lancer après
`0068` (peut être relancée). `0068` contient déjà les options de la nouvelle
farce : si elle est relancée plus tard, rien ne se perd.

Un secret de la Grande Chasse (du 9 au 15 mars), autour de Varyexis, le monstre
qui fit l'Équilibre du monde.

## L'étoile filante
Pendant la Grande Chasse, **la nuit** (de 21 h à 6 h, heure de Paris), le
campement passe au clair de lune (lune, ciel étoilé, phrases d'accueil de nuit)
et, de temps en temps, une étoile filante traverse le ciel de **l'accueil** du
Dossier Central, et seulement là. Il faut cliquer dessus pendant qu'elle passe.

## Le ciel de Varyexis
L'étoile mène dans un ciel entièrement étoilé, où le signe de Varyexis se trace
en constellation : une balance qui porte le monde, sous une couronne
d'étoiles, avec l'œil de l'Équilibre au centre (dessin dans
`src/components/seasonal/varyexisArt.tsx`, facile à redessiner : une liste
d'étoiles et une liste de traits).

La tablette des Enfants de l'Équilibre pose l'énigme. La réponse est vérifiée
par le serveur (code scellé) : 15 essais manqués par jour au plus, et quelques
indices apparaissent après 3, 6 et 10 essais.

## Le titre : Enfant de l'Équilibre
La bonne réponse donne le titre (présenté comme un titre de la Grande Chasse
dans la vitrine). Son aura : un ciel étoilé et une petite balance.

**Pouvoir : Balance de Varyexis** (10 minutes). Le site de la cible est posé sur
la balance : des étoiles tombent dans ses plateaux et, dès qu'elle penche,
toute la page penche avec (par à-coups). La cible la rééquilibre en retirant
des étoiles du plateau le plus lourd (un clic par étoile). Réglages : la pluie
d'étoiles (paisible, soutenue, averse), à quel point la page penche, le signe
de Varyexis dans le ciel, et une phrase gravée sous la balance.
