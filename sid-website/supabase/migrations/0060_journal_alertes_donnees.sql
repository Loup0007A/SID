-- =========================================================
-- 0060 : journal par membre, alertes d'activité inhabituelle,
--        CGU, données personnelles (export, suppression, durées)
-- =========================================================
-- Valable pour les trois sites (Dossier Central, Cartographie, Wiki) :
-- ils partagent la même base et les mêmes comptes. Les tables de la carte
-- et du wiki sont utilisées seulement si elles existent.

-- ---------------------------------------------------------
-- 1. Conditions générales et politique de confidentialité
-- ---------------------------------------------------------
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

create or replace function public.accept_terms(p_version text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté.';
  end if;
  if p_version is null or char_length(p_version) > 20 then
    raise exception 'Version invalide.';
  end if;
  update public.profiles set terms_version = p_version, terms_accepted_at = now() where id = auth.uid();
end;
$$;

-- Inscription : l'acceptation cochée sur le formulaire est enregistrée.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, first_name, last_name, nickname, weapons, equipment,
    description, age, avatar_url, desired_role, terms_version, terms_accepted_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'nickname', ''),
    new.raw_user_meta_data->>'weapons',
    new.raw_user_meta_data->>'equipment',
    new.raw_user_meta_data->>'description',
    nullif(new.raw_user_meta_data->>'age', '')::int,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'desired_role',
    nullif(left(new.raw_user_meta_data->>'terms_version', 20), ''),
    case when nullif(new.raw_user_meta_data->>'terms_version', '') is not null then now() end
  );
  return new;
end;
$$;

-- ---------------------------------------------------------
-- 2. Alertes d'activité inhabituelle
-- ---------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'chat_message', 'quest_validated', 'quest_failed', 'application_decision',
  'quest_confirmation_needed', 'travel_arrived', 'salary_paid', 'money_received',
  'sanction', 'announcement', 'raid_call', 'admin_alert'
));

create table if not exists public.activity_alerts (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  kind text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  details jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  created_at timestamptz not null default now(),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz
);

create index if not exists activity_alerts_status_idx on public.activity_alerts (status, created_at desc);
create index if not exists activity_alerts_user_idx on public.activity_alerts (user_id, created_at desc);
create index if not exists chat_messages_sender_time_idx on public.chat_messages (sender_id, created_at desc);
create index if not exists transactions_user_time_idx on public.transactions (user_id, created_at desc);

alter table public.activity_alerts enable row level security;
drop policy if exists "activity_alerts_select" on public.activity_alerts;
create policy "activity_alerts_select" on public.activity_alerts for select
  using (public.has_permission(auth.uid(), 'manage_users'));

-- Les admins à prévenir : gestion des comptes, comptes actifs, pas de compte de test.
create or replace function public._alert_recipients(p_exclude uuid default null)
returns setof uuid
language sql
stable
security definer set search_path = public
as $$
  select p.id from public.profiles p
  where p.status = 'active'
    and p.id is distinct from p_exclude
    and not public.is_sandbox_account(p.id)
    and public.has_permission(p.id, 'manage_users');
$$;

-- Montant lisible : « +15 000 », « 27 000 ».
create or replace function public._fmt_z(p numeric, p_sign boolean default false)
returns text
language sql
immutable
as $$
  select case when p_sign and p > 0 then '+' when p < 0 then '-' else '' end
      || regexp_replace(abs(round(p))::bigint::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g');
$$;

-- Crée une alerte (une seule par clé). p_notify : prévient tout de suite les
-- admins (sinon, le détecteur envoie un seul récapitulatif à la fin).
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
begin
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

-- Seuils (modifiables par la gestion des comptes, stockés dans app_config).
create or replace function public.get_alert_settings()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'alert_big_tx',        public.get_config_numeric('alert_big_tx', 10000),
    'alert_daily_gain',    public.get_config_numeric('alert_daily_gain', 25000),
    'alert_msgs_hour',     public.get_config_numeric('alert_msgs_hour', 60),
    'alert_sim_hour',      public.get_config_numeric('alert_sim_hour', 15),
    'alert_sim_min_s',     public.get_config_numeric('alert_sim_min_s', 8),
    'alert_admin_burst',   public.get_config_numeric('alert_admin_burst', 15),
    'alert_purchases_hour', public.get_config_numeric('alert_purchases_hour', 20),
    'alert_dormant_days',  public.get_config_numeric('alert_dormant_days', 60)
  );
$$;

