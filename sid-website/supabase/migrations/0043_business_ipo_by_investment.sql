-- =========================================================
-- Retire la possibilité de choisir librement le nombre d'actions et le
-- prix de départ à la création d'une entreprise : le fondateur indique
-- seulement une MISE DE DÉPART (investie depuis son propre portefeuille,
-- comme un apport réel), et tout le reste en découle automatiquement —
-- exactement la même logique que le cours au fil du temps
-- (compute_business_fundamentals, migration 0038), simplement appliquée
-- dès le jour 0 : le nombre d'actions est fixe (business_default_share_count,
-- 1000 par défaut, réglable), et le prix de départ = mise / nombre d'actions.
-- La mise devient les fonds propres de départ de l'entreprise, qui pilotent
-- ensuite son cours exactement comme n'importe quelle autre entreprise.
-- =========================================================

insert into public.app_config (key, value) values
  ('business_default_share_count', '1000'),
  ('business_min_initial_investment', '500')
on conflict (key) do nothing;

create or replace function public.create_business(p_name text, p_description text, p_initial_investment numeric)
returns public.businesses
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_balance numeric(18,2);
  v_min_investment numeric;
  v_share_count int;
  v_share_price numeric(15,4);
begin
  if not public.has_permission(auth.uid(), 'entreprise') then
    raise exception 'Permission refusée';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Le nom ne peut pas être vide';
  end if;

  v_min_investment := public.get_config_numeric('business_min_initial_investment', 500);
  if p_initial_investment is null or p_initial_investment < v_min_investment then
    raise exception 'Mise de départ insuffisante (minimum % Cr.).', v_min_investment;
  end if;

  select balance into v_balance from public.wallets where user_id = auth.uid() for update;
  if v_balance is null or v_balance < 0 then
    raise exception 'Ton solde est négatif : règle-le avant de créer une entreprise.';
  end if;
  if v_balance < p_initial_investment then
    raise exception 'Solde insuffisant pour cette mise de départ.';
  end if;

  v_share_count := greatest(1, public.get_config_numeric('business_default_share_count', 1000)::int);
  v_share_price := round(p_initial_investment / v_share_count, 4);

  update public.wallets set balance = balance - p_initial_investment where user_id = auth.uid();

  insert into public.businesses (
    name, description, founder_id, treasury_balance,
    share_count, shares_in_treasury, share_price, initial_valuation
  )
  values (
    p_name, p_description, auth.uid(), p_initial_investment,
    v_share_count, v_share_count, v_share_price, p_initial_investment
  )
  returning * into v_business;

  insert into public.business_share_price_history (business_id, price)
  values (v_business.id, v_share_price);

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (v_business.id, p_initial_investment, 'Apport de fondateur (mise de départ)', auth.uid());

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), -p_initial_investment, 'Création d''entreprise : ' || p_name, auth.uid());

  return v_business;
end;
$$;

-- Expose le nombre d'actions par défaut au front (get_market_settings est
-- déjà le point d'entrée "réglages publics du marché", voir 0038) — permet
-- d'afficher un prix par action estimé pendant la saisie de la mise.
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
    'min_initial_investment', public.get_config_numeric('business_min_initial_investment', 500)
  );
$$;
