-- =========================================================
-- Lot 87 : recrutement, dex et alliés, suite.
-- À lancer après 0104. Peut être relancée sans risque.
--
-- * Éveil : retirer un personnage déjà présent dans le dex le fait monter
--   d'un niveau (5 au plus). Chaque niveau : +5 % aux trois facteurs,
--   +3 points de réussite pour un allié, une protection de plus par jour
--   aux niveaux 3 et 5, et 10 % de risque d'échec en moins à la
--   réutilisation.
-- * Garantie : après un nombre réglable de tirages sans rang A ou mieux
--   (par type de tirage), le suivant donne au moins un rang A.
-- * Tirage ×10, avec une remise réglable.
-- * Fusion : plusieurs cartes du même rang et du même type deviennent une
--   carte du rang au-dessus. Les cartes fusionnées restent dans la
--   collection mais ne servent plus ; les retirer les ramène.
-- * Collection, classement des collectionneurs et historique des tirages.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Réglages
-- ---------------------------------------------------------
insert into public.app_config (key, value) values
  ('gacha_pity_draws', '50'),        -- tirages sans rang A ou mieux avant la garantie (0 : pas de garantie)
  ('gacha_multi_discount', '0.1'),   -- remise du tirage ×10
  ('dex_fusion_count', '5')          -- cartes nécessaires à une fusion
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'dex_entries' and column_name = 'level') then
    alter table public.dex_entries add column level int not null default 0 check (level between 0 and 5);
    -- Les doublons déjà tirés comptent pour l'éveil.
    update public.dex_entries set level = least(5, draws - 1) where draws > 1;
  end if;
end $$;
alter table public.dex_entries add column if not exists fused_at timestamptz;

alter table public.quest_gacha_draws add column if not exists pity boolean not null default false;

create table if not exists public.gacha_pity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  pool text not null check (pool in ('renfort', 'donjons', 'intelligence', 'techniques')),
  misses int not null default 0,
  primary key (user_id, pool)
);
alter table public.gacha_pity enable row level security;
drop policy if exists "gacha_pity_select" on public.gacha_pity;
create policy "gacha_pity_select" on public.gacha_pity for select using (user_id = auth.uid());

