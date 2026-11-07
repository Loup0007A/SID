-- =====================================================================
-- Lot 70 : réforme monétaire. Rejouable. À lancer après 0086.
--
-- Quand les prix ont trop monté, un admin « Économie » prépare une réforme :
-- tous les montants du S.I.D. sont multipliés par un même facteur (par
-- exemple × 0,8 pour −20 %) : soldes, épargne, dettes, trésoreries, cours
-- des actions, prix des objets, récompenses des quêtes, salaires,
-- population, caisse commune, montants en attente, seuils et tarifs. Le
-- pouvoir d'achat de chacun ne change pas ; le cours du zéni, lui, remonte.
--
-- Il choisit le facteur, les catégories concernées et des exceptions (une
-- quête, un objet, un membre, une entreprise). Un aperçu montre chaque
-- catégorie avant et après.
--
-- La réforme n'est appliquée qu'après la vérification d'un admin
-- « Économie » : un autre que son auteur, sauf s'il est le seul. La
-- validation porte sur la version vérifiée (une modification entre-temps
-- oblige à revérifier). Tout est appliqué en une seule transaction ;
-- chaque membre reçoit une notification et une ligne dans son historique.
--
-- La banque centrale (0084) tient compte des réformes : l'inflation et la
-- croissance monétaire sont calculées hors réforme, et les historiques de
-- cours de bourse sont ajustés (comme lors d'une division d'actions).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
create table if not exists public.money_reforms (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity,
  factor numeric(12, 6) not null check (factor between 0.05 and 20 and factor <> 1),
  motive text not null check (char_length(motive) between 3 and 500),
  round_prices boolean not null default true,
  scopes jsonb not null default '{}'::jsonb,
  exceptions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'pending', 'applied', 'rejected', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  applied_at timestamptz,
  price_factor numeric(12, 6),
  money_factor numeric(12, 6),
  index_before numeric(12, 4),
  index_after numeric(12, 4),
  report jsonb
);
create index if not exists money_reforms_status_idx on public.money_reforms (status, created_at desc);
create index if not exists money_reforms_applied_idx on public.money_reforms (applied_at) where status = 'applied';

alter table public.money_reforms enable row level security;
drop policy if exists "money_reforms_select" on public.money_reforms;
create policy "money_reforms_select" on public.money_reforms for select to authenticated
  using (status = 'applied' or public.has_permission(auth.uid(), 'manage_economy'));
revoke all on public.money_reforms from anon;
revoke insert, update, delete on public.money_reforms from authenticated;
grant select on public.money_reforms to authenticated;

-- ---------------------------------------------------------------------
-- 2. Outils
-- ---------------------------------------------------------------------
-- Produit des facteurs des réformes appliquées après un instant donné.
create or replace function public._reform_factor_since(p_at timestamptz, p_kind text)
returns numeric
language sql stable security definer set search_path = public
as $$
  select case when p_at is null then 1 else coalesce((
    select exp(sum(ln(case when p_kind = 'monnaie' then money_factor else price_factor end)))
    from public.money_reforms
    where status = 'applied' and applied_at > p_at
      and (case when p_kind = 'monnaie' then money_factor else price_factor end) > 0
  ), 1) end;
$$;

