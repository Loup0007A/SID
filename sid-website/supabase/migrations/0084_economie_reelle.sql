-- =====================================================================
-- Lot 69 (1/3) : économie réelle. Rejouable. À lancer après 0083.
--
-- COURS DU ZÉNI
--   Chaque jour, la base mesure :
--   - l'indice des prix, à partir des prix vraiment payés (achats des
--     membres, de la population, enchères adjugées), objet par objet,
--     pondéré par les dépenses des 14 derniers jours. Un objet nouveau
--     entre dans l'indice au niveau des prix du jour (chaînage) ;
--   - la masse monétaire : portefeuilles, épargne, trésoreries,
--     population, caisse commune ;
--   - l'inflation sur 30 jours et la croissance de la masse monétaire.
--   Le cours du zéni = 10 000 / indice (100 au départ ; s'il tombe à 90,
--   le zéni achète 10 % de moins qu'au départ).
--
-- ADAPTATION AUTOMATIQUE (app_config.econ_auto = 'on')
--   - taux directeur hebdomadaire selon l'inflation mesurée (règle de
--     Taylor) ; il fixe l'intérêt de l'épargne et des emprunts ;
--   - taux de l'impôt sur la fortune et sur les sociétés ;
--   - montants indexés sur l'indice : abattement de l'impôt sur la
--     fortune, seuil de faillite, plafonds d'emprunt, salaires de la
--     population. Les salaires et récompenses fixés par les admins ne
--     bougent pas.
--
-- IMPÔTS À PAYER À LA MAIN
--   Chaque semaine : un avis d'impôt sur la fortune par membre (portefeuille
--   + épargne, au-delà de l'abattement) et un avis d'impôt sur les sociétés
--   par entreprise bénéficiaire (bénéfice de la semaine), à payer sous
--   7 jours. Avis impayé à l'échéance = faute : +10 % sur tous les impôts
--   du membre pendant 2 mois (cumulable, +200 % au plus), et l'avis est
--   saisi avec 10 % de majoration (épargne puis portefeuille, ou
--   trésorerie), même si le solde passe en négatif.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nouveaux types de notification : tax, dispute, market
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
  v_types text[];
  t text;
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
  if 'tax' = any (v_types) and 'dispute' = any (v_types) and 'market' = any (v_types) then return; end if;
  foreach t in array array['tax', 'dispute', 'market'] loop
    if not t = any (v_types) then v_types := array_append(v_types, t); end if;
  end loop;
  alter table public.notifications drop constraint notifications_type_check;
  execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_types);
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Classement des mouvements d'entreprise : frais et impôts
-- ---------------------------------------------------------------------
create or replace function public.business_tx_kind(p_reason text)
returns text
language sql immutable
as $$
  select case
    when p_reason like 'Vente%' then 'sale'
    when p_reason like 'Salaire%' then 'salary'
    when p_reason like 'Intérêts%' then 'interest'
    when p_reason like 'Dividende%' then 'dividend'
    when p_reason like 'Reversement%' then 'subsidy'
    when p_reason like 'Filet de liquidité%' then 'subsidy'
    when p_reason like 'Emprunt%' or p_reason like 'Remboursement%' then 'loan'
    when p_reason like 'Apport%' or p_reason like 'Retrait%' then 'capital'
    when p_reason like 'Achat de%' or p_reason like 'Rachat%' then 'shares'
    when p_reason like 'Frais d''entreprise%' then 'expense'
    when p_reason like 'Impôt%' or p_reason like 'Saisie fiscale%' then 'tax'
    when p_reason like 'Litige%' then 'dispute'
    when p_reason like 'Amende%' then 'fine'
    else 'other'
  end;
$$;

