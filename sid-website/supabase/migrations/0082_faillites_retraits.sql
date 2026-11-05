-- =====================================================================
-- Lot 67 : faillite des entreprises sans chiffre d'affaires, retraits
-- validés par l'administration. Rejouable. À lancer après 0081.
--
-- FAILLITE
--   Chaque entreprise est jugée par semaines de 7 jours, à partir de sa
--   création (ou du lancement de cette migration pour les entreprises qui
--   existent déjà : elles ont une semaine pleine). Si les ventes d'une
--   semaine n'atteignent pas app_config.business_min_weekly_revenue
--   (2 000 z par défaut ; 0 désactive la règle), l'entreprise fait faillite :
--     1. les retraits en attente et les enchères en cours sont annulés ;
--     2. la trésorerie rembourse d'abord la dette de l'entreprise ;
--     3. le reste est réparti entre tous les actionnaires (membres et
--        population simulée) au prorata de leurs actions ; sans
--        actionnaire, il va à la caisse commune ;
--     4. l'entreprise est fermée, ses objets retirés de la vente.
--   Les achats du fondateur dans sa propre entreprise ne comptent pas dans
--   le chiffre d'affaires. Le fondateur est prévenu deux jours avant la fin
--   d'une semaine insuffisante.
--
-- RETRAITS
--   Retirer de l'épargne (banque) ou de la trésorerie d'une entreprise crée
--   une demande : la somme est mise de côté tout de suite, puis versée quand
--   un admin « Économie » valide, ou remise à sa place s'il refuse ou si le
--   membre annule. Un admin ne valide pas son propre retrait, sauf s'il est
--   le seul admin « Économie ».
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Ventes : aux enchères et à la population comptent aussi
-- ---------------------------------------------------------------------
create or replace function public.business_tx_kind(p_reason text)
returns text
language sql immutable
as $$
  select case
    when p_reason like 'Vente%' then 'sale'
    when p_reason like 'Salaire%' then 'salary'
    when p_reason like 'Intérêts%' then 'interest'
    when p_reason like 'Dividende%' then 'dividend'
    when p_reason like 'Reversement%' then 'subsidy'
    when p_reason like 'Filet de liquidité%' then 'subsidy'
    when p_reason like 'Emprunt%' or p_reason like 'Remboursement%' then 'loan'
    when p_reason like 'Apport%' or p_reason like 'Retrait%' then 'capital'
    when p_reason like 'Achat de%' or p_reason like 'Rachat%' then 'shares'
    else 'other'
  end;
$$;

update public.business_transactions set kind = 'sale'
where kind = 'other' and reason like 'Vente%';

-- ---------------------------------------------------------------------
-- 1. Colonnes
-- ---------------------------------------------------------------------
alter table public.businesses add column if not exists revenue_period_start timestamptz;
alter table public.businesses add column if not exists bankruptcy_warned_at timestamptz;
alter table public.businesses add column if not exists closed_at timestamptz;
alter table public.businesses add column if not exists closed_reason text;

-- Les entreprises déjà ouvertes commencent leur première semaine maintenant.
update public.businesses set revenue_period_start = greatest(created_at, now())
where revenue_period_start is null and not is_closed;

-- ---------------------------------------------------------------------
-- 2. Demandes de retrait
-- ---------------------------------------------------------------------
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('bank', 'business')),
  business_id uuid references public.businesses(id) on delete set null,
  amount numeric(18, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 300)
);
create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests (status, created_at);
create index if not exists withdrawal_requests_user_idx on public.withdrawal_requests (user_id, created_at desc);
create index if not exists withdrawal_requests_business_idx on public.withdrawal_requests (business_id) where status = 'pending';

alter table public.withdrawal_requests enable row level security;
drop policy if exists "withdrawal_requests_select" on public.withdrawal_requests;
create policy "withdrawal_requests_select" on public.withdrawal_requests for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));
revoke all on public.withdrawal_requests from anon;
revoke insert, update, delete on public.withdrawal_requests from authenticated;
grant select on public.withdrawal_requests to authenticated;

-- Les admins « Économie » à prévenir (une notification regroupée par jour).
create or replace function public._withdrawal_notify_admins(p_line text, p_amount numeric)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_admin uuid;
begin
  for v_admin in
    select p.id from public.profiles p
    where p.status = 'active' and not public.is_sandbox_account(p.id)
      and public.has_permission(p.id, 'manage_economy')
  loop
    perform public._notify_grouped(v_admin, 'admin_alert', 'retraits', 'Retrait à valider', p_line, p_amount,
                                   'retraits à valider', '/dashboard/admin/economy#retraits');
  end loop;
