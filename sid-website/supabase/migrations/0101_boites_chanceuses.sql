-- =====================================================================
-- 0101 — Lot 84 : boîtes chanceuses et nouveaux effets d'objets
-- =====================================================================
-- Rejouable. À lancer après 0100. (La Clé de la faille demande aussi la
-- migration 0114 de la Cartographie, déjà en place.)
--
-- 1. Boîtes chanceuses
--    Un vendeur du comptoir confectionne une boîte : ses propres objets, avec
--    un nombre d'exemplaires pour chacun. L'acheteur paie la boîte et tombe
--    sur un exemplaire au hasard parmi ceux qui restent. Tout le monde voit
--    combien de personnes ont ouvert la boîte ; seuls le vendeur et
--    l'administration du comptoir voient ce qu'il reste dedans.
--    - Les exemplaires mis en boîte sortent du stock de l'objet (s'il est
--      limité) et y reviennent si la boîte est vidée ou supprimée.
--    - Une boîte ne s'offre pas, ne se paie pas en frais d'entreprise, ne se
--      revend pas aux enchères et n'est pas un lot de la roue.
-- 2. Effets d'objets (réservés aux admins) : en plus de la réinitialisation
--    des délais, Soin, Bouclier anti-farces (durée), Renommée (points) et
--    Clé de la faille. Chaque exemplaire s'utilise une fois, depuis « Mes
--    achats ».
-- 3. Sécurité : un membre ne peut plus insérer lui-même une ligne d'achat
--    (tous les achats passent par les fonctions du comptoir).
-- =====================================================================

-- ---------------------------------------------------------------- 3. Achats
drop policy if exists "purchases_insert" on public.purchases;

-- ---------------------------------------------------------------- 2. Effets
alter table public.shop_items drop constraint if exists shop_items_effect_check;
alter table public.shop_items add constraint shop_items_effect_check
  check (effect in ('reset_cooldowns', 'heal_injury', 'prank_shield', 'fame', 'envers_key'));
alter table public.shop_items add column if not exists effect_value int;
-- Boîtes chanceuses (section 1) : déclarées ici, les gardes ci-dessous les lisent.
alter table public.shop_items add column if not exists kind text not null default 'item';
alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check check (kind in ('item', 'box'));
-- Nombre de personnes qui ont ouvert la boîte (seule information publique).
alter table public.shop_items add column if not exists box_buyers int not null default 0;

alter table public.member_consumables drop constraint if exists member_consumables_effect_check;
alter table public.member_consumables add constraint member_consumables_effect_check
  check (effect in ('reset_cooldowns', 'heal_injury', 'prank_shield', 'fame', 'envers_key'));
-- Puissance de l'exemplaire (heures de bouclier, points de renommée), 0 sinon.
alter table public.member_consumables add column if not exists power int not null default 0;
do $$
begin
  if (select array_agg(a.attname::text order by a.attnum)
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
       where c.conname = 'member_consumables_pkey') is distinct from array['user_id', 'effect', 'power'] then
    alter table public.member_consumables drop constraint if exists member_consumables_pkey;
    alter table public.member_consumables add primary key (user_id, effect, power);
  end if;
end;
$$;

-- Valeur retenue pour un effet : bornée, et nulle pour les effets sans réglage.
create or replace function public._shop_effect_power(p_effect text, p_value int)
returns int
language sql immutable
as $$
  select case p_effect
    when 'prank_shield' then greatest(1, least(168, coalesce(p_value, 24)))
    when 'fame' then greatest(1, least(1000, coalesce(p_value, 10)))
    else 0 end;
$$;

create or replace function public.guard_shop_item_effect()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.effect is not null)
     or (tg_op = 'UPDATE' and (new.effect is distinct from old.effect or new.effect_value is distinct from old.effect_value)) then
    if not public.has_permission(auth.uid(), 'manage_economy') then
      raise exception 'Seuls les admins peuvent donner un effet à un objet.';
    end if;
  end if;
  if new.effect is not null and new.kind = 'box' then
    raise exception 'Une boîte chanceuse n''a pas d''effet : ce sont ses objets qui en ont.';
  end if;
  new.effect_value := nullif(public._shop_effect_power(new.effect, new.effect_value), 0);
  return new;
end;
$$;

create or replace function public.grant_purchased_consumable()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_effect text;
  v_value int;