-- Fondamentaux (0038) : frais, impôts, litiges et amendes comptent dans les charges.
create or replace function public.compute_business_fundamentals(p_business_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_b public.businesses;
  v_rev numeric := 0;
  v_costs numeric := 0;
  v_div numeric := 0;
  v_profit numeric;
  v_equity numeric;
  v_goodwill numeric;
  v_age_days numeric;
  v_half numeric;
  v_fair numeric;
begin
  select * into v_b from public.businesses where id = p_business_id;
  if v_b.id is null then return null; end if;

  select
    coalesce(sum(amount) filter (where kind = 'sale'), 0),
    coalesce(-sum(amount) filter (where kind in ('salary', 'interest', 'expense', 'tax', 'dispute', 'fine')), 0)
  into v_rev, v_costs
  from public.business_transactions
  where business_id = p_business_id and created_at >= now() - interval '7 days';

  select coalesce(-sum(amount), 0) into v_div
  from public.business_transactions
  where business_id = p_business_id and kind = 'dividend' and created_at >= now() - interval '30 days';

  v_profit := v_rev - v_costs;
  v_equity := v_b.treasury_balance - v_b.debt_principal;
  v_age_days := extract(epoch from (now() - v_b.created_at)) / 86400.0;
  v_half := greatest(0.1, public.get_config_numeric('market_goodwill_half_life_days', 21));
  v_goodwill := coalesce(v_b.initial_valuation, v_b.share_price * v_b.share_count) * power(0.5, v_age_days / v_half);

  v_fair := greatest(
    0.01,
    (v_goodwill
      + greatest(v_equity, 0)
      + public.get_config_numeric('market_profit_multiple', 8) * v_profit
      + public.get_config_numeric('market_dividend_multiple', 4) * v_div
    ) / greatest(v_b.share_count, 1)
  );

  return jsonb_build_object(
    'revenue_7d', round(v_rev, 2),
    'costs_7d', round(v_costs, 2),
    'profit_7d', round(v_profit, 2),
    'dividends_30d', round(v_div, 2),
    'equity', round(v_equity, 2),
    'goodwill', round(v_goodwill, 2),
    'fair_value', round(v_fair, 4)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Prix réellement payés
-- ---------------------------------------------------------------------
create table if not exists public.price_observations (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  item_id uuid not null references public.shop_items(id) on delete cascade,
  unit_price numeric(18, 2) not null check (unit_price > 0),
  quantity int not null default 1 check (quantity > 0),
  source text not null check (source in ('membre', 'population'))
);
create index if not exists price_observations_at_idx on public.price_observations (at);
create index if not exists price_observations_item_idx on public.price_observations (item_id, at);
alter table public.price_observations enable row level security;
revoke all on public.price_observations from anon, authenticated;

create or replace function public._observe_purchase()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.item_id is not null and coalesce(new.quantity, 0) > 0 and coalesce(new.total_price, 0) > 0 then
    insert into public.price_observations (item_id, unit_price, quantity, source)
    values (new.item_id, round(new.total_price / new.quantity, 2), new.quantity, 'membre');
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_observe_purchase on public.purchases;
create trigger trg_observe_purchase after insert on public.purchases
  for each row execute function public._observe_purchase();

-- Prix de référence de chaque objet, en « zénis de départ ».
create table if not exists public.price_reference (
  item_id uuid primary key references public.shop_items(id) on delete cascade,
  ref_price numeric(18, 4) not null check (ref_price > 0),
  entered_at timestamptz not null default now()
);
alter table public.price_reference enable row level security;
revoke all on public.price_reference from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Tableau de bord quotidien
-- ---------------------------------------------------------------------
create table if not exists public.economy_daily (
  day date primary key,
  computed_at timestamptz not null default now(),
  price_index numeric(12, 4) not null,
  raw_index numeric(12, 4),
  zeni_value numeric(12, 4) not null,
  observations int not null default 0,
  items_priced int not null default 0,
  money_wallets numeric(20, 2) not null default 0,
  money_bank numeric(20, 2) not null default 0,
  money_treasuries numeric(20, 2) not null default 0,
  money_population numeric(20, 2) not null default 0,
  money_pool numeric(20, 2) not null default 0,
  money_supply numeric(20, 2) not null default 0,
  debt_members numeric(20, 2) not null default 0,
  debt_businesses numeric(20, 2) not null default 0,
  spending_7d numeric(20, 2) not null default 0,
  inflation_30d numeric(10, 6),
  money_growth_30d numeric(10, 6),
  pressure numeric(10, 6),
  policy_rate_weekly numeric(10, 6),
  savings_rate_daily numeric(10, 6),
  loan_rate_daily numeric(10, 6),
  wealth_tax_rate numeric(10, 6),
  corporate_tax_rate numeric(10, 6),
  wealth_allowance numeric(18, 2),
  bankruptcy_threshold numeric(18, 2),
  max_debt numeric(18, 2),
  max_business_debt numeric(18, 2),
  auto boolean not null default true
);
alter table public.economy_daily enable row level security;
drop policy if exists "economy_daily_read" on public.economy_daily;
create policy "economy_daily_read" on public.economy_daily for select to authenticated using (true);
revoke all on public.economy_daily from anon;
revoke insert, update, delete on public.economy_daily from authenticated;
grant select on public.economy_daily to authenticated;

-- Valeurs de base (en « zénis de départ ») : reprises des réglages actuels
-- une seule fois ; l'adaptation part d'elles.
do $$
declare
  k text;
  v text;
begin
  for k, v in select * from (values
    ('econ_auto', 'on'),
    ('econ_inflation_target_30d', '0.01'),
    ('econ_neutral_rate_weekly', '0.005'),
    ('econ_loan_spread_weekly', '0.01'),
    ('econ_base_wealth_tax_rate', '0.02'),
    ('econ_base_corporate_tax_rate', '0.15'),
    ('econ_base_wealth_allowance', '1000'),
    ('econ_base_business_min_weekly_revenue', coalesce((select value from public.app_config where key = 'business_min_weekly_revenue'), '2000')),
    ('econ_base_max_debt_principal', coalesce((select value from public.app_config where key = 'max_debt_principal'), '50000')),
    ('econ_base_max_business_debt_principal', coalesce((select value from public.app_config where key = 'max_business_debt_principal'), '200000')),
    ('tax_late_penalty_pct', '10'),
    ('tax_fault_surcharge_pct', '10'),
    ('tax_fault_surcharge_max_pct', '200'),
    ('tax_fault_days', '60'),
    ('tax_due_days', '7')
  ) as t(k, v) loop
    insert into public.app_config (key, value) values (k, v) on conflict (key) do nothing;
  end loop;
end;
$$;

create or replace function public._cfg_set(p_key text, p_value numeric)
returns void
language sql security definer set search_path = public
as $$
  insert into public.app_config (key, value) values (p_key, p_value::text)
  on conflict (key) do update set value = excluded.value;
$$;

-- Mesure du jour et adaptation. Une fois par jour (heure de Paris).
create or replace function public.economy_update(p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_tz text := public.stats_timezone();
  v_today date := (now() at time zone public.stats_timezone())::date;
  v_prev public.economy_daily;
  v_old public.economy_daily;
  v_prev_index numeric;
  v_raw numeric;
  v_index numeric;
  v_obs int;
  v_items int;
  v_m_wallets numeric; v_m_bank numeric; v_m_treas numeric; v_m_pop numeric; v_m_pool numeric; v_m numeric;
  v_d_members numeric; v_d_biz numeric; v_spend numeric;
  v_infl numeric; v_growth numeric; v_pressure numeric;
  v_target numeric := public.get_config_numeric('econ_inflation_target_30d', 0.01);
  v_policy numeric; v_savings numeric; v_loan numeric; v_wealth numeric; v_corp numeric;
  v_f numeric;
  v_allow numeric; v_bankrupt numeric; v_maxdebt numeric; v_maxbizdebt numeric;
  v_auto boolean := coalesce((select value from public.app_config where key = 'econ_auto'), 'on') = 'on';
begin
  if not p_force and exists (select 1 from public.economy_daily where day = v_today) then
    return null;
  end if;

  select * into v_prev from public.economy_daily where day < v_today order by day desc limit 1;
  v_prev_index := coalesce(v_prev.price_index, 100);

  -- Objets nouveaux : référence au niveau des prix d'hier (chaînage).
  insert into public.price_reference (item_id, ref_price)
  select o.item_id, (sum(o.unit_price * o.quantity) / sum(o.quantity)) / (v_prev_index / 100.0)
  from public.price_observations o
  where o.at > now() - interval '14 days'
    and not exists (select 1 from public.price_reference r where r.item_id = o.item_id)
  group by o.item_id
  on conflict (item_id) do nothing;

  -- Indice brut : moyenne géométrique des rapports prix payé / référence,
  -- pondérée par la dépense de chaque objet sur 14 jours.
  select count(*), count(distinct o.item_id) into v_obs, v_items
  from public.price_observations o where o.at > now() - interval '14 days';

  select 100 * exp(sum(x.w * ln(x.p / x.ref)) / nullif(sum(x.w), 0))
    into v_raw
  from (
    select sum(o.unit_price * o.quantity) as w,
           sum(o.unit_price * o.quantity) / sum(o.quantity) as p,
           r.ref_price as ref
    from public.price_observations o
    join public.price_reference r on r.item_id = o.item_id
    where o.at > now() - interval '14 days'
    group by o.item_id, r.ref_price
  ) x;

  -- Lissage : un indice fondé sur peu d'achats bouge moins.
  if v_raw is null or v_obs < 3 then
    v_index := v_prev_index;
  else
    v_index := v_prev_index + (v_raw - v_prev_index) * least(0.5, 0.1 + v_obs / 100.0);
  end if;
  v_index := round(greatest(v_index, 1), 4);

  -- Masse monétaire.
  select coalesce(sum(balance), 0), coalesce(sum(debt_principal), 0) into v_m_wallets, v_d_members from public.wallets;
  select coalesce(sum(balance), 0) into v_m_bank from public.bank_accounts;
  select coalesce(sum(treasury_balance), 0), coalesce(sum(debt_principal), 0) into v_m_treas, v_d_biz from public.businesses where not is_closed;
  select coalesce(sum(balance), 0) into v_m_pop from public.sim_agents;
  select coalesce(sum(balance), 0) into v_m_pool from public.tax_pool;
  v_m := v_m_wallets + v_m_bank + v_m_treas + v_m_pop + v_m_pool;
  select coalesce(sum(unit_price * quantity), 0) into v_spend from public.price_observations where at > now() - interval '7 days';

  -- Évolutions sur 30 jours (ou depuis la plus vieille mesure).
  select * into v_old from public.economy_daily where day <= v_today - 30 order by day desc limit 1;
  if v_old.day is null then
    select * into v_old from public.economy_daily order by day limit 1;
  end if;
  -- Moins de 7 jours d'historique : pas encore de tendance fiable.
  if v_old.day is not null and v_today - v_old.day >= 7 then
    v_infl := v_index / nullif(v_old.price_index, 0) - 1;
    v_growth := v_m / nullif(v_old.money_supply, 0) - 1;
    -- Ramené à 30 jours si l'historique est plus court.
    v_infl := power(1 + v_infl, 30.0 / (v_today - v_old.day)) - 1;
    v_growth := case when v_growth is null or v_growth <= -1 then null
                     else power(1 + v_growth, 30.0 / (v_today - v_old.day)) - 1 end;
  end if;
  -- Sans historique, on suppose l'inflation à la cible : politique neutre.
  v_infl := coalesce(v_infl, v_target);
  v_growth := greatest(least(coalesce(v_growth, v_target), 5), -0.9);

  -- Pression inflationniste : surtout les prix, un peu la monnaie. Peu
  -- d'achats mesurés : la monnaie pèse davantage.
  v_pressure := case when v_obs >= 10 then 0.7 * v_infl + 0.3 * v_growth else 0.3 * v_infl + 0.7 * v_growth end;

  -- Règle de Taylor, en taux hebdomadaires : 1,5 point de taux par point
  -- d'inflation au-dessus de la cible.
  v_policy := greatest(0.0005, least(0.05,
    public.get_config_numeric('econ_neutral_rate_weekly', 0.005)
    + 1.5 * ((power(1 + greatest(v_pressure, -0.9), 7.0 / 30) - 1) - (power(1 + v_target, 7.0 / 30) - 1))));
  v_savings := round(v_policy / 7, 6);
  v_loan := round((v_policy + public.get_config_numeric('econ_loan_spread_weekly', 0.01)) / 7, 6);
  v_wealth := round(greatest(0.003, least(0.06,
    public.get_config_numeric('econ_base_wealth_tax_rate', 0.02) + 0.25 * (v_pressure - v_target))), 5);
  v_corp := round(greatest(0.05, least(0.35,
    public.get_config_numeric('econ_base_corporate_tax_rate', 0.15) + 0.5 * (v_pressure - v_target))), 4);

  v_f := v_index / 100.0;
  v_allow := round(public.get_config_numeric('econ_base_wealth_allowance', 1000) * v_f);
  v_bankrupt := round(public.get_config_numeric('econ_base_business_min_weekly_revenue', 2000) * v_f);
  v_maxdebt := round(public.get_config_numeric('econ_base_max_debt_principal', 50000) * v_f);
  v_maxbizdebt := round(public.get_config_numeric('econ_base_max_business_debt_principal', 200000) * v_f);

  if v_auto then
    perform public._cfg_set('bank_daily_interest_rate', v_savings);
    perform public._cfg_set('debt_daily_interest_rate', v_loan);
    perform public._cfg_set('weekly_wealth_tax_rate', v_wealth);
    perform public._cfg_set('corporate_tax_rate', v_corp);
    perform public._cfg_set('wealth_tax_allowance', v_allow);
    -- 0 = règle de faillite désactivée par un admin : on n'y touche pas.
    if public.get_config_numeric('business_min_weekly_revenue', 2000) > 0 then
      perform public._cfg_set('business_min_weekly_revenue', v_bankrupt);
    end if;
    perform public._cfg_set('max_debt_principal', v_maxdebt);
    perform public._cfg_set('max_business_debt_principal', v_maxbizdebt);
    -- Salaires de la population : suivent les prix.
    if v_prev.day is not null and v_index <> v_prev_index then
      update public.sim_agents set weekly_salary = round(weekly_salary * (v_index / v_prev_index), 2);
    end if;
  end if;

  insert into public.economy_daily (
    day, computed_at, price_index, raw_index, zeni_value, observations, items_priced,
    money_wallets, money_bank, money_treasuries, money_population, money_pool, money_supply,
    debt_members, debt_businesses, spending_7d, inflation_30d, money_growth_30d, pressure,
    policy_rate_weekly, savings_rate_daily, loan_rate_daily, wealth_tax_rate, corporate_tax_rate,
    wealth_allowance, bankruptcy_threshold, max_debt, max_business_debt, auto)
  values (
    v_today, now(), v_index, round(v_raw, 4), round(10000 / v_index, 4), v_obs, v_items,
    v_m_wallets, v_m_bank, v_m_treas, v_m_pop, v_m_pool, v_m,
    v_d_members, v_d_biz, v_spend, round(v_infl, 6), round(v_growth, 6), round(v_pressure, 6),
    round(v_policy, 6), v_savings, v_loan, v_wealth, v_corp,
    v_allow, v_bankrupt, v_maxdebt, v_maxbizdebt, v_auto)
  on conflict (day) do update set
    computed_at = excluded.computed_at, price_index = excluded.price_index, raw_index = excluded.raw_index,
    zeni_value = excluded.zeni_value, observations = excluded.observations, items_priced = excluded.items_priced,
    money_wallets = excluded.money_wallets, money_bank = excluded.money_bank, money_treasuries = excluded.money_treasuries,
    money_population = excluded.money_population, money_pool = excluded.money_pool, money_supply = excluded.money_supply,
    debt_members = excluded.debt_members, debt_businesses = excluded.debt_businesses, spending_7d = excluded.spending_7d,
    inflation_30d = excluded.inflation_30d, money_growth_30d = excluded.money_growth_30d, pressure = excluded.pressure,
    policy_rate_weekly = excluded.policy_rate_weekly, savings_rate_daily = excluded.savings_rate_daily,
    loan_rate_daily = excluded.loan_rate_daily, wealth_tax_rate = excluded.wealth_tax_rate,
    corporate_tax_rate = excluded.corporate_tax_rate, wealth_allowance = excluded.wealth_allowance,
    bankruptcy_threshold = excluded.bankruptcy_threshold, max_debt = excluded.max_debt,
    max_business_debt = excluded.max_business_debt, auto = excluded.auto;

  return jsonb_build_object('indice', v_index, 'inflation_30j', v_infl, 'taux_directeur', v_policy);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Impôts à payer à la main
-- ---------------------------------------------------------------------
create table if not exists public.tax_bills (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('fortune', 'societe')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  base numeric(18, 2) not null,
  allowance numeric(18, 2) not null default 0,
  rate numeric(8, 5) not null,
  surcharge_pct int not null default 0,
  amount numeric(18, 2) not null check (amount > 0),
  status text not null default 'due' check (status in ('due', 'paid', 'seized', 'cancelled')),
  due_at timestamptz not null,
  paid_at timestamptz,
  paid_from text check (paid_from is null or paid_from in ('portefeuille', 'epargne', 'tresorerie', 'saisie')),
  penalty numeric(18, 2) not null default 0,
  reminded_at timestamptz,
  created_at timestamptz not null default now()
);
-- Amendes (0086) : même circuit que les impôts (paiement, échéance, saisie).
alter table public.tax_bills drop constraint if exists tax_bills_kind_check;
alter table public.tax_bills add constraint tax_bills_kind_check check (kind in ('fortune', 'societe', 'amende'));
alter table public.tax_bills add column if not exists reason text;
alter table public.tax_bills add column if not exists issued_by uuid references public.profiles(id) on delete set null;
alter table public.tax_bills drop constraint if exists tax_bills_reason_len;
alter table public.tax_bills add constraint tax_bills_reason_len check (reason is null or char_length(reason) <= 300);
create index if not exists tax_bills_user_idx on public.tax_bills (user_id, created_at desc);
create index if not exists tax_bills_due_idx on public.tax_bills (due_at) where status = 'due';
create index if not exists tax_bills_business_idx on public.tax_bills (business_id) where business_id is not null;

create table if not exists public.tax_faults (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  bill_id uuid references public.tax_bills(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists tax_faults_user_idx on public.tax_faults (user_id, expires_at);

alter table public.tax_bills enable row level security;
alter table public.tax_faults enable row level security;
drop policy if exists "tax_bills_select" on public.tax_bills;
create policy "tax_bills_select" on public.tax_bills for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));
drop policy if exists "tax_faults_select" on public.tax_faults;
create policy "tax_faults_select" on public.tax_faults for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));
revoke all on public.tax_bills, public.tax_faults from anon;
revoke insert, update, delete on public.tax_bills, public.tax_faults from authenticated;
grant select on public.tax_bills, public.tax_faults to authenticated;

-- Majoration en cours d'un membre : 10 % par faute de moins de 2 mois, 200 % au plus.
create or replace function public.tax_surcharge_pct(p_user uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select least(
    public.get_config_numeric('tax_fault_surcharge_max_pct', 200)::int,
    (public.get_config_numeric('tax_fault_surcharge_pct', 10) * count(*))::int)
  from public.tax_faults where user_id = p_user and expires_at > now();
$$;

-- Avis de la semaine (appelé par process_weekly_taxes).
create or replace function public._tax_issue_bills(p_start timestamptz, p_end timestamptz)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_rate numeric := public.get_config_numeric('weekly_wealth_tax_rate', 0.02);
  v_allow numeric := public.get_config_numeric('wealth_tax_allowance', 1000);
  v_corp numeric := public.get_config_numeric('corporate_tax_rate', 0.15);
  v_due timestamptz := now() + make_interval(days => public.get_config_numeric('tax_due_days', 7)::int);
  r record;
  v_sur int;
  v_amount numeric(18, 2);
  v_profit numeric;
  n int := 0;
begin
  -- Impôt sur la fortune : portefeuille + épargne, au-delà de l'abattement.
  for r in
    select p.id as user_id, greatest(coalesce(w.balance, 0), 0) + coalesce(b.balance, 0) as base
    from public.profiles p
    left join public.wallets w on w.user_id = p.id
    left join public.bank_accounts b on b.user_id = p.id
    where p.status = 'active' and not public.is_sandbox_account(p.id)
  loop
    if r.base > v_allow then
      v_sur := public.tax_surcharge_pct(r.user_id);
      v_amount := round((r.base - v_allow) * v_rate * (1 + v_sur / 100.0), 2);
      if v_amount >= 1 then
        insert into public.tax_bills (kind, user_id, period_start, period_end, base, allowance, rate, surcharge_pct, amount, due_at)
        values ('fortune', r.user_id, p_start, p_end, r.base, v_allow, v_rate, v_sur, v_amount, v_due);
        insert into public.notifications (user_id, type, title, body, link)
        values (r.user_id, 'tax', 'Avis d''impôt',
                'Impôt sur la fortune : ' || public._fmt_z(v_amount) || ' z à payer avant le '
                || to_char(v_due at time zone public.stats_timezone(), 'DD/MM') || '.'
                || case when v_sur > 0 then ' Majoration en cours : +' || v_sur || ' %.' else '' end,
                '/dashboard/bank#impots');
        n := n + 1;
      end if;
    end if;
  end loop;

  -- Impôt sur les sociétés : bénéfice des 7 derniers jours, payé par le fondateur.
  for r in select * from public.businesses where not is_closed and founder_id is not null loop
    select coalesce(sum(amount) filter (where kind = 'sale'), 0)
           + coalesce(sum(amount) filter (where kind in ('salary', 'interest', 'expense', 'dispute')), 0)
      into v_profit
    from public.business_transactions
    where business_id = r.id and created_at >= p_start and created_at < p_end;
    if v_profit > 0 then
      v_sur := public.tax_surcharge_pct(r.founder_id);
      v_amount := round(v_profit * v_corp * (1 + v_sur / 100.0), 2);
      if v_amount >= 1 then
        insert into public.tax_bills (kind, user_id, business_id, period_start, period_end, base, rate, surcharge_pct, amount, due_at)
        values ('societe', r.founder_id, r.id, p_start, p_end, v_profit, v_corp, v_sur, v_amount, v_due);
        insert into public.notifications (user_id, type, title, body, link)
        values (r.founder_id, 'tax', 'Avis d''impôt : ' || r.name,
                'Impôt sur les sociétés : ' || public._fmt_z(v_amount) || ' z (bénéfice de la semaine '
                || public._fmt_z(v_profit) || ' z), à payer depuis la trésorerie avant le '
                || to_char(v_due at time zone public.stats_timezone(), 'DD/MM') || '.',
                '/dashboard/business#impots');
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end;
$$;

-- Hebdomadaire (0035) : les impôts ne sont plus prélevés, ils sont envoyés
-- en avis. La caisse commune est toujours reversée chaque semaine.
create or replace function public.process_weekly_taxes()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pool public.tax_pool;
  v_weeks int;
  v_admin_share numeric;
  v_business_share numeric;
  v_admin_count int;
  v_business_count int;
  v_per_admin numeric(18, 2);
  v_per_business numeric(18, 2);
  r record;
begin
  select * into v_pool from public.tax_pool where id = true for update;
  if v_pool.id is null then
    insert into public.tax_pool (id) values (true) returning * into v_pool;
  end if;

  v_weeks := floor(extract(epoch from (now() - v_pool.last_distributed_at)) / 604800)::int;
  if v_weeks < 1 then return; end if;

  -- Un seul avis par passage, même après une longue absence.
  perform public._tax_issue_bills(greatest(v_pool.last_distributed_at, now() - interval '7 days'), now());

  select balance into v_pool.balance from public.tax_pool where id = true;
  v_admin_share := public.get_config_numeric('tax_admin_share', 0.8);
  v_business_share := public.get_config_numeric('tax_business_share', 0.2);

  select count(*) into v_admin_count from public.profiles p
    where p.status = 'active' and (p.is_founder or public.has_permission(p.id, 'manage_users'));
  select count(*) into v_business_count from public.businesses where not is_closed;

  if v_pool.balance > 0 and v_admin_count > 0 then
    v_per_admin := round((v_pool.balance * v_admin_share) / v_admin_count, 2);
    for r in
      select p.id from public.profiles p
      where p.status = 'active' and (p.is_founder or public.has_permission(p.id, 'manage_users'))
    loop
      update public.wallets set balance = balance + v_per_admin where user_id = r.id;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (r.id, v_per_admin, 'Reversement des impôts/TVA (part admin)', r.id);
    end loop;
  end if;

  if v_pool.balance > 0 and v_business_count > 0 then
    v_per_business := round((v_pool.balance * v_business_share) / v_business_count, 2);
    for r in select id, founder_id from public.businesses where not is_closed loop
      update public.businesses set treasury_balance = treasury_balance + v_per_business where id = r.id;
      insert into public.business_transactions (business_id, amount, reason, created_by)
      values (r.id, v_per_business, 'Reversement des impôts/TVA', r.founder_id);
    end loop;
  end if;

  update public.tax_pool
    set balance = 0,
        last_distributed_at = last_distributed_at + (v_weeks || ' weeks')::interval
    where id = true;
end;
$$;

-- Payer un avis. Fortune et amende personnelle : depuis le portefeuille ou
-- l'épargne. Sociétés et amende d'entreprise : depuis la trésorerie, par le
-- fondateur.
create or replace function public.tax_pay(p_bill uuid, p_source text default 'portefeuille')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  b public.tax_bills;
  v_biz public.businesses;
  v_bal numeric;
  v_label text;
  v_reason text;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  select * into b from public.tax_bills where id = p_bill for update;
  if b.id is null then raise exception 'Avis introuvable.'; end if;
  if b.status <> 'due' then raise exception 'Cet avis est déjà réglé.'; end if;

  v_label := case when b.kind = 'amende' then coalesce(b.reason, 'sans motif')
                  else 'semaine du ' || to_char(b.period_start at time zone public.stats_timezone(), 'DD/MM') end;

  if b.business_id is null then
    if b.user_id <> v_uid then raise exception 'Cet avis ne t''est pas adressé.'; end if;
    if p_source = 'epargne' then
      select balance into v_bal from public.bank_accounts where user_id = v_uid for update;
      if coalesce(v_bal, 0) < b.amount then raise exception 'Épargne insuffisante.'; end if;
      update public.bank_accounts set balance = balance - b.amount where user_id = v_uid;
    else
      select balance into v_bal from public.wallets where user_id = v_uid for update;
      if coalesce(v_bal, 0) < b.amount then raise exception 'Solde insuffisant.'; end if;
      update public.wallets set balance = balance - b.amount where user_id = v_uid;
      p_source := 'portefeuille';
    end if;
    v_reason := case when b.kind = 'amende' then 'Amende : ' || v_label else 'Impôt sur la fortune (' || v_label || ')' end;
    insert into public.transactions (user_id, amount, reason, created_by)
    values (v_uid, -b.amount, v_reason || case when p_source = 'epargne' then ', payé sur l''épargne' else '' end, v_uid);
  else
    select * into v_biz from public.businesses where id = b.business_id for update;
    if v_biz.id is null then raise exception 'Entreprise introuvable.'; end if;
    if not (v_biz.founder_id = v_uid or b.user_id = v_uid) then raise exception 'Seul le fondateur paie cet avis.'; end if;
    if v_biz.treasury_balance < b.amount then raise exception 'Trésorerie insuffisante.'; end if;
    update public.businesses set treasury_balance = treasury_balance - b.amount where id = v_biz.id;
    insert into public.business_transactions (business_id, amount, reason, created_by)
    values (v_biz.id, -b.amount,
            case when b.kind = 'amende' then 'Amende : ' || v_label else 'Impôt sur les sociétés (' || v_label || ')' end, v_uid);
    p_source := 'tresorerie';
  end if;

  update public.tax_pool set balance = balance + b.amount where id = true;
  update public.tax_bills set status = 'paid', paid_at = now(), paid_from = p_source where id = b.id;
end;
$$;

-- Échéances : rappel à J-2, puis faute et saisie.
create or replace function public.taxes_process_due()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  b public.tax_bills;
  v_pen numeric(18, 2);
  v_total numeric(18, 2);
  v_bank numeric(18, 2);
  v_from_bank numeric(18, 2);
  v_sur int;
  v_days int := public.get_config_numeric('tax_fault_days', 60)::int;
  v_pct int := public.get_config_numeric('tax_late_penalty_pct', 10)::int;
  v_name text;
  v_personal boolean;
  v_what text;
  n int := 0;
begin
  for b in
    select * from public.tax_bills
    where status = 'due' and reminded_at is null and due_at > now() and due_at <= now() + interval '48 hours'
    for update skip locked
  loop
    insert into public.notifications (user_id, type, title, body, link)
    values (b.user_id, 'tax',
            case when b.kind = 'amende' then 'Amende' else 'Impôt' end || ' à payer avant le '
            || to_char(b.due_at at time zone public.stats_timezone(), 'DD/MM'),
            public._fmt_z(b.amount) || ' z. Sans paiement, l''avis sera saisi avec '
            || v_pct || ' % de majoration et tes impôts majorés pendant 2 mois.',
            case when b.business_id is null then '/dashboard/bank#impots' else '/dashboard/business#impots' end);
    update public.tax_bills set reminded_at = now() where id = b.id;
  end loop;

  for b in select * from public.tax_bills where status = 'due' and due_at <= now() for update skip locked loop
    v_personal := b.business_id is null;
    v_name := null;
    if not v_personal and coalesce((select is_closed from public.businesses where id = b.business_id), true) then
      -- Entreprise fermée entre-temps : l'impôt tombe, l'amende revient au fondateur.
      if b.kind = 'societe' then
        update public.tax_bills set status = 'cancelled' where id = b.id;
        continue;
      end if;
      v_personal := true;
    end if;
    v_what := case b.kind when 'fortune' then 'impôt sur la fortune' when 'societe' then 'impôt sur les sociétés' else 'amende' end;
    v_pen := round(b.amount * v_pct / 100.0, 2);
    v_total := b.amount + v_pen;

    if v_personal then
      -- L'épargne d'abord, le reste sur le portefeuille (qui peut passer en négatif).
      select balance into v_bank from public.bank_accounts where user_id = b.user_id for update;
      v_from_bank := least(greatest(coalesce(v_bank, 0), 0), v_total);
      if v_from_bank > 0 then
        update public.bank_accounts set balance = balance - v_from_bank where user_id = b.user_id;
      end if;
      if v_total - v_from_bank > 0 then
        update public.wallets set balance = balance - (v_total - v_from_bank) where user_id = b.user_id;
      end if;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (b.user_id, -v_total,
              case when b.kind = 'amende' then 'Amende impayée saisie : ' || coalesce(b.reason, 'sans motif')
                   else 'Saisie fiscale : ' || v_what || ' impayé' end || ' (+' || v_pct || ' %)', null);
    else
      update public.businesses set treasury_balance = treasury_balance - v_total where id = b.business_id
      returning name into v_name;
      insert into public.business_transactions (business_id, amount, reason, created_by)
      values (b.business_id, -v_total,
              case when b.kind = 'amende' then 'Amende impayée saisie : ' || coalesce(b.reason, 'sans motif')
                   else 'Saisie fiscale : impôt sur les sociétés impayé' end, null);
    end if;

    update public.tax_pool set balance = balance + v_total where id = true;
    update public.tax_bills set status = 'seized', paid_at = now(), paid_from = 'saisie', penalty = v_pen where id = b.id;
    insert into public.tax_faults (user_id, bill_id, expires_at) values (b.user_id, b.id, now() + make_interval(days => v_days));
    v_sur := public.tax_surcharge_pct(b.user_id);

    insert into public.notifications (user_id, type, title, body, link)
    values (b.user_id, 'tax', case when b.kind = 'amende' then 'Amende saisie' else 'Impôt saisi' end,
            public._fmt_z(v_total) || ' z prélevés' || coalesce(' sur ' || v_name, '') || ' (' || v_what || ' impayé + '
            || v_pct || ' %). Tes impôts sont majorés de '
            || v_sur || ' % jusqu''au ' || to_char((now() + make_interval(days => v_days)) at time zone public.stats_timezone(), 'DD/MM') || '.',
            case when v_personal then '/dashboard/bank#impots' else '/dashboard/business#impots' end);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Mes avis et ma majoration (et ceux de mes entreprises).
create or replace function public.my_taxes()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return null; end if;
  return jsonb_build_object(
    'surcharge_pct', public.tax_surcharge_pct(v_uid),
    'faults', coalesce((select jsonb_agg(jsonb_build_object('at', f.created_at, 'expires_at', f.expires_at) order by f.expires_at)
                        from public.tax_faults f where f.user_id = v_uid and f.expires_at > now()), '[]'::jsonb),
    'bills', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'kind', t.kind, 'business_id', t.business_id, 'business_name', bz.name,
                 'period_start', t.period_start, 'period_end', t.period_end, 'base', t.base, 'allowance', t.allowance,
                 'rate', t.rate, 'surcharge_pct', t.surcharge_pct, 'amount', t.amount, 'status', t.status,
                 'due_at', t.due_at, 'paid_at', t.paid_at, 'paid_from', t.paid_from, 'penalty', t.penalty,
                 'reason', t.reason)
               order by case when t.status = 'due' then 0 else 1 end, t.due_at desc)
               from (select * from public.tax_bills x
                     where x.user_id = v_uid and (x.status = 'due' or x.created_at > now() - interval '60 days')
                     order by x.created_at desc limit 40) t
               left join public.businesses bz on bz.id = t.business_id), '[]'::jsonb),
    'rates', jsonb_build_object(
      'fortune', public.get_config_numeric('weekly_wealth_tax_rate', 0.02),
      'abattement', public.get_config_numeric('wealth_tax_allowance', 1000),
      'societes', public.get_config_numeric('corporate_tax_rate', 0.15),
      'penalite', public.get_config_numeric('tax_late_penalty_pct', 10),
      'majoration_par_faute', public.get_config_numeric('tax_fault_surcharge_pct', 10),
      'majoration_max', public.get_config_numeric('tax_fault_surcharge_max_pct', 200),
      'jours', public.get_config_numeric('tax_due_days', 7))
  );
