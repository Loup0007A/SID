-- =====================================================================
-- 0134 — Calendrier de l'avent (Lot 103)
--
-- * Une case par jour du 1er au 24 décembre (heure de Paris). Chaque case
--   ouvre un mini-jeu à score ; les 7 premiers jeux sont livrés avec le
--   site, les admins choisissent le jeu de chaque case.
-- * Essais : 3 par case et par jour (réglable). Une partie commencée et
--   abandonnée compte comme un essai.
-- * Contrôle des scores : chaque partie est ouverte par le serveur
--   (avent_commencer) et refermée par lui (avent_terminer). Durée minimale
--   (sauf score nul), score maximal et score par seconde sont vérifiés selon
--   le jeu ; un score impossible est rejeté et noté.
-- * Points : pour chaque case, 1 000 × ton meilleur score ÷ le meilleur
--   score de la case (le meilleur joueur d'une case a 1 000 points), plus un
--   bonus si la case a été jouée le jour de son ouverture (100, réglable).
--   Le classement additionne les cases.
-- * Récompenses : définies par les admins Économie, par tranche de rangs :
--   zénis, renommée et un avantage temporaire (bouclier anti-farces, gains
--   de la roue doublés, renommée majorée). Distribuées une fois le
--   calendrier clos, en un clic, une seule fois par édition.
-- * Notifications « avent » (réglables) : ouverture de chaque case, gains.
--
-- Rejouable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Réglages
-- ---------------------------------------------------------------------
create table if not exists public.avent_config (
  id int primary key default 1 check (id = 1),
  actif boolean not null default true,
  -- jour d'ouverture de la case 1 (date de Paris)
  debut date not null default date '2026-12-01',
  -- classement figé à cette heure
  fin timestamptz not null default (timestamp '2026-12-25 00:00' at time zone 'Europe/Paris'),
  essais_par_jour int not null default 3 check (essais_par_jour between 1 and 20),
  bonus_jour int not null default 100 check (bonus_jour between 0 and 1000),
  derniere_annonce date,
  fin_annoncee boolean not null default false,
  distribue_at timestamptz,
  distribue_par uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.avent_config (id) values (1) on conflict (id) do nothing;

-- Édition = année de la case 1 : les scores d'une année ne se mélangent pas
-- avec ceux de la suivante.
create or replace function public._avent_edition()
returns int
language sql stable security definer set search_path = public
as $$ select extract(year from debut)::int from public.avent_config where id = 1 $$;

-- ---------------------------------------------------------------------
-- Jeux (définis par le code du site) et cases
-- ---------------------------------------------------------------------
create table if not exists public.avent_jeux (
  jeu text primary key,
  nom text not null,
  consigne text not null,
  min_secondes int not null,
  score_max int not null,
  score_par_seconde numeric not null
);
insert into public.avent_jeux (jeu, nom, consigne, min_secondes, score_max, score_par_seconde) values
  ('babyfoot', 'Baby-foot des lutins', 'Un match de 90 secondes contre les lutins. 100 points par but marqué, 40 de moins par but encaissé.', 60, 4000, 25),
  ('bowling', 'Bowling des bonshommes de neige', '5 manches de 2 lancers. Vise, choisis l''effet, lâche la boule. Strike : +10, spare : +5.', 12, 200, 8),
  ('glouton', 'Le Glouton du réveillon', 'Mange tous les chocolats du labyrinthe sans te faire attraper. Les étoiles retournent les fantômes. 3 vies.', 3, 60000, 260),
  ('cassebriques', 'Casse-cadeaux', 'Renvoie la boule de neige avec ta luge et ouvre tous les paquets. 3 vies, les niveaux s''enchaînent.', 3, 60000, 200),
  ('traineau', 'Le Traîneau', 'Ramasse les cadeaux, ton attelage s''allonge. Ne touche ni les bords ni tes rennes.', 2, 6000, 35),
  ('boules', 'Bataille de boules de neige', '45 secondes : touche les lutins qui sortent, jamais les bonshommes de neige. Les séries font monter le multiplicateur.', 40, 5000, 120),
  ('pile', 'Pile de cadeaux', 'Lâche chaque paquet au bon moment pour monter la pile. Ce qui dépasse tombe. Un dépôt parfait rapporte un bonus.', 1, 5000, 50)
on conflict (jeu) do update set nom = excluded.nom, consigne = excluded.consigne, min_secondes = excluded.min_secondes,
  score_max = excluded.score_max, score_par_seconde = excluded.score_par_seconde;

create table if not exists public.avent_cases (
  jour int primary key check (jour between 1 and 24),
  jeu text references public.avent_jeux(jeu) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.avent_cases (jour, jeu)
select d, (array['babyfoot', 'bowling', 'glouton', 'cassebriques', 'traineau', 'boules', 'pile'])[d]
from generate_series(1, 24) d
on conflict (jour) do nothing;

-- ---------------------------------------------------------------------
-- Parties, meilleurs scores, récompenses, gains, avantages
-- ---------------------------------------------------------------------
create table if not exists public.avent_parties (
  id uuid primary key default gen_random_uuid(),
  edition int not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  jour int not null check (jour between 1 and 24),
  jeu text not null,
  jour_local date not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  score int,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'terminee', 'rejetee')),
  motif text
);
create index if not exists avent_parties_user_idx on public.avent_parties (user_id, edition, jour, jour_local);
create index if not exists avent_parties_rejet_idx on public.avent_parties (edition, statut) where statut = 'rejetee';

create table if not exists public.avent_scores (
  edition int not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  jour int not null check (jour between 1 and 24),
  score int not null default 0,
  atteint_at timestamptz not null default now(),
  bonus boolean not null default false,
  primary key (edition, user_id, jour)
);
create index if not exists avent_scores_jour_idx on public.avent_scores (edition, jour, score desc);

create table if not exists public.avent_recompenses (
  id uuid primary key default gen_random_uuid(),
  rang_min int not null check (rang_min >= 1),
  rang_max int not null,
  zenis numeric not null default 0 check (zenis >= 0),
  zenis_set_at timestamptz not null default now(),
  renommee int not null default 0 check (renommee between 0 and 100000),
  avantage text check (avantage in ('bouclier', 'roue_double', 'renommee_bonus')),
  avantage_valeur int,
  avantage_heures int check (avantage_heures is null or avantage_heures between 1 and 2160),
  created_at timestamptz not null default now(),
  check (rang_max >= rang_min)
);

create table if not exists public.avent_gains (
  edition int not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rang int not null,
  points int not null,
  zenis numeric not null default 0,
  renommee int not null default 0,
  avantage text,
  avantage_valeur int,
  avantage_jusqu timestamptz,
  created_at timestamptz not null default now(),
  primary key (edition, user_id)
);

-- Avantages temporaires (le bouclier anti-farces passe par troll_shields).
create table if not exists public.avantages_temporaires (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('roue_double', 'renommee_bonus')),
  valeur int not null default 0,
  expires_at timestamptz not null,
  source text not null default 'avent',
  created_at timestamptz not null default now()
);
create index if not exists avantages_temporaires_user_idx on public.avantages_temporaires (user_id, kind, expires_at);

