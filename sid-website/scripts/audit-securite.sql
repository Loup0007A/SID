-- Contrôle des droits de la base commune aux trois sites (Lot 96, complété au Lot 99).
-- Lancé par scripts/audit-securite.sh. Ne modifie rien : les essais se
-- font dans une transaction annulée à la fin.
--
-- Chaque problème est écrit « ÉCHEC : … » ; « ATTENTION : … » signale ce
-- qui mérite un coup d'œil sans bloquer.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
begin;

create temp table audit_resultat (niveau text, message text);
grant all on audit_resultat to anon, authenticated;

-- Listes de la migration 0120 (valeurs de 0120 si elle n'est pas lancée).
create function pg_temp.audit_ouvertes() returns text[] language plpgsql stable as $f$
begin
  if to_regprocedure('public._fonctions_sans_session()') is null then
    return array['public_config', 'glitched_members', 'site_decor', 'election_status', 'list_maintenance_flags'];
  end if;
  return public._fonctions_sans_session();
end $f$;
create function pg_temp.audit_prives() returns text[] language plpgsql stable as $f$
begin
  if to_regprocedure('public._profil_champs_prives()') is null then
    return array['first_name', 'last_name', 'age', 'weapons', 'equipment', 'description', 'desired_role',
                 'display_prefs', 'notif_muted', 'notif_push_muted', 'push_quiet_start', 'push_quiet_end'];
  end if;
  return public._profil_champs_prives();
end $f$;
insert into audit_resultat
select 'ÉCHEC', 'migration 0120 (contrôle des droits) pas encore lancée'
where to_regprocedure('public._fonctions_sans_session()') is null;

-- 1. Toute table du schéma public a ses règles d'accès (RLS).
insert into audit_resultat
select 'ÉCHEC', 'table sans RLS : ' || c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;

-- 2. Toute fonction SECURITY DEFINER fixe son search_path.
insert into audit_resultat
select 'ÉCHEC', 'fonction SECURITY DEFINER sans search_path : ' || p.oid::regprocedure
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');

-- 3. Sans session : seulement les fonctions des pages publiques et celles
-- dont les règles d'accès ont besoin (migration 0120).
insert into audit_resultat
select 'ÉCHEC', 'appelable sans session : ' || p.oid::regprocedure
  || ' (révoquer : revoke execute on function … from public, anon;)'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
  and pg_get_function_result(p.oid) not in ('trigger', 'event_trigger')
  and has_function_privilege('anon', p.oid, 'execute')
  and p.proname <> all (pg_temp.audit_ouvertes())
  and not exists (
    select 1 from pg_policy pol
    where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
          ~ ('(^|[^a-z_])' || p.proname || '\('));

-- 4. Champs privés des fiches : jamais lisibles directement.
insert into audit_resultat
select 'ÉCHEC', 'champ privé lisible par ' || r || ' : profiles.' || c
from unnest(pg_temp.audit_prives()) c, unnest(array['anon', 'authenticated']) r
where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = c)
  and has_column_privilege(r, 'public.profiles', c, 'select');
insert into audit_resultat
select 'ATTENTION', 'colonne de profiles lisible par personne (oubli de grant ?) : ' || column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name <> all (pg_temp.audit_prives())
  and not has_column_privilege('authenticated', 'public.profiles', column_name, 'select');

-- 5. Sans session, aucune table ne renvoie de lignes, sauf l'accueil public.
do $$
declare r record; v bigint;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
             and c.relname not in ('quests', 'maintenance_flags') loop
    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      set local role anon;
      execute format('select count(*) from public.%I', r.relname) into v;
      reset role;
      if v > 0 then insert into audit_resultat values ('ÉCHEC', 'lisible sans session : ' || r.relname || ' (' || v || ' lignes)'); end if;
    exception when insufficient_privilege then
      reset role;
    end;
  end loop;
  -- Quêtes : seulement les publiques.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into v from public.quests where visibility <> 'public';
  reset role;
  if v > 0 then insert into audit_resultat values ('ÉCHEC', 'quêtes non publiques lisibles sans session : ' || v); end if;
end $$;

-- 6. Essais avec un vrai membre (sans droits de gestion) et une autre fiche.
do $$
declare
  v_m uuid; v_autre uuid; v jsonb; v_avant jsonb; k text;
