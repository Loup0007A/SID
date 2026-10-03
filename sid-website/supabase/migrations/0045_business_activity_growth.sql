-- =========================================================
-- Augmentation de capital : une entreprise dont l'activité récente (le
-- chiffre d'affaires des 7 derniers jours, déjà calculé par
-- compute_business_fundamentals, voir 0038) est forte par rapport à sa
-- capitalisation boursière reçoit automatiquement de NOUVELLES actions,
-- ajoutées au stock disponible à l'achat (`shares_in_treasury`) — comme
-- une vraie entreprise qui lève plus de capital quand elle grossit.
--
-- Ça n'enrichit ni ne dilue personne d'un coup de baguette magique : les
-- actions neuves ne valent quelque chose que si quelqu'un les achète
-- ensuite (l'argent versé entre alors dans la trésorerie réelle de
-- l'entreprise, ce qui fait remonter sa valeur intrinsèque via les fonds
-- propres — exactement le même calcul que pour le reste du marché).
--
-- Vérifié une fois par semaine par entreprise (pas à chaque tick), pour
-- rester en phase avec la fenêtre de 7 jours utilisée pour mesurer
-- l'activité, et intégré au traitement déjà déclenché à la connexion de
-- n'importe quel membre (process_daily_economy) — toujours aucun job
-- planifié requis.
-- =========================================================

alter table public.businesses add column if not exists last_share_growth_at timestamptz;

insert into public.app_config (key, value) values
  ('business_growth_revenue_threshold_pct', '0.05'),  -- CA (7j) >= 5% de la capitalisation -> déclenche une augmentation
  ('business_growth_share_increase_pct', '0.02'),      -- +2% d'actions à chaque déclenchement
  ('business_growth_min_interval_days', '7')            -- au plus une fois par semaine et par entreprise
on conflict (key) do nothing;

create or replace function public.process_business_growth()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_threshold numeric := public.get_config_numeric('business_growth_revenue_threshold_pct', 0.05);
  v_increase_pct numeric := public.get_config_numeric('business_growth_share_increase_pct', 0.02);
  v_min_days numeric := public.get_config_numeric('business_growth_min_interval_days', 7);
  r record;
  v_fund jsonb;
  v_market_cap numeric;
  v_revenue numeric;
  v_new_shares int;
  v_count int := 0;
begin
  for r in
    select * from public.businesses
    where not is_closed
      and (last_share_growth_at is null or last_share_growth_at <= now() - (v_min_days || ' days')::interval)
  loop
    v_fund := public.compute_business_fundamentals(r.id);
    if v_fund is null then
      continue;
    end if;

    v_market_cap := r.share_price * r.share_count;
    v_revenue := (v_fund->>'revenue_7d')::numeric;

    if v_market_cap > 0 and v_revenue >= v_threshold * v_market_cap then
      v_new_shares := greatest(1, round(r.share_count * v_increase_pct)::int);

      update public.businesses
        set share_count = share_count + v_new_shares,
            shares_in_treasury = shares_in_treasury + v_new_shares,
            last_share_growth_at = now()
        where id = r.id;

      insert into public.business_transactions (business_id, amount, reason, created_by)
      values (r.id, 0, 'Augmentation de capital : +' || v_new_shares || ' action(s) (forte activité, CA 7j ' || round(v_revenue, 0) || ' Cr.)', null);

      v_count := v_count + 1;
    else
      -- Pas assez actif cette semaine : on repousse quand même la prochaine
      -- vérification d'une semaine, pour ne pas la re-tester à chaque jour.
      update public.businesses set last_share_growth_at = now() where id = r.id;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.process_business_growth() from public, anon, authenticated;

create or replace function public.process_daily_economy()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.process_daily_economy_core();
  perform public.process_market();
  perform public.expire_sanctions();
  perform public.process_business_growth();
end;
$$;

-- Expose les réglages au front (get_market_settings est déjà le point
-- d'entrée "réglages publics du marché", voir 0038/0043).
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
    'tick_minutes', public.get_config_numeric('market_tick_minutes', 60),
    'default_share_count', public.get_config_numeric('business_default_share_count', 1000),
    'min_initial_investment', public.get_config_numeric('business_min_initial_investment', 500),
    'growth_revenue_threshold_pct', public.get_config_numeric('business_growth_revenue_threshold_pct', 0.05),
    'growth_share_increase_pct', public.get_config_numeric('business_growth_share_increase_pct', 0.02)
  );
$$;
