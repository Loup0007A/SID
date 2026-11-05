-- =====================================================================
-- Lot 66. Rejouable.
--
-- 1. Notifications : les petites rentrées d'argent d'une même journée sont
--    regroupées en une seule notification (avec le détail de chaque ligne) ;
--    un seul push, pour la première. Les remboursements et ventes
--    d'enchères n'envoient plus « Argent reçu » en double. Une notification
--    disparaît 7 jours après le premier passage du membre sur le site
--    (un membre absent garde les siennes jusqu'à son retour ; 90 jours au
--    plus).
-- 2. Tâches planifiées : run_scheduled_jobs() (sondages programmés, rappels
--    de fin d'enchère, clôtures, nettoyage). Lancée par pg_cron chaque
--    minute s'il est disponible, sinon par les visites du site
--    (maybe_run_jobs, au plus une fois par minute).
-- 3. Alertes d'activité : « Normal pour ce membre » crée une exception ;
--    les alertes du même genre pour ce membre sont ensuite classées toutes
--    seules (onglet « Ignorées ») sans prévenir personne.
-- 4. Boutique : liste de souhaits (prévient quand l'objet revient en stock
--    ou passe aux enchères) et cadeaux (on paie, l'autre reçoit l'objet).
-- 5. Sondages programmés (date de publication).
-- 6. Enchères : rappel aux enchérisseurs 10 minutes avant la fin.
-- 7. Statistiques admin supplémentaires.
-- 8. Mariages : demande, réponse, registre des unions, félicitations.
--    Page réservée aux admins tant qu'elle n'est pas dévoilée depuis
--    Modération (app_config.wedding_public).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nouveaux types de notification : gift, wishlist, wedding
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
  v_types text[];
  t text;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'notifications_type_check';
  if v_def is null then return; end if;
  if v_def ~ '\{' then
    v_types := string_to_array(substring(v_def from '\{([^}]*)\}'), ',');
  else
    select array_agg(m[1]) into v_types from regexp_matches(v_def, '''([a-z_]+)''', 'g') as m;
  end if;
  if v_types is null or cardinality(v_types) < 5 then
    raise exception 'Liste des types de notification illisible (%), migration arrêtée par prudence.', v_def;
  end if;
  if 'gift' = any (v_types) and 'wishlist' = any (v_types) and 'wedding' = any (v_types) then return; end if;
  foreach t in array array['gift', 'wishlist', 'wedding'] loop
    if not t = any (v_types) then v_types := array_append(v_types, t); end if;
  end loop;
  alter table public.notifications drop constraint notifications_type_check;
  execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_types);
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Notifications regroupées, détail, durée de vie
-- ---------------------------------------------------------------------
alter table public.notifications add column if not exists group_key text;
alter table public.notifications add column if not exists details jsonb;
alter table public.notifications add column if not exists amount numeric(18, 2);
alter table public.notifications add column if not exists seen_at timestamptz;
create index if not exists notifications_group_idx on public.notifications (user_id, type, group_key)
  where group_key is not null and not is_read;
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- Ajoute une ligne à la notification du jour de ce groupe (non lue), ou en
-- crée une. Le détail garde les 100 dernières lignes.
create or replace function public._notify_grouped(
  p_user uuid,
  p_type text,
  p_key text,
  p_title text,
  p_line text,
  p_amount numeric default null,
  p_unit text default 'notifications',
  p_link text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_tz text := public.stats_timezone();
  v_row public.notifications;
  v_item jsonb := jsonb_strip_nulls(jsonb_build_object('at', now(), 'text', p_line, 'amount', p_amount));
  v_details jsonb;
  v_total numeric;
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then return; end if;

  select * into v_row from public.notifications
  where user_id = p_user and type = p_type and group_key = p_key and not is_read
    and (created_at at time zone v_tz)::date = (now() at time zone v_tz)::date
  order by created_at desc
  limit 1
  for update;

  if v_row.id is null then
    insert into public.notifications (user_id, type, title, body, link, group_key, details, amount)
    values (p_user, p_type, p_title, p_line, p_link, p_key, jsonb_build_array(v_item), p_amount);
    return;
  end if;

  v_details := coalesce(v_row.details, '[]'::jsonb);
  if jsonb_array_length(v_details) >= 100 then v_details := v_details - 0; end if;
  v_total := case when p_amount is null and v_row.amount is null then null
                  else coalesce(v_row.amount, 0) + coalesce(p_amount, 0) end;

  update public.notifications
  set count = v_row.count + 1,
      amount = v_total,
      details = v_details || jsonb_build_array(v_item),
      body = (v_row.count + 1) || ' ' || p_unit
             || case when coalesce(v_total, 0) <> 0 then ' · ' || public._fmt_z(v_total, true) || ' z' else '' end,
      updated_at = now()
  where id = v_row.id;
end;
$$;

-- Argent reçu : salaires et grosses sommes à part, petites rentrées
-- regroupées par jour. Rien pour les mouvements de la salle des ventes
-- (sa propre notification les annonce déjà).
create or replace function public.notify_money_received()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_line text;
begin
  if new.amount <= 0 then return new; end if;
  if new.reason like 'Retrait bancaire%' or new.reason like 'Dépôt en banque%' then return new; end if;
  if new.reason like 'Enchère %' or new.reason like 'Vente aux enchères%' then return new; end if;

  v_line := '+' || public._fmt_z(new.amount) || ' z — ' || coalesce(new.reason, 'Crédit');
  if new.reason like 'Salaire%' then
    insert into public.notifications (user_id, type, title, body) values (new.user_id, 'salary_paid', 'Salaire versé', v_line);
  elsif new.amount >= public.get_config_numeric('notif_group_threshold', 500) then
    insert into public.notifications (user_id, type, title, body) values (new.user_id, 'money_received', 'Argent reçu', v_line);
  else
    perform public._notify_grouped(new.user_id, 'money_received', 'petites-rentrees', 'Argent reçu', v_line, new.amount, 'rentrées', null);
  end if;
  return new;
end;
$$;

-- Push : rien quand une notification regroupée s'allonge (le premier
-- élément du groupe a déjà sonné).
create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_site_url text;
  v_secret text;
  v_body text := new.body;
begin
  if tg_op = 'UPDATE' then
    if new.group_key is not null then
      return new;
    end if;
    if not (coalesce(new.count, 1) > coalesce(old.count, 1) or (old.is_read and not new.is_read)) then
      return new;
    end if;
    if coalesce(new.count, 1) > 1 then
      v_body := new.count || ' nouveaux messages · ' || coalesce(new.body, '');
    end if;
  end if;

  select value into v_site_url from public.app_config where key = 'site_url';
  select value into v_secret from public.app_config where key = 'push_webhook_secret';
  if v_site_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(v_site_url, '/') || '/api/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'title', new.title,
      'body', v_body,
      'link', new.link,
      'tag', case when new.type = 'chat_message' then 'chat:' || coalesce(new.link, '') else new.type end
    )
  );
  return new;
exception when others then
  return new;
end;
$$;

-- Durée de vie : 7 jours à partir du premier passage du membre après la
-- notification (ou de sa lecture). Plafond de 90 jours.
create or replace function public.notifications_cleanup()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  n int;
begin
  update public.notifications nt
  set seen_at = now()
  from public.profiles p
  where p.id = nt.user_id
    and nt.seen_at is null
    and (nt.is_read or p.last_seen_at > nt.created_at);

  delete from public.notifications where seen_at < now() - interval '7 days';
  get diagnostics n = row_count;
  delete from public.notifications where created_at < now() - interval '90 days';
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Alertes d'activité : exceptions « normal pour ce membre »
-- ---------------------------------------------------------------------
create table if not exists public.alert_exemptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  signature text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  hits int not null default 0,
  last_hit_at timestamptz,
  unique (user_id, kind, signature)
);

alter table public.alert_exemptions enable row level security;
drop policy if exists "alert_exemptions_select" on public.alert_exemptions;
create policy "alert_exemptions_select" on public.alert_exemptions for select
  using (public.has_permission(auth.uid(), 'manage_users'));
revoke all on public.alert_exemptions from anon;
revoke insert, update, delete on public.alert_exemptions from authenticated;
grant select on public.alert_exemptions to authenticated;

