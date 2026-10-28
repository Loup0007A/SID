-- =====================================================================
-- 0076 — Contrôle technique : fonctions internes fermées au public
-- =====================================================================
-- En PostgreSQL, toute fonction est exécutable par tout le monde tant qu'on
-- ne le retire pas. Deux fonctions INTERNES (appelées seulement par d'autres
-- fonctions) l'étaient donc aussi depuis l'API, même sans être connecté :
--
--   credit_admins_equally(montant, raison)
--       → versait n'importe quel montant aux admins (création de zénis).
--   do_validate_quest_all_participants(quête, acteur)
--       → validait et PAYAIT tous les participants d'une quête, l'« acteur »
--         étant passé en paramètre (aucun contrôle de droits).
--
-- Elles restent utilisées par les fonctions qui les appellent (impôt
-- hebdomadaire, validation groupée, quêtes expirées, bourse), qui
-- s'exécutent avec les droits de leur propriétaire : rien ne change pour
-- les membres.
--
-- Les tâches d'entretien (salaires, impôts, sanctions, quêtes expirées,
-- économie du jour) ne sont plus lançables par un visiteur non connecté ;
-- les membres connectés les déclenchent toujours en ouvrant le site.
-- =====================================================================

revoke execute on function public.credit_admins_equally(numeric, text) from public, anon, authenticated;
revoke execute on function public.do_validate_quest_all_participants(uuid, uuid) from public, anon, authenticated;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('expire_sanctions', 'process_due_salaries', 'process_expired_quests',
                        'process_weekly_taxes', 'process_daily_economy')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
