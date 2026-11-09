-- =====================================================================
-- 0092 — Lot 75 : erreur « DELETE requires a WHERE clause », objectif
-- hebdomadaire automatique des entreprises
-- =====================================================================
-- Rejouable.
--
-- 1. Supabase charge l'extension safeupdate pour les appels de l'API : tout
--    DELETE ou UPDATE sans WHERE est refusé, y compris dans une fonction.
--    Trois fonctions en contenaient :
--      - _reform_apply : la validation d'une réforme échouait ;
--      - sim_process_day : le 1er janvier (âge des habitants) ;
--      - economy_update : réindexation des salaires de la population.
--    Ajout de clauses WHERE, sans autre changement.
--
-- 2. app_config.business_min_weekly_revenue :
--      > 0  objectif fixe (la banque centrale n'y touche plus) ;
--      = 0  objectif automatique ;
--      < 0  pas de faillite.
--    Automatique : 40 % (business_min_weekly_auto_share) des ventes
--    hebdomadaires médianes des entreprises ouvertes depuis au moins
--    7 jours, mesurées sur 4 semaines et corrigées des réformes
--    monétaires. Bornes : de 10 % à 200 % de la base indexée sur les prix
--    (econ_base_business_min_weekly_revenue × indice / 100). Avec moins
--    de 3 entreprises mesurables, la base indexée elle-même. Arrondi à
--    50 z. Recalculé chaque jour (banque centrale) ou par le juge si le
--    dernier calcul a plus de 20 h.
-- =====================================================================

insert into public.app_config (key, value) values ('business_min_weekly_auto_share', '0.4')
on conflict (key) do nothing;

-- 1. Réforme : clauses WHERE exigées par safeupdate (reprise de 0087_reforme_monetaire.sql).
create or replace function public._reform_apply(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r public.money_reforms;
  f numeric;
  s jsonb;
  m uuid[];
  b uuid[];
  it uuid[];
  q uuid[];
  v_report jsonb;
  v_label text;
  v_pct text;
  v_by uuid := auth.uid();
  v_idx numeric;
  t record;
  p record;
  v_cur numeric;
  v_raw0 numeric := public._econ_raw_index();
  v_m0 numeric := public._econ_money_supply();
  v_raw1 numeric;
  v_m1 numeric;
begin
  perform pg_advisory_xact_lock(hashtext('money_reform'));
  select * into r from public.money_reforms where id = p_id for update;
  f := r.factor;
  s := public._reform_check_scopes(r.scopes);
  m := public._reform_ids(r.exceptions, 'membre');
  b := public._reform_ids(r.exceptions, 'entreprise');
  it := public._reform_ids(r.exceptions, 'objet');
  q := public._reform_ids(r.exceptions, 'quete');
  v_report := public._reform_preview(f, r.scopes, r.exceptions, r.round_prices);
  v_pct := public._reform_pct(f);
  v_label := 'Réforme monétaire n° ' || r.number || ' (' || v_pct || ')';
  select price_index into v_idx from public.economy_daily order by day desc limit 1;

  create temp table if not exists _reform_wallets (user_id uuid primary key, old numeric, new numeric) on commit drop;
  delete from _reform_wallets where true;

  if (s->>'portefeuilles')::boolean then
    insert into _reform_wallets (user_id, old, new)
    select user_id, balance, round(balance * f, 2) from public.wallets where balance <> 0 and not (user_id = any (m));
    insert into public.transactions (user_id, amount, reason, created_by)
    select user_id, new - old, v_label, v_by from _reform_wallets where new <> old;
    update public.wallets w set balance = x.new from _reform_wallets x where x.user_id = w.user_id;
  end if;

  if (s->>'epargne')::boolean then
    update public.bank_accounts set balance = round(balance * f, 2) where balance <> 0 and not (user_id = any (m));
  end if;

  if (s->>'dettes')::boolean then
    update public.wallets set debt_principal = round(debt_principal * f, 2) where debt_principal <> 0 and not (user_id = any (m));
    update public.businesses set debt_principal = round(debt_principal * f, 2)
    where not is_closed and debt_principal <> 0 and not (id = any (b));
  end if;

  if (s->>'entreprises')::boolean then
    insert into public.business_transactions (business_id, amount, reason, created_by)
    select id, round(treasury_balance * f, 2) - treasury_balance, v_label, v_by
    from public.businesses where not is_closed and treasury_balance <> 0 and not (id = any (b));
    update public.businesses
    set treasury_balance = round(treasury_balance * f, 2),
        initial_valuation = round(initial_valuation * f, 2),
        share_price = greatest(round(share_price * f, 4), 0.0001),
        ref_price = round(ref_price * f, 4),
        index_prev_price = round(index_prev_price * f, 4)
    where not is_closed and not (id = any (b));
    -- Bourse : cours ajustés, comme après une division d'actions.
    update public.market_orders set limit_price = greatest(round(limit_price * f, 4), 0.0001)
    where status = 'open' and business_id in (select id from public.businesses where not is_closed and not (id = any (b)));
    update public.market_candles
    set open = round(open * f, 4), high = round(high * f, 4), low = round(low * f, 4), close = round(close * f, 4), value = round(value * f, 2)
    where business_id in (select id from public.businesses where not is_closed and not (id = any (b)));
    update public.business_share_price_history set price = round(price * f, 4)
    where business_id in (select id from public.businesses where not is_closed and not (id = any (b)));
    update public.market_trades set price = round(price * f, 4)
    where business_id in (select id from public.businesses where not is_closed and not (id = any (b)));
  end if;

  if (s->>'salaires')::boolean then
    update public.salaries set amount = round(amount * f, 2) where not (user_id = any (m));
    update public.business_employees set salary = round(salary * f, 2)
    where business_id in (select id from public.businesses where not is_closed and not (id = any (b)));
  end if;

  if (s->>'objets')::boolean then
    update public.shop_items
    set price = public._reform_price(price, f, r.round_prices), sale_price = public._reform_price(sale_price, f, r.round_prices)
    where not (id = any (it));
    -- Prix relevés des 14 derniers jours : ramenés à la nouvelle échelle.
    update public.price_observations set unit_price = round(unit_price * f, 2)
    where at > now() - interval '15 days' and not (item_id = any (it));
  end if;

  if (s->>'autres')::boolean then
    update public.black_market_items set price = public._reform_price(price, f, r.round_prices) where price is not null;
    update public.envers_items set price = public._reform_price(price, f, r.round_prices) where price is not null;
    update public.mount_types set rental_price = public._reform_price(rental_price, f, r.round_prices) where rental_price is not null;
    update public.mount_rentals set price_override = public._reform_price(price_override, f, r.round_prices) where price_override is not null;
  end if;

  if (s->>'encheres')::boolean then
    update public.auction_bids set amount = round(amount * f, 2)
    where auction_id in (select id from public.auctions where status = 'open' and not (item_id = any (it)));
    update public.auctions
    set start_price = public._reform_price(start_price, f, r.round_prices),
        buy_now_price = public._reform_price(buy_now_price, f, r.round_prices),
        current_price = round(current_price * f, 2)
    where status = 'open' and not (item_id = any (it));
  end if;

  if (s->>'quetes')::boolean then
    update public.quests set reward = public._reform_price(reward, f, r.round_prices)
    where status in ('open', 'in_progress') and not (id = any (q));
  end if;

  if (s->>'population')::boolean then
    update public.sim_agents set balance = round(balance * f, 2), weekly_salary = round(weekly_salary * f, 2) where true;
  end if;

  if (s->>'caisse')::boolean then
    update public.tax_pool set balance = round(balance * f, 2) where true;
  end if;

  if (s->>'en_cours')::boolean then
    update public.withdrawal_requests set amount = round(amount * f, 2)
    where status = 'pending' and not (user_id = any (m)) and not (coalesce(business_id, gen_random_uuid()) = any (b));
    update public.expense_requests set reserved = round(reserved * f, 2), unit_price = round(unit_price * f, 2)
    where status = 'pending' and not (business_id = any (b));
    update public.tax_bills set amount = greatest(round(amount * f, 2), 0.01), base = round(base * f, 2), allowance = round(allowance * f, 2)
    where status = 'due' and not (user_id = any (m)) and not (coalesce(business_id, gen_random_uuid()) = any (b));
    update public.disputes set claimed = round(claimed * f, 2), fee = round(fee * f, 2) where status = 'open';
  end if;

  if (s->>'reglages')::boolean then
    for t in select * from public._reform_settings() loop
      v_cur := coalesce((select value from public.app_config c where c.key = t.key)::numeric, t.def);
      -- 0 = règle désactivée : on n'y touche pas.
      if v_cur > 0 then
        insert into public.app_config (key, value) values (t.key, round(v_cur * f, t.digits)::text)
        on conflict (key) do update set value = excluded.value;
      end if;
    end loop;
  end if;

  -- Effet réel sur le panier et sur la monnaie (exceptions et catégories comprises).
  v_raw1 := public._econ_raw_index();
  v_m1 := public._econ_money_supply();
  update public.money_reforms
  set status = 'applied', applied_at = now(),
      price_factor = round(coalesce(v_raw1 / nullif(v_raw0, 0), case when (s->>'objets')::boolean then f else 1 end), 6),
      money_factor = round(coalesce(v_m1 / nullif(v_m0, 0), case when (s->>'portefeuilles')::boolean then f else 1 end), 6),
      index_before = v_idx, report = v_report
  where id = r.id;

  -- La banque centrale refait son relevé du jour, hors effet de la réforme.
  perform public.economy_update(true);
  update public.money_reforms set index_after = (select price_index from public.economy_daily order by day desc limit 1) where id = r.id;

  -- Chaque membre est prévenu.
  for p in
    select pr.id, x.old, x.new, pr.id = any (m) as spared
    from public.profiles pr left join _reform_wallets x on x.user_id = pr.id
    where pr.status = 'active' and not public.is_sandbox_account(pr.id)
  loop
    insert into public.notifications (user_id, type, title, body, link)
    values (p.id, 'announcement', 'Réforme monétaire : ' || v_pct,
            case when p.spared then 'Ton compte n''est pas concerné. '
                 else 'Prix, soldes, salaires et récompenses sont multipliés par ' || public._reform_fx(f) || '. Ton pouvoir d''achat ne change pas. '
                      || coalesce('Portefeuille : ' || public._fmt_z(p.old) || ' z → ' || public._fmt_z(p.new) || ' z. ', '') end
            || r.motive,
            '/dashboard/economie');
  end loop;

  perform public.write_audit('money_reform_applied', null,
    jsonb_build_object('reforme', r.number, 'facteur', f, 'motif', r.motive, 'auteur', r.created_by, 'exceptions', jsonb_array_length(r.exceptions)));
  return (select to_jsonb(x) from public.money_reforms x where id = r.id);
end;
$$;

-- 2. Population : idem pour l'anniversaire du 1er janvier (reprise de 0091_simulation_population.sql).
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
    update public.sim_agents set age = age + 1 where true;
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

-- 3. Banque centrale : idem, et l'objectif des entreprises ne suit plus l'indice (voir 4) (reprise de 0087_reforme_monetaire.sql).
create or replace function public.economy_update(p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_tz text := public.stats_timezone();
  v_today date := (now() at time zone public.stats_timezone())::date;
  v_prev public.economy_daily;
  v_today_row public.economy_daily;
  v_base numeric;
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
  -- Une réforme monétaire depuis ce relevé change l'échelle des prix : on en tient compte.
  v_prev_index := coalesce(v_prev.price_index * public._reform_factor_since(v_prev.computed_at, 'prix'), 100);
  select * into v_today_row from public.economy_daily where day = v_today;

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
    v_infl := v_index / nullif(v_old.price_index * public._reform_factor_since(v_old.computed_at, 'prix'), 0) - 1;
    v_growth := v_m / nullif(v_old.money_supply * public._reform_factor_since(v_old.computed_at, 'monnaie'), 0) - 1;
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
  -- Objectif hebdomadaire des entreprises : fixe, automatique (0) ou désactivé (< 0). Lot 75.
  if public.get_config_numeric('business_min_weekly_revenue', 2000) = 0 then
    perform public._business_min_auto_refresh(true);
  end if;
  v_bankrupt := public.business_weekly_minimum();
  v_maxdebt := round(public.get_config_numeric('econ_base_max_debt_principal', 50000) * v_f);
  v_maxbizdebt := round(public.get_config_numeric('econ_base_max_business_debt_principal', 200000) * v_f);

  if v_auto then
    perform public._cfg_set('bank_daily_interest_rate', v_savings);
    perform public._cfg_set('debt_daily_interest_rate', v_loan);
    perform public._cfg_set('weekly_wealth_tax_rate', v_wealth);
    perform public._cfg_set('corporate_tax_rate', v_corp);
    perform public._cfg_set('wealth_tax_allowance', v_allow);
    perform public._cfg_set('max_debt_principal', v_maxdebt);
    perform public._cfg_set('max_business_debt_principal', v_maxbizdebt);
    -- Salaires de la population : suivent les prix.
    -- Relevé refait dans la journée : seul l'écart avec le premier relevé compte.
    v_base := case when v_today_row.day is not null
                   then v_today_row.price_index * public._reform_factor_since(v_today_row.computed_at, 'prix')
                   when v_prev.day is not null then v_prev_index end;
    if v_base is not null and v_base > 0 and v_index <> v_base then
      update public.sim_agents set weekly_salary = round(weekly_salary * (v_index / v_base), 2) where true;
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
-- 4. Objectif hebdomadaire des entreprises
-- ---------------------------------------------------------------------
create or replace function public._business_min_auto_compute()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_idx numeric;
  v_base numeric;
  v_share numeric := greatest(0.05, least(1, public.get_config_numeric('business_min_weekly_auto_share', 0.4)));
  v_med numeric;
  v_n int;
  v_val numeric;
begin
  select price_index into v_idx from public.economy_daily order by day desc limit 1;
  v_base := public.get_config_numeric('econ_base_business_min_weekly_revenue', 2000) * coalesce(v_idx, 100) / 100.0;

  -- Ventes hebdomadaires moyennes de chaque entreprise sur ses 4 dernières
  -- semaines (ou depuis son ouverture), en zénis d'aujourd'hui. Les achats
  -- du fondateur ne comptent pas, comme pour le juge.
  select percentile_cont(0.5) within group (order by x.w), count(*) into v_med, v_n
  from (
    select coalesce((select sum(t.amount * public._reform_factor_since(t.created_at, 'prix'))
                     from public.business_transactions t
                     where t.business_id = b.id and t.kind = 'sale' and t.created_at >= b.s
                       and t.created_by is distinct from b.founder_id), 0)
           / (extract(epoch from now() - b.s) / 604800.0) as w
    from (select id, founder_id, greatest(created_at, now() - interval '28 days') as s
          from public.businesses
          where not is_closed and created_at <= now() - interval '7 days') b
  ) x;

  if v_n >= 3 then
    v_val := greatest(0.1 * v_base, least(2 * v_base, v_share * v_med));
  else
    v_val := v_base;
  end if;
  v_val := greatest(50, round(v_val / 50) * 50);

  return jsonb_build_object(
    'value', v_val,
    'median', round(coalesce(v_med, 0)),
    'businesses', v_n,
    'share', v_share,
    'base', round(v_base),
    'floor', round(0.1 * v_base),
    'cap', round(2 * v_base),
    'computed_at', now());
end;
$$;

-- Recalcule et garde le résultat (au plus une fois toutes les 20 h sans p_force).
create or replace function public._business_min_auto_refresh(p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_cur jsonb;
  v jsonb;
begin
  select value::jsonb into v_cur from public.app_config where key = 'business_min_weekly_auto';
  if not coalesce(p_force, false) and v_cur is not null
     and (v_cur->>'computed_at')::timestamptz > now() - interval '20 hours' then
    return v_cur;
  end if;
  v := public._business_min_auto_compute();
  insert into public.app_config (key, value) values ('business_min_weekly_auto', v::text)
  on conflict (key) do update set value = excluded.value;
  return v;
end;
$$;

-- Objectif en vigueur (0 = pas de faillite).
create or replace function public.business_weekly_minimum()
returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare
  v numeric := public.get_config_numeric('business_min_weekly_revenue', 2000);
  v_auto jsonb;
begin
  if v > 0 then return v; end if;
  if v < 0 then return 0; end if;
  select value::jsonb into v_auto from public.app_config where key = 'business_min_weekly_auto';
  if v_auto is null then v_auto := public._business_min_auto_compute(); end if;
  return (v_auto->>'value')::numeric;
end;
$$;

-- Administration → Économie → Entreprises.
create or replace function public.business_min_status()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v numeric := public.get_config_numeric('business_min_weekly_revenue', 2000);
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Réservé à la gestion de l''économie.';
  end if;
  return jsonb_build_object(
    'mode', case when v > 0 then 'fixe' when v < 0 then 'off' else 'auto' end,
    'setting', v,
    'effective', public.business_weekly_minimum(),
    -- En automatique : le calcul en vigueur. Sinon : ce que donnerait l'automatique.
    'auto', case when v = 0 then coalesce((select value::jsonb from public.app_config where key = 'business_min_weekly_auto'),
                                          public._business_min_auto_compute())
                 else public._business_min_auto_compute() end);
end;
$$;

create or replace function public.business_min_set(p_mode text, p_amount numeric default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_old numeric := public.get_config_numeric('business_min_weekly_revenue', 2000);
  v_val numeric;
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Réservé à la gestion de l''économie.';
  end if;
  if p_mode = 'fixe' and (p_amount is null or p_amount < 1 or p_amount > 10000000) then
    raise exception 'Indique un montant entre 1 et 10 000 000 z.';
  end if;
  v_val := case p_mode when 'auto' then 0 when 'off' then -1 when 'fixe' then round(p_amount) end;
  if v_val is null then raise exception 'Mode inconnu : auto, fixe ou off.'; end if;

  perform public._cfg_set('business_min_weekly_revenue', v_val);
  if p_mode = 'auto' then perform public._business_min_auto_refresh(true); end if;
  perform public.write_audit('business_min_set', null,
    jsonb_build_object('mode', p_mode, 'avant', v_old, 'apres', v_val, 'en_vigueur', public.business_weekly_minimum()));
  return public.business_min_status();
end;
$$;

-- Le juge (reprise de 0082_faillites_retraits.sql).
create or replace function public.businesses_check_bankruptcy()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_min numeric;
  r record;
  v_start timestamptz;
  v_rev numeric;
  v_failed boolean;
  n int := 0;
begin
  if public.get_config_numeric('business_min_weekly_revenue', 2000) = 0 then
    perform public._business_min_auto_refresh(false);
  end if;
  v_min := public.business_weekly_minimum();
  if v_min <= 0 then return 0; end if;
  for r in select * from public.businesses where not is_closed for update skip locked loop
    v_start := coalesce(r.revenue_period_start, r.created_at);
    v_failed := false;
    while v_start + interval '7 days' <= now() loop
      v_rev := public._business_period_revenue(r.id, v_start, v_start + interval '7 days');
      if v_rev < v_min then
        perform public._business_bankrupt(r.id, v_rev, v_min);
        v_failed := true;
        n := n + 1;
        exit;
      end if;
      v_start := v_start + interval '7 days';
    end loop;
    if v_failed then continue; end if;

    if r.revenue_period_start is distinct from v_start then
      update public.businesses set revenue_period_start = v_start where id = r.id;
    end if;

    -- Avertissement : plus que deux jours et le compte n'y est pas.
    if now() >= v_start + interval '5 days' and (r.bankruptcy_warned_at is null or r.bankruptcy_warned_at < v_start) then
      v_rev := public._business_period_revenue(r.id, v_start, v_start + interval '7 days');
      if v_rev < v_min then
        insert into public.notifications (user_id, type, title, body, link)
        select r.founder_id, 'business', 'Faillite en vue : ' || r.name,
               'Chiffre d''affaires de la semaine : ' || public._fmt_z(v_rev) || ' z sur ' || public._fmt_z(v_min)
               || ' z. Fin de la semaine le ' || to_char((v_start + interval '7 days') at time zone public.stats_timezone(), 'DD/MM à HH24"h"MI') || '.',
               '/dashboard/business'
        where r.founder_id is not null;
        update public.businesses set bankruptcy_warned_at = now() where id = r.id;
      end if;
    end if;
  end loop;
  return n;
end;
$$;

-- La semaine en cours (reprise de 0082_faillites_retraits.sql).
create or replace function public.business_weeks(p_all boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_min numeric := public.business_weekly_minimum();
  v_mode text := case when public.get_config_numeric('business_min_weekly_revenue', 2000) > 0 then 'fixe'
                      when public.get_config_numeric('business_min_weekly_revenue', 2000) < 0 then 'off' else 'auto' end;
  v_all boolean := coalesce(p_all, false) and public.has_permission(auth.uid(), 'manage_economy');
begin
  if v_uid is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'business_id', x.id,
             'name', x.name,
             'founder', (select nickname from public.profiles where id = x.founder_id),
             'treasury', x.treasury_balance,
             'period_start', x.s,
             'period_end', x.s + interval '7 days',
             'revenue', public._business_period_revenue(x.id, x.s, x.s + interval '7 days'),
             'minimum', v_min,
             'mode', v_mode,
             'pending_withdrawals', (select coalesce(sum(amount), 0) from public.withdrawal_requests w where w.business_id = x.id and w.status = 'pending')
           ) order by x.s + interval '7 days')
    from (
      select b.*,
             -- Début de la semaine en cours, même si le juge n'est pas encore passé.
             coalesce(b.revenue_period_start, b.created_at)
               + (floor(greatest(extract(epoch from now() - coalesce(b.revenue_period_start, b.created_at)), 0) / 604800))::int * interval '7 days' as s
      from public.businesses b
      where not b.is_closed and (v_all or b.founder_id = v_uid)
    ) x
  ), '[]'::jsonb);
end;
$$;


-- Réforme : l'objectif fixe des entreprises est un réglage ordinaire (0 et négatif ne bougent pas) (reprise de 0087_reforme_monetaire.sql).
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
    ('wealth_tax_allowance', 1000, 0, 'Abattement de l''impôt sur la fortune', true),
    ('max_debt_principal', 50000, 0, 'Plafond d''emprunt d''un membre', true),
    ('max_business_debt_principal', 200000, 0, 'Plafond d''emprunt d''une entreprise', true)
  ) as t(key, def, digits, label, auto)
  where not (t.auto and coalesce((select value from public.app_config where key = 'econ_auto'), 'on') = 'on');
$$;

-- Réforme : note de l'aperçu (reprise de 0087_reforme_monetaire.sql).
create or replace function public._reform_preview(p_factor numeric, p_scopes jsonb, p_ex jsonb, p_round boolean)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  f numeric := p_factor;
  m uuid[] := public._reform_ids(p_ex, 'membre');
  b uuid[] := public._reform_ids(p_ex, 'entreprise');
  it uuid[] := public._reform_ids(p_ex, 'objet');
  q uuid[] := public._reform_ids(p_ex, 'quete');
  s jsonb := public._reform_check_scopes(p_scopes);
  v_cats jsonb := '[]'::jsonb;
  v_idx numeric;
  r record;
begin
  -- Soldes
  select count(*) as n, coalesce(sum(balance), 0) as a, coalesce(sum(round(balance * f, 2)), 0) as c into r
  from public.wallets where balance <> 0 and not (user_id = any (m));
  v_cats := v_cats || jsonb_build_object('key', 'portefeuilles', 'label', 'Portefeuilles des membres', 'kind', 'solde',
    'on', s->'portefeuilles', 'n', r.n, 'before', r.a, 'after', r.c);
  select count(*) as n, coalesce(sum(balance), 0) as a, coalesce(sum(round(balance * f, 2)), 0) as c into r
  from public.bank_accounts where balance <> 0 and not (user_id = any (m));
  v_cats := v_cats || jsonb_build_object('key', 'epargne', 'label', 'Épargne', 'kind', 'solde', 'on', s->'epargne', 'n', r.n, 'before', r.a, 'after', r.c);
  select (select count(*) from public.wallets where debt_principal <> 0 and not (user_id = any (m)))
         + (select count(*) from public.businesses where not is_closed and debt_principal <> 0 and not (id = any (b))) as n,
         (select coalesce(sum(debt_principal), 0) from public.wallets where not (user_id = any (m)))
         + (select coalesce(sum(debt_principal), 0) from public.businesses where not is_closed and not (id = any (b))) as a,
         (select coalesce(sum(round(debt_principal * f, 2)), 0) from public.wallets where not (user_id = any (m)))
         + (select coalesce(sum(round(debt_principal * f, 2)), 0) from public.businesses where not is_closed and not (id = any (b))) as c
  into r;
  v_cats := v_cats || jsonb_build_object('key', 'dettes', 'label', 'Emprunts en cours', 'kind', 'solde', 'on', s->'dettes', 'n', r.n, 'before', r.a, 'after', r.c);
  select count(*) as n, coalesce(sum(treasury_balance), 0) as a, coalesce(sum(round(treasury_balance * f, 2)), 0) as c into r
  from public.businesses where not is_closed and not (id = any (b));
  v_cats := v_cats || jsonb_build_object('key', 'entreprises', 'label', 'Trésoreries et cours des actions', 'kind', 'solde',
    'on', s->'entreprises', 'n', r.n, 'before', r.a, 'after', r.c,
    'note', 'Les cours, le carnet d''ordres et l''historique de la bourse sont ajustés du même facteur.');
  select (select count(*) from public.salaries where is_active and not (user_id = any (m)))
         + (select count(*) from public.business_employees e join public.businesses z on z.id = e.business_id
            where not z.is_closed and not (z.id = any (b))) as n,
         (select coalesce(sum(amount), 0) from public.salaries where is_active and not (user_id = any (m)))
         + (select coalesce(sum(e.salary), 0) from public.business_employees e join public.businesses z on z.id = e.business_id
            where not z.is_closed and not (z.id = any (b))) as a,
         (select coalesce(sum(round(amount * f, 2)), 0) from public.salaries where is_active and not (user_id = any (m)))
         + (select coalesce(sum(round(e.salary * f, 2)), 0) from public.business_employees e join public.businesses z on z.id = e.business_id
            where not z.is_closed and not (z.id = any (b))) as c
  into r;
  v_cats := v_cats || jsonb_build_object('key', 'salaires', 'label', 'Salaires (membres et employés)', 'kind', 'prix', 'on', s->'salaires', 'n', r.n, 'before', r.a, 'after', r.c);

  -- Prix
  select count(*) as n, coalesce(sum(price), 0) as a, coalesce(sum(public._reform_price(price, f, p_round)), 0) as c into r
  from public.shop_items where hidden_at is null and not (id = any (it));
  v_cats := v_cats || jsonb_build_object('key', 'objets', 'label', 'Prix de la boutique', 'kind', 'prix', 'on', s->'objets', 'n', r.n, 'before', r.a, 'after', r.c,
    'examples', coalesce((select jsonb_agg(jsonb_build_object('label', x.name, 'before', x.price, 'after', public._reform_price(x.price, f, p_round)))
                          from (select name, price from public.shop_items where is_active and hidden_at is null and not (id = any (it))
                                order by price desc limit 4) x), '[]'::jsonb));
  select (select count(*) from public.black_market_items) + (select count(*) from public.envers_items)
         + (select count(*) from public.mount_types) + (select count(*) from public.mount_rentals where price_override is not null) as n,
         (select coalesce(sum(price), 0) from public.black_market_items) + (select coalesce(sum(price), 0) from public.envers_items)
         + (select coalesce(sum(rental_price), 0) from public.mount_types) + (select coalesce(sum(price_override), 0) from public.mount_rentals) as a,
         (select coalesce(sum(public._reform_price(price, f, p_round)), 0) from public.black_market_items)
         + (select coalesce(sum(public._reform_price(price, f, p_round)), 0) from public.envers_items)
         + (select coalesce(sum(public._reform_price(rental_price, f, p_round)), 0) from public.mount_types)
         + (select coalesce(sum(public._reform_price(price_override, f, p_round)), 0) from public.mount_rentals) as c
  into r;
  v_cats := v_cats || jsonb_build_object('key', 'autres', 'label', 'Marché noir, Envers, montures', 'kind', 'prix', 'on', s->'autres', 'n', r.n, 'before', r.a, 'after', r.c);
  select count(*) as n, coalesce(sum(coalesce(current_price, start_price)), 0) as a,
         coalesce(sum(coalesce(round(current_price * f, 2), public._reform_price(start_price, f, p_round))), 0) as c into r
  from public.auctions where status = 'open' and not (item_id = any (it));
  v_cats := v_cats || jsonb_build_object('key', 'encheres', 'label', 'Enchères en cours', 'kind', 'prix', 'on', s->'encheres', 'n', r.n, 'before', r.a, 'after', r.c);
  select count(*) as n, coalesce(sum(reward), 0) as a, coalesce(sum(public._reform_price(reward, f, p_round)), 0) as c into r
  from public.quests where status in ('open', 'in_progress') and not (id = any (q));
  v_cats := v_cats || jsonb_build_object('key', 'quetes', 'label', 'Récompenses des quêtes ouvertes', 'kind', 'prix', 'on', s->'quetes', 'n', r.n, 'before', r.a, 'after', r.c,
    'examples', coalesce((select jsonb_agg(jsonb_build_object('label', x.title, 'before', x.reward, 'after', public._reform_price(x.reward, f, p_round)))
                          from (select title, reward from public.quests where status in ('open', 'in_progress') and reward > 0 and not (id = any (q))
                                order by reward desc limit 4) x), '[]'::jsonb));

  -- Le reste
  select count(*) as n, coalesce(sum(balance), 0) as a, coalesce(sum(round(balance * f, 2)), 0) as c into r from public.sim_agents;
  v_cats := v_cats || jsonb_build_object('key', 'population', 'label', 'Population simulée (soldes et salaires)', 'kind', 'solde', 'on', s->'population', 'n', r.n, 'before', r.a, 'after', r.c);
  select count(*) as n, coalesce(sum(balance), 0) as a, coalesce(sum(round(balance * f, 2)), 0) as c into r from public.tax_pool;
  v_cats := v_cats || jsonb_build_object('key', 'caisse', 'label', 'Caisse commune', 'kind', 'solde', 'on', s->'caisse', 'n', r.n, 'before', r.a, 'after', r.c);
  select (select count(*) from public.withdrawal_requests where status = 'pending' and not (user_id = any (m)) and not (coalesce(business_id, gen_random_uuid()) = any (b)))
         + (select count(*) from public.expense_requests where status = 'pending' and not (business_id = any (b)))
         + (select count(*) from public.tax_bills where status = 'due' and not (user_id = any (m)) and not (coalesce(business_id, gen_random_uuid()) = any (b)))
         + (select count(*) from public.disputes where status = 'open') as n,
         (select coalesce(sum(amount), 0) from public.withdrawal_requests where status = 'pending' and not (user_id = any (m)) and not (coalesce(business_id, gen_random_uuid()) = any (b)))
         + (select coalesce(sum(reserved), 0) from public.expense_requests where status = 'pending' and not (business_id = any (b)))
         + (select coalesce(sum(amount), 0) from public.tax_bills where status = 'due' and not (user_id = any (m)) and not (coalesce(business_id, gen_random_uuid()) = any (b)))
         + (select coalesce(sum(claimed), 0) from public.disputes where status = 'open') as a
  into r;
  v_cats := v_cats || jsonb_build_object('key', 'en_cours', 'label', 'En attente : retraits, frais, avis d''impôt, litiges', 'kind', 'solde',
    'on', s->'en_cours', 'n', r.n, 'before', r.a, 'after', round(r.a * f, 2));
  v_cats := v_cats || jsonb_build_object('key', 'reglages', 'label', 'Seuils et tarifs', 'kind', 'prix', 'on', s->'reglages',
    'note', case when coalesce((select value from public.app_config where key = 'econ_auto'), 'on') = 'on'
                 then 'Abattement et plafonds d''emprunt suivent déjà l''indice des prix (banque centrale).' end,
    'n', (select count(*) from public._reform_settings()),
    'examples', (select jsonb_agg(jsonb_build_object('label', x.label, 'before', x.v, 'after', round(x.v * f, x.digits)))
                 from (select t.label, t.digits, coalesce((select value from public.app_config c where c.key = t.key)::numeric, t.def) as v
                       from public._reform_settings() t) x));

  select price_index into v_idx from public.economy_daily order by day desc limit 1;
  return jsonb_build_object(
    'factor', f,
    'categories', v_cats,
    'index_now', v_idx,
    'index_after', case when v_idx is not null and public._reform_on(s, 'objets') then round(v_idx * f, 4) else v_idx end,
    'members', (select count(*) from public.profiles where status = 'active' and not public.is_sandbox_account(id))
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Droits et calcul initial
-- ---------------------------------------------------------------------
revoke all on function public._business_min_auto_compute() from public, anon, authenticated;
revoke all on function public._business_min_auto_refresh(boolean) from public, anon, authenticated;
grant execute on function public.business_weekly_minimum() to authenticated;
grant execute on function public.business_min_status() to authenticated;
grant execute on function public.business_min_set(text, numeric) to authenticated;

do $$
begin
  if public.get_config_numeric('business_min_weekly_revenue', 2000) = 0 then
    perform public._business_min_auto_refresh(true);
  end if;
end $$;

notify pgrst, 'reload schema';
