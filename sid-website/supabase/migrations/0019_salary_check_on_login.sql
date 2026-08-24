-- =========================================================
-- Remplace le déclenchement par pg_cron par une vérification à la connexion :
-- plus simple, ne dépend d'aucune extension Supabase, et fonctionne sur
-- n'importe quel plan. Chaque membre, en arrivant sur son tableau de bord,
-- déclenche le versement de SON PROPRE salaire s'il est dû (SECURITY
-- DEFINER, donc il ne peut ni voir ni modifier le salaire de quelqu'un
-- d'autre).
--
-- Gère le cas où le membre ne s'est pas connecté depuis longtemps : on
-- rattrape tous les versements manqués (une itération par période échue),
-- avec une limite de sécurité pour éviter une boucle infinie en cas de
-- salaire mal configuré.
-- =========================================================

create or replace function public.check_and_pay_my_salary()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_salary public.salaries;
  v_count int := 0;
  v_safety_cap int := 500; -- ~9 ans de rattrapage max sur une fréquence quotidienne
begin
  select * into v_salary from public.salaries where user_id = auth.uid() and is_active for update;

  if v_salary.user_id is null then
    return 0;
  end if;

  while v_salary.next_payment_at <= now() and v_count < v_safety_cap loop
    update public.wallets set balance = balance + v_salary.amount where user_id = v_salary.user_id;

    insert into public.transactions (user_id, amount, reason, created_by)
    values (v_salary.user_id, v_salary.amount, 'Salaire (' || v_salary.frequency || ')', v_salary.user_id);

    v_salary.next_payment_at := v_salary.next_payment_at + public.interval_for_frequency(v_salary.frequency);
    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
    update public.salaries
      set next_payment_at = v_salary.next_payment_at, updated_at = now()
      where user_id = auth.uid();
  end if;

  return v_count;
end;
$$;

-- Nettoyage : on retire le job pg_cron créé par la migration précédente,
-- s'il a pu être activé (sinon ce bloc échoue silencieusement — rien à
-- faire dans ce cas, il n'existait pas).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('process_due_salaries_hourly')
      where exists (select 1 from cron.job where jobname = 'process_due_salaries_hourly');
  end if;
exception when others then
  null;
end;
$$;