create table if not exists public.dex_fusions (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  from_rank text not null,
  to_rank text not null,
  entry_id uuid references public.dex_entries (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.dex_fusions enable row level security;
drop policy if exists "dex_fusions_select" on public.dex_fusions;
create policy "dex_fusions_select" on public.dex_fusions for select using (user_id = auth.uid());

-- ---------------------------------------------------------
-- 3. Aides
-- ---------------------------------------------------------
-- Multiplicateur des facteurs selon le niveau d'éveil.
create or replace function public._dex_mult(p_level int)
returns numeric
language sql immutable
as $$ select 1 + 0.05 * greatest(0, least(5, coalesce(p_level, 0))); $$;

-- Allié : {réussite %, protections par jour} selon le rang et l'éveil.
create or replace function public._ally_power(p_rank text, p_level int)
returns int[]
language sql immutable
as $$
  select array[
    least(99, (public._ally_rank(p_rank))[1] + 3 * coalesce(p_level, 0)),
    (public._ally_rank(p_rank))[2] + (case when coalesce(p_level, 0) >= 3 then 1 else 0 end)
                                   + (case when coalesce(p_level, 0) >= 5 then 1 else 0 end)
  ];
$$;

-- Risque d'échec de la réutilisation, réduit par l'éveil.
create or replace function public._dex_fail_lv(p_rank text, p_level int)
returns numeric
language sql stable security definer set search_path = public
as $$ select public._dex_fail(p_rank) * (1 - 0.1 * greatest(0, least(5, coalesce(p_level, 0)))); $$;

-- Nombre de personnages différents par rang (prénoms × surnoms de _gacha_name).
create or replace function public._gacha_name_total()
returns int
language sql immutable
as $$ select 180; $$;

-- Carte au format JSON, facteurs éveillés.
create or replace function public._dex_card(e public.dex_entries)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'rank', e.rank, 'name', e.name, 'level', e.level,
    'intelligence', round(e.intelligence * public._dex_mult(e.level), 1),
    'strength', round(e.strength * public._dex_mult(e.level), 1),
    'technique', round(e.technique * public._dex_mult(e.level), 1),
    'power', round(e.power * public._dex_mult(e.level), 1),
    'ally_chance', (public._ally_power(e.rank, e.level))[1],
    'ally_charges', (public._ally_power(e.rank, e.level))[2]);
$$;

-- Enregistrement dans le dex : un doublon éveille la carte, une carte
-- fusionnée revient (remplace la fonction du lot 86).
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
        level = case when public.dex_entries.fused_at is null then least(5, public.dex_entries.level + 1)
                     else public.dex_entries.level end,
        fused_at = null,
        intelligence = case when excluded.power > public.dex_entries.power then excluded.intelligence else public.dex_entries.intelligence end,
        strength = case when excluded.power > public.dex_entries.power then excluded.strength else public.dex_entries.strength end,
        technique = case when excluded.power > public.dex_entries.power then excluded.technique else public.dex_entries.technique end,
        power = greatest(excluded.power, public.dex_entries.power)
  returning id into v_id;
  return v_id;
end;
$$;

-- Une carte de quête porte l'éveil de son entrée du dex.
create or replace function public.quest_cards_to_dex()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_m numeric;
begin
  if new.dex_id is null then
    new.dex_id := public._dex_register(new.user_id, 'renfort', new.rank, new.name,
                                       new.intelligence, new.strength, new.technique, new.power);
    select public._dex_mult(level) into v_m from public.dex_entries where id = new.dex_id;
    if v_m > 1 then
      new.intelligence := round(new.intelligence * v_m, 1);
      new.strength := round(new.strength * v_m, 1);
      new.technique := round(new.technique * v_m, 1);
      new.power := round(new.power * v_m, 1);
    end if;
  end if;
  return new;
end;
$$;

-- Rang d'un tirage avec la garantie.
create or replace function public._gacha_roll(p_uid uuid, p_pool text, p_luck numeric,
                                              out o_rank text, out o_pity boolean)
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_need int := public.get_config_numeric('gacha_pity_draws', 50)::int;
  v_miss int;
begin
  o_rank := public._gacha_pick(p_luck);
  o_pity := false;
  insert into public.gacha_pity (user_id, pool) values (p_uid, p_pool) on conflict do nothing;
  select misses into v_miss from public.gacha_pity where user_id = p_uid and pool = p_pool for update;
  if o_rank is not null and public._rank_index(o_rank) >= 4 then
    v_miss := 0;
  elsif v_need > 0 and v_miss + 1 >= v_need then
    o_rank := 'A';
    o_pity := true;
    v_miss := 0;
  else
    v_miss := v_miss + 1;
  end if;
  update public.gacha_pity set misses = v_miss where user_id = p_uid and pool = p_pool;
end;
$$;

-- Tirages restants avant la garantie (null : pas de garantie).
create or replace function public.gacha_pity_left(p_pool text)
returns int
language sql stable security definer set search_path = public
as $$
  select case when public.get_config_numeric('gacha_pity_draws', 50) <= 0 then null
              else greatest(1, public.get_config_numeric('gacha_pity_draws', 50)::int
                               - coalesce((select misses from public.gacha_pity where user_id = auth.uid() and pool = p_pool), 0)) end;
$$;

-- Prix total de p_count tirages (remise au tirage ×10).
create or replace function public._gacha_total(p_unit numeric, p_count int)
returns numeric
language sql stable security definer set search_path = public
as $$
  select round(p_unit * p_count * (case when p_count = 10 then 1 - public.get_config_numeric('gacha_multi_discount', 0.1) else 1 end), 2);
$$;

-- ---------------------------------------------------------
-- 4. Renforts de quête : 1 à 10 tirages
-- ---------------------------------------------------------
create or replace function public.quest_gacha_draw_n(p_quest uuid, p_luck numeric default 1, p_count int default 1)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  q public.quests;
  v_part public.quest_participants;
  v_luck numeric := round(coalesce(p_luck, 1), 2);
  v_count int := coalesce(p_count, 1);
  v_total numeric;
  v_each numeric;
  v_rank text;
  v_pity boolean;
  v_kept int;
  v_card public.quest_cards;
  e public.dex_entries;
  v_i numeric; v_s numeric; v_t numeric;
  v_results jsonb := '[]'::jsonb;
  v_choose boolean := false;
  n int;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if v_count < 1 or v_count > 10 then raise exception 'De 1 à 10 tirages à la fois.'; end if;
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

  v_total := public._gacha_total(public._gacha_cost(v_luck), v_count);
  v_each := round(v_total / v_count, 2);
  perform public._gacha_charge(v_uid, v_total,
    'Recrutement : ' || q.title || case when v_count > 1 then ' (×' || v_count || ')' else '' end, p_quest);

  for n in 1..v_count loop
    select o_rank, o_pity into v_rank, v_pity from public._gacha_roll(v_uid, 'renfort', v_luck);
    if v_rank is null then
      insert into public.quest_gacha_draws (quest_id, user_id, luck, cost, kind) values (p_quest, v_uid, v_luck, v_each, 'renfort');
      v_results := v_results || jsonb_build_array(jsonb_build_object('rank', null));
      continue;
    end if;

    v_i := public._gacha_stat(v_rank);
    v_s := public._gacha_stat(v_rank);
    v_t := public._gacha_stat(v_rank);
    select count(*) into v_kept from public.quest_cards where quest_id = p_quest and user_id = v_uid and kept;
    insert into public.quest_cards (quest_id, user_id, rank, name, intelligence, strength, technique, power, kept)
    values (p_quest, v_uid, v_rank, public._gacha_name(v_rank), v_i, v_s, v_t, round((v_i + v_s + v_t) / 3, 1), v_kept < 3)
    returning * into v_card;
    insert into public.quest_gacha_draws (quest_id, user_id, luck, cost, rank, card_id, kind, pity)
    values (p_quest, v_uid, v_luck, v_each, v_rank, v_card.id, 'renfort', v_pity);
    select * into e from public.dex_entries where id = v_card.dex_id;
    if not v_card.kept then v_choose := true; end if;

    if v_rank in ('S', 'Divin') then
      insert into public.notifications (user_id, type, title, body, link)
      select qp.user_id, 'quest_gacha', 'Renfort ' || v_rank,
             coalesce((select nickname from public.profiles where id = v_uid), 'Un agent') || ' a recruté ' || v_card.name
             || ' (rang ' || v_rank || ') pour « ' || q.title || ' ».',
             '/dashboard/quests?quete=' || p_quest
      from public.quest_participants qp
      where qp.quest_id = p_quest and qp.user_id <> v_uid and qp.status <> 'rejected';
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'rank', v_rank, 'pity', v_pity, 'dex_new', e.draws = 1, 'level', e.level, 'awakened', e.draws > 1 and e.level > 0,
      'card', jsonb_build_object('id', v_card.id, 'rank', v_card.rank, 'name', v_card.name, 'level', e.level,
                                 'intelligence', v_card.intelligence, 'strength', v_card.strength,
                                 'technique', v_card.technique, 'power', v_card.power, 'kept', v_card.kept)));
  end loop;

  return jsonb_build_object('cost', v_total, 'results', v_results, 'choose', v_choose,
                            'pity_left', public.gacha_pity_left('renfort'),
                            'balance', (select balance from public.wallets where user_id = v_uid));
