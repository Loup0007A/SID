-- =========================================================
-- Gestion complète d'entreprise ("de A à Z") : modifier ses infos,
-- employer des membres (salaire versé automatiquement par l'entreprise),
-- rattacher des objets de boutique à l'entreprise (les ventes alimentent
-- sa trésorerie plutôt qu'un portefeuille personnel), verser des
-- dividendes aux actionnaires, et dissoudre/liquider l'entreprise.
-- =========================================================

alter table public.businesses add column is_closed boolean not null default false;
alter table public.shop_items add column business_id uuid references public.businesses(id);

-- ---------------------------------------------------------
-- Employés
-- ---------------------------------------------------------

create table public.business_employees (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  salary numeric(18,2) not null default 0 check (salary >= 0),
  frequency text not null default 'weekly' check (frequency in ('daily', 'weekly', 'biweekly', 'monthly')),
  next_payment_at timestamptz not null default now(),
  hired_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

alter table public.business_employees enable row level security;

create policy "business_employees_select" on public.business_employees for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.founder_id = auth.uid())
    or public.has_permission(auth.uid(), 'manage_economy')
  );

create or replace function public.hire_employee(p_business_id uuid, p_user_id uuid, p_title text, p_salary numeric, p_frequency text default 'weekly')
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
begin
  select * into v_business from public.businesses where id = p_business_id;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if not (v_business.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if v_business.is_closed then
    raise exception 'Cette entreprise est fermée.';
  end if;

  insert into public.business_employees (business_id, user_id, title, salary, frequency, next_payment_at)
  values (p_business_id, p_user_id, p_title, p_salary, p_frequency, now() + public.interval_for_frequency(p_frequency))
  on conflict (business_id, user_id) do update
    set title = excluded.title, salary = excluded.salary, frequency = excluded.frequency;
end;
$$;

create or replace function public.fire_employee(p_business_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
begin
  select * into v_business from public.businesses where id = p_business_id;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if not (v_business.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  delete from public.business_employees where business_id = p_business_id and user_id = p_user_id;
end;
$$;

create or replace function public.list_business_employees(p_business_id uuid)
returns table(user_id uuid, nickname text, title text, salary numeric, frequency text, next_payment_at timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select be.user_id, p.nickname, be.title, be.salary, be.frequency, be.next_payment_at
  from public.business_employees be
  join public.profiles p on p.id = be.user_id
  where be.business_id = p_business_id
    and exists (
      select 1 from public.businesses b where b.id = p_business_id
        and (b.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'))
    );
$$;

create or replace function public.get_my_employments()
returns table(business_id uuid, business_name text, title text, salary numeric, frequency text)
language sql
stable
security definer set search_path = public
as $$
  select b.id, b.name, be.title, be.salary, be.frequency
  from public.business_employees be
  join public.businesses b on b.id = be.business_id
  where be.user_id = auth.uid();
$$;

-- ---------------------------------------------------------
-- Modifier les infos de l'entreprise
-- ---------------------------------------------------------

create or replace function public.update_business(p_business_id uuid, p_name text, p_description text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
begin
  select * into v_business from public.businesses where id = p_business_id;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if not (v_business.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Le nom ne peut pas être vide';
  end if;

  update public.businesses set name = p_name, description = p_description where id = p_business_id;
end;
$$;

-- ---------------------------------------------------------
-- Dividendes : versés à tous les actionnaires au prorata de leurs actions.
-- ---------------------------------------------------------

create or replace function public.pay_dividends(p_business_id uuid, p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_public_shares int;
  v_per_share numeric(18,6);
  r record;
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

  v_public_shares := v_business.share_count - v_business.shares_in_treasury;
  if v_public_shares <= 0 then
    raise exception 'Aucun actionnaire à qui verser un dividende.';
  end if;

  v_per_share := p_amount / v_public_shares;

  update public.businesses set treasury_balance = treasury_balance - p_amount where id = p_business_id;

  for r in select * from public.business_shareholders where business_id = p_business_id and quantity > 0 loop
    update public.wallets set balance = balance + round(v_per_share * r.quantity, 2) where user_id = r.user_id;
    insert into public.transactions (user_id, amount, reason, created_by)
    values (r.user_id, round(v_per_share * r.quantity, 2), 'Dividende : ' || v_business.name, auth.uid());
  end loop;

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, -p_amount, 'Dividende versé aux actionnaires', auth.uid());
end;
$$;

-- ---------------------------------------------------------
-- Fermeture / liquidation : la trésorerie restante est répartie entre les
-- actionnaires au prorata de leurs actions (comme une vraie liquidation),
-- puis l'entreprise est marquée fermée (retirée du marché, employés
-- licenciés, actionnariat remis à zéro). Impossible tant qu'il reste une
-- dette en cours (à rembourser d'abord).
-- ---------------------------------------------------------

create or replace function public.close_business(p_business_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_public_shares int;
  v_per_share numeric(18,6);
  r record;
begin
  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if not (v_business.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if v_business.is_closed then
    raise exception 'Cette entreprise est déjà fermée.';
  end if;
  if v_business.debt_principal > 0 then
    raise exception 'Rembourse d''abord les emprunts de l''entreprise avant de la fermer.';
  end if;

  v_public_shares := v_business.share_count - v_business.shares_in_treasury;

  if v_public_shares > 0 and v_business.treasury_balance > 0 then
    v_per_share := v_business.treasury_balance / v_public_shares;
    for r in select * from public.business_shareholders where business_id = p_business_id and quantity > 0 loop
      update public.wallets set balance = balance + round(v_per_share * r.quantity, 2) where user_id = r.user_id;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (r.user_id, round(v_per_share * r.quantity, 2), 'Liquidation : ' || v_business.name, auth.uid());
    end loop;
  end if;

  update public.businesses
    set is_closed = true, treasury_balance = 0, shares_in_treasury = share_count
    where id = p_business_id;

  delete from public.business_shareholders where business_id = p_business_id;
  delete from public.business_employees where business_id = p_business_id;

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, 0, 'Entreprise fermée / liquidée', auth.uid());
end;
$$;

-- list_businesses ne montre plus les entreprises fermées (marché).
create or replace function public.list_businesses()
returns setof public.businesses
language sql
stable
security definer set search_path = public
as $$
  select * from public.businesses where not is_closed order by (share_price * share_count) desc;
$$;

-- Registre des mouvements de trésorerie, pour l'écran de gestion.
create or replace function public.list_business_transactions(p_business_id uuid)
returns setof public.business_transactions
language sql
stable
security definer set search_path = public
as $$
  select * from public.business_transactions
  where business_id = p_business_id
    and exists (
      select 1 from public.businesses b where b.id = p_business_id
        and (b.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'))
    )
  order by created_at desc
  limit 100;
$$;

-- buy/sell : bloqués si l'entreprise est fermée.
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
-- purchase_item : route désormais le produit d'une vente vers la
-- trésorerie de l'entreprise si l'objet lui est rattaché (business_id),
-- sinon vers le portefeuille personnel du créateur comme avant.
-- ---------------------------------------------------------

create or replace function public.purchase_item(p_item_id uuid, p_quantity int default 1)
returns public.purchases
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.shop_items;
  v_balance numeric(18,2);
  v_unit_price numeric(15,2);
  v_total numeric(15,2);
  v_vat_rate numeric;
  v_vat numeric(18,2);
  v_seller_amount numeric(18,2);
  v_purchase public.purchases;
begin
  if p_quantity < 1 then
    raise exception 'La quantité doit être au moins 1';
  end if;

  select balance into v_balance from public.wallets where user_id = auth.uid() for update;
  if v_balance is not null and v_balance < 0 then
    raise exception 'Ton solde est négatif (dette avec intérêts impayés) : règle-le avant de pouvoir acheter quoi que ce soit.';
  end if;

  select * into v_item from public.shop_items where id = p_item_id and is_active for update;
  if v_item.id is null then
    raise exception 'Objet introuvable ou indisponible';
  end if;

  if v_item.stock is not null and v_item.stock < p_quantity then
    raise exception 'Stock insuffisant';
  end if;

  v_unit_price := case
    when v_item.sale_price is not null and (v_item.sale_ends_at is null or v_item.sale_ends_at > now())
      then v_item.sale_price
    else v_item.price
  end;
  v_total := v_unit_price * p_quantity;

  if v_balance is null or v_balance < v_total then
    raise exception 'Solde insuffisant';
  end if;

  v_vat_rate := public.get_config_numeric('vat_rate', 0.05);
  v_vat := round(v_total * v_vat_rate, 2);
  v_seller_amount := v_total - v_vat;

  update public.wallets set balance = balance - v_total where user_id = auth.uid();

  insert into public.purchases (item_id, user_id, quantity, total_price, status)
  values (p_item_id, auth.uid(), p_quantity, v_total, 'pending')
  returning * into v_purchase;

  insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
  values (auth.uid(), -v_total, 'Achat : ' || v_item.name, v_purchase.id, auth.uid());

  if v_item.business_id is not null then
    update public.businesses set treasury_balance = treasury_balance + v_seller_amount where id = v_item.business_id;
    insert into public.business_transactions (business_id, amount, reason, created_by)
    values (v_item.business_id, v_seller_amount, 'Vente : ' || v_item.name || ' (TVA déduite)', auth.uid());
  elsif v_item.created_by is not null and v_item.created_by <> auth.uid() then
    update public.wallets set balance = balance + v_seller_amount where user_id = v_item.created_by;
    insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
    values (v_item.created_by, v_seller_amount, 'Vente : ' || v_item.name || ' (TVA ' || (v_vat_rate * 100)::text || '% déduite)', v_purchase.id, auth.uid());
  end if;

  update public.tax_pool set balance = balance + v_vat where id = true;

  if v_item.stock is not null then
    update public.shop_items set stock = stock - p_quantity where id = p_item_id;
  end if;

  return v_purchase;
end;
$$;

-- Liste les entreprises (actives) du membre connecté, pour le sélecteur
-- "rattacher à mon entreprise" dans la boutique.
create or replace function public.list_my_businesses()
returns setof public.businesses
language sql
stable
security definer set search_path = public
as $$
  select * from public.businesses where founder_id = auth.uid() and not is_closed order by created_at desc;
$$;

-- ---------------------------------------------------------
-- Salaires d'entreprise : intégrés au traitement quotidien unifié.
-- Rattrape les échéances manquées, mais s'arrête (sans mettre la
-- trésorerie en négatif) si l'entreprise n'a plus les moyens de payer.
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
  v_next timestamptz;
  v_biz_balance numeric(18,2);
  v_iter int;
  v_safety_cap constant int := 500;
begin
  perform public.process_due_salaries();
  perform public.process_weekly_taxes();

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

  -- Salaires versés par les entreprises à leurs employés.
  for r in select * from public.business_employees loop
    v_next := r.next_payment_at;
    v_iter := 0;
    while v_next <= now() and v_iter < v_safety_cap loop
      select treasury_balance into v_biz_balance from public.businesses where id = r.business_id for update;
      exit when v_biz_balance is null or v_biz_balance < r.salary;

      update public.businesses set treasury_balance = treasury_balance - r.salary where id = r.business_id;
      update public.wallets set balance = balance + r.salary where user_id = r.user_id;

      insert into public.transactions (user_id, amount, reason, created_by)
      values (r.user_id, r.salary, 'Salaire d''entreprise', r.user_id);
      insert into public.business_transactions (business_id, amount, reason, created_by)
      values (r.business_id, -r.salary, 'Salaire versé à un employé', r.user_id);

      v_next := v_next + public.interval_for_frequency(r.frequency);
      v_iter := v_iter + 1;
    end loop;

    if v_next <> r.next_payment_at then
      update public.business_employees set next_payment_at = v_next where business_id = r.business_id and user_id = r.user_id;
    end if;
  end loop;
end;
$$;
