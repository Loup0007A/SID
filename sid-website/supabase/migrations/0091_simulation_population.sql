-- =====================================================================
-- Lot 73 (2/2) : simulation de population. Rejouable. Après 0090.
--
-- RELEVÉ QUOTIDIEN (sim_daily)
--   Chaque jour simulé laisse un relevé : population, argent, médiane,
--   inégalités (coefficient de Gini, part des 10 % les plus riches),
--   salaires versés, dépenses en objets et en actions, naissances, couples,
--   humeurs, répartition par classe. La page Simulation en tire ses courbes.
--
-- PILOTAGE (admins « Économie »)
--   - pause : plus aucun jour simulé ; à la reprise, les jours de pause ne
--     sont pas rattrapés ;
--   - envie de dépenser et appétit pour la bourse (× 0,2 à × 3) ;
--   - taille maximale de la population (naissances) ;
--   - ajouter des habitants (classe au choix) ;
--   - événements de quelques jours : fête, crise, euphorie boursière,
--     morosité, ou réglage libre ; prime exceptionnelle versée à chacun.
--
-- PLUS RÉALISTE
--   - l'humeur ne tire plus au sort chaque matin : elle se garde souvent
--     d'un jour à l'autre et suit les événements en cours ;
--   - les habitants sans le sou ne dépensent plus, les plus aisés gardent
--     une réserve.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réglages, événements, relevés
-- ---------------------------------------------------------------------
alter table public.sim_state add column if not exists paused boolean not null default false;
alter table public.sim_state add column if not exists spend_factor numeric(6, 3) not null default 1;
alter table public.sim_state add column if not exists share_factor numeric(6, 3) not null default 1;
alter table public.sim_state add column if not exists paused_at timestamptz;
insert into public.sim_state (id) values (true) on conflict (id) do nothing;

alter table public.sim_events drop constraint if exists sim_events_kind_check;
alter table public.sim_events add constraint sim_events_kind_check
  check (kind in ('salary', 'purchase_item', 'buy_shares', 'couple', 'child', 'tax', 'bonus', 'arrival'));

create table if not exists public.sim_shocks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('fete', 'crise', 'euphorie', 'morosite', 'libre')),
  label text not null check (char_length(label) between 2 and 80),
  starts_on date not null,
  ends_on date not null,
  spend_mult numeric(6, 3) not null default 1 check (spend_mult between 0.1 and 5),
  share_mult numeric(6, 3) not null default 1 check (share_mult between 0.1 and 5),
  mood_bias text check (mood_bias is null or mood_bias in ('radin', 'neutre', 'depensier', 'genereux', 'inspire')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_on >= starts_on)
);
create index if not exists sim_shocks_days_idx on public.sim_shocks (starts_on, ends_on);

create table if not exists public.sim_daily (
  day date primary key,
  population int not null,
  money numeric(18, 2) not null,
  median numeric(14, 2),
  gini numeric(6, 4),
  top10_share numeric(6, 4),
  salaries numeric(18, 2) not null default 0,
  spent_items numeric(18, 2) not null default 0,
  spent_shares numeric(18, 2) not null default 0,
  purchases int not null default 0,
  share_orders int not null default 0,
  births int not null default 0,
  couples int not null default 0,
  moods jsonb not null default '{}'::jsonb,
  classes jsonb not null default '{}'::jsonb,
  spend_mult numeric(6, 3) not null default 1,
  share_mult numeric(6, 3) not null default 1
);

alter table public.sim_shocks enable row level security;
alter table public.sim_daily enable row level security;
drop policy if exists "sim_shocks_select" on public.sim_shocks;
create policy "sim_shocks_select" on public.sim_shocks for select to authenticated using (public.has_permission(auth.uid(), 'manage_economy'));
drop policy if exists "sim_daily_select" on public.sim_daily;
create policy "sim_daily_select" on public.sim_daily for select to authenticated using (public.has_permission(auth.uid(), 'manage_economy'));
revoke all on public.sim_shocks, public.sim_daily from anon;
revoke insert, update, delete on public.sim_shocks, public.sim_daily from authenticated;