end;
$$;

-- Vue d'ensemble pour l'administration.
create or replace function public.taxes_overview()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then raise exception 'Permission refusée.'; end if;
  return jsonb_build_object(
    'a_payer', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(amount), 0)) from public.tax_bills where status = 'due'),
    'payes_30j', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(amount), 0)) from public.tax_bills where status = 'paid' and paid_at > now() - interval '30 days'),
    'saisis_30j', (select jsonb_build_object('n', count(*), 'total', coalesce(sum(amount + penalty), 0)) from public.tax_bills where status = 'seized' and paid_at > now() - interval '30 days'),
    'majores', (select count(distinct user_id) from public.tax_faults where expires_at > now()),
    'avis', coalesce((select jsonb_agg(jsonb_build_object(
               'id', t.id, 'kind', t.kind, 'nickname', p.nickname, 'business_name', bz.name, 'amount', t.amount,
               'status', t.status, 'due_at', t.due_at, 'surcharge_pct', t.surcharge_pct, 'reason', t.reason) order by t.due_at)
             from (select * from public.tax_bills where status = 'due' order by due_at limit 100) t
             join public.profiles p on p.id = t.user_id
             left join public.businesses bz on bz.id = t.business_id), '[]'::jsonb)
  );
end;
$$;

-- Annuler un avis (erreur, geste de l'administration).
create or replace function public.tax_cancel(p_bill uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b public.tax_bills;
begin
  if not public.has_permission(auth.uid(), 'manage_economy') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée.';
  end if;
  update public.tax_bills set status = 'cancelled' where id = p_bill and status = 'due' returning * into b;
  if b.id is null then raise exception 'Avis introuvable ou déjà réglé.'; end if;
  perform public.write_audit('tax_bill_cancelled', b.user_id, jsonb_build_object('montant', b.amount, 'impot', b.kind));
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Vue publique : la banque centrale
-- ---------------------------------------------------------------------
create or replace function public.economy_overview(p_days int default 90)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_last public.economy_daily;
begin
  if auth.uid() is null then return null; end if;
  select * into v_last from public.economy_daily order by day desc limit 1;
  return jsonb_build_object(
    'today', to_jsonb(v_last),
    'auto', coalesce((select value from public.app_config where key = 'econ_auto'), 'on') = 'on',
    'target_30d', public.get_config_numeric('econ_inflation_target_30d', 0.01),
    'vat_rate', public.get_config_numeric('vat_rate', 0.05),
    'series', coalesce((select jsonb_agg(jsonb_build_object(
                 'day', d.day, 'index', d.price_index, 'zeni', d.zeni_value, 'm', d.money_supply,
                 'inflation', d.inflation_30d, 'policy', d.policy_rate_weekly, 'spending', d.spending_7d) order by d.day)
               from (select * from public.economy_daily where day > current_date - greatest(least(coalesce(p_days, 90), 365), 7)) d), '[]'::jsonb),
    'basket', coalesce((select jsonb_agg(x order by x->>'spend' desc) from (
                 select jsonb_build_object(
                          'name', i.name,
                          'price', round(sum(o.unit_price * o.quantity) / sum(o.quantity), 2),
                          'ref', round(r.ref_price, 2),
                          'spend', round(sum(o.unit_price * o.quantity), 2),
                          'n', count(*)) as x
                 from public.price_observations o
                 join public.shop_items i on i.id = o.item_id
                 left join public.price_reference r on r.item_id = o.item_id
                 where o.at > now() - interval '14 days'
                 group by i.name, r.ref_price
                 order by sum(o.unit_price * o.quantity) desc
                 limit 12) s), '[]'::jsonb)
  );
end;
$$;

-- Réglage de l'adaptation automatique (admins Économie).
create or replace function public.economy_set_auto(p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée.';
  end if;
  insert into public.app_config (key, value) values ('econ_auto', case when p_on then 'on' else 'off' end)
  on conflict (key) do update set value = excluded.value;
  perform public.write_audit('economy_auto_' || case when p_on then 'on' else 'off' end, null, '{}'::jsonb);
  if p_on then perform public.economy_update(true); end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Population : un jour simulé par jour réel, sans attendre un admin
-- ---------------------------------------------------------------------
create or replace function public._population_catch_up()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_last date;
  v_today date := current_date;
  d date;
  n int := 0;
begin
  if not exists (select 1 from public.sim_agents limit 1) then return 0; end if;
  select last_processed_day into v_last from public.sim_state where id = true for update;
  if v_last is null then
    insert into public.sim_state (id, last_processed_day) values (true, v_today - 1)
    on conflict (id) do update set last_processed_day = coalesce(public.sim_state.last_processed_day, v_today - 1);
    v_last := v_today - 1;
  end if;
  d := v_last + 1;
  while d <= v_today and n < 7 loop
    perform public.sim_process_day(d);
    d := d + 1;
    n := n + 1;
  end loop;
  update public.sim_state set last_processed_day = d - 1 where id = true;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Tâches planifiées (0082) : + économie, impôts, population, bourse
-- ---------------------------------------------------------------------
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
  return v;
end;
$$;

create or replace function public._cfg_set_ts(p_key text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.app_config (key, value) values (p_key, now()::text)
  on conflict (key) do update set value = excluded.value;
$$;

-- ---------------------------------------------------------------------
-- 8. Droits d'exécution
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._observe_purchase()', 'public._cfg_set(text, numeric)', 'public._cfg_set_ts(text)',
    'public.economy_update(boolean)', 'public.tax_surcharge_pct(uuid)', 'public._tax_issue_bills(timestamptz, timestamptz)',
    'public.tax_pay(uuid, text)', 'public.taxes_process_due()', 'public.my_taxes()', 'public.taxes_overview()',
    'public.tax_cancel(uuid)', 'public.economy_overview(int)', 'public.economy_set_auto(boolean)',
    'public._population_catch_up()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
  end loop;
  foreach f in array array[
    'public._observe_purchase()', 'public._cfg_set(text, numeric)', 'public._cfg_set_ts(text)',
    'public.economy_update(boolean)', 'public._tax_issue_bills(timestamptz, timestamptz)',
    'public.taxes_process_due()', 'public._population_catch_up()'
  ] loop
    execute format('revoke all on function %s from authenticated', f);
  end loop;
  foreach f in array array[
    'public.tax_surcharge_pct(uuid)', 'public.tax_pay(uuid, text)', 'public.my_taxes()', 'public.taxes_overview()',
    'public.tax_cancel(uuid)', 'public.economy_overview(int)', 'public.economy_set_auto(boolean)'
  ] loop
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- Première mesure tout de suite (indice 100 au lancement).
select public.economy_update(true);
