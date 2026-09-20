-- =========================================================
-- Système "Entreprise" : nouvelle permission dédiée, fonds séparés du
-- portefeuille personnel, prêts (même mécanique que la dette personnelle),
-- et un marché d'actions simplifié (chaque achat/vente se fait
-- directement contre la trésorerie de l'entreprise, avec un impact sur le
-- prix — pas de carnet d'ordres entre membres, voir les choix par défaut
-- documentés dans la réponse qui accompagne cette migration).
-- =========================================================

-- ---------------------------------------------------------
-- Nouvelle permission "entreprise"
-- ---------------------------------------------------------
alter table public.role_permissions drop constraint if exists role_permissions_permission_check;
alter table public.role_permissions add constraint role_permissions_permission_check check (permission in (
  'manage_roles', 'manage_org_chart', 'manage_quests', 'manage_shop',
  'manage_teams', 'manage_economy', 'recruit', 'manage_users', 'entreprise'
));

insert into public.app_config (key, value) values
  ('max_business_debt_principal', '200000'),
  ('business_share_price_impact', '0.01')  -- 1% de variation de prix par action échangée
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- Tables
-- ---------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  founder_id uuid not null references public.profiles(id),
  treasury_balance numeric(18,2) not null default 0,
  debt_principal numeric(18,2) not null default 0,
  last_debt_interest_at timestamptz,
  share_count int not null check (share_count > 0),
  shares_in_treasury int not null,
  share_price numeric(15,4) not null check (share_price > 0),
  created_at timestamptz not null default now()
);

create table public.business_shareholders (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  primary key (business_id, user_id)
);

create table public.business_share_price_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  price numeric(15,4) not null,
  recorded_at timestamptz not null default now()
);

create table public.business_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount numeric(18,2) not null,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.businesses enable row level security;
alter table public.business_shareholders enable row level security;
alter table public.business_share_price_history enable row level security;
alter table public.business_transactions enable row level security;

-- Marché public : tout le monde voit les entreprises, leur cours et
-- l'historique (comme un vrai marché boursier). Les mouvements de
-- trésorerie détaillés restent réservés au fondateur / manage_economy.
create policy "businesses_select_all" on public.businesses for select using (true);
create policy "business_shareholders_select_all" on public.business_shareholders for select using (true);
create policy "business_share_price_history_select_all" on public.business_share_price_history for select using (true);

create policy "business_transactions_select" on public.business_transactions for select
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.founder_id = auth.uid())
    or public.has_permission(auth.uid(), 'manage_economy')
  );

-- Aucune policy insert/update/delete : tout passe par les fonctions ci-dessous.

-- ---------------------------------------------------------
-- Création d'une entreprise
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

  insert into public.businesses (name, description, founder_id, share_count, shares_in_treasury, share_price)
  values (p_name, p_description, auth.uid(), p_share_count, p_share_count, p_initial_price)
  returning * into v_business;

  insert into public.business_share_price_history (business_id, price)
  values (v_business.id, p_initial_price);

  return v_business;
end;
$$;

-- ---------------------------------------------------------
-- Marché des actions : achat/vente directement contre la trésorerie de
-- l'entreprise (pas de mise en relation acheteur/vendeur). Chaque action
-- échangée fait bouger le prix de ~1% (réglable via app_config).
-- ---------------------------------------------------------

create or replace function public.buy_business_shares(p_business_id uuid, p_quantity int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_balance numeric(18,2);
  v_total numeric(18,2);
  v_impact numeric;
begin
  if p_quantity < 1 then
    raise exception 'Quantité invalide';
  end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if v_business.shares_in_treasury < p_quantity then
    raise exception 'Il ne reste que % action(s) disponible(s).', v_business.shares_in_treasury;
  end if;

  select balance into v_balance from public.wallets where user_id = auth.uid() for update;
  if v_balance is not null and v_balance < 0 then
    raise exception 'Ton solde est négatif : règle-le avant d''investir.';
  end if;

  v_total := v_business.share_price * p_quantity;
  if v_balance is null or v_balance < v_total then
    raise exception 'Solde insuffisant';
  end if;

  v_impact := public.get_config_numeric('business_share_price_impact', 0.01);

  update public.wallets set balance = balance - v_total where user_id = auth.uid();

  update public.businesses
    set treasury_balance = treasury_balance + v_total,
        shares_in_treasury = shares_in_treasury - p_quantity,
        share_price = share_price * (1 + v_impact * p_quantity)
    where id = p_business_id;

  insert into public.business_shareholders (business_id, user_id, quantity)
  values (p_business_id, auth.uid(), p_quantity)
  on conflict (business_id, user_id) do update set quantity = public.business_shareholders.quantity + p_quantity;

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, v_total, 'Achat de ' || p_quantity || ' action(s) par un investisseur', auth.uid());

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), -v_total, 'Achat d''actions : ' || v_business.name, auth.uid());

  insert into public.business_share_price_history (business_id, price)
  select id, share_price from public.businesses where id = p_business_id;
