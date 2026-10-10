-- =========================================================
-- Monnaie : "Cr." (crédits) et "Z" (version majuscule de 0046) deviennent
-- "z" (zenis, en minuscule) dans tout ce qui est déjà en base :
--  1) messages d'erreur et textes construits par les fonctions SQL ;
--  2) textes déjà enregistrés (notifications, registres).
--
-- Remplace UNIQUEMENT les motifs de monnaie : " Cr." partout, et un " Z"
-- isolé précédé d'un chiffre, d'un %, d'une apostrophe ou d'une
-- parenthèse fermante (jamais "Zone", "UTC", etc.). Les définitions sont
-- relues telles qu'elles sont en base puis recréées à l'identique (même
-- SECURITY DEFINER, même search_path).
--
-- Idempotent : peut être rejouée sans effet supplémentaire.
-- =========================================================

do $$
declare
  r record;
  v_def text;
  v_count int := 0;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (p.prosrc ~ ' Cr\.' or p.prosrc ~ '[%0-9'')] Z([^A-Za-zÀ-ÿ0-9_]|$)')
  loop
    v_def := regexp_replace(r.def, ' Cr\.', ' z', 'g');
    v_def := regexp_replace(v_def, '([%0-9'')]) Z([^A-Za-zÀ-ÿ0-9_]|$)', '\1 z\2', 'g');
    execute v_def;
    v_count := v_count + 1;
  end loop;

  raise notice 'Fonctions mises à jour (-> z) : %', v_count;
end;
$$;

update public.notifications
  set body = regexp_replace(regexp_replace(body, ' Cr\.', ' z', 'g'), '([0-9]) Z([^A-Za-z0-9_]|$)', '\1 z\2', 'g')
  where body ~ ' Cr\.' or body ~ '[0-9] Z([^A-Za-z0-9_]|$)';

update public.business_transactions
  set reason = regexp_replace(regexp_replace(reason, ' Cr\.', ' z', 'g'), '([0-9]) Z([^A-Za-z0-9_]|$)', '\1 z\2', 'g')
  where reason ~ ' Cr\.' or reason ~ '[0-9] Z([^A-Za-z0-9_]|$)';

update public.transactions
  set reason = regexp_replace(regexp_replace(reason, ' Cr\.', ' z', 'g'), '([0-9]) Z([^A-Za-z0-9_]|$)', '\1 z\2', 'g')
  where reason ~ ' Cr\.' or reason ~ '[0-9] Z([^A-Za-z0-9_]|$)';