end;
$$;

-- Rend la somme mise de côté à sa source (refus, annulation, faillite).
create or replace function public._withdrawal_restore(w public.withdrawal_requests, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if w.kind = 'bank' then
    insert into public.bank_accounts (user_id, balance) values (w.user_id, w.amount)
    on conflict (user_id) do update set balance = public.bank_accounts.balance + excluded.balance;
  elsif w.business_id is not null then
    update public.businesses set treasury_balance = treasury_balance + w.amount where id = w.business_id;
    if found then
      insert into public.business_transactions (business_id, amount, reason, created_by)
      values (w.business_id, w.amount, 'Retrait ' || p_reason || ' : somme remise en trésorerie', auth.uid());
    end if;
  end if;
end;
$$;

-- Épargne → portefeuille : demande.
drop function if exists public.withdraw_from_bank(numeric);
create function public.withdraw_from_bank(p_amount numeric)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bank numeric(18, 2);
  v_nick text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;
  p_amount := round(p_amount, 2);

  select balance into v_bank from public.bank_accounts where user_id = v_uid for update;
  if v_bank is null or v_bank < p_amount then raise exception 'Solde bancaire insuffisant'; end if;

  update public.bank_accounts set balance = balance - p_amount where user_id = v_uid;
  insert into public.withdrawal_requests (user_id, kind, amount) values (v_uid, 'bank', p_amount)
  returning id into v_id;

  select nickname into v_nick from public.profiles where id = v_uid;
  perform public._withdrawal_notify_admins(coalesce(v_nick, 'Un membre') || ' : ' || public._fmt_z(p_amount) || ' z (épargne)', p_amount);
  return v_id;
end;
$$;

-- Trésorerie d'entreprise → portefeuille : demande.
drop function if exists public.withdraw_business_funds(uuid, numeric);
create function public.withdraw_business_funds(p_business_id uuid, p_amount numeric)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_business public.businesses;
  v_nick text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;
  p_amount := round(p_amount, 2);

  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then raise exception 'Entreprise introuvable'; end if;
  if v_business.is_closed then raise exception 'Cette entreprise est fermée.'; end if;
  if not (v_business.founder_id = v_uid or public.has_permission(v_uid, 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if v_business.treasury_balance < p_amount then raise exception 'Trésorerie insuffisante.'; end if;

  update public.businesses set treasury_balance = treasury_balance - p_amount where id = p_business_id;
  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, -p_amount, 'Retrait demandé (en attente de validation)', v_uid);
  insert into public.withdrawal_requests (user_id, kind, business_id, amount) values (v_uid, 'business', p_business_id, p_amount)
  returning id into v_id;

  select nickname into v_nick from public.profiles where id = v_uid;
  perform public._withdrawal_notify_admins(
    coalesce(v_nick, 'Un membre') || ' : ' || public._fmt_z(p_amount) || ' z (' || v_business.name || ')', p_amount);
  return v_id;
end;
$$;

create or replace function public.withdrawal_cancel(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  w public.withdrawal_requests;
begin
  update public.withdrawal_requests set status = 'cancelled', decided_at = now()
  where id = p_id and user_id = auth.uid() and status = 'pending'
  returning * into w;
  if w.id is null then raise exception 'Demande introuvable ou déjà traitée.'; end if;
  perform public._withdrawal_restore(w, 'annulé');
end;
$$;

create or replace function public.withdrawal_decide(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  w public.withdrawal_requests;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_name text;
  v_source text;
begin
  if not public.has_permission(v_uid, 'manage_economy') or public.is_sandbox_account(v_uid) then
    raise exception 'Permission refusée : gestion de l''économie requise.';
  end if;
  if v_note is not null and char_length(v_note) > 300 then raise exception 'Le motif est limité à 300 caractères.'; end if;

  select * into w from public.withdrawal_requests where id = p_id for update;
  if w.id is null or w.status <> 'pending' then raise exception 'Demande introuvable ou déjà traitée.'; end if;
  if w.user_id = v_uid and exists (
    select 1 from public.profiles p
    where p.id <> v_uid and p.status = 'active' and not public.is_sandbox_account(p.id)
      and public.has_permission(p.id, 'manage_economy')
  ) then
    raise exception 'Un autre admin doit valider ton propre retrait.';
  end if;

  select name into v_name from public.businesses where id = w.business_id;
  v_source := case when w.kind = 'bank' then 'épargne' else coalesce(v_name, 'entreprise') end;

  update public.withdrawal_requests
  set status = case when coalesce(p_approve, false) then 'approved' else 'rejected' end,
      decided_by = v_uid, decided_at = now(), decision_note = v_note
  where id = w.id;

  if coalesce(p_approve, false) then
    update public.wallets set balance = balance + w.amount where user_id = w.user_id;
    insert into public.transactions (user_id, amount, reason, created_by)
    values (w.user_id, w.amount,
            case when w.kind = 'bank' then 'Retrait bancaire' else 'Retrait entreprise : ' || coalesce(v_name, 'entreprise') end,
            v_uid);
    insert into public.notifications (user_id, type, title, body, link)
    values (w.user_id, 'money_received', 'Retrait validé',
            '+' || public._fmt_z(w.amount) || ' z (' || v_source || ') dans ton portefeuille.', '/dashboard/bank');
  else
    perform public._withdrawal_restore(w, 'refusé');
    insert into public.notifications (user_id, type, title, body, link)
    values (w.user_id, 'money_received', 'Retrait refusé',
            public._fmt_z(w.amount) || ' z (' || v_source || ') remis à leur place' || coalesce(' : ' || v_note, '.'),
            case when w.kind = 'bank' then '/dashboard/bank' else '/dashboard/business' end);
  end if;

  perform public.write_audit(
    case when coalesce(p_approve, false) then 'withdrawal_approved' else 'withdrawal_rejected' end,
    w.user_id, jsonb_build_object('montant', w.amount, 'source', v_source, 'motif', v_note));
end;
$$;

-- Mes demandes (p_scope = 'mine'), ou pour les admins : 'pending' / 'recent'.
create or replace function public.withdrawals_list(p_scope text default 'mine')
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.has_permission(auth.uid(), 'manage_economy');
begin
  if v_uid is null then return '[]'::jsonb; end if;
  if p_scope <> 'mine' and not v_admin then raise exception 'Permission refusée.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', w.id,
             'user_id', w.user_id,
             'nickname', p.nickname,
             'kind', w.kind,
             'business_id', w.business_id,
             'business_name', b.name,
             'amount', w.amount,
             'status', w.status,
             'created_at', w.created_at,
             'decided_at', w.decided_at,
             'decided_by', d.nickname,
             'note', w.decision_note,
             'wallet', case when p_scope = 'pending' then (select balance from public.wallets where user_id = w.user_id) end,
             'self', w.user_id = v_uid
           ) order by case when w.status = 'pending' then 0 else 1 end, w.created_at desc)
    from (
      select * from public.withdrawal_requests x
      where case p_scope
              when 'mine' then x.user_id = v_uid and (x.status = 'pending' or x.created_at > now() - interval '30 days')
              when 'pending' then x.status = 'pending'
              else x.status <> 'pending' and x.decided_at > now() - interval '30 days'
            end
      order by x.created_at desc
      limit 200
    ) w
    left join public.profiles p on p.id = w.user_id
    left join public.profiles d on d.id = w.decided_by
    left join public.businesses b on b.id = w.business_id
  ), '[]'::jsonb);