end;
$$;

create or replace function public.sell_business_shares(p_business_id uuid, p_quantity int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_holding int;
  v_total numeric(18,2);
  v_impact numeric;
begin
  if p_quantity < 1 then
    raise exception 'Quantité invalide';
  end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;

  select quantity into v_holding from public.business_shareholders where business_id = p_business_id and user_id = auth.uid();
  if v_holding is null or v_holding < p_quantity then
    raise exception 'Tu ne possèdes pas assez d''actions.';
  end if;

  v_total := v_business.share_price * p_quantity;
  if v_business.treasury_balance < v_total then
    raise exception 'L''entreprise n''a pas assez de trésorerie pour racheter ces actions maintenant.';
  end if;

  v_impact := public.get_config_numeric('business_share_price_impact', 0.01);

  update public.business_shareholders set quantity = quantity - p_quantity
    where business_id = p_business_id and user_id = auth.uid();

  update public.businesses
    set treasury_balance = treasury_balance - v_total,
        shares_in_treasury = shares_in_treasury + p_quantity,
        share_price = greatest(0.01, share_price * (1 - v_impact * p_quantity))
    where id = p_business_id;

  update public.wallets set balance = balance + v_total where user_id = auth.uid();

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, -v_total, 'Rachat de ' || p_quantity || ' action(s) à un actionnaire', auth.uid());

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), v_total, 'Vente d''actions : ' || v_business.name, auth.uid());

  insert into public.business_share_price_history (business_id, price)
  select id, share_price from public.businesses where id = p_business_id;
end;
$$;

-- ---------------------------------------------------------
-- Fonds propres du fondateur (apport / retrait de trésorerie), et prêt
-- d'entreprise (même mécanique que la dette personnelle, voir 0033).
-- ---------------------------------------------------------

create or replace function public.deposit_business_funds(p_business_id uuid, p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_balance numeric(18,2);
begin
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if not (v_business.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;

  select balance into v_balance from public.wallets where user_id = auth.uid() for update;
  if v_balance is null or v_balance < p_amount then
    raise exception 'Solde insuffisant';
  end if;

  update public.wallets set balance = balance - p_amount where user_id = auth.uid();
  update public.businesses set treasury_balance = treasury_balance + p_amount where id = p_business_id;

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, p_amount, 'Apport du fondateur', auth.uid());

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), -p_amount, 'Apport entreprise : ' || v_business.name, auth.uid());
end;
$$;

create or replace function public.withdraw_business_funds(p_business_id uuid, p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
begin
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if not (v_business.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if v_business.treasury_balance < p_amount then
    raise exception 'Trésorerie insuffisante.';
  end if;

  update public.businesses set treasury_balance = treasury_balance - p_amount where id = p_business_id;
  update public.wallets set balance = balance + p_amount where user_id = auth.uid();

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, -p_amount, 'Retrait du fondateur', auth.uid());

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), p_amount, 'Retrait entreprise : ' || v_business.name, auth.uid());
end;
$$;