alter table public.avent_config enable row level security;
alter table public.avent_jeux enable row level security;
alter table public.avent_cases enable row level security;
alter table public.avent_parties enable row level security;
alter table public.avent_scores enable row level security;
alter table public.avent_recompenses enable row level security;
alter table public.avent_gains enable row level security;
alter table public.avantages_temporaires enable row level security;
-- Pas de politique : tout passe par les fonctions ci-dessous.
revoke all on public.avent_config, public.avent_jeux, public.avent_cases, public.avent_parties, public.avent_scores,
  public.avent_recompenses, public.avent_gains, public.avantages_temporaires from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Aides
-- ---------------------------------------------------------------------
-- Date d'ouverture d'une case.
create or replace function public._avent_ouverture(p_jour int)
returns date
language sql stable security definer set search_path = public
as $$ select debut + (p_jour - 1) from public.avent_config where id = 1 $$;

-- Montant actuel d'une récompense en zénis (suit les réformes monétaires).
create or replace function public._avent_zenis(r public.avent_recompenses)
returns numeric
language sql stable security definer set search_path = public
as $$ select round(r.zenis * public._reform_factor_since(r.zenis_set_at, 'prix')) $$;

-- Points de chaque membre classé (membres actifs, hors bac à sable).
create or replace function public._avent_points(p_edition int)
returns table (user_id uuid, points int, cases int, dernier timestamptz)
language sql stable security definer set search_path = public
as $$
  with meilleurs as (
    select s.jour, max(s.score) as top
    from public.avent_scores s
    join public.profiles p on p.id = s.user_id
    where s.edition = p_edition and p.status = 'active' and not public.is_sandbox_account(p.id)
    group by s.jour
  ), bonus as (select bonus_jour from public.avent_config where id = 1)
  select s.user_id,
         sum(case when m.top > 0 then round(1000.0 * s.score / m.top) else 0 end
             + case when s.bonus then (select bonus_jour from bonus) else 0 end)::int,
         count(*)::int,
         max(s.atteint_at)
  from public.avent_scores s
  join meilleurs m on m.jour = s.jour
  join public.profiles p on p.id = s.user_id
  where s.edition = p_edition and p.status = 'active' and not public.is_sandbox_account(p.id)
  group by s.user_id
$$;

create or replace function public._avent_classement(p_edition int)
returns table (rang int, user_id uuid, points int, cases int, dernier timestamptz)
language sql stable security definer set search_path = public
as $$
  select (row_number() over (order by x.points desc, x.dernier asc, x.user_id))::int, x.user_id, x.points, x.cases, x.dernier
  from public._avent_points(p_edition) x
  where x.points > 0
$$;

-- Récompense prévue pour un rang (tranches sans chevauchement).
create or replace function public._avent_recompense_rang(p_rang int)
returns public.avent_recompenses
language sql stable security definer set search_path = public
as $$ select * from public.avent_recompenses where p_rang between rang_min and rang_max order by rang_min limit 1 $$;

create or replace function public._avent_recompense_json(r public.avent_recompenses)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when r.id is null then null else jsonb_build_object(
    'id', r.id, 'rang_min', r.rang_min, 'rang_max', r.rang_max,
    'zenis', public._avent_zenis(r), 'renommee', r.renommee,
    'avantage', r.avantage, 'avantage_valeur', r.avantage_valeur, 'avantage_heures', r.avantage_heures) end
