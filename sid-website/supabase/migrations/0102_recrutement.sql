-- =========================================================
-- Lot 85 : puissance globale des quêtes et recrutement de renforts.
-- À lancer après 0101. Peut être relancée sans risque.
--
-- * Une quête peut demander une puissance « globale » : ses prérequis se
--   comparent à la somme des participants (et de leurs renforts), et
--   peuvent alors dépasser 100. On s'y inscrit sans prérequis personnels ;
--   le rapport ne se rend qu'une fois la puissance réunie.
-- * Sur une quête globale, un participant peut recruter un renfort :
--   tirage payant d'un personnage de rang E à Divin. Trois renforts au
--   plus par membre et par quête : au-delà, il choisit lesquels garder.
-- * L'administration règle la chance d'un rang E, celle d'un rang Divin et
--   le prix d'un tirage. Les rangs D à S suivent une suite géométrique
--   entre les deux ; le reste des chances donne un tirage raté (payé).
-- * Bonus de chance ×k (1 à 10) : multiplie les chances de D à Divin, et
--   coûte prix × k^(ln 4,8 / ln 5), soit 4,8 fois le prix pour ×5.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Quêtes : option et prérequis au-delà de 100.
-- ---------------------------------------------------------
alter table public.quests add column if not exists global_power boolean not null default false;

alter table public.quests alter column min_intelligence type numeric(8,1);
alter table public.quests alter column min_strength type numeric(8,1);
alter table public.quests alter column min_technique type numeric(8,1);
alter table public.quests alter column min_power type numeric(8,1);

alter table public.quests drop constraint if exists quests_min_intelligence_check;
alter table public.quests drop constraint if exists quests_min_strength_check;
alter table public.quests drop constraint if exists quests_min_technique_check;
alter table public.quests drop constraint if exists quests_min_power_check;
alter table public.quests drop constraint if exists quests_min_range;
alter table public.quests add constraint quests_min_range check (
  least(min_intelligence, min_strength, min_technique, min_power) >= 0
  and (global_power or greatest(min_intelligence, min_strength, min_technique, min_power) <= 100)
);

-- ---------------------------------------------------------
-- 2. Renforts et tirages.
-- ---------------------------------------------------------
create table if not exists public.quest_cards (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null,
  user_id uuid not null,
  rank text not null check (rank in ('E', 'D', 'C', 'B', 'A', 'S', 'Divin')),
  name text not null,
  intelligence numeric(6,1) not null,
  strength numeric(6,1) not null,
  technique numeric(6,1) not null,
  power numeric(6,1) not null,
  -- false : tiré en trop, en attente du choix des trois à garder.
  kept boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (quest_id, user_id) references public.quest_participants (quest_id, user_id) on delete cascade
);
create index if not exists quest_cards_owner_idx on public.quest_cards (quest_id, user_id);
alter table public.quest_cards enable row level security;
-- Aucune policy : lecture et écriture passent par les fonctions ci-dessous.

