-- =========================================================
-- Devlog par site : Dossier Central, Cartographie, Wiki.
-- À lancer après 0106. Peut être relancée sans risque.
-- Les entrées de la Cartographie et du Wiki viennent de l'historique de
-- leurs dépôts ; une entrée déjà présente (même slug) n'est pas touchée.
-- =========================================================

alter table public.devlog_entries add column if not exists site text not null default 'central';
alter table public.devlog_entries drop constraint if exists devlog_entries_site_check;
alter table public.devlog_entries add constraint devlog_entries_site_check check (site in ('central', 'carto', 'wiki'));
create index if not exists devlog_entries_site_idx on public.devlog_entries (site, published_at desc);

drop function if exists public.devlog_save(uuid, text, text, text, timestamptz);
create or replace function public.devlog_save(p_id uuid, p_title text, p_body text, p_tag text,
                                              p_published_at timestamptz default null, p_site text default 'central')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public._is_founder() then raise exception 'Réservé au fondateur.'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'Le titre est obligatoire.'; end if;
  if coalesce(p_site, 'central') not in ('central', 'carto', 'wiki') then raise exception 'Site inconnu.'; end if;
  if p_id is null then
    insert into public.devlog_entries (title, body, tag, published_at, created_by, site)
    values (btrim(p_title), coalesce(p_body, ''), coalesce(p_tag, 'nouveau'), coalesce(p_published_at, now()), auth.uid(),
            coalesce(p_site, 'central'))
    returning id into v_id;
  else
    update public.devlog_entries
       set title = btrim(p_title), body = coalesce(p_body, ''), tag = coalesce(p_tag, tag),
           published_at = coalesce(p_published_at, published_at), site = coalesce(p_site, site), updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Entrée introuvable.'; end if;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.devlog_save(uuid, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.devlog_save(uuid, text, text, text, timestamptz, text) to authenticated;

insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('carto-ouverture', 'carto', 'Ouverture de la Cartographie',
   'La carte du monde ouvre : villes, quartiers et bâtiments, avec leurs étages et leurs pièces. Les bâtiments s''explorent aussi en 3D.', 'nouveau', '2026-08-25 12:00+02'),
  ('carto-trajets-montures', 'carto', 'Trajets, montures et relief',
   'Les déplacements prennent du temps sur les routes. On peut louer une monture pour aller plus vite. Arrivée des biomes et du relief, et des lieux qui sont aussi des bâtiments.', 'nouveau', '2026-10-01 12:00+02'),
  ('carto-marche-noir', 'carto', 'Marché noir et cristaux',
   'Certains lieux accueillent un marché noir. Les cristaux de téléportation font gagner du temps. Les quêtes s''ouvrent depuis la carte.', 'nouveau', '2026-10-04 12:00+02'),
  ('carto-textures', 'carto', 'Textures dessinées',
   'Les zones et les biomes reçoivent des textures dessinées à la main, réglables par l''équipe.', 'amelioration', '2026-10-08 12:00+02'),
  ('carto-vols', 'carto', 'Échelle, vols et montures par biome',
   'Une échelle de distance sur la carte, les vols directs vers un lieu, et des montures qui ne passent pas partout. Un lanceur ouvre les autres sites.', 'nouveau', '2026-10-09 12:00+02'),
  ('carto-accompagnement', 'carto', 'Visite guidée et centre d''aide',
   'Une visite guidée présente la carte, un centre d''aide répond aux questions et les erreurs sont expliquées.', 'nouveau', '2026-10-10 12:00+02'),
  ('carto-fenetres', 'carto', 'Fenêtres, favoris et mesure',
   'Les applications s''ouvrent dans des fenêtres flottantes. Lieux favoris, outil de mesure, localisation, carte agrandissable, sélection multiple et nouveau thème animé.', 'amelioration', '2026-10-11 12:00+02'),
  ('carto-telephone', 'carto', 'Carte fluide sur téléphone',
   'La carte se manipule mieux au doigt. Arrivée des décors d''événement, des conditions d''utilisation et de la page de confidentialité.', 'amelioration', '2026-10-17 12:00+02'),
  ('carto-trajets-unifies', 'carto', 'Un seul système de trajet',
   'Les trajets sont les mêmes sur la Cartographie et le Dossier Central, suivis en direct, et un itinéraire complet se lance en un clic.', 'correctif', '2026-10-18 12:00+02'),
  ('carto-noel', 'carto', 'Décor de Noël',
   'Guirlande, givre, sceau en sapin et passage du traîneau sur la carte.', 'nouveau', '2026-10-21 12:00+02'),
  ('carto-fetes', 'carto', 'Les fêtes de l''année',
   'Chaque fête habille la carte : guirlande, survol, sceau et bords teintés.', 'nouveau', '2026-10-23 12:00+02'),
  ('carto-rapidite', 'carto', 'Carte plus rapide',
   'La Cartographie charge plus vite.', 'amelioration', '2026-10-24 10:00+02'),
  ('carto-grande-chasse', 'carto', 'La Grande Chasse',
   'Le décor de la Grande Chasse s''installe aussi sur la carte.', 'nouveau', '2026-10-24 16:00+02'),
  ('carto-atlas', 'carto', 'L''Atlas',
   'Nouvelle apparence de la Cartographie, et des icônes dessinées à la place des émojis.', 'amelioration', '2026-10-25 12:00+02'),
  ('carto-connexion', 'carto', 'Animation de connexion',
   'À la connexion, la rose des vents trouve le nord.', 'amelioration', '2026-10-27 10:00+01'),
  ('carto-accessibilite', 'carto', 'Accessibilité',
   'Étiquettes, contrastes, focus visible et fenêtres utilisables au clavier.', 'amelioration', '2026-10-27 14:00+01'),
  ('carto-jour-nuit', 'carto', 'Jour, nuit et notes de lieux',
   'La carte suit le jour et la nuit à l''heure de Paris. Chaque lieu a ses notes partagées. Les quêtes apparaissent sur la carte.', 'nouveau', '2026-10-27 18:00+01'),
  ('carto-controle', 'carto', 'Contrôle technique',
   'Sécurité de la carte vérifiée et renforcée.', 'correctif', '2026-10-28 12:00+01'),
  ('carto-quete-clic', 'carto', 'Clic sur une quête',
   'Plus de gros rond noir en cliquant sur une quête.', 'correctif', '2026-11-05 12:00+01'),
  ('carto-noms', 'carto', 'Noms du jeu et fermeture',
   'Les noms du jeu viennent des réglages du Dossier Central, et l''équipe peut fermer la carte aux membres.', 'admin', '2026-11-12 12:00+01'),
  ('carto-lieu-inconnu', 'carto', 'Lieu inconnu et élection',
   'Un membre en lieu inconnu disparaît de la carte et apparaît brouillé. Décor de l''élection du Dictateur.', 'nouveau', '2026-11-16 12:00+01'),
  ('wiki-ouverture', 'wiki', 'Ouverture du Wiki',
   'Le Wiki ouvre avec quatre catégories : lieux, armes, créatures et objets. Une fiche non découverte reste anonyme jusqu''à sa découverte.', 'nouveau', '2026-09-30 12:00+02'),
  ('wiki-commentaires', 'wiki', 'Commentaires et découvreurs',
   'On commente les fiches et on mentionne les autres membres. Chaque fiche affiche qui l''a découverte.', 'nouveau', '2026-10-01 10:00+02'),
  ('wiki-fiches-3d', 'wiki', 'Compétences, 3D et rareté',
   'Nouvelle catégorie Compétences, modèles 3D animés, fiche technique, rareté en étoiles, favoris et fiche au hasard.', 'nouveau', '2026-10-01 16:00+02'),
  ('wiki-navigation', 'wiki', 'Navigation et recherche',
   'Nouvelle navigation sur ordinateur et téléphone, recherche rapide et vagues animées.', 'amelioration', '2026-10-02 12:00+02'),
  ('wiki-grande-maj', 'wiki', 'Notes, signalements et tags',
   'Notes personnelles sur les fiches, signalement d''une erreur, page des tags, nouveautés depuis ta dernière visite et fiches vues récemment.', 'nouveau', '2026-10-08 12:00+02'),
  ('wiki-aide', 'wiki', 'Page d''aide',
   'Une page d''aide et une astuce de bienvenue pour les nouveaux venus.', 'nouveau', '2026-10-09 12:00+02'),
  ('wiki-profils', 'wiki', 'Profils et porte-armure',
   'Chaque chasseur a son profil, avec un porte-armure à équiper : tête, torse, jambes, pieds, mains et dos. Les armes ont leur forme et leur couleur.', 'nouveau', '2026-10-11 12:00+02'),
  ('wiki-cgu', 'wiki', 'Conditions d''utilisation',
   'Conditions d''utilisation, page de confidentialité et polices hébergées sur le site.', 'admin', '2026-10-17 10:00+02'),
  ('wiki-halloween', 'wiki', 'Halloween',
   'Premier décor d''événement sur le Wiki.', 'nouveau', '2026-10-17 16:00+02'),
  ('wiki-noel', 'wiki', 'Décor de Noël',
   'Étoile, neige, mer givrée et cadeaux sur les vagues.', 'nouveau', '2026-10-21 12:00+02'),
  ('wiki-fetes', 'wiki', 'Les fêtes de l''année',
   'Chaque fête habille le Wiki : guirlande, objets sur les vagues, mer teintée.', 'nouveau', '2026-10-23 12:00+02'),
  ('wiki-rapidite', 'wiki', 'Wiki plus rapide',
   'Les pages chargent plus vite, et le modèle 3D remplace l''image sur la fiche.', 'amelioration', '2026-10-24 10:00+02'),
  ('wiki-grande-chasse', 'wiki', 'Grande Chasse et proie du jour',
   'Décor de la Grande Chasse et une proie du jour à traquer.', 'nouveau', '2026-10-24 16:00+02'),
  ('wiki-codex', 'wiki', 'Le Codex',
   'Le Wiki devient le Codex : cabinet de collection, une couleur par catégorie, fiches plus lisibles et icônes dessinées.', 'amelioration', '2026-10-25 12:00+02'),
  ('wiki-connexion', 'wiki', 'Animation de connexion',
   'À la connexion, le Codex s''ouvre.', 'amelioration', '2026-10-27 10:00+01'),
  ('wiki-accessibilite', 'wiki', 'Accessibilité',
   'Étiquettes, contrastes, focus visible et fenêtres utilisables au clavier.', 'amelioration', '2026-10-27 14:00+01'),
  ('wiki-enigme', 'wiki', 'Énigme du jour, paliers et écoute',
   'Une énigme du jour, des paliers de découverte, et les fiches peuvent être lues à voix haute.', 'nouveau', '2026-10-27 18:00+01'),
  ('wiki-controle', 'wiki', 'Contrôle technique',
   'Sécurité vérifiée et moteur du site mis à jour.', 'correctif', '2026-10-28 12:00+01'),
  ('wiki-rarete', 'wiki', 'Rareté sur une ligne',
   'Les losanges de rareté restent toujours sur une seule ligne.', 'correctif', '2026-11-05 12:00+01'),
  ('wiki-noms', 'wiki', 'Noms du jeu et fermeture',
   'Les noms du jeu viennent des réglages du Dossier Central, et l''équipe peut fermer le Wiki aux membres.', 'admin', '2026-11-12 12:00+01'),
  ('wiki-election', 'wiki', 'Élection et lieu inconnu',
   'Décor de l''élection du Dictateur ; les membres en lieu inconnu apparaissent brouillés.', 'nouveau', '2026-11-16 12:00+01')
