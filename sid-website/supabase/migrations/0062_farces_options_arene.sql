-- =========================================================
-- Lot 36 — Options de chaque farce et arène 3D du dragon.
--
-- 1. Chaque pouvoir a désormais ses réglages (choisis dans un panneau sur
--    la page Titres) ; la base les vérifie et les borne.
-- 2. Le Défi du Dragon devient une bataille dans le jeu 3D : le lanceur
--    pilote le dragon, sa cible (et jusqu'à 5 joueurs en plus, 1 M de zénis
--    chacun) est convoquée dans l'arène. Options payantes : tout le S.I.D.
--    convoqué en tribune (5 M) et cinématique de fin où le dragon carbonise
--    ou dévore le dernier joueur (5 M). Remboursé si personne ne vient.
--
-- Prérequis : migration 0061.
-- =========================================================

alter table public.troll_actions add column if not exists result jsonb;

-- ---------------------------------------------------------
-- 1) Lecture sûre des options
-- ---------------------------------------------------------
create or replace function public._jint(p jsonb, k text, d int, lo int, hi int)
returns int
language sql
immutable
as $$
  select least(greatest(case when (p->>k) ~ '^-?\d{1,9}$' then (p->>k)::int else d end, lo), hi);
$$;

create or replace function public._jbool(p jsonb, k text, d boolean)
returns boolean
language sql
immutable
as $$
  select case when jsonb_typeof(p->k) = 'boolean' then (p->>k)::boolean else d end;
$$;

create or replace function public._jpick(p jsonb, k text, allowed text[], d text)
returns text
language sql
immutable
as $$
  select case when (p->>k) = any(allowed) then p->>k else d end;
$$;

-- Texte libre : sans caractères de contrôle, espaces resserrés, borné.
create or replace function public._jtxt(v text, maxlen int)
returns text
language sql
immutable
as $$
  select nullif(left(btrim(regexp_replace(regexp_replace(coalesce(v, ''), '[\x00-\x1f\x7f]', ' ', 'g'), '\s+', ' ', 'g')), maxlen), '');
$$;

