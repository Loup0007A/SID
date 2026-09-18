-- =========================================================
-- Économie avancée : dette (solde négatif + intérêts), banque (épargne +
-- intérêts), traitement unifié déclenché à la connexion de N'IMPORTE QUEL
-- membre (pas seulement le sien), et notifications "argent reçu".
--
-- Choix de conception (documentés ici pour que ce soit facile à ajuster) :
-- - Le solde négatif n'apparaît PAS par accident lors d'un achat ou du
--   financement d'une quête (ces actions restent bloquées si les fonds
--   sont insuffisants, comme avant). Il apparaît uniquement via un
--   EMPRUNT volontaire à la banque, qui crédite immédiatement le montant
--   emprunté, et enregistre un "principal" de dette séparé.
-- - Chaque jour, des intérêts sont calculés sur ce principal et
--   directement PRÉLEVÉS sur le solde — c'est ce prélèvement automatique
--   qui peut faire passer le solde en négatif si le membre a déjà dépensé
--   l'argent emprunté sans garder de réserve.
-- - Tant que le solde est négatif, les achats en boutique sont bloqués
--   ("régler ses intérêts" = faire remonter le solde à 0 ou plus).
-- - Rembourser réduit le principal (et donc les futurs intérêts), mais ne
--   débloque les achats que si le solde redevient positif.
-- =========================================================

alter table public.wallets add column debt_principal numeric(18,2) not null default 0;
alter table public.wallets add column last_debt_interest_at timestamptz;

comment on column public.wallets.debt_principal is
  'Montant actuellement emprunté (hors intérêts déjà prélevés). Des intérêts quotidiens sont calculés dessus et directement déduits du solde.';

-- Config ajustable sans redéploiement (table déjà créée pour le push, voir 0029).
insert into public.app_config (key, value) values
  ('debt_daily_interest_rate', '0.02'),   -- 2%/jour du principal emprunté
  ('bank_daily_interest_rate', '0.01'),   -- 1%/jour de l'épargne en banque
  ('max_debt_principal', '50000')          -- plafond d'emprunt cumulé
on conflict (key) do nothing;

create or replace function public.get_config_numeric(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select value from public.app_config where key = p_key)::numeric, p_default);
$$;

-- =========================================================
-- Banque : compte d'épargne séparé, qui rapporte des intérêts chaque jour
-- tant qu'on ne redépose pas (un dépôt relance le décompte).
-- =========================================================

create table public.bank_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(18,2) not null default 0,
  last_interest_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.bank_accounts enable row level security;

create policy "bank_accounts_select" on public.bank_accounts for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

-- Pas de policy insert/update : uniquement via les fonctions ci-dessous.

create or replace function public.deposit_to_bank(p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance numeric(18,2);
begin
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select balance into v_balance from public.wallets where user_id = auth.uid() for update;
  if v_balance is null or v_balance < p_amount then
    raise exception 'Solde insuffisant';
  end if;

  update public.wallets set balance = balance - p_amount where user_id = auth.uid();

  insert into public.bank_accounts (user_id, balance, last_interest_at)
  values (auth.uid(), p_amount, now())
  on conflict (user_id) do update
    set balance = public.bank_accounts.balance + p_amount,
        last_interest_at = now(); -- un nouveau dépôt relance le décompte des intérêts

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), -p_amount, 'Dépôt en banque', auth.uid());
end;
$$;

create or replace function public.withdraw_from_bank(p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_bank_balance numeric(18,2);
begin
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select balance into v_bank_balance from public.bank_accounts where user_id = auth.uid() for update;
  if v_bank_balance is null or v_bank_balance < p_amount then
    raise exception 'Solde bancaire insuffisant';
  end if;

  update public.bank_accounts set balance = balance - p_amount where user_id = auth.uid();
  update public.wallets set balance = balance + p_amount where user_id = auth.uid();

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), p_amount, 'Retrait bancaire', auth.uid());
end;
$$;

-- =========================================================
-- Emprunt / remboursement.
-- =========================================================

