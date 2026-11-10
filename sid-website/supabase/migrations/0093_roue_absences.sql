-- =====================================================================
-- 0093 — Lot 76 : roue du jour, pénalité d'absence
-- =====================================================================
-- Rejouable. Toutes les modifications ont un WHERE (safeupdate, cf. 0092).
--
-- 1. Série de jours : jours consécutifs avec au moins une visite
--    (activity_log, jour de Paris). Le jour même compte dès qu'on est là.
--
-- 2. Roue du jour : un tour par jour (minuit, heure de Paris).
--    Les gains sont définis par les admins (wheel_prizes) :
--    zénis, renommée, objet de la boutique, titre ou rien.
--    Chaque gain a deux poids : weight_start au 1er jour de série,
--    weight_max à partir de wheel_streak_cap jours (30 par défaut). Entre
--    les deux, le poids évolue en ligne droite. La probabilité vaut
--    poids ÷ somme des poids des gains disponibles. Un admin augmente donc
--    les chances d'un gain rare avec la série en lui donnant un
--    weight_max plus grand que son weight_start.
--    Un gain peut aussi n'apparaître qu'à partir d'une série minimale
--    (min_streak). Un objet épuisé, ou un titre déjà au niveau maximum,
--    sort de la roue.
--    Les montants en zénis suivent les réformes monétaires (indice « prix »).
--
-- 3. Absence prolongée : quand un membre actif n'est pas venu depuis k
--    jours complets et que k ≥ inactivity_grace_days (7), il perd
--    inactivity_daily_rate (200) × k zénis pour ce jour-là. Soit 1 400 z
--    pour le 7e jour, 1 600 z pour le 8e, et ainsi de suite.
--    L'argent est pris dans cet ordre :
--      a. actions (cours du jour, la plus grosse ligne d'abord). Les ordres
--         ouverts sont annulés, les actions reviennent à l'entreprise ;
--      b. épargne en banque ;
--      c. solde ;
--      d. dette (principal d'emprunt, intérêts habituels).
--    Les parts b à d vont dans la caisse commune.
--    Avertissements à 5 et 6 jours d'absence (notification et push).
--    L'absence se compte à partir de inactivity_start_day, le jour de cette
--    migration : personne n'est pénalisé pour une absence plus ancienne.
--    Un admin peut dispenser un membre jusqu'à une date
--    (inactivity_exemptions).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Réglages, type de notification
-- ---------------------------------------------------------------------
insert into public.app_config (key, value) values
  ('wheel_enabled', 'on'),
  ('wheel_streak_cap', '30'),
  ('inactivity_enabled', 'on'),
  ('inactivity_grace_days', '7'),
  ('inactivity_daily_rate', '200'),
  ('inactivity_start_day', ((now() at time zone public.stats_timezone())::date)::text)
on conflict (key) do nothing;

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
  if 'absence' = any (v_types) then return; end if;
  v_types := array_append(v_types, 'absence');
  alter table public.notifications drop constraint notifications_type_check;
  execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_types);
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Série de jours
-- ---------------------------------------------------------------------
create or replace function public._local_today()
returns date
language sql stable security definer set search_path = public
as $$
  select (now() at time zone public.stats_timezone())::date;
$$;

-- Jours consécutifs de visite jusqu'à aujourd'hui (aujourd'hui compte : on est là).
create or replace function public.member_streak(p_user uuid)
returns int
language plpgsql stable security definer set search_path = public
as $$
declare
  d date := public._local_today() - 1;
  n int := 1;
begin
  if p_user is null then return 0; end if;
  while n < 1000 and exists (select 1 from public.activity_log where user_id = p_user and day = d) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Roue du jour
-- ---------------------------------------------------------------------
create table if not exists public.wheel_prizes (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 40),
  kind text not null check (kind in ('zeni', 'renommee', 'objet', 'titre', 'rien')),
  amount numeric(18, 2) not null default 0 check (amount >= 0),
  amount_set_at timestamptz not null default now(),
  item_id uuid references public.shop_items(id) on delete set null,
  title_id text references public.titles(id) on delete set null,
  rarity text not null default 'commun' check (rarity in ('commun', 'rare', 'epique', 'legendaire')),
  weight_start numeric(10, 3) not null default 10 check (weight_start >= 0),
  weight_max numeric(10, 3) not null default 10 check (weight_max >= 0),
  min_streak int not null default 1 check (min_streak between 1 and 365),
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.wheel_prizes enable row level security;

create table if not exists public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  streak int not null,
  prize_id uuid references public.wheel_prizes(id) on delete set null,
  label text not null,
  kind text not null,
  rarity text not null,
  amount numeric(18, 2),
  detail text,
  probability numeric(9, 6),
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists wheel_spins_created_idx on public.wheel_spins (created_at desc);
alter table public.wheel_spins enable row level security;
drop policy if exists wheel_spins_own on public.wheel_spins;
create policy wheel_spins_own on public.wheel_spins for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

-- Gains de départ (seulement si la roue est vide).
insert into public.wheel_prizes (label, kind, amount, rarity, weight_start, weight_max, min_streak, sort)
select * from (values
  ('50 z', 'zeni', 50::numeric, 'commun', 30::numeric, 16::numeric, 1, 1),
  ('150 z', 'zeni', 150, 'commun', 22, 16, 1, 2),
  ('+5 renommée', 'renommee', 5, 'commun', 14, 10, 1, 3),
  ('Rien', 'rien', 0, 'commun', 16, 6, 1, 4),
  ('400 z', 'zeni', 400, 'rare', 10, 16, 1, 5),
  ('+20 renommée', 'renommee', 20, 'rare', 5, 10, 1, 6),
  ('1 500 z', 'zeni', 1500, 'epique', 2.5, 9, 3, 7),
  ('5 000 z', 'zeni', 5000, 'legendaire', 0.5, 4, 7, 8)
) v(label, kind, amount, rarity, weight_start, weight_max, min_streak, sort)
where not exists (select 1 from public.wheel_prizes);

-- Montant actuel d'un gain (les zénis suivent les réformes monétaires).
create or replace function public._wheel_amount(p public.wheel_prizes)
returns numeric
language sql stable security definer set search_path = public
as $$
  select case when p.kind = 'zeni' then round(p.amount * public._reform_factor_since(p.amount_set_at, 'prix'))
              else p.amount end;
$$;

-- Les gains et leurs chances pour une série donnée (p_user : exclut les titres déjà au maximum).
create or replace function public._wheel_table(p_user uuid, p_streak int)
returns table (
  id uuid, label text, kind text, amount numeric, rarity text, item_name text, title_name text,
  min_streak int, weight numeric, probability numeric, available boolean, reason text, sort int
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_cap int := greatest(2, public.get_config_numeric('wheel_streak_cap', 30)::int);
  t numeric := least(greatest((coalesce(p_streak, 1) - 1)::numeric / (v_cap - 1), 0), 1);
begin
  return query
  with base as (
    select w.id, w.label, w.kind, public._wheel_amount(w) as amount, w.rarity,
           si.name as item_name, ti.name as title_name, w.min_streak, w.sort, w.created_at,
           case
             when not w.is_active then 'désactivé'
             when coalesce(p_streak, 1) < w.min_streak then 'série de ' || w.min_streak || ' jours'
             when w.kind = 'objet' and (si.id is null or not si.is_active or si.hidden_at is not null) then 'objet indisponible'
             when w.kind = 'objet' and si.stock is not null and si.stock <= 0 then 'épuisé'
             when w.kind = 'titre' and ti.id is null then 'titre introuvable'
             when w.kind = 'titre' and p_user is not null and exists (
               select 1 from public.user_titles ut where ut.user_id = p_user and ut.title_id = ti.id and ut.level >= ti.max_level
             ) then 'déjà obtenu'
             when w.kind in ('zeni', 'renommee') and w.amount <= 0 then 'montant nul'
           end as reason,
           w.weight_start + (w.weight_max - w.weight_start) * t as wt
    from public.wheel_prizes w
    left join public.shop_items si on si.id = w.item_id
    left join public.titles ti on ti.id = w.title_id
  ), weighted as (
    select b.*, case when b.reason is null then greatest(b.wt, 0) else 0 end as w_eff from base b
  )
  select x.id, x.label, x.kind, x.amount, x.rarity, x.item_name, x.title_name, x.min_streak,
         round(x.w_eff, 3),
         case when sum(x.w_eff) over () > 0 then round(x.w_eff / sum(x.w_eff) over (), 6) else 0 end,
         x.reason is null and x.w_eff > 0,
         x.reason,
         x.sort
  from weighted x
  order by x.sort, x.created_at;
end;
$$;

create or replace function public._wheel_rows(p_user uuid, p_streak int, p_only_available boolean)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', w.id, 'label', w.label, 'kind', w.kind, 'amount', w.amount, 'rarity', w.rarity,
           'item', w.item_name, 'title', w.title_name, 'min_streak', w.min_streak,
           'probability', w.probability, 'available', w.available, 'reason', w.reason)
         order by w.sort), '[]'::jsonb)
  from public._wheel_table(p_user, p_streak) w
  where not p_only_available or w.available;