create or replace function public._troll_params(p_power text, p_level int, p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  p0 jsonb := case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end;
  o jsonb := '{}'::jsonb;
  lvl int := greatest(coalesce(p_level, 1), 1);
  maxc int;
  el jsonb;
  a text;
  b text;
  arr jsonb := '[]'::jsonb;
  k text;
  v text;
  n int := 0;
begin
  case p_power
  when 'calcul' then
    o := jsonb_build_object('count', public._jint(p0, 'count', 3, 1, 5), 'level', public._jint(p0, 'level', 50, 20, 80), 'reset', public._jbool(p0, 'reset', true));
  when 'hantise' then
    maxc := least(75, 35 + 10 * (lvl - 1));
    o := jsonb_build_object(
      'creature', public._jpick(p0, 'creature', array['fantome', 'crane', 'citrouille', 'chauvesouris', 'ovni'], 'fantome'),
      'chance', public._jint(p0, 'chance', maxc, 10, maxc),
      'catches', public._jint(p0, 'catches', 3 + lvl, 1, 3 + lvl),
      'message', public._jtxt(p0->>'message', 80));
  when 'fete' then
    o := jsonb_build_object(
      'theme', public._jpick(p0, 'theme', array['anniversaire', 'carnaval', 'nouvelan', 'disco'], 'anniversaire'),
      'message', public._jtxt(p0->>'message', 80),
      'density', public._jint(p0, 'density', 2, 1, 3),
      'cursor', public._jpick(p0, 'cursor', array['🎉', '🥳', '🎈', '🍰', '🎊', '🦄'], '🎉'));
  when 'abysses' then
    o := jsonb_build_object(
      'speed', public._jpick(p0, 'speed', array['lent', 'moyen', 'rapide'], 'moyen'),
      'invert', public._jbool(p0, 'invert', true),
      'creatures', public._jbool(p0, 'creatures', true),
      'darkness', public._jint(p0, 'darkness', 2, 1, 3));
  when 'huissier' then
    o := jsonb_build_object(
      'word', public._jpick(p0, 'word', array['SAISI', 'CONFISQUÉ', 'VENDU', 'SOUS SCELLÉS'], 'SAISI'),
      'items', public._jtxt(p0->>'items', 160),
      'tone', public._jpick(p0, 'tone', array['officiel', 'menacant', 'ridicule'], 'officiel'),
      'every', public._jint(p0, 'every', 3, 1, 6));
  when 'flatterie' then
    o := jsonb_build_object(
      'phrase', coalesce(public._jtxt(p0->>'phrase', 60), 'est le meilleur !'),
      'color', public._jpick(p0, 'color', array['#B23B2E', '#E8C547', '#D6579A', '#3F8F5F'], '#B23B2E'),
      'every', public._jint(p0, 'every', 1, 1, 3));
  when 'miroir' then
    o := jsonb_build_object(
      'mode', public._jpick(p0, 'mode', array['horizontal', 'vertical', 'rotation', 'toupie'], 'horizontal'),
      'every', public._jint(p0, 'every', 70, 20, 180));
  when 'reecriture' then
    if jsonb_typeof(p0->'custom') = 'array' then
      for el in select value from jsonb_array_elements(p0->'custom') loop
        exit when n >= 6;
        if jsonb_typeof(el) = 'array' then
          a := public._jtxt(el->>0, 30);
          b := public._jtxt(el->>1, 30);
          if a is not null and b is not null then
            arr := arr || jsonb_build_array(jsonb_build_array(a, b));
            n := n + 1;
          end if;
        end if;
      end loop;
    end if;
    o := jsonb_build_object('theme', public._jpick(p0, 'theme', array['potager', 'pirate', 'bebe', 'medieval'], 'potager'), 'custom', arr);
  when 'rationnement' then
    o := jsonb_build_object('interval', public._jint(p0, 'interval', 8, 3, 15), 'keys', public._jbool(p0, 'keys', false));
  when 'avenant' then
    if jsonb_typeof(p0->'clauses') = 'array' then
      for el in select value from jsonb_array_elements(p0->'clauses') loop
        exit when n >= 3;
        a := public._jtxt(el #>> '{}', 140);
        if a is not null then arr := arr || to_jsonb(a); n := n + 1; end if;
      end loop;
    end if;
    o := jsonb_build_object('clauses', arr, 'dodges', public._jint(p0, 'dodges', 3, 0, 5), 'signature', public._jbool(p0, 'signature', false));
  when 'reseau' then
    o := jsonb_build_object('map', '{}'::jsonb);
    if jsonb_typeof(p0->'map') = 'object' then
      for k, v in select key, value #>> '{}' from jsonb_each(p0->'map') loop
        if k ~ '^/dashboard(/[a-z0-9-]+)*$' and v ~ '^/dashboard(/[a-z0-9-]+)*$' and n < 30 then
          o := jsonb_set(o, array['map'], (o->'map') || jsonb_build_object(k, v));
          n := n + 1;
        end if;
      end loop;
    end if;
    o := o || jsonb_build_object(
      'logic', public._jpick(p0, 'logic', array['fixe', 'rotation', 'aleatoire', 'echange'], 'fixe'),
      'every', public._jint(p0, 'every', 30, 10, 120));
  when 'defi_dragon' then
    o := jsonb_build_object(
      'skin', public._jpick(p0, 'skin', array['demon', 'noir', 'drake'], 'demon'),
      'spectators', public._jbool(p0, 'spectators', false),
      'finale', public._jpick(p0, 'finale', array['carboniser', 'devorer'], null));
  else
    o := '{}'::jsonb;
  end case;
  return o;
end;
$$;

-- Durées, recharges : le dragon ne vise plus « tout le S.I.D. » (la tribune
-- remplace cette option), la fête si (niveau 3).
create or replace function public._troll_spec(p_power text, p_level int, p_everyone boolean)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'minutes', case p_power
      when 'hantise' then 10 + 2 * (greatest(p_level, 1) - 1)
      when 'fete' then 10 + 3 * (greatest(p_level, 1) - 1)
      when 'defi_dragon' then 12
      else 10 end,
    'cooldown', case
      when p_everyone then 1440
      when p_power = 'defi_dragon' then 120
      else 180 end,
    'everyone_allowed', p_power = 'fete' and p_level >= 3
  );
$$;

-- ---------------------------------------------------------
-- 2) Lancement
-- ---------------------------------------------------------
create or replace function public.launch_troll(p_power text, p_target uuid, p_params jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_title record;
  v_everyone boolean := p_target is null;
  v_spec jsonb;
  v_last timestamptz;
  v_until timestamptz;
  v_target public.profiles;
  v_other public.profiles;
  v_params jsonb;
  v_players jsonb := '[]'::jsonb;
  v_extra text;
  v_extras int := 0;
  v_cost numeric := 0;
  v_id bigint;
  v_ends timestamptz;
  -- Arène : réglables dans app_config (Supabase), sans redéploiement.
  v_max int := greatest(0, least(20, public.get_config_numeric('arena_max_extra', 5)::int));
begin
  if v_uid is null then
    raise exception 'Non connecté.';
  end if;
  if not public._trolls_enabled() then
    raise exception 'Les farces sont désactivées par l''administration pour le moment.';
  end if;

  select t.id, t.name, t.power, coalesce(ut.level, 1) as level into v_title
  from public.profiles p
  join public.titles t on t.id = p.equipped_title
  join public.user_titles ut on ut.user_id = p.id and ut.title_id = t.id
  where p.id = v_uid;
  if v_title.id is null or v_title.power <> p_power then
    raise exception 'Équipe d''abord le titre qui donne ce pouvoir.';
  end if;

  v_spec := public._troll_spec(p_power, v_title.level, v_everyone);
  if v_everyone and not (v_spec->>'everyone_allowed')::boolean then
    raise exception 'Choisis une cible.';
  end if;

  select max(created_at) into v_last from public.troll_actions
    where actor_id = v_uid and power = p_power and (target_id is null) = v_everyone;
  if v_last is not null and v_last + make_interval(mins => (v_spec->>'cooldown')::int) > now() then
    raise exception 'Pouvoir en recharge : encore % min.',
      ceil(extract(epoch from (v_last + make_interval(mins => (v_spec->>'cooldown')::int) - now())) / 60);
  end if;

  if not v_everyone then
    if p_target = v_uid then
      raise exception 'Pas sur toi-même !';
    end if;
    select * into v_target from public.profiles where id = p_target;
    if v_target.id is null or v_target.status <> 'active'
       or (coalesce(v_target.is_invisible, false) and not public.has_permission(v_uid, 'manage_users')) then
      raise exception 'Membre introuvable.';
    end if;
    if exists (select 1 from public.troll_shields where user_id = p_target) then
      raise exception '% est protégé des farces par l''administration.', v_target.nickname;
    end if;
    if exists (select 1 from public.troll_actions where target_id = p_target and cancelled_at is null and ends_at > now()) then
      raise exception '% subit déjà une farce : attends qu''elle se termine.', v_target.nickname;
    end if;
    select max(ends_at) + interval '30 minutes' into v_until from public.troll_actions
      where target_id = p_target and cancelled_at is null and ends_at <= now();
    if v_until is not null and v_until > now() then
      raise exception '% se remet de sa dernière farce : encore % min de répit.', v_target.nickname,
        ceil(extract(epoch from (v_until - now())) / 60);
    end if;
  end if;

  v_params := public._troll_params(p_power, v_title.level, p_params);

  if p_power = 'reseau' and v_params->'map' = '{}'::jsonb and v_params->>'logic' <> 'aleatoire' then
    raise exception 'Relie au moins un lien à une autre page.';
  end if;

  -- Arène du dragon : joueurs en plus et options payantes.
  if p_power = 'defi_dragon' then
    v_players := jsonb_build_array(p_target::text);
    if jsonb_typeof(p_params->'players') = 'array' then
      for v_extra in select value #>> '{}' from jsonb_array_elements(p_params->'players') loop
        continue when v_extra is null or v_extra !~ '^[0-9a-f-]{36}$';
        continue when v_extra = v_uid::text or v_players ? v_extra;
        if v_extras >= v_max then
          raise exception 'Au plus % joueur(s) en plus de ta cible.', v_max;
        end if;
        select * into v_other from public.profiles where id = v_extra::uuid;
        if v_other.id is null or v_other.status <> 'active'
           or (coalesce(v_other.is_invisible, false) and not public.has_permission(v_uid, 'manage_users')) then
          raise exception 'Un des joueurs convoqués est introuvable.';
        end if;
        if exists (select 1 from public.troll_shields where user_id = v_other.id) then
          raise exception '% est protégé des farces par l''administration.', v_other.nickname;
        end if;
        v_players := v_players || to_jsonb(v_extra);
        v_extras := v_extras + 1;
      end loop;
    end if;
    v_cost := v_extras * public.get_config_numeric('arena_price_player', 1000000)
            + case when (v_params->>'spectators')::boolean then public.get_config_numeric('arena_price_tribune', 5000000) else 0 end
            + case when v_params->>'finale' is not null then public.get_config_numeric('arena_price_finale', 5000000) else 0 end;
    if v_cost > 0 then
      update public.wallets set balance = balance - v_cost where user_id = v_uid and balance >= v_cost;
      if not found then
        raise exception 'Il te faut % zénis pour ces options.', to_char(v_cost, 'FM999G999G999G999');
      end if;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (v_uid, -v_cost, 'Défi du Dragon : options de l''arène', v_uid);
    end if;
    v_params := v_params || jsonb_build_object('players', v_players, 'cost', v_cost);
  end if;

  v_ends := now() + make_interval(mins => (v_spec->>'minutes')::int);
  insert into public.troll_actions (power, title_id, level, actor_id, target_id, params, ends_at)
  values (p_power, v_title.id, v_title.level, v_uid, p_target, v_params, v_ends)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'ends_at', v_ends, 'cost', v_cost);