create or replace function public.borrow_money(p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current_debt numeric(18,2);
  v_max_debt numeric;
begin
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select debt_principal into v_current_debt from public.wallets where user_id = auth.uid() for update;
  v_max_debt := public.get_config_numeric('max_debt_principal', 50000);

  if coalesce(v_current_debt, 0) + p_amount > v_max_debt then
    raise exception 'Plafond d''emprunt atteint (maximum % Cr. de dette cumulée).', v_max_debt;
  end if;

  update public.wallets
    set balance = balance + p_amount,
        debt_principal = debt_principal + p_amount,
        last_debt_interest_at = coalesce(last_debt_interest_at, now())
    where user_id = auth.uid();

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), p_amount, 'Emprunt bancaire', auth.uid());
end;
$$;

create or replace function public.repay_loan(p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_debt numeric(18,2);
begin
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select debt_principal into v_debt from public.wallets where user_id = auth.uid() for update;
  if v_debt is null or v_debt <= 0 then
    raise exception 'Tu n''as pas de dette à rembourser.';
  end if;

  if p_amount > v_debt then
    p_amount := v_debt; -- on ne rembourse jamais plus que ce qui est dû
  end if;

  update public.wallets
    set balance = balance - p_amount,
        debt_principal = debt_principal - p_amount
    where user_id = auth.uid();

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), -p_amount, 'Remboursement d''emprunt', auth.uid());
end;
$$;

-- =========================================================
-- purchase_item : bloque les achats tant que le solde est négatif (dette
-- avec intérêts impayés).
-- =========================================================

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

  update public.wallets set balance = balance - v_total where user_id = auth.uid();

  insert into public.purchases (item_id, user_id, quantity, total_price, status)
  values (p_item_id, auth.uid(), p_quantity, v_total, 'pending')
  returning * into v_purchase;

  insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
  values (auth.uid(), -v_total, 'Achat : ' || v_item.name, v_purchase.id, auth.uid());

  if v_item.created_by is not null and v_item.created_by <> auth.uid() then
    update public.wallets set balance = balance + v_total where user_id = v_item.created_by;
    insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
    values (v_item.created_by, v_total, 'Vente : ' || v_item.name, v_purchase.id, auth.uid());
  end if;

  if v_item.stock is not null then
    update public.shop_items set stock = stock - p_quantity where id = p_item_id;
  end if;

  return v_purchase;
end;
$$;

-- =========================================================
-- Traitement quotidien unifié : salaires dus (TOUT LE MONDE, pas
-- seulement l'appelant), intérêts bancaires, intérêts de dette. Déclenché
-- à la connexion de n'importe quel membre (voir layout.tsx), pas de
-- vérification de permission — même logique que process_expired_quests.
-- =========================================================

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
  -- 1) Tous les salaires en retard, pour tout le monde.
  perform public.process_due_salaries();

  v_bank_rate := public.get_config_numeric('bank_daily_interest_rate', 0.01);
  v_debt_rate := public.get_config_numeric('debt_daily_interest_rate', 0.02);

  -- 2) Intérêts d'épargne (composés, un jour à la fois pour rattraper les
  -- membres absents depuis un moment, comme les salaires).
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

  -- 3) Intérêts de dette : calculés sur le principal, prélevés directement
  -- sur le solde (ce qui peut le faire passer en négatif).
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
end;
$$;

-- =========================================================
-- Notification "argent reçu" : générique, déclenchée sur TOUT crédit
-- (montant positif) dans transactions, sauf les mouvements "internes"
-- (dépôt/retrait bancaire, qui ne sont pas vraiment de l'argent "reçu"
-- d'ailleurs). Couvre salaire, récompense de quête, vente en boutique,
-- ajustement admin, intérêts bancaires, emprunt — sans avoir à modifier
-- chaque fonction individuellement.
-- =========================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'chat_message', 'quest_validated', 'quest_failed', 'application_decision',
  'quest_confirmation_needed', 'travel_arrived', 'salary_paid', 'money_received'
));

create or replace function public.notify_money_received()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.amount > 0 and new.reason not like 'Retrait bancaire%' and new.reason not like 'Dépôt en banque%' then
    insert into public.notifications (user_id, type, title, body)
    values (
      new.user_id,
      case when new.reason like 'Salaire%' then 'salary_paid' else 'money_received' end,
      'Argent reçu',
      '+' || new.amount::text || ' Cr. — ' || coalesce(new.reason, 'Crédit')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_money_received on public.transactions;
create trigger trg_notify_money_received
  after insert on public.transactions
  for each row execute function public.notify_money_received();