-- Multiplicateurs du jour : réglages × événements en cours.
create or replace function public._sim_factors(p_day date, out spend numeric, out shares numeric, out mood text)
language plpgsql stable security definer set search_path = public
as $$
begin
  select coalesce(s.spend_factor, 1), coalesce(s.share_factor, 1) into spend, shares from public.sim_state s where s.id = true;
  spend := coalesce(spend, 1);
  shares := coalesce(shares, 1);
  select spend * coalesce(exp(sum(ln(k.spend_mult))), 1), shares * coalesce(exp(sum(ln(k.share_mult))), 1)
  into spend, shares
  from public.sim_shocks k
  where k.cancelled_at is null and p_day between k.starts_on and k.ends_on;
  select k.mood_bias into mood from public.sim_shocks k
  where k.cancelled_at is null and p_day between k.starts_on and k.ends_on and k.mood_bias is not null
  order by k.created_at desc limit 1;
end;
$$;

-- Relevé d'un jour simulé.
create or replace function public._sim_snapshot(p_day date)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  f record;
begin
  select * into f from public._sim_factors(p_day);
  insert into public.sim_daily (day, population, money, median, gini, top10_share, salaries, spent_items, spent_shares,
                                purchases, share_orders, births, couples, moods, classes, spend_mult, share_mult)
  select p_day,
         count(*),
         coalesce(sum(balance), 0),
         percentile_cont(0.5) within group (order by balance),
         -- Gini sur les soldes positifs, triés du plus petit au plus grand.
         (select case when sum(x) > 0 and count(*) > 1
                      then (2 * sum(rn * x)) / (count(*) * sum(x)) - (count(*) + 1.0) / count(*) end
          from (select greatest(balance, 0) as x, row_number() over (order by greatest(balance, 0)) as rn from public.sim_agents) g),
         (select case when sum(greatest(balance, 0)) > 0
                      then (select sum(x) from (select greatest(balance, 0) as x from public.sim_agents order by balance desc
                                                 limit greatest(1, ceil((select count(*) from public.sim_agents) / 10.0)::int)) t)
                           / sum(greatest(balance, 0)) end
          from public.sim_agents),
         coalesce((select sum(amount) from public.sim_events where day = p_day and kind = 'salary'), 0),
         coalesce((select sum(amount) from public.sim_events where day = p_day and kind = 'purchase_item'), 0),
         coalesce((select sum(amount) from public.sim_events where day = p_day and kind = 'buy_shares'), 0),
         (select count(*) from public.sim_events where day = p_day and kind = 'purchase_item'),
         (select count(*) from public.sim_events where day = p_day and kind = 'buy_shares'),
         (select count(*) from public.sim_events where day = p_day and kind = 'child'),
         (select count(*) from public.sim_events where day = p_day and kind = 'couple'),
         coalesce((select jsonb_object_agg(mood, n) from (select mood, count(*) as n from public.sim_agents group by mood) m), '{}'::jsonb),
         coalesce((select jsonb_object_agg(wealth_class, jsonb_build_object('n', n, 'money', money))
                   from (select wealth_class, count(*) as n, round(sum(balance), 2) as money from public.sim_agents group by wealth_class) c), '{}'::jsonb),
         round(f.spend, 3), round(f.shares, 3)
  from public.sim_agents
  on conflict (day) do update set
    population = excluded.population, money = excluded.money, median = excluded.median, gini = excluded.gini,
    top10_share = excluded.top10_share, salaries = excluded.salaries, spent_items = excluded.spent_items,
    spent_shares = excluded.spent_shares, purchases = excluded.purchases, share_orders = excluded.share_orders,
    births = excluded.births, couples = excluded.couples, moods = excluded.moods, classes = excluded.classes,
    spend_mult = excluded.spend_mult, share_mult = excluded.share_mult;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Journée simulée (0085) : humeurs suivies, réglages et événements
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
  f record;
  v_reserve numeric;
