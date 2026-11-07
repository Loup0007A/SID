-- =====================================================================
-- Lot 69 (2/3) : bourse à carnet d'ordres. Rejouable. Après 0084.
--
-- Les actions s'échangent entre investisseurs : membres, population
-- simulée, et l'entreprise elle-même pour les actions qu'elle n'a pas
-- encore placées. Chacun pose un ordre d'achat ou de vente à un prix
-- limite (ou « au marché ») ; un ordre qui croise le meilleur ordre opposé
-- est exécuté au prix de ce dernier (priorité prix puis ancienneté). Le
-- cours est celui du dernier échange.
--
-- La population sert de teneur de marché : chaque heure, elle affiche des
-- prix d'achat et de vente autour de sa propre estimation (cours, valeur
-- des fondamentaux, actualités) avec un écart d'autant plus large que
-- l'entreprise est petite, et elle passe des ordres qui font bouger le
-- cours. L'entreprise propose ses actions non placées un peu au-dessus.
--
-- Coupe-circuit : un échange à plus de 20 % du cours de clôture de la veille
-- suspend la cotation une heure (la nouvelle référence est la borne).
-- Frais inchangés : 0,2 % de chaque côté (caisse commune) et 0,5 z par
-- action achetée par un membre (administration). Détention minimale de
-- 30 minutes avant de revendre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
alter table public.business_shareholders add column if not exists locked int not null default 0;
alter table public.sim_shareholdings add column if not exists locked int not null default 0;
alter table public.businesses add column if not exists halted_until timestamptz;
alter table public.businesses add column if not exists ref_price numeric(15, 4);
alter table public.businesses add column if not exists ref_day date;
alter table public.businesses add column if not exists index_prev_price numeric(15, 4);
alter table public.businesses add column if not exists last_trade_at timestamptz;

create table if not exists public.market_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  side text not null check (side in ('buy', 'sell')),
  trader text not null check (trader in ('membre', 'population', 'entreprise')),
  user_id uuid references public.profiles(id) on delete cascade,
  agent_id uuid references public.sim_agents(id) on delete cascade,
  quantity int not null check (quantity > 0),
  remaining int not null check (remaining >= 0),
  limit_price numeric(18, 4) not null check (limit_price > 0),
  status text not null default 'open' check (status in ('open', 'filled', 'cancelled', 'expired')),
  note text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  closed_at timestamptz
);
create index if not exists market_orders_book_idx on public.market_orders (business_id, side, limit_price, created_at) where status = 'open';
create index if not exists market_orders_user_idx on public.market_orders (user_id, created_at desc) where user_id is not null;
create index if not exists market_orders_trader_idx on public.market_orders (business_id, trader) where status = 'open';

create table if not exists public.market_trades (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  price numeric(18, 4) not null,
  quantity int not null,
  buyer text not null,
  buyer_user uuid,
  seller text not null,
  seller_user uuid,
  aggressor text check (aggressor in ('buy', 'sell')),
  buy_order uuid,
  sell_order uuid,
  at timestamptz not null default now()
);
alter table public.market_trades add column if not exists buy_order uuid;
alter table public.market_trades add column if not exists sell_order uuid;
create index if not exists market_trades_business_idx on public.market_trades (business_id, at desc);

create table if not exists public.market_candles (
  business_id uuid not null references public.businesses(id) on delete cascade,
  day date not null,
  open numeric(18, 4) not null,
  high numeric(18, 4) not null,
  low numeric(18, 4) not null,
  close numeric(18, 4) not null,
  volume int not null default 0,
  value numeric(20, 2) not null default 0,
  primary key (business_id, day)
);

create table if not exists public.market_index_history (
  at timestamptz primary key default now(),
  value numeric(14, 4) not null,
  cap numeric(22, 2)
);

alter table public.market_orders enable row level security;
alter table public.market_trades enable row level security;
alter table public.market_candles enable row level security;
alter table public.market_index_history enable row level security;
drop policy if exists "market_orders_own" on public.market_orders;
create policy "market_orders_own" on public.market_orders for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));
drop policy if exists "market_candles_read" on public.market_candles;
create policy "market_candles_read" on public.market_candles for select to authenticated using (true);
drop policy if exists "market_index_read" on public.market_index_history;
create policy "market_index_read" on public.market_index_history for select to authenticated using (true);
revoke all on public.market_orders, public.market_trades, public.market_candles, public.market_index_history from anon;
revoke insert, update, delete on public.market_orders, public.market_trades, public.market_candles, public.market_index_history from authenticated;
revoke select on public.market_trades from authenticated;
grant select on public.market_orders, public.market_candles, public.market_index_history to authenticated;

-- La demande d'actions se mesure maintenant aux ventes de l'entreprise.
drop trigger if exists businesses_track_share_demand on public.businesses;

do $$
begin
  insert into public.app_config (key, value) values
    ('market_circuit_breaker_pct', '0.2'),
    ('market_halt_minutes', '60'),
    ('market_order_days', '7'),
    ('market_max_open_orders', '20')
  on conflict (key) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Outils
-- ---------------------------------------------------------------------
create or replace function public._market_today()
returns date
language sql stable
as $$ select (now() at time zone public.stats_timezone())::date; $$;

-- Cours de référence du jour (clôture de la veille) pour le coupe-circuit.
create or replace function public._market_ref(p_business uuid)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  b public.businesses;
begin
  select * into b from public.businesses where id = p_business;
  if b.ref_day is distinct from public._market_today() or b.ref_price is null then
    update public.businesses set ref_price = share_price, ref_day = public._market_today() where id = p_business;
    return b.share_price;
  end if;
  return b.ref_price;
end;
$$;

