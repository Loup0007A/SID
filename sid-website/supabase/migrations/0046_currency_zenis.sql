-- =========================================================
-- Passage de la monnaie "Cr." (crédits) à "Z" (zenis) dans tout ce qui est
-- déjà en base :
--  1) les messages d'erreur et textes construits par les fonctions SQL
--     existantes (emprunt, achat d'actions, création d'entreprise,
--     notification "argent reçu", sanctions, augmentation de capital…) ;
--  2) les textes déjà enregistrés (notifications, registre des entreprises).
--
-- Plutôt que de recopier à la main chaque fonction concernée (risque
-- d'oubli ou de divergence avec la version réellement en base), on relit
-- la définition ACTUELLE de chaque fonction du schéma public qui contient
-- " Cr.", on remplace uniquement ce motif, et on la recrée telle quelle
-- (même propriétaire, même SECURITY DEFINER, même search_path).
--
-- Idempotent : une fois passée, plus aucune fonction ne contient " Cr.".
-- =========================================================

do $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosrc ~ ' Cr\.'
  loop
    execute regexp_replace(r.def, ' Cr\.', ' Z', 'g');
    v_count := v_count + 1;
  end loop;

  raise notice 'Fonctions mises à jour (Cr. -> Z) : %', v_count;
end;
$$;

-- Textes déjà stockés
update public.notifications
  set body = regexp_replace(body, ' Cr\.', ' Z', 'g')
  where body ~ ' Cr\.';

update public.business_transactions
  set reason = regexp_replace(reason, ' Cr\.', ' Z', 'g')
  where reason ~ ' Cr\.';

update public.transactions
  set reason = regexp_replace(reason, ' Cr\.', ' Z', 'g')
  where reason ~ ' Cr\.';
