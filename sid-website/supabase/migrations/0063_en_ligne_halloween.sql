-- =========================================================
-- Lot 37 : membres en ligne (avec leur activité) et décor saisonnier
-- (Halloween), à lancer après 0062.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Confidentialité : chacun choisit s'il apparaît en ligne et si son
--    activité (la page où il se trouve) est montrée.
-- ---------------------------------------------------------
alter table public.profiles add column if not exists presence_visible boolean not null default true;
alter table public.profiles add column if not exists activity_visible boolean not null default true;

create or replace function public.set_presence_privacy(p_visible boolean, p_activity boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté.';
  end if;
  update public.profiles
     set presence_visible = coalesce(p_visible, presence_visible),
         activity_visible = coalesce(p_activity, activity_visible)
   where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------
-- 2) Présence : une ligne par membre, remplacée à chaque signal (pas
--    d'historique), effacée au bout d'un jour.
-- ---------------------------------------------------------
create table if not exists public.presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  page text not null default '/dashboard',
  extra text,
  idle boolean not null default false,
  online_since timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  left_at timestamptz
);
alter table public.presence enable row level security;
-- Aucune policy : lecture et écriture seulement par les fonctions ci-dessous.

-- Délai sans signal au-delà duquel un membre n'est plus « en ligne »
-- (app_config : presence_ttl_seconds, 180 par défaut).
create or replace function public._presence_ttl()
returns interval
language sql
stable
security definer set search_path = public
as $$
  select make_interval(secs => greatest(60, least(900, public.get_config_numeric('presence_ttl_seconds', 180)::int)));
$$;

-- Signal envoyé par le site : la page en cours (identifiants retirés),
-- éventuellement « en jeu » / « dans l'arène », et si le membre est absent.
create or replace function public.presence_ping(p_page text, p_extra text default null, p_idle boolean default false)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_page text;
  v_extra text;
begin
  if v_uid is null then
    return;
  end if;
  v_page := split_part(split_part(coalesce(p_page, '/dashboard'), '?', 1), '#', 1);
  v_page := regexp_replace(v_page, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', ':id', 'g');
  v_page := regexp_replace(v_page, '/+$', '');
  if v_page = '' or length(v_page) > 120 or v_page !~ '^/dashboard(/[A-Za-z0-9_:.-]+)*$' then
    v_page := '/dashboard';
  end if;
  v_extra := case when p_extra in ('jeu', 'arene_dragon', 'arene_joueur', 'arene_tribune') then p_extra end;

  insert into public.presence as pr (user_id, page, extra, idle, online_since, updated_at, left_at)
  values (v_uid, v_page, v_extra, coalesce(p_idle, false), now(), now(), null)
  on conflict (user_id) do update set
    page = excluded.page,
    extra = excluded.extra,
    idle = excluded.idle,
    online_since = case when coalesce(pr.left_at, pr.updated_at) < now() - public._presence_ttl() then now() else pr.online_since end,
    updated_at = now(),
    left_at = null;

  delete from public.presence where updated_at < now() - interval '1 day';
end;
$$;

-- Le membre ferme l'onglet ou se déconnecte.
create or replace function public.presence_leave()
returns void
language sql
security definer set search_path = public
as $$
  update public.presence set left_at = now() where user_id = auth.uid();
$$;

-- Qui est en ligne. Les autres membres ne voient pas les comptes invisibles
-- ni ceux qui ont choisi de ne pas apparaître ; l'activité masquée n'est
-- pas envoyée. L'administration (gestion des comptes) voit tout, avec la
-- mention de ce qui est masqué aux autres.
create or replace function public.list_online()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_out jsonb;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    return '[]'::jsonb;
  end if;
  v_admin := public.has_permission(v_uid, 'manage_users') and not public.is_sandbox_account(v_uid);

  select coalesce(jsonb_agg(s.row order by s.me desc, s.idle, s.since), '[]'::jsonb) into v_out
  from (
    select
      p.id = v_uid as me,
      pr.idle,
      pr.online_since as since,
      jsonb_build_object(
        'id', p.id,
        'nickname', p.nickname,
        'avatar_url', p.avatar_url,
        'page', case when p.id = v_uid or v_admin or p.activity_visible then
                  case when not v_admin and pr.page like '/dashboard/admin%' then '/dashboard/admin' else pr.page end
                end,
        'extra', case when p.id = v_uid or v_admin or p.activity_visible then pr.extra end,
        'idle', pr.idle,
        'since', pr.online_since,
        'masked', not p.activity_visible,
        'hidden', not p.presence_visible or coalesce(p.is_invisible, false),
        'me', p.id = v_uid
      ) as row
    from public.presence pr
    join public.profiles p on p.id = pr.user_id
    where pr.updated_at > now() - public._presence_ttl()
      and pr.left_at is null
      and p.status = 'active'
      and (p.id = v_uid or v_admin or (p.presence_visible and not coalesce(p.is_invisible, false)))
  ) s;
  return v_out;
end;
$$;

-- ---------------------------------------------------------
-- 3) Décor saisonnier : Halloween. app_config.decor_halloween =
--    'auto' (du 15 octobre au 2 novembre, heure de Paris), 'on' ou 'off'.
-- ---------------------------------------------------------
insert into public.app_config (key, value) values ('decor_halloween', 'auto') on conflict (key) do nothing;

