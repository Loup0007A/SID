-- =========================================================
-- Puissance calculée à partir de 3 facteurs + simulations externes.
--
-- 1) FACTEURS : chaque membre a une Intelligence, une Puissance et une
--    Technique, chacune entre 0 et 100 (table `member_stats`). La
--    PUISSANCE GLOBALE (`profiles.power_score`) devient la moyenne des
--    trois (100 maximum, une décimale), recalculée automatiquement à
--    chaque changement. Elle n'est plus saisie à la main.
--
-- 2) SIMULATIONS : trois sites externes, affichés dans le tableau de bord
--    via une iframe, font progresser un facteur chacun :
--       donjons      (3D-game-world) -> Puissance
--       intelligence (Potions)       -> Intelligence
--       techniques   (Techniques)    -> Technique
--    Une simulation réussie rapporte exactement 1 point (0 si ratée, 0 si
--    le facteur est déjà à 100).
--
--    Déroulé d'une partie :
--      a) le membre clique « Lancer » : le site S.I.D. crée une partie
--         (`simulation_runs`) et un JETON aléatoire à usage unique, passé
--         à l'iframe. Seule l'empreinte (SHA-256) du jeton est stockée.
--      b) en fin de partie, le site externe envoie le résultat à
--         /api/simulations/result avec ce jeton.
--      c) l'API (clé service_role) appelle complete_simulation_run(), qui
--         vérifie : partie connue, pas déjà terminée, pas expirée, durée
--         minimale écoulée, limite quotidienne — puis attribue le point.
--    Le jeton ne sert qu'une fois : impossible de rejouer un même
--    résultat, ou de gagner un point sans avoir lancé une partie depuis le
--    tableau de bord.
--
-- 3) Les anciennes valeurs de puissance saisies à la main sont recopiées
--    dans `power_score_legacy` avant d'être remplacées.
--
-- Réglages (table app_config) :
--   simulation_min_seconds         durée minimale d'une partie (défaut 20 s)
--   simulation_run_ttl_minutes     durée de validité d'une partie (défaut 360 min)
--   simulation_max_results_per_day résultats comptés par jour et par simulation (défaut 10)
--
-- Prérequis : migrations 0040 (fuseau des statistiques), 0039 (maintenance,
-- sanctions) et 0048 (journal d'audit) déjà appliquées — vérifié ci-dessous.
-- =========================================================

do $$
begin
  if to_regclass('public.audit_log') is null then
    raise exception 'Applique d''abord la migration 0048_audit_log.sql (journal d''audit).';
  end if;
  if to_regclass('public.maintenance_flags') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_frozen') then
    raise exception 'Applique d''abord la migration 0039_admin_tools.sql (outils d''administration).';
  end if;
  if not exists (select 1 from pg_proc where proname = 'stats_timezone') then
    raise exception 'Applique d''abord la migration 0040_stats_timezone_fix.sql.';
  end if;
end;
$$;

insert into public.app_config (key, value) values
  ('simulation_min_seconds', '20'),
  ('simulation_run_ttl_minutes', '360'),
  ('simulation_max_results_per_day', '10')
on conflict (key) do nothing;

-- Les simulations peuvent être suspendues depuis Modération, comme la
-- boutique ou la messagerie.
insert into public.maintenance_flags (key, message) values
  ('simulations', 'Les simulations sont temporairement fermées.')
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- 1) Facteurs
-- ---------------------------------------------------------
create table public.member_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  intelligence int not null default 0 check (intelligence between 0 and 100),
  strength int not null default 0 check (strength between 0 and 100),   -- « Puissance » (Donjons)
  technique int not null default 0 check (technique between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table public.member_stats enable row level security;

-- Lecture pour tous les membres connectés (classement, profils) ; aucune
-- écriture directe : uniquement via les fonctions ci-dessous.
create policy "member_stats_select" on public.member_stats for select
  using (auth.uid() is not null);

-- Sauvegarde des anciennes valeurs saisies à la main.
create table public.power_score_legacy (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  power_score int not null,
  saved_at timestamptz not null default now()
);

alter table public.power_score_legacy enable row level security;

create policy "power_score_legacy_select" on public.power_score_legacy for select
  using (public.has_permission(auth.uid(), 'manage_users') or public.has_permission(auth.uid(), 'manage_economy'));

insert into public.power_score_legacy (user_id, power_score)
select id, power_score from public.profiles where power_score <> 0;

-- Le trigger d'audit des profils cite power_score : on le retire le temps
-- de changer le type de la colonne, puis on le recrée (section 4).
drop trigger if exists trg_audit_profiles on public.profiles;

alter table public.profiles drop constraint if exists profiles_power_score_check;
alter table public.profiles alter column power_score drop default;
alter table public.profiles alter column power_score type numeric(5,1) using 0;
alter table public.profiles alter column power_score set default 0;
alter table public.profiles add constraint profiles_power_score_check check (power_score between 0 and 100);

-- Une ligne de facteurs par membre, existant ou à venir.
insert into public.member_stats (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function public.create_member_stats_row()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.member_stats (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_member_stats on public.profiles;
create trigger trg_create_member_stats
  after insert on public.profiles
  for each row execute function public.create_member_stats_row();

-- Puissance globale = moyenne des trois facteurs, recalculée à chaque
-- changement (SECURITY DEFINER : passe le verrou des colonnes protégées
-- de `profiles`, posé en 0037).
create or replace function public.sync_power_from_stats()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
    set power_score = round((new.intelligence + new.strength + new.technique) / 3.0, 1)
    where id = new.user_id;
  return null;
end;
$$;

drop trigger if exists trg_sync_power on public.member_stats;
create trigger trg_sync_power
  after insert or update of intelligence, strength, technique on public.member_stats
  for each row execute function public.sync_power_from_stats();

-- Facteur entraîné par chaque simulation.
create or replace function public.simulation_factor(p_kind text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'donjons' then 'strength'
    when 'intelligence' then 'intelligence'
    when 'techniques' then 'technique'
  end;
$$;

-- ---------------------------------------------------------
-- 2) Correction manuelle des facteurs par l'administration
-- ---------------------------------------------------------
create or replace function public.set_member_stats(p_user_id uuid, p_intelligence int, p_strength int, p_technique int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_old public.member_stats;
  v_changes jsonb := '{}'::jsonb;
begin
  if not (public.has_permission(auth.uid(), 'manage_users') or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if p_intelligence not between 0 and 100 or p_strength not between 0 and 100 or p_technique not between 0 and 100 then
    raise exception 'Chaque facteur doit être compris entre 0 et 100.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Membre introuvable';
  end if;

  insert into public.member_stats (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v_old from public.member_stats where user_id = p_user_id for update;

  if v_old.intelligence <> p_intelligence then
    v_changes := v_changes || jsonb_build_object('intelligence', jsonb_build_object('from', v_old.intelligence, 'to', p_intelligence));
  end if;
  if v_old.strength <> p_strength then
    v_changes := v_changes || jsonb_build_object('strength', jsonb_build_object('from', v_old.strength, 'to', p_strength));
  end if;
  if v_old.technique <> p_technique then
    v_changes := v_changes || jsonb_build_object('technique', jsonb_build_object('from', v_old.technique, 'to', p_technique));
  end if;

  if v_changes = '{}'::jsonb then
    return;
  end if;

  update public.member_stats
    set intelligence = p_intelligence, strength = p_strength, technique = p_technique, updated_at = now()
    where user_id = p_user_id;

  perform public.write_audit('stats_changed', p_user_id, v_changes);
end;
$$;

-- L'ancienne saisie directe de la puissance n'a plus de sens.
create or replace function public.set_power_score(p_user_id uuid, p_score int)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  raise exception 'La puissance est désormais calculée (moyenne de l''intelligence, de la puissance et de la technique) : modifie plutôt ces trois facteurs.';
end;
$$;

-- ---------------------------------------------------------
-- 3) Parties de simulation
-- ---------------------------------------------------------
create table public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('donjons', 'intelligence', 'techniques')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'started' check (status in ('started', 'success', 'failure', 'abandoned', 'expired')),
  points_awarded int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  expires_at timestamptz not null
);

create index simulation_runs_user_kind_idx on public.simulation_runs (user_id, kind, started_at desc);

alter table public.simulation_runs enable row level security;

create policy "simulation_runs_select" on public.simulation_runs for select
  using (
    user_id = auth.uid()
    or public.has_permission(auth.uid(), 'manage_users')
    or public.has_permission(auth.uid(), 'manage_economy')
  );

-- Résultats déjà comptés aujourd'hui (jour local) pour un membre et une simulation.
create or replace function public.simulation_results_today(p_user_id uuid, p_kind text)
returns int
language sql
stable
security definer set search_path = public
as $$
  select count(*)::int
  from public.simulation_runs
  where user_id = p_user_id
    and kind = p_kind
    and status in ('success', 'failure')
    and (finished_at at time zone public.stats_timezone())::date = (now() at time zone public.stats_timezone())::date;
$$;

-- a) Lancement, par le membre connecté. Le jeton est tiré au sort par la
--    route /api/simulations/start ; seule son empreinte arrive ici.
create or replace function public.start_simulation_run(p_kind text, p_token_hash text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := public.get_config_numeric('simulation_max_results_per_day', 10)::int;
  v_ttl numeric := public.get_config_numeric('simulation_run_ttl_minutes', 360);
  v_done int;
  v_run public.simulation_runs;
begin
  if v_uid is null then
    raise exception 'Non connecté';
  end if;
  if public.simulation_factor(p_kind) is null then
    raise exception 'Simulation inconnue';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Jeton invalide';
  end if;
  if coalesce((select status from public.profiles where id = v_uid), '') <> 'active' then
    raise exception 'Compte inactif';
  end if;
  if coalesce((select is_frozen from public.profiles where id = v_uid), false) then
    raise exception 'Ton compte est gelé : impossible de lancer une simulation tant que la sanction est active.';
  end if;
  if not public.is_feature_enabled('simulations') then
    raise exception 'Les simulations sont temporairement fermées par l''administration.';
  end if;

  v_done := public.simulation_results_today(v_uid, p_kind);
  if v_done >= v_limit then
    raise exception 'Limite atteinte : % simulations comptées aujourd''hui pour celle-ci. Reviens demain !', v_limit;
  end if;

  -- Une seule partie en cours par simulation : relancer abandonne la précédente.
  update public.simulation_runs
    set status = 'abandoned', finished_at = now()
    where user_id = v_uid and kind = p_kind and status = 'started';

  insert into public.simulation_runs (user_id, kind, token_hash, expires_at)
  values (v_uid, p_kind, p_token_hash, now() + (v_ttl || ' minutes')::interval)
  returning * into v_run;

  return jsonb_build_object(
    'run_id', v_run.id,
    'kind', v_run.kind,
    'expires_at', v_run.expires_at,
    'results_today', v_done,
    'max_results_per_day', v_limit
  );
end;
$$;

-- b) Lecture d'une partie à partir de son jeton (réservé à l'API serveur).
create or replace function public.get_simulation_run(p_token_hash text)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'run_id', r.id,
    'kind', r.kind,
    'status', case when r.status = 'started' and r.expires_at < now() then 'expired' else r.status end,
    'user_id', r.user_id,
    'nickname', p.nickname,
    'started_at', r.started_at,
    'expires_at', r.expires_at
  )
  from public.simulation_runs r
  join public.profiles p on p.id = r.user_id
  where r.token_hash = p_token_hash;
$$;

-- c) Enregistrement du résultat (réservé à l'API serveur). Renvoie
--    toujours un objet avec "result" : ok, not_found, already_completed,
--    expired, too_fast ou daily_limit.
create or replace function public.complete_simulation_run(p_token_hash text, p_success boolean)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_run public.simulation_runs;
  v_factor text;
  v_min_seconds numeric := public.get_config_numeric('simulation_min_seconds', 20);
  v_limit int := public.get_config_numeric('simulation_max_results_per_day', 10)::int;
  v_old int;
  v_new int;
  v_points int := 0;
  v_power numeric;
begin
  if p_success is null then
    raise exception 'Résultat manquant';
  end if;

  select * into v_run from public.simulation_runs where token_hash = p_token_hash for update;
  if v_run.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  if v_run.status <> 'started' then
    return jsonb_build_object('result', 'already_completed', 'status', v_run.status, 'points_awarded', v_run.points_awarded);
  end if;

  if v_run.expires_at < now() then
    update public.simulation_runs set status = 'expired', finished_at = now() where id = v_run.id;
    return jsonb_build_object('result', 'expired');
  end if;

  if now() - v_run.started_at < (v_min_seconds || ' seconds')::interval then
    -- La partie reste ouverte : un vrai résultat pourra encore être envoyé.
    return jsonb_build_object('result', 'too_fast', 'min_seconds', v_min_seconds);
  end if;

  if public.simulation_results_today(v_run.user_id, v_run.kind) >= v_limit then
    update public.simulation_runs set status = 'abandoned', finished_at = now() where id = v_run.id;
    return jsonb_build_object('result', 'daily_limit', 'max_results_per_day', v_limit);
  end if;

  v_factor := public.simulation_factor(v_run.kind);
  insert into public.member_stats (user_id) values (v_run.user_id) on conflict (user_id) do nothing;

  execute format('select %I from public.member_stats where user_id = $1 for update', v_factor)
    into v_old using v_run.user_id;

  v_new := v_old;
  if p_success then
    v_new := least(100, v_old + 1);
    v_points := v_new - v_old;
    if v_points > 0 then
      execute format('update public.member_stats set %I = $1, updated_at = now() where user_id = $2', v_factor)
        using v_new, v_run.user_id;
    end if;
  end if;

  update public.simulation_runs
    set status = case when p_success then 'success' else 'failure' end,
        points_awarded = v_points,
        finished_at = now()
    where id = v_run.id;

  select power_score into v_power from public.profiles where id = v_run.user_id;

  return jsonb_build_object(
    'result', 'ok',
    'status', case when p_success then 'success' else 'failure' end,
    'kind', v_run.kind,
    'factor', v_factor,
    'points_awarded', v_points,
    'value', v_new,
    'power', v_power
  );
end;
$$;

revoke execute on function public.get_simulation_run(text) from public, anon, authenticated;
revoke execute on function public.complete_simulation_run(text, boolean) from public, anon, authenticated;
grant execute on function public.get_simulation_run(text) to service_role;
grant execute on function public.complete_simulation_run(text, boolean) to service_role;

-- d) Tout ce qu'affiche la page d'une simulation, pour le membre connecté.
create or replace function public.get_simulation_overview()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_stats public.member_stats;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_stats from public.member_stats where user_id = v_uid;

  return jsonb_build_object(
    'intelligence', coalesce(v_stats.intelligence, 0),
    'strength', coalesce(v_stats.strength, 0),
    'technique', coalesce(v_stats.technique, 0),
    'power', coalesce((select power_score from public.profiles where id = v_uid), 0),
    'max_results_per_day', public.get_config_numeric('simulation_max_results_per_day', 10)::int,
    'min_seconds', public.get_config_numeric('simulation_min_seconds', 20)::int,
    'enabled', public.is_feature_enabled('simulations'),
    'results_today', jsonb_build_object(
      'donjons', public.simulation_results_today(v_uid, 'donjons'),
      'intelligence', public.simulation_results_today(v_uid, 'intelligence'),
      'techniques', public.simulation_results_today(v_uid, 'techniques')
    ),
    'recent_runs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', r.kind,
        'status', case when r.status = 'started' and r.expires_at < now() then 'expired' else r.status end,
        'points_awarded', r.points_awarded,
        'started_at', r.started_at,
        'finished_at', r.finished_at
      ) order by r.started_at desc)
      from (
        select * from public.simulation_runs
        where user_id = v_uid
        order by started_at desc
        limit 15
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------
-- 4) Classement et audit
-- ---------------------------------------------------------
drop function if exists public.list_leaderboard();
create function public.list_leaderboard()
returns table (
  user_id uuid,
  nickname text,
  balance numeric,
  reputation int,
  quests_completed bigint,
  power_score numeric,
  intelligence int,
  strength int,
  technique int
)
language sql
stable
security definer set search_path = public
as $$
  select
    p.id,
    p.nickname,
    coalesce(w.balance, 0),
    p.reputation,
    coalesce(qc.cnt, 0),
    p.power_score,
    coalesce(s.intelligence, 0),
    coalesce(s.strength, 0),
    coalesce(s.technique, 0)
  from public.profiles p
  left join public.wallets w on w.user_id = p.id
  left join public.member_stats s on s.user_id = p.id
  left join (
    select qp.user_id, count(*) as cnt
    from public.quest_participants qp
    where qp.status = 'validated'
    group by qp.user_id
  ) qc on qc.user_id = p.id
  where p.status = 'active';
$$;

-- Audit des profils : la puissance n'y figure plus (elle se déduit des
-- facteurs, dont les changements sont journalisés à part : stats_changed
-- pour l'administration, simulation_runs pour les simulations).
create or replace function public.audit_profiles_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_changes jsonb := '{}'::jsonb;
  k text;
begin
  foreach k in array array['status', 'is_muted', 'is_frozen', 'is_founder', 'member_rank'] loop
    if v_old -> k is distinct from v_new -> k then
      v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k));
    end if;
  end loop;
  if v_changes <> '{}'::jsonb then
    perform public.write_audit('profile_changed', new.id, v_changes, new.nickname);
  end if;
  return new;
end;
$$;

create trigger trg_audit_profiles
  after update on public.profiles
  for each row
  when (
    old.status is distinct from new.status
    or old.is_muted is distinct from new.is_muted
    or old.is_frozen is distinct from new.is_frozen
    or old.is_founder is distinct from new.is_founder
    or old.member_rank is distinct from new.member_rank
  )
  execute function public.audit_profiles_change();