end;
$$;

-- Plus de notification « Argent reçu » pour un retrait ou une faillite :
-- la leur suffit.
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

-- ---------------------------------------------------------------------
-- 3. Fermeture volontaire (0033) : les retraits en attente reviennent
--    d'abord dans la trésorerie partagée.
-- ---------------------------------------------------------------------
create or replace function public.close_business(p_business_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_public_shares int;
  v_per_share numeric(18, 6);
  r record;
  w public.withdrawal_requests;
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

  for w in select * from public.withdrawal_requests where business_id = p_business_id and status = 'pending' for update loop
    update public.withdrawal_requests set status = 'cancelled', decided_at = now(), decision_note = 'Entreprise fermée' where id = w.id;
    perform public._withdrawal_restore(w, 'annulé (fermeture)');
  end loop;
  select * into v_business from public.businesses where id = p_business_id;

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
    set is_closed = true, treasury_balance = 0, shares_in_treasury = share_count,
        closed_at = now(), closed_reason = 'liquidation'
    where id = p_business_id;

  delete from public.business_shareholders where business_id = p_business_id;
  delete from public.business_employees where business_id = p_business_id;

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, 0, 'Entreprise fermée / liquidée', auth.uid());
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Faillite
-- ---------------------------------------------------------------------
-- Ventes d'une période, sans les achats du fondateur chez lui-même.
create or replace function public._business_period_revenue(p_business uuid, p_from timestamptz, p_to timestamptz)
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(t.amount), 0)
  from public.business_transactions t
  join public.businesses b on b.id = t.business_id
  where t.business_id = p_business and t.kind = 'sale'
    and t.created_at >= p_from and t.created_at < p_to
    and t.created_by is distinct from b.founder_id;
