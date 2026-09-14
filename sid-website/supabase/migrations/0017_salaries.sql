-- =========================================================
-- Salaires récurrents : un membre avec la permission manage_economy peut
-- attribuer à quelqu'un un salaire versé automatiquement à intervalle
-- régulier (montant par défaut : 2500 Cr.).
-- =========================================================

create table public.salaries (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null default 2500,
  frequency text not null default 'weekly'
    check (frequency in ('daily', 'weekly', 'biweekly', 'monthly')),
  is_active boolean not null default true,
  next_payment_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.salaries enable row level security;

create policy "salaries_select" on public.salaries for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

create policy "salaries_manage" on public.salaries for all
  using (public.has_permission(auth.uid(), 'manage_economy'))
  with check (public.has_permission(auth.uid(), 'manage_economy'));

create or replace function public.interval_for_frequency(p_freq text)
returns interval
language sql
immutable
as $$
  select case p_freq
    when 'daily' then interval '1 day'
    when 'weekly' then interval '7 days'
    when 'biweekly' then interval '14 days'
    when 'monthly' then interval '1 month'
    else interval '7 days'
  end;
$$;

-- Attribue ou met à jour le salaire d'un membre (défaut 2500 Cr / semaine).
create or replace function public.set_salary(p_user_id uuid, p_amount numeric default 2500, p_frequency text default 'weekly')
returns public.salaries
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.salaries;
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Permission refusée';
  end if;

  insert into public.salaries (user_id, amount, frequency, is_active, next_payment_at, created_by, updated_at)
  values (p_user_id, p_amount, p_frequency, true, now() + public.interval_for_frequency(p_frequency), auth.uid(), now())
  on conflict (user_id) do update
    set amount = excluded.amount,
        frequency = excluded.frequency,
        is_active = true,
        created_by = excluded.created_by,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.stop_salary(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Permission refusée';
  end if;

  update public.salaries set is_active = false, updated_at = now() where user_id = p_user_id;
end;
$$;

-- Verse tous les salaires arrivés à échéance. Pas de vérification de
-- permission ici : cette fonction est pensée pour être appelée par un
-- déclencheur planifié (pg_cron) qui s'exécute hors contexte utilisateur
-- (auth.uid() y est NULL). L'exécution directe est retirée du rôle public
-- juste en dessous ; seule pay_salaries_now() (avec vérification de
-- permission) reste accessible depuis le site.
create or replace function public.process_due_salaries()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in select * from public.salaries where is_active and next_payment_at <= now() loop
    update public.wallets set balance = balance + r.amount where user_id = r.user_id;

    insert into public.transactions (user_id, amount, reason, created_by)
    values (r.user_id, r.amount, 'Salaire (' || r.frequency || ')', r.user_id);

    update public.salaries
      set next_payment_at = next_payment_at + public.interval_for_frequency(r.frequency),
          updated_at = now()
      where user_id = r.user_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.process_due_salaries() from public;

-- Déclenchement manuel depuis le dashboard admin ("Verser les salaires dus
-- maintenant"), pour les projets où pg_cron n'est pas activé.
create or replace function public.pay_salaries_now()
returns int
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Permission refusée';
  end if;

  return public.process_due_salaries();
end;
$$;

-- Tentative d'activation d'un job planifié horaire via pg_cron, si
-- l'extension est disponible sur ce projet Supabase (plans payants /
-- activée manuellement dans Database → Extensions). Si l'extension n'est
-- pas disponible, ce bloc échoue silencieusement : le bouton "Verser les
-- salaires dus maintenant" du dashboard admin reste le filet de sécurité.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule('process_due_salaries_hourly')
      where exists (select 1 from cron.job where jobname = 'process_due_salaries_hourly');
    perform cron.schedule('process_due_salaries_hourly', '0 * * * *', 'select public.process_due_salaries();');
  end if;
exception when others then
  raise notice 'pg_cron indisponible sur ce projet : utilisez le bouton "Verser les salaires dus maintenant" (dashboard admin) à la place.';
end;
$$;

-- Liste les salaires avec le pseudo du membre, pour l'écran admin.
create or replace function public.list_salaries()
returns table (
  user_id uuid,
  nickname text,
  amount numeric,
  frequency text,
  is_active boolean,
  next_payment_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select s.user_id, p.nickname, s.amount, s.frequency, s.is_active, s.next_payment_at
  from public.salaries s
  join public.profiles p on p.id = s.user_id
  where public.has_permission(auth.uid(), 'manage_economy')
  order by p.nickname;
$$;