create or replace function public._reform_ids(p_ex jsonb, p_kind text)
returns uuid[]
language sql immutable
as $$
  select coalesce(array_agg((e->>'id')::uuid), '{}'::uuid[])
  from jsonb_array_elements(case when jsonb_typeof(p_ex) = 'array' then p_ex else '[]'::jsonb end) e
  where e->>'kind' = p_kind and (e->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function public._reform_on(p_scopes jsonb, p_key text)
returns boolean
language sql immutable
as $$
  select coalesce((p_scopes->>p_key)::boolean, true);
$$;

-- Indice brut des prix (même calcul que economy_update) et masse monétaire :
-- mesurés avant et après la réforme, ils donnent son effet réel, exceptions
-- comprises.
create or replace function public._econ_raw_index()
returns numeric
language sql stable security definer set search_path = public
as $$
  select 100 * exp(sum(x.w * ln(x.p / x.ref)) / nullif(sum(x.w), 0))
  from (
    select sum(o.unit_price * o.quantity) as w,
           sum(o.unit_price * o.quantity) / sum(o.quantity) as p,
           r.ref_price as ref
    from public.price_observations o
    join public.price_reference r on r.item_id = o.item_id
    where o.at > now() - interval '14 days' and r.ref_price > 0
    group by o.item_id, r.ref_price
    having sum(o.unit_price * o.quantity) > 0
  ) x;
$$;

create or replace function public._econ_money_supply()
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce((select sum(balance) from public.wallets), 0)
       + coalesce((select sum(balance) from public.bank_accounts), 0)
       + coalesce((select sum(treasury_balance) from public.businesses where not is_closed), 0)
       + coalesce((select sum(balance) from public.sim_agents), 0)
       + coalesce((select sum(balance) from public.tax_pool), 0);
$$;

-- « −20 % », « +12,5 % » ; « 0,8 ».
create or replace function public._reform_pct(f numeric)
returns text
language sql immutable
as $$
  select case when f < 1 then '−' else '+' end
         || replace(trim(trailing '.' from trim(trailing '0' from round(abs(f - 1) * 100, 1)::text)), '.', ',') || ' %';
$$;
create or replace function public._reform_fx(f numeric)
returns text
language sql immutable
as $$
  select replace(trim(trailing '.' from trim(trailing '0' from round(f, 4)::text)), '.', ',');
$$;

-- Un prix : arrondi au zéni (1 z au moins) si demandé.
create or replace function public._reform_price(p numeric, f numeric, p_round boolean)
returns numeric
language sql immutable
as $$
  select case when p is null then null
              when p <= 0 then p
              when p_round then greatest(1, round(p * f))
              else greatest(0.01, round(p * f, 2)) end;
$$;

-- Réglages en zénis (clé, valeur par défaut, décimales). Avec l'adaptation
-- automatique (0084), les quatre derniers suivent déjà l'indice des prix : la
-- réforme les laisse à la banque centrale.
drop function if exists public._reform_settings();
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
    ('business_min_weekly_revenue', 2000, 0, 'Chiffre d''affaires minimum par semaine', true),
    ('wealth_tax_allowance', 1000, 0, 'Abattement de l''impôt sur la fortune', true),
    ('max_debt_principal', 50000, 0, 'Plafond d''emprunt d''un membre', true),
    ('max_business_debt_principal', 200000, 0, 'Plafond d''emprunt d''une entreprise', true)
  ) as t(key, def, digits, label, auto)
  where not (t.auto and coalesce((select value from public.app_config where key = 'econ_auto'), 'on') = 'on');
$$;

create or replace function public._reform_check_scopes(p_scopes jsonb)
returns jsonb
language plpgsql immutable
as $$
declare
  k text;
  v_out jsonb := '{}'::jsonb;
begin
  foreach k in array array['portefeuilles', 'epargne', 'dettes', 'entreprises', 'salaires', 'objets', 'autres',
                           'encheres', 'quetes', 'population', 'caisse', 'en_cours', 'reglages'] loop
    v_out := v_out || jsonb_build_object(k, public._reform_on(coalesce(p_scopes, '{}'::jsonb), k));
  end loop;
  return v_out;
end;
$$;