-- Ce qui rend deux alertes « du même genre » : le genre, et pour les gros
-- montants le motif sans les nombres ni le détail après « : »
-- (« Vente : Sablier… (TVA 5 %…) » → « vente »).
create or replace function public._alert_signature(p_kind text, p_details jsonb)
returns text
language sql immutable
as $$
  select case p_kind
    when 'gros_montant' then left(lower(trim(split_part(
      regexp_replace(coalesce(p_details->>'motif', ''), '[0-9]+([.,][0-9]+)?', '#', 'g'), ' : ', 1))), 120)
    when 'auto_attribution' then coalesce(p_details->>'action', '')
    else ''
  end;
$$;

create or replace function public._raise_alert(
  p_user uuid, p_kind text, p_severity text, p_title text, p_details jsonb, p_key text, p_notify boolean default true
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_id bigint;
  v_admin uuid;
  v_nick text;
  v_ex bigint;
begin
  -- Exception posée par un admin : l'alerte est gardée, déjà classée, sans
  -- prévenir personne.
  select id into v_ex from public.alert_exemptions
  where user_id = p_user and kind = p_kind and signature = public._alert_signature(p_kind, p_details);
  if v_ex is not null then
    insert into public.activity_alerts (user_id, kind, severity, title, details, dedupe_key, status, handled_at)
    values (p_user, p_kind, p_severity, p_title, coalesce(p_details, '{}'::jsonb) || '{"exception": true}'::jsonb, p_key, 'ignored', now())
    on conflict (dedupe_key) do nothing
    returning id into v_id;
    if v_id is not null then
      update public.alert_exemptions set hits = hits + 1, last_hit_at = now() where id = v_ex;
    end if;
    return false;
  end if;

  insert into public.activity_alerts (user_id, kind, severity, title, details, dedupe_key)
  values (p_user, p_kind, p_severity, p_title, coalesce(p_details, '{}'::jsonb), p_key)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  if v_id is null then
    return false;
  end if;
  if p_notify and p_severity in ('warning', 'critical') then
    select nickname into v_nick from public.profiles where id = p_user;
    for v_admin in select * from public._alert_recipients(p_user) loop
      insert into public.notifications (user_id, type, title, body, link)
      values (
        v_admin, 'admin_alert',
        case when p_severity = 'critical' then '🚨 Alerte : ' else '⚠️ Alerte : ' end || p_title,
        coalesce(v_nick, 'Un membre') || ' — à vérifier dans les alertes d''activité.',
        '/dashboard/admin/alerts'
      );
    end loop;
  end if;
  return true;
end;
$$;

-- Détecteur (0060) : le récapitulatif ne compte plus les alertes classées
-- d'office par une exception.
create or replace function public.scan_activity_alerts()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  s jsonb := public.get_alert_settings();
  v_big numeric := (s->>'alert_big_tx')::numeric;
  v_gain numeric := (s->>'alert_daily_gain')::numeric;
  v_msgs numeric := (s->>'alert_msgs_hour')::numeric;
  v_sim numeric := (s->>'alert_sim_hour')::numeric;
  v_sim_s numeric := (s->>'alert_sim_min_s')::numeric;
  v_burst numeric := (s->>'alert_admin_burst')::numeric;
  v_purch numeric := (s->>'alert_purchases_hour')::numeric;
  v_dormant numeric := (s->>'alert_dormant_days')::numeric;
  v_hour text := to_char(now(), 'YYYYMMDDHH24');
  v_bucket text := to_char(now(), 'YYYYMMDDHH24') || (extract(minute from now())::int / 10)::text;
  v_new int := 0;
  v_max_id bigint := coalesce((select max(id) from public.activity_alerts), 0);
  v_crit int;
  v_warn int;
  r record;
begin
  -- Gros mouvement d'argent
  if v_big > 0 then
    for r in
      select t.id, t.user_id, t.amount, t.reason from public.transactions t
      where t.created_at > now() - interval '24 hours' and abs(t.amount) >= v_big
        and not public.is_sandbox_account(t.user_id)
    loop
      if public._raise_alert(r.user_id, 'gros_montant', case when abs(r.amount) >= v_big * 5 then 'critical' else 'warning' end,
           format('Mouvement de %s z', public._fmt_z(r.amount, true)),
           jsonb_build_object('montant', r.amount, 'motif', r.reason), 'tx:' || r.id, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Enrichissement rapide sur 24 h
  if v_gain > 0 then
    for r in
      select t.user_id, sum(t.amount) as total, count(*) as n from public.transactions t
      where t.created_at > now() - interval '24 hours' and t.amount > 0 and not public.is_sandbox_account(t.user_id)
      group by t.user_id having sum(t.amount) >= v_gain
    loop
      if public._raise_alert(r.user_id, 'enrichissement', 'warning',
           format('A gagné %s z en 24 h', public._fmt_z(r.total)),
           jsonb_build_object('total', r.total, 'mouvements', r.n), 'gain:' || r.user_id || ':' || current_date, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Rafale de messages
  if v_msgs > 0 then
    for r in
      select m.sender_id as user_id, count(*) as n, count(distinct m.channel_id) as salons from public.chat_messages m
      where m.created_at > now() - interval '1 hour' and not public.is_sandbox_account(m.sender_id)
      group by m.sender_id having count(*) >= v_msgs
    loop
      if public._raise_alert(r.user_id, 'spam', case when r.n >= v_msgs * 3 then 'critical' else 'warning' end,
           format('%s messages en une heure', r.n),
           jsonb_build_object('messages', r.n, 'salons', r.salons), 'spam:' || r.user_id || ':' || v_hour, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Simulations : trop de victoires en une heure, ou victoires trop rapides
  if v_sim > 0 then
    for r in
      select sr.user_id, count(*) as n from public.simulation_runs sr
      where sr.status = 'success' and sr.finished_at > now() - interval '1 hour' and not public.is_sandbox_account(sr.user_id)
      group by sr.user_id having count(*) >= v_sim
    loop
      if public._raise_alert(r.user_id, 'simulations', 'warning', format('%s simulations réussies en une heure', r.n),
           jsonb_build_object('reussites', r.n), 'sim:' || r.user_id || ':' || v_hour, false) then v_new := v_new + 1; end if;
    end loop;
  end if;
  if v_sim_s > 0 then
    for r in
      select sr.user_id, count(*) as n, min(extract(epoch from sr.finished_at - sr.started_at))::int as plus_rapide
      from public.simulation_runs sr
      where sr.status = 'success' and sr.finished_at > now() - interval '24 hours'
        and sr.finished_at - sr.started_at < make_interval(secs => v_sim_s)
        and not public.is_sandbox_account(sr.user_id)
      group by sr.user_id having count(*) >= 3
    loop
      if public._raise_alert(r.user_id, 'simulations_rapides', 'warning',
           format('%s simulations gagnées en moins de %s s', r.n, v_sim_s),
           jsonb_build_object('parties', r.n, 'plus_rapide_s', r.plus_rapide), 'simrapide:' || r.user_id || ':' || current_date, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Achats en rafale
  if v_purch > 0 then
    for r in
      select p.user_id, count(*) as n, sum(p.total_price) as total from public.purchases p
      where p.created_at > now() - interval '1 hour' and not public.is_sandbox_account(p.user_id)
      group by p.user_id having count(*) >= v_purch
    loop
      if public._raise_alert(r.user_id, 'achats', 'warning', format('%s achats en une heure', r.n),
           jsonb_build_object('achats', r.n, 'total', r.total), 'achats:' || r.user_id || ':' || v_hour, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Admin : beaucoup d'actions sensibles en 10 minutes
  if v_burst > 0 then
    for r in
      select a.actor_id as user_id, count(*) as n, array_agg(distinct a.action) as actions from public.audit_log a
      where a.created_at > now() - interval '10 minutes' and a.actor_id is not null
        and a.action not in ('account_invisible', 'account_visible', 'rank_divine', 'alert_settings_changed')
      group by a.actor_id having count(*) >= v_burst
    loop
      if public._raise_alert(r.user_id, 'admin_rafale', case when r.n >= v_burst * 3 then 'critical' else 'warning' end,
           format('%s actions d''administration en 10 minutes', r.n),
           jsonb_build_object('actions', r.n, 'types', r.actions), 'burst:' || r.user_id || ':' || v_bucket, false) then v_new := v_new + 1; end if;
    end loop;
  end if;

  -- Admin qui s'attribue quelque chose à lui-même
  for r in
    select a.id, a.actor_id as user_id, a.action, a.details from public.audit_log a
    where a.created_at > now() - interval '24 hours' and a.actor_id is not null and a.actor_id = a.target_user_id
      and a.action in ('wallet_adjusted', 'reputation_adjusted', 'stats_changed', 'levels_changed',
                       'role_assigned', 'permission_granted', 'profile_changed')
  loop
    if public._raise_alert(r.user_id, 'auto_attribution',
         case when r.action in ('wallet_adjusted', 'role_assigned', 'permission_granted') then 'critical' else 'warning' end,
         'Action d''administration sur son propre compte',
         jsonb_build_object('action', r.action, 'details', r.details), 'self:' || r.id, false) then v_new := v_new + 1; end if;
  end loop;

  -- Sanctions répétées
  for r in
    select sa.user_id, count(*) as n from public.sanctions sa
    where sa.created_at > now() - interval '7 days'
    group by sa.user_id having count(*) >= 3
  loop
    if public._raise_alert(r.user_id, 'sanctions', 'info', format('%s sanctions en 7 jours', r.n),
         jsonb_build_object('sanctions', r.n), 'sanc:' || r.user_id || ':' || to_char(now(), 'IYYYIW'), false) then v_new := v_new + 1; end if;
  end loop;

  -- Nouveau compte très actif ou très riche
  for r in
    select p.id as user_id, coalesce(w.balance, 0) as balance,
           (select count(*) from public.chat_messages m where m.sender_id = p.id and m.created_at > now() - interval '24 hours') as msgs
    from public.profiles p
    left join public.wallets w on w.user_id = p.id
    where p.created_at > now() - interval '48 hours' and p.status = 'active' and not public.is_sandbox_account(p.id)
  loop
    if (v_big > 0 and r.balance >= v_big) or r.msgs >= 100 then
      if public._raise_alert(r.user_id, 'nouveau_compte', 'warning', 'Nouveau compte déjà très actif',
           jsonb_build_object('solde', r.balance, 'messages_24h', r.msgs), 'new:' || r.user_id, false) then v_new := v_new + 1; end if;
    end if;
  end loop;

  -- Compte endormi qui se réveille (possible reprise de compte)
  if v_dormant > 0 then
    for r in
      select a.user_id, (select max(b.day) from public.activity_log b where b.user_id = a.user_id and b.day < current_date) as previous
      from public.activity_log a
      where a.day = current_date and not public.is_sandbox_account(a.user_id)
    loop
      if r.previous is not null and r.previous < current_date - v_dormant::int then
        if public._raise_alert(r.user_id, 'compte_reveille', 'info',
             format('De retour après %s jours d''absence', current_date - r.previous),
             jsonb_build_object('derniere_visite', r.previous), 'wake:' || r.user_id || ':' || current_date, false) then v_new := v_new + 1; end if;
      end if;
    end loop;
  end if;

  -- Un seul message par admin pour toutes les nouvelles alertes de ce passage.
  if v_new > 0 then
    select count(*) filter (where severity = 'critical'), count(*) filter (where severity in ('warning', 'critical'))
      into v_crit, v_warn
    from public.activity_alerts where id > v_max_id and status = 'open';
    if v_warn > 0 then
      insert into public.notifications (user_id, type, title, body, link)
      select a, 'admin_alert',
             case when v_crit > 0 then '🚨 ' else '⚠️ ' end || v_warn || case when v_warn > 1 then ' nouvelles alertes d''activité' else ' nouvelle alerte d''activité' end,
             case when v_crit > 0 then v_crit || ' critique(s). ' else '' end || 'À vérifier dans Administration → Alertes.',
             '/dashboard/admin/alerts'
      from public._alert_recipients(null) a;
    end if;
  end if;
  return v_new;
end;
$$;

-- « Normal pour ce membre » : exception + classement de cette alerte et des
-- autres alertes ouvertes du même genre pour ce membre.
create or replace function public.alert_mark_normal(p_id bigint)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  a public.activity_alerts;
  v_sig text;
  n int;
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  select * into a from public.activity_alerts where id = p_id;
  if a.id is null then raise exception 'Alerte introuvable.'; end if;
  if a.user_id is null then raise exception 'Cette alerte ne concerne aucun membre.'; end if;
  v_sig := public._alert_signature(a.kind, a.details);

  insert into public.alert_exemptions (user_id, kind, signature, created_by)
  values (a.user_id, a.kind, v_sig, auth.uid())
  on conflict (user_id, kind, signature) do nothing;

  update public.activity_alerts
  set status = 'ignored', handled_by = auth.uid(), handled_at = now()
  where user_id = a.user_id and kind = a.kind and status = 'open'
    and public._alert_signature(kind, details) = v_sig;
  get diagnostics n = row_count;

  perform public.write_audit('alert_exemption_added', a.user_id, jsonb_build_object('genre', a.kind, 'motif', nullif(v_sig, '')));
  return n;
end;
$$;

create or replace function public.alert_exemptions_list()
returns table (id bigint, user_id uuid, nickname text, kind text, signature text, created_by_nickname text,
               created_at timestamptz, hits int, last_hit_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select e.id, e.user_id, p.nickname, e.kind, e.signature, c.nickname, e.created_at, e.hits, e.last_hit_at
  from public.alert_exemptions e
  left join public.profiles p on p.id = e.user_id
  left join public.profiles c on c.id = e.created_by
  where public.has_permission(auth.uid(), 'manage_users') and not public.is_sandbox_account(auth.uid())
  order by e.created_at desc;
$$;

create or replace function public.alert_exemption_delete(p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  e public.alert_exemptions;
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  delete from public.alert_exemptions where id = p_id returning * into e;
  if e.id is not null then
    perform public.write_audit('alert_exemption_removed', e.user_id, jsonb_build_object('genre', e.kind, 'motif', nullif(e.signature, '')));
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Liste de souhaits et cadeaux
-- ---------------------------------------------------------------------
create table if not exists public.shop_wishlist (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.shop_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (user_id, item_id)
);
create index if not exists shop_wishlist_item_idx on public.shop_wishlist (item_id);

alter table public.shop_wishlist enable row level security;
drop policy if exists "shop_wishlist_select_own" on public.shop_wishlist;
create policy "shop_wishlist_select_own" on public.shop_wishlist for select to authenticated using (user_id = auth.uid());
revoke all on public.shop_wishlist from anon;
revoke insert, update, delete on public.shop_wishlist from authenticated;
grant select on public.shop_wishlist to authenticated;

alter table public.purchases add column if not exists gift_from uuid references public.profiles(id) on delete set null;
alter table public.purchases add column if not exists gift_message text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchases_gift_message_len') then
    alter table public.purchases add constraint purchases_gift_message_len check (gift_message is null or char_length(gift_message) <= 300);
  end if;
end;
$$;

create or replace function public.wishlist_toggle(p_item uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  delete from public.shop_wishlist where user_id = v_uid and item_id = p_item;
  if found then return false; end if;
  if not exists (select 1 from public.shop_items where id = p_item and hidden_at is null) then
    raise exception 'Objet introuvable.';
  end if;
  if (select count(*) from public.shop_wishlist where user_id = v_uid) >= 50 then
    raise exception '50 souhaits au maximum.';
  end if;
  insert into public.shop_wishlist (user_id, item_id) values (v_uid, p_item);
  return true;
end;
$$;

-- La liste d'un membre (la mienne par défaut). Visible par les membres
-- actifs : c'est ce qui permet de faire un cadeau.
create or replace function public.wishlist_list(p_user uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid := coalesce(p_user, auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'item_id', i.id,
             'name', i.name,
             'image_url', i.image_url,
             'effect', i.effect,
             'price', i.price,
             'unit_price', case when i.sale_price is not null and (i.sale_ends_at is null or i.sale_ends_at > now()) then i.sale_price else i.price end,
             'stock', i.stock,
             'available', i.is_active and i.hidden_at is null and (i.stock is null or i.stock > 0),
             'added_at', w.created_at
           ) order by w.created_at desc)
    from public.shop_wishlist w
    join public.shop_items i on i.id = w.item_id
    where w.user_id = v_target and i.hidden_at is null
  ), '[]'::jsonb);
end;
$$;

-- Les membres (autres que moi) qui souhaitent cet objet.
create or replace function public.wishlist_wanters(p_item uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatar_url', p.avatar_url) order by w.created_at), '[]'::jsonb)
  from public.shop_wishlist w
  join public.profiles p on p.id = w.user_id
  where w.item_id = p_item and p.status = 'active' and p.id <> auth.uid()
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.status = 'active');
$$;

-- Offrir un objet de la vitrine : payé par moi, reçu par l'autre (dans ses
-- achats ; un objet à effet lui donne son effet).
create or replace function public.shop_gift(p_item uuid, p_to uuid, p_quantity int default 1, p_message text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.shop_items;
  v_to public.profiles;
  v_nick text;
  v_msg text := nullif(trim(coalesce(p_message, '')), '');
  v_balance numeric(18, 2);
  v_unit numeric(15, 2);
  v_total numeric(15, 2);
  v_rate numeric;
  v_vat numeric(18, 2);
  v_net numeric(18, 2);
  v_pid uuid;
  v_label text;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if coalesce(p_quantity, 0) < 1 then raise exception 'La quantité doit être au moins 1.'; end if;
  if p_to is null or p_to = v_uid then raise exception 'Choisis un autre membre.'; end if;
  if v_msg is not null and char_length(v_msg) > 300 then raise exception 'Le mot est limité à 300 caractères.'; end if;
  if coalesce((select is_frozen from public.profiles where id = v_uid), false) then
    raise exception 'Ton compte est gelé : impossible d''acheter tant que la sanction est active.';
  end if;
  if not public.is_feature_enabled('shop') then
    raise exception 'La boutique est temporairement fermée par l''administration.';
  end if;
  select * into v_to from public.profiles where id = p_to and status = 'active';
  if v_to.id is null then raise exception 'Membre introuvable.'; end if;
  if public.is_sandbox_account(p_to) and not public.is_sandbox_account(v_uid) then
    raise exception 'Ce compte est un compte de test.';
  end if;

  select balance into v_balance from public.wallets where user_id = v_uid for update;
  if v_balance is not null and v_balance < 0 then
    raise exception 'Ton solde est négatif (dette avec intérêts impayés) : règle-le avant de pouvoir acheter quoi que ce soit.';
  end if;

  select * into v_item from public.shop_items where id = p_item and is_active and hidden_at is null for update;
  if v_item.id is null then raise exception 'Objet introuvable ou indisponible'; end if;
  if v_item.stock is not null and v_item.stock < p_quantity then raise exception 'Stock insuffisant'; end if;

  v_unit := case when v_item.sale_price is not null and (v_item.sale_ends_at is null or v_item.sale_ends_at > now())
                 then v_item.sale_price else v_item.price end;
  v_total := v_unit * p_quantity;
  if v_balance is null or v_balance < v_total then raise exception 'Solde insuffisant'; end if;

  v_rate := public.get_config_numeric('vat_rate', 0.05);
  v_vat := round(v_total * v_rate, 2);
  v_net := v_total - v_vat;
  v_label := v_item.name || case when p_quantity > 1 then ' × ' || p_quantity else '' end;
  select nickname into v_nick from public.profiles where id = v_uid;

  update public.wallets set balance = balance - v_total where user_id = v_uid;

  insert into public.purchases (item_id, user_id, quantity, total_price, status, gift_from, gift_message)
  values (p_item, p_to, p_quantity, v_total, 'pending', v_uid, v_msg)
  returning id into v_pid;

  insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
  values (v_uid, -v_total, 'Cadeau pour ' || v_to.nickname || ' : ' || v_label, v_pid, v_uid);

  if v_item.business_id is not null then
    update public.businesses set treasury_balance = treasury_balance + v_net where id = v_item.business_id;
    insert into public.business_transactions (business_id, amount, reason, created_by)
    values (v_item.business_id, v_net, 'Vente : ' || v_item.name || ' (TVA déduite)', v_uid);
  elsif v_item.created_by is not null and v_item.created_by <> v_uid then
    update public.wallets set balance = balance + v_net where user_id = v_item.created_by;
    insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
    values (v_item.created_by, v_net, 'Vente : ' || v_item.name || ' (TVA ' || (v_rate * 100)::text || '% déduite)', v_pid, v_uid);
  end if;
  update public.tax_pool set balance = balance + v_vat where id = true;

  if v_item.stock is not null then
    update public.shop_items set stock = stock - p_quantity where id = p_item;
  end if;

  delete from public.shop_wishlist where user_id = p_to and item_id = p_item;

  insert into public.notifications (user_id, type, title, body, link)
  values (p_to, 'gift', 'Cadeau reçu',
          coalesce(v_nick, 'Un membre') || ' t''offre ' || v_label || coalesce(' : « ' || v_msg || ' »', '.'),
          '/dashboard/shop?onglet=achats');
  return v_pid;
end;
$$;

-- Objet souhaité de nouveau disponible (retour en stock, remis en vente).
create or replace function public._wishlist_on_item_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not new.is_active or new.hidden_at is not null or (new.stock is not null and new.stock <= 0) then return new; end if;
  if not ((old.stock is not null and old.stock <= 0) or not old.is_active or old.hidden_at is not null) then return new; end if;

  insert into public.notifications (user_id, type, title, body, link)
  select w.user_id, 'wishlist', 'De retour en boutique', new.name, '/dashboard/shop?objet=' || new.id
  from public.shop_wishlist w
  where w.item_id = new.id and w.user_id is distinct from new.created_by
    and (w.notified_at is null or w.notified_at < now() - interval '12 hours');
  update public.shop_wishlist set notified_at = now() where item_id = new.id;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_wishlist_back on public.shop_items;
create trigger trg_wishlist_back
  after update of stock, is_active, hidden_at on public.shop_items
  for each row execute function public._wishlist_on_item_change();

-- Objet souhaité mis aux enchères.
create or replace function public._wishlist_on_auction()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select w.user_id, 'wishlist', 'Aux enchères',
         i.name || ' : mise à prix ' || public._fmt_z(new.start_price) || ' z.',
         '/dashboard/shop?enchere=' || new.id
  from public.shop_wishlist w
  join public.shop_items i on i.id = w.item_id
  where w.item_id = new.item_id and w.user_id <> new.seller_id;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_wishlist_auction on public.auctions;
create trigger trg_wishlist_auction
  after insert on public.auctions
  for each row execute function public._wishlist_on_auction();

-- ---------------------------------------------------------------------
-- 4. Sondages programmés
-- ---------------------------------------------------------------------
alter table public.polls add column if not exists publish_at timestamptz;
alter table public.polls add column if not exists notify boolean not null default true;
alter table public.polls add column if not exists announced_at timestamptz;
update public.polls set announced_at = created_at where announced_at is null and publish_at is null;

create or replace function public._poll_visible(p_publish_at timestamptz)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_publish_at is null or p_publish_at <= now() or public.has_permission(auth.uid(), 'manage_users');
$$;

drop policy if exists "polls_select" on public.polls;
create policy "polls_select" on public.polls for select to authenticated using (public._poll_visible(publish_at));
drop policy if exists "poll_options_select" on public.poll_options;
create policy "poll_options_select" on public.poll_options for select to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id));

drop function if exists public.poll_create(text, text, text[], boolean, boolean, text, timestamptz, boolean);
create or replace function public.poll_create(
  p_question text,
  p_details text,
  p_options text[],
  p_multiple boolean default false,
  p_anonymous boolean default true,
  p_show_results text default 'after_vote',
  p_closes_at timestamptz default null,
  p_notify boolean default true,
  p_publish_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := trim(coalesce(p_question, ''));
  v_d text := nullif(trim(coalesce(p_details, '')), '');
  v_pub timestamptz := case when p_publish_at > now() + interval '1 minute' then p_publish_at end;
  v_opts text[];
  v_id uuid;
  i int;
begin
  if not public.has_permission(v_uid, 'manage_users') then raise exception 'Permission refusée.'; end if;
  if char_length(v_q) < 3 or char_length(v_q) > 200 then raise exception 'La question doit faire entre 3 et 200 caractères.'; end if;
  if v_d is not null and char_length(v_d) > 1000 then raise exception 'Le texte d''accompagnement est limité à 1 000 caractères.'; end if;
  if p_show_results not in ('always', 'after_vote', 'after_close') then raise exception 'Réglage des résultats invalide.'; end if;
  if v_pub > now() + interval '90 days' then raise exception 'Publication à 90 jours au plus.'; end if;
  if p_closes_at is not null and p_closes_at <= coalesce(v_pub, now()) + interval '5 minutes' then
    raise exception 'La clôture doit venir après la publication.';
  end if;

  select array_agg(o order by n) into v_opts
  from (
    select distinct on (lower(trim(x))) trim(x) as o, n
    from unnest(coalesce(p_options, '{}')) with ordinality as t(x, n)
    where trim(x) <> ''
    order by lower(trim(x)), n
  ) s;
  if v_opts is null or cardinality(v_opts) < 2 then raise exception 'Il faut au moins deux réponses différentes.'; end if;
  if cardinality(v_opts) > 12 then raise exception '12 réponses au maximum.'; end if;
  if exists (select 1 from unnest(v_opts) o where char_length(o) > 120) then raise exception 'Une réponse est limitée à 120 caractères.'; end if;

  insert into public.polls (question, details, multiple, anonymous, show_results, closes_at, created_by, publish_at, notify, announced_at)
  values (v_q, v_d, coalesce(p_multiple, false), coalesce(p_anonymous, true), p_show_results, p_closes_at, v_uid,
          v_pub, coalesce(p_notify, true), case when v_pub is null then now() end)
  returning id into v_id;

  for i in 1 .. cardinality(v_opts) loop
    insert into public.poll_options (poll_id, label, position) values (v_id, v_opts[i], i);
  end loop;

  if v_pub is null and coalesce(p_notify, true) then
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'poll', 'Nouveau sondage', left(v_q, 160), '/dashboard/polls?sondage=' || v_id
    from public.profiles p
    where p.status = 'active' and p.id <> v_uid;
  end if;
  return v_id;
end;
$$;

-- Publie (annonce) les sondages dont l'heure est venue.
create or replace function public.polls_publish_due()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, question, notify, created_by from public.polls
    where announced_at is null and publish_at is not null and publish_at <= now()
    for update skip locked
  loop
    update public.polls set announced_at = now() where id = r.id;
    if r.notify then
      insert into public.notifications (user_id, type, title, body, link)
      select p.id, 'poll', 'Nouveau sondage', left(r.question, 160), '/dashboard/polls?sondage=' || r.id
      from public.profiles p
      where p.status = 'active' and p.id is distinct from r.created_by;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.poll_publish_now(p_poll uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then raise exception 'Permission refusée.'; end if;
  update public.polls set publish_at = now() where id = p_poll and publish_at > now();
  perform public.polls_publish_due();
end;
$$;

create or replace function public.poll_vote(p_poll uuid, p_options uuid[])
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls;
  v_opts uuid[] := coalesce((select array_agg(distinct x) from unnest(p_options) x where x is not null), '{}');
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'Seuls les membres actifs votent.';
  end if;
  select * into v_poll from public.polls where id = p_poll;
  if v_poll.id is null then raise exception 'Sondage introuvable.'; end if;
  if v_poll.publish_at is not null and v_poll.publish_at > now() then raise exception 'Ce sondage n''est pas encore publié.'; end if;
  if v_poll.closed_at is not null or (v_poll.closes_at is not null and v_poll.closes_at <= now()) then
    raise exception 'Ce sondage est clos.';
  end if;
  if not v_poll.multiple and cardinality(v_opts) > 1 then raise exception 'Une seule réponse possible.'; end if;
  if exists (select 1 from unnest(v_opts) x where not exists (select 1 from public.poll_options o where o.id = x and o.poll_id = p_poll)) then
    raise exception 'Réponse inconnue.';
  end if;

  delete from public.poll_votes where poll_id = p_poll and user_id = v_uid;
  insert into public.poll_votes (poll_id, option_id, user_id)
  select p_poll, x, v_uid from unnest(v_opts) x;
end;
$$;

create or replace function public.polls_list(p_limit int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_out jsonb;
begin
  if v_uid is null then return '[]'::jsonb; end if;
  v_admin := public.has_permission(v_uid, 'manage_users');

  with p as (
    select po.*,
           (po.publish_at is not null and po.publish_at > now()) as scheduled,
           (po.closed_at is null and (po.closes_at is null or po.closes_at > now())
              and (po.publish_at is null or po.publish_at <= now())) as is_open,
           exists (select 1 from public.poll_votes v where v.poll_id = po.id and v.user_id = v_uid) as voted
    from public.polls po
    where po.publish_at is null or po.publish_at <= now() or v_admin
    order by coalesce(po.publish_at, po.created_at) desc
    limit greatest(1, least(coalesce(p_limit, 30), 100))
  ), q as (
    select p.*, (v_admin or p.show_results = 'always' or (p.show_results = 'after_vote' and p.voted) or (not p.is_open and not p.scheduled)) as vis
    from p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id,
           'question', q.question,
           'details', q.details,
           'multiple', q.multiple,
           'anonymous', q.anonymous,
           'show_results', q.show_results,
           'closes_at', q.closes_at,
           'closed_at', q.closed_at,
           'publish_at', q.publish_at,
           'scheduled', q.scheduled,
           'notify', q.notify,
           'is_open', q.is_open,
           'created_at', coalesce(q.publish_at, q.created_at),
           'author', (select nickname from public.profiles where id = q.created_by),
           'voted', q.voted,
           'results_visible', q.vis,
           'voters', (select count(distinct v.user_id) from public.poll_votes v where v.poll_id = q.id),
           'my_votes', coalesce((select jsonb_agg(v.option_id) from public.poll_votes v where v.poll_id = q.id and v.user_id = v_uid), '[]'::jsonb),
           'options', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', o.id,
                      'label', o.label,
                      'votes', case when q.vis then (select count(*) from public.poll_votes v where v.option_id = o.id) end,
                      'names', case when q.vis and not q.anonymous then (
                                 select coalesce(jsonb_agg(pr.nickname order by pr.nickname), '[]'::jsonb)
                                 from public.poll_votes v join public.profiles pr on pr.id = v.user_id
                                 where v.option_id = o.id
                               ) end
                    ) order by o.position), '[]'::jsonb)
             from public.poll_options o where o.poll_id = q.id
           )
         ) order by q.is_open desc, q.scheduled desc, coalesce(q.publish_at, q.created_at) desc), '[]'::jsonb)
  into v_out
  from q;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Enchères : rappel 10 minutes avant la fin
-- ---------------------------------------------------------------------
alter table public.auctions add column if not exists reminded_at timestamptz;

create or replace function public.auctions_remind_due()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  a record;
  b record;
  v_name text;
  v_min int;
  n int := 0;
begin
  for a in
    select * from public.auctions
    where status = 'open' and reminded_at is null and bid_count > 0
      and ends_at > now() and ends_at <= now() + interval '10 minutes'
    for update skip locked
  loop
    select name into v_name from public.shop_items where id = a.item_id;
    v_name := coalesce(v_name, 'objet') || case when a.quantity > 1 then ' × ' || a.quantity else '' end;
    v_min := greatest(1, ceil(extract(epoch from a.ends_at - now()) / 60))::int;
    for b in select distinct bidder_id from public.auction_bids where auction_id = a.id loop
      perform public._auction_notify(
        b.bidder_id,
        'Fin d''enchère dans ' || v_min || ' min',
        v_name || case when b.bidder_id = a.top_bidder
                       then ' : tu es en tête à ' else ' : l''offre en tête est à ' end
               || public._fmt_z(a.current_price) || ' z.',
        a.id);
    end loop;
    update public.auctions set reminded_at = now() where id = a.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Tâches planifiées
-- ---------------------------------------------------------------------
create or replace function public.run_scheduled_jobs()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
  v_last timestamptz;
begin
  v := v || jsonb_build_object('sondages', public.polls_publish_due());
  v := v || jsonb_build_object('rappels', public.auctions_remind_due());
  v := v || jsonb_build_object('encheres', public.auctions_settle_due());
  select value::timestamptz into v_last from public.app_config where key = 'notif_cleanup_last';
  if v_last is null or v_last < now() - interval '1 hour' then
    insert into public.app_config (key, value) values ('notif_cleanup_last', now()::text)
    on conflict (key) do update set value = excluded.value;
    v := v || jsonb_build_object('nettoyage', public.notifications_cleanup());
  end if;
  return v;
end;
$$;

-- Appelée par le site (au plus une fois par minute, tous membres confondus).
create or replace function public.maybe_run_jobs()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_key text;
begin
  if auth.uid() is null then return null; end if;
  insert into public.app_config (key, value) values ('jobs_last_run', now()::text)
  on conflict (key) do update set value = excluded.value
  where public.app_config.value is null or public.app_config.value::timestamptz < now() - interval '50 seconds'
  returning key into v_key;
  if v_key is null then return null; end if;
  return public.run_scheduled_jobs();
end;
$$;

-- pg_cron, s'il existe sur le projet : les tâches tournent même quand
-- personne n'est connecté. Sinon, les visites suffisent.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule('sid_jobs_minute') where exists (select 1 from cron.job where jobname = 'sid_jobs_minute');
    perform cron.schedule('sid_jobs_minute', '* * * * *', 'select public.run_scheduled_jobs();');
  end if;
exception when others then
  raise notice 'pg_cron indisponible : les tâches tournent à chaque visite du site.';
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Statistiques admin supplémentaires
-- ---------------------------------------------------------------------
create or replace function public.get_admin_stats_more()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz text := public.stats_timezone();
  v_today date := (now() at time zone public.stats_timezone())::date;
  v_active int;
  v_members jsonb;
  v_weeks jsonb;
  v_wealth jsonb;
  v_flows jsonb;
  v_auctions jsonb;
  v_polls jsonb;
  v_alerts jsonb;
  v_notifs jsonb;
  v_gifts jsonb;
  v_weddings jsonb;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then raise exception 'Permission refusée.'; end if;
  select count(*) into v_active from public.profiles where status = 'active' and not public.is_sandbox_account(id);

  select jsonb_build_object(
    'actifs', v_active,
    'nouveaux_7j', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'nouveaux_30j', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'visiteurs_7j', (select count(distinct user_id) from public.activity_log where day > v_today - 7),
    'visiteurs_30j', (select count(distinct user_id) from public.activity_log where day > v_today - 30),
    'endormis', (select count(*) from public.profiles p where p.status = 'active' and not public.is_sandbox_account(p.id)
                   and coalesce(p.last_seen_at, p.created_at) < now() - interval '30 days')
  ) into v_members;

  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', w::date,
           'nouveaux', (select count(*) from public.profiles p
                        where (p.created_at at time zone v_tz)::date >= w::date and (p.created_at at time zone v_tz)::date < w::date + 7),
           'visiteurs', (select count(distinct a.user_id) from public.activity_log a where a.day >= w::date and a.day < w::date + 7)
         ) order by w), '[]'::jsonb)
  into v_weeks
  from generate_series(date_trunc('week', v_today::timestamp) - interval '7 weeks', date_trunc('week', v_today::timestamp), interval '1 week') w;

  with b as (
    select w.user_id, w.balance from public.wallets w
    join public.profiles p on p.id = w.user_id
    where p.status = 'active' and not public.is_sandbox_account(p.id)
  ), r as (
    select balance, ntile(10) over (order by balance desc) as dec from b
  )
  select jsonb_build_object(
    'total', (select coalesce(sum(balance), 0) from b),
    'mediane', (select percentile_cont(0.5) within group (order by balance) from b),
    'part_top10', (select case when sum(balance) > 0 then round(100 * coalesce(sum(balance) filter (where dec = 1), 0) / sum(balance), 1) end from r),
    'negatifs', (select count(*) from b where balance < 0),
    'plus_riches', (select coalesce(jsonb_agg(jsonb_build_object('nickname', x.nickname, 'balance', x.balance) order by x.balance desc), '[]'::jsonb)
                    from (select p.nickname, b.balance from b join public.profiles p on p.id = b.user_id order by b.balance desc limit 5) x)
  ) into v_wealth;

  select coalesce(jsonb_agg(jsonb_build_object('motif', x.motif, 'entrees', x.entrees, 'sorties', x.sorties, 'mouvements', x.n)
                            order by coalesce(x.entrees, 0) + coalesce(x.sorties, 0) desc), '[]'::jsonb)
  into v_flows
  from (
    select left(regexp_replace(trim(split_part(regexp_replace(coalesce(t.reason, 'Autre'), '[0-9]+([.,][0-9]+)?', '#', 'g'), ' : ', 1)),
                               '^Cadeau pour .*$', 'Cadeau offert'), 60) as motif,
           sum(t.amount) filter (where t.amount > 0) as entrees,
           -sum(t.amount) filter (where t.amount < 0) as sorties,
           count(*) as n
    from public.transactions t
    where t.created_at > now() - interval '30 days' and not public.is_sandbox_account(t.user_id)
    group by 1
    order by sum(abs(t.amount)) desc
    limit 10
  ) x;

  select jsonb_build_object(
    'en_cours', count(*) filter (where status = 'open' and ends_at > now()),
    'vendues_30j', count(*) filter (where status = 'sold' and settled_at > now() - interval '30 days'),
    'invendues_30j', count(*) filter (where status = 'unsold' and settled_at > now() - interval '30 days'),
    'volume_30j', coalesce(sum(current_price) filter (where status = 'sold' and settled_at > now() - interval '30 days'), 0),
    'offres_moy', round(avg(bid_count) filter (where status = 'sold' and settled_at > now() - interval '30 days'), 1)
  ) into v_auctions
  from public.auctions;

  select jsonb_build_object(
    'ouverts', (select count(*) from public.polls where closed_at is null and (closes_at is null or closes_at > now())
                  and (publish_at is null or publish_at <= now())),
    'programmes', (select count(*) from public.polls where publish_at > now()),
    'participation', (select round(avg(100.0 * x.n / greatest(v_active, 1)), 0) from (
                        select (select count(distinct v.user_id) from public.poll_votes v where v.poll_id = po.id) as n
                        from public.polls po where po.publish_at is null or po.publish_at <= now()
                        order by coalesce(po.publish_at, po.created_at) desc limit 10) x)
  ) into v_polls;

  select jsonb_build_object(
    'ouvertes', (select count(*) from public.activity_alerts where status = 'open'),
    'creees_30j', (select count(*) from public.activity_alerts where created_at > now() - interval '30 days' and not details ? 'exception'),
    'classees_seules_30j', (select count(*) from public.activity_alerts where created_at > now() - interval '30 days' and details ? 'exception'),
    'exceptions', (select count(*) from public.alert_exemptions),
    'par_genre', (select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'n', x.n) order by x.n desc), '[]'::jsonb) from (
                    select kind, count(*) as n from public.activity_alerts
                    where created_at > now() - interval '30 days' and not details ? 'exception'
                    group by kind order by count(*) desc limit 6) x)
  ) into v_alerts;

  select jsonb_build_object(
    'envoyees_7j', (select coalesce(sum(count), 0) from public.notifications where created_at > now() - interval '7 days'),
    'non_lues', (select count(*) from public.notifications where not is_read),
    'par_type', (select coalesce(jsonb_agg(jsonb_build_object('type', x.type, 'n', x.n) order by x.n desc), '[]'::jsonb) from (
                   select type, sum(count) as n from public.notifications
                   where created_at > now() - interval '7 days' group by type order by sum(count) desc limit 8) x)
  ) into v_notifs;

  select jsonb_build_object(
    'cadeaux_30j', (select count(*) from public.purchases where gift_from is not null and created_at > now() - interval '30 days'),
    'valeur_30j', (select coalesce(sum(total_price), 0) from public.purchases where gift_from is not null and created_at > now() - interval '30 days'),
    'souhaits', (select count(*) from public.shop_wishlist),
    'plus_souhaites', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'n', x.n) order by x.n desc), '[]'::jsonb) from (
                         select i.name, count(*) as n from public.shop_wishlist w join public.shop_items i on i.id = w.item_id
                         where i.hidden_at is null group by i.name order by count(*) desc limit 5) x)
  ) into v_gifts;

  select jsonb_build_object(
    'unions', (select count(*) from public.weddings where status = 'married'),
    'demandes', (select count(*) from public.weddings where status = 'proposed'),
    'public', coalesce((select value from public.app_config where key = 'wedding_public'), 'off') = 'on'
  ) into v_weddings;

  return jsonb_build_object(
    'membres', v_members, 'semaines', v_weeks, 'richesse', v_wealth, 'flux', v_flows,
    'encheres', v_auctions, 'sondages', v_polls, 'alertes', v_alerts, 'notifications', v_notifs,
    'cadeaux', v_gifts, 'mariages', v_weddings
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Mariages
-- ---------------------------------------------------------------------
create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  partner_a uuid not null references public.profiles(id) on delete cascade,
  partner_b uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'proposed'
    check (status in ('proposed', 'married', 'declined', 'cancelled', 'divorced', 'annulled')),
  ring text not null default 'or' check (ring in ('or', 'argent', 'rose', 'ebene')),
  vow_a text check (vow_a is null or char_length(vow_a) <= 600),
  vow_b text check (vow_b is null or char_length(vow_b) <= 600),
  proposed_at timestamptz not null default now(),
  married_at timestamptz,
  ended_at timestamptz,
  check (partner_a <> partner_b)
);
create index if not exists weddings_status_idx on public.weddings (status, married_at desc);
create index if not exists weddings_a_idx on public.weddings (partner_a, status);
create index if not exists weddings_b_idx on public.weddings (partner_b, status);