on conflict (slug) do nothing;

-- Lot 88 (cette mise à jour), sur les trois sites.
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-88', 'central', 'Un devlog par site',
   'Le devlog a maintenant un onglet pour le Dossier Central, un pour la Cartographie et un pour le Wiki, avec l''historique de chacun.', 'amelioration', '2026-11-19 18:00+01'),
  ('carto-exploration', 'carto', 'Brouillard d''exploration',
   'La carte ne montre que ce que ton personnage a parcouru. Les lieux à une route de toi apparaissent en « ? ». Le premier à atteindre un lieu nouveau en devient le **découvreur**, et les fiches du Wiki liées à ce lieu sont découvertes avec lui. Le bouton Exploration montre ton avancement et les meilleurs explorateurs.', 'nouveau', '2026-11-19 18:00+01'),
  ('carto-meteo', 'carto', 'Météo et incursions',
   'Chaque biome a son temps, qui change toutes les 3 heures : pluie, brouillard, orage, neige, tempête de sable… Un trajet prend la pire météo qu''il traverse au départ. Une créature du Wiki peut aussi apparaître et rôder 3 heures sur la carte : arrête-toi sur un lieu proche pour la **signaler** et gagner un peu de renommée.', 'nouveau', '2026-11-19 18:05+01'),
  ('wiki-propositions', 'wiki', 'Propositions de modification',
   'Chaque fiche découverte a un bouton « Proposer une modification ». L''équipe compare avec la fiche actuelle et accepte ou refuse. Une proposition acceptée rapporte de la renommée, et ton nom apparaît sur la fiche.', 'nouveau', '2026-11-19 18:00+01'),
  ('wiki-observer', 'wiki', 'Où l''observer',
   'Les fiches des créatures montrent sur une carte où les chasseurs les ont signalées pendant leurs incursions, et les lieux qui leur sont liés.', 'nouveau', '2026-11-19 18:05+01'),
  ('wiki-planches', 'wiki', 'Planches montées',
   'Nouvelle présentation : chaque spécimen est monté sous passe-partout, tenu par des coins de laiton, avec son étiquette de papier. La collection devient un cabinet à tiroirs.', 'amelioration', '2026-11-19 18:10+01')
on conflict (slug) do nothing;