create or replace function public.set_alert_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  k text;
  v numeric;
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  for k in select jsonb_object_keys(p_settings) loop
    if k not in ('alert_big_tx', 'alert_daily_gain', 'alert_msgs_hour', 'alert_sim_hour', 'alert_sim_min_s',
                 'alert_admin_burst', 'alert_purchases_hour', 'alert_dormant_days') then
      raise exception 'Réglage inconnu : %', k;
    end if;
    v := (p_settings ->> k)::numeric;
    if v is null or v < 0 then
      raise exception 'Valeur invalide pour %', k;
    end if;
    insert into public.app_config (key, value) values (k, v::text)
    on conflict (key) do update set value = excluded.value;
  end loop;
  perform public.write_audit('alert_settings_changed', null, p_settings);
  return public.get_alert_settings();
end;
$$;

-- Le détecteur. Chaque règle a sa clé de dédoublonnage (une alerte par
-- mouvement, par heure, par jour…). Les comptes de test ne déclenchent pas
-- d'alerte pour eux-mêmes (mais les actions d'admin, si).
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
    from public.activity_alerts where id > v_max_id;
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

-- Durées de conservation (voir la politique de confidentialité).
create or replace function public.apply_data_retention()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.activity_log where day < current_date - 395;
  delete from public.notifications where is_read and created_at < now() - interval '180 days';
  delete from public.activity_alerts where status <> 'open' and created_at < now() - interval '365 days';
  delete from public.audit_log where created_at < now() - interval '3 years';
end;
$$;

-- Appelée à chaque visite du site par n'importe quel membre : lance le
-- détecteur au plus toutes les 3 minutes, et le nettoyage une fois par jour.
create or replace function public.maybe_scan_activity_alerts()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_last timestamptz;
  v_ret date;
begin
  if auth.uid() is null then
    return 0;
  end if;
  select value::timestamptz into v_last from public.app_config where key = 'alerts_last_scan';
  if v_last is not null and v_last > now() - interval '3 minutes' then
    return 0;
  end if;
  insert into public.app_config (key, value) values ('alerts_last_scan', now()::text)
  on conflict (key) do update set value = excluded.value;

  select value::date into v_ret from public.app_config where key = 'retention_last_run';
  if v_ret is null or v_ret < current_date then
    insert into public.app_config (key, value) values ('retention_last_run', current_date::text)
    on conflict (key) do update set value = excluded.value;
    perform public.apply_data_retention();
  end if;

  return public.scan_activity_alerts();
end;
$$;

create or replace function public.count_open_alerts()
returns int
language sql
stable
security definer set search_path = public
as $$
  select case when public.has_permission(auth.uid(), 'manage_users') and not public.is_sandbox_account(auth.uid())
    then (select count(*)::int from public.activity_alerts where status = 'open') else 0 end;
$$;

