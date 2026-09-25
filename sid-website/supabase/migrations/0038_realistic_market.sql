-- =========================================================
-- Bourse réaliste, pilotée par l'activité économique réelle de chaque
-- entreprise (un peu comme un cours qui suit le "PIB" de l'entreprise).
--
-- 1) VALEUR INTRINSÈQUE (le "PIB" de l'entreprise) :
--      valeur = ( survaleur de départ (décroît avec l'âge)
--               + fonds propres (trésorerie - dette, si positifs)
--               + multiple_bénéfice   x bénéfice des 7 derniers jours
--               + multiple_dividende  x dividendes versés sur 30 jours ) / nb d'actions
--    C'est cette valeur, recalculée à partir des VRAIS mouvements de
--    trésorerie de l'entreprise, qui pilote le cours automatiquement.
--
-- 2) Le cours suit cette valeur avec retour à la moyenne + volatilité +
--    "actualités" ponctuelles, en tick périodique (comme avant).
--
-- 3) Frais sur achat d'actions, en DEUX parties désormais :
--      - un pourcentage (market_fee_rate) qui part dans la caisse commune
--        (redistribuée 80/20 admins/entreprises chaque semaine, comme la
--        TVA) ;
--      - un montant FIXE PAR ACTION (market_admin_fee_per_share, 0,50 Cr.
--        par défaut) qui revient IMMÉDIATEMENT, à parts égales, aux
--        comptes admin (fondateur + permission manage_users) — "1/2 Cr.
--        par action prise" comme demandé.
--
-- 4) ANTI-SPÉCULATION : acheter puis revendre aussitôt pour empocher la
--    différence est désormais bloqué. Chaque achat crée un "lot" ; un lot
--    doit être détenu au moins `market_min_holding_minutes` (30 min par
--    défaut) avant de pouvoir être revendu (FIFO : les actions les plus
--    anciennes partent en premier). Vendre plus que ce qui est éligible
--    échoue avec un message clair indiquant combien peuvent être vendues
--    tout de suite.
--
-- 5) LIQUIDITÉ GARANTIE : une entreprise doit toujours pouvoir racheter au
--    moins une action. Si sa trésorerie ne couvre pas le prix d'une seule
--    action, la caisse commune avance le manque (si elle le peut) avant
--    d'exécuter la vente. Si la demande dépasse ce que la trésorerie peut
--    couvrir, la vente est exécutée PARTIELLEMENT (le maximum possible,
--    au moins 1 action) plutôt que d'échouer complètement.
--
-- Comme pour les salaires, aucun job planifié : le marché "rattrape" les
-- ticks manqués à la connexion de n'importe quel membre (plafond : 72 ticks).
-- =========================================================

-- ---------------------------------------------------------
-- Interrupteurs de maintenance (définis ici en amont car buy/sell les
-- utilisent plus bas) ; la gestion complète (écriture, autres sections du
-- site) arrive avec les outils d'administration dans une migration
-- suivante.
-- ---------------------------------------------------------
create table if not exists public.maintenance_flags (
  key text primary key,
  is_enabled boolean not null default true,
  message text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.maintenance_flags enable row level security;

drop policy if exists "maintenance_flags_select" on public.maintenance_flags;
create policy "maintenance_flags_select" on public.maintenance_flags for select using (true);

insert into public.maintenance_flags (key, message) values ('bank', 'La banque et la bourse sont temporairement fermées.')
on conflict (key) do nothing;

create or replace function public.is_feature_enabled(p_key text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_enabled from public.maintenance_flags where key = p_key), true);
$$;

insert into public.app_config (key, value) values
  ('market_tick_minutes', '60'),
  ('market_reversion', '0.05'),
  ('market_volatility', '0.012'),
  ('market_news_probability', '0.03'),
  ('market_news_magnitude', '0.08'),
  ('market_profit_multiple', '8'),
  ('market_dividend_multiple', '4'),
  ('market_goodwill_half_life_days', '21'),
  ('market_liquidity_factor', '2'),
  ('market_fee_rate', '0.002'),
  ('market_admin_fee_per_share', '0.5'),
  ('market_min_holding_minutes', '30'),
  ('market_last_tick_at', now()::text)
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- Survaleur de départ + catégorisation des mouvements de trésorerie
-- ---------------------------------------------------------
alter table public.businesses add column if not exists initial_valuation numeric(18,2);