-- Enregistre un échange : historique, bougie du jour, cours.
drop function if exists public._market_record(uuid, numeric, int, text, uuid, text, uuid, text);
create or replace function public._market_record(
  p_business uuid, p_price numeric, p_qty int, p_buyer text, p_buyer_user uuid, p_seller text, p_seller_user uuid, p_aggr text,
  p_buy_order uuid, p_sell_order uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_day date := public._market_today();
begin
  insert into public.market_trades (business_id, price, quantity, buyer, buyer_user, seller, seller_user, aggressor, buy_order, sell_order)
  values (p_business, p_price, p_qty, p_buyer, p_buyer_user, p_seller, p_seller_user, p_aggr, p_buy_order, p_sell_order);
  insert into public.market_candles (business_id, day, open, high, low, close, volume, value)
  values (p_business, v_day, p_price, p_price, p_price, p_price, p_qty, round(p_price * p_qty, 2))
  on conflict (business_id, day) do update set
    high = greatest(public.market_candles.high, excluded.high),
    low = least(public.market_candles.low, excluded.low),
    close = excluded.close,
    volume = public.market_candles.volume + excluded.volume,
    value = public.market_candles.value + excluded.value;
  update public.businesses set share_price = p_price, last_trade_at = now() where id = p_business;
  insert into public.business_share_price_history (business_id, price) values (p_business, p_price);
end;
$$;

-- Ferme un ordre et libère ce qu'il bloquait (actions d'un vendeur).
create or replace function public._market_close_order(p_order uuid, p_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  o public.market_orders;
begin
  update public.market_orders set status = p_status, closed_at = now(), note = coalesce(p_note, note)
  where id = p_order and status = 'open'
  returning * into o;
  if o.id is null or o.side <> 'sell' or o.remaining <= 0 then return; end if;
  if o.trader = 'membre' then
    update public.business_shareholders set locked = greatest(locked - o.remaining, 0)
    where business_id = o.business_id and user_id = o.user_id;
  elsif o.trader = 'population' then
    update public.sim_shareholdings set locked = greatest(locked - o.remaining, 0)
    where business_id = o.business_id and agent_id = o.agent_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Exécution d'un échange
-- ---------------------------------------------------------------------
create or replace function public._market_settle(p_buy uuid, p_sell uuid, p_qty int, p_price numeric, p_aggr text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  bo public.market_orders;
  so public.market_orders;
  b public.businesses;
  v_fee_rate numeric := public.get_config_numeric('market_fee_rate', 0.002);
  v_admin_per numeric := public.get_config_numeric('market_admin_fee_per_share', 0.5);
  v_bal numeric;
  v_qty int := p_qty;
  v_value numeric(18, 2);
  v_fee_b numeric(18, 2) := 0;
  v_fee_s numeric(18, 2) := 0;
  v_admin numeric(18, 2) := 0;
  v_free int;
  v_left int;
  r record;
  v_take int;
  v_line text;
begin
  select * into bo from public.market_orders where id = p_buy for update;
  select * into so from public.market_orders where id = p_sell for update;
  select * into b from public.businesses where id = bo.business_id for update;
  v_qty := least(v_qty, bo.remaining, so.remaining);
  if v_qty < 1 then return 0; end if;

  -- L'acheteur peut-il payer ? Sinon son ordre tombe.
  if bo.trader = 'membre' then
    select balance into v_bal from public.wallets where user_id = bo.user_id for update;
    v_qty := least(v_qty, floor(coalesce(v_bal, 0) / (p_price * (1 + v_fee_rate) + v_admin_per))::int);
  elsif bo.trader = 'population' then
    select balance into v_bal from public.sim_agents where id = bo.agent_id for update;
    v_qty := least(v_qty, floor(coalesce(v_bal, 0) / (p_price * (1 + v_fee_rate)))::int);
  end if;
  if v_qty < 1 then
    perform public._market_close_order(bo.id, 'cancelled', 'Solde insuffisant au moment de l''échange');
    if bo.trader = 'membre' then
      perform public._notify_grouped(bo.user_id, 'market', 'ordres', 'Ordre annulé',
        'Achat ' || b.name || ' : solde insuffisant au moment de l''échange.', null, 'ordres', '/dashboard/bourse');
    end if;
    return 0;
  end if;

  -- Le vendeur a-t-il encore ses actions ?
  if so.trader = 'entreprise' then
    v_qty := least(v_qty, b.shares_in_treasury);
  elsif so.trader = 'membre' then
    select least(locked, quantity) into v_free from public.business_shareholders where business_id = b.id and user_id = so.user_id for update;
    v_qty := least(v_qty, coalesce(v_free, 0));
  else
    select least(locked, quantity) into v_free from public.sim_shareholdings where business_id = b.id and agent_id = so.agent_id for update;
    v_qty := least(v_qty, coalesce(v_free, 0));
  end if;
  if v_qty < 1 then
    perform public._market_close_order(so.id, 'cancelled', 'Actions indisponibles');
    return 0;
  end if;

  v_value := round(v_qty * p_price, 2);
  if bo.trader <> 'entreprise' then v_fee_b := round(v_value * v_fee_rate, 2); end if;
  if so.trader <> 'entreprise' then v_fee_s := round(v_value * v_fee_rate, 2); end if;
  if bo.trader = 'membre' then v_admin := round(v_admin_per * v_qty, 2); end if;

  -- Acheteur.
  if bo.trader = 'membre' then
    update public.wallets set balance = balance - (v_value + v_fee_b + v_admin) where user_id = bo.user_id;
    insert into public.transactions (user_id, amount, reason, created_by)
    values (bo.user_id, -(v_value + v_fee_b + v_admin), 'Achat d''actions : ' || b.name || ' (' || v_qty || ' × ' || round(p_price, 2) || ' z)', bo.user_id);
    insert into public.business_shareholders (business_id, user_id, quantity) values (b.id, bo.user_id, v_qty)
    on conflict (business_id, user_id) do update set quantity = public.business_shareholders.quantity + v_qty;
    insert into public.business_share_lots (business_id, user_id, quantity) values (b.id, bo.user_id, v_qty);
  elsif bo.trader = 'population' then
    update public.sim_agents set balance = balance - (v_value + v_fee_b) where id = bo.agent_id;
    insert into public.sim_shareholdings (agent_id, business_id, quantity) values (bo.agent_id, b.id, v_qty)
    on conflict (agent_id, business_id) do update set quantity = public.sim_shareholdings.quantity + v_qty;
  end if;

  -- Vendeur.
  if so.trader = 'membre' then
    update public.business_shareholders set quantity = quantity - v_qty, locked = locked - v_qty
    where business_id = b.id and user_id = so.user_id;
    v_left := v_qty;
    for r in select id, quantity from public.business_share_lots
             where business_id = b.id and user_id = so.user_id order by bought_at for update loop
      exit when v_left <= 0;
      v_take := least(v_left, r.quantity);
      if v_take = r.quantity then delete from public.business_share_lots where id = r.id;
      else update public.business_share_lots set quantity = quantity - v_take where id = r.id; end if;
      v_left := v_left - v_take;
    end loop;
    update public.wallets set balance = balance + (v_value - v_fee_s) where user_id = so.user_id;
    insert into public.transactions (user_id, amount, reason, created_by)
    values (so.user_id, v_value - v_fee_s, 'Vente d''actions : ' || b.name || ' (' || v_qty || ' × ' || round(p_price, 2) || ' z)', so.user_id);
  elsif so.trader = 'population' then
    update public.sim_shareholdings set quantity = quantity - v_qty, locked = locked - v_qty
    where business_id = b.id and agent_id = so.agent_id;
    update public.sim_agents set balance = balance + (v_value - v_fee_s) where id = so.agent_id;
  else
    update public.businesses
      set shares_in_treasury = shares_in_treasury - v_qty,
          treasury_balance = treasury_balance + v_value,
          demand_shares = coalesce(demand_shares, 0) + v_qty
      where id = b.id;
    insert into public.business_transactions (business_id, amount, reason, created_by)
    values (b.id, v_value, 'Achat de ' || v_qty || ' action(s) par un investisseur', bo.user_id);
  end if;

  if v_fee_b + v_fee_s > 0 then
    update public.tax_pool set balance = balance + v_fee_b + v_fee_s where id = true;
  end if;
  if v_admin > 0 then
    perform public.credit_admins_equally(v_admin, 'Frais de courtage — achat d''actions : ' || b.name);
  end if;

  update public.market_orders
    set remaining = remaining - v_qty,
        status = case when remaining - v_qty = 0 then 'filled' else status end,
        closed_at = case when remaining - v_qty = 0 then now() else closed_at end
    where id in (bo.id, so.id);

  perform public._market_record(b.id, p_price, v_qty, bo.trader, bo.user_id, so.trader, so.user_id, p_aggr, bo.id, so.id);

  -- Le membre dont l'ordre attendait dans le carnet est prévenu (regroupé).
  v_line := v_qty || ' × ' || b.name || ' à ' || replace(round(p_price, 2)::text, '.', ',') || ' z';
  if bo.trader = 'membre' and p_aggr = 'sell' then
    perform public._notify_grouped(bo.user_id, 'market', 'ordres', 'Ordre exécuté', 'Achat : ' || v_line, -(v_value + v_fee_b + v_admin), 'ordres exécutés', '/dashboard/bourse');
  end if;
  if so.trader = 'membre' and p_aggr = 'buy' then
    perform public._notify_grouped(so.user_id, 'market', 'ordres', 'Ordre exécuté', 'Vente : ' || v_line, v_value - v_fee_s, 'ordres exécutés', '/dashboard/bourse');
  end if;
  return v_qty;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Appariement d'un ordre avec le carnet
-- ---------------------------------------------------------------------
create or replace function public._market_match(p_order uuid, p_ioc boolean default false)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  o public.market_orders;
  r public.market_orders;
  b public.businesses;
  v_ref numeric;
  v_band numeric := public.get_config_numeric('market_circuit_breaker_pct', 0.2);
  v_done int;
  v_total int := 0;
  v_guard int := 0;
begin
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 200;
    select * into o from public.market_orders where id = p_order;
    exit when o.status <> 'open' or o.remaining <= 0;
    select * into b from public.businesses where id = o.business_id;
    exit when b.is_closed or (b.halted_until is not null and b.halted_until > now());

    if o.side = 'buy' then
      select * into r from public.market_orders x
      where x.business_id = o.business_id and x.side = 'sell' and x.status = 'open' and x.remaining > 0
        and x.limit_price <= o.limit_price
        and not (x.trader = 'membre' and o.trader = 'membre' and x.user_id = o.user_id)
        and not (x.trader = 'population' and o.trader = 'population' and x.agent_id = o.agent_id)
      order by x.limit_price asc, x.created_at asc
      limit 1;
    else
      select * into r from public.market_orders x
      where x.business_id = o.business_id and x.side = 'buy' and x.status = 'open' and x.remaining > 0
        and x.limit_price >= o.limit_price
        and not (x.trader = 'membre' and o.trader = 'membre' and x.user_id = o.user_id)
        and not (x.trader = 'population' and o.trader = 'population' and x.agent_id = o.agent_id)
      order by x.limit_price desc, x.created_at asc
      limit 1;
    end if;
    exit when r.id is null;

    -- Coupe-circuit : au-delà de ±20 % de la référence, cotation suspendue.
    v_ref := public._market_ref(o.business_id);
    if r.limit_price > v_ref * (1 + v_band) or r.limit_price < v_ref * (1 - v_band) then
      update public.businesses
        set halted_until = now() + make_interval(mins => public.get_config_numeric('market_halt_minutes', 60)::int),
            ref_price = round(case when r.limit_price > v_ref then v_ref * (1 + v_band) else v_ref * (1 - v_band) end, 4)
        where id = o.business_id;
      exit;
    end if;

    if o.side = 'buy' then
      v_done := public._market_settle(o.id, r.id, o.remaining, r.limit_price, 'buy');
    else
      v_done := public._market_settle(r.id, o.id, o.remaining, r.limit_price, 'sell');
    end if;
    v_total := v_total + v_done;
  end loop;

  if p_ioc then
    perform public._market_close_order(p_order, 'cancelled', 'Reste non exécuté (ordre au marché)');
  end if;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Ordres des membres
-- ---------------------------------------------------------------------
create or replace function public.market_order(
  p_business uuid, p_side text, p_quantity int, p_limit numeric default null, p_days int default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  b public.businesses;
  v_fee_rate numeric := public.get_config_numeric('market_fee_rate', 0.002);
  v_admin_per numeric := public.get_config_numeric('market_admin_fee_per_share', 0.5);
  v_min_hold numeric := public.get_config_numeric('market_min_holding_minutes', 30);
  v_market boolean := p_limit is null;
  v_limit numeric;
  v_best numeric;
  v_bal numeric;
  v_holding public.business_shareholders;
  v_eligible int;
  v_id uuid;
  v_filled int;
  v_avg numeric;
  v_days int := least(greatest(coalesce(p_days, public.get_config_numeric('market_order_days', 7)::int), 1), 30);
  v_cost numeric;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_side not in ('buy', 'sell') then raise exception 'Sens d''ordre inconnu.'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then raise exception 'Quantité invalide.'; end if;
  if coalesce((select is_frozen from public.profiles where id = v_uid), false) then
    raise exception 'Ton compte est gelé : impossible de passer un ordre tant que la sanction est active.';
  end if;
  if not public.is_feature_enabled('bank') then raise exception 'La bourse est temporairement fermée par l''administration.'; end if;

  select * into b from public.businesses where id = p_business;
  if b.id is null or b.is_closed then raise exception 'Entreprise introuvable ou fermée.'; end if;
  if b.halted_until is not null and b.halted_until > now() then
    raise exception 'Cotation suspendue jusqu''à % (variation de plus de 20 %% dans la journée).',
      to_char(b.halted_until at time zone public.stats_timezone(), 'HH24"h"MI');
  end if;
  if (select count(*) from public.market_orders where user_id = v_uid and status = 'open')
     >= public.get_config_numeric('market_max_open_orders', 20) then
    raise exception 'Trop d''ordres ouverts : annule-en avant d''en poser un autre.';
  end if;

  -- Prix limite. Au marché : meilleure offre opposée ± 5 % de protection.
  if v_market then
    if p_side = 'buy' then
      select min(limit_price) into v_best from public.market_orders where business_id = b.id and side = 'sell' and status = 'open';
      v_limit := round(coalesce(v_best, b.share_price) * 1.05, 4);
    else
      select max(limit_price) into v_best from public.market_orders where business_id = b.id and side = 'buy' and status = 'open';
      v_limit := round(coalesce(v_best, b.share_price) * 0.95, 4);
    end if;
  else
    v_limit := round(p_limit, 4);
    if v_limit <= 0 then raise exception 'Prix invalide.'; end if;
    if v_limit > b.share_price * 2 or v_limit < b.share_price * 0.5 then
      raise exception 'Prix trop éloigné du cours (% z) : entre la moitié et le double.', round(b.share_price, 2);
    end if;
  end if;

  if p_side = 'buy' then
    select balance into v_bal from public.wallets where user_id = v_uid;
    if coalesce(v_bal, 0) < 0 then raise exception 'Ton solde est négatif : règle-le avant d''investir.'; end if;
    v_cost := p_quantity * (v_limit * (1 + v_fee_rate) + v_admin_per);
    if coalesce(v_bal, 0) < v_cost then
      raise exception 'Solde insuffisant : % z nécessaires au plus (frais compris).', round(v_cost, 2);
    end if;
  else
    select * into v_holding from public.business_shareholders where business_id = b.id and user_id = v_uid for update;
    select coalesce(sum(quantity), 0) into v_eligible from public.business_share_lots
    where business_id = b.id and user_id = v_uid and bought_at <= now() - make_interval(mins => v_min_hold::int);
    if coalesce(v_holding.quantity, 0) - coalesce(v_holding.locked, 0) < p_quantity then
      raise exception 'Tu n''as que % action(s) libre(s) (les autres sont déjà en vente).', greatest(coalesce(v_holding.quantity, 0) - coalesce(v_holding.locked, 0), 0);
    end if;
    if v_eligible - coalesce(v_holding.locked, 0) < p_quantity then
      raise exception 'Détention minimale de % min : % action(s) vendable(s) pour l''instant.', v_min_hold, greatest(v_eligible - coalesce(v_holding.locked, 0), 0);
    end if;
    update public.business_shareholders set locked = locked + p_quantity where business_id = b.id and user_id = v_uid;
  end if;

  insert into public.market_orders (business_id, side, trader, user_id, quantity, remaining, limit_price, expires_at)
  values (b.id, p_side, 'membre', v_uid, p_quantity, p_quantity, v_limit, now() + make_interval(days => v_days))
  returning id into v_id;

  v_filled := public._market_match(v_id, v_market);

  select coalesce(sum(price * quantity) / nullif(sum(quantity), 0), 0) into v_avg
  from public.market_trades
  where business_id = b.id and (buy_order = v_id or sell_order = v_id);

  return jsonb_build_object(
    'order_id', v_id,
    'filled', v_filled,
    'requested', p_quantity,
    'avg_price', round(v_avg, 4),
    'status', (select status from public.market_orders where id = v_id),
    'limit', v_limit,
    'halted', (select halted_until > now() from public.businesses where id = b.id)
  );
end;
$$;

create or replace function public.market_cancel(p_order uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.market_orders where id = p_order and user_id = auth.uid() and status = 'open') then
    raise exception 'Ordre introuvable ou déjà terminé.';
  end if;
  perform public._market_close_order(p_order, 'cancelled', 'Annulé par le membre');
end;
$$;

-- Anciennes fonctions (0038) : deviennent des ordres au marché.
create or replace function public.buy_business_shares(p_business_id uuid, p_quantity integer)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r jsonb;
begin
  r := public.market_order(p_business_id, 'buy', p_quantity, null, null);
  if (r->>'filled')::int = 0 then raise exception 'Aucun vendeur à ce prix pour l''instant : pose un ordre à cours limité.'; end if;
end;
$$;

create or replace function public.sell_business_shares(p_business_id uuid, p_quantity integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r jsonb;
  v_filled int;
begin
  r := public.market_order(p_business_id, 'sell', p_quantity, null, null);
  v_filled := (r->>'filled')::int;
  return jsonb_build_object('requested', p_quantity, 'sold', v_filled,
    'net_received', round(v_filled * (r->>'avg_price')::numeric * (1 - public.get_config_numeric('market_fee_rate', 0.002)), 2),
    'partial', v_filled < p_quantity);
end;
$$;

create or replace function public.get_my_sellable_shares(p_business_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select greatest(0, least(
    coalesce((select quantity - locked from public.business_shareholders where business_id = p_business_id and user_id = auth.uid()), 0),
    coalesce((select sum(quantity) from public.business_share_lots
              where business_id = p_business_id and user_id = auth.uid()
                and bought_at <= now() - (public.get_config_numeric('market_min_holding_minutes', 30) || ' minutes')::interval), 0)
      - coalesce((select locked from public.business_shareholders where business_id = p_business_id and user_id = auth.uid()), 0)
  ))::int;
$$;

-- ---------------------------------------------------------------------
-- 6. Population (teneur de marché) et entreprise (actions non placées)
-- ---------------------------------------------------------------------
create or replace function public._market_post(
  p_business uuid, p_side text, p_trader text, p_agent uuid, p_qty int, p_price numeric, p_ioc boolean default false)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_qty < 1 or p_price <= 0 then return 0; end if;
  if p_side = 'sell' and p_trader = 'population' then
    update public.sim_shareholdings set locked = locked + p_qty
    where business_id = p_business and agent_id = p_agent and quantity - locked >= p_qty;
    if not found then return 0; end if;
  end if;
  insert into public.market_orders (business_id, side, trader, agent_id, quantity, remaining, limit_price, expires_at)
  values (p_business, p_side, p_trader, p_agent, p_qty, p_qty, round(p_price, 4), now() + interval '1 day')
  returning id into v_id;
  return public._market_match(v_id, p_ioc);
end;
$$;

-- Une heure de marché pour une entreprise : la population ajuste son
-- estimation, passe ses ordres, puis réaffiche ses prix.
create or replace function public._market_tick_business(p_business uuid, p_step int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b public.businesses;
  v_fair numeric;
  v_price numeric;
  v_target numeric;
  v_vol numeric;
  v_rev numeric;
  v_noise numeric;
  v_shock numeric := 0;
  v_step numeric;
  v_cap numeric;
  v_spread numeric;
  v_depth int;
  v_qty int;
  a record;
  o record;
  k int;
begin
  select * into b from public.businesses where id = p_business;
  if b.id is null or b.is_closed then return; end if;
  if b.halted_until is not null and b.halted_until > now() then return; end if;

  v_fair := coalesce((public.compute_business_fundamentals(b.id)->>'fair_value')::numeric, b.share_price);
  v_price := greatest(b.share_price, 0.01);
  v_cap := v_price * b.share_count;
  v_vol := public.get_config_numeric('market_volatility', 0.012) * (1 + 1.5 * exp(-v_cap / 50000.0));
  v_rev := greatest(-0.2, least(0.2, public.get_config_numeric('market_reversion', 0.05) * ln(v_fair / v_price)));
  v_noise := (random() + random() + random() - 1.5) * 2 * v_vol;
  if random() < public.get_config_numeric('market_news_probability', 0.03) then
    v_shock := (random() - 0.5) * 2 * public.get_config_numeric('market_news_magnitude', 0.08);
  end if;
  v_step := greatest(-0.15, least(0.15, v_rev + v_noise + v_shock));
  v_target := round(v_price * exp(v_step), 4);

  -- Écart achat/vente : large pour les petites entreprises.
  v_spread := greatest(0.004, least(0.08, 0.004 + 0.06 * exp(-v_cap / 100000.0)));
  v_depth := greatest(1, ceil(b.share_count * 0.01)::int);

  -- Les anciens prix affichés par la population et l'entreprise sont retirés.
  for o in select id from public.market_orders where business_id = b.id and status = 'open' and trader in ('population', 'entreprise') loop
    perform public._market_close_order(o.id, 'cancelled', 'Prix renouvelés');
  end loop;

  -- Prix affichés : trois niveaux de chaque côté autour du cours.
  k := 0;
  for a in select id, balance from public.sim_agents where balance > 0 order by balance desc limit 3 loop
    k := k + 1;
    perform public._market_post(b.id, 'buy', 'population', a.id,
      least(v_depth * k, floor(a.balance * 0.15 / (v_price * (1 - v_spread / 2 - (k - 1) * v_spread)))::int),
      v_price * (1 - v_spread / 2 - (k - 1) * v_spread));
  end loop;
  k := 0;
  for a in select agent_id, quantity - locked as free from public.sim_shareholdings
           where business_id = b.id and quantity - locked > 0 order by quantity - locked desc limit 3 loop
    k := k + 1;
    perform public._market_post(b.id, 'sell', 'population', a.agent_id,
      least(v_depth * k, greatest(1, floor(a.free * 0.25)::int)),
      v_price * (1 + v_spread / 2 + (k - 1) * v_spread));
  end loop;

  -- L'entreprise place ses actions non vendues un peu au-dessus.
  select * into b from public.businesses where id = b.id;
  if b.shares_in_treasury > 0 then
    insert into public.market_orders (business_id, side, trader, quantity, remaining, limit_price, expires_at)
    values (b.id, 'sell', 'entreprise', least(b.shares_in_treasury, greatest(1, ceil(b.share_count * 0.03)::int)),
            least(b.shares_in_treasury, greatest(1, ceil(b.share_count * 0.03)::int)),
            round(greatest(v_price * (1 + v_spread), 0.01), 4), now() + interval '1 day')
    returning id into o;
    perform public._market_match(o.id, false);
  end if;

  -- Puis la population agit selon son estimation : elle achète si elle
  -- l'estime plus haut que le cours, vend sinon, jusqu'à son prix cible.
  v_qty := greatest(1, round(v_depth * least(2.0, abs(v_step) / v_spread))::int);
  if v_target > v_price * (1 + v_spread / 4) then
    select id, balance into a from public.sim_agents where balance > v_target * v_qty * 1.02 order by random() limit 1;
    if a.id is not null then
      perform public._market_post(b.id, 'buy', 'population', a.id, v_qty, v_target * (1 + v_spread / 2), true);
    end if;
  elsif v_target < v_price * (1 - v_spread / 4) then
    select s.agent_id as id, s.quantity - s.locked as free into a from public.sim_shareholdings s
    where s.business_id = b.id and s.quantity - s.locked >= 1 order by random() limit 1;
    if a.id is not null then
      perform public._market_post(b.id, 'sell', 'population', a.id, least(v_qty, a.free), v_target * (1 - v_spread / 2), true);
    end if;
  end if;
end;
$$;

-- Indice du S.I.D. : moyenne des variations de cours pondérée par la
-- capitalisation, chaînée d'une mesure à l'autre (base 1 000).
create or replace function public._market_index_update()
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  v_prev numeric := coalesce((select value from public.market_index_history order by at desc limit 1), 1000);
  v_ratio numeric;
  v_cap numeric;
begin
  select sum(b.index_prev_price * b.share_count * (b.share_price / b.index_prev_price)) / nullif(sum(b.index_prev_price * b.share_count), 0),
         sum(b.share_price * b.share_count)
    into v_ratio, v_cap
  from public.businesses b
  where not b.is_closed and b.index_prev_price > 0;
  update public.businesses set index_prev_price = share_price where not is_closed;
  insert into public.market_index_history (at, value, cap)
  values (now(), round(v_prev * coalesce(v_ratio, 1), 4), coalesce(v_cap, (select sum(share_price * share_count) from public.businesses where not is_closed)))
  on conflict (at) do nothing;
  return round(v_prev * coalesce(v_ratio, 1), 4);
end;
$$;

-- Marché (0038) : n'avance plus le cours au hasard ; chaque heure écoulée
-- est une séance de la population (6 au plus en rattrapage).
create or replace function public.process_market()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_last timestamptz;
  v_tick numeric;
  v_ticks int;
  v_n int;
  b record;
  o record;
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
  if v_ticks < 1 then return 0; end if;
  v_n := least(v_ticks, 6);

  -- Ordres arrivés à échéance.
  for o in select id, user_id, business_id from public.market_orders where status = 'open' and expires_at < now() loop
    perform public._market_close_order(o.id, 'expired', 'Arrivé à échéance');
  end loop;

  for i in 1 .. v_n loop
    for b in select id from public.businesses where not is_closed order by random() loop
      perform public._market_tick_business(b.id, i);
    end loop;
  end loop;
  perform public._market_index_update();

  update public.app_config
    set value = (v_last + (v_ticks * v_tick)::float8 * interval '1 minute')::text
    where key = 'market_last_tick_at';
  return v_n;
end;
$$;

-- Entreprise fermée : ses ordres tombent.
create or replace function public._market_on_close()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  o record;
begin
  if new.is_closed and not old.is_closed then
    for o in select id from public.market_orders where business_id = new.id and status = 'open' loop
      perform public._market_close_order(o.id, 'cancelled', 'Entreprise fermée');
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_market_on_close on public.businesses;
create trigger trg_market_on_close after update of is_closed on public.businesses
  for each row execute function public._market_on_close();

-- Dividendes (0034) : la population actionnaire touche aussi sa part.
create or replace function public.pay_dividends(p_business_id uuid, p_amount numeric)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_total int;
  v_per_share numeric(18, 6);
  v_part numeric(18, 2);
  v_paid numeric(18, 2) := 0;
  r record;
begin
  if p_amount <= 0 then raise exception 'Montant invalide'; end if;
  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then raise exception 'Entreprise introuvable'; end if;
  if not (v_business.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if v_business.treasury_balance < p_amount then raise exception 'Trésorerie insuffisante.'; end if;
  v_total := coalesce((select sum(quantity) from public.business_shareholders where business_id = p_business_id and quantity > 0), 0)
           + coalesce((select sum(quantity) from public.sim_shareholdings where business_id = p_business_id and quantity > 0), 0);
  if v_total <= 0 then raise exception 'Aucun actionnaire à qui verser un dividende.'; end if;
  v_per_share := p_amount / v_total;
  for r in select * from public.business_shareholders where business_id = p_business_id and quantity > 0 loop
    v_part := trunc(v_per_share * r.quantity, 2);
    if v_part > 0 then
      update public.wallets set balance = balance + v_part where user_id = r.user_id;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (r.user_id, v_part, 'Dividende : ' || v_business.name, auth.uid());
      v_paid := v_paid + v_part;
    end if;
  end loop;
  for r in select * from public.sim_shareholdings where business_id = p_business_id and quantity > 0 loop
    v_part := trunc(v_per_share * r.quantity, 2);
    update public.sim_agents set balance = balance + v_part where id = r.agent_id;
    v_paid := v_paid + v_part;
  end loop;
  update public.businesses set treasury_balance = treasury_balance - v_paid where id = p_business_id;
  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, -v_paid, 'Dividende versé aux actionnaires', auth.uid());
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Lecture
-- ---------------------------------------------------------------------
create or replace function public.market_overview()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public._market_today();
begin
  if v_uid is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(x order by (x->>'cap')::numeric desc)
    from (
      select jsonb_build_object(
        'id', b.id, 'name', b.name, 'description', b.description,
        'price', b.share_price,
        'ref', coalesce((select c.close from public.market_candles c where c.business_id = b.id and c.day < v_today order by c.day desc limit 1), b.share_price),
        'open', c.open, 'high', c.high, 'low', c.low, 'volume', coalesce(c.volume, 0), 'value', coalesce(c.value, 0),
        'week_ago', (select h.price from public.business_share_price_history h where h.business_id = b.id and h.recorded_at <= now() - interval '7 days' order by h.recorded_at desc limit 1),
        'cap', round(b.share_price * b.share_count, 2),
        'share_count', b.share_count,
        'shares_in_treasury', b.shares_in_treasury,
        'bid', (select max(limit_price) from public.market_orders where business_id = b.id and side = 'buy' and status = 'open'),
        'ask', (select min(limit_price) from public.market_orders where business_id = b.id and side = 'sell' and status = 'open'),
        'halted_until', case when b.halted_until > now() then b.halted_until end,
        'my_qty', coalesce(s.quantity, 0),
        'my_locked', coalesce(s.locked, 0),
        'spark', (select coalesce(jsonb_agg(z.close order by z.day), '[]'::jsonb) from (
                    select day, close from public.market_candles where business_id = b.id order by day desc limit 30) z)
      ) || public.compute_business_fundamentals(b.id) as x
      from public.businesses b
      left join public.market_candles c on c.business_id = b.id and c.day = v_today
      left join public.business_shareholders s on s.business_id = b.id and s.user_id = v_uid
      where not b.is_closed
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.market_detail(p_business uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return null; end if;
  return jsonb_build_object(
    'bids', coalesce((select jsonb_agg(jsonb_build_object('price', l.limit_price, 'qty', l.qty, 'orders', l.n, 'mine', l.mine) order by l.limit_price desc)
             from (select limit_price, sum(remaining) as qty, count(*) as n, bool_or(user_id = v_uid) as mine
                   from public.market_orders where business_id = p_business and side = 'buy' and status = 'open'
                   group by limit_price order by limit_price desc limit 8) l), '[]'::jsonb),
    'asks', coalesce((select jsonb_agg(jsonb_build_object('price', l.limit_price, 'qty', l.qty, 'orders', l.n, 'mine', l.mine) order by l.limit_price)
             from (select limit_price, sum(remaining) as qty, count(*) as n, bool_or(user_id = v_uid) as mine
                   from public.market_orders where business_id = p_business and side = 'sell' and status = 'open'
                   group by limit_price order by limit_price limit 8) l), '[]'::jsonb),
    'trades', coalesce((select jsonb_agg(jsonb_build_object('at', t.at, 'price', t.price, 'qty', t.quantity, 'side', t.aggressor,
                         'mine', (t.buyer_user = v_uid or t.seller_user = v_uid)) order by t.at desc)
             from (select * from public.market_trades where business_id = p_business order by at desc limit 30) t), '[]'::jsonb),
    'candles', coalesce((select jsonb_agg(jsonb_build_object('day', c.day, 'o', c.open, 'h', c.high, 'l', c.low, 'c', c.close, 'v', c.volume) order by c.day)
             from (select * from public.market_candles where business_id = p_business order by day desc limit 90) c), '[]'::jsonb),
    'my_orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'side', o.side, 'quantity', o.quantity, 'remaining', o.remaining,
                            'limit', o.limit_price, 'status', o.status, 'created_at', o.created_at, 'expires_at', o.expires_at, 'note', o.note)
                          order by o.created_at desc)
             from (select * from public.market_orders where business_id = p_business and user_id = v_uid
                   and (status = 'open' or closed_at > now() - interval '3 days') order by created_at desc limit 20) o), '[]'::jsonb),
    'holding', jsonb_build_object(
      'qty', coalesce((select quantity from public.business_shareholders where business_id = p_business and user_id = v_uid), 0),
      'locked', coalesce((select locked from public.business_shareholders where business_id = p_business and user_id = v_uid), 0),
      'sellable', public.get_my_sellable_shares(p_business)),
    'fees', jsonb_build_object(
      'rate', public.get_config_numeric('market_fee_rate', 0.002),
      'admin_per_share', public.get_config_numeric('market_admin_fee_per_share', 0.5),
      'min_hold', public.get_config_numeric('market_min_holding_minutes', 30),
      'band', public.get_config_numeric('market_circuit_breaker_pct', 0.2))
  );
end;
$$;

create or replace function public.market_my_orders()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'business_id', o.business_id, 'name', b.name, 'side', o.side,
           'quantity', o.quantity, 'remaining', o.remaining, 'limit', o.limit_price, 'created_at', o.created_at,
           'expires_at', o.expires_at) order by o.created_at desc), '[]'::jsonb)
  from public.market_orders o join public.businesses b on b.id = o.business_id
  where o.user_id = auth.uid() and o.status = 'open';
$$;

create or replace function public.market_index_series(p_days int default 30)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('at', at, 'value', value, 'cap', cap) order by at), '[]'::jsonb)
  from public.market_index_history
  where at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