$$;

create or replace function public.wheel_status()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public._local_today();
  v_streak int;
  v_cap int := greatest(2, public.get_config_numeric('wheel_streak_cap', 30)::int);
  s public.wheel_spins;
  v_rare_now numeric;
  v_rare_1 numeric;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  v_streak := public.member_streak(v_uid);
  select * into s from public.wheel_spins where user_id = v_uid and day = v_today;
  select coalesce(sum(probability), 0) into v_rare_now from public._wheel_table(v_uid, v_streak) where rarity in ('epique', 'legendaire');
  select coalesce(sum(probability), 0) into v_rare_1 from public._wheel_table(v_uid, 1) where rarity in ('epique', 'legendaire');
  return jsonb_build_object(
    'enabled', coalesce((select value from public.app_config where key = 'wheel_enabled'), 'on') = 'on',
    'active', exists (select 1 from public.profiles where id = v_uid and status = 'active'),
    'available', s.id is null,
    'streak', v_streak,
    'cap', v_cap,
    'rare_now', v_rare_now,
    'rare_day1', v_rare_1,
    'prizes', public._wheel_rows(v_uid, v_streak, true),
    'tomorrow', public._wheel_rows(v_uid, v_streak + 1, true),
    -- Tableau des chances : tous les gains (verrouillés compris) et la série maximale.
    'all', public._wheel_rows(v_uid, v_streak, false),
    'at_cap', public._wheel_rows(v_uid, greatest(v_cap, v_streak), true),
    'today', case when s.id is null then null else jsonb_build_object(
      'prize_id', s.prize_id, 'label', s.label, 'kind', s.kind, 'rarity', s.rarity, 'amount', s.amount,
      'detail', s.detail, 'probability', s.probability, 'streak', s.streak) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object('day', h.day, 'label', h.label, 'kind', h.kind, 'rarity', h.rarity,
                                                             'amount', h.amount, 'streak', h.streak) order by h.day desc)
                         from (select * from public.wheel_spins where user_id = v_uid order by day desc limit 14) h), '[]'::jsonb),
    'next_reset', ((v_today + 1)::timestamp at time zone public.stats_timezone()));
end;
$$;