update public.businesses b
  set initial_valuation = coalesce(
    (select h.price from public.business_share_price_history h where h.business_id = b.id order by h.recorded_at asc limit 1),
    b.share_price
  ) * b.share_count
  where initial_valuation is null;

alter table public.business_transactions add column if not exists kind text;

create or replace function public.business_tx_kind(p_reason text)
returns text
language sql
immutable
as $$
  select case
    when p_reason like 'Vente :%' then 'sale'
    when p_reason like 'Salaire%' then 'salary'
    when p_reason like 'Intérêts%' then 'interest'
    when p_reason like 'Dividende%' then 'dividend'
    when p_reason like 'Reversement%' then 'subsidy'
    when p_reason like 'Filet de liquidité%' then 'subsidy'
    when p_reason like 'Emprunt%' or p_reason like 'Remboursement%' then 'loan'
    when p_reason like 'Apport%' or p_reason like 'Retrait%' then 'capital'
    when p_reason like 'Achat de%' or p_reason like 'Rachat%' then 'shares'
    else 'other'
  end;
$$;

update public.business_transactions set kind = public.business_tx_kind(reason) where kind is null;

create or replace function public.classify_business_transaction()
returns trigger
language plpgsql
as $$
begin
  if new.kind is null then
    new.kind := public.business_tx_kind(new.reason);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_classify_business_tx on public.business_transactions;
create trigger trg_classify_business_tx
  before insert on public.business_transactions
  for each row execute function public.classify_business_transaction();

create index if not exists business_transactions_business_kind_idx
  on public.business_transactions (business_id, kind, created_at);

-- ---------------------------------------------------------
-- Lots d'achat, pour l'anti-spéculation (délai de détention minimum, FIFO).
-- ---------------------------------------------------------
create table if not exists public.business_share_lots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity int not null check (quantity > 0),
  bought_at timestamptz not null default now()
);

alter table public.business_share_lots enable row level security;

drop policy if exists "business_share_lots_select" on public.business_share_lots;
create policy "business_share_lots_select" on public.business_share_lots for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.founder_id = auth.uid())
    or public.has_permission(auth.uid(), 'manage_economy')
  );

create index if not exists business_share_lots_lookup_idx
  on public.business_share_lots (business_id, user_id, bought_at);

