-- =========================================================
-- Lot 28
--  1) Donjons niveau 50+ : « perte temporaire d'un membre » (accès à la
--     simulation fermé pendant un moment).
--  2) Arbre technologique : les points gagnés dans les simulations
--     s'échangent contre des améliorations (primes de quête, salaires,
--     intérêts, impôts, TVA, rang).
--  3) Les effets d'objets du comptoir sont réservés aux admins
--     (permission manage_economy).
--
-- Prérequis : migration 0053.
-- =========================================================

do $$
begin
  if to_regclass('public.boss_raids') is null then
    raise exception 'Applique d''abord la migration 0053_boss_raids.sql.';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 1) Blessures
-- ---------------------------------------------------------
insert into public.app_config (key, value) values ('simulation_injury_minutes', '60')
on conflict (key) do nothing;

create table public.simulation_injuries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('donjons', 'intelligence', 'techniques')),
  until timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.simulation_injuries enable row level security;
create policy "simulation_injuries_select" on public.simulation_injuries for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));

-- Appelée par la page du S.I.D. quand le jeu signale la perte d'un membre.
-- On ne peut se blesser que soi-même, et seulement à partir du niveau 50.
create or replace function public.injure_member(p_kind text)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_until timestamptz;
begin
  if v_uid is null then
    raise exception 'Non connecté';
  end if;
  if p_kind <> 'donjons' then
    raise exception 'Simulation inconnue';
  end if;
  if coalesce((select strength from public.member_stats where user_id = v_uid), 0) < 50 then
    raise exception 'Les blessures n''existent qu''à partir du niveau 50.';
  end if;
  v_until := now() + (public.get_config_numeric('simulation_injury_minutes', 60) || ' minutes')::interval;
  insert into public.simulation_injuries as si (user_id, kind, until) values (v_uid, p_kind, v_until)
  on conflict (user_id, kind) do update set until = greatest(si.until, excluded.until), created_at = now()
  returning until into v_until;
  -- La partie en cours s'arrête là.
  update public.simulation_runs set status = 'abandoned', finished_at = now()
    where user_id = v_uid and kind = p_kind and status = 'started';
  return v_until;
end;
$$;

-- Plus de nouvelle partie tant que la blessure n'est pas guérie.
create or replace function public.block_injured_runs()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_until timestamptz;
begin
  select until into v_until from public.simulation_injuries
    where user_id = new.user_id and kind = new.kind and until > now();
  if v_until is not null then
    raise exception 'Perte temporaire d''un membre : accès à la simulation fermé jusqu''à %.',
      to_char(v_until at time zone public.stats_timezone(), 'HH24:MI');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_injured_runs on public.simulation_runs;
create trigger trg_block_injured_runs
  before insert on public.simulation_runs
  for each row execute function public.block_injured_runs();

-- ---------------------------------------------------------
-- 2) Arbre technologique
-- ---------------------------------------------------------
create table public.tech_nodes (
  key text primary key,
  label text not null,
  description text not null,
  emoji text not null default '⚙️',
  branch text not null,
  max_level int not null check (max_level between 1 and 20),
  cost_base int not null check (cost_base > 0),
  cost_step int not null default 0 check (cost_step >= 0),
  effect_pct numeric not null default 0,
  requires_key text references public.tech_nodes(key),
  requires_level int not null default 0,
  sort int not null default 0
);

alter table public.tech_nodes enable row level security;
create policy "tech_nodes_select" on public.tech_nodes for select using (auth.uid() is not null);

