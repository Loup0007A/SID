-- =====================================================================
-- Lot 72 : statistiques d'engagement (rétention, temps passé). Rejouable.
-- À lancer après 0088.
--
-- TEMPS PASSÉ
--   Le signal de présence (toutes les 45 s, 0063) ouvre ou prolonge une
--   session : plus de 10 minutes sans signal, la session est close. Le temps
--   entre deux signaux (2 minutes au plus) compte comme actif si le membre
--   n'est pas absent (onglet caché ou 5 min sans clic ni touche), sinon comme
--   absent. Il est aussi attribué à la page affichée, jour par jour. Le
--   client indique le type d'appareil (téléphone, tablette, ordinateur).
--   Mesuré à partir du lancement de cette migration.
--
-- RÉTENTION
--   Calculée sur activity_log (une ligne par membre et par jour de visite),
--   donc sur tout l'historique : membres actifs par jour, semaine, mois,
--   retours après l'inscription, cohortes par semaine d'inscription, membres
--   perdus et membres à relancer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Sessions et temps par page
-- ---------------------------------------------------------------------
create table if not exists public.site_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_ping_at timestamptz not null default now(),
  active_seconds int not null default 0,
  idle_seconds int not null default 0,
  pings int not null default 1,
  page_views int not null default 1,
  first_page text,
  last_page text,
  device text check (device is null or device in ('mobile', 'tablette', 'ordinateur'))
);
create index if not exists site_sessions_user_idx on public.site_sessions (user_id, last_ping_at desc);
create index if not exists site_sessions_started_idx on public.site_sessions (started_at);

create table if not exists public.page_time_daily (
  day date not null,
  page text not null,
  seconds bigint not null default 0,
  views int not null default 0,
  primary key (day, page)
);

alter table public.site_sessions enable row level security;
alter table public.page_time_daily enable row level security;
revoke all on public.site_sessions, public.page_time_daily from anon, authenticated;

insert into public.app_config (key, value) values ('stats_tracking_since', now()::text)
on conflict (key) do nothing;