end;
$$;

-- Ancienne forme (un tirage), gardée pour compatibilité.
create or replace function public.quest_gacha_draw(p_quest uuid, p_luck numeric default 1)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb := public.quest_gacha_draw_n(p_quest, p_luck, 1);
begin
  return (v->'results'->0) || jsonb_build_object('cost', v->'cost', 'choose', v->'choose', 'balance', v->'balance',
                                                 'pity_left', v->'pity_left');
end;
$$;

-- ---------------------------------------------------------
-- 5. Alliés de simulation : 1 à 10 tirages
-- ---------------------------------------------------------
create or replace function public.sim_gacha_draw_n(p_kind text, p_luck numeric default 1, p_count int default 1)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_luck numeric := round(coalesce(p_luck, 1), 2);
  v_count int := coalesce(p_count, 1);
  v_unit numeric;
  v_total numeric;
  v_each numeric;
  v_rank text;
  v_pity boolean;
  v_i numeric; v_s numeric; v_t numeric;
  v_id uuid;
  e public.dex_entries;
  v_results jsonb := '[]'::jsonb;
  n int;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_kind not in ('donjons', 'intelligence', 'techniques') then raise exception 'Simulation inconnue.'; end if;
  if v_count < 1 or v_count > 10 then raise exception 'De 1 à 10 tirages à la fois.'; end if;
  if v_luck < 1 then raise exception 'Le bonus de chance commence à ×1.'; end if;
  if v_luck > public._gacha_luck_max() then
    raise exception 'Au-delà de ×%, le rang Divin est déjà assuré.', to_char(public._gacha_luck_max(), 'FM999G999G999G999');
  end if;

  v_unit := round(public.get_config_numeric('gacha_sim_price', 1000) * power(v_luck, ln(4.8::numeric) / ln(5::numeric)), 2);
  v_total := public._gacha_total(v_unit, v_count);
  v_each := round(v_total / v_count, 2);
  perform public._gacha_charge(v_uid, v_total,
    'Recrutement d''allié : ' || p_kind || case when v_count > 1 then ' (×' || v_count || ')' else '' end, null);

  for n in 1..v_count loop
    select o_rank, o_pity into v_rank, v_pity from public._gacha_roll(v_uid, p_kind, v_luck);
    if v_rank is null then
      insert into public.quest_gacha_draws (quest_id, user_id, luck, cost, kind) values (null, v_uid, v_luck, v_each, p_kind);
      v_results := v_results || jsonb_build_array(jsonb_build_object('rank', null));
      continue;
    end if;
    v_i := public._gacha_stat(v_rank);
    v_s := public._gacha_stat(v_rank);
    v_t := public._gacha_stat(v_rank);
    v_id := public._dex_register(v_uid, p_kind, v_rank, public._gacha_name(v_rank), v_i, v_s, v_t, round((v_i + v_s + v_t) / 3, 1));
    select * into e from public.dex_entries where id = v_id;
    insert into public.quest_gacha_draws (quest_id, user_id, luck, cost, rank, kind, pity)
    values (null, v_uid, v_luck, v_each, v_rank, p_kind, v_pity);
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'rank', v_rank, 'pity', v_pity, 'dex_new', e.draws = 1, 'level', e.level, 'awakened', e.draws > 1 and e.level > 0,
      'card', public._dex_card(e)));
  end loop;

  return jsonb_build_object('cost', v_total, 'results', v_results,
                            'pity_left', public.gacha_pity_left(p_kind),
                            'balance', (select balance from public.wallets where user_id = v_uid));