begin
  select p.id into v_m from public.profiles p
  where p.status = 'active' and not p.is_founder
    and not public.has_permission(p.id, 'manage_users') and not public.has_permission(p.id, 'recruit')
    and not public.has_permission(p.id, 'manage_map')
  order by p.created_at limit 1;
  select p.id into v_autre from public.profiles p where p.status = 'active' and p.id is distinct from v_m order by p.created_at limit 1;
  if v_m is null or v_autre is null then
    insert into audit_resultat values ('ATTENTION', 'essais avec un membre sautés : il faut deux fiches actives dont une sans droits de gestion');
    return;
  end if;

  update public.profiles set is_frozen = true, freeze_until = now() + interval '1 day',
         ban_until = now() + interval '1 day', mute_until = now() + interval '1 day' where id = v_m;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', v_m)::text, true);
  set local role authenticated;

  -- a) lever soi-même ses sanctions, changer un champ réservé
  foreach v in array array['{"is_frozen": false}', '{"freeze_until": null}', '{"ban_until": null}', '{"mute_until": null}', '{"sandbox_expires_at": "2099-01-01"}', '{"reputation": 99999}', '{"is_founder": true}', '{"member_rank": "S"}', '{"created_at": "2000-01-01"}']::jsonb[] loop
    k := (select x from jsonb_object_keys(v) x);
    reset role;
    select to_jsonb(p) -> k into v_avant from public.profiles p where p.id = v_m;
    set local role authenticated;
    begin
      execute format('update public.profiles set %I = %L where id = auth.uid()', k, v ->> k);
    exception when raise_exception or insufficient_privilege then null;
    end;
    reset role;
    if (select to_jsonb(p) -> k from public.profiles p where p.id = v_m) is distinct from v_avant then
      insert into audit_resultat values ('ÉCHEC', 'un membre change lui-même profiles.' || k);
    end if;
    set local role authenticated;
  end loop;

  -- b) lire les champs privés d'un autre
  begin
    execute 'select first_name from public.profiles where id = $1' using v_autre;
    insert into audit_resultat values ('ÉCHEC', 'un membre lit le prénom d''un autre directement');
  exception when insufficient_privilege then null;
  end;
  v := public.get_visible_profile(v_autre, v_autre);
  if v ? 'display_prefs' or v ? 'push_quiet_start' then
    insert into audit_resultat values ('ÉCHEC', 'get_visible_profile donne les réglages d''un autre membre');
  end if;
  begin
    perform public.profiles_full(null);
    insert into audit_resultat values ('ÉCHEC', 'profiles_full ouvert à un membre sans droits de gestion');
  exception when insufficient_privilege or raise_exception or undefined_function then null;
  end;
  reset role;

  -- c) usurper un lecteur sans session
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    v := public.get_visible_profile(v_autre, v_autre);
    if v ? 'first_name' then insert into audit_resultat values ('ÉCHEC', 'get_visible_profile : lecteur usurpable sans session'); end if;
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- 7. Fonctions de tâches planifiées : jamais appelables sans session.
insert into audit_resultat
select 'ÉCHEC', 'tâche appelable sans session : ' || p.oid::regprocedure
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname ~ '^(process_|run_scheduled|expire_)'
  and has_function_privilege('anon', p.oid, 'execute');

-- 8. Fonctions SECURITY DEFINER qui testent current_user : dans une telle
-- fonction, current_user est son propriétaire, le test ne protège rien (Lot 99).
insert into audit_resultat
select 'ÉCHEC', 'test de current_user sans effet (SECURITY DEFINER) : ' || p.oid::regprocedure
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.prosrc ~ 'current_user\s+(not\s+)?in\s*\(\s*''authenticated''';

-- 9. Essais d'intrusion (Lot 99) : conversation des autres, mission déjà
-- validée, recrutement sur une fiche active, CSS qui charge une image.
do $$
declare
  v_m uuid; v_a uuid; v_b uuid; v_q uuid; v_canal uuid := gen_random_uuid(); v_st text;