-- Répartit un montant à parts égales entre les comptes admin actifs
-- (fondateur ou permission manage_users), versé IMMÉDIATEMENT — pas
-- d'attente de la redistribution hebdomadaire de la caisse commune.
-- Repli sur la caisse commune si aucun admin n'existe (ne devrait jamais
-- arriver en pratique, il y a toujours au moins le fondateur).
create or replace function public.credit_admins_equally(p_amount numeric, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
  v_share numeric(18,2);
  r record;
begin
  if p_amount is null or p_amount <= 0 then
    return;
  end if;

  select count(*) into v_count from public.profiles
    where status = 'active' and (is_founder or public.has_permission(id, 'manage_users'));

  if v_count = 0 then
    update public.tax_pool set balance = balance + p_amount where id = true;
    return;
  end if;

  v_share := round(p_amount / v_count, 2);

  for r in
    select id from public.profiles
    where status = 'active' and (is_founder or public.has_permission(id, 'manage_users'))
  loop
    update public.wallets set balance = balance + v_share where user_id = r.id;
    insert into public.transactions (user_id, amount, reason, created_by)
    values (r.id, v_share, p_reason, r.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------
-- Fondamentaux d'une entreprise (chiffres "publiés", visibles de tous les
-- investisseurs, comme des comptes annuels) — c'est ce qui pilote le cours.
-- ---------------------------------------------------------
create or replace function public.compute_business_fundamentals(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
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
  if v_b.id is null then
    return null;
  end if;

  select
    coalesce(sum(amount) filter (where kind = 'sale'), 0),
    coalesce(-sum(amount) filter (where kind in ('salary', 'interest')), 0)
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
    ) / v_b.share_count
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

-- ---------------------------------------------------------
-- Tick de marché : marche aléatoire avec retour vers la valeur intrinsèque.
-- ---------------------------------------------------------
create or replace function public.process_market()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_cap constant int := 72;
  v_last timestamptz;
  v_tick numeric;
  v_ticks int;
  v_n int;
  v_start timestamptz;
  v_reversion numeric;
  v_base_vol numeric;
  v_news_p numeric;
  v_news_m numeric;
  b record;
  v_fair numeric;
  v_price numeric;
  v_vol numeric;
  v_revert numeric;
  v_noise numeric;
  v_shock numeric;
  v_step numeric;
  i int;
begin
  select value::timestamptz into v_last from public.app_config where key = 'market_last_tick_at' for update;
  if v_last is null then
    insert into public.app_config (key, value) values ('market_last_tick_at', now()::text)
      on conflict (key) do update set value = excluded.value;
    return 0;
  end if;

  v_tick := greatest(1, public.get_config_numeric('market_tick_minutes', 60));
  v_ticks := floor(extract(epoch from (now() - v_last)) / 60.0 / v_tick)::int;
  if v_ticks < 1 then
    return 0;
  end if;

  v_n := least(v_ticks, v_cap);
  v_start := v_last + ((v_ticks - v_n) * v_tick)::float8 * interval '1 minute';

  v_reversion := public.get_config_numeric('market_reversion', 0.05);
  v_base_vol := public.get_config_numeric('market_volatility', 0.012);
  v_news_p := public.get_config_numeric('market_news_probability', 0.03);
  v_news_m := public.get_config_numeric('market_news_magnitude', 0.08);

  for b in select * from public.businesses where not is_closed loop
    v_fair := (public.compute_business_fundamentals(b.id)->>'fair_value')::numeric;
    v_price := b.share_price;
    -- Les petites capitalisations sont plus volatiles.
    v_vol := v_base_vol * (1 + 1.5 * exp(-(b.share_price * b.share_count) / 50000.0));

    for i in 1..v_n loop
      v_revert := greatest(-0.2, least(0.2, v_reversion * ln(v_fair / v_price)));
      v_noise := (random() + random() + random() - 1.5) * 2 * v_vol; -- ~ gaussien, écart-type v_vol
      v_shock := 0;
      if random() < v_news_p then
        v_shock := (random() - 0.5) * 2 * v_news_m;
      end if;
      v_step := greatest(-0.25, least(0.25, v_revert + v_noise + v_shock));
      v_price := greatest(0.01, round(v_price * exp(v_step), 4));

      insert into public.business_share_price_history (business_id, price, recorded_at)
      values (b.id, v_price, v_start + (i * v_tick)::float8 * interval '1 minute');
    end loop;

    update public.businesses set share_price = v_price where id = b.id;
  end loop;

  update public.app_config
    set value = (v_last + (v_ticks * v_tick)::float8 * interval '1 minute')::text
    where key = 'market_last_tick_at';

  return v_n;
end;
$$;

-- Le traitement quotidien existant devient "core" ; le nouveau
-- process_daily_economy() l'appelle puis fait tourner le marché.
-- (Le front continue d'appeler process_daily_economy, rien à changer.)
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'process_daily_economy_core'
  ) then
    return;
  end if;
  alter function public.process_daily_economy() rename to process_daily_economy_core;
end;
$$;

revoke execute on function public.process_daily_economy_core() from public, anon, authenticated;
revoke execute on function public.process_market() from public, anon, authenticated;

create or replace function public.process_daily_economy()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.process_daily_economy_core();
  perform public.process_market();
end;
$$;

-- ---------------------------------------------------------
-- Création d'entreprise : mémorise la valorisation de départ.
-- ---------------------------------------------------------
create or replace function public.create_business(p_name text, p_description text, p_share_count int, p_initial_price numeric)
returns public.businesses
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
begin
  if not public.has_permission(auth.uid(), 'entreprise') then
    raise exception 'Permission refusée';
  end if;
  if p_share_count < 1 then
    raise exception 'Nombre d''actions invalide';
  end if;
  if p_initial_price <= 0 then
    raise exception 'Prix de départ invalide';
  end if;

  insert into public.businesses (name, description, founder_id, share_count, shares_in_treasury, share_price, initial_valuation)
  values (p_name, p_description, auth.uid(), p_share_count, p_share_count, p_initial_price, round(p_share_count * p_initial_price, 2))
  returning * into v_business;

  insert into public.business_share_price_history (business_id, price)
  values (v_business.id, p_initial_price);

  return v_business;
end;
$$;

-- ---------------------------------------------------------
-- Achat : impact proportionnel à la part du capital échangée, prix
-- d'exécution moyen (slippage), frais % (caisse commune) + frais fixe par
-- action (comptes admin, immédiat), et création d'un lot horodaté.
-- ---------------------------------------------------------
create or replace function public.buy_business_shares(p_business_id uuid, p_quantity int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_balance numeric(18,2);
  v_impact numeric;
  v_exec numeric;
  v_total numeric(18,2);
  v_fee numeric(18,2);
  v_admin_fee numeric(18,2);
begin
  if p_quantity < 1 then
    raise exception 'Quantité invalide';
  end if;
  if coalesce((select is_frozen from public.profiles where id = auth.uid()), false) then
    raise exception 'Ton compte est gelé : impossible d''investir tant que la sanction est active.';
  end if;
  if not public.is_feature_enabled('bank') then
    raise exception 'La bourse est temporairement fermée par l''administration.';
  end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if v_business.is_closed then
    raise exception 'Cette entreprise est fermée.';
  end if;
  if v_business.shares_in_treasury < p_quantity then
    raise exception 'Il ne reste que % action(s) disponible(s).', v_business.shares_in_treasury;
  end if;

  select balance into v_balance from public.wallets where user_id = auth.uid() for update;
  if v_balance is not null and v_balance < 0 then
    raise exception 'Ton solde est négatif : règle-le avant d''investir.';
  end if;

  v_impact := least(0.5, (p_quantity::numeric / v_business.share_count) * public.get_config_numeric('market_liquidity_factor', 2));
  v_exec := v_business.share_price * (1 + v_impact / 2);
  v_total := round(v_exec * p_quantity, 2);
  v_fee := round(v_total * public.get_config_numeric('market_fee_rate', 0.002), 2);
  v_admin_fee := round(public.get_config_numeric('market_admin_fee_per_share', 0.5) * p_quantity, 2);

  if v_balance is null or v_balance < v_total + v_fee + v_admin_fee then
    raise exception 'Solde insuffisant (% Cr. nécessaires, frais inclus).', v_total + v_fee + v_admin_fee;
  end if;

  update public.wallets set balance = balance - (v_total + v_fee + v_admin_fee) where user_id = auth.uid();

  update public.businesses
    set treasury_balance = treasury_balance + v_total,
        shares_in_treasury = shares_in_treasury - p_quantity,
        share_price = round(share_price * (1 + v_impact), 4)
    where id = p_business_id;

  insert into public.business_shareholders (business_id, user_id, quantity)
  values (p_business_id, auth.uid(), p_quantity)
  on conflict (business_id, user_id) do update set quantity = public.business_shareholders.quantity + p_quantity;

  insert into public.business_share_lots (business_id, user_id, quantity)
  values (p_business_id, auth.uid(), p_quantity);

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, v_total, 'Achat de ' || p_quantity || ' action(s) par un investisseur', auth.uid());

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), -(v_total + v_fee + v_admin_fee), 'Achat d''actions : ' || v_business.name, auth.uid());

  update public.tax_pool set balance = balance + v_fee where id = true;

  perform public.credit_admins_equally(v_admin_fee, 'Frais de courtage — achat d''actions : ' || v_business.name);

  insert into public.business_share_price_history (business_id, price)
  select id, share_price from public.businesses where id = p_business_id;