begin
  select * into f from public._sim_factors(p_day);
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

    -- L'humeur se garde souvent d'un jour à l'autre ; un événement l'oriente.
    if f.mood is not null and random() < 0.45 then
      v_mood := f.mood;
    elsif random() < 0.6 then
      v_mood := r.mood;
    else
      v_mood := v_moods[1 + floor(random() * array_length(v_moods, 1))::int];
    end if;
    update public.sim_agents set mood = v_mood, mood_day = p_day where id = r.id;

    v_spend_mult := case v_mood when 'radin' then 0.5 when 'depensier' then 1.7 when 'genereux' then 1.3 when 'inspire' then 1.15 else 1.0 end;
    v_buy_chance := f.spend * 0.35 + case v_mood when 'radin' then -0.12 when 'depensier' then 0.18 when 'genereux' then 0.08 when 'inspire' then 0.05 else 0 end;
    v_share_bias := (r.ambition / 100.0) * 0.4 + case v_mood when 'inspire' then 0.15 when 'genereux' then -0.1 else 0 end;
    v_tax_mult := case when r.wealth_class = 'riche' then 2.0 else 1.0 end;

    select balance into v_balance from public.sim_agents where id = r.id;
    -- Une réserve : un quart du salaire de la semaine.
    v_reserve := r.weekly_salary * 0.25;
    v_will_buy := random() < greatest(0.02, least(0.85, v_buy_chance));
    if v_will_buy and v_balance > v_reserve then
      v_buy_shares := random() < greatest(0.05, least(0.85, (0.3 + v_share_bias) * f.shares));

      if v_buy_shares then
        -- Achat d'actions : ordre au marché sur le carnet, au meilleur prix affiché.
        select * into v_biz from public.businesses where not is_closed order by random() limit 1;
        if v_biz.id is not null then
          select min(limit_price) into v_ask from public.market_orders
          where business_id = v_biz.id and side = 'sell' and status = 'open';
          v_spend := (v_balance - v_reserve) * greatest(0.02, least(0.4, 0.08 * v_spend_mult * f.shares));
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
          if v_balance - v_unit_price >= v_reserve then
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
  perform public._sim_snapshot(p_day);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Rattrapage : rien pendant la pause
-- ---------------------------------------------------------------------
create or replace function public._population_catch_up()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_last date;
  v_today date := current_date;
  v_paused boolean;
  d date;
  n int := 0;
begin
  if not exists (select 1 from public.sim_agents limit 1) then return 0; end if;
  select last_processed_day, paused into v_last, v_paused from public.sim_state where id = true for update;
  if coalesce(v_paused, false) then return 0; end if;
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

create or replace function public.process_population_simulation()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_last date;
  v_today date := current_date;
  v_processed int := 0;
  d date;
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Permission refusée';
  end if;
  if not exists (select 1 from public.sim_agents limit 1) then return 0; end if;
  if coalesce((select paused from public.sim_state where id = true), false) then return 0; end if;
  select last_processed_day into v_last from public.sim_state where id = true for update;
  v_last := coalesce(v_last, v_today - 1);
  d := v_last + 1;
  while d <= v_today and v_processed < 60 loop
    perform public.sim_process_day(d);
    d := d + 1;
    v_processed := v_processed + 1;
  end loop;
  update public.sim_state set last_processed_day = d - 1 where id = true;
  return v_processed;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Pilotage
-- ---------------------------------------------------------------------
create or replace function public._sim_admin()
returns uuid
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion de l''économie requise.';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.sim_set_settings(p_paused boolean default null, p_spend numeric default null,
                                                   p_shares numeric default null, p_cap int default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._sim_admin();
  s public.sim_state;
