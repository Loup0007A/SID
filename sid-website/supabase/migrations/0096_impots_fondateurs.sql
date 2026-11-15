-- =====================================================================
-- 0096 — Lot 79 : la part admin de la caisse commune va aux fondateurs
-- =====================================================================
-- Rejouable.
--
-- Avant : la part admin de la caisse commune (80 % chaque semaine) et la part
-- admin des frais de courtage allaient à tout compte actif ayant « Gérer les
-- comptes », modérateurs et comptes de test compris.
--
-- Maintenant : aux seuls fondateurs, c'est-à-dire les comptes actifs qui ont
-- le grade Fondateur (rôle « Fondateur ») ou le statut fondateur
-- (profiles.is_founder). Jamais un compte de test (bac à sable).
--
-- Ce qui n'est pas versé reste dans la caisse : arrondis, part admin sans
-- fondateur actif, part entreprises sans entreprise ouverte. Avant, la caisse
-- était remise à zéro et ces montants disparaissaient.
-- =====================================================================

-- Fondateurs qui touchent la part admin.
create or replace function public._tax_founders()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.status = 'active'
    and not exists (select 1 from public.sandbox_accounts s where s.user_id = p.id)
    and (p.is_founder
         or exists (select 1 from public.user_roles ur
                    join public.roles r on r.id = ur.role_id
                    where ur.user_id = p.id and r.name = 'Fondateur'))
  order by p.id;
$$;
revoke execute on function public._tax_founders() from public, anon, authenticated;

-- Reversement hebdomadaire de la caisse commune (reprise de 0084).
create or replace function public.process_weekly_taxes()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pool public.tax_pool;
  v_weeks int;
  v_founders uuid[];
  v_businesses uuid[];
  v_each numeric(18, 2);
  v_out numeric(18, 2) := 0;
  u uuid;
  r record;
begin
  select * into v_pool from public.tax_pool where id = true for update;
  if v_pool.id is null then
    insert into public.tax_pool (id) values (true) returning * into v_pool;
  end if;

  v_weeks := floor(extract(epoch from (now() - v_pool.last_distributed_at)) / 604800)::int;
  if v_weeks < 1 then return; end if;

  -- Un seul avis par passage, même après une longue absence.
  perform public._tax_issue_bills(greatest(v_pool.last_distributed_at, now() - interval '7 days'), now());

  select balance into v_pool.balance from public.tax_pool where id = true;

  if v_pool.balance > 0 then
    -- Part admin : aux fondateurs, à parts égales (au centime inférieur).
    v_founders := array(select public._tax_founders());
    if cardinality(v_founders) > 0 then
      v_each := floor(v_pool.balance * public.get_config_numeric('tax_admin_share', 0.8) / cardinality(v_founders) * 100) / 100;
      if v_each > 0 then
        foreach u in array v_founders loop
          update public.wallets set balance = balance + v_each where user_id = u;
          insert into public.transactions (user_id, amount, reason, created_by)
          values (u, v_each, 'Reversement des impôts/TVA (part admin)', u);
        end loop;
        v_out := v_out + v_each * cardinality(v_founders);
      end if;
    end if;

    -- Part entreprises : aux entreprises ouvertes, à parts égales.
    v_businesses := array(select id from public.businesses where not is_closed order by id);
    if cardinality(v_businesses) > 0 then
      v_each := floor(v_pool.balance * public.get_config_numeric('tax_business_share', 0.2) / cardinality(v_businesses) * 100) / 100;
      if v_each > 0 then
        for r in select id, founder_id from public.businesses where id = any (v_businesses) loop
          update public.businesses set treasury_balance = treasury_balance + v_each where id = r.id;
          insert into public.business_transactions (business_id, amount, reason, created_by)
          values (r.id, v_each, 'Reversement des impôts/TVA', r.founder_id);
        end loop;
        v_out := v_out + v_each * cardinality(v_businesses);
      end if;
    end if;
  end if;

  update public.tax_pool
    set balance = balance - v_out,
        last_distributed_at = last_distributed_at + (v_weeks || ' weeks')::interval
    where id = true;
end;
$$;

-- Part admin des frais de courtage (reprise de 0038) : aux fondateurs.
-- Sans fondateur actif, et pour les centimes d'arrondi : la caisse commune.
create or replace function public.credit_admins_equally(p_amount numeric, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_founders uuid[];
  v_each numeric(18, 2) := 0;
  u uuid;
begin
  if p_amount is null or p_amount <= 0 then
    return;
  end if;

  v_founders := array(select public._tax_founders());
  if cardinality(v_founders) > 0 then
    v_each := floor(p_amount / cardinality(v_founders) * 100) / 100;
  end if;

  if v_each > 0 then
    foreach u in array v_founders loop
      update public.wallets set balance = balance + v_each where user_id = u;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (u, v_each, p_reason, u);
    end loop;
  end if;

  if p_amount - v_each * coalesce(cardinality(v_founders), 0) > 0 then
    update public.tax_pool
      set balance = balance + (p_amount - v_each * coalesce(cardinality(v_founders), 0))
      where id = true;
  end if;
end;
$$;
revoke execute on function public.credit_admins_equally(numeric, text) from public, anon, authenticated;

-- État de la caisse (reprise de 0035) : avec la répartition et les fondateurs.
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
    'weekly_wealth_tax_rate', public.get_config_numeric('weekly_wealth_tax_rate', 0.02),
    'admin_share', public.get_config_numeric('tax_admin_share', 0.8),
    'business_share', public.get_config_numeric('tax_business_share', 0.2),
    'founders', coalesce((select jsonb_agg(p.nickname order by p.nickname)
                          from public.profiles p where p.id in (select public._tax_founders())), '[]'::jsonb),
    'open_businesses', (select count(*) from public.businesses where not is_closed)
  );
end;
$$;

notify pgrst, 'reload schema';