$$;

-- ---------------------------------------------------------------------
-- 8. Population (0044) : ses achats d'actions passent par le carnet, et
--    ses achats d'objets alimentent l'indice des prix.
-- ---------------------------------------------------------------------
create or replace function public.sim_process_day(p_day date)
returns void
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_vat_rate numeric;
  v_cap int;
  v_pop_count int;
  v_daily_salary numeric;
  v_mood text;
  v_moods constant text[] := array['radin', 'neutre', 'depensier', 'genereux', 'inspire'];
  v_buy_chance numeric;
  v_spend_mult numeric;
  v_share_bias numeric;
  v_will_buy boolean;
  v_buy_shares boolean;
  v_item public.shop_items;
  v_unit_price numeric;
  v_vat numeric;
  v_seller numeric;
  v_biz public.businesses;
  v_spend numeric;
  v_qty int;
  v_ask numeric;
  v_tax_mult numeric;
  v_balance numeric;
begin
  v_vat_rate := public.get_config_numeric('vat_rate', 0.05);
  select population_cap into v_cap from public.sim_state where id = true;
  v_cap := coalesce(v_cap, 150);

  if extract(month from p_day) = 1 and extract(day from p_day) = 1 then
    update public.sim_agents set age = age + 1;
  end if;

  for r in select * from public.sim_agents order by created_at loop
    v_daily_salary := round(r.weekly_salary / 7.0, 2);
    update public.sim_agents set balance = balance + v_daily_salary where id = r.id;
    insert into public.sim_events (day, kind, agent_id, amount) values (p_day, 'salary', r.id, v_daily_salary);

    v_mood := v_moods[1 + floor(random() * array_length(v_moods, 1))::int];
    update public.sim_agents set mood = v_mood, mood_day = p_day where id = r.id;

    v_spend_mult := case v_mood when 'radin' then 0.5 when 'depensier' then 1.7 when 'genereux' then 1.3 when 'inspire' then 1.15 else 1.0 end;
    v_buy_chance := 0.35 + case v_mood when 'radin' then -0.12 when 'depensier' then 0.18 when 'genereux' then 0.08 when 'inspire' then 0.05 else 0 end;
    v_share_bias := (r.ambition / 100.0) * 0.4 + case v_mood when 'inspire' then 0.15 when 'genereux' then -0.1 else 0 end;
    v_tax_mult := case when r.wealth_class = 'riche' then 2.0 else 1.0 end;

    select balance into v_balance from public.sim_agents where id = r.id;
    v_will_buy := random() < greatest(0.05, least(0.8, v_buy_chance));
    if v_will_buy and v_balance > 0 then
      v_buy_shares := random() < greatest(0.05, least(0.85, 0.3 + v_share_bias));

      if v_buy_shares then
        -- Achat d'actions : ordre au marché sur le carnet, au meilleur prix affiché.
        select * into v_biz from public.businesses where not is_closed order by random() limit 1;
        if v_biz.id is not null then
          select min(limit_price) into v_ask from public.market_orders
          where business_id = v_biz.id and side = 'sell' and status = 'open';
          v_spend := v_balance * greatest(0.02, least(0.4, 0.08 * v_spend_mult));
          v_qty := floor(v_spend / greatest(coalesce(v_ask, v_biz.share_price), 0.01))::int;
          if v_qty >= 1 and v_ask is not null then
            perform public._market_post(v_biz.id, 'buy', 'population', r.id, v_qty, v_ask * 1.01, true);
            insert into public.sim_events (day, kind, agent_id, amount, detail)
            values (p_day, 'buy_shares', r.id, round(v_qty * v_ask, 2), v_qty || ' action(s) demandée(s) — ' || v_biz.name);
          end if;
        end if;
      else
        select * into v_item from public.shop_items
          where is_active and hidden_at is null and (stock is null or stock > 0)
          order by random() limit 1;
        if v_item.id is not null then
          v_unit_price := case
            when v_item.sale_price is not null and (v_item.sale_ends_at is null or v_item.sale_ends_at > now()) then v_item.sale_price
            else v_item.price end;
          if v_balance >= v_unit_price then
            v_vat := round(v_unit_price * v_vat_rate * v_tax_mult, 2);
            v_seller := v_unit_price - v_vat;
            update public.sim_agents set balance = balance - v_unit_price where id = r.id;
            if v_item.business_id is not null then
              update public.businesses set treasury_balance = treasury_balance + v_seller where id = v_item.business_id;
              insert into public.business_transactions (business_id, amount, reason, created_by)
              values (v_item.business_id, v_seller, 'Vente à la population : ' || v_item.name, null);
            elsif v_item.created_by is not null then
              update public.wallets set balance = balance + v_seller where user_id = v_item.created_by;
              insert into public.transactions (user_id, amount, reason, created_by)
              values (v_item.created_by, v_seller, 'Vente à la population : ' || v_item.name, null);
            end if;
            update public.tax_pool set balance = balance + v_vat where id = true;
            if v_item.stock is not null then
              update public.shop_items set stock = stock - 1 where id = v_item.id;
            end if;
            insert into public.price_observations (item_id, unit_price, quantity, source)
            values (v_item.id, v_unit_price, 1, 'population');
            insert into public.sim_events (day, kind, agent_id, amount, detail)
            values (p_day, 'purchase_item', r.id, v_unit_price, v_item.name);
          end if;
        end if;
      end if;
    end if;
  end loop;

  -- Mise en couple.
  for r in select * from public.sim_agents where partner_id is null order by random() loop
    if (select partner_id from public.sim_agents where id = r.id) is not null then continue; end if;
    if random() < 0.012 then
      declare
        v_match uuid;
      begin
        select id into v_match from public.sim_agents where partner_id is null and id <> r.id order by random() limit 1;
        if v_match is not null then
          update public.sim_agents set partner_id = v_match where id = r.id;
          update public.sim_agents set partner_id = r.id where id = v_match;
          insert into public.sim_events (day, kind, agent_id, detail) values (p_day, 'couple', r.id, 'Nouveau couple');
        end if;
      end;
    end if;
  end loop;

  -- Naissances.
  select count(*) into v_pop_count from public.sim_agents;
  if v_pop_count < v_cap then
    for r in
      select a.* from public.sim_agents a
      join public.sim_agents b on b.id = a.partner_id
      where a.id < a.partner_id and a.can_have_children and b.can_have_children
    loop
      if random() < 0.009 then
        declare
          v_partner public.sim_agents;
          v_child public.sim_agents;
        begin
          select * into v_partner from public.sim_agents where id = r.partner_id;
          v_child := public.sim_create_agent(
            p_day,
            p_wealth_class := case when random() < 0.5 then r.wealth_class else v_partner.wealth_class end,
            p_age := 18,
            p_parent_a := r.id,
            p_parent_b := v_partner.id,
            p_luck := least(100, greatest(0, round((r.luck + v_partner.luck) / 2.0 + (random() * 20 - 10))::int)),
            p_ambition := least(100, greatest(0, round((r.ambition + v_partner.ambition) / 2.0 + (random() * 20 - 10))::int)),
            p_starting_balance := (r.weekly_salary + v_partner.weekly_salary) / 4.0
          );
          insert into public.sim_events (day, kind, agent_id, detail)
          values (p_day, 'child', v_child.id, 'Enfant de ' || r.first_name || ' ' || r.last_name || ' et ' || v_partner.first_name || ' ' || v_partner.last_name);
          v_pop_count := v_pop_count + 1;
          exit when v_pop_count >= v_cap;
        end;
      end if;
    end loop;
  end if;