$$;

-- ---------------------------------------------------------------------
-- Côté membre
-- ---------------------------------------------------------------------
create or replace function public.avent_etat()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  c public.avent_config;
  v_ed int;
  v_today date := public._local_today();
  v_cases jsonb;
  v_moi record;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into c from public.avent_config where id = 1;
  v_ed := extract(year from c.debut)::int;

  select coalesce(jsonb_agg(jsonb_build_object(
      'jour', k.jour,
      'jeu', k.jeu,
      'nom', j.nom,
      'consigne', j.consigne,
      'ouvre_le', c.debut + (k.jour - 1),
      'ouverte', c.actif and k.jeu is not null and c.debut + (k.jour - 1) <= v_today and now() < c.fin,
      'mon_score', s.score,
      'bonus', coalesce(s.bonus, false),
      'meilleur', m.top,
      'mes_points', case when s.score is null then null
                         else (case when m.top > 0 then round(1000.0 * s.score / m.top) else 0 end
                               + case when s.bonus then c.bonus_jour else 0 end)::int end,
      'essais_restants', greatest(0, c.essais_par_jour - coalesce(e.n, 0))
    ) order by k.jour), '[]'::jsonb)
  into v_cases
  from public.avent_cases k
  left join public.avent_jeux j on j.jeu = k.jeu
  left join public.avent_scores s on s.edition = v_ed and s.user_id = v_uid and s.jour = k.jour
  left join lateral (
    select max(sc.score) as top from public.avent_scores sc
    join public.profiles p on p.id = sc.user_id
    where sc.edition = v_ed and sc.jour = k.jour and p.status = 'active' and not public.is_sandbox_account(p.id)
  ) m on true
  left join lateral (
    select count(*)::int as n from public.avent_parties ap
    where ap.user_id = v_uid and ap.edition = v_ed and ap.jour = k.jour and ap.jour_local = v_today
  ) e on true;

  select * into v_moi from public._avent_classement(v_ed) x where x.user_id = v_uid;

  return jsonb_build_object(
    'edition', v_ed,
    'actif', c.actif,
    'debut', c.debut,
    'fin', c.fin,
    'clos', now() >= c.fin,
    'aujourdhui', v_today,
    'essais_par_jour', c.essais_par_jour,
    'bonus_jour', c.bonus_jour,
    'distribue', c.distribue_at is not null,
    'cases', v_cases,
    'mon_rang', v_moi.rang,
    'mes_points', coalesce(v_moi.points, 0),
    'classes', (select count(*) from public._avent_classement(v_ed)),
    'bac_a_sable', public.is_sandbox_account(v_uid),
    'recompenses', coalesce((select jsonb_agg(public._avent_recompense_json(r) order by r.rang_min) from public.avent_recompenses r), '[]'::jsonb),
    'mon_gain', (select to_jsonb(g) - 'user_id' from public.avent_gains g where g.edition = v_ed and g.user_id = v_uid)
  );
end;
$$;

create or replace function public.avent_classement(p_limite int default 100)
returns table (rang int, user_id uuid, nickname text, avatar_url text, points int, cases int, recompense jsonb)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_ed int := public._avent_edition();
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  return query
  select x.rang, x.user_id, p.nickname, p.avatar_url, x.points, x.cases,
         public._avent_recompense_json(public._avent_recompense_rang(x.rang))
  from public._avent_classement(v_ed) x
  join public.profiles p on p.id = x.user_id
  where x.rang <= greatest(1, least(coalesce(p_limite, 100), 500)) or x.user_id = auth.uid()
  order by x.rang;
end;
$$;