create or replace function public.list_activity_alerts(p_status text default 'open', p_user uuid default null, p_limit int default 200)
returns table (
  id bigint, user_id uuid, nickname text, kind text, severity text, title text, details jsonb,
  status text, created_at timestamptz, handled_by_nickname text, handled_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select a.id, a.user_id, p.nickname, a.kind, a.severity, a.title, a.details, a.status, a.created_at, h.nickname, a.handled_at
  from public.activity_alerts a
  left join public.profiles p on p.id = a.user_id
  left join public.profiles h on h.id = a.handled_by
  where public.has_permission(auth.uid(), 'manage_users') and not public.is_sandbox_account(auth.uid())
    and (p_status = 'all' or a.status = p_status)
    and (p_user is null or a.user_id = p_user)
  order by (a.status = 'open') desc,
           case a.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
           a.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
$$;

create or replace function public.set_alert_status(p_id bigint, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if p_status not in ('open', 'resolved', 'ignored') then
    raise exception 'Statut invalide.';
  end if;
  update public.activity_alerts
  set status = p_status,
      handled_by = case when p_status = 'open' then null else auth.uid() end,
      handled_at = case when p_status = 'open' then null else now() end
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------
-- 3. Journal par membre (gestion des comptes)
-- ---------------------------------------------------------
create or replace function public.admin_member_timeline(p_user uuid, p_days int default 60, p_limit int default 400)
returns table (at timestamptz, source text, action text, label text, details jsonb, amount numeric, actor text)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 60), 1), 3650));
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;

  return query
  select * from (
    -- Administration : ce qu'on lui a fait, et ce qu'il a fait (s'il est admin)
    select a.created_at, 'admin'::text,
           a.action, case when a.actor_id = p_user and a.target_user_id is distinct from p_user then 'a agi sur ' || coalesce(a.target_label, '—') else null end,
           a.details, null::numeric, a.actor_nickname
    from public.audit_log a
    where (a.target_user_id = p_user or a.actor_id = p_user) and a.created_at > v_since
    union all
    select t.created_at, 'argent', 'transaction', t.reason, null::jsonb, t.amount::numeric, null::text
    from public.transactions t where t.user_id = p_user and t.created_at > v_since
    union all
    select pu.created_at, 'boutique', 'achat',
           coalesce(si.name, 'Objet') || case when pu.quantity > 1 then ' ×' || pu.quantity else '' end,
           jsonb_build_object('statut', pu.status), -pu.total_price::numeric, null::text
    from public.purchases pu left join public.shop_items si on si.id = pu.item_id
    where pu.user_id = p_user and pu.created_at > v_since
    union all
    select qp.joined_at, 'quete', 'participation', q.title, jsonb_build_object('statut', qp.status), null::numeric, null::text
    from public.quest_participants qp join public.quests q on q.id = qp.quest_id
    where qp.user_id = p_user and qp.joined_at > v_since
    union all
    select q.created_at, 'quete', 'creation', q.title, null::jsonb, null::numeric, null::text
    from public.quests q where q.created_by = p_user and q.created_at > v_since
    union all
    select coalesce(r.finished_at, r.started_at), 'simulation', r.kind, r.status,
           jsonb_build_object('points', r.points_awarded,
                              'duree_s', case when r.finished_at is not null then extract(epoch from r.finished_at - r.started_at)::int end),
           null::numeric, null::text
    from public.simulation_runs r where r.user_id = p_user and r.started_at > v_since
    union all
    -- Messages : seulement le nombre par jour, jamais le contenu
    select max(m.created_at), 'messages', 'messages', null::text,
           jsonb_build_object('nombre', count(*), 'salons', count(distinct m.channel_id)), null::numeric, null::text
    from public.chat_messages m where m.sender_id = p_user and m.created_at > v_since
    group by date_trunc('day', m.created_at)
    union all
    select (al.day + time '12:00')::timestamptz, 'visite', 'visites', null::text,
           jsonb_build_object('nombre', al.visits), null::numeric, null::text
    from public.activity_log al where al.user_id = p_user and al.day > v_since::date
    union all
    select sa.created_at, 'sanction', sa.type, sa.reason,
           jsonb_build_object('active', sa.is_active, 'expire', sa.expires_at), sa.amount::numeric,
           (select nickname from public.profiles where id = sa.issued_by)
    from public.sanctions sa where sa.user_id = p_user and sa.created_at > v_since
    union all
    select pl.created_at, 'puissance', 'puissance', null::text,
           jsonb_build_object('avant', pl.old_score, 'apres', pl.new_score), null::numeric,
           (select nickname from public.profiles where id = pl.changed_by)
    from public.power_score_log pl where pl.user_id = p_user and pl.created_at > v_since
    union all
    select tp.created_at, 'techno', tp.node, null::text, jsonb_build_object('niveau', tp.level, 'cout', tp.cost), null::numeric, null::text
    from public.tech_purchases tp where tp.user_id = p_user and tp.created_at > v_since
    union all
    select bm.joined_at, 'raid', 'raid', null::text, null::jsonb, null::numeric, null::text
    from public.boss_raid_members bm where bm.user_id = p_user and bm.joined_at > v_since
    union all
    select aa.created_at, 'alerte', aa.kind, aa.title, aa.details || jsonb_build_object('gravite', aa.severity, 'statut', aa.status), null::numeric, null::text
    from public.activity_alerts aa where aa.user_id = p_user and aa.created_at > v_since
  ) x
  order by 1 desc
  limit least(greatest(coalesce(p_limit, 400), 1), 2000);
end;
$$;

create or replace function public.admin_member_summary(p_user uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  select jsonb_build_object(
    'profil', to_jsonb(p) - 'hidden_fields',
    'email', (select u.email from auth.users u where u.id = p.id),
    'solde', coalesce((select w.balance from public.wallets w where w.user_id = p.id), 0),
    'banque', coalesce((select b.balance from public.bank_accounts b where b.user_id = p.id), 0),
    'roles', coalesce((select jsonb_agg(r.name order by r.rank desc) from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p.id), '[]'::jsonb),
    'stats', (select to_jsonb(ms) - 'user_id' from public.member_stats ms where ms.user_id = p.id),
    'sanctions_actives', (select count(*) from public.sanctions sa where sa.user_id = p.id and sa.is_active),
    'messages_24h', (select count(*) from public.chat_messages m where m.sender_id = p.id and m.created_at > now() - interval '24 hours'),
    'messages_7j', (select count(*) from public.chat_messages m where m.sender_id = p.id and m.created_at > now() - interval '7 days'),
    'visites_30j', coalesce((select sum(a.visits) from public.activity_log a where a.user_id = p.id and a.day > current_date - 30), 0),
    'jours_actifs_30j', (select count(*) from public.activity_log a where a.user_id = p.id and a.day > current_date - 30),
    'entrees_7j', coalesce((select sum(t.amount) from public.transactions t where t.user_id = p.id and t.amount > 0 and t.created_at > now() - interval '7 days'), 0),
    'sorties_7j', coalesce((select sum(t.amount) from public.transactions t where t.user_id = p.id and t.amount < 0 and t.created_at > now() - interval '7 days'), 0),
    'quetes_en_cours', (select count(*) from public.quest_participants qp where qp.user_id = p.id and qp.status in ('assigned', 'submitted')),
    'quetes_validees', (select count(*) from public.quest_participants qp where qp.user_id = p.id and qp.status = 'validated'),
    'simulations_7j', (select count(*) from public.simulation_runs r where r.user_id = p.id and r.started_at > now() - interval '7 days'),
    'alertes_ouvertes', (select count(*) from public.activity_alerts aa where aa.user_id = p.id and aa.status = 'open'),
    'compte_test', (select to_jsonb(sb) - 'email' from public.sandbox_accounts sb where sb.user_id = p.id),
    'demande_suppression', (select to_jsonb(pr) from public.privacy_requests pr where pr.user_id = p.id and pr.status = 'pending' order by pr.created_at desc limit 1)
  ) into v
  from public.profiles p where p.id = p_user;
  return v;
end;
$$;

-- ---------------------------------------------------------
-- 4. Données personnelles : export, demande de suppression
-- ---------------------------------------------------------
create table if not exists public.privacy_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'deletion' check (kind in ('deletion')),
  reason text check (reason is null or char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'done', 'refused', 'cancelled')),
  created_at timestamptz not null default now(),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  note text
);

