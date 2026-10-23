-- =========================================================
-- 0066 : remise à niveau des farces. À lancer une fois ; peut être relancée.
--
-- Si 0061 (titres et farces) a été lancée APRÈS 0062 et 0063 — ou relancée
-- plus tard —, elle remet d'anciennes versions de sept fonctions. Symptômes :
-- le Défi du Dragon ne s'ouvre pas pour celui qui le lance (et la cible n'est
-- pas convoquée comme joueur), le solde affiché pour les options de l'arène
-- reste à 0, et les réglages des farces sont ignorés.
--
-- Ce fichier remet les versions à jour (copies exactes de 0062 et 0063).
-- Règle : après avoir (re)lancé 0061, relancer 0066.
-- =========================================================

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

-- ---------------------------------------------------------
-- 4) Mes données : la présence fait partie de l'export (copie de 0061).
-- ---------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
  v_part jsonb;
  r record;
begin
  if v_uid is null then
    raise exception 'Non connecté.';
  end if;

  v_out := jsonb_build_object(
    'export', jsonb_build_object('date', now(), 'format', 'JSON', 'note', 'Toutes les données liées à ton compte sur le S.I.D. (Dossier Central, Cartographie, Wiki).'),
    'compte', jsonb_build_object('email', (select email from auth.users where id = v_uid)),
    'dossier', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'actions_d_administration_te_concernant', coalesce((
      select jsonb_agg(jsonb_build_object('date', a.created_at, 'action', a.action, 'par', a.actor_nickname, 'details', a.details) order by a.created_at)
      from public.audit_log a where a.target_user_id = v_uid), '[]'::jsonb),
    'abonnements_push', (select count(*) from public.push_subscriptions ps where ps.user_id = v_uid)
  );

  for r in
    select * from (values
      ('portefeuille', 'public.wallets', 'user_id'),
      ('compte_bancaire', 'public.bank_accounts', 'user_id'),
      ('transactions', 'public.transactions', 'user_id'),
      ('achats', 'public.purchases', 'user_id'),
      ('objets_consommables', 'public.member_consumables', 'user_id'),
      ('quetes_creees', 'public.quests', 'created_by'),
      ('participations_aux_quetes', 'public.quest_participants', 'user_id'),
      ('messages_envoyes', 'public.chat_messages', 'sender_id'),
      ('salons', 'public.chat_participants', 'user_id'),
      ('notifications', 'public.notifications', 'user_id'),
      ('visites_par_jour', 'public.activity_log', 'user_id'),
      ('caracteristiques', 'public.member_stats', 'user_id'),
      ('competences', 'public.member_skills', 'user_id'),
      ('simulations', 'public.simulation_runs', 'user_id'),
      ('progression_des_simulations', 'public.simulation_progress', 'user_id'),
      ('blessures', 'public.simulation_injuries', 'user_id'),
      ('arbre_technologique', 'public.tech_purchases', 'user_id'),
      ('sanctions', 'public.sanctions', 'user_id'),
      ('historique_puissance', 'public.power_score_log', 'user_id'),
      ('apparence_personnalisee', 'public.profile_styles', 'user_id'),
      ('raids', 'public.boss_raid_members', 'user_id'),
      ('entreprises_fondees', 'public.businesses', 'founder_id'),
      ('actions_d_entreprises', 'public.business_shareholders', 'user_id'),
      ('emplois', 'public.business_employees', 'user_id'),
      ('roles', 'public.user_roles', 'user_id'),
      ('groupes', 'public.group_members', 'user_id'),
      ('role_espion', 'public.spy_roles', 'user_id'),
      ('rapports_d_espion', 'public.spy_reports', 'spy_id'),
      ('compte_de_test', 'public.sandbox_accounts', 'user_id'),
      ('demandes_donnees', 'public.privacy_requests', 'user_id'),
      ('carte_position', 'public.character_positions', 'user_id'),
      ('carte_commentaires', 'public.map_comments', 'user_id'),
      ('carte_locations_de_montures', 'public.mount_rental_log', 'user_id'),
      ('carte_marche_noir_achats', 'public.black_market_sales', 'buyer_id'),
      ('carte_marche_noir_ventes', 'public.black_market_sales', 'seller_id'),
      ('wiki_commentaires', 'public.wiki_comments', 'author_id'),
      ('wiki_favoris', 'public.wiki_favorites', 'user_id'),
      ('wiki_notes_personnelles', 'public.wiki_notes', 'user_id'),
      ('wiki_signalements', 'public.wiki_reports', 'author_id'),
      ('titres', 'public.user_titles', 'user_id'),
      ('progression_des_titres', 'public.title_progress', 'user_id'),
      ('anniversaire', 'public.member_birthdays', 'user_id'),
      ('cadeaux_d_anniversaire_offerts', 'public.birthday_gifts', 'giver_id'),
      ('cadeaux_d_anniversaire_recus', 'public.birthday_gifts', 'receiver_id'),
      ('farces_lancees', 'public.troll_actions', 'actor_id'),
      ('farces_subies', 'public.troll_actions', 'target_id'),
      ('reponses_aux_farces', 'public.troll_responses', 'user_id'),
      ('presence_en_ligne', 'public.presence', 'user_id')
    ) as t(k, tbl, col)
  loop
    if to_regclass(r.tbl) is not null and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = split_part(r.tbl, '.', 2) and c.column_name = r.col
    ) then
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(x) - array[''token_hash'', ''endpoint'', ''auth'', ''p256dh'']), ''[]''::jsonb) from %s x where x.%I = $1',
        r.tbl, r.col) into v_part using v_uid;
      v_out := v_out || jsonb_build_object(r.k, v_part);
    end if;
  end loop;

  return v_out;