create table if not exists public.wedding_wishes (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 280),
  created_at timestamptz not null default now(),
  primary key (wedding_id, user_id)
);

-- Tout passe par les fonctions ci-dessous.
alter table public.weddings enable row level security;
alter table public.wedding_wishes enable row level security;
revoke all on public.weddings, public.wedding_wishes from anon, authenticated;

create or replace function public.site_reveals()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('wedding', coalesce((select value from public.app_config where key = 'wedding_public'), 'off') = 'on');
$$;

create or replace function public._wedding_open(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select value from public.app_config where key = 'wedding_public'), 'off') = 'on'
      or public.has_permission(p_uid, 'manage_users');
$$;

create or replace function public.set_wedding_public(p_on boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  insert into public.app_config (key, value) values ('wedding_public', case when p_on then 'on' else 'off' end)
  on conflict (key) do update set value = excluded.value;
  perform public.write_audit('wedding_page_' || case when p_on then 'shown' else 'hidden' end, null, '{}'::jsonb);
  return public.site_reveals();
end;
$$;

create or replace function public._wedding_person(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatar_url', p.avatar_url)
  from public.profiles p where p.id = p_id;
$$;

create or replace function public._wedding_json(w public.weddings, p_viewer uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', w.id,
    'status', w.status,
    'ring', w.ring,
    'a', public._wedding_person(w.partner_a),
    'b', public._wedding_person(w.partner_b),
    'vow_a', w.vow_a,
    'vow_b', w.vow_b,
    'proposed_at', w.proposed_at,
    'married_at', w.married_at,
    -- Numéro d'acte : rang de l'union dans le registre (les unions rompues gardent le leur).
    'acte', case when w.married_at is not null then
      (select count(*) from public.weddings x where x.married_at is not null and x.married_at <= w.married_at) end,
    'wish_count', (select count(*) from public.wedding_wishes ww where ww.wedding_id = w.id),
    'my_wish', (select ww.message from public.wedding_wishes ww where ww.wedding_id = w.id and ww.user_id = p_viewer),
    'wishes', case when w.status = 'married' then (
      select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nickname', x.nickname, 'avatar_url', x.avatar_url,
                                                   'message', x.message, 'at', x.created_at) order by x.created_at desc), '[]'::jsonb)
      from (select ww.user_id, p.nickname, p.avatar_url, ww.message, ww.created_at
            from public.wedding_wishes ww join public.profiles p on p.id = ww.user_id
            where ww.wedding_id = w.id order by ww.created_at desc limit 60) x
    ) end
  );