create table if not exists public.quest_gacha_draws (
  id bigserial primary key,
  quest_id uuid references public.quests (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  luck numeric(6,2) not null,
  cost numeric(18,2) not null,
  rank text,                       -- null : tirage raté
  card_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists quest_gacha_draws_user_idx on public.quest_gacha_draws (user_id, created_at desc);
alter table public.quest_gacha_draws enable row level security;
drop policy if exists "quest_gacha_draws_select" on public.quest_gacha_draws;
create policy "quest_gacha_draws_select" on public.quest_gacha_draws for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

-- Notification « Renfort S / Divin » pour les autres participants.
do $$
declare
  v_def text;
  v_types text[];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'notifications_type_check';
  if v_def is null then return; end if;
  if v_def ~ '\{' then
    v_types := string_to_array(substring(v_def from '\{([^}]*)\}'), ',');
  else
    select array_agg(m[1]) into v_types from regexp_matches(v_def, '''([a-z_]+)''', 'g') as m;
  end if;
  if v_types is null or cardinality(v_types) < 5 then
    raise exception 'Liste des types de notification illisible (%), migration arrêtée par prudence.', v_def;
  end if;
  if 'quest_gacha' = any (v_types) then return; end if;
  v_types := array_append(v_types, 'quest_gacha');
  alter table public.notifications drop constraint notifications_type_check;
  execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_types);
end;
$$;

-- ---------------------------------------------------------
-- 3. Réglages et chances.
-- ---------------------------------------------------------
insert into public.app_config (key, value) values
  ('gacha_prob_e', '0.5'),
  ('gacha_prob_divin', '0.000001'),
  ('gacha_price', '1000')
on conflict (key) do nothing;

-- Chances d'un tirage avec le bonus p_luck (1 = sans bonus).
-- p_e / p_divin : pour prévisualiser d'autres réglages.
create or replace function public._gacha_odds(p_luck numeric, p_e numeric default null, p_divin numeric default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_e numeric := coalesce(p_e, public.get_config_numeric('gacha_prob_e', 0.5));
  v_div numeric := coalesce(p_divin, public.get_config_numeric('gacha_prob_divin', 0.000001));
  v_luck numeric := greatest(1, least(coalesce(p_luck, 1), 10));
  v_r numeric;
  v_ranks text[] := array['D', 'C', 'B', 'A', 'S', 'Divin'];
  v_p numeric[] := '{}';
  v_sum numeric := 0;
  v_scale numeric := 1;
  v_qe numeric;
  v_out jsonb := '{}'::jsonb;
  k int;
begin
  v_r := power(v_div / v_e, 1.0 / 6);
  for k in 1 .. 6 loop
    v_p := v_p || (v_e * power(v_r, k) * v_luck);
    v_sum := v_sum + v_e * power(v_r, k) * v_luck;
  end loop;
  if v_sum > 1 then
    v_scale := 1 / v_sum;
    v_sum := 1;
  end if;
  v_qe := greatest(0, least(v_e, 1 - v_sum));
  v_out := jsonb_build_object('E', v_qe);
  for k in 1 .. 6 loop
    v_out := v_out || jsonb_build_object(v_ranks[k], v_p[k] * v_scale);
  end loop;
  return v_out || jsonb_build_object('fail', greatest(0, 1 - v_qe - v_sum));
end;
$$;

-- Prix d'un tirage : 4,8 fois le prix pour une chance ×5.
create or replace function public._gacha_cost(p_luck numeric)
returns numeric
language sql stable security definer set search_path = public
as $$
  select round(public.get_config_numeric('gacha_price', 1000)
               * power(greatest(1, least(coalesce(p_luck, 1), 10))::numeric, ln(4.8::numeric) / ln(5::numeric)), 2);
$$;

create or replace function public.gacha_settings()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'prob_e', public.get_config_numeric('gacha_prob_e', 0.5),
    'prob_divin', public.get_config_numeric('gacha_prob_divin', 0.000001),
    'price', public.get_config_numeric('gacha_price', 1000),
    'luck_max', 10,
    'odds', public._gacha_odds(1));
$$;

create or replace function public.gacha_settings_set(p_prob_e numeric, p_prob_divin numeric, p_price numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_odds jsonb;
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Permission refusée.';
  end if;
  if p_prob_e is null or p_prob_e <= 0 or p_prob_e >= 1 then
    raise exception 'La chance d''un rang E doit être entre 0 et 1 (exclus).';
  end if;
  if p_prob_divin is null or p_prob_divin <= 0 or p_prob_divin >= p_prob_e then
    raise exception 'La chance d''un rang Divin doit être positive et plus faible que celle d''un rang E.';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'Prix invalide.';
  end if;
  v_odds := public._gacha_odds(1, p_prob_e, p_prob_divin);
  if (v_odds->>'E')::numeric < p_prob_e then
    raise exception 'Avec ces réglages, les chances dépassent 100 %% : baisse la chance d''un rang E ou celle d''un rang Divin.';
  end if;

  insert into public.app_config (key, value) values
    ('gacha_prob_e', p_prob_e::text),
    ('gacha_prob_divin', p_prob_divin::text),
    ('gacha_price', round(p_price, 2)::text)
  on conflict (key) do update set value = excluded.value;
  return public.gacha_settings();
end;
$$;

-- ---------------------------------------------------------
-- 4. Personnages tirés.
-- ---------------------------------------------------------
create or replace function public._gacha_name(p_rank text)
returns text
language plpgsql volatile set search_path = public
as $$
declare
  v_first text[] := array['Kaël', 'Mira', 'Thorne', 'Ysolde', 'Darian', 'Nyx', 'Bastien', 'Liora', 'Garrick', 'Séléna',
                          'Ronan', 'Ilya', 'Cassian', 'Maëlle', 'Orin', 'Vesna', 'Aldric', 'Zéphyr', 'Talia', 'Corvin',
                          'Elyas', 'Ondine', 'Brann', 'Isaure', 'Lucan', 'Nahel', 'Rhéa', 'Soren', 'Anouk', 'Viktor'];
  v_tags text[];
begin
  v_tags := case p_rank
    when 'E' then array['l''Apprenti', 'le Débrouillard', 'la Recrue', 'le Vagabond', 'au Bâton', 'le Commis']
    when 'D' then array['le Pisteur', 'la Sentinelle', 'l''Écuyer', 'le Braconnier', 'aux Dagues', 'le Passeur']
    when 'C' then array['le Mercenaire', 'la Lame Grise', 'le Chasseur', 'l''Éclaireur', 'au Bouclier', 'le Rôdeur']
    when 'B' then array['le Vétéran', 'la Lame d''Acier', 'le Briseur', 'l''Arcaniste', 'le Capitaine', 'la Louve']
    when 'A' then array['le Champion', 'la Tempête', 'le Fléau', 'l''Archimage', 'le Tueur de Rois', 'la Main Noire']
    when 'S' then array['le Légendaire', 'Fléau des Cieux', 'l''Invaincu', 'la Reine Sombre', 'le Dernier Dragon', 'Œil du Néant']
    else array['l''Éternel', 'le Premier', 'Celui qui Demeure', 'la Fin des Temps', 'Souffle Divin', 'le Sans-Nom']
  end;
  return v_first[1 + floor(random() * cardinality(v_first))::int] || ' ' || v_tags[1 + floor(random() * cardinality(v_tags))::int];
end;
$$;

-- Fourchette des trois facteurs selon le rang.
create or replace function public._gacha_stat(p_rank text)
returns numeric
language sql volatile set search_path = public
as $$
  select round((r.lo + random() * (r.hi - r.lo))::numeric, 1)
  from (select case p_rank when 'E' then 3 when 'D' then 10 when 'C' then 20 when 'B' then 35
                           when 'A' then 52 when 'S' then 72 else 120 end as lo,
               case p_rank when 'E' then 12 when 'D' then 22 when 'C' then 38 when 'B' then 55
                           when 'A' then 75 when 'S' then 95 else 200 end as hi) r;
$$;

-- ---------------------------------------------------------
-- 5. Puissance réunie sur une quête.
-- ---------------------------------------------------------
create or replace function public._quest_power(p_quest uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with parts as (
    select qp.user_id from public.quest_participants qp
    where qp.quest_id = p_quest and qp.status <> 'rejected'
  ), m as (
    select coalesce(sum(s.intelligence), 0) i, coalesce(sum(s.strength), 0) s, coalesce(sum(s.technique), 0) t,
           coalesce(sum(p.power_score), 0) pw
    from parts x
    left join public.member_stats s on s.user_id = x.user_id
    left join public.profiles p on p.id = x.user_id
  ), c as (
    select coalesce(sum(c.intelligence), 0) i, coalesce(sum(c.strength), 0) s, coalesce(sum(c.technique), 0) t,
           coalesce(sum(c.power), 0) pw
    from public.quest_cards c join parts x on x.user_id = c.user_id
    where c.quest_id = p_quest and c.kept
  )
  select jsonb_build_object(
    'intelligence', round(m.i + c.i, 1),
    'strength', round(m.s + c.s, 1),
    'technique', round(m.t + c.t, 1),
    'power', round(m.pw + c.pw, 1))
  from m, c;
$$;

create or replace function public._quest_power_met(p_quest uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (v->>'intelligence')::numeric >= q.min_intelligence
     and (v->>'strength')::numeric >= q.min_strength
     and (v->>'technique')::numeric >= q.min_technique
     and (v->>'power')::numeric >= q.min_power
  from public.quests q, lateral (select public._quest_power(q.id) v) x
  where q.id = p_quest;
$$;

-- Tout ce qu'affiche le panneau d'une quête globale.
create or replace function public.quest_power(p_quest uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  q public.quests;
  v_members jsonb;
begin
  select * into q from public.quests where id = p_quest;
  if q.id is null
     or not (q.visibility = 'public'
             or (q.visibility = 'members' and v_uid is not null)
             or q.created_by = v_uid
             or public.has_permission(v_uid, 'manage_quests')) then
    raise exception 'Quête introuvable.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', x.user_id,
           'nickname', p.nickname,
           'intelligence', coalesce(s.intelligence, 0),
           'strength', coalesce(s.strength, 0),
           'technique', coalesce(s.technique, 0),
           'power', coalesce(p.power_score, 0),
           'cards', coalesce((select jsonb_agg(jsonb_build_object(
                       'id', c.id, 'rank', c.rank, 'name', c.name, 'intelligence', c.intelligence,
                       'strength', c.strength, 'technique', c.technique, 'power', c.power, 'kept', c.kept)
                       order by c.power desc)
                     from public.quest_cards c
                     where c.quest_id = p_quest and c.user_id = x.user_id and (c.kept or c.user_id = v_uid)), '[]'::jsonb))
         order by x.joined_at), '[]'::jsonb)
    into v_members
  from public.quest_participants x
  join public.profiles p on p.id = x.user_id
  left join public.member_stats s on s.user_id = x.user_id
  where x.quest_id = p_quest and x.status <> 'rejected';

  return jsonb_build_object(
    'global', q.global_power,
    'total', public._quest_power(p_quest),
    'required', jsonb_build_object('intelligence', q.min_intelligence, 'strength', q.min_strength,
                                   'technique', q.min_technique, 'power', q.min_power),
    'met', public._quest_power_met(p_quest),
    'members', v_members,
    'settings', public.gacha_settings(),
    'balance', coalesce((select balance from public.wallets where user_id = v_uid), 0));
end;
$$;

-- ---------------------------------------------------------
-- 6. Tirage et choix des renforts.
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
  v_cur text := coalesce((select value from public.app_config where key = 'currency_plural'), 'zénis');
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if v_luck < 1 or v_luck > 10 then raise exception 'Le bonus de chance va de ×1 à ×10.'; end if;

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
    insert into public.quest_gacha_draws (quest_id, user_id, luck, cost) values (p_quest, v_uid, v_luck, v_cost);
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
  insert into public.quest_gacha_draws (quest_id, user_id, luck, cost, rank, card_id)
  values (p_quest, v_uid, v_luck, v_cost, v_rank, v_card.id);

  if v_rank in ('S', 'Divin') then
    insert into public.notifications (user_id, type, title, body, link)
    select qp.user_id, 'quest_gacha', 'Renfort ' || v_rank,
           coalesce((select nickname from public.profiles where id = v_uid), 'Un agent') || ' a recruté ' || v_card.name
           || ' (rang ' || v_rank || ') pour « ' || q.title || ' ».',
           '/dashboard/quests?quete=' || p_quest
    from public.quest_participants qp
    where qp.quest_id = p_quest and qp.user_id <> v_uid and qp.status <> 'rejected';
  end if;

  return jsonb_build_object('rank', v_rank, 'cost', v_cost, 'choose', not v_card.kept,
    'card', jsonb_build_object('id', v_card.id, 'rank', v_card.rank, 'name', v_card.name,
                               'intelligence', v_card.intelligence, 'strength', v_card.strength,
                               'technique', v_card.technique, 'power', v_card.power, 'kept', v_card.kept),
    'balance', (select balance from public.wallets where user_id = v_uid));
end;
$$;

-- Garder au plus trois renforts sur la quête ; les autres disparaissent.
create or replace function public.quest_cards_keep(p_quest uuid, p_keep uuid[])
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_keep uuid[] := array(select distinct x from unnest(coalesce(p_keep, '{}')) x);
  v_removed int;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if cardinality(v_keep) > 3 then raise exception 'Trois renforts au plus par quête.'; end if;
  if cardinality(v_keep) = 0 and exists (select 1 from public.quest_cards where quest_id = p_quest and user_id = v_uid) then
    raise exception 'Garde au moins un renfort.';
  end if;
  if exists (select 1 from unnest(v_keep) k
             where not exists (select 1 from public.quest_cards c
                               where c.id = k and c.quest_id = p_quest and c.user_id = v_uid)) then
    raise exception 'Renfort introuvable.';
  end if;

  delete from public.quest_cards
  where quest_id = p_quest and user_id = v_uid and not (id = any (v_keep));
  get diagnostics v_removed = row_count;
  update public.quest_cards set kept = true
  where quest_id = p_quest and user_id = v_uid and id = any (v_keep) and not kept;
  return jsonb_build_object('kept', cardinality(v_keep), 'removed', v_removed);
end;
$$;

-- ---------------------------------------------------------
-- 7. Prérequis : une quête globale se prend sans prérequis personnels.
-- ---------------------------------------------------------
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
  v_here uuid;
  v_moving boolean;
  v_place text;
begin
  -- Un responsable des quêtes qui inscrit quelqu'un d'autre passe outre.
  if new.user_id <> auth.uid() and public.has_permission(auth.uid(), 'manage_quests') then
    return new;
  end if;

  select * into v_q from public.quests where id = new.quest_id;
  if v_q.id is null then
    return new;
  end if;

  -- Être sur le lieu de la quête.
  if v_q.place_id is not null and to_regclass('public.character_positions') is not null then
    execute 'select place_id, (travel_started_at is not null or flight_target_place_id is not null) from public.character_positions where user_id = $1'
      into v_here, v_moving using new.user_id;
    if v_here is distinct from v_q.place_id or coalesce(v_moving, false) then
      begin
        execute 'select name from public.map_places where id = $1' into v_place using v_q.place_id;
      exception when others then v_place := null;
      end;
      raise exception 'Cette quête se prend sur place : rends-toi d''abord à %.', coalesce(v_place, 'son lieu');
    end if;
  end if;

  -- Puissance globale : les prérequis se comptent à plusieurs.
  if v_q.global_power then
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

-- ---------------------------------------------------------
-- 8. Rapport : pas avant que la puissance soit réunie.
-- ---------------------------------------------------------
create or replace function public.submit_quest_report_parts(p_quest_id uuid, p_parts text[], p_summary text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_part public.quest_participants;
  v_quest public.quests;
  v_nick text;
  v_n int;
  v_parts text[] := array[]::text[];
  v_summary text := nullif(btrim(coalesce(p_summary, '')), '');
  v_text text;
  v_full text;
  i int;
begin
  if v_uid is null then return jsonb_build_object('error', 'not_authenticated'); end if;
  select * into v_part from public.quest_participants where quest_id = p_quest_id and user_id = v_uid;
  if v_part.quest_id is null then return jsonb_build_object('error', 'not_participant'); end if;
  if v_part.status = 'rejected' then return jsonb_build_object('error', 'rejected'); end if;
  select * into v_quest from public.quests where id = p_quest_id;
  if v_quest.global_power and v_part.report is null and not public._quest_power_met(p_quest_id) then
    return jsonb_build_object('error', 'power_not_met');
  end if;
  v_n := coalesce(cardinality(v_quest.objectives), 0);

  for i in 1 .. v_n loop
    v_text := btrim(coalesce(p_parts[i], ''));
    if char_length(v_text) > 2000 then return jsonb_build_object('error', 'part_too_long', 'index', i - 1); end if;
    v_parts := v_parts || v_text;
  end loop;
  if v_summary is not null and char_length(v_summary) > 4000 then return jsonb_build_object('error', 'too_long'); end if;

  -- Texte complet : « ◆ mission » puis sa partie, pour chaque mission racontée, puis le bilan.
  select concat_ws(E'\n\n',
           (select string_agg('◆ ' || o.obj || E'\n' || p.txt, E'\n\n' order by o.i)
              from unnest(v_quest.objectives) with ordinality as o(obj, i)
              join unnest(v_parts) with ordinality as p(txt, i) using (i)
             where p.txt <> ''),
           v_summary)
    into v_full;
  -- Au moins 20 caractères écrits par le membre (les titres des missions ne comptent pas).
  if coalesce((select sum(char_length(x)) from unnest(v_parts) x), 0) + char_length(coalesce(v_summary, '')) < 20 then
    return jsonb_build_object('error', 'too_short');
  end if;

  update public.quest_participants
     set report = v_full,
         report_parts = v_parts,
         report_summary = v_summary,
         report_at = now(),
         status = case when status = 'assigned' then 'submitted' else status end
   where quest_id = p_quest_id and user_id = v_uid;

  select nickname into v_nick from public.profiles where id = v_uid;
  if v_quest.created_by is not null and v_quest.created_by <> v_uid and v_part.report is null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_quest.created_by, 'quest_report', 'Rapport de mission reçu',
            coalesce(v_nick, 'Un agent') || ' a rendu son rapport : « ' || v_quest.title || ' ».',
            '/dashboard/quests?quete=' || p_quest_id);
  end if;
  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------
-- 9. Droits.
-- ---------------------------------------------------------
revoke execute on function public._gacha_odds(numeric, numeric, numeric) from public, anon;
revoke execute on function public._gacha_cost(numeric) from public, anon;
revoke execute on function public._gacha_name(text) from public, anon, authenticated;
revoke execute on function public._gacha_stat(text) from public, anon, authenticated;
revoke execute on function public._quest_power(uuid) from public, anon;
revoke execute on function public._quest_power_met(uuid) from public, anon;
revoke execute on function public.gacha_settings() from public, anon;
revoke execute on function public.gacha_settings_set(numeric, numeric, numeric) from public, anon;
revoke execute on function public.quest_power(uuid) from public;
revoke execute on function public.quest_gacha_draw(uuid, numeric) from public, anon;
revoke execute on function public.quest_cards_keep(uuid, uuid[]) from public, anon;
grant execute on function public._gacha_odds(numeric, numeric, numeric) to authenticated;
grant execute on function public.gacha_settings() to authenticated;
grant execute on function public.gacha_settings_set(numeric, numeric, numeric) to authenticated;
grant execute on function public.quest_power(uuid) to anon, authenticated;
grant execute on function public.quest_gacha_draw(uuid, numeric) to authenticated;
grant execute on function public.quest_cards_keep(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