create or replace function public.wheel_spin()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public._local_today();
  v_streak int;
  v_total numeric;
  v_r numeric;
  v_acc numeric := 0;
  w record;
  p public.wheel_prizes;
  v_amount numeric;
  v_detail text;
  v_prob numeric;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if coalesce((select value from public.app_config where key = 'wheel_enabled'), 'on') <> 'on' then
    raise exception 'La roue du jour est fermée pour le moment.';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'La roue est réservée aux membres actifs.';
  end if;

  perform pg_advisory_xact_lock(hashtext('wheel:' || v_uid::text));
  if exists (select 1 from public.wheel_spins where user_id = v_uid and day = v_today) then
    raise exception 'Tu as déjà tourné la roue aujourd''hui. Reviens demain !';
  end if;

  -- Tourner la roue, c'est être venu aujourd'hui.
  insert into public.activity_log (user_id, day, visits) values (v_uid, v_today, 1)
  on conflict (user_id, day) do nothing;
  update public.profiles set last_seen_at = now() where id = v_uid;

  v_streak := public.member_streak(v_uid);
  select coalesce(sum(t.weight), 0) into v_total from public._wheel_table(v_uid, v_streak) t where t.available;
  if v_total <= 0 then raise exception 'La roue est vide pour le moment.'; end if;

  v_r := random() * v_total;
  for w in select * from public._wheel_table(v_uid, v_streak) t where t.available order by t.sort loop
    v_acc := v_acc + w.weight;
    if v_r < v_acc then exit; end if;
  end loop;
  select * into p from public.wheel_prizes where id = w.id;
  v_amount := w.amount;
  -- Nom au moment du tour (les montants suivent les réformes).
  p.label := case p.kind when 'zeni' then public._fmt_z(v_amount) || ' z'
                         when 'renommee' then '+' || round(v_amount)::text || ' renommée'
                         else p.label end;
  v_prob := w.probability;

  if p.kind = 'zeni' then
    update public.wallets set balance = balance + v_amount where user_id = v_uid;
    insert into public.transactions (user_id, amount, reason) values (v_uid, v_amount, 'Roue du jour : ' || p.label);
  elsif p.kind = 'renommee' then
    perform public._add_reputation(v_uid, v_amount::int, 'Roue du jour', null, null);
  elsif p.kind = 'objet' then
    update public.shop_items set stock = stock - 1 where id = p.item_id and stock is not null and stock > 0;
    insert into public.purchases (item_id, user_id, quantity, total_price, status, gift_message)
    values (p.item_id, v_uid, 1, 0, 'pending', 'Gagné à la roue du jour');
    v_detail := w.item_name;
  elsif p.kind = 'titre' then
    v_detail := public.grant_title(v_uid, p.title_id, 'roue');
  end if;

  insert into public.wheel_spins (user_id, day, streak, prize_id, label, kind, rarity, amount, detail, probability)
  values (v_uid, v_today, v_streak, p.id, p.label, p.kind, p.rarity,
          case when p.kind in ('zeni', 'renommee') then v_amount end, v_detail, v_prob);

  return jsonb_build_object('prize_id', p.id, 'label', p.label, 'kind', p.kind, 'rarity', p.rarity,
                            'amount', case when p.kind in ('zeni', 'renommee') then v_amount end,
                            'detail', v_detail, 'probability', v_prob, 'streak', v_streak);
end;
$$;

-- Administration
create or replace function public._wheel_require_admin()
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Réservé à la gestion de l''économie.';
  end if;
end;
$$;

create or replace function public.wheel_admin()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_cap int := greatest(2, public.get_config_numeric('wheel_streak_cap', 30)::int);
begin
  perform public._wheel_require_admin();
  return jsonb_build_object(
    'enabled', coalesce((select value from public.app_config where key = 'wheel_enabled'), 'on') = 'on',
    'cap', v_cap,
    'prizes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', w.id, 'label', w.label, 'kind', w.kind, 'amount', public._wheel_amount(w), 'item_id', w.item_id, 'title_id', w.title_id,
               'rarity', w.rarity, 'weight_start', w.weight_start, 'weight_max', w.weight_max, 'min_streak', w.min_streak,
               'is_active', w.is_active, 'sort', w.sort,
               'p1', (select t.probability from public._wheel_table(null, 1) t where t.id = w.id),
               'p7', (select t.probability from public._wheel_table(null, 7) t where t.id = w.id),
               'pcap', (select t.probability from public._wheel_table(null, v_cap) t where t.id = w.id),
               'won_30', (select count(*) from public.wheel_spins s where s.prize_id = w.id and s.created_at > now() - interval '30 days'))
             order by w.sort, w.created_at)
      from public.wheel_prizes w), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'stock', i.stock) order by i.name)
                       from public.shop_items i where i.is_active and i.hidden_at is null), '[]'::jsonb),
    'titles', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.sort) from public.titles t), '[]'::jsonb),
    'stats', jsonb_build_object(
      'spins_today', (select count(*) from public.wheel_spins where day = public._local_today()),
      'spins_30', (select count(*) from public.wheel_spins where created_at > now() - interval '30 days'),
      'zeni_30', (select coalesce(sum(amount), 0) from public.wheel_spins where kind = 'zeni' and created_at > now() - interval '30 days'),
      'by_rarity_30', coalesce((select jsonb_object_agg(rarity, n) from (
                         select rarity, count(*) n from public.wheel_spins where created_at > now() - interval '30 days' group by rarity) x), '{}'::jsonb),
      'top_streaks', coalesce((select jsonb_agg(jsonb_build_object('nickname', x.nickname, 'streak', x.streak) order by x.streak desc)
                               from (select p.nickname, public.member_streak(p.id) as streak
                                     from public.profiles p
                                     where p.status = 'active'
                                       and exists (select 1 from public.activity_log a where a.user_id = p.id and a.day >= public._local_today() - 1)
                                     order by 2 desc limit 5) x), '[]'::jsonb),
      'recent', coalesce((select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'label', s.label, 'rarity', s.rarity, 'streak', s.streak,
                                                              'at', s.created_at) order by s.created_at desc)
                          from (select * from public.wheel_spins order by created_at desc limit 12) s
                          join public.profiles p on p.id = s.user_id), '[]'::jsonb)));