-- Le signal de présence (0063) + la session et le temps par page.
drop function if exists public.presence_ping(text, text, boolean);
create or replace function public.presence_ping(p_page text, p_extra text default null, p_idle boolean default false, p_device text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_page text;
  v_extra text;
  v_idle boolean := coalesce(p_idle, false);
  v_dev text := case when p_device in ('mobile', 'tablette', 'ordinateur') then p_device end;
  v_day date := (now() at time zone public.stats_timezone())::date;
  s public.site_sessions;
  v_delta int;
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
  values (v_uid, v_page, v_extra, v_idle, now(), now(), null)
  on conflict (user_id) do update set
    page = excluded.page,
    extra = excluded.extra,
    idle = excluded.idle,
    online_since = case when coalesce(pr.left_at, pr.updated_at) < now() - public._presence_ttl() then now() else pr.online_since end,
    updated_at = now(),
    left_at = null;

  delete from public.presence where updated_at < now() - interval '1 day';

  -- Session : prolongée si un signal est arrivé dans les 10 dernières minutes.
  if public.is_sandbox_account(v_uid) then return; end if;
  select * into s from public.site_sessions
  where user_id = v_uid and last_ping_at > now() - interval '10 minutes'
  order by last_ping_at desc limit 1
  for update;

  if s.id is null then
    insert into public.site_sessions (user_id, first_page, last_page, device) values (v_uid, v_page, v_page, v_dev);
    insert into public.page_time_daily (day, page, views) values (v_day, v_page, 1)
    on conflict (day, page) do update set views = public.page_time_daily.views + 1;
  else
    v_delta := least(greatest(extract(epoch from now() - s.last_ping_at), 0), 120)::int;
    update public.site_sessions
    set last_ping_at = now(),
        pings = pings + 1,
        active_seconds = active_seconds + case when v_idle then 0 else v_delta end,
        idle_seconds = idle_seconds + case when v_idle then v_delta else 0 end,
        page_views = page_views + case when v_page is distinct from s.last_page then 1 else 0 end,
        last_page = v_page,
        device = coalesce(device, v_dev)
    where id = s.id;
    -- Le temps écoulé appartient à la page affichée jusqu'ici.
    if not v_idle and v_delta > 0 then
      insert into public.page_time_daily (day, page, seconds) values (v_day, coalesce(s.last_page, v_page), v_delta)
      on conflict (day, page) do update set seconds = public.page_time_daily.seconds + excluded.seconds;
    end if;
    if v_page is distinct from s.last_page then
      insert into public.page_time_daily (day, page, views) values (v_day, v_page, 1)
      on conflict (day, page) do update set views = public.page_time_daily.views + 1;
    end if;
  end if;

  -- Ménage de temps en temps : un an de sessions, un an de pages.
  if random() < 0.002 then
    delete from public.site_sessions where started_at < now() - interval '365 days';
    delete from public.page_time_daily where day < v_day - 365;
  end if;
end;
$$;

revoke all on function public.presence_ping(text, text, boolean, text) from public, anon;
grant execute on function public.presence_ping(text, text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Statistiques d'engagement (admins « Membres »)
-- ---------------------------------------------------------------------
create or replace function public.get_admin_stats_engagement()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz text := public.stats_timezone();
  v_today date := (now() at time zone public.stats_timezone())::date;
  v_week0 date := date_trunc('week', now() at time zone public.stats_timezone())::date;
  v_since timestamptz;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée';
  end if;
  v_since := coalesce((select min(started_at) from public.site_sessions),
                      (select value::timestamptz from public.app_config where key = 'stats_tracking_since'));

  return (
  with members as (
    select p.id, p.nickname, (p.created_at at time zone v_tz)::date as joined, p.last_seen_at
    from public.profiles p
    where p.status = 'active' and not public.is_sandbox_account(p.id)
  ),
  act as (
    select a.user_id, a.day, a.visits from public.activity_log a join members m on m.id = a.user_id
  ),
  coh as (
    select m.id, date_trunc('week', m.joined)::date as wk from members m where m.joined >= v_week0 - 7 * 9
  ),
  coh_k as (
    select c.wk, k,
           count(*) as size,
           count(*) filter (where exists (select 1 from act a where a.user_id = c.id and a.day between c.wk + 7 * k and c.wk + 7 * k + 6)) as back
    from coh c cross join generate_series(1, 8) k
    group by c.wk, k
  ),
  sess as (
    select s.*, (s.started_at at time zone v_tz) as local_start
    from public.site_sessions s join members m on m.id = s.user_id
    where s.started_at > now() - interval '30 days'
  )
  select jsonb_build_object(
    'since', v_since,
    'members', (select count(*) from members),

    -- Audience
    'dau', (select count(distinct user_id) from act where day = v_today),
    'wau', (select count(distinct user_id) from act where day > v_today - 7),
    'mau', (select count(distinct user_id) from act where day > v_today - 30),
    'dau_avg_30', (select round(avg(n), 2) from (
                     select d::date as day, (select count(distinct user_id) from act where act.day = d::date) as n
                     from generate_series(v_today - 29, v_today, interval '1 day') d) x),
    'new_7', (select count(*) from members where joined > v_today - 7),
    'new_30', (select count(*) from members where joined > v_today - 30),
    'returned_7', (select count(*) from members m
                   where exists (select 1 from act a where a.user_id = m.id and a.day > v_today - 7)
                     and exists (select 1 from act a where a.user_id = m.id and a.day <= v_today - 7)
                     and not exists (select 1 from act a where a.user_id = m.id and a.day between v_today - 37 and v_today - 7 - 1)),
    'daily', (select jsonb_agg(jsonb_build_object(
                'day', d::date,
                'active', (select count(distinct user_id) from act where act.day = d::date),
                'new', (select count(*) from members where joined = d::date)) order by d)
              from generate_series(v_today - 29, v_today, interval '1 day') d),

    -- Retours après l'inscription
    'retention', jsonb_build_object(
      'd1', (select jsonb_build_object('n', count(*), 'ok', count(*) filter (where exists (
                select 1 from act a where a.user_id = m.id and a.day = m.joined + 1)))
             from members m where m.joined <= v_today - 1),
      'd7', (select jsonb_build_object('n', count(*), 'ok', count(*) filter (where exists (
                select 1 from act a where a.user_id = m.id and a.day between m.joined + 7 and m.joined + 13)))
             from members m where m.joined <= v_today - 13),
      'd30', (select jsonb_build_object('n', count(*), 'ok', count(*) filter (where exists (
                select 1 from act a where a.user_id = m.id and a.day between m.joined + 30 and m.joined + 59)))
             from members m where m.joined <= v_today - 59)),

    -- Cohortes : semaine d'inscription → part revenue chaque semaine suivante
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('week', c.wk, 'size', c.size, 'weeks', c.weeks) order by c.wk), '[]'::jsonb)
                from (select wk, max(size) as size,
                             jsonb_agg(case when wk + 7 * k > v_today then null else round(100.0 * back / size) end order by k) as weeks
                      from coh_k group by wk) c),

    -- Perdus : actifs entre J-59 et J-30, plus vus depuis
    'churn', (select jsonb_build_object('base', count(*), 'lost', count(*) filter (where not exists (
                select 1 from act a where a.user_id = x.user_id and a.day > v_today - 30)))
              from (select distinct user_id from act where day between v_today - 59 and v_today - 30) x),
    'at_risk', (select coalesce(jsonb_agg(jsonb_build_object('nickname', r.nickname, 'last_day', r.last_day, 'days', r.days) order by r.days desc, r.last_day desc), '[]'::jsonb)
                from (select m.nickname, max(a.day) as last_day, count(*) as days
                      from members m join act a on a.user_id = m.id and a.day > v_today - 60
                      group by m.id, m.nickname
                      having max(a.day) <= v_today - 14 and count(*) >= 3
                      order by count(*) desc limit 10) r),

    -- Régularité : jours de visite sur 30 jours, par membre actif
    'frequency', (select jsonb_agg(jsonb_build_object('label', q.label, 'n', q.n) order by q.o)
                  from (select b.o, b.label, coalesce(sum(f.n), 0) as n
                        from (values (1, '1 jour', 1, 1), (2, '2 à 3 jours', 2, 3), (3, '4 à 7 jours', 4, 7), (4, '8 à 14 jours', 8, 14), (5, '15 jours et plus', 15, 31))
                             as b(o, label, lo, hi)
                        left join (select x.days, count(*) as n
                                   from (select user_id, count(*) as days from act where day > v_today - 30 group by user_id) x
                                   group by x.days) f on f.days between b.lo and b.hi
                        group by b.o, b.label) q),

    -- Temps passé (depuis le début de la mesure)
    'time', jsonb_build_object(
      'sessions_7', (select count(*) from sess where started_at > now() - interval '7 days'),
      'members_7', (select count(distinct user_id) from sess where started_at > now() - interval '7 days'),
      'hours_7', (select round(coalesce(sum(active_seconds), 0) / 3600.0, 1) from sess where started_at > now() - interval '7 days'),
      'avg_session', (select round(avg(active_seconds)) from sess where active_seconds > 0),
      'median_session', (select percentile_cont(0.5) within group (order by active_seconds) from sess where active_seconds > 0),
      'avg_day_member', (select round(avg(t)) from (select user_id, (local_start)::date, sum(active_seconds) as t from sess group by 1, 2) x),
      'sessions_day_member', (select round(avg(n), 2) from (select user_id, (local_start)::date, count(*) as n from sess group by 1, 2) x),
      'idle_share', (select round(sum(idle_seconds)::numeric / nullif(sum(idle_seconds + active_seconds), 0), 3) from sess),
      'pages_per_session', (select round(avg(page_views), 1) from sess),
      'buckets', (select jsonb_agg(jsonb_build_object('label', b.label, 'n', (select count(*) from sess where active_seconds >= b.lo and active_seconds < b.hi)) order by b.lo)
                  from (values ('moins d''1 min', 0, 60), ('1 à 5 min', 60, 300), ('5 à 15 min', 300, 900),
                               ('15 à 30 min', 900, 1800), ('30 min à 1 h', 1800, 3600), ('plus d''1 h', 3600, 2147483647)) b(label, lo, hi)),
      'daily', (select jsonb_agg(jsonb_build_object(
                  'day', d::date,
                  'minutes_member', (select round(avg(t) / 60.0, 1) from (select user_id, sum(active_seconds) as t from sess where local_start::date = d::date group by user_id) x),
                  'hours', (select round(coalesce(sum(active_seconds), 0) / 3600.0, 2) from sess where local_start::date = d::date)) order by d)
                from generate_series(v_today - 29, v_today, interval '1 day') d),
      'pages', (select coalesce(jsonb_agg(jsonb_build_object('page', p.page, 'seconds', p.s, 'views', p.v,
                                   'avg', case when p.v > 0 then round(p.s::numeric / p.v) end) order by p.s desc), '[]'::jsonb)
                from (select page, sum(seconds) as s, sum(views) as v from public.page_time_daily
                      where day > v_today - 30 group by page order by sum(seconds) desc limit 12) p),
      'heat', (select coalesce(jsonb_agg(jsonb_build_object('dow', h.dow, 'hour', h.hour, 'seconds', h.s)), '[]'::jsonb)
               from (select extract(dow from local_start)::int as dow, extract(hour from local_start)::int as hour, sum(active_seconds) as s
                     from sess group by 1, 2) h),
      'devices', (select coalesce(jsonb_agg(jsonb_build_object('device', coalesce(device, 'inconnu'), 'sessions', n, 'seconds', s) order by s desc), '[]'::jsonb)
                  from (select device, count(*) as n, sum(active_seconds) as s from sess group by device) d),
      'top', (select coalesce(jsonb_agg(jsonb_build_object('nickname', m.nickname, 'seconds', x.s) order by x.s desc), '[]'::jsonb)
              from (select user_id, sum(active_seconds) as s from sess where started_at > now() - interval '7 days'
                    group by user_id order by sum(active_seconds) desc limit 6) x
              join members m on m.id = x.user_id))
  )
  from (select 1) one
  );
end;
$$;

revoke all on function public.get_admin_stats_engagement() from public, anon;
grant execute on function public.get_admin_stats_engagement() to authenticated;