end;
$$;

create or replace function public.sim_gacha_draw(p_kind text, p_luck numeric default 1)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb := public.sim_gacha_draw_n(p_kind, p_luck, 1);
begin
  return (v->'results'->0) || jsonb_build_object('cost', v->'cost', 'balance', v->'balance', 'pity_left', v->'pity_left');
end;
$$;

-- ---------------------------------------------------------
-- 6. Dex : liste, réutilisation, fusion
-- ---------------------------------------------------------
create or replace function public.dex_list(p_kind text default null)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(public._dex_card(e) || jsonb_build_object(
    'base_power', e.power,
    'draws', e.draws, 'first_at', e.first_at, 'last_at', e.last_at,
    'fused', e.fused_at is not null,
    'reuse_ready_at', case when e.reuse_ready_at > now() then e.reuse_ready_at end,
    'reuse_cost', public._dex_cost(e.rank, e.power),
    'reuse_fail', public._dex_fail_lv(e.rank, e.level),
    'equipped', exists (select 1 from public.sim_allies a where a.user_id = e.user_id and a.dex_id = e.id)
  ) order by (e.fused_at is not null), public._rank_index(e.rank) desc, e.level desc, e.power desc), '[]'::jsonb)
  from public.dex_entries e
  where e.user_id = auth.uid() and (p_kind is null or e.kind = p_kind);