$$;

create or replace function public.wedding_state()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return null; end if;
  if not public._wedding_open(v_uid) then
    return jsonb_build_object('open', false);
  end if;
  return jsonb_build_object(
    'open', true,
    'public', coalesce((select value from public.app_config where key = 'wedding_public'), 'off') = 'on',
    'admin', public.has_permission(v_uid, 'manage_users'),
    'me', public._wedding_person(v_uid),
    'union', (select public._wedding_json(w, v_uid) from public.weddings w
              where w.status = 'married' and v_uid in (w.partner_a, w.partner_b) limit 1),
    'incoming', (select coalesce(jsonb_agg(public._wedding_json(w, v_uid) order by w.proposed_at desc), '[]'::jsonb)
                 from public.weddings w where w.status = 'proposed' and w.partner_b = v_uid),
    'outgoing', (select public._wedding_json(w, v_uid) from public.weddings w
                 where w.status = 'proposed' and w.partner_a = v_uid limit 1),
    'registry', (select coalesce(jsonb_agg(public._wedding_json(w, v_uid) order by w.married_at desc), '[]'::jsonb)
                 from public.weddings w where w.status = 'married')
  );
end;
$$;

create or replace function public.wedding_propose(p_partner uuid, p_vow text, p_ring text default 'or')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_vow text := nullif(trim(coalesce(p_vow, '')), '');
  v_nick text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if not public._wedding_open(v_uid) then raise exception 'Les mariages ne sont pas encore ouverts.'; end if;
  if p_partner is null or p_partner = v_uid then raise exception 'Choisis un autre membre.'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then raise exception 'Compte inactif.'; end if;
  if not exists (select 1 from public.profiles where id = p_partner and status = 'active') then raise exception 'Membre introuvable.'; end if;
  if not public._wedding_open(p_partner) then raise exception 'Ce membre n''a pas encore accès aux mariages.'; end if;
  if coalesce(p_ring, 'or') not in ('or', 'argent', 'rose', 'ebene') then raise exception 'Alliance inconnue.'; end if;
  if v_vow is not null and char_length(v_vow) > 600 then raise exception 'Le texte est limité à 600 caractères.'; end if;

  perform pg_advisory_xact_lock(hashtext('sid-weddings'));
  if exists (select 1 from public.weddings where status = 'married' and v_uid in (partner_a, partner_b)) then
    raise exception 'Tu as déjà une union en cours.';
  end if;
  if exists (select 1 from public.weddings where status = 'married' and p_partner in (partner_a, partner_b)) then
    raise exception 'Ce membre a déjà une union.';
  end if;
  if exists (select 1 from public.weddings where status = 'proposed' and partner_a = v_uid) then
    raise exception 'Tu as déjà une demande en attente.';
  end if;
  if exists (select 1 from public.weddings where status = 'proposed' and partner_a = p_partner and partner_b = v_uid) then
    raise exception 'Ce membre t''a déjà fait sa demande : réponds-lui.';
  end if;

  insert into public.weddings (partner_a, partner_b, ring, vow_a)
  values (v_uid, p_partner, coalesce(p_ring, 'or'), v_vow)
  returning id into v_id;

  select nickname into v_nick from public.profiles where id = v_uid;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_partner, 'wedding', 'Demande en mariage', coalesce(v_nick, 'Un membre') || ' te demande en mariage.', '/dashboard/mariage');
  return v_id;