$$;

create or replace function public._business_bankrupt(p_id uuid, p_revenue numeric, p_minimum numeric)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  b public.businesses;
  w public.withdrawal_requests;
  a record;
  r record;
  v_cash numeric(18, 2);
  v_debt numeric(18, 2);
  v_total int;
  v_part numeric(18, 2);
  v_paid numeric(18, 2) := 0;
  v_parts jsonb := '{}'::jsonb;
  v_why text;
  v_uid uuid;
begin
  select * into b from public.businesses where id = p_id for update;
  if b.id is null or b.is_closed then return 0; end if;

  -- 1. Retraits en attente et enchères en cours : annulés.
  for w in select * from public.withdrawal_requests where business_id = p_id and status = 'pending' for update loop
    update public.withdrawal_requests set status = 'cancelled', decided_at = now(), decision_note = 'Faillite de l''entreprise' where id = w.id;
    perform public._withdrawal_restore(w, 'annulé (faillite)');
  end loop;

  for a in select * from public.auctions where business_id = p_id and status = 'open' for update loop
    if a.top_bidder is not null and a.current_price is not null then
      perform public._auction_refund(a.top_bidder, a.current_price, 'Enchère annulée : faillite du vendeur (remboursement)');
      perform public._auction_notify(a.top_bidder, 'Enchère annulée', 'Le vendeur a fait faillite : ton offre t''est rendue.', a.id);
    end if;
    if a.purchase_id is null then
      update public.shop_items set stock = stock + a.quantity where id = a.item_id and stock is not null;
    end if;
    update public.auctions set status = 'cancelled', settled_at = now() where id = a.id;
  end loop;

  select * into b from public.businesses where id = p_id;

  -- 2. La dette d'abord.
  v_cash := greatest(b.treasury_balance, 0);
  v_debt := least(v_cash, greatest(b.debt_principal, 0));
  v_cash := v_cash - v_debt;

  -- 3. Le reste aux actionnaires, au prorata.
  v_total := coalesce((select sum(quantity) from public.business_shareholders where business_id = p_id and quantity > 0), 0)
           + coalesce((select sum(quantity) from public.sim_shareholdings where business_id = p_id and quantity > 0), 0);

  if v_cash > 0 and v_total > 0 then
    for r in select user_id, quantity from public.business_shareholders where business_id = p_id and quantity > 0 loop
      v_part := trunc(v_cash * r.quantity / v_total, 2);
      if v_part > 0 then
        update public.wallets set balance = balance + v_part where user_id = r.user_id;
        insert into public.transactions (user_id, amount, reason, created_by)
        values (r.user_id, v_part, 'Faillite : ' || b.name || ' (part d''actionnaire)', null);
        v_paid := v_paid + v_part;
      end if;
      v_parts := v_parts || jsonb_build_object(r.user_id::text, v_part);
    end loop;
    for r in select agent_id, quantity from public.sim_shareholdings where business_id = p_id and quantity > 0 loop
      v_part := trunc(v_cash * r.quantity / v_total, 2);
      update public.sim_agents set balance = balance + v_part where id = r.agent_id;
      v_paid := v_paid + v_part;
    end loop;
  end if;
  -- Centimes d'arrondi, ou tout s'il n'y a aucun actionnaire : caisse commune.
  if v_cash - v_paid > 0 then
    update public.tax_pool set balance = balance + (v_cash - v_paid) where id = true;
  end if;

  -- 4. Fermeture.
  v_why := 'chiffre d''affaires de la semaine ' || public._fmt_z(p_revenue) || ' z sur ' || public._fmt_z(p_minimum) || ' z requis';
  update public.businesses
    set is_closed = true, treasury_balance = 0, debt_principal = 0, shares_in_treasury = share_count,
        closed_at = now(), closed_reason = 'faillite'
    where id = p_id;
  update public.shop_items set is_active = false where business_id = p_id;
  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_id, 0, 'Faillite : ' || v_why
                   || case when v_debt > 0 then ', dette remboursée ' || public._fmt_z(v_debt) || ' z' else '' end
                   || ', ' || public._fmt_z(v_cash) || ' z répartis', null);

  -- 5. Le fondateur et les actionnaires sont prévenus.
  for v_uid in
    select b.founder_id
    union
    select user_id from public.business_shareholders where business_id = p_id and quantity > 0
  loop
    insert into public.notifications (user_id, type, title, body, link)
    select v_uid, 'business', 'Faillite : ' || b.name,
           upper(left(v_why, 1)) || substr(v_why, 2) || '.'
           || case when (v_parts ? v_uid::text) then ' Ta part : +' || public._fmt_z((v_parts->>v_uid::text)::numeric) || ' z.' else '' end,
           '/dashboard/business'
    where exists (select 1 from public.profiles where id = v_uid);
  end loop;

  delete from public.business_shareholders where business_id = p_id;
  delete from public.sim_shareholdings where business_id = p_id;
  delete from public.business_share_lots where business_id = p_id;
  delete from public.business_employees where business_id = p_id;
  return v_cash;