create or replace function public.site_decor()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  with c as (
    select coalesce((select value from public.app_config where key = 'decor_halloween'), 'auto') as mode,
           (now() at time zone public.stats_timezone())::date as today
  )
  select jsonb_build_object(
    'halloween', case c.mode
                   when 'on' then true
                   when 'off' then false
                   else (extract(month from c.today) = 10 and extract(day from c.today) >= 15)
                     or (extract(month from c.today) = 11 and extract(day from c.today) <= 2)
                 end,
    'halloween_mode', c.mode)
  from c;
$$;

create or replace function public.set_site_decor(p_decor text, p_mode text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if p_decor is distinct from 'halloween' then
    raise exception 'Décor inconnu.';
  end if;
  if p_mode not in ('auto', 'on', 'off') then
    raise exception 'Réglage inconnu.';
  end if;
  insert into public.app_config (key, value) values ('decor_halloween', p_mode)
  on conflict (key) do update set value = excluded.value;
  perform public.write_audit('decor_changed', null, jsonb_build_object('decor', p_decor, 'mode', p_mode));
  return public.site_decor();
end;
$$;

grant execute on function public.site_decor() to anon, authenticated;
grant execute on function public.list_online() to authenticated;
grant execute on function public.presence_ping(text, text, boolean) to authenticated;
grant execute on function public.presence_leave() to authenticated;
grant execute on function public.set_presence_privacy(boolean, boolean) to authenticated;
grant execute on function public.set_site_decor(text, text) to authenticated;
revoke execute on function public._presence_ttl() from public, anon, authenticated;

-- ---------------------------------------------------------
-- 4) Mes données : la présence fait partie de l'export (copie de 0061).
-- ---------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
  v_part jsonb;
  r record;
begin
  if v_uid is null then
    raise exception 'Non connecté.';
  end if;

  v_out := jsonb_build_object(
    'export', jsonb_build_object('date', now(), 'format', 'JSON', 'note', 'Toutes les données liées à ton compte sur le S.I.D. (Dossier Central, Cartographie, Wiki).'),
    'compte', jsonb_build_object('email', (select email from auth.users where id = v_uid)),
    'dossier', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'actions_d_administration_te_concernant', coalesce((
      select jsonb_agg(jsonb_build_object('date', a.created_at, 'action', a.action, 'par', a.actor_nickname, 'details', a.details) order by a.created_at)
      from public.audit_log a where a.target_user_id = v_uid), '[]'::jsonb),
    'abonnements_push', (select count(*) from public.push_subscriptions ps where ps.user_id = v_uid)
  );

  for r in
    select * from (values
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
  loop
    if to_regclass(r.tbl) is not null and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = split_part(r.tbl, '.', 2) and c.column_name = r.col
    ) then
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(x) - array[''token_hash'', ''endpoint'', ''auth'', ''p256dh'']), ''[]''::jsonb) from %s x where x.%I = $1',
        r.tbl, r.col) into v_part using v_uid;
      v_out := v_out || jsonb_build_object(r.k, v_part);
    end if;
  end loop;

  return v_out;
end;
$$;