begin
  select * into s from public.sim_state where id = true for update;
  if p_spend is not null and (p_spend < 0.2 or p_spend > 3) then raise exception 'Envie de dépenser : entre × 0,2 et × 3.'; end if;
  if p_shares is not null and (p_shares < 0.2 or p_shares > 3) then raise exception 'Appétit pour la bourse : entre × 0,2 et × 3.'; end if;
  if p_cap is not null and (p_cap < 10 or p_cap > 2000) then raise exception 'Taille maximale : entre 10 et 2 000 habitants.'; end if;
  update public.sim_state
  set spend_factor = coalesce(round(p_spend, 3), spend_factor),
      share_factor = coalesce(round(p_shares, 3), share_factor),
      population_cap = coalesce(p_cap, population_cap),
      paused = coalesce(p_paused, paused),
      paused_at = case when p_paused is true and not s.paused then now() when p_paused is false then null else paused_at end,
      -- Reprise : les jours de pause ne sont pas rattrapés.
      last_processed_day = case when p_paused is false and s.paused then current_date - 1 else last_processed_day end
  where id = true;
  perform public.write_audit('simulation_settings', null,
    jsonb_strip_nulls(jsonb_build_object('pause', p_paused, 'depenses', p_spend, 'bourse', p_shares, 'max', p_cap)));
end;
$$;