begin
  select p.id into v_m from public.profiles p
  where p.status = 'active' and not p.is_founder
    and not public.has_permission(p.id, 'manage_users') and not public.has_permission(p.id, 'manage_quests')
  order by p.created_at limit 1;
  select p.id into v_a from public.profiles p where p.status = 'active' and p.id <> v_m order by p.created_at limit 1;
  select p.id into v_b from public.profiles p where p.status = 'active' and p.id not in (v_m, v_a) order by p.created_at limit 1;
  if v_m is null or v_a is null or v_b is null then
    insert into audit_resultat values ('ATTENTION', 'essais d''intrusion sautés : il faut trois fiches actives');
    return;
  end if;
  -- La partie 6 a gelé ce membre : on le dégèle pour ces essais.
  update public.profiles set is_frozen = false, freeze_until = null, ban_until = null, mute_until = null where id = v_m;
  insert into public.chat_channels (id, type, name, created_by) values (v_canal, 'dm', 'audit', v_a);
  insert into public.chat_participants (channel_id, user_id) values (v_canal, v_a), (v_canal, v_b);
  select q.id into v_q from public.quests q where q.visibility in ('public', 'members') order by q.created_at limit 1;
  if v_q is not null then
    update public.quests set status = 'completed', min_intelligence = 0, min_strength = 0, min_technique = 0, min_power = 0,
           place_id = null, max_participants = null where id = v_q;
    delete from public.quest_participants where quest_id = v_q and user_id = v_m;
  end if;

  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', v_m)::text, true);
  set local role authenticated;
  begin
    insert into public.chat_participants (channel_id, user_id) values (v_canal, v_m);
    insert into audit_resultat values ('ÉCHEC', 'un membre rejoint une conversation privée des autres');
  exception when insufficient_privilege or raise_exception or check_violation then null;
  end;
  if v_q is not null then
    begin
      insert into public.quest_participants (quest_id, user_id, status) values (v_q, v_m, 'validated') returning status into v_st;
      insert into audit_resultat values ('ÉCHEC', 'un membre s''inscrit sur une quête close (statut ' || v_st || ')');
    exception when insufficient_privilege or raise_exception then null;
    end;
  end if;
  begin
    perform public.set_profile_css('profile', 'background: u\72l(https://exemple.invalid/x.png)');
    insert into audit_resultat values ('ÉCHEC', 'CSS de fiche : url() échappé accepté');
  exception when raise_exception then null;
  end;
  reset role;
end $$;

-- 10. Banque isolée (Lot 101) : un membre ordinaire ne dirige rien, ne lit
-- pas les tables, ne se désigne pas directeur.
do $$
declare
  v_m uuid; v_n bigint;
begin
  if to_regclass('public.banque_isolee_comptes') is null then
    insert into audit_resultat values ('ATTENTION', 'migration 0129 (banque isolée) pas encore lancée');
    return;
  end if;
  select p.id into v_m from public.profiles p
  where p.status = 'active' and not p.is_founder and p.id is distinct from public._banque_directeur_id()
  order by p.created_at limit 1;
  if v_m is null then return; end if;
  update public.profiles set is_frozen = false where id = v_m;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', v_m)::text, true);
  set local role authenticated;
  begin
    perform public.banque_isolee_designer_directeur(null);
    insert into audit_resultat values ('ÉCHEC', 'un membre peut désigner le directeur de la banque isolée');
  exception when insufficient_privilege or raise_exception then null;
  end;
  begin
    perform public.banque_isolee_donner_acces(v_m, 1000000);
    insert into audit_resultat values ('ÉCHEC', 'un membre se donne accès à la banque isolée');
  exception when insufficient_privilege or raise_exception then null;
  end;
  begin
    perform public.banque_isolee_direction();
    insert into audit_resultat values ('ÉCHEC', 'un membre lit la direction de la banque isolée');
  exception when insufficient_privilege or raise_exception then null;
  end;
  begin
    perform public.banque_isolee_verser_dus();
    insert into audit_resultat values ('ÉCHEC', 'un membre déclenche les versements de la banque isolée');
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into v_n from public.banque_isolee_retraits;
    insert into audit_resultat values ('ÉCHEC', 'un membre lit les retraits de la banque isolée');
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- 11. Lot 102 : un membre ordinaire ne règle pas les frais des entreprises,
-- ne liquide ni ne lance rien, ne lit pas les procédures ni les trajets
-- programmés des autres.
do $$
declare
  v_m uuid; v_n bigint;