$$;

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
  v_m numeric;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  select * into e from public.dex_entries where id = p_entry and user_id = v_uid for update;
  if e.id is null then raise exception 'Carte introuvable dans ton dex.'; end if;
  if e.kind <> 'renfort' then raise exception 'Cette carte est un allié de simulation : équipe-la depuis la simulation.'; end if;
  if e.fused_at is not null then raise exception 'Cette carte a été fusionnée.'; end if;
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

  if random() < public._dex_fail_lv(e.rank, e.level) then
    v_until := now() + (public.get_config_numeric('dex_cooldown_hours', 2) || ' hours')::interval;
    update public.dex_entries set reuse_ready_at = v_until where id = e.id;
    insert into public.dex_reuse_log (user_id, entry_id, quest_id, cost, ok) values (v_uid, e.id, p_quest, v_cost, false);
    return jsonb_build_object('ok', false, 'cost', v_cost, 'until', v_until,
                              'balance', (select balance from public.wallets where user_id = v_uid));
  end if;

  v_m := public._dex_mult(e.level);
  select count(*) into v_kept from public.quest_cards where quest_id = p_quest and user_id = v_uid and kept;
  insert into public.quest_cards (quest_id, user_id, rank, name, intelligence, strength, technique, power, kept, dex_id)
  values (p_quest, v_uid, e.rank, e.name, round(e.intelligence * v_m, 1), round(e.strength * v_m, 1),
          round(e.technique * v_m, 1), round(e.power * v_m, 1), v_kept < 3, e.id)
  returning * into v_card;
  insert into public.dex_reuse_log (user_id, entry_id, quest_id, cost, ok) values (v_uid, e.id, p_quest, v_cost, true);
  return jsonb_build_object('ok', true, 'cost', v_cost, 'choose', not v_card.kept,
    'card', jsonb_build_object('id', v_card.id, 'rank', v_card.rank, 'name', v_card.name, 'level', e.level,
                               'intelligence', v_card.intelligence, 'strength', v_card.strength,
                               'technique', v_card.technique, 'power', v_card.power, 'kept', v_card.kept),
    'balance', (select balance from public.wallets where user_id = v_uid));
end;
$$;