-- Exceptions vérifiées : chaque identifiant existe, libellé relu en base.
create or replace function public._reform_check_exceptions(p_ex jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  e jsonb;
  v_label text;
  v_out jsonb := '[]'::jsonb;
  v_id uuid;
begin
  if p_ex is null or jsonb_typeof(p_ex) <> 'array' then return '[]'::jsonb; end if;
  if jsonb_array_length(p_ex) > 200 then raise exception 'Trop d''exceptions (200 au plus).'; end if;
  for e in select * from jsonb_array_elements(p_ex) loop
    begin
      v_id := (e->>'id')::uuid;
    exception when others then
      raise exception 'Exception invalide.';
    end;
    v_label := case e->>'kind'
      when 'quete' then (select title from public.quests where id = v_id)
      when 'objet' then (select name from public.shop_items where id = v_id)
      when 'membre' then (select nickname from public.profiles where id = v_id)
      when 'entreprise' then (select name from public.businesses where id = v_id)
    end;
    if v_label is null then raise exception 'Exception introuvable (%).', coalesce(e->>'kind', '?'); end if;
    if not v_out @> jsonb_build_array(jsonb_build_object('kind', e->>'kind', 'id', v_id)) then
      v_out := v_out || jsonb_build_array(jsonb_build_object('kind', e->>'kind', 'id', v_id, 'label', v_label));
    end if;
  end loop;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Aperçu : chaque catégorie avant / après
-- ---------------------------------------------------------------------
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
                 then 'Abattement, chiffre d''affaires minimum et plafonds d''emprunt suivent déjà l''indice des prix (banque centrale).' end,
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
-- 4. Application (une seule transaction)
-- ---------------------------------------------------------------------
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
  delete from _reform_wallets;

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
    update public.black_market_items set price = public._reform_price(price, f, r.round_prices);
    update public.envers_items set price = public._reform_price(price, f, r.round_prices);
    update public.mount_types set rental_price = public._reform_price(rental_price, f, r.round_prices);
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
    update public.sim_agents set balance = round(balance * f, 2), weekly_salary = round(weekly_salary * f, 2);
  end if;

  if (s->>'caisse')::boolean then
    update public.tax_pool set balance = round(balance * f, 2);
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

-- ---------------------------------------------------------------------
-- 5. Circuit : brouillon → à vérifier → validée (appliquée) ou refusée
-- ---------------------------------------------------------------------
create or replace function public._reform_admin()
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

-- Admins « Économie » actifs autres que p_uid.
create or replace function public._reform_other_admins(p_uid uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select p.id from public.profiles p
  where p.id <> coalesce(p_uid, '00000000-0000-0000-0000-000000000000'::uuid) and p.status = 'active'
    and not public.is_sandbox_account(p.id) and public.has_permission(p.id, 'manage_economy');
$$;

create or replace function public.reform_preview(p_factor numeric, p_scopes jsonb default '{}'::jsonb,
                                                 p_exceptions jsonb default '[]'::jsonb, p_round boolean default true)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public._reform_admin();
  if p_factor is null or p_factor < 0.05 or p_factor > 20 then raise exception 'Facteur hors limites (entre 0,05 et 20).'; end if;
  return public._reform_preview(p_factor, p_scopes, public._reform_check_exceptions(p_exceptions), coalesce(p_round, true));
end;
$$;

create or replace function public.reform_save(p_id uuid, p_factor numeric, p_motive text, p_round boolean,
                                              p_scopes jsonb, p_exceptions jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._reform_admin();
  v_motive text := nullif(trim(coalesce(p_motive, '')), '');
  v_id uuid;
  r public.money_reforms;
begin
  if p_factor is null or p_factor < 0.05 or p_factor > 20 then raise exception 'Facteur hors limites (entre −95 %% et ×20).'; end if;
  p_factor := round(p_factor, 6);
  if p_factor = 1 then raise exception 'Un facteur de 1 ne change rien.'; end if;
  if v_motive is null or char_length(v_motive) < 3 then raise exception 'Indique le motif de la réforme.'; end if;
  if char_length(v_motive) > 500 then raise exception 'Le motif est limité à 500 caractères.'; end if;

  if p_id is null then
    insert into public.money_reforms (factor, motive, round_prices, scopes, exceptions, created_by)
    values (p_factor, v_motive, coalesce(p_round, true), public._reform_check_scopes(p_scopes), public._reform_check_exceptions(p_exceptions), v_uid)
    returning id into v_id;
    return v_id;
  end if;

  select * into r from public.money_reforms where id = p_id for update;
  if r.id is null then raise exception 'Réforme introuvable.'; end if;
  if r.created_by is distinct from v_uid then raise exception 'Seul l''auteur modifie sa réforme.'; end if;
  if r.status not in ('draft', 'pending', 'rejected') then raise exception 'Cette réforme ne se modifie plus.'; end if;
  -- Toute modification renvoie la réforme en brouillon : elle devra être revérifiée.
  update public.money_reforms
  set factor = p_factor, motive = v_motive, round_prices = coalesce(p_round, true),
      scopes = public._reform_check_scopes(p_scopes), exceptions = public._reform_check_exceptions(p_exceptions),
      status = 'draft', submitted_at = null, updated_at = clock_timestamp()
  where id = r.id;
  return r.id;
end;
$$;

create or replace function public.reform_submit(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._reform_admin();
  r public.money_reforms;
  v_admin uuid;
  v_nick text;
  v_n int := 0;
begin
  update public.money_reforms set status = 'pending', submitted_at = now(), reviewed_by = null, reviewed_at = null, review_note = null
  where id = p_id and created_by = v_uid and status in ('draft', 'rejected')
  returning * into r;
  if r.id is null then raise exception 'Réforme introuvable, déjà envoyée ou d''un autre admin.'; end if;
  select nickname into v_nick from public.profiles where id = v_uid;
  for v_admin in select * from public._reform_other_admins(v_uid) loop
    insert into public.notifications (user_id, type, title, body, link)
    values (v_admin, 'admin_alert', 'Réforme monétaire à vérifier',
            coalesce(v_nick, 'Un admin') || ' propose ' || public._reform_pct(r.factor) || ' (×' || public._reform_fx(r.factor) || ') : « ' || left(r.motive, 140) || ' ». Elle ne s''applique qu''après ta vérification.',
            '/dashboard/admin/reforme?reforme=' || r.id);
    v_n := v_n + 1;
  end loop;
end;
$$;

create or replace function public.reform_cancel(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._reform_admin();
  r public.money_reforms;
begin
  update public.money_reforms set status = 'cancelled', updated_at = clock_timestamp()
  where id = p_id and created_by = v_uid and status in ('draft', 'pending', 'rejected')
  returning * into r;
  if r.id is null then raise exception 'Réforme introuvable ou déjà traitée.'; end if;
end;
$$;

-- Vérification obligatoire. p_version : la date de modification vue par le
-- vérificateur ; si la réforme a changé depuis, il doit la relire.
create or replace function public.reform_review(p_id uuid, p_approve boolean, p_note text default null, p_version timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._reform_admin();
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  r public.money_reforms;
begin
  select * into r from public.money_reforms where id = p_id for update;
  if r.id is null then raise exception 'Réforme introuvable.'; end if;
  if r.status <> 'pending' then raise exception 'Cette réforme n''attend pas de vérification.'; end if;
  if p_version is null or date_trunc('milliseconds', p_version) <> date_trunc('milliseconds', r.updated_at) then
    raise exception 'La réforme a été modifiée depuis ton ouverture : relis-la avant de décider.';
  end if;
  if r.created_by = v_uid and exists (select 1 from public._reform_other_admins(v_uid)) then
    raise exception 'Un autre admin « Économie » doit vérifier ta réforme.';
  end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'La note est limitée à 500 caractères.'; end if;

  if not coalesce(p_approve, false) then
    if v_note is null then raise exception 'Explique ce qui doit changer.'; end if;
    update public.money_reforms set status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), review_note = v_note where id = r.id;
    if r.created_by is not null and r.created_by <> v_uid then
      insert into public.notifications (user_id, type, title, body, link)
      values (r.created_by, 'admin_alert', 'Réforme monétaire refusée', v_note, '/dashboard/admin/reforme?reforme=' || r.id);
    end if;
    return (select to_jsonb(x) from public.money_reforms x where id = r.id);
  end if;

  update public.money_reforms set reviewed_by = v_uid, reviewed_at = now(), review_note = v_note where id = r.id;
  return public._reform_apply(r.id);
end;
$$;

-- Prépare la réforme inverse d'une réforme appliquée (même périmètre).
create or replace function public.reform_inverse(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._reform_admin();
  r public.money_reforms;
  v_id uuid;
begin
  select * into r from public.money_reforms where id = p_id and status = 'applied';
  if r.id is null then raise exception 'Réforme appliquée introuvable.'; end if;
  insert into public.money_reforms (factor, motive, round_prices, scopes, exceptions, created_by)
  values (round(1 / r.factor, 6), 'Retour sur la réforme n° ' || r.number, r.round_prices, r.scopes, r.exceptions, v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.reforms_list()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := public._reform_admin();
  v_alone boolean := not exists (select 1 from public._reform_other_admins(auth.uid()));
begin
  return coalesce((
    select jsonb_agg(to_jsonb(x) || jsonb_build_object(
             'author', (select nickname from public.profiles where id = x.created_by),
             'reviewer', (select nickname from public.profiles where id = x.reviewed_by),
             'mine', x.created_by = v_uid,
             'can_edit', x.created_by = v_uid and x.status in ('draft', 'pending', 'rejected'),
             'can_review', x.status = 'pending' and (x.created_by is distinct from v_uid or v_alone))
           order by case x.status when 'pending' then 0 when 'draft' then 1 when 'rejected' then 2 else 3 end, x.created_at desc)
    from (select * from public.money_reforms order by created_at desc limit 50) x
  ), '[]'::jsonb);
end;
$$;

-- Recherche d'exceptions (quête, objet, membre, entreprise).
create or replace function public.reform_search(p_kind text, p_query text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_q text := '%' || replace(replace(coalesce(trim(p_query), ''), '%', ''), '_', '') || '%';
begin
  perform public._reform_admin();
  return coalesce(case p_kind
    when 'quete' then (select jsonb_agg(jsonb_build_object('id', id, 'label', title, 'sub', public._fmt_z(reward) || ' z · ' ||
                        case status when 'open' then 'ouverte' when 'in_progress' then 'en cours' else status end) order by created_at desc)
                       from (select * from public.quests where title ilike v_q and status in ('open', 'in_progress') order by created_at desc limit 12) x)
    when 'objet' then (select jsonb_agg(jsonb_build_object('id', id, 'label', name, 'sub', public._fmt_z(price) || ' z') order by name)
                       from (select * from public.shop_items where name ilike v_q and hidden_at is null order by name limit 12) x)
    when 'membre' then (select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.nickname,
                         'sub', public._fmt_z(coalesce(w.balance, 0)) || ' z') order by x.nickname)
                        from (select * from public.profiles where nickname ilike v_q and status = 'active' order by nickname limit 12) x
                        left join public.wallets w on w.user_id = x.id)
    when 'entreprise' then (select jsonb_agg(jsonb_build_object('id', id, 'label', name, 'sub', public._fmt_z(treasury_balance) || ' z en trésorerie') order by name)
                            from (select * from public.businesses where name ilike v_q and not is_closed order by name limit 12) x)
  end, '[]'::jsonb);
end;
$$;

-- Réformes appliquées, pour la page publique de la banque centrale.
create or replace function public.money_reforms_public()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('number', number, 'factor', factor, 'motive', motive, 'applied_at', applied_at,
           'index_before', index_before, 'index_after', index_after) order by applied_at desc), '[]'::jsonb)
  from public.money_reforms where status = 'applied';
$$;

-- ---------------------------------------------------------------------
-- 6. Effets de bord : pas d'« Argent reçu » ni d'alerte pour une réforme
-- ---------------------------------------------------------------------
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

-- Alertes (0081) : une réforme n'est ni un gros mouvement ni un enrichissement.
create or replace function public.scan_activity_alerts()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  s jsonb := public.get_alert_settings();
  v_big numeric := (s->>'alert_big_tx')::numeric;
  v_gain numeric := (s->>'alert_daily_gain')::numeric;
  v_msgs numeric := (s->>'alert_msgs_hour')::numeric;
  v_sim numeric := (s->>'alert_sim_hour')::numeric;
  v_sim_s numeric := (s->>'alert_sim_min_s')::numeric;
  v_burst numeric := (s->>'alert_admin_burst')::numeric;
  v_purch numeric := (s->>'alert_purchases_hour')::numeric;
  v_dormant numeric := (s->>'alert_dormant_days')::numeric;
  v_hour text := to_char(now(), 'YYYYMMDDHH24');
  v_bucket text := to_char(now(), 'YYYYMMDDHH24') || (extract(minute from now())::int / 10)::text;
  v_new int := 0;
  v_max_id bigint := coalesce((select max(id) from public.activity_alerts), 0);
  v_crit int;
  v_warn int;
  r record;
begin
  -- Gros mouvement d'argent
  if v_big > 0 then
    for r in
      select t.id, t.user_id, t.amount, t.reason from public.transactions t
      where t.created_at > now() - interval '24 hours' and abs(t.amount) >= v_big
        and t.reason not like 'Réforme monétaire%'
        and not public.is_sandbox_account(t.user_id)
    loop
      if public._raise_alert(r.user_id, 'gros_montant', case when abs(r.amount) >= v_big * 5 then 'critical' else 'warning' end,
           format('Mouvement de %s z', public._fmt_z(r.amount, true)),
           jsonb_build_object('montant', r.amount, 'motif', r.reason), 'tx:' || r.id, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Enrichissement rapide sur 24 h
  if v_gain > 0 then
    for r in
      select t.user_id, sum(t.amount) as total, count(*) as n from public.transactions t
      where t.created_at > now() - interval '24 hours' and t.amount > 0 and not public.is_sandbox_account(t.user_id)
        and t.reason not like 'Réforme monétaire%'
      group by t.user_id having sum(t.amount) >= v_gain
    loop
      if public._raise_alert(r.user_id, 'enrichissement', 'warning',
           format('A gagné %s z en 24 h', public._fmt_z(r.total)),
           jsonb_build_object('total', r.total, 'mouvements', r.n), 'gain:' || r.user_id || ':' || current_date, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Rafale de messages
  if v_msgs > 0 then
    for r in
      select m.sender_id as user_id, count(*) as n, count(distinct m.channel_id) as salons from public.chat_messages m
      where m.created_at > now() - interval '1 hour' and not public.is_sandbox_account(m.sender_id)
      group by m.sender_id having count(*) >= v_msgs
    loop
      if public._raise_alert(r.user_id, 'spam', case when r.n >= v_msgs * 3 then 'critical' else 'warning' end,
           format('%s messages en une heure', r.n),
           jsonb_build_object('messages', r.n, 'salons', r.salons), 'spam:' || r.user_id || ':' || v_hour, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Simulations : trop de victoires en une heure, ou victoires trop rapides
  if v_sim > 0 then
    for r in
      select sr.user_id, count(*) as n from public.simulation_runs sr
      where sr.status = 'success' and sr.finished_at > now() - interval '1 hour' and not public.is_sandbox_account(sr.user_id)
      group by sr.user_id having count(*) >= v_sim
    loop
      if public._raise_alert(r.user_id, 'simulations', 'warning', format('%s simulations réussies en une heure', r.n),
           jsonb_build_object('reussites', r.n), 'sim:' || r.user_id || ':' || v_hour, false) then v_new := v_new + 1; end if;
    end loop;
  end if;
  if v_sim_s > 0 then
    for r in
      select sr.user_id, count(*) as n, min(extract(epoch from sr.finished_at - sr.started_at))::int as plus_rapide
      from public.simulation_runs sr
      where sr.status = 'success' and sr.finished_at > now() - interval '24 hours'
        and sr.finished_at - sr.started_at < make_interval(secs => v_sim_s)
        and not public.is_sandbox_account(sr.user_id)
      group by sr.user_id having count(*) >= 3
    loop
      if public._raise_alert(r.user_id, 'simulations_rapides', 'warning',
           format('%s simulations gagnées en moins de %s s', r.n, v_sim_s),
           jsonb_build_object('parties', r.n, 'plus_rapide_s', r.plus_rapide), 'simrapide:' || r.user_id || ':' || current_date, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Achats en rafale
  if v_purch > 0 then
    for r in
      select p.user_id, count(*) as n, sum(p.total_price) as total from public.purchases p
      where p.created_at > now() - interval '1 hour' and not public.is_sandbox_account(p.user_id)
      group by p.user_id having count(*) >= v_purch
    loop
      if public._raise_alert(r.user_id, 'achats', 'warning', format('%s achats en une heure', r.n),
           jsonb_build_object('achats', r.n, 'total', r.total), 'achats:' || r.user_id || ':' || v_hour, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Admin : beaucoup d'actions sensibles en 10 minutes
  if v_burst > 0 then
    for r in
      select a.actor_id as user_id, count(*) as n, array_agg(distinct a.action) as actions from public.audit_log a
      where a.created_at > now() - interval '10 minutes' and a.actor_id is not null
        and a.action not in ('account_invisible', 'account_visible', 'rank_divine', 'alert_settings_changed')
      group by a.actor_id having count(*) >= v_burst
    loop
      if public._raise_alert(r.user_id, 'admin_rafale', case when r.n >= v_burst * 3 then 'critical' else 'warning' end,
           format('%s actions d''administration en 10 minutes', r.n),
           jsonb_build_object('actions', r.n, 'types', r.actions), 'burst:' || r.user_id || ':' || v_bucket, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Admin qui s'attribue quelque chose à lui-même
  for r in
    select a.id, a.actor_id as user_id, a.action, a.details from public.audit_log a
    where a.created_at > now() - interval '24 hours' and a.actor_id is not null and a.actor_id = a.target_user_id
      and a.action in ('wallet_adjusted', 'reputation_adjusted', 'stats_changed', 'levels_changed',
                       'role_assigned', 'permission_granted', 'profile_changed')
  loop
    if public._raise_alert(r.user_id, 'auto_attribution',
         case when r.action in ('wallet_adjusted', 'role_assigned', 'permission_granted') then 'critical' else 'warning' end,
         'Action d''administration sur son propre compte',
         jsonb_build_object('action', r.action, 'details', r.details), 'self:' || r.id, false) then v_new := v_new + 1; end if;
  end loop;

  -- Sanctions répétées
  for r in
    select sa.user_id, count(*) as n from public.sanctions sa
    where sa.created_at > now() - interval '7 days'
    group by sa.user_id having count(*) >= 3
  loop
    if public._raise_alert(r.user_id, 'sanctions', 'info', format('%s sanctions en 7 jours', r.n),
         jsonb_build_object('sanctions', r.n), 'sanc:' || r.user_id || ':' || to_char(now(), 'IYYYIW'), false) then v_new := v_new + 1; end if;
  end loop;

  -- Nouveau compte très actif ou très riche
  for r in
    select p.id as user_id, coalesce(w.balance, 0) as balance,
           (select count(*) from public.chat_messages m where m.sender_id = p.id and m.created_at > now() - interval '24 hours') as msgs
    from public.profiles p
    left join public.wallets w on w.user_id = p.id
    where p.created_at > now() - interval '48 hours' and p.status = 'active' and not public.is_sandbox_account(p.id)
  loop
    if (v_big > 0 and r.balance >= v_big) or r.msgs >= 100 then
      if public._raise_alert(r.user_id, 'nouveau_compte', 'warning', 'Nouveau compte déjà très actif',
           jsonb_build_object('solde', r.balance, 'messages_24h', r.msgs), 'new:' || r.user_id, false) then v_new := v_new + 1; end if;
    end if;
  end loop;

  -- Compte endormi qui se réveille (possible reprise de compte)
  if v_dormant > 0 then
    for r in
      select a.user_id, (select max(b.day) from public.activity_log b where b.user_id = a.user_id and b.day < current_date) as previous
      from public.activity_log a
      where a.day = current_date and not public.is_sandbox_account(a.user_id)
    loop
      if r.previous is not null and r.previous < current_date - v_dormant::int then
        if public._raise_alert(r.user_id, 'compte_reveille', 'info',
             format('De retour après %s jours d''absence', current_date - r.previous),
             jsonb_build_object('derniere_visite', r.previous), 'wake:' || r.user_id || ':' || current_date, false) then v_new := v_new + 1; end if;
      end if;
    end loop;
  end if;

  -- Un seul message par admin pour toutes les nouvelles alertes de ce passage.
  if v_new > 0 then
    select count(*) filter (where severity = 'critical'), count(*) filter (where severity in ('warning', 'critical'))
      into v_crit, v_warn
    from public.activity_alerts where id > v_max_id and status = 'open';
    if v_warn > 0 then
      insert into public.notifications (user_id, type, title, body, link)
      select a, 'admin_alert',
             case when v_crit > 0 then '🚨 ' else '⚠️ ' end || v_warn || case when v_warn > 1 then ' nouvelles alertes d''activité' else ' nouvelle alerte d''activité' end,
             case when v_crit > 0 then v_crit || ' critique(s). ' else '' end || 'À vérifier dans Administration → Alertes.',
             '/dashboard/admin/alerts'
      from public._alert_recipients(null) a;
    end if;
  end if;
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Banque centrale (0084) : relevé hors effet des réformes
-- ---------------------------------------------------------------------
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
    -- Relevé refait dans la journée : seul l'écart avec le premier relevé compte.
    v_base := case when v_today_row.day is not null
                   then v_today_row.price_index * public._reform_factor_since(v_today_row.computed_at, 'prix')
                   when v_prev.day is not null then v_prev_index end;
    if v_base is not null and v_base > 0 and v_index <> v_base then
      update public.sim_agents set weekly_salary = round(weekly_salary * (v_index / v_base), 2);
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
-- 8. Droits d'exécution
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._reform_factor_since(timestamptz, text)', 'public._reform_ids(jsonb, text)', 'public._reform_on(jsonb, text)',
    'public._reform_price(numeric, numeric, boolean)', 'public._reform_pct(numeric)', 'public._reform_fx(numeric)',
    'public._econ_raw_index()', 'public._econ_money_supply()', 'public._reform_settings()', 'public._reform_check_scopes(jsonb)',
    'public._reform_check_exceptions(jsonb)', 'public._reform_preview(numeric, jsonb, jsonb, boolean)', 'public._reform_apply(uuid)',
    'public._reform_admin()', 'public._reform_other_admins(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.reform_preview(numeric, jsonb, jsonb, boolean)', 'public.reform_save(uuid, numeric, text, boolean, jsonb, jsonb)',
    'public.reform_submit(uuid)', 'public.reform_cancel(uuid)', 'public.reform_review(uuid, boolean, text, timestamptz)',
    'public.reform_inverse(uuid)', 'public.reforms_list()', 'public.reform_search(text, text)', 'public.money_reforms_public()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