alter table public.privacy_requests enable row level security;
drop policy if exists "privacy_requests_select" on public.privacy_requests;
create policy "privacy_requests_select" on public.privacy_requests for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));

-- Tout ce que la base garde sur le membre connecté, dans un seul document.
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
      ('wiki_signalements', 'public.wiki_reports', 'author_id')
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

create or replace function public.request_account_deletion(p_reason text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_nick text;
begin
  if v_uid is null then
    raise exception 'Non connecté.';
  end if;
  if public.is_sandbox_account(v_uid) then
    raise exception 'Un compte de test est effacé automatiquement : pas besoin de demande.';
  end if;
  select id into v_id from public.privacy_requests where user_id = v_uid and status = 'pending' limit 1;
  if v_id is null then
    insert into public.privacy_requests (user_id, kind, reason) values (v_uid, 'deletion', nullif(btrim(left(p_reason, 1000)), ''))
    returning id into v_id;
    select nickname into v_nick from public.profiles where id = v_uid;
    perform public._raise_alert(v_uid, 'demande_suppression', 'warning', 'Demande de suppression de compte',
      jsonb_build_object('motif', nullif(btrim(left(p_reason, 1000)), '')), 'del:' || v_id);
    perform public.write_audit('deletion_requested', v_uid, jsonb_build_object('motif', nullif(btrim(left(p_reason, 1000)), '')));
  end if;
  return (select to_jsonb(pr) from public.privacy_requests pr where pr.id = v_id);
end;
$$;

create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.privacy_requests set status = 'cancelled', handled_at = now()
  where user_id = auth.uid() and status = 'pending';
  if found then
    update public.activity_alerts set status = 'resolved', handled_at = now()
    where user_id = auth.uid() and kind = 'demande_suppression' and status = 'open';
    perform public.write_audit('deletion_cancelled', auth.uid(), '{}'::jsonb);
  end if;
end;
$$;

-- L'administration refuse une demande (avec un mot d'explication).
create or replace function public.refuse_account_deletion(p_user uuid, p_note text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  update public.privacy_requests set status = 'refused', handled_by = auth.uid(), handled_at = now(), note = left(p_note, 1000)
  where user_id = p_user and status = 'pending';
  update public.activity_alerts set status = 'resolved', handled_by = auth.uid(), handled_at = now()
  where user_id = p_user and kind = 'demande_suppression' and status = 'open';
  perform public.write_audit('deletion_refused', p_user, jsonb_build_object('note', left(p_note, 1000)));
end;
$$;

-- ---------------------------------------------------------
-- 5. Effacement des données d'un compte (commun : compte de test, ou
--    membre qui a demandé la suppression). Les liens sans cascade vers le
--    profil sont vidés ; les lignes obligatoires (messages…) sont supprimées.
--    Compte de test : ce qu'il a créé est supprimé aussi.
-- ---------------------------------------------------------
create or replace function public._purge_member_data(p_user uuid, p_delete_created boolean)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_done int := 0;
  v_failed text[] := '{}';
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, a.attnotnull as notnull
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and c.confdeltype in ('a', 'r')
      and array_length(c.conkey, 1) = 1
      and c.conrelid not in ('public.sandbox_accounts'::regclass, 'public.privacy_requests'::regclass)
  loop
    begin
      if r.notnull or (p_delete_created and r.col in ('created_by', 'sender_id', 'founder_id')) then
        execute format('delete from %s where %I = $1', r.tbl, r.col) using p_user;
      else
        execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using p_user;
      end if;
      v_done := v_done + 1;
    exception when others then
      v_failed := v_failed || (r.tbl::text || '.' || r.col);
    end;
  end loop;

  -- Tables de la carte sans clé étrangère vers le profil
  begin
    if to_regclass('public.mount_rental_log') is not null then
      execute 'delete from public.mount_rental_log where user_id = $1' using p_user;
    end if;
    if to_regclass('public.black_market_sales') is not null then
      execute 'delete from public.black_market_sales where buyer_id = $1 or seller_id = $1' using p_user;
    end if;
  exception when others then
    v_failed := v_failed || 'carte'::text;
  end;

  return jsonb_build_object('liens_nettoyes', v_done, 'echecs', v_failed);