end;
$$;

create or replace function public.wedding_answer(p_id uuid, p_accept boolean, p_vow text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  w public.weddings;
  v_vow text := nullif(trim(coalesce(p_vow, '')), '');
  v_nick text;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  perform pg_advisory_xact_lock(hashtext('sid-weddings'));
  select * into w from public.weddings where id = p_id for update;
  if w.id is null or w.partner_b <> v_uid or w.status <> 'proposed' then raise exception 'Demande introuvable.'; end if;
  select nickname into v_nick from public.profiles where id = v_uid;

  if not coalesce(p_accept, false) then
    update public.weddings set status = 'declined', ended_at = now() where id = w.id;
    insert into public.notifications (user_id, type, title, body, link)
    values (w.partner_a, 'wedding', 'Demande déclinée', coalesce(v_nick, 'Le membre') || ' a décliné ta demande.', '/dashboard/mariage');
    return;
  end if;

  if v_vow is not null and char_length(v_vow) > 600 then raise exception 'Le texte est limité à 600 caractères.'; end if;
  if exists (select 1 from public.weddings where status = 'married' and (partner_a in (w.partner_a, w.partner_b) or partner_b in (w.partner_a, w.partner_b))) then
    raise exception 'L''un de vous deux a déjà une union.';
  end if;
  if not exists (select 1 from public.profiles where id = w.partner_a and status = 'active') then
    raise exception 'Ce membre n''est plus actif.';
  end if;

  update public.weddings set status = 'married', married_at = now(), vow_b = v_vow where id = w.id;
  -- Les autres demandes de l'un ou de l'autre tombent.
  update public.weddings set status = 'cancelled', ended_at = now()
  where status = 'proposed' and id <> w.id
    and (partner_a in (w.partner_a, w.partner_b) or partner_b in (w.partner_a, w.partner_b));

  insert into public.notifications (user_id, type, title, body, link)
  values (w.partner_a, 'wedding', 'Demande acceptée', coalesce(v_nick, 'Le membre') || ' a dit oui.', '/dashboard/mariage');
end;
$$;

create or replace function public.wedding_cancel(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.weddings set status = 'cancelled', ended_at = now()
  where id = p_id and partner_a = auth.uid() and status = 'proposed';
  if not found then raise exception 'Demande introuvable.'; end if;
  delete from public.notifications
  where type = 'wedding' and title = 'Demande en mariage' and not is_read
    and user_id = (select partner_b from public.weddings where id = p_id);
end;
$$;

create or replace function public.wedding_divorce(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  w public.weddings;
  v_nick text;
begin
  select * into w from public.weddings where id = p_id and status = 'married' and v_uid in (partner_a, partner_b) for update;
  if w.id is null then raise exception 'Union introuvable.'; end if;
  update public.weddings set status = 'divorced', ended_at = now() where id = w.id;
  select nickname into v_nick from public.profiles where id = v_uid;
  insert into public.notifications (user_id, type, title, body, link)
  values (case when w.partner_a = v_uid then w.partner_b else w.partner_a end,
          'wedding', 'Union rompue', coalesce(v_nick, 'Ton conjoint') || ' a mis fin à votre union.', '/dashboard/mariage');
end;
$$;

-- Administration : annuler une union (abus, compte quitté…).
create or replace function public.wedding_annul(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  w public.weddings;
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  update public.weddings set status = 'annulled', ended_at = now()
  where id = p_id and status in ('married', 'proposed')
  returning * into w;
  if w.id is null then raise exception 'Union introuvable.'; end if;
  perform public.write_audit('wedding_annulled', w.partner_a, jsonb_build_object('union', w.id, 'avec', w.partner_b));
  insert into public.notifications (user_id, type, title, body, link)
  select x, 'wedding', 'Union annulée', 'L''administration a annulé votre union.', '/dashboard/mariage'
  from unnest(array[w.partner_a, w.partner_b]) x;
end;
$$;

create or replace function public.wedding_wish(p_id uuid, p_message text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  w public.weddings;
  v_msg text := trim(coalesce(p_message, ''));
  v_nick text;
  v_new boolean;
begin
  if v_uid is null or not public._wedding_open(v_uid) then raise exception 'Les mariages ne sont pas encore ouverts.'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then raise exception 'Compte inactif.'; end if;
  select * into w from public.weddings where id = p_id and status = 'married';
  if w.id is null then raise exception 'Union introuvable.'; end if;
  if v_uid in (w.partner_a, w.partner_b) then raise exception 'Les mariés ne se félicitent pas eux-mêmes.'; end if;
  if char_length(v_msg) < 1 or char_length(v_msg) > 280 then raise exception 'Un message de 1 à 280 caractères.'; end if;

  v_new := not exists (select 1 from public.wedding_wishes where wedding_id = w.id and user_id = v_uid);
  insert into public.wedding_wishes (wedding_id, user_id, message) values (w.id, v_uid, v_msg)
  on conflict (wedding_id, user_id) do update set message = excluded.message, created_at = now();

  if v_new then
    select nickname into v_nick from public.profiles where id = v_uid;
    perform public._notify_grouped(x, 'wedding', 'voeux:' || w.id, 'Félicitations',
                                   coalesce(v_nick, 'Un membre') || ' : « ' || left(v_msg, 120) || ' »',
                                   null, 'messages de félicitations', '/dashboard/mariage')
    from unnest(array[w.partner_a, w.partner_b]) x;
  end if;
end;
$$;

create or replace function public.wedding_wish_remove(p_id uuid, p_user uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid := coalesce(p_user, auth.uid());
begin
  if v_target <> v_uid and not public.has_permission(v_uid, 'manage_users') then raise exception 'Permission refusée.'; end if;
  delete from public.wedding_wishes where wedding_id = p_id and user_id = v_target;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Droits d'exécution
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._notify_grouped(uuid, text, text, text, text, numeric, text, text)',
    'public.notifications_cleanup()',
    'public._alert_signature(text, jsonb)',
    'public.alert_mark_normal(bigint)',
    'public.alert_exemptions_list()',
    'public.alert_exemption_delete(bigint)',
    'public.wishlist_toggle(uuid)',
    'public.wishlist_list(uuid)',
    'public.wishlist_wanters(uuid)',
    'public.shop_gift(uuid, uuid, int, text)',
    'public._wishlist_on_item_change()',
    'public._wishlist_on_auction()',
    'public._poll_visible(timestamptz)',
    'public.poll_create(text, text, text[], boolean, boolean, text, timestamptz, boolean, timestamptz)',
    'public.polls_publish_due()',
    'public.poll_publish_now(uuid)',
    'public.poll_vote(uuid, uuid[])',
    'public.polls_list(int)',
    'public.auctions_remind_due()',
    'public.run_scheduled_jobs()',
    'public.maybe_run_jobs()',
    'public.get_admin_stats_more()',
    'public.site_reveals()',
    'public._wedding_open(uuid)',
    'public.set_wedding_public(boolean)',
    'public._wedding_person(uuid)',
    'public._wedding_json(public.weddings, uuid)',
    'public.wedding_state()',
    'public.wedding_propose(uuid, text, text)',
    'public.wedding_answer(uuid, boolean, text)',
    'public.wedding_cancel(uuid)',
    'public.wedding_divorce(uuid)',
    'public.wedding_annul(uuid)',
    'public.wedding_wish(uuid, text)',
    'public.wedding_wish_remove(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
  end loop;

  -- Internes : pas d'appel direct depuis le site.
  foreach f in array array[
    'public._notify_grouped(uuid, text, text, text, text, numeric, text, text)',
    'public.notifications_cleanup()',
    'public._wishlist_on_item_change()',
    'public._wishlist_on_auction()',
    'public.polls_publish_due()',
    'public.auctions_remind_due()',
    'public.run_scheduled_jobs()',
    'public._wedding_person(uuid)',
    'public._wedding_json(public.weddings, uuid)'
  ] loop
    execute format('revoke all on function %s from authenticated', f);
  end loop;

  foreach f in array array[
    'public._alert_signature(text, jsonb)',
    'public.alert_mark_normal(bigint)',
    'public.alert_exemptions_list()',
    'public.alert_exemption_delete(bigint)',
    'public.wishlist_toggle(uuid)',
    'public.wishlist_list(uuid)',
    'public.wishlist_wanters(uuid)',
    'public.shop_gift(uuid, uuid, int, text)',
    'public._poll_visible(timestamptz)',
    'public.poll_create(text, text, text[], boolean, boolean, text, timestamptz, boolean, timestamptz)',
    'public.poll_publish_now(uuid)',
    'public.poll_vote(uuid, uuid[])',
    'public.polls_list(int)',
    'public.maybe_run_jobs()',
    'public.get_admin_stats_more()',
    'public.site_reveals()',
    'public._wedding_open(uuid)',
    'public.set_wedding_public(boolean)',
    'public.wedding_state()',
    'public.wedding_propose(uuid, text, text)',
    'public.wedding_answer(uuid, boolean, text)',
    'public.wedding_cancel(uuid)',
    'public.wedding_divorce(uuid)',
    'public.wedding_annul(uuid)',
    'public.wedding_wish(uuid, text)',
    'public.wedding_wish_remove(uuid, uuid)'
  ] loop
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  -- Le décor des pages publiques lit site_reveals sans être connecté.
  grant execute on function public.site_reveals() to anon;
end;
$$;