end;
$$;

-- Le juge : semaines échues, faillites, et avertissement à J-2.
create or replace function public.businesses_check_bankruptcy()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_min numeric := public.get_config_numeric('business_min_weekly_revenue', 2000);
  r record;
  v_start timestamptz;
  v_rev numeric;
  v_failed boolean;
  n int := 0;
begin
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

-- La semaine en cours de mes entreprises (ou de toutes, pour l'économie).
create or replace function public.business_weeks(p_all boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_min numeric := public.get_config_numeric('business_min_weekly_revenue', 2000);
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

-- ---------------------------------------------------------------------
-- 5. Tâches planifiées (0081) : + le juge, une fois par heure
-- ---------------------------------------------------------------------
create or replace function public.run_scheduled_jobs()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
  v_last timestamptz;
begin
  v := v || jsonb_build_object('sondages', public.polls_publish_due());
  v := v || jsonb_build_object('rappels', public.auctions_remind_due());
  v := v || jsonb_build_object('encheres', public.auctions_settle_due());
  select value::timestamptz into v_last from public.app_config where key = 'notif_cleanup_last';
  if v_last is null or v_last < now() - interval '1 hour' then
    insert into public.app_config (key, value) values ('notif_cleanup_last', now()::text)
    on conflict (key) do update set value = excluded.value;
    v := v || jsonb_build_object('nettoyage', public.notifications_cleanup());
  end if;
  select value::timestamptz into v_last from public.app_config where key = 'bankruptcy_last_check';
  if v_last is null or v_last < now() - interval '1 hour' then
    insert into public.app_config (key, value) values ('bankruptcy_last_check', now()::text)
    on conflict (key) do update set value = excluded.value;
    v := v || jsonb_build_object('faillites', public.businesses_check_bankruptcy());
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Droits d'exécution
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._withdrawal_notify_admins(text, numeric)',
    'public._withdrawal_restore(public.withdrawal_requests, text)',
    'public.withdraw_from_bank(numeric)',
    'public.withdraw_business_funds(uuid, numeric)',
    'public.withdrawal_cancel(uuid)',
    'public.withdrawal_decide(uuid, boolean, text)',
    'public.withdrawals_list(text)',
    'public._business_period_revenue(uuid, timestamptz, timestamptz)',
    'public._business_bankrupt(uuid, numeric, numeric)',
    'public.businesses_check_bankruptcy()',
    'public.business_weeks(boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
  end loop;

  foreach f in array array[
    'public._withdrawal_notify_admins(text, numeric)',
    'public._withdrawal_restore(public.withdrawal_requests, text)',
    'public._business_period_revenue(uuid, timestamptz, timestamptz)',
    'public._business_bankrupt(uuid, numeric, numeric)',
    'public.businesses_check_bankruptcy()'
  ] loop
    execute format('revoke all on function %s from authenticated', f);
  end loop;

  foreach f in array array[
    'public.withdraw_from_bank(numeric)',
    'public.withdraw_business_funds(uuid, numeric)',
    'public.withdrawal_cancel(uuid)',
    'public.withdrawal_decide(uuid, boolean, text)',
    'public.withdrawals_list(text)',
    'public.business_weeks(boolean)'
  ] loop
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