end;
$$;

create or replace function public.wheel_prize_save(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_kind text := p->>'kind';
  v_label text := nullif(trim(p->>'label'), '');
  v_auto text;
  v_amount numeric := coalesce((p->>'amount')::numeric, 0);
  v_item uuid := nullif(p->>'item_id', '')::uuid;
  v_title text := nullif(p->>'title_id', '');
  v_ws numeric := coalesce((p->>'weight_start')::numeric, 0);
  v_wm numeric := coalesce((p->>'weight_max')::numeric, v_ws);
  v_old public.wheel_prizes;
begin
  perform public._wheel_require_admin();
  -- Zénis et renommée : le nom suit le montant (et donc les réformes).
  v_auto := case v_kind
              when 'zeni' then public._fmt_z(v_amount) || ' z'
              when 'renommee' then '+' || round(v_amount)::text || ' renommée'
              when 'objet' then (select left(name, 40) from public.shop_items where id = v_item)
              when 'titre' then (select left(name, 40) from public.titles where id = v_title)
              when 'rien' then 'Rien' end;
  if v_kind in ('zeni', 'renommee') or v_label is null then v_label := v_auto; end if;
  if v_label is null or char_length(v_label) > 40 then raise exception 'Nom du gain : 1 à 40 caractères.'; end if;
  if v_kind not in ('zeni', 'renommee', 'objet', 'titre', 'rien') then raise exception 'Type de gain inconnu.'; end if;
  if v_kind in ('zeni', 'renommee') and (v_amount <= 0 or v_amount > 100000000) then raise exception 'Indique un montant positif.'; end if;
  if v_kind = 'renommee' and v_amount <> round(v_amount) then raise exception 'La renommée se compte en points entiers.'; end if;
  if v_kind = 'objet' and not exists (select 1 from public.shop_items where id = v_item) then raise exception 'Choisis un objet de la boutique.'; end if;
  if v_kind = 'titre' and not exists (select 1 from public.titles where id = v_title) then raise exception 'Choisis un titre.'; end if;
  if v_ws < 0 or v_wm < 0 or v_ws > 100000 or v_wm > 100000 then raise exception 'Poids entre 0 et 100 000.'; end if;
  if v_ws = 0 and v_wm = 0 and coalesce((p->>'is_active')::boolean, true) then raise exception 'Un gain actif doit avoir au moins un poids non nul.'; end if;

  if v_id is not null then
    select * into v_old from public.wheel_prizes where id = v_id for update;
    if v_old.id is null then raise exception 'Gain introuvable.'; end if;
    update public.wheel_prizes set
      label = v_label, kind = v_kind,
      amount = case when v_kind in ('zeni', 'renommee') then v_amount else 0 end,
      -- Le montant envoyé est le montant actuel (réformes comprises) : les
      -- prochaines réformes comptent à partir de maintenant.
      amount_set_at = now(),
      item_id = case when v_kind = 'objet' then v_item end,
      title_id = case when v_kind = 'titre' then v_title end,
      rarity = coalesce(nullif(p->>'rarity', ''), rarity),
      weight_start = v_ws, weight_max = v_wm,
      min_streak = greatest(1, least(365, coalesce((p->>'min_streak')::int, 1))),
      is_active = coalesce((p->>'is_active')::boolean, true),
      sort = coalesce((p->>'sort')::int, sort),
      updated_at = now(), updated_by = auth.uid()
    where id = v_id;
  else
    insert into public.wheel_prizes (label, kind, amount, item_id, title_id, rarity, weight_start, weight_max, min_streak, is_active, sort, updated_by)
    values (v_label, v_kind, case when v_kind in ('zeni', 'renommee') then v_amount else 0 end,
            case when v_kind = 'objet' then v_item end, case when v_kind = 'titre' then v_title end,
            coalesce(nullif(p->>'rarity', ''), 'commun'), v_ws, v_wm,
            greatest(1, least(365, coalesce((p->>'min_streak')::int, 1))),
            coalesce((p->>'is_active')::boolean, true),
            coalesce((p->>'sort')::int, (select coalesce(max(sort), 0) + 1 from public.wheel_prizes)),
            auth.uid())
    returning id into v_id;
  end if;
  perform public.write_audit('wheel_prize_saved', null, jsonb_build_object('id', v_id, 'label', v_label, 'kind', v_kind, 'amount', v_amount,
                                                                           'weight_start', v_ws, 'weight_max', v_wm));
  return v_id;
end;
$$;

create or replace function public.wheel_prize_delete(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_label text;
begin
  perform public._wheel_require_admin();
  delete from public.wheel_prizes where id = p_id returning label into v_label;
  if v_label is not null then
    perform public.write_audit('wheel_prize_deleted', null, jsonb_build_object('id', p_id, 'label', v_label));
  end if;
end;
$$;

create or replace function public.wheel_settings_save(p_enabled boolean, p_cap int)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public._wheel_require_admin();
  if p_cap is not null and (p_cap < 2 or p_cap > 365) then raise exception 'Série maximale : entre 2 et 365 jours.'; end if;
  if p_enabled is not null then
    insert into public.app_config (key, value) values ('wheel_enabled', case when p_enabled then 'on' else 'off' end)
    on conflict (key) do update set value = excluded.value;
  end if;
  if p_cap is not null then perform public._cfg_set('wheel_streak_cap', p_cap); end if;
  perform public.write_audit('wheel_settings', null, jsonb_build_object('enabled', p_enabled, 'cap', p_cap));
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Absence prolongée
-- ---------------------------------------------------------------------
create table if not exists public.inactivity_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  days_absent int not null,
  amount numeric(18, 2) not null,
  from_shares numeric(18, 2) not null default 0,
  shares jsonb not null default '[]'::jsonb,
  from_savings numeric(18, 2) not null default 0,
  from_wallet numeric(18, 2) not null default 0,
  to_debt numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists inactivity_charges_created_idx on public.inactivity_charges (created_at desc);
alter table public.inactivity_charges enable row level security;
drop policy if exists inactivity_charges_read on public.inactivity_charges;
create policy inactivity_charges_read on public.inactivity_charges for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

create table if not exists public.inactivity_exemptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  until date not null,
  reason text check (reason is null or char_length(reason) <= 200),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.inactivity_exemptions enable row level security;
drop policy if exists inactivity_exemptions_read on public.inactivity_exemptions;
create policy inactivity_exemptions_read on public.inactivity_exemptions for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

-- Dernier jour de présence au plus tard le jour p_day (jamais avant inactivity_start_day).
create or replace function public._member_last_active(p_user uuid, p_day date)
returns date
language sql stable security definer set search_path = public
as $$
  select greatest(
    (select max(a.day) from public.activity_log a where a.user_id = p_user and a.day <= p_day),
    (select (p.created_at at time zone public.stats_timezone())::date from public.profiles p where p.id = p_user),
    coalesce((select value::date from public.app_config where key = 'inactivity_start_day'), p_day));
$$;

-- Prélève p_amount : actions, épargne, solde, puis dette. Renvoie le détail.
create or replace function public._inactivity_take(p_user uuid, p_amount numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_left numeric := round(p_amount, 2);
  v_shares numeric := 0;
  v_list jsonb := '[]'::jsonb;
  v_sav numeric := 0;
  v_wal numeric := 0;
  v_debt numeric := 0;
  h record;
  o record;
  r record;
  q int;
  v_val numeric;
  v_change numeric;
  v_take int;
  v_rest int;
  v_bal numeric;
begin
  -- a. Actions : ordres ouverts annulés, puis la plus grosse ligne d'abord.
  for o in select id from public.market_orders where trader = 'membre' and user_id = p_user and status = 'open' loop
    perform public._market_close_order(o.id, 'cancelled', 'Annulé : absence prolongée');
  end loop;

  for h in
    select bs.business_id, bs.quantity, b.share_price, b.name, b.treasury_balance
    from public.business_shareholders bs
    join public.businesses b on b.id = bs.business_id
    where bs.user_id = p_user and bs.quantity > 0 and not b.is_closed and b.share_price > 0
    order by bs.quantity * b.share_price desc
  loop
    exit when v_left <= 0;
    q := least(h.quantity, ceil(v_left / h.share_price)::int);
    v_val := round(q * h.share_price, 2);
    v_change := greatest(v_val - v_left, 0);
    -- La dernière action vaut plus que le reste dû : l'entreprise rend la
    -- monnaie si sa trésorerie le permet, sinon on garde cette action.
    if v_change > 0 and h.treasury_balance < v_change then
      q := q - 1;
      v_val := round(q * h.share_price, 2);
      v_change := 0;
    end if;
    continue when q <= 0;

    update public.business_shareholders set quantity = quantity - q, locked = least(locked, quantity - q)
    where business_id = h.business_id and user_id = p_user;
    delete from public.business_shareholders where business_id = h.business_id and user_id = p_user and quantity <= 0;
    update public.businesses set shares_in_treasury = shares_in_treasury + q, treasury_balance = treasury_balance - v_change
    where id = h.business_id;
    if v_change > 0 then
      update public.wallets set balance = balance + v_change where user_id = p_user;
      insert into public.business_transactions (business_id, amount, reason)
      values (h.business_id, -v_change, 'Monnaie rendue sur des actions saisies (absence prolongée)');
    end if;
    -- Lots, du plus ancien au plus récent.
    v_rest := q;
    for r in select id, quantity from public.business_share_lots
             where business_id = h.business_id and user_id = p_user order by bought_at, id loop
      exit when v_rest <= 0;
      v_take := least(v_rest, r.quantity);
      if v_take = r.quantity then delete from public.business_share_lots where id = r.id;
      else update public.business_share_lots set quantity = quantity - v_take where id = r.id; end if;
      v_rest := v_rest - v_take;
    end loop;

    v_shares := v_shares + (v_val - v_change);
    v_left := greatest(round(v_left - (v_val - v_change), 2), 0);
    v_list := v_list || jsonb_build_object('business_id', h.business_id, 'name', h.name, 'quantity', q, 'price', h.share_price);
  end loop;

  -- b. Épargne
  if v_left > 0 then
    select balance into v_bal from public.bank_accounts where user_id = p_user for update;
    v_sav := least(greatest(coalesce(v_bal, 0), 0), v_left);
    if v_sav > 0 then
      update public.bank_accounts set balance = balance - v_sav where user_id = p_user;
      v_left := round(v_left - v_sav, 2);
    end if;
  end if;

  -- c. Solde
  if v_left > 0 then
    select balance into v_bal from public.wallets where user_id = p_user for update;
    v_wal := least(greatest(coalesce(v_bal, 0), 0), v_left);
    if v_wal > 0 then
      update public.wallets set balance = balance - v_wal where user_id = p_user;
      v_left := round(v_left - v_wal, 2);
    end if;
  end if;

  -- d. Dette : un emprunt forcé, avec les intérêts habituels.
  if v_left > 0 then
    v_debt := v_left;
    insert into public.wallets (user_id, balance) values (p_user, 0) on conflict (user_id) do nothing;
    update public.wallets set debt_principal = debt_principal + v_debt,
                              last_debt_interest_at = coalesce(last_debt_interest_at, now())
    where user_id = p_user;
  end if;

  if v_sav + v_wal + v_debt > 0 then
    update public.tax_pool set balance = balance + v_sav + v_wal + v_debt where id = true;
  end if;
  return jsonb_build_object('shares', v_shares, 'list', v_list, 'savings', v_sav, 'wallet', v_wal, 'debt', v_debt);
end;
$$;

create or replace function public._fmt_shares(p jsonb)
returns text
language sql immutable
as $$
  select string_agg((x->>'quantity') || ' ' || (x->>'name'), ', ')
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) x;
$$;

-- Traite un jour terminé (p_day) pour tous les membres.
create or replace function public._inactivity_day(p_day date, p_notify boolean)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_grace int := greatest(1, public.get_config_numeric('inactivity_grace_days', 7)::int);
  v_rate numeric := greatest(0, public.get_config_numeric('inactivity_daily_rate', 200));
  m record;
  k int;
  v_amount numeric;
  d jsonb;
  v_parts text[];
  n int := 0;
begin
  for m in
    select p.id, public._member_last_active(p.id, p_day) as last_day
    from public.profiles p
    where p.status = 'active'
      and not public.is_sandbox_account(p.id)
      and not exists (select 1 from public.inactivity_exemptions e where e.user_id = p.id and e.until >= p_day)
  loop
    k := p_day - m.last_day;
    if k >= v_grace and v_rate > 0 then
      continue when exists (select 1 from public.inactivity_charges where user_id = m.id and day = p_day);
      v_amount := round(v_rate * k, 2);
      d := public._inactivity_take(m.id, v_amount);
      insert into public.inactivity_charges (user_id, day, days_absent, amount, from_shares, shares, from_savings, from_wallet, to_debt)
      values (m.id, p_day, k, v_amount, (d->>'shares')::numeric, d->'list', (d->>'savings')::numeric, (d->>'wallet')::numeric, (d->>'debt')::numeric);
      if (d->>'wallet')::numeric > 0 then
        insert into public.transactions (user_id, amount, reason)
        values (m.id, -(d->>'wallet')::numeric, 'Absence prolongée : ' || k || ' jours sans visite');
      end if;
      v_parts := array_remove(array[
        case when (d->>'shares')::numeric > 0 then 'actions (' || public._fmt_shares(d->'list') || ') ' || public._fmt_z((d->>'shares')::numeric) || ' z' end,
        case when (d->>'savings')::numeric > 0 then 'épargne ' || public._fmt_z((d->>'savings')::numeric) || ' z' end,
        case when (d->>'wallet')::numeric > 0 then 'solde ' || public._fmt_z((d->>'wallet')::numeric) || ' z' end,
        case when (d->>'debt')::numeric > 0 then 'dette ' || public._fmt_z((d->>'debt')::numeric) || ' z' end], null);
      if p_notify then
        insert into public.notifications (user_id, type, title, body, link)
        values (m.id, 'absence', 'Absence prolongée : −' || public._fmt_z(v_amount) || ' z',
                k || ' jours sans visite. Pris sur : ' || array_to_string(v_parts, ', ') || '. Demain : −'
                  || public._fmt_z(round(v_rate * (k + 1), 2)) || ' z si tu ne passes pas.',
                '/dashboard/bank');
      end if;
      n := n + 1;
    elsif p_notify and v_rate > 0 and k between v_grace - 2 and v_grace - 1 then
      insert into public.notifications (user_id, type, title, body, link)
      values (m.id, 'absence',
              case when k = v_grace - 1 then 'Dernier jour avant la pénalité d''absence' else 'Le S.I.D. s''inquiète de ton absence' end,
              k || ' jours sans visite. À partir de ' || v_grace || ' jours, chaque jour d''absence coûte '
                || public._fmt_z(v_rate) || ' z × le nombre de jours (' || public._fmt_z(v_rate * v_grace) || ' z, puis '
                || public._fmt_z(v_rate * (v_grace + 1)) || ' z…), pris sur tes actions, ton épargne, ton solde, puis en dette. '
                || 'Une visite suffit à tout arrêter.',
              '/dashboard');
    end if;
  end loop;
  return n;
end;
$$;

-- Jours terminés depuis le dernier passage (au plus 60), une fois par jour.
create or replace function public.process_inactivity()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_today date := public._local_today();
  v_last date := coalesce((select value::date from public.app_config where key = 'inactivity_last_day'), v_today - 2);
  d date;
  n int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('process_inactivity'));
  v_last := coalesce((select value::date from public.app_config where key = 'inactivity_last_day'), v_today - 2);
  if coalesce((select value from public.app_config where key = 'inactivity_enabled'), 'on') <> 'on' then
    insert into public.app_config (key, value) values ('inactivity_last_day', (v_today - 1)::text)
    on conflict (key) do update set value = excluded.value;
    return jsonb_build_object('actif', false);
  end if;
  d := greatest(v_last + 1, v_today - 60);
  while d <= v_today - 1 loop
    -- Les notifications ne partent que pour la veille (pas pour un rattrapage ancien).
    n := n + public._inactivity_day(d, d = v_today - 1);
    insert into public.app_config (key, value) values ('inactivity_last_day', d::text)
    on conflict (key) do update set value = excluded.value;
    d := d + 1;
  end loop;
  return jsonb_build_object('prelevements', n);
end;
$$;

-- Pour le membre : sa situation.
create or replace function public.my_inactivity()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return null; end if;
  return jsonb_build_object(
    'enabled', coalesce((select value from public.app_config where key = 'inactivity_enabled'), 'on') = 'on',
    'grace', public.get_config_numeric('inactivity_grace_days', 7),
    'rate', public.get_config_numeric('inactivity_daily_rate', 200),
    'exempt_until', (select until from public.inactivity_exemptions where user_id = v_uid),
    'total_30', (select coalesce(sum(amount), 0) from public.inactivity_charges where user_id = v_uid and day > public._local_today() - 30),
    'charges', coalesce((select jsonb_agg(jsonb_build_object('day', c.day, 'days', c.days_absent, 'amount', c.amount, 'shares', c.from_shares,
                                                            'list', c.shares, 'savings', c.from_savings, 'wallet', c.from_wallet, 'debt', c.to_debt)
                                          order by c.day desc)
                         from (select * from public.inactivity_charges where user_id = v_uid order by day desc limit 20) c), '[]'::jsonb));
end;
$$;

-- Administration
create or replace function public.inactivity_admin()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_today date := public._local_today();
  v_grace int := greatest(1, public.get_config_numeric('inactivity_grace_days', 7)::int);
  v_rate numeric := public.get_config_numeric('inactivity_daily_rate', 200);
begin
  perform public._wheel_require_admin();
  return jsonb_build_object(
    'enabled', coalesce((select value from public.app_config where key = 'inactivity_enabled'), 'on') = 'on',
    'grace', v_grace,
    'rate', v_rate,
    'start_day', (select value::date from public.app_config where key = 'inactivity_start_day'),
    'last_day', (select value::date from public.app_config where key = 'inactivity_last_day'),
    'members', coalesce((
      select jsonb_agg(x order by (x->>'days')::int desc, x->>'nickname')
      from (
        select jsonb_build_object(
          'id', p.id, 'nickname', p.nickname,
          'last_day', l.last_day,
          'days', v_today - l.last_day,
          'next', case when v_today - l.last_day >= v_grace then round(v_rate * (v_today - l.last_day), 2) end,
          'exempt_until', e.until, 'exempt_reason', e.reason,
          'shares', coalesce((select sum(bs.quantity * b.share_price) from public.business_shareholders bs join public.businesses b on b.id = bs.business_id
                              where bs.user_id = p.id and not b.is_closed), 0),
          'savings', coalesce((select balance from public.bank_accounts where user_id = p.id), 0),
          'wallet', coalesce(w.balance, 0),
          'debt', coalesce(w.debt_principal, 0),
          'charged_30', (select coalesce(sum(amount), 0) from public.inactivity_charges c where c.user_id = p.id and c.day > v_today - 30)) as x
        from public.profiles p
        cross join lateral (select public._member_last_active(p.id, v_today) as last_day) l
        left join public.wallets w on w.user_id = p.id
        left join public.inactivity_exemptions e on e.user_id = p.id and e.until >= v_today
        where p.status = 'active' and not public.is_sandbox_account(p.id)
          and (v_today - l.last_day >= greatest(v_grace - 3, 1) or e.user_id is not null)
      ) y(x)), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'day', c.day, 'days', c.days_absent, 'amount', c.amount,
                                                            'shares', c.from_shares, 'savings', c.from_savings, 'wallet', c.from_wallet, 'debt', c.to_debt)
                                          order by c.created_at desc)
                         from (select * from public.inactivity_charges order by created_at desc limit 30) c
                         join public.profiles p on p.id = c.user_id), '[]'::jsonb),
    'total_30', (select coalesce(sum(amount), 0) from public.inactivity_charges where day > v_today - 30),
    'members_30', (select count(distinct user_id) from public.inactivity_charges where day > v_today - 30));