-- Meilleurs scores d'une case (podium du jour).
create or replace function public.avent_case_scores(p_jour int)
returns table (rang int, nickname text, score int, moi boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_ed int := public._avent_edition();
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  return query
  select (row_number() over (order by s.score desc, s.atteint_at))::int, p.nickname, s.score, s.user_id = auth.uid()
  from public.avent_scores s
  join public.profiles p on p.id = s.user_id
  where s.edition = v_ed and s.jour = p_jour and p.status = 'active' and not public.is_sandbox_account(p.id)
  order by s.score desc, s.atteint_at
  limit 10;
end;
$$;

create or replace function public.avent_commencer(p_jour int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  c public.avent_config;
  v_ed int;
  v_today date := public._local_today();
  v_jeu text;
  v_n int;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'Réservé aux membres.' using errcode = '42501';
  end if;
  select * into c from public.avent_config where id = 1 for update;
  v_ed := extract(year from c.debut)::int;
  if not c.actif then raise exception 'Le calendrier de l''avent est fermé.'; end if;
  if now() >= c.fin then raise exception 'Le calendrier est clos : le classement est figé.'; end if;
  if p_jour is null or p_jour < 1 or p_jour > 24 then raise exception 'Case inconnue.'; end if;
  if c.debut + (p_jour - 1) > v_today then
    raise exception 'Cette case s''ouvre le %.', to_char(c.debut + (p_jour - 1), 'DD/MM');
  end if;
  select jeu into v_jeu from public.avent_cases where jour = p_jour;
  if v_jeu is null then raise exception 'Pas encore de jeu dans cette case.'; end if;

  select count(*) into v_n from public.avent_parties
  where user_id = v_uid and edition = v_ed and jour = p_jour and jour_local = v_today;
  if v_n >= c.essais_par_jour then
    raise exception 'Plus d''essai aujourd''hui pour cette case (% par jour). Reviens demain.', c.essais_par_jour;
  end if;

  insert into public.avent_parties (edition, user_id, jour, jeu, jour_local)
  values (v_ed, v_uid, p_jour, v_jeu, v_today) returning id into v_id;

  return jsonb_build_object('partie', v_id, 'jeu', v_jeu, 'graine', floor(random() * 2147483646)::int + 1,
                            'essais_restants', c.essais_par_jour - v_n - 1);
end;
$$;

create or replace function public.avent_terminer(p_partie uuid, p_score int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a public.avent_parties;
  j public.avent_jeux;
  c public.avent_config;
  v_s numeric;
  v_motif text;
  v_old public.avent_scores;
  v_bonus boolean;
  v_record boolean := false;
  v_moi record;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into a from public.avent_parties where id = p_partie and user_id = v_uid for update;
  if a.id is null then raise exception 'Partie introuvable.'; end if;
  if a.statut <> 'en_cours' then raise exception 'Cette partie est déjà terminée.'; end if;
  select * into j from public.avent_jeux where jeu = a.jeu;
  select * into c from public.avent_config where id = 1;

  v_s := extract(epoch from now() - a.started_at);
  if p_score is null or p_score < 0 then v_motif := 'score invalide';
  elsif v_s > 1800 then v_motif := 'partie de plus de 30 minutes';
  elsif v_s < j.min_secondes and p_score > 0 then v_motif := 'partie trop courte (' || round(v_s) || ' s)';
  elsif p_score > j.score_max then v_motif := 'score au-dessus du maximum du jeu';
  elsif p_score > j.score_par_seconde * v_s + 50 then v_motif := 'score trop rapide pour la durée';
  elsif a.edition <> extract(year from c.debut)::int then v_motif := 'édition terminée';
  elsif a.started_at >= c.fin then v_motif := 'calendrier clos';
  end if;

  if v_motif is not null then
    update public.avent_parties set statut = 'rejetee', motif = v_motif, ended_at = now(), score = p_score where id = a.id;
    return jsonb_build_object('ok', false, 'motif', v_motif);
  end if;

  update public.avent_parties set statut = 'terminee', ended_at = now(), score = p_score where id = a.id;

  v_bonus := a.jour_local = c.debut + (a.jour - 1);
  select * into v_old from public.avent_scores where edition = a.edition and user_id = v_uid and jour = a.jour for update;
  if v_old.user_id is null then
    insert into public.avent_scores (edition, user_id, jour, score, atteint_at, bonus)
    values (a.edition, v_uid, a.jour, p_score, now(), v_bonus);
    v_record := true;
  else
    if p_score > v_old.score then
      update public.avent_scores set score = p_score, atteint_at = now(), bonus = bonus or v_bonus
      where edition = a.edition and user_id = v_uid and jour = a.jour;
      v_record := true;
    elsif v_bonus and not v_old.bonus then
      update public.avent_scores set bonus = true where edition = a.edition and user_id = v_uid and jour = a.jour;
    end if;
  end if;

  select * into v_moi from public._avent_classement(a.edition) x where x.user_id = v_uid;
  return jsonb_build_object(
    'ok', true, 'score', p_score, 'record', v_record,
    'meilleur', greatest(p_score, coalesce(v_old.score, 0)),
    'bonus', v_bonus,
    'rang', v_moi.rang, 'points', coalesce(v_moi.points, 0));
end;
$$;

-- Avantages en cours (avent ou autre source).
create or replace function public.mes_avantages()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'jusqu')
    from (
      select jsonb_build_object('kind', a.kind, 'valeur', a.valeur, 'jusqu', a.expires_at, 'source', a.source) as x
      from public.avantages_temporaires a
      where a.user_id = v_uid and a.expires_at > now()
      union all
      select jsonb_build_object('kind', 'bouclier', 'valeur', null, 'jusqu', t.expires_at, 'source', t.source)
      from public.troll_shields t
      where t.user_id = v_uid and t.source = 'avent' and t.expires_at > now()
    ) s
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- Effets des avantages
-- ---------------------------------------------------------------------
create or replace function public._avantage_valeur(p_uid uuid, p_kind text)
returns int
language sql stable security definer set search_path = public
as $$
  select coalesce(max(valeur), 0) from public.avantages_temporaires
  where user_id = p_uid and kind = p_kind and expires_at > now()
$$;

-- Renommée majorée : les gains positifs reçoivent un supplément, inscrit
-- à part dans l'historique. Corps repris de 0073.
create or replace function public._add_reputation(p_user uuid, p_delta int, p_reason text, p_quest uuid default null, p_actor uuid default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_pct int;
  v_plus int;
begin
  if p_user is null or coalesce(p_delta, 0) = 0 then return; end if;
  update public.profiles set reputation = coalesce(reputation, 0) + p_delta where id = p_user;
  insert into public.reputation_events (user_id, delta, reason, quest_id, actor_id)
  values (p_user, p_delta, p_reason, p_quest, p_actor);

  if p_delta > 0 and to_regclass('public.avantages_temporaires') is not null then
    v_pct := public._avantage_valeur(p_user, 'renommee_bonus');
    v_plus := floor(p_delta * v_pct / 100.0);
    if v_plus > 0 then
      update public.profiles set reputation = coalesce(reputation, 0) + v_plus where id = p_user;
      insert into public.reputation_events (user_id, delta, reason, quest_id, actor_id)
      values (p_user, v_plus, 'Avantage de l''avent (+' || v_pct || ' %) : ' || coalesce(p_reason, ''), p_quest, p_actor);
    end if;
  end if;
end;
$$;
revoke execute on function public._add_reputation(uuid, int, text, uuid, uuid) from public, anon, authenticated;

-- Roue du jour : gains en zénis doublés.
create or replace function public._avent_roue_double()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.kind = 'zeni' and coalesce(new.amount, 0) > 0 and public._avantage_valeur(new.user_id, 'roue_double') > 0 then
    update public.wallets set balance = balance + new.amount where user_id = new.user_id;
    insert into public.transactions (user_id, amount, reason)
    values (new.user_id, new.amount, 'Roue du jour : gain doublé (avantage de l''avent)');
    new.detail := coalesce(new.detail, '') || case when coalesce(new.detail, '') = '' then '' else ' · ' end || 'doublé par l''avantage de l''avent';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_avent_roue_double on public.wheel_spins;
create trigger trg_avent_roue_double before insert on public.wheel_spins
  for each row execute function public._avent_roue_double();

-- ---------------------------------------------------------------------
-- Notifications « avent »
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
  v_list text[];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'notifications_type_check';
  if v_def is null then return; end if;
  v_list := string_to_array((regexp_match(v_def, '\{([^}]*)\}'))[1], ',');
  if not 'avent' = any (v_list) then
    v_list := v_list || 'avent'::text;
    alter table public.notifications drop constraint notifications_type_check;
    execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_list);
  end if;
end $$;

create or replace function public._notif_mutable(p_type text)
returns boolean
language sql immutable
as $$
  select p_type = any (array[
    'chat_message', 'money_received', 'salary_paid', 'auction', 'market', 'gift', 'wishlist',
    'business', 'quest_gacha', 'title', 'troll', 'poll', 'wedding',
    'travel_arrived', 'exploration', 'incursion', 'wiki', 'propriete', 'rappel', 'quest_new', 'avent'
  ]);
$$;

-- Une fois par jour : la case du jour est ouverte. À la clôture : les
-- admins Économie sont prévenus qu'il reste à distribuer les récompenses.
create or replace function public.avent_annonces()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  c public.avent_config;
  v_today date := public._local_today();
  v_jour int;
  v_jeu text;
  n int := 0;
begin
  select * into c from public.avent_config where id = 1 for update;
  if not c.actif then return 0; end if;

  if now() >= c.fin then
    if not c.fin_annoncee then
      update public.avent_config set fin_annoncee = true where id = 1;
      insert into public.notifications (user_id, type, title, body, link)
      select p.id, 'avent', 'Calendrier de l''avent clos',
             'Le classement est figé. Il reste à distribuer les récompenses.', '/dashboard/admin/avent'
      from public.profiles p
      where p.status = 'active' and (p.is_founder or public.has_permission(p.id, 'manage_economy'));
      get diagnostics n = row_count;
    end if;
    return n;
  end if;

  if c.derniere_annonce is not distinct from v_today then return 0; end if;
  v_jour := v_today - c.debut + 1;
  if v_jour < 1 or v_jour > 24 then return 0; end if;
  update public.avent_config set derniere_annonce = v_today where id = 1;
  select k.jeu into v_jeu from public.avent_cases k where k.jour = v_jour;
  if v_jeu is null then return 0; end if;

  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'avent', 'Case ' || v_jour || ' du calendrier de l''avent',
         (select nom from public.avent_jeux where jeu = v_jeu) || ' : joue aujourd''hui pour le bonus du jour.',
         '/dashboard/avent?case=' || v_jour
  from public.profiles p
  where p.status = 'active';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- Administration (admins Économie)
-- ---------------------------------------------------------------------
create or replace function public._avent_admin_garde()
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.has_permission(v_uid, 'manage_economy') or public.is_sandbox_account(v_uid) then
    raise exception 'Réservé aux admins « Économie ».' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create or replace function public.avent_admin()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  c public.avent_config;
  v_ed int;
begin
  perform public._avent_admin_garde();
  select * into c from public.avent_config where id = 1;
  v_ed := extract(year from c.debut)::int;
  return jsonb_build_object(
    'config', to_jsonb(c) - 'id',
    'edition', v_ed,
    'clos', now() >= c.fin,
    'jeux', (select jsonb_agg(to_jsonb(j) order by j.nom) from public.avent_jeux j),
    'cases', (select jsonb_agg(jsonb_build_object(
                'jour', k.jour, 'jeu', k.jeu, 'ouvre_le', c.debut + (k.jour - 1),
                'joueurs', (select count(*) from public.avent_scores s where s.edition = v_ed and s.jour = k.jour),
                'parties', (select count(*) from public.avent_parties a where a.edition = v_ed and a.jour = k.jour),
                'rejetees', (select count(*) from public.avent_parties a where a.edition = v_ed and a.jour = k.jour and a.statut = 'rejetee'),
                'meilleur', (select max(s.score) from public.avent_scores s where s.edition = v_ed and s.jour = k.jour)
              ) order by k.jour) from public.avent_cases k),
    'recompenses', coalesce((select jsonb_agg(public._avent_recompense_json(r) order by r.rang_min) from public.avent_recompenses r), '[]'::jsonb),
    'classement', coalesce((select jsonb_agg(jsonb_build_object(
                'rang', x.rang, 'nickname', p.nickname, 'points', x.points, 'cases', x.cases,
                'recompense', public._avent_recompense_json(public._avent_recompense_rang(x.rang))) order by x.rang)
              from public._avent_classement(v_ed) x join public.profiles p on p.id = x.user_id where x.rang <= 50), '[]'::jsonb),
    'rejets', coalesce((select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'jour', a.jour, 'score', a.score, 'motif', a.motif, 'at', a.ended_at) order by a.ended_at desc)
              from (select * from public.avent_parties where edition = v_ed and statut = 'rejetee' order by ended_at desc limit 20) a
              join public.profiles p on p.id = a.user_id), '[]'::jsonb),
    'gains', coalesce((select jsonb_agg(jsonb_build_object('rang', g.rang, 'nickname', p.nickname, 'points', g.points, 'zenis', g.zenis,
                'renommee', g.renommee, 'avantage', g.avantage, 'avantage_valeur', g.avantage_valeur, 'avantage_jusqu', g.avantage_jusqu) order by g.rang)
              from public.avent_gains g join public.profiles p on p.id = g.user_id where g.edition = v_ed), '[]'::jsonb)
  );