create or replace function public.business_borrow(p_business_id uuid, p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_max_debt numeric;
begin
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if not (v_business.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;

  v_max_debt := public.get_config_numeric('max_business_debt_principal', 200000);
  if v_business.debt_principal + p_amount > v_max_debt then
    raise exception 'Plafond d''emprunt d''entreprise atteint (maximum % Cr.).', v_max_debt;
  end if;

  update public.businesses
    set treasury_balance = treasury_balance + p_amount,
        debt_principal = debt_principal + p_amount,
        last_debt_interest_at = coalesce(last_debt_interest_at, now())
    where id = p_business_id;

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, p_amount, 'Emprunt bancaire (entreprise)', auth.uid());
end;
$$;

create or replace function public.business_repay(p_business_id uuid, p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
begin
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if not (v_business.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if v_business.debt_principal <= 0 then
    raise exception 'Aucune dette à rembourser.';
  end if;

  if p_amount > v_business.debt_principal then
    p_amount := v_business.debt_principal;
  end if;
  if v_business.treasury_balance < p_amount then
    raise exception 'Trésorerie insuffisante.';
  end if;

  update public.businesses
    set treasury_balance = treasury_balance - p_amount,
        debt_principal = debt_principal - p_amount
    where id = p_business_id;

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, -p_amount, 'Remboursement d''emprunt (entreprise)', auth.uid());
end;
$$;

-- ---------------------------------------------------------
-- Lecture pratique côté frontend
-- ---------------------------------------------------------

create or replace function public.list_businesses()
returns setof public.businesses
language sql
stable
security definer set search_path = public
as $$
  select * from public.businesses order by (share_price * share_count) desc;
$$;

create or replace function public.get_business_price_history(p_business_id uuid)
returns setof public.business_share_price_history
language sql
stable
security definer set search_path = public
as $$
  select * from public.business_share_price_history
  where business_id = p_business_id
  order by recorded_at asc
  limit 200;
$$;

create or replace function public.get_my_shareholdings()
returns table(business_id uuid, business_name text, quantity int, share_price numeric)
language sql
stable
security definer set search_path = public
as $$
  select b.id, b.name, bs.quantity, b.share_price
  from public.business_shareholders bs
  join public.businesses b on b.id = bs.business_id
  where bs.user_id = auth.uid() and bs.quantity > 0;
$$;

-- ---------------------------------------------------------
-- Intérêts de dette d'entreprise : intégrés au traitement quotidien
-- unifié (voir 0033) — même fonction, on la recrée pour ajouter ce
-- troisième volet aux salaires + intérêts bancaires + intérêts de dette
-- personnelle déjà traités.
-- ---------------------------------------------------------

create or replace function public.process_daily_economy()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_bank_rate numeric;
  v_debt_rate numeric;
  r record;
  v_days int;
  v_interest numeric(18,2);
begin
  perform public.process_due_salaries();

  v_bank_rate := public.get_config_numeric('bank_daily_interest_rate', 0.01);
  v_debt_rate := public.get_config_numeric('debt_daily_interest_rate', 0.02);

  for r in select * from public.bank_accounts where balance > 0 loop
    v_days := floor(extract(epoch from (now() - r.last_interest_at)) / 86400)::int;
    if v_days > 0 then
      v_interest := r.balance * (power(1 + v_bank_rate, v_days) - 1);
      update public.bank_accounts
        set balance = balance + v_interest,
            last_interest_at = last_interest_at + (v_days || ' days')::interval
        where user_id = r.user_id;

      insert into public.transactions (user_id, amount, reason, created_by)
      values (r.user_id, v_interest, 'Intérêts bancaires', r.user_id);
    end if;
  end loop;

  for r in select * from public.wallets where debt_principal > 0 loop
    v_days := floor(extract(epoch from (now() - coalesce(r.last_debt_interest_at, now()))) / 86400)::int;
    if v_days > 0 then
      v_interest := r.debt_principal * v_debt_rate * v_days;
      update public.wallets
        set balance = balance - v_interest,
            last_debt_interest_at = coalesce(last_debt_interest_at, now()) + (v_days || ' days')::interval
        where user_id = r.user_id;

      insert into public.transactions (user_id, amount, reason, created_by)
      values (r.user_id, -v_interest, 'Intérêts d''emprunt', r.user_id);
    end if;
  end loop;

  -- Volet entreprise : intérêts sur les prêts d'entreprise, prélevés sur
  -- la trésorerie (pas sur le portefeuille personnel du fondateur).
  for r in select * from public.businesses where debt_principal > 0 loop
    v_days := floor(extract(epoch from (now() - coalesce(r.last_debt_interest_at, now()))) / 86400)::int;
    if v_days > 0 then
      v_interest := r.debt_principal * v_debt_rate * v_days;
      update public.businesses
        set treasury_balance = treasury_balance - v_interest,
            last_debt_interest_at = coalesce(last_debt_interest_at, now()) + (v_days || ' days')::interval
        where id = r.id;

      insert into public.business_transactions (business_id, amount, reason, created_by)
      values (r.id, -v_interest, 'Intérêts d''emprunt (entreprise)', r.founder_id);
    end if;
  end loop;
end;
$$;