end;
$$;

revoke execute on function public._purge_member_data(uuid, boolean) from public, anon, authenticated;
revoke execute on function public._raise_alert(uuid, text, text, text, jsonb, text, boolean) from public, anon, authenticated;
revoke execute on function public.scan_activity_alerts() from public, anon, authenticated;
revoke execute on function public.apply_data_retention() from public, anon, authenticated;

create or replace function public.purge_sandbox_account(p_user uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_nick text;
  v_res jsonb;
begin
  if v_admin is null or not public.has_permission(v_admin, 'manage_users') or public.is_sandbox_account(v_admin) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if not public.is_sandbox_account(p_user) then
    raise exception 'Ce compte n''est pas un compte de test : il ne peut pas être effacé ici.';
  end if;
  select nickname into v_nick from public.profiles where id = p_user;
  update public.sandbox_accounts set expires_at = least(expires_at, now()) where user_id = p_user;
  update public.profiles set status = 'banned' where id = p_user;
  v_res := public._purge_member_data(p_user, true);
  perform public.write_audit('sandbox_deleted', p_user, v_res, v_nick);
  return v_res || jsonb_build_object('ok', true);
end;
$$;

-- Suppression d'un vrai compte : seulement s'il l'a demandée, jamais un fondateur.
create or replace function public.purge_member_for_deletion(p_user uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_nick text;
  v_res jsonb;
begin
  if v_admin is null or not public.has_permission(v_admin, 'manage_users') or public.is_sandbox_account(v_admin) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if p_user = v_admin then
    raise exception 'Tu ne peux pas effacer ton propre compte d''ici.';
  end if;
  if coalesce((select is_founder from public.profiles where id = p_user), false) then
    raise exception 'Un compte fondateur ne peut pas être effacé.';
  end if;
  if not exists (select 1 from public.privacy_requests where user_id = p_user and status = 'pending') then
    raise exception 'Ce membre n''a pas demandé la suppression de son compte.';
  end if;
  select nickname into v_nick from public.profiles where id = p_user;
  update public.profiles set status = 'banned' where id = p_user;
  v_res := public._purge_member_data(p_user, false);
  update public.privacy_requests set status = 'done', handled_by = v_admin, handled_at = now() where user_id = p_user and status = 'pending';
  perform public.write_audit('account_deleted', p_user, v_res, v_nick);
  return v_res || jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.purge_member_for_deletion(uuid) to authenticated;