-- Fusion : p_ids (autant que dex_fusion_count) du même rang et du même type
-- donnent une carte du rang au-dessus.
create or replace function public.dex_fuse(p_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_need int := public.get_config_numeric('dex_fusion_count', 5)::int;
  v_n int;
  v_kinds int;
  v_ranks int;
  v_kind text;
  v_rank text;
  v_next text;
  v_i numeric; v_s numeric; v_t numeric;
  v_id uuid;
  e public.dex_entries;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_ids is null or cardinality(p_ids) <> v_need or (select count(distinct x) from unnest(p_ids) x) <> v_need then
    raise exception 'Une fusion demande % cartes différentes.', v_need;
  end if;
  perform 1 from public.dex_entries where id = any (p_ids) for update;
  select count(*), count(distinct kind), count(distinct rank), min(kind), min(rank)
    into v_n, v_kinds, v_ranks, v_kind, v_rank
  from public.dex_entries where id = any (p_ids) and user_id = v_uid and fused_at is null;
  if v_n <> v_need then raise exception 'Certaines cartes ne sont pas dans ton dex ou sont déjà fusionnées.'; end if;
  if v_kinds > 1 or v_ranks > 1 then raise exception 'Les cartes doivent être du même rang et du même type.'; end if;
  if v_rank = 'Divin' then raise exception 'Le rang Divin ne se fusionne pas.'; end if;
  if exists (select 1 from public.sim_allies where dex_id = any (p_ids)) then
    raise exception 'Retire d''abord l''allié équipé de la fusion.';
  end if;

  v_next := (array['E', 'D', 'C', 'B', 'A', 'S', 'Divin'])[public._rank_index(v_rank) + 2];
  update public.dex_entries set fused_at = now() where id = any (p_ids) and user_id = v_uid;

  v_i := public._gacha_stat(v_next);
  v_s := public._gacha_stat(v_next);
  v_t := public._gacha_stat(v_next);
  v_id := public._dex_register(v_uid, v_kind, v_next, public._gacha_name(v_next), v_i, v_s, v_t, round((v_i + v_s + v_t) / 3, 1));
  select * into e from public.dex_entries where id = v_id;
  insert into public.dex_fusions (user_id, kind, from_rank, to_rank, entry_id) values (v_uid, v_kind, v_rank, v_next, v_id);

  return jsonb_build_object('dex_new', e.draws = 1, 'awakened', e.draws > 1 and e.level > 0, 'card', public._dex_card(e));
end;
$$;

-- ---------------------------------------------------------
-- 7. Alliés : éveil pris en compte
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
    if not exists (select 1 from public.dex_entries where id = p_entry and user_id = v_uid and kind = p_kind and fused_at is null) then
      raise exception 'Cet allié n''est pas disponible dans ton dex pour cette simulation.';
    end if;
    insert into public.sim_allies (user_id, kind, dex_id) values (v_uid, p_kind, p_entry)
    on conflict (user_id, kind) do update set dex_id = excluded.dex_id;
  end if;
  return public.sim_ally_status(p_kind);
end;
$$;

create or replace function public._ally_try(p_uid uuid, p_kind text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  a public.sim_allies;
  e public.dex_entries;
  v_cfg int[];
  v_today date := (now() at time zone public.stats_timezone())::date;
begin
  select * into a from public.sim_allies where user_id = p_uid and kind = p_kind for update;
  if a.user_id is null then return false; end if;
  select * into e from public.dex_entries where id = a.dex_id;
  if e.id is null or e.fused_at is not null then return false; end if;
  v_cfg := public._ally_power(e.rank, e.level);
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
  v_cfg := public._ally_power(e.rank, e.level);
  v_used := case when a.used_on = v_today then a.used else 0 end;
  return jsonb_build_object(
    'ally', public._dex_card(e),
    'chance', v_cfg[1], 'charges', v_cfg[2], 'used', v_used, 'left', greatest(0, v_cfg[2] - v_used),
    'last_saved_at', (select max(finished_at) from public.simulation_runs
                        where user_id = v_uid and kind = p_kind and ally_saved));
end;
$$;

create or replace function public.boss_raid_member_ally()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select public._dex_card(e) - 'id' - 'kind' - 'ally_chance' - 'ally_charges'
    into new.ally
  from public.sim_allies a join public.dex_entries e on e.id = a.dex_id
  where a.user_id = new.user_id and a.kind = 'donjons' and e.fused_at is null;
  return new;
end;
$$;

-- ---------------------------------------------------------
-- 8. Collection, classement, historique
-- ---------------------------------------------------------
create or replace function public.dex_collection()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with k(kind) as (values ('renfort'), ('donjons'), ('intelligence'), ('techniques')),
       r(rank, i) as (select x, ord - 1 from unnest(array['E', 'D', 'C', 'B', 'A', 'S', 'Divin']) with ordinality as t(x, ord))
  select jsonb_build_object(
    'total_per_rank', public._gacha_name_total(),
    'kinds', jsonb_object_agg(k.kind, (
      select jsonb_object_agg(r.rank, (select count(*) from public.dex_entries e
                                       where e.user_id = auth.uid() and e.kind = k.kind and e.rank = r.rank))
      from r)),
    'found', (select count(*) from public.dex_entries where user_id = auth.uid()),
    'total', public._gacha_name_total() * 7 * 4)
  from k;
$$;

create or replace function public.dex_leaderboard(p_limit int default 20)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.found desc, x.best desc, x.levels desc), '[]'::jsonb)
  from (
    select e.user_id, coalesce(p.nickname, 'Agent') as nickname,
           count(*) as found,
           max(public._rank_index(e.rank)) as best,
           count(*) filter (where e.rank = 'Divin') as divins,
           sum(e.level) as levels,
           (e.user_id = auth.uid()) as me
    from public.dex_entries e left join public.profiles p on p.id = e.user_id
    group by e.user_id, p.nickname
    order by count(*) desc, max(public._rank_index(e.rank)) desc
    limit greatest(1, least(100, coalesce(p_limit, 20)))
  ) x
  where auth.uid() is not null;
