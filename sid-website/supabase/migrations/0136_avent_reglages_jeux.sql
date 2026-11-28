-- =====================================================================
-- 0136 — Calendrier de l'avent : consignes et contrôle des scores des
-- mini-jeux après les réglages de difficulté (Lot 103 ter).
--   * bowling : puissance, verglas, 10 points par quille (1 000 au plus) ;
--   * baby-foot : barres indépendantes ;
--   * glouton et boules de neige : accélération exponentielle ;
--   * casse-cadeaux : plus dur, moins de points ;
--   * pile de cadeaux : plus de points.
-- Rejouable.
-- =====================================================================
insert into public.avent_jeux (jeu, nom, consigne, min_secondes, score_max, score_par_seconde) values
  ('babyfoot', 'Baby-foot des lutins', 'Un match de 90 secondes contre les lutins. Chacune de tes trois barres bouge seule. 100 points par but marqué, 40 de moins par but encaissé.', 60, 4000, 25),
  ('bowling', 'Bowling des bonshommes de neige', '5 manches de 2 lancers : choisis le départ, la direction puis la puissance, et compense le verglas qui fait dériver la boule. 10 points par quille, strike +100, spare +50.', 12, 1100, 60),
  ('glouton', 'Le Glouton du réveillon', 'Mange tous les chocolats du labyrinthe sans te faire attraper. Les étoiles retournent les lutins. Chaque niveau vidé accélère le jeu. 3 vies.', 3, 60000, 300),
  ('cassebriques', 'Casse-cadeaux', 'Renvoie la boule de neige avec ta luge et ouvre tous les paquets (2 à 12 points, ceux du haut demandent plusieurs coups). La boule accélère à chaque renvoi. 3 vies.', 3, 20000, 80),
  ('traineau', 'Le Traîneau', 'Ramasse les cadeaux, ton attelage s''allonge. Ne touche ni les bords ni tes rennes.', 2, 6000, 35),
  ('boules', 'Bataille de boules de neige', '45 secondes : touche les lutins qui sortent, jamais les bonshommes de neige. Chaque lutin touché accélère le jeu ; les séries font monter le multiplicateur.', 40, 20000, 260),
  ('pile', 'Pile de cadeaux', 'Lâche chaque paquet au bon moment pour monter la pile. Ce qui dépasse tombe. 25 points par paquet, 40 pour un dépôt parfait.', 1, 15000, 200)
on conflict (jeu) do update set nom = excluded.nom, consigne = excluded.consigne, min_secondes = excluded.min_secondes,
  score_max = excluded.score_max, score_par_seconde = excluded.score_par_seconde;
