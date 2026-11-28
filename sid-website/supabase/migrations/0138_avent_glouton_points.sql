-- =====================================================================
-- 0138 — Calendrier de l'avent : points du Glouton divisés par 6
-- (chocolat 4, étoile 20, lutins 80 à 640, niveau vidé 200). Consigne et
-- contrôle des scores ajustés. Rejouable.
-- =====================================================================
insert into public.avent_jeux (jeu, nom, consigne, min_secondes, score_max, score_par_seconde) values
  ('glouton', 'Le Glouton du réveillon', 'Mange tous les chocolats du labyrinthe sans te faire attraper (4 points). Les étoiles (20) retournent les lutins (80, 160, 320, 640). Chaque niveau vidé (+200) accélère le jeu. 3 vies.', 3, 25000, 140)
on conflict (jeu) do update set nom = excluded.nom, consigne = excluded.consigne, min_secondes = excluded.min_secondes,
  score_max = excluded.score_max, score_par_seconde = excluded.score_par_seconde;