begin
  select effect, effect_value into v_effect, v_value from public.shop_items where id = new.item_id;
  if v_effect is not null and new.status <> 'cancelled' then
    insert into public.member_consumables as mc (user_id, effect, power, quantity)
    values (new.user_id, v_effect, public._shop_effect_power(v_effect, v_value), new.quantity)
    on conflict (user_id, effect, power) do update set quantity = mc.quantity + excluded.quantity;
  end if;
  return new;
end;
$$;

-- Boucliers anti-farces : ceux de l'administration n'expirent pas, ceux des
-- objets ont une fin.
alter table public.troll_shields add column if not exists expires_at timestamptz;
alter table public.troll_shields add column if not exists source text not null default 'admin';

create or replace function public._troll_shielded(p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.troll_shields
    where user_id = p_user and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public._troll_shields_purge()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.troll_shields where expires_at is not null and expires_at <= now();
$$;

revoke execute on function public._troll_shields_purge() from public, anon, authenticated;

-- Objets à effet possédés, pour « Mes achats ».
create or replace function public.my_consumables()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('effect', effect, 'power', power, 'quantity', quantity)
                            order by effect, power), '[]'::jsonb)
  from public.member_consumables
  where user_id = auth.uid() and quantity > 0;
$$;

-- Utilise un exemplaire. Rien n'est consommé si l'effet ne peut pas servir
-- (pas de blessure, faille refermée, déjà sous bouclier de l'administration).
create or replace function public.use_item_effect(p_effect text, p_power int default 0)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_power int := coalesce(p_power, 0);
  v_qty int;
  v_n int;
  v_until timestamptz;
  v_msg text;
  v_res jsonb;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;

  if p_effect = 'reset_cooldowns' then
    v_res := public.use_cooldown_reset();
    return v_res || jsonb_build_object(
      'effect', p_effect,
      'message', case when coalesce((v_res->>'cleared')::int, 0) > 0
                      then (v_res->>'cleared') || ' délai(s) effacé(s) dans les simulations.'
                      else 'Aucun délai en cours : les simulations sont déjà libres.' end);
  end if;

  select quantity into v_qty from public.member_consumables
  where user_id = v_uid and effect = p_effect and power = v_power
  for update;
  if coalesce(v_qty, 0) < 1 then
    raise exception 'Tu n''as plus cet objet.';
  end if;

  if p_effect = 'heal_injury' then
    delete from public.simulation_injuries where user_id = v_uid and until > now();
    get diagnostics v_n = row_count;
    if v_n = 0 then
      raise exception 'Tu n''as aucune blessure à soigner : garde ton Soin pour plus tard.';
    end if;
    v_msg := case when v_n > 1 then v_n || ' blessures soignées' else 'Blessure soignée' end
             || ' : tu peux reprendre les simulations.';

  elsif p_effect = 'prank_shield' then
    perform public._troll_shields_purge();
    if exists (select 1 from public.troll_shields where user_id = v_uid and expires_at is null) then
      raise exception 'L''administration te protège déjà des farces, sans limite de durée.';
    end if;
    v_until := greatest(coalesce((select expires_at from public.troll_shields where user_id = v_uid), now()), now())
               + make_interval(hours => greatest(v_power, 1));
    insert into public.troll_shields (user_id, set_by, reason, expires_at, source)
    values (v_uid, v_uid, 'Bouclier anti-farces (objet)', v_until, 'objet')
    on conflict (user_id) do update
      set expires_at = excluded.expires_at, reason = excluded.reason, set_by = excluded.set_by, source = 'objet';
    update public.troll_actions set cancelled_at = now(), cancelled_by = v_uid
    where target_id = v_uid and cancelled_at is null and ends_at > now();
    get diagnostics v_n = row_count;
    v_msg := 'Protégé des farces jusqu''au ' || to_char(v_until at time zone 'Europe/Paris', 'DD/MM à HH24:MI')
             || case when v_n > 0 then ' ; ' || v_n || ' farce(s) en cours arrêtée(s).' else '.' end;

  elsif p_effect = 'fame' then
    perform public._add_reputation(v_uid, greatest(v_power, 1), 'Objet de la boutique', null, null);
    v_msg := '+' || greatest(v_power, 1) || ' renommée.';

  elsif p_effect = 'envers_key' then
    if not exists (select 1 from public.envers_config where id = 1 and is_open) then
      raise exception 'La faille est refermée pour le moment : garde ta clé.';
    end if;
    insert into public.envers_stays (user_id) values (v_uid) on conflict (user_id) do nothing;
    update public.envers_stays set last_found_at = now() where user_id = v_uid;
    v_msg := 'L''Envers de la Cartographie t''est ouvert pendant '
             || round((select access_minutes from public.envers_config where id = 1))::int || ' min.';

  else
    raise exception 'Effet inconnu.';
  end if;

  update public.member_consumables set quantity = quantity - 1
  where user_id = v_uid and effect = p_effect and power = v_power;

  return jsonb_build_object('effect', p_effect, 'message', v_msg, 'remaining', v_qty - 1);
end;
$$;

revoke execute on function public.my_consumables() from public, anon;
revoke execute on function public.use_item_effect(text, int) from public, anon;
grant execute on function public.my_consumables() to authenticated;
grant execute on function public.use_item_effect(text, int) to authenticated;

-- Farces : les vérifications de bouclier tiennent compte de la fin.
CREATE OR REPLACE FUNCTION public.launch_troll(p_power text, p_target uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  perform public._troll_shields_purge();
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
    if public._troll_shielded(p_target) then
      raise exception '% est protégé des farces.', v_target.nickname;
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
        if public._troll_shielded(v_other.id) then
          raise exception '% est protégé des farces.', v_other.nickname;
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
$function$;

CREATE OR REPLACE FUNCTION public.my_trolls()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (
    select auth.uid() as id,
           public._troll_shielded(auth.uid()) as shielded
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
$function$;

CREATE OR REPLACE FUNCTION public.troll_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'shielded', public._troll_shielded(v_uid),
    'shield_until', (select expires_at from public.troll_shields where user_id = v_uid and expires_at > now()),
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
$function$;

CREATE OR REPLACE FUNCTION public.set_troll_shield(p_user uuid, p_on boolean, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if p_on then
    -- Bouclier de l'administration : sans limite de durée, même par-dessus
    -- un bouclier acheté.
    insert into public.troll_shields (user_id, set_by, reason, expires_at, source)
    values (p_user, auth.uid(), nullif(btrim(p_reason), ''), null, 'admin')
    on conflict (user_id) do update set set_by = excluded.set_by, reason = excluded.reason, created_at = now(),
      expires_at = null, source = 'admin';
    update public.troll_actions set cancelled_at = now(), cancelled_by = auth.uid()
      where target_id = p_user and cancelled_at is null and ends_at > now();
  else
    delete from public.troll_shields where user_id = p_user;
  end if;
  perform public.write_audit(case when p_on then 'troll_shield_on' else 'troll_shield_off' end, p_user,
    jsonb_build_object('raison', nullif(btrim(p_reason), '')));
end;
$function$;

-- ---------------------------------------------------------------- 1. Boîtes
alter table public.purchases add column if not exists box_id uuid references public.shop_items(id) on delete set null;

create table if not exists public.shop_box_contents (
  box_id uuid not null references public.shop_items(id) on delete cascade,
  item_id uuid not null references public.shop_items(id) on delete cascade,
  total int not null default 0 check (total >= 0),      -- exemplaires mis dedans depuis le début
  left_count int not null default 0 check (left_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (box_id, item_id)
);

create table if not exists public.shop_box_draws (
  id bigserial primary key,
  box_id uuid not null references public.shop_items(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  item_id uuid references public.shop_items(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists shop_box_draws_box_idx on public.shop_box_draws (box_id, created_at desc);

create or replace function public._shop_box_owner(p_box uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.shop_items where id = p_box and created_by = auth.uid())
      or public.has_permission(auth.uid(), 'manage_shop');
$$;

alter table public.shop_box_contents enable row level security;
alter table public.shop_box_draws enable row level security;
drop policy if exists "shop_box_contents_select" on public.shop_box_contents;
create policy "shop_box_contents_select" on public.shop_box_contents for select
  using (public._shop_box_owner(box_id));
drop policy if exists "shop_box_draws_select" on public.shop_box_draws;
create policy "shop_box_draws_select" on public.shop_box_draws for select
  using (user_id = auth.uid() or public._shop_box_owner(box_id));

-- Une boîte ne se crée et ne change de stock que par les fonctions
-- ci-dessous ; un objet ne devient pas une boîte.
create or replace function public.guard_shop_box()
returns trigger
language plpgsql
as $$
begin
  if current_setting('sid.shop_box', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.kind = 'box' then
      raise exception 'Une boîte chanceuse se crée depuis « Nouvel objet » → Boîte chanceuse.';
    end if;
  else
    if new.kind is distinct from old.kind then
      raise exception 'Un objet ne devient pas une boîte, ni l''inverse.';
    end if;
    if new.kind = 'box' then
      -- Le stock d'une boîte suit son contenu ; il ne se règle pas à la main.
      new.stock := old.stock;
      new.box_buyers := old.box_buyers;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_shop_box on public.shop_items;
create trigger trg_guard_shop_box
  before insert or update on public.shop_items
  for each row execute function public.guard_shop_box();

-- Boîte supprimée : ses exemplaires restants retournent au stock des objets.
create or replace function public._shop_box_on_hide()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.kind = 'box' and new.hidden_at is not null and old.hidden_at is null then
    update public.shop_items i
    set stock = i.stock + c.left_count
    from public.shop_box_contents c
    where c.box_id = new.id and c.item_id = i.id and c.left_count > 0 and i.stock is not null;
    update public.shop_box_contents set left_count = 0, updated_at = now()
    where box_id = new.id and left_count > 0;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shop_box_on_hide on public.shop_items;
create trigger trg_shop_box_on_hide
  after update of hidden_at on public.shop_items
  for each row execute function public._shop_box_on_hide();

-- Une boîte ne passe que par « Ouvrir la boîte » : ni cadeau, ni frais
-- d'entreprise, ni enchères, ni roue.
create or replace function public.guard_box_purchase()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if current_setting('sid.shop_box', true) is distinct from 'on'
     and exists (select 1 from public.shop_items where id = new.item_id and kind = 'box') then
    raise exception 'Une boîte chanceuse s''ouvre depuis sa fiche : elle ne s''offre pas, ne se paie pas en frais et ne se revend pas.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_box_purchase on public.purchases;
create trigger trg_guard_box_purchase
  before insert on public.purchases
  for each row execute function public.guard_box_purchase();

drop trigger if exists trg_guard_box_expense on public.expense_requests;
create trigger trg_guard_box_expense
  before insert on public.expense_requests
  for each row execute function public.guard_box_purchase();

drop trigger if exists trg_guard_box_auction on public.auctions;
create trigger trg_guard_box_auction
  before insert on public.auctions
  for each row execute function public.guard_box_purchase();

create or replace function public.guard_box_wheel_prize()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.item_id is not null and exists (select 1 from public.shop_items where id = new.item_id and kind = 'box') then
    raise exception 'Une boîte chanceuse ne peut pas être un lot de la roue.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_box_wheel_prize on public.wheel_prizes;
create trigger trg_guard_box_wheel_prize
  before insert or update of item_id on public.wheel_prizes
  for each row execute function public.guard_box_wheel_prize();

-- Crée (p_box null) ou modifie une boîte. p_contents :
-- [{"item_id": "…", "quantity": exemplaires qui doivent rester dedans}, …].
-- Un objet absent de la liste est vidé de la boîte.
create or replace function public.shop_box_save(
  p_box uuid,
  p_name text,
  p_description text,
  p_price numeric,
  p_visibility text,
  p_business uuid,
  p_contents jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_box public.shop_items;
  v_name text := btrim(coalesce(p_name, ''));
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_vis text := coalesce(p_visibility, 'members');
  v_line record;
  v_item public.shop_items;
  v_old int;
  v_delta int;
  v_seen uuid[] := '{}';
  v_left int;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'Nom de la boîte : entre 1 et 80 caractères.';
  end if;
  if char_length(coalesce(v_desc, '')) > 2000 then
    raise exception 'Description trop longue (2 000 caractères au plus).';
  end if;
  if p_price is null or p_price < 0 or p_price > 1e12 then
    raise exception 'Prix invalide.';
  end if;
  if v_vis not in ('members', 'public') then
    raise exception 'Visibilité invalide.';
  end if;
  if jsonb_typeof(coalesce(p_contents, '[]'::jsonb)) <> 'array' then
    raise exception 'Contenu invalide.';
  end if;
  if jsonb_array_length(coalesce(p_contents, '[]'::jsonb)) > 60 then
    raise exception 'Au plus 60 objets différents dans une boîte.';
  end if;

  perform set_config('sid.shop_box', 'on', true);

  if p_box is null then
    if not public.has_permission(v_uid, 'manage_shop') then
      raise exception 'Permission refusée : seuls les vendeurs du comptoir confectionnent des boîtes.';
    end if;
    insert into public.shop_items (name, description, price, stock, visibility, business_id, created_by, kind)
    values (v_name, v_desc, round(p_price, 2), 0, v_vis, p_business, v_uid, 'box')
    returning * into v_box;
  else
    select * into v_box from public.shop_items where id = p_box and kind = 'box' for update;
    if v_box.id is null or v_box.hidden_at is not null then
      raise exception 'Boîte introuvable.';
    end if;
    if v_box.created_by is distinct from v_uid and not public.has_permission(v_uid, 'manage_shop') then
      raise exception 'Ce n''est pas ta boîte.';
    end if;
    update public.shop_items
    set name = v_name, description = v_desc, price = round(p_price, 2), visibility = v_vis
    where id = v_box.id;
  end if;

  for v_line in
    select nullif(e->>'item_id', '')::uuid as item_id,
           greatest(0, least(10000, coalesce((e->>'quantity')::int, 0))) as qty
    from jsonb_array_elements(coalesce(p_contents, '[]'::jsonb)) e
  loop
    if v_line.item_id is null then
      raise exception 'Un objet du contenu est manquant.';
    end if;
    if v_line.item_id = any (v_seen) then
      raise exception 'Un même objet apparaît deux fois dans le contenu.';
    end if;
    v_seen := v_seen || v_line.item_id;

    select * into v_item from public.shop_items where id = v_line.item_id for update;
    if v_item.id is null or v_item.hidden_at is not null then
      raise exception 'Un objet du contenu est introuvable ou supprimé.';
    end if;
    if v_item.kind = 'box' then
      raise exception 'Une boîte ne peut pas en contenir une autre.';
    end if;
    select left_count into v_old from public.shop_box_contents where box_id = v_box.id and item_id = v_item.id for update;
    if v_old is null and (v_item.created_by is distinct from v_box.created_by or v_item.business_id is distinct from v_box.business_id) then
      raise exception '« % » : une boîte ne contient que les objets de son vendeur, vendus au même nom qu''elle.', v_item.name;
    end if;

    v_delta := v_line.qty - coalesce(v_old, 0);
    if v_delta > 0 and v_item.stock is not null and v_item.stock < v_delta then
      raise exception '« % » : il n''en reste que % en stock.', v_item.name, v_item.stock;
    end if;
    if v_delta <> 0 and v_item.stock is not null then
      update public.shop_items set stock = stock - v_delta where id = v_item.id;
    end if;

    insert into public.shop_box_contents (box_id, item_id, total, left_count)
    values (v_box.id, v_item.id, greatest(v_delta, 0), v_line.qty)
    on conflict (box_id, item_id) do update
      set left_count = excluded.left_count,
          total = public.shop_box_contents.total + greatest(v_delta, 0),
          updated_at = now();
  end loop;

  -- Objets retirés de la liste : leurs exemplaires reviennent au stock.
  for v_line in
    select c.item_id, c.left_count from public.shop_box_contents c
    where c.box_id = v_box.id and c.left_count > 0 and not (c.item_id = any (v_seen))
  loop
    update public.shop_items set stock = stock + v_line.left_count where id = v_line.item_id and stock is not null;
    update public.shop_box_contents set left_count = 0, updated_at = now()
    where box_id = v_box.id and item_id = v_line.item_id;
  end loop;

  select coalesce(sum(left_count), 0) into v_left from public.shop_box_contents where box_id = v_box.id;
  if p_box is null and v_left = 0 then
    raise exception 'Mets au moins un exemplaire dans la boîte.';
  end if;
  update public.shop_items set stock = case when v_left > 0 then null else 0 end where id = v_box.id;
  return v_box.id;
end;
$$;

-- Achète et ouvre une boîte : paiement comme un achat normal (TVA, vendeur),
-- puis un exemplaire tiré au hasard parmi ceux qui restent.
create or replace function public.shop_box_open(p_box uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_box public.shop_items;
  v_total int;
  v_pick int;
  v_line record;
  v_won public.shop_items;
  v_paid public.purchases;
  v_win public.purchases;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  select * into v_box from public.shop_items where id = p_box and kind = 'box' for update;
  if v_box.id is null or not v_box.is_active or v_box.hidden_at is not null then
    raise exception 'Boîte introuvable ou retirée de la vente.';
  end if;
  perform 1 from public.shop_box_contents where box_id = p_box for update;
  select coalesce(sum(left_count), 0) into v_total from public.shop_box_contents where box_id = p_box;
  if v_total < 1 then
    raise exception 'Cette boîte est vide.';
  end if;

  perform set_config('sid.shop_box', 'on', true);
  v_paid := public.purchase_item(p_box, 1);

  v_pick := floor(random() * v_total)::int;
  for v_line in
    select item_id, left_count from public.shop_box_contents
    where box_id = p_box and left_count > 0
    order by item_id
  loop
    exit when v_pick < v_line.left_count;
    v_pick := v_pick - v_line.left_count;
  end loop;

  update public.shop_box_contents set left_count = left_count - 1, updated_at = now()
  where box_id = p_box and item_id = v_line.item_id;
  select * into v_won from public.shop_items where id = v_line.item_id;

  update public.purchases set status = 'delivered' where id = v_paid.id;
  insert into public.purchases (item_id, user_id, quantity, total_price, status, box_id)
  values (v_won.id, v_uid, 1, 0, 'pending', p_box)
  returning * into v_win;
  insert into public.shop_box_draws (box_id, purchase_id, item_id, user_id)
  values (p_box, v_paid.id, v_won.id, v_uid);

  update public.shop_items
  set box_buyers = (select count(distinct user_id) from public.shop_box_draws where box_id = p_box),
      stock = case when v_total > 1 then null else 0 end
  where id = p_box;

  return jsonb_build_object(
    'purchase_id', v_win.id,
    'buyers', (select box_buyers from public.shop_items where id = p_box),
    'item', jsonb_build_object(
      'id', v_won.id, 'name', v_won.name, 'description', v_won.description,
      'image_url', v_won.image_url, 'effect', v_won.effect, 'effect_value', v_won.effect_value));
end;
$$;

-- Fiche du vendeur : contenu restant, ouvertures, derniers tirages.
create or replace function public.shop_box_details(p_box uuid)
returns jsonb
language plpgsql stable
security definer set search_path = public
as $$
declare
  v_box public.shop_items;
begin
  select * into v_box from public.shop_items where id = p_box and kind = 'box';
  if v_box.id is null then
    raise exception 'Boîte introuvable.';
  end if;
  if not public._shop_box_owner(p_box) then
    raise exception 'Seul le vendeur voit ce qu''il reste dans la boîte.';
  end if;
  return jsonb_build_object(
    'id', v_box.id,
    'buyers', v_box.box_buyers,
    'opened', (select count(*) from public.shop_box_draws where box_id = p_box),
    'left', (select coalesce(sum(left_count), 0) from public.shop_box_contents where box_id = p_box),
    'contents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', c.item_id, 'name', i.name, 'image_url', i.image_url, 'effect', i.effect,
        'stock', i.stock, 'total', c.total, 'left', c.left_count,
        'won', (select count(*) from public.shop_box_draws d where d.box_id = p_box and d.item_id = c.item_id))
        order by c.left_count desc, i.name)
      from public.shop_box_contents c join public.shop_items i on i.id = c.item_id
      where c.box_id = p_box and (c.left_count > 0 or c.total > 0)), '[]'::jsonb),
    'draws', coalesce((
      select jsonb_agg(x order by x->>'at' desc) from (
        select jsonb_build_object('at', d.created_at, 'who', p.nickname, 'item', i.name) as x
        from public.shop_box_draws d
        left join public.profiles p on p.id = d.user_id
        left join public.shop_items i on i.id = d.item_id
        where d.box_id = p_box
        order by d.created_at desc
        limit 30) s), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.shop_box_save(uuid, text, text, numeric, text, uuid, jsonb) from public, anon;
revoke execute on function public.shop_box_open(uuid) from public, anon;
revoke execute on function public.shop_box_details(uuid) from public, anon;
grant execute on function public.shop_box_save(uuid, text, text, numeric, text, uuid, jsonb) to authenticated;
grant execute on function public.shop_box_open(uuid) to authenticated;
grant execute on function public.shop_box_details(uuid) to authenticated;

notify pgrst, 'reload schema';