-- coût du niveau N = cost_base + cost_step × (N − 1)
insert into public.tech_nodes (key, label, description, emoji, branch, max_level, cost_base, cost_step, effect_pct, requires_key, requires_level, sort) values
  ('quest_reward', 'Primes de mission',     '+5 % sur chaque récompense de quête par niveau.',          '📜', 'Missions',  5, 10, 10, 5,   null,           0, 1),
  ('tax',          'Optimisation fiscale',  '−8 % sur l''impôt hebdomadaire par niveau.',               '🧾', 'Missions',  5, 15, 15, 8,   'quest_reward', 2, 2),
  ('vat',          'Niche fiscale',         '−10 % de TVA sur tes ventes au comptoir par niveau.',      '🏷️', 'Missions',  5, 15, 15, 10,  'tax',          2, 3),
  ('salary',       'Négociation salariale', '+5 % sur chaque salaire reçu par niveau.',                 '💼', 'Finances',  5, 10, 10, 5,   null,           0, 4),
  ('interest',     'Placements avisés',     '+10 % sur les intérêts de ton épargne par niveau.',        '🏦', 'Finances',  5, 15, 15, 10,  'salary',       2, 5),
  ('rank',         'Promotion',             'Monte d''un rang (E → D → C → B → A → S).',               '🎖️', 'Carrière',  5, 100, 0, 0,   null,           0, 6);

create table public.member_tech (
  user_id uuid not null references public.profiles(id) on delete cascade,
  node text not null references public.tech_nodes(key),
  level int not null default 0 check (level >= 0),
  primary key (user_id, node)
);

create table public.tech_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  node text not null references public.tech_nodes(key),
  level int not null,
  cost int not null,
  created_at timestamptz not null default now()
);

alter table public.member_tech enable row level security;
alter table public.tech_purchases enable row level security;
create policy "member_tech_select" on public.member_tech for select using (auth.uid() is not null);
create policy "tech_purchases_select" on public.tech_purchases for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

-- Points gagnés = total des points de compétence (1 par simulation réussie) ;
-- dépensés = somme des achats de l'arbre.
create or replace function public.tech_points_available(p_user_id uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
  select greatest(0,
    coalesce((select sum(points) from public.member_skills where user_id = p_user_id), 0)::int
    - coalesce((select sum(cost) from public.tech_purchases where user_id = p_user_id), 0)::int);
$$;

create or replace function public.tech_level(p_user_id uuid, p_node text)
returns int
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select level from public.member_tech where user_id = p_user_id and node = p_node), 0);
$$;

-- Bonus d'une amélioration, en fraction (0,15 = 15 %).
create or replace function public.tech_bonus(p_user_id uuid, p_node text)
returns numeric
language sql
stable
security definer set search_path = public
as $$
  select public.tech_level(p_user_id, p_node) * coalesce((select effect_pct from public.tech_nodes where key = p_node), 0) / 100.0;
$$;