$$;

create or replace function public.gacha_history(p_limit int default 40)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'stats', (select jsonb_build_object(
                'draws', count(*), 'spent', coalesce(sum(cost), 0),
                'fails', count(*) filter (where rank is null),
                'pities', count(*) filter (where pity),
                'by_rank', coalesce((select jsonb_object_agg(rank, n) from (
                   select rank, count(*) n from public.quest_gacha_draws
                   where user_id = auth.uid() and rank is not null group by rank) b), '{}'::jsonb))
              from public.quest_gacha_draws where user_id = auth.uid()),
    'reuse', (select jsonb_build_object('count', count(*), 'ok', count(*) filter (where ok), 'spent', coalesce(sum(cost), 0))
              from public.dex_reuse_log where user_id = auth.uid()),
    'pity_left', jsonb_build_object(
      'renfort', public.gacha_pity_left('renfort'), 'donjons', public.gacha_pity_left('donjons'),
      'intelligence', public.gacha_pity_left('intelligence'), 'techniques', public.gacha_pity_left('techniques')),
    'draws', coalesce((select jsonb_agg(d order by d.created_at desc) from (
      select g.created_at, g.kind, g.rank, g.luck, g.cost, g.pity, q.title as quest
      from public.quest_gacha_draws g left join public.quests q on q.id = g.quest_id
      where g.user_id = auth.uid()
      order by g.created_at desc
      limit greatest(1, least(200, coalesce(p_limit, 40)))) d), '[]'::jsonb),
    'fusions', coalesce((select jsonb_agg(f order by f.created_at desc) from (
      select f.created_at, f.kind, f.from_rank, f.to_rank, e.name
      from public.dex_fusions f left join public.dex_entries e on e.id = f.entry_id
      where f.user_id = auth.uid()
      order by f.created_at desc limit 20) f), '[]'::jsonb));
$$;

-- ---------------------------------------------------------
-- 9. Réglages
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
    'pity_draws', public.get_config_numeric('gacha_pity_draws', 50),
    'multi_discount', public.get_config_numeric('gacha_multi_discount', 0.1),
    'fusion_count', public.get_config_numeric('dex_fusion_count', 5),
    'dex', jsonb_build_object(
      'cost_e_min', public.get_config_numeric('dex_cost_e_min', 5000),
      'cost_e_max', public.get_config_numeric('dex_cost_e_max', 25000),
      'cost_divin_min', public.get_config_numeric('dex_cost_divin_min', 10000000),
      'cost_divin_max', public.get_config_numeric('dex_cost_divin_max', 50000000),
      'fail_e', public.get_config_numeric('dex_fail_e', 0.02),
      'fail_divin', public.get_config_numeric('dex_fail_divin', 0.25),
      'cooldown_hours', public.get_config_numeric('dex_cooldown_hours', 2)));
$$;