end;
$$;

-- ---------------------------------------------------------
-- Vente : n'autorise que les actions détenues depuis au moins
-- market_min_holding_minutes (FIFO sur les lots), et garantit que
-- l'entreprise peut toujours racheter au moins une action — la caisse
-- commune avance le manque de trésorerie si besoin, et un ordre trop
-- gros pour la trésorerie disponible est exécuté PARTIELLEMENT plutôt
-- que rejeté.
-- ---------------------------------------------------------
create or replace function public.sell_business_shares(p_business_id uuid, p_quantity int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_holding int;
  v_min_hold numeric;
  v_eligible int;
  v_topup numeric(18,2);
  v_tax_bal numeric(18,2);
  v_max_affordable int;
  v_exec_qty int;
  v_impact numeric;
  v_exec numeric;
  v_total numeric(18,2);
  v_fee numeric(18,2);
  v_remaining int;
  r record;
  v_take int;
begin
  if p_quantity < 1 then
    raise exception 'Quantité invalide';
  end if;
  if coalesce((select is_frozen from public.profiles where id = auth.uid()), false) then
    raise exception 'Ton compte est gelé : impossible de vendre tant que la sanction est active.';
  end if;
  if not public.is_feature_enabled('bank') then
    raise exception 'La bourse est temporairement fermée par l''administration.';
  end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;

  select quantity into v_holding from public.business_shareholders where business_id = p_business_id and user_id = auth.uid();
  if v_holding is null or v_holding < p_quantity then
    raise exception 'Tu ne possèdes pas assez d''actions.';
  end if;

  -- Anti-spéculation : seules les actions détenues depuis assez longtemps
  -- sont éligibles à la revente (empêche l'aller-retour achat/vente immédiat).
  v_min_hold := public.get_config_numeric('market_min_holding_minutes', 30);
  select coalesce(sum(quantity), 0) into v_eligible
  from public.business_share_lots
  where business_id = p_business_id and user_id = auth.uid()
    and bought_at <= now() - (v_min_hold || ' minutes')::interval;

  if v_eligible < p_quantity then
    raise exception 'Délai de détention minimum non écoulé (% min, anti-spéculation) : tu peux revendre % action(s) pour l''instant, pas %.',
      v_min_hold, v_eligible, p_quantity;
  end if;

  -- Garantie de liquidité : au moins 1 action doit toujours être rachetable.
  if v_business.treasury_balance < v_business.share_price then
    select balance into v_tax_bal from public.tax_pool where id = true for update;
    v_topup := least(v_business.share_price - v_business.treasury_balance, greatest(v_tax_bal, 0));
    if v_topup > 0 then
      update public.businesses set treasury_balance = treasury_balance + v_topup where id = p_business_id;
      update public.tax_pool set balance = balance - v_topup where id = true;
      insert into public.business_transactions (business_id, amount, reason, created_by)
      values (p_business_id, v_topup, 'Filet de liquidité (caisse commune)', auth.uid());
      v_business.treasury_balance := v_business.treasury_balance + v_topup;
    end if;
  end if;

  v_max_affordable := floor(v_business.treasury_balance / greatest(v_business.share_price, 0.01));
  v_exec_qty := least(p_quantity, greatest(v_max_affordable, 0));
  if v_exec_qty < 1 then
    raise exception 'L''entreprise n''a pas assez de trésorerie pour racheter des actions actuellement, même avec le filet de liquidité de la caisse commune.';
  end if;

  v_impact := least(0.5, (v_exec_qty::numeric / v_business.share_count) * public.get_config_numeric('market_liquidity_factor', 2));
  v_exec := v_business.share_price * (1 - v_impact / 2);
  v_total := round(v_exec * v_exec_qty, 2);
  v_fee := round(v_total * public.get_config_numeric('market_fee_rate', 0.002), 2);

  -- Consomme les lots les plus anciens en premier (FIFO), à hauteur de v_exec_qty.
  v_remaining := v_exec_qty;
  for r in
    select id, quantity from public.business_share_lots
    where business_id = p_business_id and user_id = auth.uid()
      and bought_at <= now() - (v_min_hold || ' minutes')::interval
    order by bought_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, r.quantity);
    if v_take = r.quantity then
      delete from public.business_share_lots where id = r.id;
    else
      update public.business_share_lots set quantity = quantity - v_take where id = r.id;
    end if;
    v_remaining := v_remaining - v_take;
  end loop;

  update public.business_shareholders set quantity = quantity - v_exec_qty
    where business_id = p_business_id and user_id = auth.uid();

  update public.businesses
    set treasury_balance = treasury_balance - v_total,
        shares_in_treasury = shares_in_treasury + v_exec_qty,
        share_price = greatest(0.01, round(share_price * (1 - v_impact), 4))
    where id = p_business_id;

  update public.wallets set balance = balance + (v_total - v_fee) where user_id = auth.uid();

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, -v_total, 'Rachat de ' || v_exec_qty || ' action(s) à un actionnaire', auth.uid());

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), v_total - v_fee, 'Vente d''actions : ' || v_business.name, auth.uid());

  update public.tax_pool set balance = balance + v_fee where id = true;

  insert into public.business_share_price_history (business_id, price)
  select id, share_price from public.businesses where id = p_business_id;

  return jsonb_build_object('requested', p_quantity, 'sold', v_exec_qty, 'net_received', v_total - v_fee, 'partial', v_exec_qty < p_quantity);