create or replace function public.buy_tech(p_node text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_node public.tech_nodes;
  v_level int;
  v_cost int;
  v_avail int;
  v_rank text;
  v_ranks text[] := array['E', 'D', 'C', 'B', 'A', 'S'];
begin
  if v_uid is null then
    raise exception 'Non connecté';
  end if;
  if coalesce((select is_frozen from public.profiles where id = v_uid), false) then
    raise exception 'Compte gelé';
  end if;
  select * into v_node from public.tech_nodes where key = p_node;
  if v_node.key is null then
    raise exception 'Amélioration inconnue';
  end if;

  -- Un achat à la fois par membre.
  perform pg_advisory_xact_lock(hashtext('tech:' || v_uid::text));

  v_level := public.tech_level(v_uid, p_node);
  if v_level >= v_node.max_level then
    raise exception 'Niveau maximal déjà atteint.';
  end if;
  if v_node.requires_key is not null and public.tech_level(v_uid, v_node.requires_key) < v_node.requires_level then
    raise exception 'Il faut d''abord « % » niveau %.',
      (select label from public.tech_nodes where key = v_node.requires_key), v_node.requires_level;
  end if;

  v_cost := v_node.cost_base + v_node.cost_step * v_level;
  v_avail := public.tech_points_available(v_uid);
  if v_avail < v_cost then
    raise exception 'Il te faut % points (tu en as %).', v_cost, v_avail;
  end if;

  if p_node = 'rank' then
    select member_rank into v_rank from public.profiles where id = v_uid;
    if v_rank = 'S' then
      raise exception 'Tu es déjà au rang le plus haut (S).';
    end if;
    update public.profiles set member_rank = v_ranks[array_position(v_ranks, v_rank) + 1] where id = v_uid
      returning member_rank into v_rank;
  end if;

  insert into public.member_tech as mt (user_id, node, level) values (v_uid, p_node, v_level + 1)
  on conflict (user_id, node) do update set level = mt.level + 1;
  insert into public.tech_purchases (user_id, node, level, cost) values (v_uid, p_node, v_level + 1, v_cost);

  return jsonb_build_object('node', p_node, 'level', v_level + 1, 'cost', v_cost,
    'points', public.tech_points_available(v_uid), 'rank', v_rank);
end;
$$;

-- Application des bonus : à chaque mouvement d'argent concerné, un
-- complément (ou un remboursement) est versé tout de suite.
create or replace function public.apply_tech_bonuses()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pct numeric;
  v_bonus numeric(15,2);
  v_label text;
  v_vat numeric;
  v_from_pool boolean := false;
begin
  if new.reason is null or new.reason like 'Arbre techno%' then
    return null;
  end if;

  if new.reason like 'Récompense quête%' and new.amount > 0 then
    v_pct := public.tech_bonus(new.user_id, 'quest_reward');
    v_bonus := round(new.amount * v_pct, 2);
    v_label := 'Arbre techno : prime de mission';
  elsif new.reason like 'Salaire%' and new.amount > 0 then
    v_pct := public.tech_bonus(new.user_id, 'salary');
    v_bonus := round(new.amount * v_pct, 2);
    v_label := 'Arbre techno : négociation salariale';
  elsif new.reason = 'Intérêts bancaires' and new.amount > 0 then
    v_pct := public.tech_bonus(new.user_id, 'interest');
    v_bonus := round(new.amount * v_pct, 2);
    v_label := 'Arbre techno : placements avisés';
  elsif new.reason = 'Impôt hebdomadaire' and new.amount < 0 then
    v_pct := least(public.tech_bonus(new.user_id, 'tax'), 1);
    v_bonus := round(-new.amount * v_pct, 2);
    v_label := 'Arbre techno : optimisation fiscale';
    v_from_pool := true;
  elsif new.reason like 'Vente : %(TVA %' and new.amount > 0 and new.related_purchase_id is not null then
    v_pct := least(public.tech_bonus(new.user_id, 'vat'), 1);
    select total_price - new.amount into v_vat from public.purchases where id = new.related_purchase_id;
    v_bonus := round(greatest(coalesce(v_vat, 0), 0) * v_pct, 2);
    v_label := 'Arbre techno : TVA réduite';
    v_from_pool := true;
  else
    return null;
  end if;

  if coalesce(v_bonus, 0) <= 0 then
    return null;
  end if;

  update public.wallets set balance = balance + v_bonus where user_id = new.user_id;
  -- Impôts et TVA remboursés : repris dans la caisse où ils étaient allés.
  if v_from_pool then
    update public.tax_pool set balance = greatest(balance - v_bonus, 0) where id = true;
  end if;
  insert into public.transactions (user_id, amount, reason, created_by)
  values (new.user_id, v_bonus, v_label, new.user_id);
  return null;
end;
$$;

drop trigger if exists trg_apply_tech_bonuses on public.transactions;
create trigger trg_apply_tech_bonuses
  after insert on public.transactions
  for each row execute function public.apply_tech_bonuses();

revoke execute on function public.apply_tech_bonuses() from public, anon, authenticated;

-- ---------------------------------------------------------
-- 3) Effets d'objets : admins seulement
-- ---------------------------------------------------------
create or replace function public.guard_shop_item_effect()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.effect is not null)
     or (tg_op = 'UPDATE' and new.effect is distinct from old.effect) then
    if not public.has_permission(auth.uid(), 'manage_economy') then
      raise exception 'Seuls les admins peuvent donner un effet à un objet.';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------
-- Page d'une simulation : + blessures et points de l'arbre
-- ---------------------------------------------------------
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
    'injuries', coalesce((select jsonb_object_agg(kind, until) from public.simulation_injuries where user_id = v_uid and until > now()), '{}'::jsonb),
    'tech_points', public.tech_points_available(v_uid),
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