end;
$$;

create or replace function public.inactivity_settings_save(p_enabled boolean, p_grace int, p_rate numeric)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public._wheel_require_admin();
  if p_grace is not null and (p_grace < 1 or p_grace > 365) then raise exception 'Délai : entre 1 et 365 jours.'; end if;
  if p_rate is not null and (p_rate < 0 or p_rate > 1000000) then raise exception 'Montant par jour : entre 0 et 1 000 000 z.'; end if;
  if p_enabled is not null then
    insert into public.app_config (key, value) values ('inactivity_enabled', case when p_enabled then 'on' else 'off' end)
    on conflict (key) do update set value = excluded.value;
    -- Rallumée : on ne rattrape pas les jours où elle était coupée.
    if p_enabled then
      insert into public.app_config (key, value) values ('inactivity_last_day', (public._local_today() - 1)::text)
      on conflict (key) do update set value = excluded.value;
    end if;
  end if;
  if p_grace is not null then perform public._cfg_set('inactivity_grace_days', p_grace); end if;
  if p_rate is not null then perform public._cfg_set('inactivity_daily_rate', p_rate); end if;
  perform public.write_audit('inactivity_settings', null, jsonb_build_object('enabled', p_enabled, 'grace', p_grace, 'rate', p_rate));
end;
$$;

