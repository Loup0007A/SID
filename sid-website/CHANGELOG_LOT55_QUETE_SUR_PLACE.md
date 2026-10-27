# Lot 55 : une quête liée à un lieu se prend sur place

**Migration : `supabase/migrations/0074_quete_sur_place.sql`**, à lancer après `0073` (peut être relancée).

- Une quête qui a un **lieu** ne peut être prise que si ton personnage est
  **à ce lieu, arrivé** (pas en plein trajet ni en vol). Vérifié par la base :
  impossible de contourner.
- Les quêtes **sans lieu** se prennent de partout, comme avant.
- Un **responsable des quêtes** qui inscrit quelqu'un d'autre passe outre,
  comme pour les autres prérequis.
- Sur la fiche : « À prendre sur place » (bouton grisé) et « Elle se prend
  sur place, à Lieu X : lance le trajet ci-dessus » ; le bouton « Lancer le
  trajet » est juste au-dessus. Une fois arrivé, le bouton redevient
  « Prendre la mission ».
- Une fois inscrit, rester une heure sur place valide toujours la quête
  (récompense et renommée).
- Tuto et Guide du S.I.D. mis à jour.
