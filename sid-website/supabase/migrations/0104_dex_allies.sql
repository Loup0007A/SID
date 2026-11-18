-- =========================================================
-- Lot 86 (2/2) : dex des renforts, alliés de simulation, réutilisation.
-- À lancer après 0103. Peut être relancée sans risque.
--
-- * Dex : toute carte tirée (renfort de quête ou allié de simulation) y
--   est enregistrée, même si elle n'est pas gardée sur la quête.
-- * Réutilisation : une carte « renfort » du dex peut rejoindre une autre
--   quête à puissance globale, contre de l'argent, avec une chance d'échec.
--   Prix : entre un minimum et un maximum selon la qualité de la carte ;
--   minimum et maximum de chaque rang suivent une suite géométrique entre
--   le rang E et le rang Divin (réglages). Après un échec, la carte est
--   bloquée quelques heures. L'argent va dans la cagnotte TVA.
-- * Alliés de simulation : Compagnons (Donjons), Sages (Intelligence),
--   Artisans (Techniques), tirés avec le même système de chances que les
--   renforts. Un allié équipé protège un nombre de fois par jour qui
--   dépend de son rang : il évite une blessure (Donjons) ou annule un
--   échec qui aurait compté dans la limite du jour. Un Compagnon équipé
--   apparaît aussi comme allié dans les raids de boss.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Réglages
-- ---------------------------------------------------------
insert into public.app_config (key, value) values
  ('gacha_sim_price', '1000'),          -- prix d'un tirage d'allié de simulation
  ('dex_cost_e_min', '5000'),           -- réutilisation, rang E : prix minimum / maximum
  ('dex_cost_e_max', '25000'),
  ('dex_cost_divin_min', '10000000'),   -- réutilisation, rang Divin
  ('dex_cost_divin_max', '50000000'),
  ('dex_fail_e', '0.02'),               -- chance d'échec, rang E
  ('dex_fail_divin', '0.25'),           -- chance d'échec, rang Divin
  ('dex_cooldown_hours', '2')           -- blocage de la carte après un échec
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------
create table if not exists public.dex_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('renfort', 'donjons', 'intelligence', 'techniques')),
  rank text not null check (rank in ('E', 'D', 'C', 'B', 'A', 'S', 'Divin')),
  name text not null,
  intelligence numeric(6,1) not null,
  strength numeric(6,1) not null,
  technique numeric(6,1) not null,
  power numeric(6,1) not null,
  draws int not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  reuse_ready_at timestamptz,
  unique (user_id, kind, rank, name)
);
create index if not exists dex_entries_user_idx on public.dex_entries (user_id, kind);
alter table public.dex_entries enable row level security;
drop policy if exists "dex_entries_select" on public.dex_entries;
create policy "dex_entries_select" on public.dex_entries for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

alter table public.quest_cards add column if not exists dex_id uuid references public.dex_entries (id) on delete set null;
alter table public.quest_gacha_draws add column if not exists kind text not null default 'renfort';

create table if not exists public.dex_reuse_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid references public.dex_entries (id) on delete set null,
  quest_id uuid references public.quests (id) on delete set null,
  cost numeric(18,2) not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
alter table public.dex_reuse_log enable row level security;
drop policy if exists "dex_reuse_log_select" on public.dex_reuse_log;
create policy "dex_reuse_log_select" on public.dex_reuse_log for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

-- Un allié équipé par simulation ; used / used_on : protections du jour.
create table if not exists public.sim_allies (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('donjons', 'intelligence', 'techniques')),
  dex_id uuid not null references public.dex_entries (id) on delete cascade,
  used int not null default 0,
  used_on date,
  primary key (user_id, kind)
);
alter table public.sim_allies enable row level security;
drop policy if exists "sim_allies_select" on public.sim_allies;
create policy "sim_allies_select" on public.sim_allies for select using (user_id = auth.uid());

-- ---------------------------------------------------------
-- 3. Aides
-- ---------------------------------------------------------
-- Fourchette de chaque facteur selon le rang (la même que _gacha_stat).
create or replace function public._gacha_bounds(p_rank text)
returns numeric[]
language sql immutable
as $$
  select case p_rank when 'E' then array[3, 12] when 'D' then array[10, 22] when 'C' then array[20, 38]
                     when 'B' then array[35, 55] when 'A' then array[52, 75] when 'S' then array[72, 95]
                     else array[120, 200] end::numeric[];
