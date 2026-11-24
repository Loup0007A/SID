-- =====================================================================
-- 0131 — Lot 102 : faillite par cessation de paiements. Rejouable.
-- À lancer après 0130.
--
-- Avant (0082, 0092) : une semaine de ventes sous un seuil liquidait
-- l'entreprise sur-le-champ, même avec une trésorerie pleine.
--
-- Désormais, comme dans la réalité :
-- 1. FRAIS DE FONCTIONNEMENT. Chaque semaine (à compter de la création ;
--    pour les entreprises existantes, à compter de cette migration), la
--    trésorerie paie ses frais : loyer, entretien, fournisseurs. Montant
--    commun à toutes les entreprises, fixé par l'argent en circulation :
--      taux × masse monétaire du S.I.D. ÷ nombre de membres actifs
--    (soit un pourcentage de la fortune moyenne d'un membre), 10 z au
--    moins. Taux par défaut 3 %, réglable (0 : pas de frais). L'argent va à
--    la population simulée (les fournisseurs) : il reste en circulation.
-- 2. CESSATION DE PAIEMENTS. Une trésorerie sous zéro (frais, impôt ou
--    amende saisis, litige perdu) après remise des retraits en attente
--    ouvre un REDRESSEMENT JUDICIAIRE de 7 jours :
--      - cotation des actions suspendue ;
--      - pas de retrait, de dividende, de nouvel emprunt, de frais
--        d'entreprise ni de fermeture volontaire ;
--      - la vente continue, et le fondateur peut faire un apport.
--    Sauvée dès que la trésorerie couvre les frais d'une semaine, ou à
--    l'échéance si elle est revenue à zéro ou plus.
-- 3. LIQUIDATION JUDICIAIRE à l'échéance sinon. L'actif (trésorerie
--    positive, après remise des retraits) paie, dans l'ordre :
--      a. l'État : impôts et amendes de l'entreprise encore dus ;
--      b. la banque : la dette ;
--      c. les actionnaires, au prorata (population simulée comprise).
--    Le reste éventuel va à la caisse commune. Les actions ne valent plus
--    rien. Le fondateur ne peut plus créer d'entreprise pendant 30 jours
--    (interdiction de gérer).
-- Avertissements : au fondateur 2 jours avant des frais que la trésorerie
-- ne couvre pas ; au fondateur, aux actionnaires et aux admins « Économie »
-- à l'ouverture du redressement, à J-2 et à l'issue.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colonnes et tables
-- ---------------------------------------------------------------------
alter table public.businesses add column if not exists charges_period_start timestamptz;
alter table public.businesses add column if not exists charges_warned_at timestamptz;
alter table public.businesses add column if not exists procedure_kind text check (procedure_kind is null or procedure_kind = 'redressement');
alter table public.businesses add column if not exists procedure_started_at timestamptz;
alter table public.businesses add column if not exists procedure_until timestamptz;
alter table public.businesses add column if not exists procedure_warned_at timestamptz;

-- Les entreprises existantes commencent leur première semaine maintenant.
update public.businesses set charges_period_start = now() where charges_period_start is null and not is_closed;
alter table public.businesses alter column charges_period_start set default now();

create table if not exists public.business_procedures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  opened_at timestamptz not null default now(),
  until timestamptz not null,
  treasury_at_open numeric(18, 2) not null,
  closed_at timestamptz,
  outcome text check (outcome is null or outcome in ('sauvee', 'liquidee')),
  details jsonb not null default '{}'::jsonb
);
create index if not exists business_procedures_business_idx on public.business_procedures (business_id, opened_at desc);

create table if not exists public.business_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  until timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists business_bans_user_idx on public.business_bans (user_id, until desc);

alter table public.business_procedures enable row level security;
alter table public.business_bans enable row level security;
revoke all on public.business_procedures, public.business_bans from public, anon, authenticated;

insert into public.app_config (key, value) values ('business_weekly_costs_rate', '0.03') on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Frais de fonctionnement
-- ---------------------------------------------------------------------
create or replace function public._business_active_members()
returns int
language sql stable security definer set search_path = public
as $$
  select greatest(count(*), 1)::int from public.profiles p
  where p.status = 'active' and not public.is_sandbox_account(p.id);
$$;