end;
$$;

-- ---------------------------------------------------------
-- 3) Farces en cours pour le membre connecté, avec son rôle :
--    target (farce ordinaire), dragon / player / spectator (arène).
-- ---------------------------------------------------------
create or replace function public.my_trolls()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  with me as (
    select auth.uid() as id,
           exists (select 1 from public.troll_shields s where s.user_id = auth.uid()) as shielded
  ),
  rows as (
    select a.*, case
        when a.power = 'defi_dragon' and a.actor_id = me.id then 'dragon'
        when a.power = 'defi_dragon' and (a.target_id = me.id or coalesce(a.params->'players', '[]'::jsonb) ? me.id::text) then 'player'
        when a.power = 'defi_dragon' and coalesce((a.params->>'spectators')::boolean, false) then 'spectator'
        when a.power <> 'defi_dragon' and (a.target_id = me.id or (a.target_id is null and a.actor_id <> me.id)) then 'target'
      end as role
    from public.troll_actions a, me
    where a.cancelled_at is null and a.ends_at > now() and a.result is null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'power', r.power, 'level', r.level, 'params', r.params, 'role', r.role,
    'actor_id', r.actor_id, 'actor', p.nickname, 'everyone', r.target_id is null,
    'created_at', r.created_at, 'ends_at', r.ends_at,
    'players', case when r.power = 'defi_dragon' then (
      select coalesce(jsonb_agg(jsonb_build_object('id', pp.id, 'name', pp.nickname)), '[]'::jsonb)
      from public.profiles pp where coalesce(r.params->'players', '[]'::jsonb) ? pp.id::text) end
  ) order by r.created_at), '[]'::jsonb)
  from rows r
  join public.profiles p on p.id = r.actor_id
  cross join me
  where r.role is not null
    and public._trolls_enabled()
    and (r.role = 'dragon' or not me.shielded)
    and (r.role = 'dragon' or not exists (select 1 from public.troll_responses x where x.troll_id = r.id and x.user_id = me.id));