end;
$$;

create or replace function public.avent_config_set(p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._avent_admin_garde();
  c public.avent_config;
  v_debut date;
  v_fin timestamptz;
begin
  select * into c from public.avent_config where id = 1 for update;
  v_debut := coalesce((p->>'debut')::date, c.debut);
  v_fin := coalesce((p->>'fin')::timestamptz, c.fin);
  if v_fin <= (v_debut::timestamp at time zone 'Europe/Paris') then
    raise exception 'La clôture doit tomber après l''ouverture de la case 1.';
  end if;
  update public.avent_config set
    actif = coalesce((p->>'actif')::boolean, actif),
    debut = v_debut,
    fin = v_fin,
    essais_par_jour = coalesce((p->>'essais_par_jour')::int, essais_par_jour),
    bonus_jour = coalesce((p->>'bonus_jour')::int, bonus_jour),
    -- Nouvelle édition (autre année) : annonces et distribution repartent de zéro.
    derniere_annonce = case when extract(year from v_debut) <> extract(year from c.debut) then null else derniere_annonce end,
    fin_annoncee = case when v_fin <> c.fin or extract(year from v_debut) <> extract(year from c.debut) then false else fin_annoncee end,
    distribue_at = case when extract(year from v_debut) <> extract(year from c.debut) then null else distribue_at end,
    distribue_par = case when extract(year from v_debut) <> extract(year from c.debut) then null else distribue_par end,
    updated_at = now()
  where id = 1;
  perform public.write_audit('avent_config', null, p, null);
end;
$$;

create or replace function public.avent_case_set(p_jour int, p_jeu text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public._avent_admin_garde();
  if p_jour is null or p_jour < 1 or p_jour > 24 then raise exception 'Case inconnue.'; end if;
  if nullif(p_jeu, '') is not null and not exists (select 1 from public.avent_jeux where jeu = p_jeu) then
    raise exception 'Jeu inconnu.';
  end if;
  update public.avent_cases set jeu = nullif(p_jeu, ''), updated_at = now() where jour = p_jour;
  perform public.write_audit('avent_case', null, jsonb_build_object('jour', p_jour, 'jeu', nullif(p_jeu, '')), null);
end;
$$;

create or replace function public.avent_recompense_save(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_min int := (p->>'rang_min')::int;
  v_max int := coalesce((p->>'rang_max')::int, (p->>'rang_min')::int);
  v_z numeric := greatest(coalesce((p->>'zenis')::numeric, 0), 0);
  v_r int := greatest(coalesce((p->>'renommee')::int, 0), 0);
  v_av text := nullif(p->>'avantage', '');
  v_val int := (p->>'avantage_valeur')::int;
  v_h int := (p->>'avantage_heures')::int;
  v_old public.avent_recompenses;
begin
  perform public._avent_admin_garde();
  if v_min is null or v_min < 1 or v_max < v_min then raise exception 'Rangs invalides.'; end if;
  if v_max > 1000 then raise exception 'Rang 1 000 au plus.'; end if;
  if exists (select 1 from public.avent_recompenses r
             where r.id is distinct from v_id and r.rang_min <= v_max and r.rang_max >= v_min) then
    raise exception 'Ces rangs chevauchent une autre récompense.';
  end if;
  if v_av is null then
    v_val := null; v_h := null;
  else
    if v_h is null or v_h < 1 or v_h > 2160 then raise exception 'Durée de l''avantage : 1 h à 90 jours.'; end if;
    if v_av = 'renommee_bonus' and (v_val is null or v_val < 5 or v_val > 200) then
      raise exception 'Majoration de renommée : 5 à 200 %%.';
    end if;
    if v_av <> 'renommee_bonus' then v_val := null; end if;
  end if;
  if v_z = 0 and v_r = 0 and v_av is null then raise exception 'Une récompense vide ne sert à rien.'; end if;

  if v_id is null then
    insert into public.avent_recompenses (rang_min, rang_max, zenis, renommee, avantage, avantage_valeur, avantage_heures)
    values (v_min, v_max, v_z, v_r, v_av, v_val, v_h) returning id into v_id;
  else
    select * into v_old from public.avent_recompenses where id = v_id for update;
    if v_old.id is null then raise exception 'Récompense introuvable.'; end if;
    update public.avent_recompenses set rang_min = v_min, rang_max = v_max,
      renommee = v_r, avantage = v_av, avantage_valeur = v_val, avantage_heures = v_h
    where id = v_id;
    -- Montant changé à l'écran (après réforme, l'écran montre le montant converti).
    if v_z <> round(public._avent_zenis(v_old)) then
      update public.avent_recompenses set zenis = v_z, zenis_set_at = now() where id = v_id;
    end if;
  end if;
  perform public.write_audit('avent_recompense', null, p, null);
  return v_id;
end;
$$;

create or replace function public.avent_recompense_delete(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public._avent_admin_garde();
  delete from public.avent_recompenses where id = p_id;
  perform public.write_audit('avent_recompense_suppr', null, jsonb_build_object('id', p_id), null);
end;
$$;

-- Distribution : une seule fois par édition, après la clôture.
create or replace function public.avent_distribuer()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._avent_admin_garde();
  c public.avent_config;
  v_ed int;
  x record;
  r public.avent_recompenses;
  v_z numeric;
  v_until timestamptz;
  v_txt text;
  n int := 0;
  v_tot numeric := 0;
begin
  select * into c from public.avent_config where id = 1 for update;
  v_ed := extract(year from c.debut)::int;
  if now() < c.fin then raise exception 'Le calendrier n''est pas encore clos (%).', to_char(c.fin at time zone 'Europe/Paris', 'DD/MM à HH24:MI'); end if;
  if c.distribue_at is not null then raise exception 'Récompenses déjà distribuées pour cette édition.'; end if;

  for x in select * from public._avent_classement(v_ed) order by rang loop
    r := public._avent_recompense_rang(x.rang);
    continue when r.id is null;
    v_z := public._avent_zenis(r);
    v_until := null;
    v_txt := '';

    if v_z > 0 then
      update public.wallets set balance = balance + v_z where user_id = x.user_id;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (x.user_id, v_z, 'Calendrier de l''avent ' || v_ed || ' : ' || x.rang || case when x.rang = 1 then 'er' else 'e' end, v_uid);
      v_tot := v_tot + v_z;
      v_txt := v_txt || public._fmt_z(v_z) || ' z';
    end if;
    if r.renommee > 0 then
      update public.profiles set reputation = coalesce(reputation, 0) + r.renommee where id = x.user_id;
      insert into public.reputation_events (user_id, delta, reason, actor_id)
      values (x.user_id, r.renommee, 'Calendrier de l''avent ' || v_ed, v_uid);
      v_txt := v_txt || case when v_txt = '' then '' else ', ' end || '+' || r.renommee || ' renommée';
    end if;
    if r.avantage is not null then
      if r.avantage = 'bouclier' then
        if not exists (select 1 from public.troll_shields where user_id = x.user_id and expires_at is null) then
          v_until := greatest(coalesce((select expires_at from public.troll_shields where user_id = x.user_id), now()), now())
                     + make_interval(hours => r.avantage_heures);
          insert into public.troll_shields (user_id, set_by, reason, expires_at, source)
          values (x.user_id, v_uid, 'Calendrier de l''avent', v_until, 'avent')
          on conflict (user_id) do update set expires_at = excluded.expires_at, reason = excluded.reason, set_by = excluded.set_by, source = 'avent';
        else
          v_until := null;
        end if;
        v_txt := v_txt || case when v_txt = '' then '' else ', ' end || 'bouclier anti-farces';
      else
        v_until := now() + make_interval(hours => r.avantage_heures);
        insert into public.avantages_temporaires (user_id, kind, valeur, expires_at, source)
        values (x.user_id, r.avantage, coalesce(r.avantage_valeur, 1), v_until, 'avent');
        v_txt := v_txt || case when v_txt = '' then '' else ', ' end
                 || case r.avantage when 'roue_double' then 'gains de la roue doublés'
                                    else 'renommée +' || r.avantage_valeur || ' %' end;
      end if;
      if v_until is not null then
        v_txt := v_txt || ' jusqu''au ' || to_char(v_until at time zone 'Europe/Paris', 'DD/MM à HH24:MI');
      end if;
    end if;

    insert into public.avent_gains (edition, user_id, rang, points, zenis, renommee, avantage, avantage_valeur, avantage_jusqu)
    values (v_ed, x.user_id, x.rang, x.points, v_z, r.renommee, r.avantage, r.avantage_valeur, v_until)
    on conflict (edition, user_id) do nothing;

    insert into public.notifications (user_id, type, title, body, link)
    values (x.user_id, 'avent', 'Calendrier de l''avent : ' || x.rang || case when x.rang = 1 then 'er' else 'e' end || ' sur ' ||
              (select count(*) from public._avent_classement(v_ed)),
            'Ta récompense : ' || v_txt || '.', '/dashboard/avent');
    n := n + 1;
  end loop;

  update public.avent_config set distribue_at = now(), distribue_par = v_uid where id = 1;
  perform public.write_audit('avent_distribution', null, jsonb_build_object('edition', v_ed, 'gagnants', n, 'zenis', v_tot), null);
  return jsonb_build_object('gagnants', n, 'zenis', v_tot);
end;
$$;

-- ---------------------------------------------------------------------
-- Tâches de fond (reprise de 0132)
-- ---------------------------------------------------------------------
create or replace function public.run_scheduled_jobs()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
  v_last timestamptz;
  v_n int;
begin
  v := v || jsonb_build_object('sondages', public.polls_publish_due());
  v := v || jsonb_build_object('rappels', public.auctions_remind_due());
  v := v || jsonb_build_object('encheres', public.auctions_settle_due());
  v := v || jsonb_build_object('bourse', public.process_market());

  -- Lot 98 : rappels personnels et nouvelles connexions.
  begin
    v := v || jsonb_build_object('rappels_perso', public.rappels_envoyer_dus());
    v := v || jsonb_build_object('connexions', public._appareils_scanner(null));
  exception when others then
    v := v || jsonb_build_object('lot98_erreur', sqlerrm);
  end;

  -- Lot 101 : versements de la banque isolée (après les 48 h).
  begin
    v := v || jsonb_build_object('banque_isolee', public.banque_isolee_verser_dus());
  exception when others then
    v := v || jsonb_build_object('banque_isolee_erreur', sqlerrm);
  end;

  -- Lot 102 : quêtes programmées (notifications à la publication) et
  -- trajets programmés de la Cartographie (migration Carto 0123, si lancée).
  begin
    v := v || jsonb_build_object('quetes_publiees', public.quests_publish_due());
    if to_regprocedure('public.trajets_programmes_lancer(uuid)') is not null then
      execute 'select public.trajets_programmes_lancer(null)' into v_n;
      v := v || jsonb_build_object('trajets_programmes', v_n);
    end if;
  exception when others then
    v := v || jsonb_build_object('lot102_erreur', sqlerrm);
  end;

  -- Lot 103 : calendrier de l'avent (case du jour, clôture).
  begin
    v := v || jsonb_build_object('avent', public.avent_annonces());
  exception when others then
    v := v || jsonb_build_object('avent_erreur', sqlerrm);
  end;

  select value::timestamptz into v_last from public.app_config where key = 'notif_cleanup_last';
  if v_last is null or v_last < now() - interval '1 hour' then
    perform public._cfg_set_ts('notif_cleanup_last');
    v := v || jsonb_build_object('nettoyage', public.notifications_cleanup());
  end if;

  select value::timestamptz into v_last from public.app_config where key = 'bankruptcy_last_check';
  if v_last is null or v_last < now() - interval '1 hour' then
    perform public._cfg_set_ts('bankruptcy_last_check');
    v := v || jsonb_build_object('faillites', public.businesses_check_bankruptcy());
  end if;

  select value::timestamptz into v_last from public.app_config where key = 'taxes_last_check';
  if v_last is null or v_last < now() - interval '15 minutes' then
    perform public._cfg_set_ts('taxes_last_check');
    perform public.process_weekly_taxes();
    v := v || jsonb_build_object('impots', public.taxes_process_due());
  end if;

  select value::timestamptz into v_last from public.app_config where key = 'economy_last_daily';
  if v_last is null or (v_last at time zone public.stats_timezone())::date < (now() at time zone public.stats_timezone())::date then
    perform public._cfg_set_ts('economy_last_daily');
    v := v || jsonb_build_object('population', public._population_catch_up());
    v := v || jsonb_build_object('economie', public.economy_update(false));
  end if;

  select value::timestamptz into v_last from public.app_config where key = 'inactivity_last_run';
  if v_last is null or (v_last at time zone public.stats_timezone())::date < public._local_today() then
    perform public._cfg_set_ts('inactivity_last_run');
    v := v || jsonb_build_object('absences', public.process_inactivity());
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._avent_edition()', 'public._avent_ouverture(int)', 'public._avent_zenis(public.avent_recompenses)',
    'public._avent_points(int)', 'public._avent_classement(int)', 'public._avent_recompense_rang(int)',
    'public._avent_recompense_json(public.avent_recompenses)', 'public._avantage_valeur(uuid, text)',
    'public._avent_roue_double()', 'public.avent_annonces()', 'public._avent_admin_garde()',
    'public.run_scheduled_jobs()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.avent_etat()', 'public.avent_classement(int)', 'public.avent_case_scores(int)',
    'public.avent_commencer(int)', 'public.avent_terminer(uuid, int)', 'public.mes_avantages()',
    'public.avent_admin()', 'public.avent_config_set(jsonb)', 'public.avent_case_set(int, text)',
    'public.avent_recompense_save(jsonb)', 'public.avent_recompense_delete(uuid)', 'public.avent_distribuer()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