-- Frais d'une semaine, communs à toutes les entreprises.
create or replace function public.business_weekly_costs()
returns numeric
language sql stable security definer set search_path = public
as $$
  select case when public.get_config_numeric('business_weekly_costs_rate', 0.03) <= 0 then 0
    else greatest(10, round(public.get_config_numeric('business_weekly_costs_rate', 0.03)
                            * public._econ_money_supply() / public._business_active_members()))
  end;
$$;

-- Réglage (admins « Économie ») : état et taux.
create or replace function public.business_costs_status()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_supply numeric := public._econ_money_supply();
  v_members int := public._business_active_members();
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Réservé aux admins « Économie ».' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'rate', public.get_config_numeric('business_weekly_costs_rate', 0.03),
    'money_supply', round(v_supply),
    'members', v_members,
    'average', round(v_supply / v_members),
    'costs', public.business_weekly_costs(),
    'in_procedure', (select count(*) from public.businesses where not is_closed and procedure_kind is not null));
end;
$$;

create or replace function public.business_costs_set(p_rate numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Réservé aux admins « Économie ».' using errcode = '42501';
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 0.5 then raise exception 'Taux entre 0 et 50 %%.'; end if;
  insert into public.app_config (key, value) values ('business_weekly_costs_rate', round(p_rate, 4)::text)
  on conflict (key) do update set value = excluded.value;
  perform public.write_audit('business_costs_rate', null, jsonb_build_object('rate', round(p_rate, 4)));
  return public.business_costs_status();
end;
$$;

-- Les frais vont aux fournisseurs : la population simulée, à parts égales
-- (sans population : la caisse commune).
create or replace function public._business_pay_suppliers(p_amount numeric)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  n int := (select count(*) from public.sim_agents);
  v_part numeric(18, 2);
begin
  if p_amount <= 0 then return; end if;
  if n = 0 then
    update public.tax_pool set balance = balance + p_amount where id = true;
    return;
  end if;
  v_part := trunc(p_amount / n, 2);
  update public.sim_agents set balance = balance + v_part where true;
  if p_amount - v_part * n > 0 then
    update public.tax_pool set balance = balance + (p_amount - v_part * n) where id = true;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Procédure : notifications
-- ---------------------------------------------------------------------
create or replace function public._business_notify_all(p_id uuid, p_title text, p_body text, p_admins boolean default false)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b public.businesses;
begin
  select * into b from public.businesses where id = p_id;
  insert into public.notifications (user_id, type, title, body, link)
  select distinct u, 'business', p_title, p_body, '/dashboard/business'
  from (
    select b.founder_id as u
    union select user_id from public.business_shareholders where business_id = p_id and quantity > 0
    union select p.id from public.profiles p
          where p_admins and p.status = 'active' and public.has_permission(p.id, 'manage_economy') and not public.is_sandbox_account(p.id)
  ) x
  where u is not null and exists (select 1 from public.profiles where id = u);
end;
$$;

create or replace function public._fmt_date(p_at timestamptz)
returns text
language sql stable
as $$
  select to_char(p_at at time zone public.stats_timezone(), 'DD/MM à HH24"h"MI');
$$;

-- Remet les retraits et frais d'entreprise en attente dans la trésorerie.
create or replace function public._business_restore_pending(p_id uuid, p_word text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  w public.withdrawal_requests;
begin
  for w in select * from public.withdrawal_requests where business_id = p_id and status = 'pending' for update loop
    update public.withdrawal_requests set status = 'cancelled', decided_at = now(), decision_note = p_word where id = w.id;
    perform public._withdrawal_restore(w, 'annulé (' || lower(p_word) || ')');
  end loop;
  perform public._expense_cancel_pending(p_id, 'annulés (' || lower(p_word) || ')');
end;
$$;

-- Ouverture du redressement judiciaire.
create or replace function public._business_open_procedure(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b public.businesses;
  v_until timestamptz := now() + interval '7 days';
begin
  perform public._business_restore_pending(p_id, 'Cessation de paiements');
  select * into b from public.businesses where id = p_id for update;
  if b.is_closed or b.procedure_kind is not null or b.treasury_balance >= 0 then return; end if;
  update public.businesses
  set procedure_kind = 'redressement', procedure_started_at = now(), procedure_until = v_until, procedure_warned_at = null,
      halted_until = greatest(coalesce(halted_until, now()), v_until)
  where id = p_id;
  insert into public.business_procedures (business_id, until, treasury_at_open) values (p_id, v_until, b.treasury_balance);
  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_id, 0, 'Cessation de paiements : redressement judiciaire jusqu''au ' || public._fmt_date(v_until), null);
  perform public._business_notify_all(p_id, 'Redressement judiciaire : ' || b.name,
    'Trésorerie à ' || public._fmt_z(b.treasury_balance) || ' z : l''entreprise ne peut plus payer. Elle a jusqu''au '
    || public._fmt_date(v_until) || ' pour revenir au-dessus de zéro (ventes, apport du fondateur), sinon elle sera liquidée. '
    || 'Cotation suspendue ; ni retrait, ni dividende, ni emprunt d''ici là.', true);
end;
$$;

-- Issue favorable.
create or replace function public._business_save(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b public.businesses;
begin
  select * into b from public.businesses where id = p_id for update;
  if b.procedure_kind is null then return; end if;
  update public.businesses
  set procedure_kind = null, procedure_started_at = null, procedure_until = null, procedure_warned_at = null,
      halted_until = case when halted_until <= b.procedure_until then now() else halted_until end
  where id = p_id;
  update public.business_procedures set closed_at = now(), outcome = 'sauvee', details = jsonb_build_object('treasury', b.treasury_balance)
  where business_id = p_id and closed_at is null;
  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_id, 0, 'Fin du redressement : entreprise sauvée (trésorerie ' || public._fmt_z(b.treasury_balance) || ' z)', null);
  perform public._business_notify_all(p_id, 'Redressement réussi : ' || b.name,
    'La trésorerie est revenue à ' || public._fmt_z(b.treasury_balance) || ' z. La procédure est levée, la cotation reprend.', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Liquidation judiciaire
-- ---------------------------------------------------------------------
create or replace function public._business_liquidate(p_id uuid, p_motif text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  b public.businesses;
  a record;
  r record;
  t public.tax_bills;
  v_cash numeric(18, 2);
  v_etat numeric(18, 2) := 0;
  v_banque numeric(18, 2) := 0;
  v_pay numeric(18, 2);
  v_total int;
  v_part numeric(18, 2);
  v_paid numeric(18, 2) := 0;
  v_parts jsonb := '{}'::jsonb;
  v_reste numeric(18, 2) := 0;
  v_ban timestamptz := now() + interval '30 days';
  v_uid uuid;
  v_report jsonb;
begin
  select * into b from public.businesses where id = p_id for update;
  if b.id is null or b.is_closed then return null; end if;

  -- Retraits, frais d'entreprise et enchères en cours : annulés.
  perform public._business_restore_pending(p_id, 'Liquidation');
  for a in select * from public.auctions where business_id = p_id and status = 'open' for update loop
    if a.top_bidder is not null and a.current_price is not null then
      perform public._auction_refund(a.top_bidder, a.current_price, 'Enchère annulée : liquidation du vendeur (remboursement)');
      perform public._auction_notify(a.top_bidder, 'Enchère annulée', 'Le vendeur a été liquidé : ton offre t''est rendue.', a.id);
    end if;
    if a.purchase_id is null then
      update public.shop_items set stock = stock + a.quantity where id = a.item_id and stock is not null;
    end if;
    update public.auctions set status = 'cancelled', settled_at = now() where id = a.id;
  end loop;

  select * into b from public.businesses where id = p_id;
  v_cash := greatest(b.treasury_balance, 0);

  -- a. L'État : impôts et amendes de l'entreprise encore dus.
  for t in select * from public.tax_bills where business_id = p_id and status = 'due' order by due_at for update loop
    exit when v_cash <= 0;
    v_pay := least(v_cash, t.amount);
    v_cash := v_cash - v_pay;
    v_etat := v_etat + v_pay;
    update public.tax_pool set balance = balance + v_pay where id = true;
    if v_pay >= t.amount then
      update public.tax_bills set status = 'paid', paid_at = now(), paid_from = 'tresorerie' where id = t.id;
    end if;
  end loop;
  -- Le reste des impôts de l'entreprise tombe avec elle ; une amende
  -- impayée revient au fondateur (comme à la fermeture, 0084).
  update public.tax_bills set status = 'cancelled' where business_id = p_id and status = 'due' and kind = 'societe';

  -- b. La banque : la dette.
  v_banque := least(v_cash, greatest(b.debt_principal, 0));
  v_cash := v_cash - v_banque;

  -- c. Les actionnaires, au prorata.
  v_total := coalesce((select sum(quantity) from public.business_shareholders where business_id = p_id and quantity > 0), 0)
           + coalesce((select sum(quantity) from public.sim_shareholdings where business_id = p_id and quantity > 0), 0);
  if v_cash > 0 and v_total > 0 then
    for r in select user_id, quantity from public.business_shareholders where business_id = p_id and quantity > 0 loop
      v_part := trunc(v_cash * r.quantity / v_total, 2);
      if v_part > 0 then
        update public.wallets set balance = balance + v_part where user_id = r.user_id;
        insert into public.transactions (user_id, amount, reason, created_by)
        values (r.user_id, v_part, 'Liquidation : ' || b.name || ' (part d''actionnaire)', null);
        v_paid := v_paid + v_part;
        v_parts := v_parts || jsonb_build_object(r.user_id::text, v_part);
      end if;
    end loop;
    for r in select agent_id, quantity from public.sim_shareholdings where business_id = p_id and quantity > 0 loop
      v_part := trunc(v_cash * r.quantity / v_total, 2);
      update public.sim_agents set balance = balance + v_part where id = r.agent_id;
      v_paid := v_paid + v_part;
    end loop;
  end if;
  v_reste := v_cash - v_paid;
  if v_reste > 0 then
    update public.tax_pool set balance = balance + v_reste where id = true;
  end if;

  -- Fermeture, actions sans valeur, interdiction de gérer.
  update public.businesses
  set is_closed = true, treasury_balance = 0, debt_principal = 0, shares_in_treasury = share_count,
      closed_at = now(), closed_reason = 'liquidation_judiciaire',
      procedure_kind = null, procedure_until = null, procedure_started_at = null
  where id = p_id;
  update public.shop_items set is_active = false where business_id = p_id;
  if b.founder_id is not null then
    insert into public.business_bans (user_id, business_id, until, reason)
    values (b.founder_id, p_id, v_ban, 'Liquidation judiciaire de ' || b.name);
  end if;

  v_report := jsonb_build_object('motif', p_motif, 'tresorerie', b.treasury_balance, 'etat', v_etat, 'banque', v_banque,
                                 'actionnaires', v_paid, 'caisse', v_reste, 'dette_restante', greatest(b.debt_principal - v_banque, 0));
  update public.business_procedures set closed_at = now(), outcome = 'liquidee', details = v_report
  where business_id = p_id and closed_at is null;
  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_id, 0, 'Liquidation judiciaire (' || p_motif || ') : État ' || public._fmt_z(v_etat) || ' z, banque '
                   || public._fmt_z(v_banque) || ' z, actionnaires ' || public._fmt_z(v_paid) || ' z', null);

  for v_uid in
    select b.founder_id union select user_id from public.business_shareholders where business_id = p_id and quantity > 0
  loop
    insert into public.notifications (user_id, type, title, body, link)
    select v_uid, 'business', 'Liquidation judiciaire : ' || b.name,
           upper(left(p_motif, 1)) || substr(p_motif, 2) || '. Actif réparti : État ' || public._fmt_z(v_etat) || ' z, banque '
           || public._fmt_z(v_banque) || ' z, actionnaires ' || public._fmt_z(v_paid) || ' z.'
           || case when (v_parts ? v_uid::text) then ' Ta part : +' || public._fmt_z((v_parts->>v_uid::text)::numeric) || ' z.'
                   when v_uid <> b.founder_id then ' Tes actions ne valent plus rien.' else '' end
           || case when v_uid = b.founder_id then ' Tu ne peux plus créer d''entreprise avant le ' || public._fmt_date(v_ban) || '.' else '' end,
           '/dashboard/business'
    where v_uid is not null and exists (select 1 from public.profiles where id = v_uid);
  end loop;
  return v_report;
end;
$$;

-- Compatibilité : l'ancienne faillite (0082) passe par la liquidation.
create or replace function public._business_bankrupt(p_id uuid, p_revenue numeric, p_minimum numeric)
returns numeric
language plpgsql security definer set search_path = public
as $$
begin
  perform public._business_liquidate(p_id, 'liquidation');
  return 0;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Le juge (toutes les heures, run_scheduled_jobs)
-- ---------------------------------------------------------------------
create or replace function public.businesses_check_bankruptcy()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_costs numeric := public.business_weekly_costs();
  v_start timestamptz;
  n int := 0;
  b public.businesses;
begin
  for r in select id from public.businesses where not is_closed order by created_at for update skip locked loop
    select * into b from public.businesses where id = r.id;
    v_start := coalesce(b.charges_period_start, b.created_at);

    -- 1. Frais de chaque semaine écoulée (en retard : toutes les semaines).
    while v_start + interval '7 days' <= now() loop
      v_start := v_start + interval '7 days';
      if v_costs > 0 then
        update public.businesses set treasury_balance = treasury_balance - v_costs where id = b.id;
        insert into public.business_transactions (business_id, amount, reason, created_by)
        values (b.id, -v_costs, 'Frais de fonctionnement de la semaine', null);
        perform public._business_pay_suppliers(v_costs);
      end if;
    end loop;
    if b.charges_period_start is distinct from v_start then
      update public.businesses set charges_period_start = v_start where id = b.id;
    end if;
    select * into b from public.businesses where id = r.id;

    if b.procedure_kind is null then
      -- 2. Cessation de paiements.
      if b.treasury_balance < 0 then
        perform public._business_open_procedure(b.id);
        n := n + 1;
        continue;
      end if;
      -- Avertissement : frais dans moins de 2 jours, que la trésorerie ne couvre pas.
      if v_costs > 0 and now() >= v_start + interval '5 days' and b.treasury_balance < v_costs
         and (b.charges_warned_at is null or b.charges_warned_at < v_start) then
        insert into public.notifications (user_id, type, title, body, link)
        select b.founder_id, 'business', 'Trésorerie insuffisante : ' || b.name,
               'Frais de fonctionnement de ' || public._fmt_z(v_costs) || ' z le ' || public._fmt_date(v_start + interval '7 days')
               || ', trésorerie à ' || public._fmt_z(b.treasury_balance) || ' z. Sous zéro, l''entreprise entre en redressement judiciaire.',
               '/dashboard/business'
        where b.founder_id is not null;
        update public.businesses set charges_warned_at = now() where id = b.id;
      end if;
    else
      -- 3. Redressement en cours.
      if b.treasury_balance >= greatest(v_costs, 0) and b.treasury_balance >= 0 then
        perform public._business_save(b.id);
      elsif now() >= b.procedure_until then
        if b.treasury_balance >= 0 then
          perform public._business_save(b.id);
        else
          perform public._business_liquidate(b.id, 'cessation de paiements non résolue en 7 jours');
          n := n + 1;
        end if;
      elsif now() >= b.procedure_until - interval '2 days' and b.procedure_warned_at is null then
        perform public._business_notify_all(b.id, 'Liquidation dans 2 jours : ' || b.name,
          'Trésorerie à ' || public._fmt_z(b.treasury_balance) || ' z. Sans retour au-dessus de zéro d''ici le '
          || public._fmt_date(b.procedure_until) || ', l''entreprise sera liquidée.');
        update public.businesses set procedure_warned_at = now() where id = b.id;
      end if;
    end if;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Garde-fous pendant le redressement
-- ---------------------------------------------------------------------
create or replace function public._business_in_procedure(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select procedure_kind is not null from public.businesses where id = p_id), false);
$$;

create or replace function public._guard_procedure_request()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.business_id is not null and public._business_in_procedure(new.business_id) then
    raise exception 'Entreprise en redressement judiciaire : impossible pendant la procédure.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_procedure_withdrawal on public.withdrawal_requests;
create trigger trg_procedure_withdrawal before insert on public.withdrawal_requests
  for each row execute function public._guard_procedure_request();
drop trigger if exists trg_procedure_expense on public.expense_requests;
create trigger trg_procedure_expense before insert on public.expense_requests
  for each row execute function public._guard_procedure_request();

-- Emprunt (la dette monte sans passage des intérêts) et fermeture
-- volontaire (elle paierait les actionnaires avant les créanciers).
create or replace function public._guard_procedure_business()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.procedure_kind is not null then
    -- Les intérêts font aussi monter la dette, mais avancent leur date.
    if new.debt_principal > old.debt_principal
       and (old.last_debt_interest_at is null or new.last_debt_interest_at is not distinct from old.last_debt_interest_at) then
      raise exception 'Entreprise en redressement judiciaire : pas de nouvel emprunt pendant la procédure.';
    end if;
    if new.is_closed and not old.is_closed and coalesce(new.closed_reason, '') <> 'liquidation_judiciaire' then
      raise exception 'Entreprise en redressement judiciaire : pas de fermeture volontaire pendant la procédure.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_procedure_business on public.businesses;
create trigger trg_procedure_business before update on public.businesses
  for each row execute function public._guard_procedure_business();

-- Interdiction de gérer.
create or replace function public._guard_business_ban()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_until timestamptz;
begin
  select max(until) into v_until from public.business_bans where user_id = new.founder_id and until > now();
  if v_until is not null then
    raise exception 'Interdiction de gérer jusqu''au % (liquidation judiciaire).', public._fmt_date(v_until);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_business_ban on public.businesses;
create trigger trg_business_ban before insert on public.businesses
  for each row execute function public._guard_business_ban();

-- Dividendes : vérifiés avant la fonction d'origine (0085).
do $$
begin
  if to_regprocedure('public._pay_dividends_0085(uuid, numeric)') is null then
    alter function public.pay_dividends(uuid, numeric) rename to _pay_dividends_0085;
  end if;
end $$;
revoke all on function public._pay_dividends_0085(uuid, numeric) from public, anon, authenticated;
create or replace function public.pay_dividends(p_business_id uuid, p_amount numeric)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if public._business_in_procedure(p_business_id) then
    raise exception 'Entreprise en redressement judiciaire : pas de dividende pendant la procédure.';
  end if;
  perform public._pay_dividends_0085(p_business_id, p_amount);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Lecture : santé des entreprises (reprise de business_weeks, 0092)
-- ---------------------------------------------------------------------
create or replace function public.business_weeks(p_all boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_costs numeric := public.business_weekly_costs();
  v_all boolean := coalesce(p_all, false) and public.has_permission(auth.uid(), 'manage_economy');
begin
  if v_uid is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'business_id', x.id,
             'name', x.name,
             'founder', (select nickname from public.profiles where id = x.founder_id),
             'treasury', x.treasury_balance,
             'debt', x.debt_principal,
             'costs', v_costs,
             'next_charge_at', x.s + interval '7 days',
             'weeks_covered', case when v_costs > 0 then floor(greatest(x.treasury_balance, 0) / v_costs) else null end,
             'procedure', x.procedure_kind,
             'procedure_started_at', x.procedure_started_at,
             'procedure_until', x.procedure_until,
             'pending_withdrawals', (select coalesce(sum(amount), 0) from public.withdrawal_requests w where w.business_id = x.id and w.status = 'pending'),
             -- Ancien format (0082) : gardé pour les pages pas encore à jour.
             'period_start', x.s, 'period_end', x.s + interval '7 days', 'revenue', 0, 'minimum', 0, 'mode', 'off'
           ) order by (x.procedure_kind is null), x.treasury_balance)
    from (
      select b.*,
             coalesce(b.charges_period_start, b.created_at)
               + (floor(greatest(extract(epoch from now() - coalesce(b.charges_period_start, b.created_at)), 0) / 604800))::int * interval '7 days' as s
      from public.businesses b
      where not b.is_closed and (v_all or b.founder_id = v_uid)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- Mon interdiction de gérer éventuelle.
create or replace function public.my_business_ban()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select (select jsonb_build_object('until', until, 'reason', reason) from public.business_bans
          where user_id = auth.uid() and until > now() order by until desc limit 1);
$$;

-- Historique des procédures (fondateur, ou admins « Économie »).
create or replace function public.business_procedures_list(p_business_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.businesses where id = p_business_id and founder_id = auth.uid())
     and not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Réservé au fondateur et aux admins « Économie ».' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(p) - 'business_id' order by opened_at desc)
                   from public.business_procedures p where business_id = p_business_id), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Droits
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._business_active_members()', 'public._business_pay_suppliers(numeric)',
    'public._business_notify_all(uuid, text, text, boolean)', 'public._business_restore_pending(uuid, text)',
    'public._business_open_procedure(uuid)', 'public._business_save(uuid)', 'public._business_liquidate(uuid, text)',
    'public._business_bankrupt(uuid, numeric, numeric)', 'public.businesses_check_bankruptcy()',
    'public._business_in_procedure(uuid)', 'public._guard_procedure_request()', 'public._guard_procedure_business()',
    'public._guard_business_ban()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.business_weekly_costs()', 'public.business_costs_status()', 'public.business_costs_set(numeric)',
    'public.business_weeks(boolean)', 'public.my_business_ban()', 'public.business_procedures_list(uuid)',
    'public.pay_dividends(uuid, numeric)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