$$;

-- Réponse d'un participant (fuite avant l'arène, tribune quittée…).
create or replace function public.answer_troll(p_id bigint, p_result text, p_details jsonb default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_a public.troll_actions;
  v_me text;
  v_uid uuid := auth.uid();
  v_ok boolean;
begin
  select * into v_a from public.troll_actions where id = p_id;
  v_ok := v_a.id is not null and (
    v_a.target_id = v_uid
    or (v_a.target_id is null and v_a.actor_id <> v_uid)
    or (v_a.power = 'defi_dragon' and (coalesce(v_a.params->'players', '[]'::jsonb) ? v_uid::text
                                      or (coalesce((v_a.params->>'spectators')::boolean, false) and v_a.actor_id <> v_uid))));
  if not v_ok then
    raise exception 'Farce introuvable.';
  end if;
  if p_result not in ('victoire', 'defaite', 'fuite', 'fini', 'tribune') then
    raise exception 'Résultat inconnu.';
  end if;
  insert into public.troll_responses (troll_id, user_id, result, details)
  values (p_id, v_uid, p_result, p_details)
  on conflict (troll_id, user_id) do nothing;
  if not found then
    return;
  end if;

  if v_a.power = 'defi_dragon' and p_result = 'fuite' then
    select nickname into v_me from public.profiles where id = v_uid;
    insert into public.notifications (user_id, type, title, body, link)
    values (v_a.actor_id, 'troll', '🏃 ' || v_me || ' a fui devant ton dragon', 'Il n''a même pas osé entrer dans l''arène.', '/dashboard/titles');
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 4) Fin de la bataille (envoyée par le dragon, ou par un joueur si le
--    dragon a disparu). Le premier résultat compte.
-- ---------------------------------------------------------
create or replace function public.arena_finish(p_id bigint, p_winner text, p_victim uuid default null, p_details jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_a public.troll_actions;
  v_is_player boolean;
  v_pid text;
  v_actor text;
  v_victim text;
  v_cost numeric;
  v_result jsonb;
begin
  select * into v_a from public.troll_actions where id = p_id for update;
  if v_a.id is null or v_a.power <> 'defi_dragon' then
    raise exception 'Bataille introuvable.';
  end if;
  v_is_player := coalesce(v_a.params->'players', '[]'::jsonb) ? v_uid::text;
  if v_uid <> v_a.actor_id and not v_is_player then
    raise exception 'Permission refusée.';
  end if;
  if v_a.result is not null then
    return v_a.result;
  end if;
  if p_winner not in ('dragon', 'joueurs', 'annule') then
    raise exception 'Résultat inconnu.';
  end if;
  if p_winner = 'annule' and v_uid <> v_a.actor_id then
    raise exception 'Seul le dragon peut annuler.';
  end if;

  select nickname into v_actor from public.profiles where id = v_a.actor_id;
  select nickname into v_victim from public.profiles where id = p_victim;
  v_result := jsonb_build_object('winner', p_winner, 'victim', p_victim, 'victim_name', v_victim, 'by', v_uid, 'at', now())
              || case when jsonb_typeof(p_details) = 'object' then p_details - 'winner' - 'by' - 'at' else '{}'::jsonb end;
  update public.troll_actions set result = v_result, ends_at = least(ends_at, now()) where id = p_id;

  if p_winner = 'annule' then
    -- Remboursement seulement pendant l'attente des joueurs.
    v_cost := coalesce((v_a.params->>'cost')::numeric, 0);
    if v_cost > 0 and now() - v_a.created_at < interval '4 minutes' then
      update public.wallets set balance = balance + v_cost where user_id = v_a.actor_id;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (v_a.actor_id, v_cost, 'Défi du Dragon annulé : options remboursées', v_uid);
    end if;
    return v_result;
  end if;

  for v_pid in select value #>> '{}' from jsonb_array_elements(coalesce(v_a.params->'players', '[]'::jsonb)) loop
    insert into public.troll_responses (troll_id, user_id, result)
    values (p_id, v_pid::uuid, case when p_winner = 'joueurs' then 'victoire' else 'defaite' end)
    on conflict (troll_id, user_id) do nothing;
    insert into public.notifications (user_id, type, title, body, link)
    values (v_pid::uuid, 'troll',
      case when p_winner = 'joueurs' then '🗡 Le dragon ' || coalesce(v_actor, '?') || ' est terrassé'
           else '🔥 Le dragon ' || coalesce(v_actor, '?') || ' a gagné' end,
      case when p_winner = 'joueurs' then 'Victoire dans l''arène !'
           when v_victim is not null then v_victim || ' a fini ' || case when v_a.params->>'finale' = 'devorer' then 'dévoré.' else 'carbonisé.' end
           else 'L''arène est en cendres.' end,
      '/dashboard/titles');
  end loop;
  insert into public.notifications (user_id, type, title, body, link)
  values (v_a.actor_id, 'troll',
    case when p_winner = 'dragon' then '🐉 Ton dragon règne sur l''arène' else '🗡 Ton dragon est tombé' end,
    case when p_winner = 'dragon' then 'Les joueurs n''ont pas tenu.' else 'Les joueurs t''ont terrassé. Revanche dans 2 heures ?' end,
    '/dashboard/titles');
  return v_result;
end;
$$;

-- ---------------------------------------------------------
-- 5) Flatterie : phrase, couleur et fréquence choisies.
-- ---------------------------------------------------------
create or replace function public.trg_troll_flatterie()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_a record;
begin
  begin
    select a.params, p.nickname into v_a
    from public.troll_actions a join public.profiles p on p.id = a.actor_id
    where a.target_id = new.sender_id and a.power = 'flatterie' and a.cancelled_at is null and a.ends_at > now()
    order by a.created_at desc limit 1;
    if v_a.nickname is not null and public._trolls_enabled()
       and random() < 1.0 / greatest(coalesce((v_a.params->>'every')::int, 1), 1) then
      new.troll_tag := jsonb_build_object('kind', 'flatterie', 'by', v_a.nickname,
        'phrase', coalesce(v_a.params->>'phrase', 'est le meilleur !'),
        'color', coalesce(v_a.params->>'color', '#B23B2E'));
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