create or replace function public.gacha_extra_set(p_pity_draws int, p_multi_discount numeric, p_fusion_count int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then raise exception 'Permission refusée.'; end if;
  if p_pity_draws is null or p_pity_draws < 0 or p_pity_draws > 10000 then
    raise exception 'La garantie va de 0 (aucune) à 10 000 tirages.';
  end if;
  if p_multi_discount is null or p_multi_discount < 0 or p_multi_discount > 0.5 then
    raise exception 'La remise du tirage ×10 va de 0 à 50 %%.';
  end if;
  if p_fusion_count is null or p_fusion_count < 2 or p_fusion_count > 20 then
    raise exception 'Une fusion demande de 2 à 20 cartes.';
  end if;
  insert into public.app_config (key, value) values
    ('gacha_pity_draws', p_pity_draws::text),
    ('gacha_multi_discount', p_multi_discount::text),
    ('dex_fusion_count', p_fusion_count::text)
  on conflict (key) do update set value = excluded.value;
  return public.gacha_settings();
end;
$$;

-- ---------------------------------------------------------
-- 10. Droits
-- ---------------------------------------------------------
revoke execute on function public._dex_mult(int) from public, anon;
revoke execute on function public._ally_power(text, int) from public, anon;
revoke execute on function public._dex_fail_lv(text, int) from public, anon;
revoke execute on function public._gacha_name_total() from public, anon;
revoke execute on function public._dex_card(public.dex_entries) from public, anon, authenticated;
revoke execute on function public._gacha_roll(uuid, text, numeric) from public, anon, authenticated;
revoke execute on function public._gacha_total(numeric, int) from public, anon;
revoke execute on function public._dex_register(uuid, text, text, text, numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke execute on function public._ally_try(uuid, text) from public, anon, authenticated;
revoke execute on function public.quest_cards_to_dex() from public, anon, authenticated;
revoke execute on function public.boss_raid_member_ally() from public, anon, authenticated;
revoke execute on function public.gacha_pity_left(text) from public, anon;
revoke execute on function public.quest_gacha_draw_n(uuid, numeric, int) from public, anon;
revoke execute on function public.quest_gacha_draw(uuid, numeric) from public, anon;
revoke execute on function public.sim_gacha_draw_n(text, numeric, int) from public, anon;
revoke execute on function public.sim_gacha_draw(text, numeric) from public, anon;
revoke execute on function public.dex_list(text) from public, anon;
revoke execute on function public.dex_reuse(uuid, uuid) from public, anon;
revoke execute on function public.dex_fuse(uuid[]) from public, anon;
revoke execute on function public.sim_ally_equip(text, uuid) from public, anon;
revoke execute on function public.sim_ally_status(text) from public, anon;
revoke execute on function public.dex_collection() from public, anon;
revoke execute on function public.dex_leaderboard(int) from public, anon;
revoke execute on function public.gacha_history(int) from public, anon;
revoke execute on function public.gacha_settings() from public, anon;
revoke execute on function public.gacha_extra_set(int, numeric, int) from public, anon;
grant execute on function public.gacha_pity_left(text) to authenticated;
grant execute on function public.quest_gacha_draw_n(uuid, numeric, int) to authenticated;
grant execute on function public.quest_gacha_draw(uuid, numeric) to authenticated;
grant execute on function public.sim_gacha_draw_n(text, numeric, int) to authenticated;
grant execute on function public.sim_gacha_draw(text, numeric) to authenticated;
grant execute on function public.dex_list(text) to authenticated;
grant execute on function public.dex_reuse(uuid, uuid) to authenticated;
grant execute on function public.dex_fuse(uuid[]) to authenticated;
grant execute on function public.sim_ally_equip(text, uuid) to authenticated;
grant execute on function public.sim_ally_status(text) to authenticated;
grant execute on function public.dex_collection() to authenticated;
grant execute on function public.dex_leaderboard(int) to authenticated;
grant execute on function public.gacha_history(int) to authenticated;
grant execute on function public.gacha_settings() to authenticated;
grant execute on function public.gacha_extra_set(int, numeric, int) to authenticated;

-- ---------------------------------------------------------
-- 11. Devlog
-- ---------------------------------------------------------
insert into public.devlog_entries (slug, title, body, tag, published_at) values
  ('lot-87', 'Éveil, garantie, tirage ×10 et fusion',
   'Retirer un personnage déjà dans ton dex l''**éveille** (5 niveaux) : stats en hausse, allié plus fiable, réutilisation plus sûre. Une **garantie** donne au moins un rang A après une série sans chance. Nouveau **tirage ×10** avec remise. Les cartes en trop se **fusionnent** en une carte du rang au-dessus. Le dex montre ta collection, ton historique et le classement des collectionneurs.', 'nouveau', '2026-11-19 12:00+01')
on conflict (slug) do nothing;