begin
  if to_regprocedure('public.business_costs_set(numeric)') is null then
    insert into audit_resultat values ('ATTENTION', 'migration 0131 (faillites) pas encore lancée');
    return;
  end if;
  select p.id into v_m from public.profiles p
  where p.status = 'active' and not p.is_founder and not public.has_permission(p.id, 'manage_economy')
  order by p.created_at limit 1;
  if v_m is null then return; end if;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', v_m)::text, true);
  set local role authenticated;
  begin
    perform public.business_costs_set(0);
    insert into audit_resultat values ('ÉCHEC', 'un membre change les frais des entreprises');
  exception when insufficient_privilege or raise_exception then null;
  end;
  begin
    perform public._business_liquidate(gen_random_uuid(), 'audit');
    insert into audit_resultat values ('ÉCHEC', 'un membre appelle la liquidation judiciaire');
  exception when insufficient_privilege or undefined_function then null;
  end;
  begin
    perform public.businesses_check_bankruptcy();
    insert into audit_resultat values ('ÉCHEC', 'un membre déclenche la vérification des faillites');
  exception when insufficient_privilege or undefined_function then null;
  end;
  begin
    select count(*) into v_n from public.business_procedures;
    insert into audit_resultat values ('ÉCHEC', 'un membre lit la table des procédures');
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.quests_publish_due();
    insert into audit_resultat values ('ÉCHEC', 'un membre déclenche la publication des quêtes');
  exception when insufficient_privilege or undefined_function then null;
  end;
  if to_regclass('public.trajets_programmes') is not null then
    begin
      select count(*) into v_n from public.trajets_programmes;
      insert into audit_resultat values ('ÉCHEC', 'un membre lit la table des trajets programmés');
    exception when insufficient_privilege then null;
    end;
    begin
      execute 'select public.trajets_programmes_lancer(null)';
      insert into audit_resultat values ('ÉCHEC', 'un membre lance les trajets programmés de tous');
    exception when insufficient_privilege or undefined_function then null;
    end;
  end if;
  reset role;
end $$;

-- 12. Lot 103 : calendrier de l'avent. Un membre ordinaire ne règle rien,
-- ne distribue rien, ne lit pas les parties des autres.
do $$
declare
  v_m uuid; v_n bigint;
begin
  if to_regprocedure('public.avent_distribuer()') is null then
    insert into audit_resultat values ('ATTENTION', 'migration 0134 (calendrier de l''avent) pas encore lancée');
    return;
  end if;
  select p.id into v_m from public.profiles p
  where p.status = 'active' and not p.is_founder and not public.has_permission(p.id, 'manage_economy')
  order by p.created_at limit 1;
  if v_m is null then return; end if;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', v_m)::text, true);
  set local role authenticated;
  begin
    perform public.avent_admin();
    insert into audit_resultat values ('ÉCHEC', 'un membre ouvre l''administration de l''avent');
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.avent_recompense_save('{"rang_min":1,"rang_max":1,"zenis":1}'::jsonb);
    insert into audit_resultat values ('ÉCHEC', 'un membre crée une récompense de l''avent');
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.avent_distribuer();
    insert into audit_resultat values ('ÉCHEC', 'un membre distribue les récompenses de l''avent');
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.avent_annonces();
    insert into audit_resultat values ('ÉCHEC', 'un membre déclenche les annonces de l''avent');
  exception when insufficient_privilege or undefined_function then null;
  end;
  begin
    select count(*) into v_n from public.avent_parties;
    insert into audit_resultat values ('ÉCHEC', 'un membre lit les parties de l''avent');
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into v_n from public.avantages_temporaires;
    insert into audit_resultat values ('ÉCHEC', 'un membre lit les avantages temporaires');
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.avent_scores (edition, user_id, jour, score) values (2026, v_m, 1, 999);
    insert into audit_resultat values ('ÉCHEC', 'un membre écrit son score de l''avent');
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

select niveau || ' : ' || message from audit_resultat order by niveau desc, message;
select 'BILAN ' || count(*) filter (where niveau = 'ÉCHEC') || ' échec(s), ' || count(*) filter (where niveau = 'ATTENTION') || ' attention(s)' from audit_resultat;
rollback;