end;
$$;

-- ---------------------------------------------------------
-- Lecture : vue d'ensemble du marché + réglages publics + historique
-- (les 300 points les plus RÉCENTS, dans l'ordre chronologique).
-- ---------------------------------------------------------
create or replace function public.list_market_overview()
returns setof jsonb
language sql
stable
security definer set search_path = public
as $$
  select
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'description', b.description,
      'share_price', b.share_price,
      'share_count', b.share_count,
      'shares_in_treasury', b.shares_in_treasury,
      'treasury_balance', b.treasury_balance,
      'debt_principal', b.debt_principal,
      'change_24h_pct', coalesce(round((b.share_price / nullif((
        select h.price from public.business_share_price_history h
        where h.business_id = b.id and h.recorded_at <= now() - interval '24 hours'
        order by h.recorded_at desc limit 1
      ), 0) - 1) * 100, 2), 0)
    ) || public.compute_business_fundamentals(b.id)
  from public.businesses b
  where not b.is_closed
  order by b.share_price * b.share_count desc;
$$;

create or replace function public.get_market_settings()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'liquidity_factor', public.get_config_numeric('market_liquidity_factor', 2),
    'fee_rate', public.get_config_numeric('market_fee_rate', 0.002),
    'admin_fee_per_share', public.get_config_numeric('market_admin_fee_per_share', 0.5),
    'min_holding_minutes', public.get_config_numeric('market_min_holding_minutes', 30),
    'tick_minutes', public.get_config_numeric('market_tick_minutes', 60)
  );
$$;

-- Combien de mes actions d'une entreprise sont revendables tout de suite
-- (délai de détention écoulé) — utile pour l'interface.
create or replace function public.get_my_sellable_shares(p_business_id uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
  select coalesce(sum(quantity), 0)::int
  from public.business_share_lots
  where business_id = p_business_id and user_id = auth.uid()
    and bought_at <= now() - (public.get_config_numeric('market_min_holding_minutes', 30) || ' minutes')::interval;
$$;

create or replace function public.get_business_price_history(p_business_id uuid)
returns setof public.business_share_price_history
language sql
stable
security definer set search_path = public
as $$
  select * from (
    select * from public.business_share_price_history
    where business_id = p_business_id
    order by recorded_at desc
    limit 300
  ) t
  order by recorded_at asc;
$$;