$$;

create or replace function public._rank_index(p_rank text)
returns int
language sql immutable
as $$
  select coalesce(array_position(array['E', 'D', 'C', 'B', 'A', 'S', 'Divin'], p_rank), 1) - 1;
$$;

-- Protection d'un allié selon son rang : chance de réussite (%) et protections par jour.
create or replace function public._ally_rank(p_rank text)
returns int[]
language sql immutable
as $$
  select case p_rank when 'E' then array[15, 1] when 'D' then array[25, 1] when 'C' then array[35, 2]
                     when 'B' then array[50, 2] when 'A' then array[65, 3] when 'S' then array[80, 4]
                     else array[95, 6] end;
$$;

-- Débit d'un tirage : l'argent va dans la cagnotte TVA.
create or replace function public._gacha_charge(p_uid uuid, p_cost numeric, p_reason text, p_quest uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_cur text := coalesce((select value from public.app_config where key = 'currency_plural'), 'zénis');
begin
  if p_cost <= 0 then return; end if;
  update public.wallets set balance = balance - p_cost where user_id = p_uid and balance >= p_cost;
  if not found then
    raise exception 'Il te faut % % pour cela.', to_char(p_cost, 'FM999G999G999G999G990D00'), v_cur;
  end if;
  insert into public.transactions (user_id, amount, reason, related_quest_id, created_by)
  values (p_uid, -p_cost, p_reason, p_quest, p_uid);
  insert into public.tax_pool (id) values (true) on conflict (id) do nothing;
  update public.tax_pool set balance = balance + p_cost where id = true;
end;
$$;

-- Rang tiré pour un bonus de chance (null : tirage raté).
create or replace function public._gacha_pick(p_luck numeric)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_odds jsonb := public._gacha_odds(p_luck);
  v_roll numeric := random();
  v_acc numeric := 0;
  v_rk text;
begin
  foreach v_rk in array array['Divin', 'S', 'A', 'B', 'C', 'D', 'E'] loop
    v_acc := v_acc + (v_odds->>v_rk)::numeric;
    if v_roll < v_acc then return v_rk; end if;
  end loop;
  return null;
end;
$$;

-- Enregistre une carte dans le dex ; renvoie l'entrée. Un personnage déjà
-- connu garde ses meilleures statistiques.
create or replace function public._dex_register(p_uid uuid, p_kind text, p_rank text, p_name text,
                                                p_i numeric, p_s numeric, p_t numeric, p_power numeric)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.dex_entries (user_id, kind, rank, name, intelligence, strength, technique, power)
  values (p_uid, p_kind, p_rank, p_name, p_i, p_s, p_t, p_power)
  on conflict (user_id, kind, rank, name) do update
    set draws = public.dex_entries.draws + 1,
        last_at = now(),
        intelligence = case when excluded.power > public.dex_entries.power then excluded.intelligence else public.dex_entries.intelligence end,
        strength = case when excluded.power > public.dex_entries.power then excluded.strength else public.dex_entries.strength end,
        technique = case when excluded.power > public.dex_entries.power then excluded.technique else public.dex_entries.technique end,
        power = greatest(excluded.power, public.dex_entries.power)
  returning id into v_id;
  return v_id;
end;
$$;

-- Toute carte de quête arrive dans le dex.
create or replace function public.quest_cards_to_dex()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.dex_id is null then
    new.dex_id := public._dex_register(new.user_id, 'renfort', new.rank, new.name,
                                       new.intelligence, new.strength, new.technique, new.power);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_quest_cards_to_dex on public.quest_cards;
create trigger trg_quest_cards_to_dex before insert on public.quest_cards
  for each row execute function public.quest_cards_to_dex();

-- Prix et chance d'échec de la réutilisation d'une carte.
create or replace function public._dex_cost(p_rank text, p_power numeric)
returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare
  v_i numeric := public._rank_index(p_rank);
  v_emin numeric := public.get_config_numeric('dex_cost_e_min', 5000);
  v_emax numeric := public.get_config_numeric('dex_cost_e_max', 25000);
  v_dmin numeric := public.get_config_numeric('dex_cost_divin_min', 10000000);
  v_dmax numeric := public.get_config_numeric('dex_cost_divin_max', 50000000);
  v_b numeric[] := public._gacha_bounds(p_rank);
  v_lo numeric;
  v_hi numeric;
  v_t numeric;
begin
  v_lo := v_emin * power(v_dmin / v_emin, v_i / 6.0);
  v_hi := v_emax * power(v_dmax / v_emax, v_i / 6.0);
  v_t := greatest(0, least(1, (p_power - v_b[1]) / (v_b[2] - v_b[1])));
  return round(v_lo + (v_hi - v_lo) * v_t, 0);
end;
$$;

create or replace function public._dex_fail(p_rank text)
returns numeric
language sql stable security definer set search_path = public
as $$
  select public.get_config_numeric('dex_fail_e', 0.02)
         + (public.get_config_numeric('dex_fail_divin', 0.25) - public.get_config_numeric('dex_fail_e', 0.02))
           * public._rank_index(p_rank) / 6.0;
$$;

-- ---------------------------------------------------------
-- 4. Réglages visibles et modifiables
-- ---------------------------------------------------------
create or replace function public.gacha_settings()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'prob_e', public.get_config_numeric('gacha_prob_e', 0.5),
    'prob_divin', public.get_config_numeric('gacha_prob_divin', 0.000001),
    'price', public.get_config_numeric('gacha_price', 1000),
    'sim_price', public.get_config_numeric('gacha_sim_price', 1000),
    'luck_max', public._gacha_luck_max(),
    'odds', public._gacha_odds(1),
    'dex', jsonb_build_object(
      'cost_e_min', public.get_config_numeric('dex_cost_e_min', 5000),
      'cost_e_max', public.get_config_numeric('dex_cost_e_max', 25000),
      'cost_divin_min', public.get_config_numeric('dex_cost_divin_min', 10000000),
      'cost_divin_max', public.get_config_numeric('dex_cost_divin_max', 50000000),
      'fail_e', public.get_config_numeric('dex_fail_e', 0.02),
      'fail_divin', public.get_config_numeric('dex_fail_divin', 0.25),
      'cooldown_hours', public.get_config_numeric('dex_cooldown_hours', 2)));