-- Événement de quelques jours (préréglages ou réglage libre).
create or replace function public.sim_shock_start(p_kind text, p_days int, p_intensity numeric default 1,
                                                  p_spend numeric default null, p_shares numeric default null, p_label text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._sim_admin();
  v_i numeric := least(2, greatest(0.25, coalesce(p_intensity, 1)));
  v_spend numeric;
  v_shares numeric;
  v_mood text;
  v_label text;
  v_id uuid;
begin
  if p_days is null or p_days < 1 or p_days > 60 then raise exception 'Durée : entre 1 et 60 jours.'; end if;
  case p_kind
    when 'fete' then v_spend := 1 + 0.6 * v_i; v_shares := 1; v_mood := 'depensier'; v_label := 'Fête';
    when 'crise' then v_spend := 1 / (1 + 1.0 * v_i); v_shares := 1 / (1 + 1.5 * v_i); v_mood := 'radin'; v_label := 'Crise';
    when 'euphorie' then v_spend := 1; v_shares := 1 + 1.0 * v_i; v_mood := 'inspire'; v_label := 'Euphorie boursière';
    when 'morosite' then v_spend := 1 / (1 + 0.4 * v_i); v_shares := 1 / (1 + 0.4 * v_i); v_mood := 'neutre'; v_label := 'Morosité';
    when 'libre' then
      v_spend := coalesce(p_spend, 1); v_shares := coalesce(p_shares, 1); v_mood := null; v_label := 'Événement';
      if v_spend < 0.1 or v_spend > 5 or v_shares < 0.1 or v_shares > 5 then raise exception 'Multiplicateurs : entre × 0,1 et × 5.'; end if;
    else raise exception 'Événement inconnu.';
  end case;
  insert into public.sim_shocks (kind, label, starts_on, ends_on, spend_mult, share_mult, mood_bias, created_by)
  values (p_kind, coalesce(nullif(trim(coalesce(p_label, '')), ''), v_label), current_date, current_date + p_days - 1,
          round(v_spend, 3), round(v_shares, 3), v_mood, v_uid)
  returning id into v_id;
  perform public.write_audit('simulation_shock', null, jsonb_build_object('evenement', p_kind, 'jours', p_days, 'depenses', round(v_spend, 2), 'bourse', round(v_shares, 2)));
  return v_id;
end;
$$;

create or replace function public.sim_shock_end(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public._sim_admin();
  update public.sim_shocks set cancelled_at = now(), ends_on = least(ends_on, greatest(starts_on, current_date - 1))
  where id = p_id and cancelled_at is null;
  if not found then raise exception 'Événement introuvable ou déjà terminé.'; end if;
end;
$$;

-- Prime exceptionnelle : versée tout de suite à chaque habitant (création de monnaie).
create or replace function public.sim_bonus(p_amount numeric, p_class text default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._sim_admin();
  n int;
begin
  if p_amount is null or p_amount < 1 or p_amount > 100000 then raise exception 'Montant : entre 1 et 100 000 z.'; end if;
  if p_class is not null and p_class not in ('pauvre', 'moyen', 'aise', 'riche') then raise exception 'Classe inconnue.'; end if;
  with u as (
    update public.sim_agents set balance = balance + round(p_amount, 2)
    where p_class is null or wealth_class = p_class
    returning id
  )
  insert into public.sim_events (day, kind, agent_id, amount, detail)
  select current_date, 'bonus', id, round(p_amount, 2), 'Prime exceptionnelle' from u;
  get diagnostics n = row_count;
  perform public.write_audit('simulation_bonus', null, jsonb_build_object('montant', p_amount, 'classe', p_class, 'habitants', n));
  return n;
end;
$$;

create or replace function public.sim_add_agents(p_count int, p_class text default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._sim_admin();
  a public.sim_agents;
  i int;
begin
  if p_count is null or p_count < 1 or p_count > 200 then raise exception 'Entre 1 et 200 habitants à la fois.'; end if;
  if p_class is not null and p_class not in ('pauvre', 'moyen', 'aise', 'riche') then raise exception 'Classe inconnue.'; end if;
  for i in 1..p_count loop
    a := public.sim_create_agent(current_date, p_wealth_class := coalesce(p_class, public.sim_random_wealth_class()));
    insert into public.sim_events (day, kind, agent_id, detail) values (current_date, 'arrival', a.id, 'Arrivée');
  end loop;
  update public.sim_state set last_processed_day = coalesce(last_processed_day, current_date - 1) where id = true;
  perform public.write_audit('simulation_arrivals', null, jsonb_build_object('habitants', p_count, 'classe', p_class));
  return p_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Lecture
-- ---------------------------------------------------------------------
create or replace function public.get_population_overview(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_days int := least(365, greatest(7, coalesce(p_days, 30)));
  f record;
begin
  perform public._sim_admin();
  select * into f from public._sim_factors(current_date);
  return jsonb_build_object(
    'settings', (select jsonb_build_object('paused', paused, 'paused_at', paused_at, 'spend', spend_factor, 'shares', share_factor,
                                           'cap', population_cap, 'last_day', last_processed_day) from public.sim_state where id = true),
    'today', jsonb_build_object('spend', round(f.spend, 3), 'shares', round(f.shares, 3), 'mood', f.mood),
    'series', coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from public.sim_daily d where d.day > current_date - v_days), '[]'::jsonb),
    'classes', coalesce((select jsonb_agg(jsonb_build_object('class', wealth_class, 'n', n, 'money', money, 'avg', avg_b, 'salary', sal) order by
                                case wealth_class when 'pauvre' then 1 when 'moyen' then 2 when 'aise' then 3 else 4 end)
                         from (select wealth_class, count(*) as n, round(sum(balance), 2) as money, round(avg(balance), 2) as avg_b,
                                      round(avg(weekly_salary), 2) as sal
                               from public.sim_agents group by wealth_class) c), '[]'::jsonb),
    'moods', coalesce((select jsonb_object_agg(mood, n) from (select mood, count(*) as n from public.sim_agents group by mood) m), '{}'::jsonb),
    'ages', coalesce((select jsonb_agg(jsonb_build_object('band', band, 'm', m, 'f', fe) order by band)
                      from (select least(80, (age / 10) * 10) as band, count(*) filter (where sex = 'M') as m, count(*) filter (where sex = 'F') as fe
                            from public.sim_agents group by 1) a), '[]'::jsonb),
    'market', jsonb_build_object(
      'holdings_value', coalesce((select round(sum(s.quantity * b.share_price), 2) from public.sim_shareholdings s
                                  join public.businesses b on b.id = s.business_id and not b.is_closed), 0),
      'market_cap', coalesce((select round(sum(share_count * share_price), 2) from public.businesses where not is_closed), 0),
      'open_orders', (select count(*) from public.market_orders where trader = 'population' and status = 'open'),
      'volume_7', coalesce((select sum(quantity) from public.market_trades where at > now() - interval '7 days'), 0),
      'volume_pop_7', coalesce((select sum(quantity) from public.market_trades where at > now() - interval '7 days'
                                and (buyer = 'population' or seller = 'population')), 0)),
    'shocks', coalesce((select jsonb_agg(to_jsonb(k) || jsonb_build_object('author', (select nickname from public.profiles where id = k.created_by),
                                         'active', k.cancelled_at is null and current_date between k.starts_on and k.ends_on)
                                         order by k.created_at desc)
                        from (select * from public.sim_shocks order by created_at desc limit 15) k), '[]'::jsonb),
    -- Faits marquants : naissances, couples, arrivées, gros achats et gros ordres.
    'events', coalesce((select jsonb_agg(jsonb_build_object('day', e.day, 'kind', e.kind, 'amount', e.amount, 'detail', e.detail,
                                         'name', a.first_name || ' ' || a.last_name,
                                         'partner', case when e.kind = 'couple' then (select p.first_name || ' ' || p.last_name
                                                                                     from public.sim_agents p where p.id = a.partner_id) end)
                                         order by e.day desc, e.created_at desc)
                        from (select * from public.sim_events
                              where kind in ('child', 'couple', 'arrival')
                                 or (kind in ('purchase_item', 'buy_shares') and amount >= 500)
                              order by day desc, created_at desc limit 24) e
                        left join public.sim_agents a on a.id = e.agent_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.sim_agent_detail(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  a public.sim_agents;
begin
  perform public._sim_admin();
  select * into a from public.sim_agents where id = p_id;
  if a.id is null then return null; end if;
  return to_jsonb(a) || jsonb_build_object(
    'partner', (select jsonb_build_object('id', id, 'name', first_name || ' ' || last_name) from public.sim_agents where id = a.partner_id),
    'parents', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', first_name || ' ' || last_name))
                         from public.sim_agents where id in (a.parent_a_id, a.parent_b_id)), '[]'::jsonb),
    'children', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', first_name || ' ' || last_name))
                          from public.sim_agents where parent_a_id = a.id or parent_b_id = a.id), '[]'::jsonb),
    'holdings', coalesce((select jsonb_agg(jsonb_build_object('name', b.name, 'qty', s.quantity, 'value', round(s.quantity * b.share_price, 2)) order by s.quantity * b.share_price desc)
                          from public.sim_shareholdings s join public.businesses b on b.id = s.business_id
                          where s.agent_id = a.id and s.quantity > 0 and not b.is_closed), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('day', e.day, 'kind', e.kind, 'amount', e.amount, 'detail', e.detail) order by e.day desc, e.created_at desc)
                        from (select * from public.sim_events where agent_id = a.id and kind <> 'salary' order by day desc, created_at desc limit 30) e), '[]'::jsonb),
    'spent_30', coalesce((select sum(amount) from public.sim_events where agent_id = a.id and kind in ('purchase_item', 'buy_shares') and day > current_date - 30), 0),
    'earned_30', coalesce((select sum(amount) from public.sim_events where agent_id = a.id and kind in ('salary', 'bonus') and day > current_date - 30), 0)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Droits
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array['public._sim_factors(date)', 'public._sim_snapshot(date)', 'public._sim_admin()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.sim_set_settings(boolean, numeric, numeric, int)', 'public.sim_shock_start(text, int, numeric, numeric, numeric, text)',
    'public.sim_shock_end(uuid)', 'public.sim_bonus(numeric, text)', 'public.sim_add_agents(int, text)',
    'public.get_population_overview(int)', 'public.sim_agent_detail(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- Premier relevé, pour que la page ait un point de départ.
do $$
begin
  if exists (select 1 from public.sim_agents) and not exists (select 1 from public.sim_daily) then
    perform public._sim_snapshot(coalesce((select last_processed_day from public.sim_state where id = true), current_date));
  end if;
end;
$$;