end;
$$;

-- Cours de départ de l'indice et référence de chaque entreprise.
update public.businesses set index_prev_price = share_price where not is_closed and index_prev_price is null;
insert into public.market_index_history (at, value, cap)
select now(), 1000, coalesce(sum(share_price * share_count), 0) from public.businesses where not is_closed
having not exists (select 1 from public.market_index_history);

-- ---------------------------------------------------------------------
-- 9. Droits d'exécution
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._market_ref(uuid)', 'public._market_record(uuid, numeric, int, text, uuid, text, uuid, text, uuid, uuid)',
    'public._market_close_order(uuid, text, text)', 'public._market_settle(uuid, uuid, int, numeric, text)',
    'public._market_match(uuid, boolean)', 'public._market_post(uuid, text, text, uuid, int, numeric, boolean)',
    'public._market_tick_business(uuid, int)', 'public._market_index_update()', 'public._market_on_close()',
    'public.market_order(uuid, text, int, numeric, int)', 'public.market_cancel(uuid)',
    'public.market_overview()', 'public.market_detail(uuid)', 'public.market_my_orders()', 'public.market_index_series(int)',
    'public.sim_process_day(date)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
  end loop;
  foreach f in array array[
    'public._market_ref(uuid)', 'public._market_record(uuid, numeric, int, text, uuid, text, uuid, text, uuid, uuid)',
    'public._market_close_order(uuid, text, text)', 'public._market_settle(uuid, uuid, int, numeric, text)',
    'public._market_match(uuid, boolean)', 'public._market_post(uuid, text, text, uuid, int, numeric, boolean)',
    'public._market_tick_business(uuid, int)', 'public._market_index_update()', 'public._market_on_close()',
    'public.sim_process_day(date)'
  ] loop
    execute format('revoke all on function %s from authenticated', f);
  end loop;
  foreach f in array array[
    'public.market_order(uuid, text, int, numeric, int)', 'public.market_cancel(uuid)',
    'public.market_overview()', 'public.market_detail(uuid)', 'public.market_my_orders()', 'public.market_index_series(int)'
  ] loop
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