create or replace function public.inactivity_exempt(p_user uuid, p_until date, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public._wheel_require_admin();
  if p_until is null then
    delete from public.inactivity_exemptions where user_id = p_user;
  else
    if p_until < public._local_today() then raise exception 'La date de fin est passée.'; end if;
    insert into public.inactivity_exemptions (user_id, until, reason, created_by)
    values (p_user, p_until, nullif(trim(p_reason), ''), auth.uid())
    on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, created_by = excluded.created_by, created_at = now();
  end if;
  perform public.write_audit('inactivity_exempt', p_user, jsonb_build_object('until', p_until, 'reason', p_reason));
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Branchements
-- ---------------------------------------------------------------------

-- Tâches planifiées : absences chaque jour (reprise de 0084_economie_reelle.sql).
create or replace function public.run_scheduled_jobs()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
  v_last timestamptz;
begin
  v := v || jsonb_build_object('sondages', public.polls_publish_due());
  v := v || jsonb_build_object('rappels', public.auctions_remind_due());
  v := v || jsonb_build_object('encheres', public.auctions_settle_due());
  v := v || jsonb_build_object('bourse', public.process_market());

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

  -- Absences (Lot 76) : jours terminés, une fois par jour.
  select value::timestamptz into v_last from public.app_config where key = 'inactivity_last_run';
  if v_last is null or (v_last at time zone public.stats_timezone())::date < public._local_today() then
    perform public._cfg_set_ts('inactivity_last_run');
    v := v || jsonb_build_object('absences', public.process_inactivity());
  end if;
  return v;
end;
$$;

-- Pas de notification « Argent reçu » pour la roue (reprise de 0087_reforme_monetaire.sql).
create or replace function public.notify_money_received()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_line text;
begin
  if new.amount <= 0 then return new; end if;
  if new.reason like 'Retrait%' or new.reason like 'Dépôt en banque%' or new.reason like 'Faillite%' then return new; end if;
  if new.reason like 'Enchère %' or new.reason like 'Vente aux enchères%' then return new; end if;
  if new.reason like 'Réforme monétaire%' then return new; end if;
  -- Le gain s'affiche déjà sur la roue.
  if new.reason like 'Roue du jour%' then return new; end if;

  v_line := '+' || public._fmt_z(new.amount) || ' z — ' || coalesce(new.reason, 'Crédit');
  if new.reason like 'Salaire%' then
    insert into public.notifications (user_id, type, title, body) values (new.user_id, 'salary_paid', 'Salaire versé', v_line);
  elsif new.amount >= public.get_config_numeric('notif_group_threshold', 500) then
    insert into public.notifications (user_id, type, title, body) values (new.user_id, 'money_received', 'Argent reçu', v_line);
  else
    perform public._notify_grouped(new.user_id, 'money_received', 'petites-rentrees', 'Argent reçu', v_line, new.amount, 'rentrées', null);
  end if;
  return new;
end;
$$;

-- Réforme : la pénalité d'absence suit (reprise de 0092_safeupdate_objectif_auto.sql).
create or replace function public._reform_settings()
returns table (key text, def numeric, digits int, label text)
language sql stable security definer set search_path = public
as $$
  select t.key, t.def, t.digits, t.label from (values
    ('onboarding_reward', 1000::numeric, 0, 'Prime d''intégration', false),
    ('business_min_initial_investment', 500, 0, 'Mise de départ minimale d''une entreprise', false),
    ('market_admin_fee_per_share', 0.5, 4, 'Frais de bourse par action', false),
    ('notif_group_threshold', 500, 0, 'Seuil des notifications « Argent reçu »', false),
    ('alert_big_tx', 10000, 0, 'Alerte : gros mouvement', false),
    ('alert_daily_gain', 25000, 0, 'Alerte : gain sur 24 h', false),
    ('arena_price_player', 1000000, 0, 'Arène : place de joueur', false),
    ('arena_price_tribune', 5000000, 0, 'Arène : tribune', false),
    ('arena_price_finale', 5000000, 0, 'Arène : finale', false),
    ('business_min_weekly_revenue', 2000, 0, 'Chiffre d''affaires minimum par semaine (s''il est fixe)', false),
    ('inactivity_daily_rate', 200, 0, 'Pénalité d''absence (par jour d''absence)', false),
    ('wealth_tax_allowance', 1000, 0, 'Abattement de l''impôt sur la fortune', true),
    ('max_debt_principal', 50000, 0, 'Plafond d''emprunt d''un membre', true),
    ('max_business_debt_principal', 200000, 0, 'Plafond d''emprunt d''une entreprise', true)
  ) as t(key, def, digits, label, auto)
  where not (t.auto and coalesce((select value from public.app_config where key = 'econ_auto'), 'on') = 'on');
$$;


-- ---------------------------------------------------------------------
-- 5. Droits
-- ---------------------------------------------------------------------
revoke all on function public._wheel_table(uuid, int) from public, anon, authenticated;
revoke all on function public._wheel_rows(uuid, int, boolean) from public, anon, authenticated;
revoke all on function public._inactivity_take(uuid, numeric) from public, anon, authenticated;
revoke all on function public._inactivity_day(date, boolean) from public, anon, authenticated;
revoke all on function public.process_inactivity() from public, anon, authenticated;
revoke all on function public._member_last_active(uuid, date) from public, anon, authenticated;
grant execute on function public.member_streak(uuid) to authenticated;
grant execute on function public.wheel_status() to authenticated;
grant execute on function public.wheel_spin() to authenticated;
grant execute on function public.wheel_admin() to authenticated;
grant execute on function public.wheel_prize_save(jsonb) to authenticated;
grant execute on function public.wheel_prize_delete(uuid) to authenticated;
grant execute on function public.wheel_settings_save(boolean, int) to authenticated;
grant execute on function public.my_inactivity() to authenticated;
grant execute on function public.inactivity_admin() to authenticated;
grant execute on function public.inactivity_settings_save(boolean, int, numeric) to authenticated;
grant execute on function public.inactivity_exempt(uuid, date, text) to authenticated;

-- Premier jour traité : hier (rien à prélever, l'absence part d'aujourd'hui).
insert into public.app_config (key, value) values ('inactivity_last_day', (public._local_today() - 1)::text)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
