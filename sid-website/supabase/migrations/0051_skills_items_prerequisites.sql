-- =========================================================
-- Lot 25
--  1) Compétences : chaque épreuve a ses propres points (0 à 100).
--     Intelligence = moyenne de Potions, Énigmes et Problème ;
--     Puissance = Donjons (mondes-vivants) ; Technique = Techniques.
--  2) Niveaux réglables par l'administration (points + progression
--     dans les sites, via la synchronisation de la migration 0050).
--  3) Objets « réinitialisation des délais » vendus au comptoir.
--  4) Objets du comptoir supprimés (masqués) par leur vendeur.
--  5) Prérequis de caractéristiques pour prendre une quête.
--
-- Prérequis : migrations 0049 et 0050.
-- =========================================================

do $$
begin
  if to_regclass('public.simulation_progress') is null then
    raise exception 'Applique d''abord la migration 0050_simulation_progress.sql.';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 1) Compétences
-- ---------------------------------------------------------

-- Les facteurs deviennent décimaux (l'intelligence est une moyenne).
drop trigger if exists trg_sync_power on public.member_stats;
alter table public.member_stats
  alter column intelligence type numeric(4,1),
  alter column strength type numeric(4,1),
  alter column technique type numeric(4,1);
create trigger trg_sync_power
  after insert or update of intelligence, strength, technique on public.member_stats
  for each row execute function public.sync_power_from_stats();

-- Simulation à laquelle appartient une compétence (= slug d'épreuve des sites).
create or replace function public.skill_kind(p_skill text)
returns text
language sql
immutable
as $$
  select case p_skill
    when 'potions' then 'intelligence'
    when 'enigmes' then 'intelligence'
    when 'probleme' then 'intelligence'
    when 'techniques' then 'techniques'
    when 'mondes-vivants' then 'donjons'
  end;
$$;

create table public.member_skills (
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill text not null check (public.skill_kind(skill) is not null),
  points int not null default 0 check (points between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

alter table public.member_skills enable row level security;
create policy "member_skills_select" on public.member_skills for select
  using (auth.uid() is not null);

-- Recalcule les trois facteurs d'un membre à partir de ses compétences.
create or replace function public.recompute_member_factors(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.member_stats (user_id) values (p_user_id) on conflict (user_id) do nothing;
  update public.member_stats s
    set intelligence = round(coalesce((select sum(points) from public.member_skills
                                        where user_id = p_user_id and skill in ('potions', 'enigmes', 'probleme')), 0) / 3.0, 1),
        strength = coalesce((select points from public.member_skills where user_id = p_user_id and skill = 'mondes-vivants'), 0),
        technique = coalesce((select points from public.member_skills where user_id = p_user_id and skill = 'techniques'), 0),
        updated_at = now()
    where s.user_id = p_user_id;
end;
$$;

revoke execute on function public.recompute_member_factors(uuid) from public, anon, authenticated;

create or replace function public.member_skills_changed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.recompute_member_factors(case when tg_op = 'DELETE' then old.user_id else new.user_id end);
  return null;
end;
$$;

create trigger trg_member_skills_changed
  after insert or update or delete on public.member_skills
  for each row execute function public.member_skills_changed();

-- Reprise de l'existant : les points d'intelligence déjà gagnés ne disaient
-- pas de quelle épreuve ils venaient ; on les donne aux trois, pour que
-- l'intelligence (leur moyenne) reste la même.
insert into public.member_skills (user_id, skill, points)
select s.user_id, k.skill, round(case k.skill when 'mondes-vivants' then s.strength
                                              when 'techniques' then s.technique
                                              else s.intelligence end)::int
from public.member_stats s
cross join (values ('potions'), ('enigmes'), ('probleme'), ('techniques'), ('mondes-vivants')) as k(skill)
where case k.skill when 'mondes-vivants' then s.strength
                   when 'techniques' then s.technique
                   else s.intelligence end > 0
on conflict do nothing;

alter table public.simulation_runs add column if not exists skill text;

-- Classement : facteurs décimaux.
drop function if exists public.list_leaderboard();
create function public.list_leaderboard()
returns table (
  user_id uuid,
  nickname text,
  balance numeric,
  reputation int,
  quests_completed bigint,
  power_score numeric,
  intelligence numeric,
  strength numeric,
  technique numeric
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

-- Résultat d'une partie : +1 point dans la compétence de l'épreuve jouée.
drop function if exists public.complete_simulation_run(text, boolean);
create or replace function public.complete_simulation_run(p_token_hash text, p_success boolean, p_epreuve text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_run public.simulation_runs;
  v_skill text;
  v_factor text;
  v_min_seconds numeric := public.get_config_numeric('simulation_min_seconds', 20);
  v_limit int := public.get_config_numeric('simulation_max_results_per_day', 10)::int;
  v_old int;
  v_new int;
  v_points int := 0;
  v_value numeric;
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

  -- Compétence jouée : imposée pour une simulation à épreuve unique, à
  -- préciser pour l'Intelligence (Potions, Énigmes ou Problème).
  v_skill := case v_run.kind
    when 'donjons' then 'mondes-vivants'
    when 'techniques' then 'techniques'
    else case when public.skill_kind(p_epreuve) = 'intelligence' then p_epreuve end
  end;
  if v_skill is null then
    -- La partie reste ouverte : le bon résultat peut encore arriver.
    return jsonb_build_object('result', 'invalid_epreuve');
  end if;

  if v_run.expires_at < now() then
    update public.simulation_runs set status = 'expired', finished_at = now() where id = v_run.id;
    return jsonb_build_object('result', 'expired');
  end if;

  if now() - v_run.started_at < (v_min_seconds || ' seconds')::interval then
    return jsonb_build_object('result', 'too_fast', 'min_seconds', v_min_seconds);
  end if;

  if public.simulation_results_today(v_run.user_id, v_run.kind) >= v_limit then
    update public.simulation_runs set status = 'abandoned', finished_at = now() where id = v_run.id;
    return jsonb_build_object('result', 'daily_limit', 'max_results_per_day', v_limit);
  end if;

  insert into public.member_skills (user_id, skill) values (v_run.user_id, v_skill) on conflict do nothing;
  select points into v_old from public.member_skills where user_id = v_run.user_id and skill = v_skill for update;

  v_new := v_old;
  if p_success then
    v_new := least(100, v_old + 1);
    v_points := v_new - v_old;
    if v_points > 0 then
      update public.member_skills set points = v_new, updated_at = now()
        where user_id = v_run.user_id and skill = v_skill;
    end if;
  end if;

  update public.simulation_runs
    set status = case when p_success then 'success' else 'failure' end,
        points_awarded = v_points,
        skill = v_skill,
        finished_at = now()
    where id = v_run.id;

  v_factor := public.simulation_factor(v_run.kind);
  execute format('select %I from public.member_stats where user_id = $1', v_factor) into v_value using v_run.user_id;
  select power_score into v_power from public.profiles where id = v_run.user_id;

  return jsonb_build_object(
    'result', 'ok',
    'status', case when p_success then 'success' else 'failure' end,
    'kind', v_run.kind,
    'factor', v_factor,
    'skill', v_skill,
    'skill_value', v_new,
    'points_awarded', v_points,
    'value', v_value,
    'power', v_power
  );
end;
$$;

revoke execute on function public.complete_simulation_run(text, boolean, text) from public, anon, authenticated;
grant execute on function public.complete_simulation_run(text, boolean, text) to service_role;

-- ---------------------------------------------------------
-- 2) Niveaux réglés par l'administration
-- ---------------------------------------------------------

-- Empreinte FNV-1a 32 bits, identique à fnv() des sites (préfixe des clés
-- de Potions, propre à l'adresse e-mail du joueur).
create or replace function public.sid_fnv(p text)
returns text
language plpgsql
immutable
as $$
declare
  h bigint := 2166136261;
  i int;
begin
  for i in 1 .. coalesce(char_length(p), 0) loop
    h := (h # ascii(substr(p, i, 1))) & 4294967295;
    h := (h * 16777619) & 4294967295;
  end loop;
  return lpad(to_hex(h), 8, '0');
end;
$$;

-- Écrit des clés dans la progression synchronisée d'un membre (les sites
-- les récupèrent à la prochaine ouverture depuis le S.I.D.).
create or replace function public.write_simulation_progress(p_user_id uuid, p_kind text, p_set jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_set is null or p_set = '{}'::jsonb then
    return;
  end if;
  insert into public.simulation_progress as sp (user_id, kind, data)
  values (p_user_id, p_kind, p_set)
  on conflict (user_id, kind) do update
    set data = sp.data || p_set, updated_at = now();
end;
$$;

revoke execute on function public.write_simulation_progress(uuid, text, jsonb) from public, anon, authenticated;

-- p_levels : { "potions": 12, "enigmes": 4, "probleme": 0, "techniques": 30, "mondes-vivants": 7 }
-- (seules les compétences présentes sont modifiées).
create or replace function public.set_member_levels(p_user_id uuid, p_levels jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_email text;
  v_key text;
  v_val jsonb;
  v_level int;
  v_old int;
  v_changes jsonb := '{}'::jsonb;
  v_intel jsonb := '{}'::jsonb;
  v_tech jsonb := '{}'::jsonb;
  v_donj jsonb := '{}'::jsonb;
  v_prefix text;
begin
  if not (public.has_permission(auth.uid(), 'manage_users') or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if p_levels is null or jsonb_typeof(p_levels) <> 'object' then
    raise exception 'Niveaux invalides';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Membre introuvable';
  end if;

  select lower(trim(email)) into v_email from auth.users where id = p_user_id;
  v_prefix := 'sq_' || public.sid_fnv(coalesce(v_email, '')) || '_prog_';

  for v_key, v_val in select * from jsonb_each(p_levels) loop
    if public.skill_kind(v_key) is null then
      raise exception 'Compétence inconnue : %', v_key;
    end if;
    if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric <> round((v_val #>> '{}')::numeric) then
      raise exception 'Le niveau doit être un nombre entier.';
    end if;
    v_level := (v_val #>> '{}')::int;
    if v_level not between 0 and 100 then
      raise exception 'Chaque niveau doit être compris entre 0 et 100.';
    end if;

    select points into v_old from public.member_skills where user_id = p_user_id and skill = v_key;
    v_old := coalesce(v_old, 0);
    if v_old = v_level then
      continue;
    end if;

    insert into public.member_skills as ms (user_id, skill, points) values (p_user_id, v_key, v_level)
    on conflict (user_id, skill) do update set points = excluded.points, updated_at = now();
    v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('from', v_old, 'to', v_level));

    -- Progression dans les sites : niveau N réussi = N débloqué (N+1 ouvert).
    case v_key
      when 'potions' then v_intel := v_intel || jsonb_build_object(v_prefix || '1', v_level::text);
      when 'enigmes' then v_intel := v_intel || jsonb_build_object(v_prefix || '2', v_level::text);
      when 'probleme' then v_intel := v_intel || jsonb_build_object(v_prefix || '3', v_level::text);
      when 'techniques' then v_tech := jsonb_build_object('sqt_prog', v_level::text);
      when 'mondes-vivants' then
        v_donj := jsonb_build_object('mv-done',
          '[' || coalesce((select string_agg(i::text, ',' order by i) from generate_series(1, v_level) i), '') || ']');
    end case;
  end loop;

  if v_changes = '{}'::jsonb then
    return;
  end if;

  perform public.write_simulation_progress(p_user_id, 'intelligence', v_intel);
  perform public.write_simulation_progress(p_user_id, 'techniques', v_tech);
  perform public.write_simulation_progress(p_user_id, 'donjons', v_donj);
  perform public.write_audit('levels_changed', p_user_id, v_changes);
end;
$$;

-- L'ancienne correction directe des facteurs : les facteurs se déduisent
-- maintenant des niveaux.
create or replace function public.set_member_stats(p_user_id uuid, p_intelligence int, p_strength int, p_technique int)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  raise exception 'Les facteurs se calculent à partir des niveaux de chaque compétence : utilise set_member_levels.';
end;
$$;

-- ---------------------------------------------------------
-- 3) Objets « réinitialisation des délais »
-- ---------------------------------------------------------
alter table public.shop_items add column if not exists effect text
  check (effect in ('reset_cooldowns'));

-- Seule l'administration du comptoir peut créer un objet à effet.
create or replace function public.guard_shop_item_effect()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.effect is not null)
     or (tg_op = 'UPDATE' and new.effect is distinct from old.effect) then
    if not public.has_permission(auth.uid(), 'manage_shop') then
      raise exception 'Seule l''administration du comptoir peut créer des objets à effet.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_shop_item_effect on public.shop_items;
create trigger trg_guard_shop_item_effect
  before insert or update on public.shop_items
  for each row execute function public.guard_shop_item_effect();

-- Objets à usage unique possédés par chaque membre.
create table public.member_consumables (
  user_id uuid not null references public.profiles(id) on delete cascade,
  effect text not null check (effect in ('reset_cooldowns')),
  quantity int not null default 0 check (quantity >= 0),
  primary key (user_id, effect)
);

alter table public.member_consumables enable row level security;
create policy "member_consumables_select" on public.member_consumables for select
  using (user_id = auth.uid());

create or replace function public.grant_purchased_consumable()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_effect text;
begin
  select effect into v_effect from public.shop_items where id = new.item_id;
  if v_effect is not null and new.status <> 'cancelled' then
    insert into public.member_consumables as mc (user_id, effect, quantity)
    values (new.user_id, v_effect, new.quantity)
    on conflict (user_id, effect) do update set quantity = mc.quantity + excluded.quantity;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_grant_purchased_consumable on public.purchases;
create trigger trg_grant_purchased_consumable
  after insert on public.purchases
  for each row execute function public.grant_purchased_consumable();

-- Utilise un objet : efface tous les délais d'attente enregistrés (les trois
-- simulations, toutes leurs épreuves). Les sites les retirent de l'appareil
-- à la prochaine ouverture depuis le S.I.D.
create or replace function public.use_cooldown_reset()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_qty int;
  v_row public.simulation_progress;
  v_tomb jsonb;
  v_cleared int := 0;
begin
  if v_uid is null then
    raise exception 'Non connecté';
  end if;

  select quantity into v_qty from public.member_consumables
    where user_id = v_uid and effect = 'reset_cooldowns' for update;
  if coalesce(v_qty, 0) < 1 then
    raise exception 'Tu n''as aucun objet de réinitialisation des délais.';
  end if;

  update public.member_consumables set quantity = quantity - 1
    where user_id = v_uid and effect = 'reset_cooldowns';

  for v_row in select * from public.simulation_progress where user_id = v_uid for update loop
    select coalesce(jsonb_object_agg(key, null), '{}'::jsonb), count(*)
      into v_tomb, v_qty
      from jsonb_each(v_row.data)
      where value <> 'null'::jsonb
        and (key ~ '^sq_[^_]+_cd_' or key = 'sqt_cd');
    if v_qty > 0 then
      update public.simulation_progress set data = data || v_tomb, updated_at = now()
        where user_id = v_uid and kind = v_row.kind;
      v_cleared := v_cleared + v_qty;
    end if;
  end loop;

  return jsonb_build_object(
    'cleared', v_cleared,
    'remaining', (select quantity from public.member_consumables where user_id = v_uid and effect = 'reset_cooldowns')
  );
end;
$$;

-- Page d'une simulation : + compétences et objets disponibles.
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
    'skills', coalesce((select jsonb_object_agg(skill, points) from public.member_skills where user_id = v_uid), '{}'::jsonb),
    'cooldown_resets', coalesce((select quantity from public.member_consumables where user_id = v_uid and effect = 'reset_cooldowns'), 0),
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
        'skill', r.skill,
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
-- 4) Objets du comptoir supprimés par leur vendeur
-- ---------------------------------------------------------
-- Suppression « visuelle » : l'objet disparaît de la vitrine et de la liste
-- du vendeur, mais reste en base pour l'historique des achats.
alter table public.shop_items add column if not exists hidden_at timestamptz;

-- ---------------------------------------------------------
-- 5) Prérequis des quêtes
-- ---------------------------------------------------------
alter table public.quests
  add column if not exists min_intelligence numeric(4,1) not null default 0 check (min_intelligence between 0 and 100),
  add column if not exists min_strength numeric(4,1) not null default 0 check (min_strength between 0 and 100),
  add column if not exists min_technique numeric(4,1) not null default 0 check (min_technique between 0 and 100),
  add column if not exists min_power numeric(4,1) not null default 0 check (min_power between 0 and 100);

create or replace function public.check_quest_prerequisites()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_q public.quests;
  v_s public.member_stats;
  v_power numeric;
  v_missing text[] := '{}';
begin
  -- Un responsable des quêtes qui inscrit quelqu'un d'autre passe outre.
  if new.user_id <> auth.uid() and public.has_permission(auth.uid(), 'manage_quests') then
    return new;
  end if;

  select * into v_q from public.quests where id = new.quest_id;
  if v_q.id is null then
    return new;
  end if;

  select * into v_s from public.member_stats where user_id = new.user_id;
  select power_score into v_power from public.profiles where id = new.user_id;

  if coalesce(v_s.intelligence, 0) < v_q.min_intelligence then
    v_missing := v_missing || format('Intelligence %s (tu as %s)', trim_scale(v_q.min_intelligence), trim_scale(coalesce(v_s.intelligence, 0)));
  end if;
  if coalesce(v_s.strength, 0) < v_q.min_strength then
    v_missing := v_missing || format('Puissance %s (tu as %s)', trim_scale(v_q.min_strength), trim_scale(coalesce(v_s.strength, 0)));
  end if;
  if coalesce(v_s.technique, 0) < v_q.min_technique then
    v_missing := v_missing || format('Technique %s (tu as %s)', trim_scale(v_q.min_technique), trim_scale(coalesce(v_s.technique, 0)));
  end if;
  if coalesce(v_power, 0) < v_q.min_power then
    v_missing := v_missing || format('Puissance globale %s (tu as %s)', trim_scale(v_q.min_power), trim_scale(coalesce(v_power, 0)));
  end if;

  if cardinality(v_missing) > 0 then
    raise exception 'Prérequis non atteints : %.', array_to_string(v_missing, ', ');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_quest_prerequisites on public.quest_participants;
create trigger trg_check_quest_prerequisites
  before insert on public.quest_participants
  for each row execute function public.check_quest_prerequisites();