$$;

create or replace function public.recruit_settings_set(
  p_sim_price numeric, p_cost_e_min numeric, p_cost_e_max numeric, p_cost_divin_min numeric,
  p_cost_divin_max numeric, p_fail_e numeric, p_fail_divin numeric, p_cooldown_hours numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then raise exception 'Permission refusée.'; end if;
  if p_sim_price is null or p_sim_price < 0 then raise exception 'Prix d''un tirage d''allié invalide.'; end if;
  if p_cost_e_min is null or p_cost_e_min <= 0 or p_cost_e_max is null or p_cost_e_max < p_cost_e_min then
    raise exception 'Réutilisation, rang E : le prix maximum doit être au moins égal au minimum, et supérieur à 0.';
  end if;
  if p_cost_divin_min is null or p_cost_divin_min <= 0 or p_cost_divin_max is null or p_cost_divin_max < p_cost_divin_min then
    raise exception 'Réutilisation, rang Divin : le prix maximum doit être au moins égal au minimum, et supérieur à 0.';
  end if;
  if p_fail_e is null or p_fail_divin is null or p_fail_e < 0 or p_fail_divin < 0 or p_fail_e > 0.95 or p_fail_divin > 0.95 then
    raise exception 'Les chances d''échec vont de 0 à 95 %%.';
  end if;
  if p_cooldown_hours is null or p_cooldown_hours < 0 or p_cooldown_hours > 168 then
    raise exception 'Le blocage va de 0 à 168 heures.';
  end if;
  insert into public.app_config (key, value) values
    ('gacha_sim_price', round(p_sim_price, 2)::text),
    ('dex_cost_e_min', round(p_cost_e_min, 0)::text),
    ('dex_cost_e_max', round(p_cost_e_max, 0)::text),
    ('dex_cost_divin_min', round(p_cost_divin_min, 0)::text),
    ('dex_cost_divin_max', round(p_cost_divin_max, 0)::text),
    ('dex_fail_e', p_fail_e::text),
    ('dex_fail_divin', p_fail_divin::text),
    ('dex_cooldown_hours', p_cooldown_hours::text)
  on conflict (key) do update set value = excluded.value;
  return public.gacha_settings();
end;
$$;

-- ---------------------------------------------------------
-- 5. Renfort de quête : chaque carte tirée entre dans le dex
--    (remplace la fonction du lot 85)
-- ---------------------------------------------------------
create or replace function public.quest_gacha_draw(p_quest uuid, p_luck numeric default 1)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  q public.quests;
  v_part public.quest_participants;
  v_luck numeric := round(coalesce(p_luck, 1), 2);
  v_cost numeric;
  v_odds jsonb;
  v_roll numeric := random();
  v_acc numeric := 0;
  v_rank text;
  v_rk text;
  v_kept int;
  v_card public.quest_cards;
  v_i numeric; v_s numeric; v_t numeric;
  v_draws int;
  v_cur text := coalesce((select value from public.app_config where key = 'currency_plural'), 'zénis');
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if v_luck < 1 then raise exception 'Le bonus de chance commence à ×1.'; end if;
  if v_luck > public._gacha_luck_max() then
    raise exception 'Au-delà de ×%, le rang Divin est déjà assuré.', to_char(public._gacha_luck_max(), 'FM999G999G999G999');
  end if;

  select * into q from public.quests where id = p_quest;
  if q.id is null then raise exception 'Quête introuvable.'; end if;
  if not q.global_power then raise exception 'Le recrutement n''est ouvert que sur les quêtes à puissance globale.'; end if;
  if q.status not in ('open', 'in_progress') then raise exception 'Cette quête est terminée.'; end if;

  select * into v_part from public.quest_participants where quest_id = p_quest and user_id = v_uid for update;
  if v_part.quest_id is null then raise exception 'Prends d''abord la mission pour recruter.'; end if;
  if v_part.status = 'rejected' then raise exception 'Ta participation a été rejetée.'; end if;

  if exists (select 1 from public.quest_cards where quest_id = p_quest and user_id = v_uid and not kept) then
    raise exception 'Choisis d''abord les renforts à garder.';
  end if;

  v_cost := public._gacha_cost(v_luck);
  if v_cost > 0 then
    update public.wallets set balance = balance - v_cost where user_id = v_uid and balance >= v_cost;
    if not found then
      raise exception 'Il te faut % % pour ce tirage.', to_char(v_cost, 'FM999G999G999G990D00'), v_cur;
    end if;
    insert into public.transactions (user_id, amount, reason, related_quest_id, created_by)
    values (v_uid, -v_cost, 'Recrutement : ' || q.title, p_quest, v_uid);
    -- L'argent des tirages va dans la cagnotte TVA.
    insert into public.tax_pool (id) values (true) on conflict (id) do nothing;
    update public.tax_pool set balance = balance + v_cost where id = true;
  end if;

  -- Du plus rare au plus courant.
  v_odds := public._gacha_odds(v_luck);
  foreach v_rk in array array['Divin', 'S', 'A', 'B', 'C', 'D', 'E'] loop
    v_acc := v_acc + (v_odds->>v_rk)::numeric;
    if v_roll < v_acc then
      v_rank := v_rk;
      exit;
    end if;
  end loop;

  if v_rank is null then
    insert into public.quest_gacha_draws (quest_id, user_id, luck, cost, kind) values (p_quest, v_uid, v_luck, v_cost, 'renfort');
    return jsonb_build_object('rank', null, 'cost', v_cost,
                              'balance', (select balance from public.wallets where user_id = v_uid));
  end if;

  v_i := public._gacha_stat(v_rank);
  v_s := public._gacha_stat(v_rank);
  v_t := public._gacha_stat(v_rank);
  select count(*) into v_kept from public.quest_cards where quest_id = p_quest and user_id = v_uid and kept;
  insert into public.quest_cards (quest_id, user_id, rank, name, intelligence, strength, technique, power, kept)
  values (p_quest, v_uid, v_rank, public._gacha_name(v_rank), v_i, v_s, v_t, round((v_i + v_s + v_t) / 3, 1), v_kept < 3)
  returning * into v_card;
  insert into public.quest_gacha_draws (quest_id, user_id, luck, cost, rank, card_id, kind)
  values (p_quest, v_uid, v_luck, v_cost, v_rank, v_card.id, 'renfort');
  select draws into v_draws from public.dex_entries where id = v_card.dex_id;

  if v_rank in ('S', 'Divin') then
    insert into public.notifications (user_id, type, title, body, link)
    select qp.user_id, 'quest_gacha', 'Renfort ' || v_rank,
           coalesce((select nickname from public.profiles where id = v_uid), 'Un agent') || ' a recruté ' || v_card.name
           || ' (rang ' || v_rank || ') pour « ' || q.title || ' ».',
           '/dashboard/quests?quete=' || p_quest
    from public.quest_participants qp
    where qp.quest_id = p_quest and qp.user_id <> v_uid and qp.status <> 'rejected';
  end if;

  return jsonb_build_object('rank', v_rank, 'cost', v_cost, 'choose', not v_card.kept, 'dex_new', coalesce(v_draws, 1) = 1,
    'card', jsonb_build_object('id', v_card.id, 'rank', v_card.rank, 'name', v_card.name,
                               'intelligence', v_card.intelligence, 'strength', v_card.strength,
                               'technique', v_card.technique, 'power', v_card.power, 'kept', v_card.kept),
    'balance', (select balance from public.wallets where user_id = v_uid));
end;
$$;


-- Les cartes déjà tirées au lot 85 rejoignent le dex.
update public.quest_cards
  set dex_id = public._dex_register(user_id, 'renfort', rank, name, intelligence, strength, technique, power)
  where dex_id is null;

-- ---------------------------------------------------------
-- 6. Réutiliser une carte du dex sur une quête (paiement + risque d'échec)
-- ---------------------------------------------------------
create or replace function public.dex_reuse(p_entry uuid, p_quest uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  e public.dex_entries;
  q public.quests;
  v_part public.quest_participants;
  v_cost numeric;
  v_kept int;
  v_card public.quest_cards;
  v_until timestamptz;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  select * into e from public.dex_entries where id = p_entry and user_id = v_uid for update;
  if e.id is null then raise exception 'Carte introuvable dans ton dex.'; end if;
  if e.kind <> 'renfort' then raise exception 'Cette carte est un allié de simulation : équipe-la depuis la simulation.'; end if;
  if e.reuse_ready_at is not null and e.reuse_ready_at > now() then
    raise exception 'Cette carte récupère encore jusqu''à %.',
      to_char(e.reuse_ready_at at time zone public.stats_timezone(), 'HH24"h"MI');
  end if;

  select * into q from public.quests where id = p_quest;
  if q.id is null then raise exception 'Quête introuvable.'; end if;
  if not q.global_power then raise exception 'Les renforts ne servent que sur les quêtes à puissance globale.'; end if;
  if q.status not in ('open', 'in_progress') then raise exception 'Cette quête est terminée.'; end if;
  select * into v_part from public.quest_participants where quest_id = p_quest and user_id = v_uid for update;
  if v_part.quest_id is null then raise exception 'Prends d''abord la mission pour utiliser un renfort.'; end if;
  if v_part.status = 'rejected' then raise exception 'Ta participation a été rejetée.'; end if;
  if exists (select 1 from public.quest_cards where quest_id = p_quest and user_id = v_uid and dex_id = e.id) then
    raise exception 'Cette carte est déjà sur cette quête.';
  end if;
  if exists (select 1 from public.quest_cards where quest_id = p_quest and user_id = v_uid and not kept) then
    raise exception 'Choisis d''abord les renforts à garder.';
  end if;

  v_cost := public._dex_cost(e.rank, e.power);
  perform public._gacha_charge(v_uid, v_cost, 'Réutilisation de renfort : ' || q.title, p_quest);

  if random() < public._dex_fail(e.rank) then
    v_until := now() + (public.get_config_numeric('dex_cooldown_hours', 2) || ' hours')::interval;
    update public.dex_entries set reuse_ready_at = v_until where id = e.id;
    insert into public.dex_reuse_log (user_id, entry_id, quest_id, cost, ok) values (v_uid, e.id, p_quest, v_cost, false);
    return jsonb_build_object('ok', false, 'cost', v_cost, 'until', v_until,
                              'balance', (select balance from public.wallets where user_id = v_uid));
  end if;

  select count(*) into v_kept from public.quest_cards where quest_id = p_quest and user_id = v_uid and kept;
  insert into public.quest_cards (quest_id, user_id, rank, name, intelligence, strength, technique, power, kept, dex_id)
  values (p_quest, v_uid, e.rank, e.name, e.intelligence, e.strength, e.technique, e.power, v_kept < 3, e.id)
  returning * into v_card;
  insert into public.dex_reuse_log (user_id, entry_id, quest_id, cost, ok) values (v_uid, e.id, p_quest, v_cost, true);
  return jsonb_build_object('ok', true, 'cost', v_cost, 'choose', not v_card.kept,
    'card', jsonb_build_object('id', v_card.id, 'rank', v_card.rank, 'name', v_card.name,
                               'intelligence', v_card.intelligence, 'strength', v_card.strength,
                               'technique', v_card.technique, 'power', v_card.power, 'kept', v_card.kept),
    'balance', (select balance from public.wallets where user_id = v_uid));
end;
$$;

-- Le dex du membre connecté (avec prix, risque et état d'équipement).
create or replace function public.dex_list(p_kind text default null)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'rank', e.rank, 'name', e.name,
    'intelligence', e.intelligence, 'strength', e.strength, 'technique', e.technique, 'power', e.power,
    'draws', e.draws, 'first_at', e.first_at, 'last_at', e.last_at,
    'reuse_ready_at', case when e.reuse_ready_at > now() then e.reuse_ready_at end,
    'reuse_cost', public._dex_cost(e.rank, e.power),
    'reuse_fail', public._dex_fail(e.rank),
    'ally_chance', (public._ally_rank(e.rank))[1],
    'ally_charges', (public._ally_rank(e.rank))[2],
    'equipped', exists (select 1 from public.sim_allies a where a.user_id = e.user_id and a.dex_id = e.id)
  ) order by public._rank_index(e.rank) desc, e.power desc), '[]'::jsonb)
  from public.dex_entries e
  where e.user_id = auth.uid() and (p_kind is null or e.kind = p_kind);
$$;

-- ---------------------------------------------------------
-- 7. Alliés de simulation : tirage
-- ---------------------------------------------------------
create or replace function public.sim_gacha_draw(p_kind text, p_luck numeric default 1)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_luck numeric := round(coalesce(p_luck, 1), 2);
  v_price numeric := public.get_config_numeric('gacha_sim_price', 1000);
  v_cost numeric;
  v_rank text;
  v_i numeric; v_s numeric; v_t numeric; v_power numeric;
  v_name text;
  v_id uuid;
  e public.dex_entries;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_kind not in ('donjons', 'intelligence', 'techniques') then raise exception 'Simulation inconnue.'; end if;
  if v_luck < 1 then raise exception 'Le bonus de chance commence à ×1.'; end if;
  if v_luck > public._gacha_luck_max() then
    raise exception 'Au-delà de ×%, le rang Divin est déjà assuré.', to_char(public._gacha_luck_max(), 'FM999G999G999G999');
  end if;

  v_cost := round(v_price * power(v_luck, ln(4.8::numeric) / ln(5::numeric)), 2);
  perform public._gacha_charge(v_uid, v_cost, 'Recrutement d''allié : ' || p_kind, null);

  v_rank := public._gacha_pick(v_luck);
  if v_rank is null then
    insert into public.quest_gacha_draws (quest_id, user_id, luck, cost, kind) values (null, v_uid, v_luck, v_cost, p_kind);
    return jsonb_build_object('rank', null, 'cost', v_cost,
                              'balance', (select balance from public.wallets where user_id = v_uid));
  end if;

  v_i := public._gacha_stat(v_rank);
  v_s := public._gacha_stat(v_rank);
  v_t := public._gacha_stat(v_rank);
  v_power := round((v_i + v_s + v_t) / 3, 1);
  v_name := public._gacha_name(v_rank);
  v_id := public._dex_register(v_uid, p_kind, v_rank, v_name, v_i, v_s, v_t, v_power);
  select * into e from public.dex_entries where id = v_id;
  insert into public.quest_gacha_draws (quest_id, user_id, luck, cost, rank, kind)
  values (null, v_uid, v_luck, v_cost, v_rank, p_kind);

  return jsonb_build_object('rank', v_rank, 'cost', v_cost, 'dex_new', e.draws = 1,
    'card', jsonb_build_object('id', e.id, 'rank', e.rank, 'name', e.name, 'intelligence', e.intelligence,
                               'strength', e.strength, 'technique', e.technique, 'power', e.power,
                               'ally_chance', (public._ally_rank(e.rank))[1], 'ally_charges', (public._ally_rank(e.rank))[2]),
    'balance', (select balance from public.wallets where user_id = v_uid));
end;
$$;

-- ---------------------------------------------------------
-- 8. Alliés de simulation : équipement et protection
-- ---------------------------------------------------------
create or replace function public.sim_ally_equip(p_kind text, p_entry uuid default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_kind not in ('donjons', 'intelligence', 'techniques') then raise exception 'Simulation inconnue.'; end if;
  if p_entry is null then
    delete from public.sim_allies where user_id = v_uid and kind = p_kind;
  else
    if not exists (select 1 from public.dex_entries where id = p_entry and user_id = v_uid and kind = p_kind) then
      raise exception 'Cet allié n''est pas dans ton dex pour cette simulation.';
    end if;
    -- Changer d'allié ne rend pas les protections déjà utilisées aujourd'hui.
    insert into public.sim_allies (user_id, kind, dex_id) values (v_uid, p_kind, p_entry)
    on conflict (user_id, kind) do update set dex_id = excluded.dex_id;
  end if;
  return public.sim_ally_status(p_kind);
end;
$$;

-- Tente une protection : consomme une charge du jour, puis tire la réussite.
create or replace function public._ally_try(p_uid uuid, p_kind text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  a public.sim_allies;
  v_rank text;
  v_cfg int[];
  v_today date := (now() at time zone public.stats_timezone())::date;
begin
  select * into a from public.sim_allies where user_id = p_uid and kind = p_kind for update;
  if a.user_id is null then return false; end if;
  select rank into v_rank from public.dex_entries where id = a.dex_id;
  if v_rank is null then return false; end if;
  v_cfg := public._ally_rank(v_rank);
  if a.used_on is distinct from v_today then a.used := 0; end if;
  if a.used >= v_cfg[2] then return false; end if;
  update public.sim_allies set used = a.used + 1, used_on = v_today where user_id = p_uid and kind = p_kind;
  return random() * 100 < v_cfg[1];
end;
$$;

create or replace function public.sim_ally_status(p_kind text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a public.sim_allies;
  e public.dex_entries;
  v_cfg int[];
  v_today date := (now() at time zone public.stats_timezone())::date;
  v_used int;
begin
  if v_uid is null then return null; end if;
  select * into a from public.sim_allies where user_id = v_uid and kind = p_kind;
  if a.user_id is null then return jsonb_build_object('ally', null); end if;
  select * into e from public.dex_entries where id = a.dex_id;
  v_cfg := public._ally_rank(e.rank);
  v_used := case when a.used_on = v_today then a.used else 0 end;
  return jsonb_build_object(
    'ally', jsonb_build_object('id', e.id, 'rank', e.rank, 'name', e.name, 'intelligence', e.intelligence,
                               'strength', e.strength, 'technique', e.technique, 'power', e.power),
    'chance', v_cfg[1], 'charges', v_cfg[2], 'used', v_used, 'left', greatest(0, v_cfg[2] - v_used),
    'last_saved_at', (select max(finished_at) from public.simulation_runs
                        where user_id = v_uid and kind = p_kind and ally_saved));
end;
$$;

-- Donjons : l'allié peut éviter la blessure (remplace la fonction du lot 54).
-- Renvoie null quand l'allié a protégé le membre.
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
  if public._ally_try(v_uid, 'donjons') then
    return null;
  end if;
  v_until := now() + (public.get_config_numeric('simulation_injury_minutes', 60) || ' minutes')::interval;
  insert into public.simulation_injuries as si (user_id, kind, until) values (v_uid, p_kind, v_until)
  on conflict (user_id, kind) do update set until = greatest(si.until, excluded.until), created_at = now()
  returning until into v_until;
  update public.simulation_runs set status = 'abandoned', finished_at = now()
    where user_id = v_uid and kind = p_kind and status = 'started';
  return v_until;
end;
$$;

-- Intelligence et Techniques : un échec peut être annulé par l'allié, il ne
-- compte alors pas dans la limite du jour.
alter table public.simulation_runs add column if not exists ally_saved boolean not null default false;

create or replace function public.simulation_ally_second_chance()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public._ally_try(new.user_id, new.kind) then
    update public.simulation_runs set status = 'abandoned', ally_saved = true where id = new.id;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_simulation_ally_second_chance on public.simulation_runs;
create trigger trg_simulation_ally_second_chance after update of status on public.simulation_runs
  for each row
  when (old.status = 'started' and new.status = 'failure' and new.kind in ('intelligence', 'techniques'))
  execute function public.simulation_ally_second_chance();

-- ---------------------------------------------------------
-- 9. Raids de boss : l'allié Donjons équipé rejoint le combat
-- ---------------------------------------------------------
alter table public.boss_raid_members add column if not exists ally jsonb;

create or replace function public.boss_raid_member_ally()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select jsonb_build_object('rank', e.rank, 'name', e.name, 'intelligence', e.intelligence,
                            'strength', e.strength, 'technique', e.technique, 'power', e.power)
    into new.ally
  from public.sim_allies a join public.dex_entries e on e.id = a.dex_id
  where a.user_id = new.user_id and a.kind = 'donjons';
  return new;
end;
$$;
drop trigger if exists trg_boss_raid_member_ally on public.boss_raid_members;
create trigger trg_boss_raid_member_ally before insert on public.boss_raid_members
  for each row execute function public.boss_raid_member_ally();

-- ---------------------------------------------------------
-- 10. Droits
-- ---------------------------------------------------------
revoke execute on function public._gacha_bounds(text) from public, anon;
revoke execute on function public._rank_index(text) from public, anon;
revoke execute on function public._ally_rank(text) from public, anon;
revoke execute on function public._gacha_charge(uuid, numeric, text, uuid) from public, anon, authenticated;
revoke execute on function public._gacha_pick(numeric) from public, anon, authenticated;
revoke execute on function public._dex_register(uuid, text, text, text, numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke execute on function public._dex_cost(text, numeric) from public, anon;
revoke execute on function public._dex_fail(text) from public, anon;
revoke execute on function public._ally_try(uuid, text) from public, anon, authenticated;
revoke execute on function public.quest_cards_to_dex() from public, anon, authenticated;
revoke execute on function public.simulation_ally_second_chance() from public, anon, authenticated;
revoke execute on function public.boss_raid_member_ally() from public, anon, authenticated;
revoke execute on function public.recruit_settings_set(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;
revoke execute on function public.gacha_settings() from public, anon;
revoke execute on function public.dex_reuse(uuid, uuid) from public, anon;
revoke execute on function public.dex_list(text) from public, anon;
revoke execute on function public.sim_gacha_draw(text, numeric) from public, anon;
revoke execute on function public.sim_ally_equip(text, uuid) from public, anon;
revoke execute on function public.sim_ally_status(text) from public, anon;
revoke execute on function public.quest_gacha_draw(uuid, numeric) from public, anon;
grant execute on function public.gacha_settings() to authenticated;
grant execute on function public.dex_reuse(uuid, uuid) to authenticated;
grant execute on function public.dex_list(text) to authenticated;
grant execute on function public.sim_gacha_draw(text, numeric) to authenticated;
grant execute on function public.sim_ally_equip(text, uuid) to authenticated;
grant execute on function public.sim_ally_status(text) to authenticated;
grant execute on function public.recruit_settings_set(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;

-- ---------------------------------------------------------
-- 11. Devlog
-- ---------------------------------------------------------
insert into public.devlog_entries (slug, title, body, tag, published_at) values
  ('lot-86', 'Dex, alliés de simulation et devlog',
   'Chaque carte tirée entre dans ton **dex**. Un renfort de quête peut être réutilisé sur une autre quête à puissance globale, contre de l''argent et avec un risque d''échec (la carte est ensuite bloquée quelques heures). Sur les simulations, recrute un allié : Compagnon (Donjons), Sage (Intelligence) ou Artisan (Techniques). Le Compagnon peut t''éviter une blessure et rejoint tes raids ; le Sage et l''Artisan peuvent annuler un échec. Ce journal est nouveau aussi.', 'nouveau', '2026-11-18 21:00+01')
on conflict (slug) do nothing;