-- ---------------------------------------------------------
-- 6) Statut : solde (pour le coût des options du dragon).
-- ---------------------------------------------------------
create or replace function public.troll_status()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_title record;
  v_last_one timestamptz;
  v_last_all timestamptz;
  v_spec jsonb;
  v_spec_all jsonb;
begin
  select t.id, t.name, t.power, coalesce(ut.level, 1) as level into v_title
  from public.profiles p
  join public.titles t on t.id = p.equipped_title
  left join public.user_titles ut on ut.user_id = p.id and ut.title_id = t.id
  where p.id = v_uid;

  if v_title.id is not null then
    select max(created_at) into v_last_one from public.troll_actions
      where actor_id = v_uid and power = v_title.power and target_id is not null;
    select max(created_at) into v_last_all from public.troll_actions
      where actor_id = v_uid and power = v_title.power and target_id is null;
    v_spec := public._troll_spec(v_title.power, v_title.level, false);
    v_spec_all := public._troll_spec(v_title.power, v_title.level, true);
  end if;

  return jsonb_build_object(
    'enabled', public._trolls_enabled(),
    'shielded', exists (select 1 from public.troll_shields where user_id = v_uid),
    'balance', coalesce((select balance from public.wallets where user_id = v_uid), 0),
    'arena', jsonb_build_object(
      'max_extra', greatest(0, least(20, public.get_config_numeric('arena_max_extra', 5)::int)),
      'price_player', public.get_config_numeric('arena_price_player', 1000000),
      'price_tribune', public.get_config_numeric('arena_price_tribune', 5000000),
      'price_finale', public.get_config_numeric('arena_price_finale', 5000000)),
    'title', v_title.id,
    'power', v_title.power,
    'level', v_title.level,
    'minutes', v_spec->'minutes',
    'everyone_allowed', coalesce((v_spec->>'everyone_allowed')::boolean, false),
    'ready_at', case when v_last_one is not null then v_last_one + make_interval(mins => (v_spec->>'cooldown')::int) end,
    'ready_all_at', case when v_last_all is not null then v_last_all + make_interval(mins => (v_spec_all->>'cooldown')::int) end,
    'recent', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object(
          'id', a.id, 'power', a.power, 'created_at', a.created_at, 'ends_at', a.ends_at,
          'cancelled', a.cancelled_at is not null, 'result', a.result,
          'target', coalesce((select nickname from public.profiles where id = a.target_id), case when a.target_id is null then 'Tout le S.I.D.' end),
          'responses', (select coalesce(jsonb_agg(jsonb_build_object('who', pr.nickname, 'result', r.result) order by r.created_at), '[]'::jsonb)
                        from public.troll_responses r join public.profiles pr on pr.id = r.user_id where r.troll_id = a.id)
        ) as x
        from public.troll_actions a
        where a.actor_id = v_uid and a.created_at > now() - interval '3 days'
        order by a.created_at desc
        limit 15
      ) s), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public._troll_params(text, int, jsonb) from public, anon, authenticated;
