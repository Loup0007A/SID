-- =========================================================
-- Impôts + TVA. Deux sources alimentent une caisse commune ("tax_pool") :
-- - TVA : un pourcentage de chaque achat en boutique (5% par défaut),
--   prélevé sur ce que le vendeur aurait touché.
-- - Impôt hebdomadaire : un pourcentage du solde positif de chaque membre
--   (2%/semaine par défaut), prélevé une fois par semaine.
--
-- Chaque semaine (rattrapage si personne ne s'est connecté depuis
-- plusieurs semaines, même logique que les salaires/intérêts), la caisse
-- est intégralement redistribuée : 80% aux admins (fondateur ou
-- manage_users), répartis à parts égales ; 20% aux entreprises, réparties
-- à parts égales entre elles.
-- =========================================================

insert into public.app_config (key, value) values
  ('vat_rate', '0.05'),                 -- 5% de TVA sur les achats en boutique
  ('weekly_wealth_tax_rate', '0.02'),   -- 2%/semaine sur le solde positif
  ('tax_admin_share', '0.8'),           -- 80% de la caisse aux admins
  ('tax_business_share', '0.2')         -- 20% de la caisse aux entreprises
on conflict (key) do nothing;

-- Table "singleton" (une seule ligne) pour la caisse commune.
create table public.tax_pool (
  id boolean primary key default true check (id),
  balance numeric(18,2) not null default 0,
  last_distributed_at timestamptz not null default now()
);

insert into public.tax_pool (id, balance, last_distributed_at)
values (true, 0, now())
on conflict (id) do nothing;

alter table public.tax_pool enable row level security;

create policy "tax_pool_select" on public.tax_pool for select
  using (public.has_permission(auth.uid(), 'manage_economy') or public.has_permission(auth.uid(), 'manage_users'));

-- ---------------------------------------------------------
-- purchase_item : ajoute la TVA (prélevée sur la part du vendeur, jamais
-- en plus de ce que paie l'acheteur — le prix affiché reste le prix payé).
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

  if v_item.created_by is not null and v_item.created_by <> auth.uid() then
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

-- ---------------------------------------------------------
-- Traitement hebdomadaire : impôt sur la richesse + redistribution.
-- ---------------------------------------------------------

create or replace function public.process_weekly_taxes()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_pool public.tax_pool;
  v_weeks int;
  v_wealth_tax_rate numeric;
  v_admin_share numeric;
  v_business_share numeric;
  v_admin_count int;
  v_business_count int;
  v_per_admin numeric(18,2);
  v_per_business numeric(18,2);
  v_tax numeric(18,2);
  r record;
  i int;
begin
  select * into v_pool from public.tax_pool where id = true for update;
  if v_pool.id is null then
    insert into public.tax_pool (id) values (true) returning * into v_pool;
  end if;

  v_weeks := floor(extract(epoch from (now() - v_pool.last_distributed_at)) / 604800)::int;
  if v_weeks < 1 then
    return;
  end if;

  v_wealth_tax_rate := public.get_config_numeric('weekly_wealth_tax_rate', 0.02);

  -- Impôt hebdomadaire sur le solde positif — une fois par semaine
  -- écoulée (rattrapage si personne ne s'est connecté depuis longtemps).
  for i in 1..v_weeks loop
    for r in select * from public.wallets where balance > 0 loop
      v_tax := round(r.balance * v_wealth_tax_rate, 2);
      update public.wallets set balance = balance - v_tax where user_id = r.user_id;
      update public.tax_pool set balance = balance + v_tax where id = true;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (r.user_id, -v_tax, 'Impôt hebdomadaire', r.user_id);
    end loop;
  end loop;

  select balance into v_pool.balance from public.tax_pool where id = true;

  v_admin_share := public.get_config_numeric('tax_admin_share', 0.8);
  v_business_share := public.get_config_numeric('tax_business_share', 0.2);

  select count(*) into v_admin_count from public.profiles p
    where p.status = 'active' and (p.is_founder or public.has_permission(p.id, 'manage_users'));
  select count(*) into v_business_count from public.businesses;

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
    for r in select id, founder_id from public.businesses loop
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

-- Intègre le traitement hebdomadaire au traitement quotidien unifié (déjà
-- déclenché à la connexion de n'importe quel membre, voir layout.tsx).
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
end;
$$;

-- Lecture pratique côté admin (montant en caisse, prochaine échéance).
create or replace function public.get_tax_pool_status()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_pool public.tax_pool;
begin
  if not (public.has_permission(auth.uid(), 'manage_economy') or public.has_permission(auth.uid(), 'manage_users')) then
    raise exception 'Permission refusée';
  end if;

  select * into v_pool from public.tax_pool where id = true;

  return jsonb_build_object(
    'balance', v_pool.balance,
    'last_distributed_at', v_pool.last_distributed_at,
    'next_distribution_at', v_pool.last_distributed_at + interval '7 days',
    'vat_rate', public.get_config_numeric('vat_rate', 0.05),
    'weekly_wealth_tax_rate', public.get_config_numeric('weekly_wealth_tax_rate', 0.02)
  );
end;
$$;
