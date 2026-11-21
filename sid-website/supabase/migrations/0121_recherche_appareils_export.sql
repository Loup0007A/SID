-- =====================================================================
-- 0121 — Recherche commune, appareils connectés, export complet (Lot 96)
-- À lancer après 0120. Peut être relancée sans risque.
--
-- * recherche_commune(q) : une recherche pour les trois sites (membres,
--   quêtes et Comptoir du Dossier Central ; fiches du Wiki ; lieux et
--   bâtiments de la Cartographie). Mêmes règles que chaque site : fiches
--   du Wiki découvertes seulement, lieux que le membre a parcourus (sauf
--   brouillard coupé ou gestion de la carte), comptes invisibles exclus.
-- * mes_appareils() / appareil_deconnecter(id) : les sessions ouvertes du
--   compte (navigateur, date d'ouverture, dernière activité), et la
--   déconnexion de l'une d'elles. Sur Supabase, une session fermée ne peut
--   plus se renouveler : l'appareil est déconnecté dans l'heure au plus.
-- * export_my_data() : ajoute automatiquement toute table liée à un membre
--   qui n'était pas encore dans l'export (sondages, enchères, mariages,
--   exploration…) et la liste des appareils.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Recherche commune
-- ---------------------------------------------------------------------
create or replace function public.recherche_commune(p_q text)
returns jsonb
language plpgsql stable security definer set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := unaccent(lower(btrim(coalesce(p_q, ''))));
  v_like text;
  v_staff boolean;
  v_map_all boolean;
  v_out jsonb := '[]'::jsonb;
  v_part jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if length(v_q) < 2 then return v_out; end if;
  v_q := left(v_q, 60);
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_staff := coalesce(public.has_permission(v_uid, 'manage_users'), false);

  -- Membres actifs (pas les comptes invisibles, sauf soi et la gestion des comptes).
  select coalesce(jsonb_agg(x), '[]') into v_part from (
    select jsonb_build_object('site', 'main', 'kind', 'membre', 'id', p.id, 'label', p.nickname,
             'hint', 'Rang ' || coalesce(p.member_rank, '?'), 'path', '/dashboard/profile/' || p.id, 'image', p.avatar_url) as x
    from public.profiles p
    where p.status = 'active' and (not coalesce(p.is_invisible, false) or p.id = v_uid or v_staff)
      and unaccent(lower(p.nickname)) like v_like
    order by (unaccent(lower(p.nickname)) like v_q || '%') desc, p.nickname
    limit 6) s;
  v_out := v_out || v_part;

  -- Quêtes ouvertes ou en cours, visibles par ce membre.
  select coalesce(jsonb_agg(x), '[]') into v_part from (
    select jsonb_build_object('site', 'main', 'kind', 'quete', 'id', q.id, 'label', q.title,
             'hint', 'Rang ' || coalesce(q.difficulty, '?') || case when q.status = 'in_progress' then ' · en cours' else '' end,
             'path', '/dashboard/quests?quete=' || q.id) as x
    from public.quests q
    where q.status in ('open', 'in_progress')
      and (q.visibility in ('public', 'members') or q.created_by = v_uid
           or public.has_permission(v_uid, 'manage_quests') or public.is_quest_participant(q.id, v_uid))
      and unaccent(lower(q.title || ' ' || coalesce(q.giver, ''))) like v_like
    order by q.created_at desc
    limit 6) s;
  v_out := v_out || v_part;

  -- Comptoir.
  select coalesce(jsonb_agg(x), '[]') into v_part from (
    select jsonb_build_object('site', 'main', 'kind', 'objet', 'id', i.id, 'label', i.name,
             'hint', round(coalesce(case when i.sale_price is not null and (i.sale_ends_at is null or i.sale_ends_at > now()) then i.sale_price end, i.price))::text || ' z',
             'path', '/dashboard/shop?objet=' || i.id) as x
    from public.shop_items i
    where i.is_active and i.hidden_at is null and i.visibility in ('public', 'members')
      and unaccent(lower(i.name)) like v_like
    order by i.created_at desc
    limit 6) s;
  v_out := v_out || v_part;

  -- Wiki : fiches découvertes (même règle que wiki_search).
  if to_regprocedure('public.wiki_search(text,integer)') is not null and public.wiki_can_read() then
    select coalesce(jsonb_agg(x), '[]') into v_part from (
      select jsonb_build_object('site', 'wiki', 'kind', 'fiche', 'id', w.category || '/' || w.number, 'label', w.title,
               'hint', initcap(w.category) || ' n° ' || lpad(w.number::text, 3, '0'),
               'path', '/' || w.category || '/' || lpad(w.number::text, 3, '0'), 'image', w.image_url) as x
      from public.wiki_search(p_q, 6) w) s;
    v_out := v_out || v_part;
  end if;

  -- Cartographie : lieux publiés, découverts, et parcourus par ce membre.
  if to_regclass('public.map_places') is not null then
    v_map_all := coalesce(public.has_permission(v_uid, 'manage_map'), false)
                 or not coalesce((select s.fog_enabled from public.map_settings s where s.id = 1), true);
    select coalesce(jsonb_agg(x), '[]') into v_part from (
      select jsonb_build_object('site', 'map', 'kind', 'lieu', 'id', m.id, 'label', m.name,
               'hint', initcap(coalesce(m.type, 'lieu')), 'path', '/carte?lieu=' || m.id) as x
      from public.map_places m
      where m.is_published and m.discovered_at is not null
        and (v_map_all or exists (select 1 from public.exploration_visits v where v.user_id = v_uid and v.place_id = m.id))
        and unaccent(lower(m.name)) like v_like
      order by (unaccent(lower(m.name)) like v_q || '%') desc, m.name
      limit 6) s;
    v_out := v_out || v_part;

    select coalesce(jsonb_agg(x), '[]') into v_part from (
      select jsonb_build_object('site', 'map', 'kind', 'batiment', 'id', b.id, 'label', b.name,
               'hint', m.name, 'path', '/batiment/' || b.id) as x
      from public.city_buildings b
      join public.map_places m on m.id = b.city_id
      where b.name is not null and m.is_published and m.discovered_at is not null
        and (v_map_all or exists (select 1 from public.exploration_visits v where v.user_id = v_uid and v.place_id = m.id))
        and unaccent(lower(b.name)) like v_like
      order by b.name
      limit 6) s;
    v_out := v_out || v_part;
  end if;

  return v_out;
end;
$$;
-- Appelée seulement par recherche_commune_limitee.
revoke execute on function public.recherche_commune(text) from public, anon, authenticated;

-- La limite de débit écrit : elle passe par une fonction à part (la
-- recherche reste « stable »).
create or replace function public.recherche_commune_limitee(p_q text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public._limite_debit('recherche', 30, 10);
  return public.recherche_commune(p_q);
end;
$$;
revoke execute on function public.recherche_commune_limitee(text) from public, anon;
grant execute on function public.recherche_commune_limitee(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Appareils connectés
-- ---------------------------------------------------------------------
create or replace function public.mes_appareils()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_current text := nullif(auth.jwt() ->> 'session_id', '');
  v_out jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  perform public._limite_debit('appareils', 20, 60);
  if to_regclass('auth.sessions') is null then return '[]'::jsonb; end if;
  execute $q$
    select coalesce(jsonb_agg(x order by x->>'activite' desc), '[]'::jsonb) from (
      select jsonb_build_object(
               'id', s.id,
               'debut', s.created_at,
               'activite', coalesce(to_jsonb(s)->>'refreshed_at', s.updated_at::text, s.created_at::text),
               'appareil', left(coalesce(to_jsonb(s)->>'user_agent', ''), 300),
               'actuel', s.id::text = $2) as x
      from auth.sessions s
      where s.user_id = $1 and (to_jsonb(s)->>'not_after' is null or (to_jsonb(s)->>'not_after')::timestamptz > now())
    ) t
  $q$ into v_out using v_uid, coalesce(v_current, '');
  return v_out;
end;
$$;
revoke execute on function public.mes_appareils() from public, anon;
grant execute on function public.mes_appareils() to authenticated;

create or replace function public.appareil_deconnecter(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  perform public._limite_debit('appareils', 20, 60);
  if p_id is null then raise exception 'Appareil manquant.'; end if;
  if p_id::text = coalesce(auth.jwt() ->> 'session_id', '') then
    raise exception 'C''est cet appareil : utilise « Se déconnecter ».';
  end if;
  if to_regclass('auth.sessions') is null then return jsonb_build_object('ok', false); end if;
  execute 'delete from auth.sessions where id = $1 and user_id = $2' using p_id, v_uid;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform public.write_audit('session_revoked', v_uid, jsonb_build_object('session', p_id));
  end if;
  return jsonb_build_object('ok', v_n > 0);
end;
$$;
revoke execute on function public.appareil_deconnecter(uuid) from public, anon;
grant execute on function public.appareil_deconnecter(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Export : tout ce qui est lié au compte
-- ---------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
  v_part jsonb;
  v_done text[] := '{}';
  v_secrets text[] := array['token_hash', 'endpoint', 'auth', 'p256dh', 'secret', 'password', 'encrypted_password'];
  r record;
begin
  if v_uid is null then
    raise exception 'Non connecté.';
  end if;
  perform public._limite_debit('export', 5, 600);

  v_out := jsonb_build_object(
    'export', jsonb_build_object('date', now(), 'format', 'JSON', 'note', 'Toutes les données liées à ton compte sur le S.I.D. (Dossier Central, Cartographie, Wiki).'),
    'compte', jsonb_build_object('email', (select email from auth.users where id = v_uid)),
    'dossier', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'actions_d_administration_te_concernant', coalesce((
      select jsonb_agg(jsonb_build_object('date', a.created_at, 'action', a.action, 'par', a.actor_nickname, 'details', a.details) order by a.created_at)
      from public.audit_log a where a.target_user_id = v_uid), '[]'::jsonb),
    'abonnements_push', (select count(*) from public.push_subscriptions ps where ps.user_id = v_uid)
  );

  begin
    v_out := v_out || jsonb_build_object('appareils_connectes',
      (select coalesce(jsonb_agg(a - 'id' - 'actuel'), '[]'::jsonb) from jsonb_array_elements(public.mes_appareils()) a));
  exception when others then null;
  end;

  -- 1) Les rubriques nommées (comme avant), 2) toute autre table qui a une
  -- colonne liée à un membre (clé étrangère vers profiles ou auth.users).
  for r in
    select k, tbl, col from (values
      ('portefeuille', 'public.wallets', 'user_id'),
      ('compte_bancaire', 'public.bank_accounts', 'user_id'),
      ('transactions', 'public.transactions', 'user_id'),
      ('achats', 'public.purchases', 'user_id'),
      ('objets_consommables', 'public.member_consumables', 'user_id'),
      ('quetes_creees', 'public.quests', 'created_by'),
      ('participations_aux_quetes', 'public.quest_participants', 'user_id'),
      ('messages_envoyes', 'public.chat_messages', 'sender_id'),
      ('salons', 'public.chat_participants', 'user_id'),
      ('notifications', 'public.notifications', 'user_id'),
      ('visites_par_jour', 'public.activity_log', 'user_id'),
      ('caracteristiques', 'public.member_stats', 'user_id'),
      ('competences', 'public.member_skills', 'user_id'),
      ('simulations', 'public.simulation_runs', 'user_id'),
      ('progression_des_simulations', 'public.simulation_progress', 'user_id'),
      ('blessures', 'public.simulation_injuries', 'user_id'),
      ('arbre_technologique', 'public.tech_purchases', 'user_id'),
      ('sanctions', 'public.sanctions', 'user_id'),
      ('historique_puissance', 'public.power_score_log', 'user_id'),
      ('apparence_personnalisee', 'public.profile_styles', 'user_id'),
      ('raids', 'public.boss_raid_members', 'user_id'),
      ('entreprises_fondees', 'public.businesses', 'founder_id'),
      ('actions_d_entreprises', 'public.business_shareholders', 'user_id'),
      ('emplois', 'public.business_employees', 'user_id'),
      ('roles', 'public.user_roles', 'user_id'),
      ('groupes', 'public.group_members', 'user_id'),
      ('role_espion', 'public.spy_roles', 'user_id'),
      ('rapports_d_espion', 'public.spy_reports', 'spy_id'),
      ('compte_de_test', 'public.sandbox_accounts', 'user_id'),
      ('demandes_donnees', 'public.privacy_requests', 'user_id'),
      ('carte_position', 'public.character_positions', 'user_id'),
      ('carte_commentaires', 'public.map_comments', 'user_id'),
      ('carte_locations_de_montures', 'public.mount_rental_log', 'user_id'),
      ('carte_marche_noir_achats', 'public.black_market_sales', 'buyer_id'),
      ('carte_marche_noir_ventes', 'public.black_market_sales', 'seller_id'),
      ('wiki_commentaires', 'public.wiki_comments', 'author_id'),
      ('wiki_favoris', 'public.wiki_favorites', 'user_id'),
      ('wiki_notes_personnelles', 'public.wiki_notes', 'user_id'),
      ('wiki_signalements', 'public.wiki_reports', 'author_id'),
      ('titres', 'public.user_titles', 'user_id'),
      ('progression_des_titres', 'public.title_progress', 'user_id'),
      ('anniversaire', 'public.member_birthdays', 'user_id'),
      ('cadeaux_d_anniversaire_offerts', 'public.birthday_gifts', 'giver_id'),
      ('cadeaux_d_anniversaire_recus', 'public.birthday_gifts', 'receiver_id'),
      ('farces_lancees', 'public.troll_actions', 'actor_id'),
      ('farces_subies', 'public.troll_actions', 'target_id'),
      ('reponses_aux_farces', 'public.troll_responses', 'user_id'),
      ('presence_en_ligne', 'public.presence', 'user_id')
    ) as t(k, tbl, col)
    union all
    select * from (
      select distinct c.relname || '.' || a.attname, 'public.' || quote_ident(c.relname), a.attname::text
      from pg_constraint fk
      join pg_class c on c.oid = fk.conrelid
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      join pg_attribute a on a.attrelid = c.oid and a.attnum = fk.conkey[1]
      where fk.contype = 'f' and array_length(fk.conkey, 1) = 1
        and fk.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
        -- (activity_alerts : outil interne de la modération)
        and c.relname not in ('profiles', 'push_subscriptions', 'audit_log', 'limites_debit', 'sandbox_accounts', 'activity_alerts')
      order by 1
    ) auto
  loop
    if r.tbl || '.' || r.col = any (v_done) then continue; end if;
    if to_regclass(r.tbl) is not null and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = replace(split_part(r.tbl, '.', 2), '"', '') and c.column_name = r.col
    ) then
      execute format(
        -- (alias peu probable comme nom de colonne : city_buildings a une colonne x)
        'select coalesce(jsonb_agg(to_jsonb(_ligne_) - $2), ''[]''::jsonb) from %s _ligne_ where _ligne_.%I = $1',
        r.tbl, r.col) into v_part using v_uid, v_secrets;
      v_done := v_done || (r.tbl || '.' || r.col);
      if v_part <> '[]'::jsonb or r.k not like '%.%' then
        v_out := v_out || jsonb_build_object(r.k, v_part);
      end if;
    end if;
  end loop;

  return v_out;
end;
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
