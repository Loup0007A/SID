-- =========================================================
-- Devlog : toutes les mises à jour de la Cartographie et du Wiki,
-- une entrée par mise à jour (depuis l'ouverture de chaque site).
-- À lancer après 0107. Peut être relancée sans risque.
-- Les entrées de 0107 sont remplacées par leur version détaillée,
-- sauf si le fondateur les a modifiées depuis la page.
-- =========================================================

update public.devlog_entries set title = 'Ouverture de la Cartographie', body = 'La carte du monde ouvre : régions, lieux et villes. Chaque ville a son plan, ses quartiers et ses bâtiments, avec leurs étages et leurs pièces. L''équipe dessine la carte ; les membres la consultent.', tag = 'nouveau', published_at = '2026-08-25 10:00+02'
 where slug = 'carto-ouverture' and body = 'La carte du monde ouvre : villes, quartiers et bâtiments, avec leurs étages et leurs pièces. Les bâtiments s''explorent aussi en 3D.';
update public.devlog_entries set title = 'Fin de la téléportation : trajets et montures', body = 'Se déplacer prend du temps : à pied par les routes, ou en vol avec une monture qu''on loue. Arrivée du relief et des biomes, des lieux qui sont aussi des bâtiments (sous-sols, escaliers), et de la quête validée en restant une heure sur place.', tag = 'nouveau', published_at = '2026-10-01 12:00+02'
 where slug = 'carto-trajets-montures' and body = 'Les déplacements prennent du temps sur les routes. On peut louer une monture pour aller plus vite. Arrivée des biomes et du relief, et des lieux qui sont aussi des bâtiments.';
update public.devlog_entries set title = 'Marchés noirs et cristaux', body = 'Certains lieux accueillent un marché noir, avec des étals tenus sur place. Les cristaux de téléportation font gagner du temps. Les quêtes terminées disparaissent de la carte.', tag = 'nouveau', published_at = '2026-10-04 12:00+02'
 where slug = 'carto-marche-noir' and body = 'Certains lieux accueillent un marché noir. Les cristaux de téléportation font gagner du temps. Les quêtes s''ouvrent depuis la carte.';
update public.devlog_entries set title = 'Textures', body = 'Montagnes, arbres, vagues… les zones et les biomes reçoivent des motifs dessinés.', tag = 'nouveau', published_at = '2026-10-08 10:00+02'
 where slug = 'carto-textures' and body = 'Les zones et les biomes reçoivent des textures dessinées à la main, réglables par l''équipe.';
update public.devlog_entries set title = 'Échelle et vols', body = 'La carte a une échelle en kilomètres. Un vol dure selon la vraie distance, la vitesse et la portée de la monture.', tag = 'nouveau', published_at = '2026-10-09 10:00+02'
 where slug = 'carto-vols' and body = 'Une échelle de distance sur la carte, les vols directs vers un lieu, et des montures qui ne passent pas partout. Un lanceur ouvre les autres sites.';
update public.devlog_entries set title = 'Visite guidée et centre d''aide', body = 'Une visite guidée présente la carte, pour les membres comme pour l''équipe. Le centre d''aide suit ce qui reste à faire, et les erreurs sont enfin affichées.', tag = 'nouveau', published_at = '2026-10-10 12:00+02'
 where slug = 'carto-accompagnement' and body = 'Une visite guidée présente la carte, un centre d''aide répond aux questions et les erreurs sont expliquées.';
update public.devlog_entries set title = 'Fenêtres, favoris et mesure', body = 'Les applications s''ouvrent dans des fenêtres déplaçables. Lieux favoris, outil de mesure (distance et temps de marche) et bouton pour revenir sur son personnage.', tag = 'nouveau', published_at = '2026-10-11 09:00+02'
 where slug = 'carto-fenetres' and body = 'Les applications s''ouvrent dans des fenêtres flottantes. Lieux favoris, outil de mesure, localisation, carte agrandissable, sélection multiple et nouveau thème animé.';
update public.devlog_entries set title = 'Carte fluide sur téléphone', body = 'La carte se manipule au doigt sans à-coups. Le panneau d''un lieu s''ouvre en bas de l''écran. Premier décor d''Halloween.', tag = 'amelioration', published_at = '2026-10-17 16:00+02'
 where slug = 'carto-telephone' and body = 'La carte se manipule mieux au doigt. Arrivée des décors d''événement, des conditions d''utilisation et de la page de confidentialité.';
update public.devlog_entries set title = 'Un seul système de trajet', body = 'Les trajets sont les mêmes sur la Cartographie et le Dossier Central, suivis en direct. Un itinéraire complet se lance en un clic, et chaque lieu a son bouton « Y aller ».', tag = 'correctif', published_at = '2026-10-18 12:00+02'
 where slug = 'carto-trajets-unifies' and body = 'Les trajets sont les mêmes sur la Cartographie et le Dossier Central, suivis en direct, et un itinéraire complet se lance en un clic.';
update public.devlog_entries set title = 'Décor de Noël', body = 'Guirlande, givre, sceau en sapin et passage du traîneau.', tag = 'nouveau', published_at = '2026-10-21 12:00+02'
 where slug = 'carto-noel' and body = 'Guirlande, givre, sceau en sapin et passage du traîneau sur la carte.';
update public.devlog_entries set title = 'Les fêtes de l''année', body = 'Chaque fête habille la carte : guirlande, survol, sceau et bords teintés.', tag = 'nouveau', published_at = '2026-10-23 12:00+02'
 where slug = 'carto-fetes' and body = 'Chaque fête habille la carte : guirlande, survol, sceau et bords teintés.';
update public.devlog_entries set title = 'Carte plus rapide', body = 'La Cartographie charge plus vite et n''attend plus le serveur à chaque page.', tag = 'amelioration', published_at = '2026-10-24 10:00+02'
 where slug = 'carto-rapidite' and body = 'La Cartographie charge plus vite.';
update public.devlog_entries set title = 'La Grande Chasse', body = 'Fanions, survol de Brasombre et bords couleur de braise pendant la Grande Chasse.', tag = 'nouveau', published_at = '2026-10-24 16:00+02'
 where slug = 'carto-grande-chasse' and body = 'Le décor de la Grande Chasse s''installe aussi sur la carte.';
update public.devlog_entries set title = 'L''Atlas', body = 'Nouvelle apparence de la Cartographie, façon atlas ancien : vélin, encre et mer à la plume.', tag = 'amelioration', published_at = '2026-10-25 14:00+02'
 where slug = 'carto-atlas' and body = 'Nouvelle apparence de la Cartographie, et des icônes dessinées à la place des émojis.';
update public.devlog_entries set title = 'Animation de connexion', body = 'À la connexion, la rose des vents trouve le nord.', tag = 'amelioration', published_at = '2026-10-27 11:00+01'
 where slug = 'carto-connexion' and body = 'À la connexion, la rose des vents trouve le nord.';
update public.devlog_entries set title = 'Accessibilité', body = 'Étiquettes, contrastes, focus visible et fenêtres utilisables au clavier.', tag = 'amelioration', published_at = '2026-10-27 13:00+01'
 where slug = 'carto-accessibilite' and body = 'Étiquettes, contrastes, focus visible et fenêtres utilisables au clavier.';
update public.devlog_entries set title = 'Jour, nuit et carnet de route', body = 'La carte suit le jour et la nuit à l''heure de Paris. Chaque membre peut écrire une note privée sur n''importe quel lieu.', tag = 'nouveau', published_at = '2026-10-27 18:00+01'
 where slug = 'carto-jour-nuit' and body = 'La carte suit le jour et la nuit à l''heure de Paris. Chaque lieu a ses notes partagées. Les quêtes apparaissent sur la carte.';
update public.devlog_entries set title = 'Contrôle technique', body = 'Sécurité de la carte vérifiée et renforcée.', tag = 'correctif', published_at = '2026-10-28 12:00+01'
 where slug = 'carto-controle' and body = 'Sécurité de la carte vérifiée et renforcée.';
update public.devlog_entries set title = 'Clic sur une quête', body = 'Plus de gros rond noir en cliquant sur une quête.', tag = 'correctif', published_at = '2026-11-05 12:00+01'
 where slug = 'carto-quete-clic' and body = 'Plus de gros rond noir en cliquant sur une quête.';
update public.devlog_entries set title = 'Noms du jeu', body = 'Le nom du jeu, de la carte et de la monnaie viennent des réglages du Dossier Central.', tag = 'admin', published_at = '2026-11-12 10:00+01'
 where slug = 'carto-noms' and body = 'Les noms du jeu viennent des réglages du Dossier Central, et l''équipe peut fermer la carte aux membres.';
update public.devlog_entries set title = 'Lieu inconnu et élection', body = 'Un membre peut brouiller sa position : il devient un bug de la carte. Décor de l''élection du Dictateur : fanions et confettis.', tag = 'nouveau', published_at = '2026-11-16 09:00+01'
 where slug = 'carto-lieu-inconnu' and body = 'Un membre en lieu inconnu disparaît de la carte et apparaît brouillé. Décor de l''élection du Dictateur.';
update public.devlog_entries set title = 'Ouverture du Wiki', body = 'Le Wiki ouvre avec quatre catégories : lieux, armes, créatures et objets. Chaque fiche a son numéro. Une fiche non découverte reste anonyme (« ? »), même pour l''équipe.', tag = 'nouveau', published_at = '2026-09-30 10:00+02'
 where slug = 'wiki-ouverture' and body = 'Le Wiki ouvre avec quatre catégories : lieux, armes, créatures et objets. Une fiche non découverte reste anonyme jusqu''à sa découverte.';
update public.devlog_entries set title = 'Commentaires et découvreurs', body = 'On commente les fiches et on mentionne les autres chasseurs. Chaque fiche peut afficher qui l''a découverte.', tag = 'nouveau', published_at = '2026-10-01 09:00+02'
 where slug = 'wiki-commentaires' and body = 'On commente les fiches et on mentionne les autres membres. Chaque fiche affiche qui l''a découverte.';
update public.devlog_entries set title = 'Compétences, 3D et rareté', body = 'Nouvelle catégorie Compétences, modèles 3D animés, fiche technique, rareté, favoris, fiche au hasard et historique des versions.', tag = 'nouveau', published_at = '2026-10-01 13:00+02'
 where slug = 'wiki-fiches-3d' and body = 'Nouvelle catégorie Compétences, modèles 3D animés, fiche technique, rareté en étoiles, favoris et fiche au hasard.';
update public.devlog_entries set title = 'Navigation et recherche', body = 'Nouvelle navigation sur ordinateur, recherche rapide et vagues animées. Les modèles 3D et les images sont allégés à l''envoi.', tag = 'amelioration', published_at = '2026-10-02 10:00+02'
 where slug = 'wiki-navigation' and body = 'Nouvelle navigation sur ordinateur et téléphone, recherche rapide et vagues animées.';
update public.devlog_entries set title = 'Notes, signalements et tags', body = 'Notes personnelles sur les fiches, signalement d''une erreur, annonce d''accueil, page des tags, nouveautés depuis ta dernière visite et fiches vues récemment.', tag = 'nouveau', published_at = '2026-10-08 12:00+02'
 where slug = 'wiki-grande-maj' and body = 'Notes personnelles sur les fiches, signalement d''une erreur, page des tags, nouveautés depuis ta dernière visite et fiches vues récemment.';
update public.devlog_entries set title = 'Page d''aide', body = 'Une page d''aide, un menu du compte et une astuce de bienvenue pour les nouveaux venus.', tag = 'nouveau', published_at = '2026-10-09 12:00+02'
 where slug = 'wiki-aide' and body = 'Une page d''aide et une astuce de bienvenue pour les nouveaux venus.';
update public.devlog_entries set title = 'Profils et porte-armure', body = 'Chaque chasseur a son profil, avec un porte-armure à équiper : tête, torse, jambes, pieds, mains et dos. Plusieurs bugs corrigés au passage.', tag = 'nouveau', published_at = '2026-10-11 09:00+02'
 where slug = 'wiki-profils' and body = 'Chaque chasseur a son profil, avec un porte-armure à équiper : tête, torse, jambes, pieds, mains et dos. Les armes ont leur forme et leur couleur.';
update public.devlog_entries set title = 'Conditions d''utilisation', body = 'Conditions d''utilisation, page de confidentialité et polices hébergées sur le site.', tag = 'admin', published_at = '2026-10-17 10:00+02'
 where slug = 'wiki-cgu' and body = 'Conditions d''utilisation, page de confidentialité et polices hébergées sur le site.';
update public.devlog_entries set title = 'Halloween', body = 'Lune, chauves-souris, toile d''araignée, citrouilles sur les vagues et mer orangée.', tag = 'nouveau', published_at = '2026-10-17 16:00+02'
 where slug = 'wiki-halloween' and body = 'Premier décor d''événement sur le Wiki.';
update public.devlog_entries set title = 'Décor de Noël', body = 'Étoile, neige, mer givrée et cadeaux sur les vagues.', tag = 'nouveau', published_at = '2026-10-21 12:00+02'
 where slug = 'wiki-noel' and body = 'Étoile, neige, mer givrée et cadeaux sur les vagues.';
update public.devlog_entries set title = 'Les fêtes de l''année', body = 'Chaque fête habille le Wiki : guirlande, objets sur les vagues, mer teintée.', tag = 'nouveau', published_at = '2026-10-23 12:00+02'
 where slug = 'wiki-fetes' and body = 'Chaque fête habille le Wiki : guirlande, objets sur les vagues, mer teintée.';
update public.devlog_entries set title = 'Wiki plus rapide', body = 'Les pages chargent plus vite. Sur une fiche, le modèle 3D remplace l''image.', tag = 'amelioration', published_at = '2026-10-24 10:00+02'
 where slug = 'wiki-rapidite' and body = 'Les pages chargent plus vite, et le modèle 3D remplace l''image sur la fiche.';
update public.devlog_entries set title = 'Grande Chasse et proie du jour', body = 'Décor de la Grande Chasse, et une proie du jour à traquer sur l''accueil pendant l''événement.', tag = 'nouveau', published_at = '2026-10-24 14:00+02'
 where slug = 'wiki-grande-chasse' and body = 'Décor de la Grande Chasse et une proie du jour à traquer.';
update public.devlog_entries set title = 'Le Codex', body = 'Le Wiki devient le Codex : un cabinet de collection, une couleur par catégorie, des fiches plus lisibles.', tag = 'amelioration', published_at = '2026-10-25 14:00+02'
 where slug = 'wiki-codex' and body = 'Le Wiki devient le Codex : cabinet de collection, une couleur par catégorie, fiches plus lisibles et icônes dessinées.';
update public.devlog_entries set title = 'Animation de connexion', body = 'À la connexion, le Codex s''ouvre.', tag = 'amelioration', published_at = '2026-10-27 10:00+01'
 where slug = 'wiki-connexion' and body = 'À la connexion, le Codex s''ouvre.';
update public.devlog_entries set title = 'Accessibilité', body = 'Étiquettes, contrastes, focus visible et fenêtres utilisables au clavier.', tag = 'amelioration', published_at = '2026-10-27 13:00+01'
 where slug = 'wiki-accessibilite' and body = 'Étiquettes, contrastes, focus visible et fenêtres utilisables au clavier.';
update public.devlog_entries set title = 'Énigme du jour', body = 'Une énigme chaque jour sur l''accueil, et les flèches du clavier pour passer d''une fiche à l''autre.', tag = 'nouveau', published_at = '2026-10-27 15:00+01'
 where slug = 'wiki-enigme' and body = 'Une énigme du jour, des paliers de découverte, et les fiches peuvent être lues à voix haute.';
update public.devlog_entries set title = 'Contrôle technique', body = 'Sécurité vérifiée et moteur du site mis à jour.', tag = 'correctif', published_at = '2026-10-28 12:00+01'
 where slug = 'wiki-controle' and body = 'Sécurité vérifiée et moteur du site mis à jour.';
update public.devlog_entries set title = 'Rareté sur une ligne', body = 'Les losanges de rareté restent sur une seule ligne dans la vue Liste.', tag = 'correctif', published_at = '2026-11-05 12:00+01'
 where slug = 'wiki-rarete' and body = 'Les losanges de rareté restent toujours sur une seule ligne.';
update public.devlog_entries set title = 'Noms du jeu', body = 'Le nom du jeu, du Wiki et de la monnaie viennent des réglages du Dossier Central, fiches comprises.', tag = 'admin', published_at = '2026-11-12 10:00+01'
 where slug = 'wiki-noms' and body = 'Les noms du jeu viennent des réglages du Dossier Central, et l''équipe peut fermer le Wiki aux membres.';
update public.devlog_entries set title = 'Élection du Dictateur', body = 'Fanions pourpre et or, confettis et étiquette pour l''élection.', tag = 'nouveau', published_at = '2026-11-16 09:00+01'
 where slug = 'wiki-election' and body = 'Décor de l''élection du Dictateur ; les membres en lieu inconnu apparaissent brouillés.';

insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('carto-ouverture', 'carto', 'Ouverture de la Cartographie',
   'La carte du monde ouvre : régions, lieux et villes. Chaque ville a son plan, ses quartiers et ses bâtiments, avec leurs étages et leurs pièces. L''équipe dessine la carte ; les membres la consultent.', 'nouveau', '2026-08-25 10:00+02'),
  ('carto-installation', 'carto', 'Correctif d''installation',
   'Une fonction de la base ne se créait pas : la carte s''installe désormais d''un coup.', 'correctif', '2026-08-25 18:00+02'),
  ('carto-outils-dessin', 'carto', 'Outils de dessin',
   'L''équipe dessine les régions et les lieux avec des formes ou à main levée, sur une grille, avec un zoom fluide.', 'nouveau', '2026-08-26 10:00+02'),
  ('carto-batiments-3d', 'carto', 'Bâtiments en 3D',
   'Lieux et bâtiments peuvent être ronds ou rectangulaires, à la taille voulue. Les bâtiments se visitent en 3D et peuvent avoir un propriétaire.', 'nouveau', '2026-08-26 14:00+02'),
  ('carto-legende', 'carto', 'Légende et icônes',
   'Nouvelle barre de navigation et légende de la carte, avec le choix de l''icône de chaque lieu.', 'nouveau', '2026-08-26 18:00+02'),
  ('carto-types-batiments', 'carto', 'Types de bâtiments',
   'L''équipe change les icônes de la légende et crée de nouveaux types de bâtiments pour les villes. Les membres apparaissent sous leur pseudo.', 'amelioration', '2026-08-27 12:00+02'),
  ('carto-finitions-aout', 'carto', 'Finitions de la carte et des villes',
   'Corrections d''affichage et d''édition sur la carte du monde et les plans de ville.', 'correctif', '2026-08-28 12:00+02'),
  ('carto-routes-positions', 'carto', 'Routes et positions',
   'Des routes relient les lieux. Chaque membre indique où se trouve son personnage, et tout le monde le voit en direct sur la carte, avec le panneau des présences.', 'nouveau', '2026-09-13 12:00+02'),
  ('carto-itineraires', 'carto', 'Itinéraires, territoires et quêtes',
   'Calcul du chemin le plus court entre deux lieux, recherche d''un lieu, export de la carte en image. Les groupes contrôlent des territoires (drapeaux) et les quêtes apparaissent à leur lieu.', 'nouveau', '2026-09-14 12:00+02'),
  ('carto-trajets-montures', 'carto', 'Fin de la téléportation : trajets et montures',
   'Se déplacer prend du temps : à pied par les routes, ou en vol avec une monture qu''on loue. Arrivée du relief et des biomes, des lieux qui sont aussi des bâtiments (sous-sols, escaliers), et de la quête validée en restant une heure sur place.', 'nouveau', '2026-10-01 12:00+02'),
  ('carto-marche-noir', 'carto', 'Marchés noirs et cristaux',
   'Certains lieux accueillent un marché noir, avec des étals tenus sur place. Les cristaux de téléportation font gagner du temps. Les quêtes terminées disparaissent de la carte.', 'nouveau', '2026-10-04 12:00+02'),
  ('carto-textures', 'carto', 'Textures',
   'Montagnes, arbres, vagues… les zones et les biomes reçoivent des motifs dessinés.', 'nouveau', '2026-10-08 10:00+02'),
  ('carto-textures-dessinees', 'carto', 'Textures dessinées à la main',
   'L''équipe dessine ses propres textures, qui peuvent remplacer la couleur d''un biome ou du relief.', 'amelioration', '2026-10-08 16:00+02'),
  ('carto-vols', 'carto', 'Échelle et vols',
   'La carte a une échelle en kilomètres. Un vol dure selon la vraie distance, la vitesse et la portée de la monture.', 'nouveau', '2026-10-09 10:00+02'),
  ('carto-correctif-montures', 'carto', 'Montures et voyages visibles',
   'Une monture louée est bien équipée, et le chronomètre des voyages s''affiche. On peut rendre sa monture.', 'correctif', '2026-10-09 13:00+02'),
  ('carto-montures-biomes', 'carto', 'Location limitée et biomes interdits',
   'Une monture se loue pour une durée limitée (24 h par défaut). Certaines ne passent pas partout selon les biomes. Vol libre vers n''importe quel lieu.', 'nouveau', '2026-10-09 16:00+02'),
  ('carto-lanceur', 'carto', 'Lanceur d''applications',
   'Un lanceur ouvre les autres sites et les outils de la carte. Nouveau panneau de vol.', 'nouveau', '2026-10-09 19:00+02'),
  ('carto-accompagnement', 'carto', 'Visite guidée et centre d''aide',
   'Une visite guidée présente la carte, pour les membres comme pour l''équipe. Le centre d''aide suit ce qui reste à faire, et les erreurs sont enfin affichées.', 'nouveau', '2026-10-10 12:00+02'),
  ('carto-fenetres', 'carto', 'Fenêtres, favoris et mesure',
   'Les applications s''ouvrent dans des fenêtres déplaçables. Lieux favoris, outil de mesure (distance et temps de marche) et bouton pour revenir sur son personnage.', 'nouveau', '2026-10-11 09:00+02'),
  ('carto-taille-monde', 'carto', 'Monde plus grand, thème animé',
   'La taille du monde se règle. Nouveau thème « Atlas nocturne ». La présence sur une quête ne verse plus d''argent : le responsable valide depuis le Dossier Central.', 'amelioration', '2026-10-11 12:00+02'),
  ('carto-selection', 'carto', 'Sélection multiple et nouvelles applications',
   'L''équipe sélectionne et déplace plusieurs éléments à la fois. Nouvelles applications : Répertoire, À proximité et Carnet. Rose des vents et noms des régions.', 'nouveau', '2026-10-11 15:00+02'),
  ('carto-icones-importees', 'carto', 'Icônes importées',
   'Les noms des régions s''écrivent au bon endroit, et l''équipe peut importer ses propres icônes.', 'amelioration', '2026-10-11 18:00+02'),
  ('carto-cgu', 'carto', 'Conditions d''utilisation',
   'Conditions d''utilisation et page de confidentialité, et polices hébergées sur le site.', 'admin', '2026-10-17 10:00+02'),
  ('carto-telephone', 'carto', 'Carte fluide sur téléphone',
   'La carte se manipule au doigt sans à-coups. Le panneau d''un lieu s''ouvre en bas de l''écran. Premier décor d''Halloween.', 'amelioration', '2026-10-17 16:00+02'),
  ('carto-correctif-biomes', 'carto', 'Biomes interdits réparés',
   'La règle des biomes interdits aux montures s''installe correctement.', 'correctif', '2026-10-17 19:00+02'),
  ('carto-trajets-unifies', 'carto', 'Un seul système de trajet',
   'Les trajets sont les mêmes sur la Cartographie et le Dossier Central, suivis en direct. Un itinéraire complet se lance en un clic, et chaque lieu a son bouton « Y aller ».', 'correctif', '2026-10-18 12:00+02'),
  ('carto-noel', 'carto', 'Décor de Noël',
   'Guirlande, givre, sceau en sapin et passage du traîneau.', 'nouveau', '2026-10-21 12:00+02'),
  ('carto-fetes', 'carto', 'Les fêtes de l''année',
   'Chaque fête habille la carte : guirlande, survol, sceau et bords teintés.', 'nouveau', '2026-10-23 12:00+02'),
  ('carto-rapidite', 'carto', 'Carte plus rapide',
   'La Cartographie charge plus vite et n''attend plus le serveur à chaque page.', 'amelioration', '2026-10-24 10:00+02'),
  ('carto-grande-chasse', 'carto', 'La Grande Chasse',
   'Fanions, survol de Brasombre et bords couleur de braise pendant la Grande Chasse.', 'nouveau', '2026-10-24 16:00+02'),
  ('carto-icones', 'carto', 'Icônes dessinées',
   'Les émojis laissent la place à des icônes dessinées.', 'amelioration', '2026-10-25 10:00+02'),
  ('carto-atlas', 'carto', 'L''Atlas',
   'Nouvelle apparence de la Cartographie, façon atlas ancien : vélin, encre et mer à la plume.', 'amelioration', '2026-10-25 14:00+02'),
  ('carto-presence-quete', 'carto', 'Présence sur une quête',
   'Rester sur le lieu d''une quête la fait bien valider, et le message est à jour.', 'correctif', '2026-10-27 09:00+01'),
  ('carto-connexion', 'carto', 'Animation de connexion',
   'À la connexion, la rose des vents trouve le nord.', 'amelioration', '2026-10-27 11:00+01'),
  ('carto-accessibilite', 'carto', 'Accessibilité',
   'Étiquettes, contrastes, focus visible et fenêtres utilisables au clavier.', 'amelioration', '2026-10-27 13:00+01'),
  ('carto-quetes', 'carto', 'Quêtes sur la carte',
   'Les quêtes ont un marqueur plus lisible et une fiche détaillée directement sur la carte.', 'amelioration', '2026-10-27 15:00+01'),
  ('carto-jour-nuit', 'carto', 'Jour, nuit et carnet de route',
   'La carte suit le jour et la nuit à l''heure de Paris. Chaque membre peut écrire une note privée sur n''importe quel lieu.', 'nouveau', '2026-10-27 18:00+01'),
  ('carto-controle', 'carto', 'Contrôle technique',
   'Sécurité de la carte vérifiée et renforcée.', 'correctif', '2026-10-28 12:00+01'),
  ('carto-textes', 'carto', 'Textes allégés',
   'Textes plus courts dans le choix de position et la fiche des quêtes.', 'amelioration', '2026-11-04 12:00+01'),
  ('carto-quete-clic', 'carto', 'Clic sur une quête',
   'Plus de gros rond noir en cliquant sur une quête.', 'correctif', '2026-11-05 12:00+01'),
  ('carto-noms', 'carto', 'Noms du jeu',
   'Le nom du jeu, de la carte et de la monnaie viennent des réglages du Dossier Central.', 'admin', '2026-11-12 10:00+01'),
  ('carto-fermeture', 'carto', 'Carte fermable',
   'L''équipe peut fermer la Cartographie aux membres depuis le Dossier Central.', 'admin', '2026-11-12 14:00+01'),
  ('carto-lieu-inconnu', 'carto', 'Lieu inconnu et élection',
   'Un membre peut brouiller sa position : il devient un bug de la carte. Décor de l''élection du Dictateur : fanions et confettis.', 'nouveau', '2026-11-16 09:00+01'),
  ('carto-lieu-inconnu-partout', 'carto', 'Lieu inconnu partout',
   'Un membre brouillé disparaît de la carte et apparaît brouillé, pseudo et avatar compris, sur les trois sites.', 'nouveau', '2026-11-16 12:00+01'),
  ('carto-avatar-brouille', 'carto', 'Avatar brouillé lisible',
   'L''avatar d''un membre brouillé reste lisible, avec une déchirure de temps en temps.', 'correctif', '2026-11-16 15:00+01'),
  ('wiki-ouverture', 'wiki', 'Ouverture du Wiki',
   'Le Wiki ouvre avec quatre catégories : lieux, armes, créatures et objets. Chaque fiche a son numéro. Une fiche non découverte reste anonyme (« ? »), même pour l''équipe.', 'nouveau', '2026-09-30 10:00+02'),
  ('wiki-commentaires', 'wiki', 'Commentaires et découvreurs',
   'On commente les fiches et on mentionne les autres chasseurs. Chaque fiche peut afficher qui l''a découverte.', 'nouveau', '2026-10-01 09:00+02'),
  ('wiki-fiches-3d', 'wiki', 'Compétences, 3D et rareté',
   'Nouvelle catégorie Compétences, modèles 3D animés, fiche technique, rareté, favoris, fiche au hasard et historique des versions.', 'nouveau', '2026-10-01 13:00+02'),
  ('wiki-application', 'wiki', 'Le Wiki sur téléphone',
   'Le Wiki s''installe sur l''écran d''accueil et a sa barre de navigation sur téléphone.', 'nouveau', '2026-10-01 18:00+02'),
  ('wiki-navigation', 'wiki', 'Navigation et recherche',
   'Nouvelle navigation sur ordinateur, recherche rapide et vagues animées. Les modèles 3D et les images sont allégés à l''envoi.', 'amelioration', '2026-10-02 10:00+02'),
  ('wiki-fbx', 'wiki', 'Modèles FBX',
   'L''équipe peut aussi envoyer des modèles 3D au format FBX.', 'nouveau', '2026-10-02 16:00+02'),
  ('wiki-grande-maj', 'wiki', 'Notes, signalements et tags',
   'Notes personnelles sur les fiches, signalement d''une erreur, annonce d''accueil, page des tags, nouveautés depuis ta dernière visite et fiches vues récemment.', 'nouveau', '2026-10-08 12:00+02'),
  ('wiki-aide', 'wiki', 'Page d''aide',
   'Une page d''aide, un menu du compte et une astuce de bienvenue pour les nouveaux venus.', 'nouveau', '2026-10-09 12:00+02'),
  ('wiki-profils', 'wiki', 'Profils et porte-armure',
   'Chaque chasseur a son profil, avec un porte-armure à équiper : tête, torse, jambes, pieds, mains et dos. Plusieurs bugs corrigés au passage.', 'nouveau', '2026-10-11 09:00+02'),
  ('wiki-armes-apparence', 'wiki', 'Apparence des armes',
   'L''équipe choisit la forme et la couleur de chaque arme sur le porte-armure : dague, hache, lance…', 'nouveau', '2026-10-11 12:00+02'),
  ('wiki-formes', 'wiki', 'Douze nouvelles formes',
   'Arbalète, mitraillette, grenades, shuriken, kunai, dagues doubles, ordinateur, lames secrètes, pistolet, fiole, fusil à pompe…', 'nouveau', '2026-10-11 15:00+02'),
  ('wiki-placement', 'wiki', 'Placement des armes',
   'Position, taille et rotation de chaque arme, réglées à part pour chaque main et le dos. Le mannequin peut être remplacé par une image.', 'amelioration', '2026-10-11 18:00+02'),
  ('wiki-cgu', 'wiki', 'Conditions d''utilisation',
   'Conditions d''utilisation, page de confidentialité et polices hébergées sur le site.', 'admin', '2026-10-17 10:00+02'),
  ('wiki-halloween', 'wiki', 'Halloween',
   'Lune, chauves-souris, toile d''araignée, citrouilles sur les vagues et mer orangée.', 'nouveau', '2026-10-17 16:00+02'),
  ('wiki-noel', 'wiki', 'Décor de Noël',
   'Étoile, neige, mer givrée et cadeaux sur les vagues.', 'nouveau', '2026-10-21 12:00+02'),
  ('wiki-fetes', 'wiki', 'Les fêtes de l''année',
   'Chaque fête habille le Wiki : guirlande, objets sur les vagues, mer teintée.', 'nouveau', '2026-10-23 12:00+02'),
  ('wiki-rapidite', 'wiki', 'Wiki plus rapide',
   'Les pages chargent plus vite. Sur une fiche, le modèle 3D remplace l''image.', 'amelioration', '2026-10-24 10:00+02'),
  ('wiki-grande-chasse', 'wiki', 'Grande Chasse et proie du jour',
   'Décor de la Grande Chasse, et une proie du jour à traquer sur l''accueil pendant l''événement.', 'nouveau', '2026-10-24 14:00+02'),
  ('wiki-horizons', 'wiki', 'Un horizon pour chaque fête',
   'Manoir, village enneigé, phare, clocher, ville en fête… posés sur la mer derrière le contenu.', 'amelioration', '2026-10-24 18:00+02'),
  ('wiki-icones', 'wiki', 'Icônes dessinées',
   'Les émojis laissent la place à des icônes dessinées.', 'amelioration', '2026-10-25 10:00+02'),
  ('wiki-codex', 'wiki', 'Le Codex',
   'Le Wiki devient le Codex : un cabinet de collection, une couleur par catégorie, des fiches plus lisibles.', 'amelioration', '2026-10-25 14:00+02'),
  ('wiki-connexion', 'wiki', 'Animation de connexion',
   'À la connexion, le Codex s''ouvre.', 'amelioration', '2026-10-27 10:00+01'),
  ('wiki-accessibilite', 'wiki', 'Accessibilité',
   'Étiquettes, contrastes, focus visible et fenêtres utilisables au clavier.', 'amelioration', '2026-10-27 13:00+01'),
  ('wiki-enigme', 'wiki', 'Énigme du jour',
   'Une énigme chaque jour sur l''accueil, et les flèches du clavier pour passer d''une fiche à l''autre.', 'nouveau', '2026-10-27 15:00+01'),
  ('wiki-paliers', 'wiki', 'Paliers et écoute des fiches',
   'Des médailles récompensent les catégories bien remplies, et chaque fiche peut être lue à voix haute.', 'nouveau', '2026-10-27 18:00+01'),
  ('wiki-controle', 'wiki', 'Contrôle technique',
   'Sécurité vérifiée et moteur du site mis à jour.', 'correctif', '2026-10-28 12:00+01'),
  ('wiki-textes', 'wiki', 'Textes allégés',
   'Textes plus courts sur les profils et le porte-armure.', 'amelioration', '2026-11-04 12:00+01'),
  ('wiki-rarete', 'wiki', 'Rareté sur une ligne',
   'Les losanges de rareté restent sur une seule ligne dans la vue Liste.', 'correctif', '2026-11-05 12:00+01'),
  ('wiki-noms', 'wiki', 'Noms du jeu',
   'Le nom du jeu, du Wiki et de la monnaie viennent des réglages du Dossier Central, fiches comprises.', 'admin', '2026-11-12 10:00+01'),
  ('wiki-fermeture', 'wiki', 'Wiki fermable',
   'L''équipe peut fermer le Wiki aux membres depuis le Dossier Central.', 'admin', '2026-11-12 14:00+01'),
  ('wiki-election', 'wiki', 'Élection du Dictateur',
   'Fanions pourpre et or, confettis et étiquette pour l''élection.', 'nouveau', '2026-11-16 09:00+01'),
  ('wiki-lieu-inconnu', 'wiki', 'Lieu inconnu',
   'Les membres en lieu inconnu apparaissent brouillés, pseudo et avatar compris.', 'nouveau', '2026-11-16 12:00+01'),
  ('wiki-avatar-brouille', 'wiki', 'Avatar brouillé lisible',
   'L''avatar d''un membre brouillé reste lisible.', 'correctif', '2026-11-16 15:00+01')
on conflict (slug) do nothing;