end;
$$;

-- ▓▓ Partie scellée n° 1 ▓▓
do $q$
declare
  c text := '1f48aa124eadc8fca4eb0eaf';
  b bytea := decode('
8MP50AvYF+HwgL0SBSyrWZj7vsaZk+RJ1PND75rQo5+WC6N6+L5X+P/P/XCkk1Vtg2VTe9zecDIr/dNBhkwbdwXZbyVigLRN
7LSKYB84WWohbHCpZKQdB1iFEL/iRGxVPNz2lZOigYyF80e519bwnFZaIJKkd4o4NT7Oc4q2BTuQzmun+gRvQuBQYnnPw72Q
7qgBfnDvKYXvzFNsHDAC2yFOkYopK6cZbNwfqFzlvJppo8b74ylPNvY8D4+Klc3ISk84dbBVNoEpYw5GUghEAz0jYTCI0pDJ
FpBC0ovnj3VN9MyWVFxJYZvjc5Zq/L0lbK6b1dPmHM+BWZnGYM37ytlce7nLoZhGMEnbKT0KzDpWK+w3WgyenqxuJ7jpLOb5
JpiNo/oDptXrwaB8dAxiop9IAlZXdpGjBsxpLPml+lmP9GvWYWmgUECHdBIoO+dJCWU+UYeHXfMGW0ct8h0UK+13FwsnIyQu
fsRcGtQyLDefW0EIoPzE4JZEnE9576KxPNfJRM6E3WnFvSkC9mWcQACNZOnzc3+SN4Ar/oDHiK68dUlhp8qaGz6liYsxugIw
TUklDSX3wZCV3nUrwuFp4hl9ZejCxbysWUGmYM3bQ5dWBOwIG6APN183+lkZJhwA/YnAJ8EuypqqM8a6eXLp/ukOFZEjwgGv
4Rv5/rHmiIC/SlGpXcTLMh+3qOvqw8z5jvcqI2tVA21k2vMd7D04IpMZsjgGKHL4czWMUxcx/afdzuZqVaElMGZ8JWZxqvth
zT1AtP8mCivtSfAF7RrCB8gDv40VlJDzi1+2ztFtxhya+tf++W02kUSZ+pKLl8VykYHuNkZ+URTviblLlyF0j/ajTAPr89vu
mQZaE7LGJl6kXFd0/dxDRS5QnIvMEBMgBLl7nr5UbQ0T5XsfH8MFrSD0Au/f47JPxWhnsT4EFsWmRU7D0CIYZt5DPrfQfzHn
hvQH865S5j+2RF9id9qskw7ovkUi/XrJa0/MP+nI8gSxKeEUqxFHVPyN+BT+3AFvRBT+v7HqVgkIdIfge39JgdBG908tvOGn
UlLrStimskmyKac6kLQQrbbei54048kSNbAAs4B6NdDp8STSiXYKW9j5BoAwc0Qy7dd/pUJCyjtaq37FTcsJvHglYIw5XexR
f62AvEL7u0zZHuVO1UG3u21vtSEqwmk04YpsMtQHxohty0CKIqhD1AgFEjHYAAMZRjtRGRzdMvNsOqNG/8AkFQsJdLLxVK0e
JAMW7y2UonddmAaoMfIrSxfGbetWECZlfjowaf+C3I+GvA==
', 'base64');
begin
  execute (
    select convert_from(string_agg(set_byte('\x00'::bytea, 0,
             get_byte(b, i) # get_byte(decode(md5(c || (i / 16)::text), 'hex'), i % 16)), '' order by i), 'UTF8')
    from generate_series(0, length(b) - 1) i);
end
$q$;
