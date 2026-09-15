-- =========================================================
-- Suivi de présence (nécessaire pour les statistiques : membres actifs
-- aujourd'hui, visites, heure/jour les plus actifs, série de jours actifs).
-- =========================================================

alter table public.profiles add column last_seen_at timestamptz;

-- Une ligne par membre et par jour où il s'est connecté au moins une fois ;
-- `visits` compte le nombre de fois où record_visit() a été appelée ce
-- jour-là (donc le nombre de "sessions"/chargements du dashboard, pas de
-- pages vues individuelles — reste léger même sur une communauté active).
create table public.activity_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  visits int not null default 1,
  primary key (user_id, day)
);

alter table public.activity_log enable row level security;

create policy "activity_log_select" on public.activity_log for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));

-- Aucune policy insert/update : on ne passe que par record_visit()
-- (SECURITY DEFINER), qui ne touche jamais qu'à la ligne de l'appelant.

create or replace function public.record_visit()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set last_seen_at = now() where id = auth.uid();

  insert into public.activity_log (user_id, day, visits)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set visits = public.activity_log.visits + 1;
end;
$$;

-- =========================================================
-- Statistiques agrégées pour le dashboard admin. Un seul appel renvoie un
-- objet JSON complet (évite de multiplier les allers-retours). Réservé à
-- la permission manage_users, comme les autres écrans d'administration.
--
-- Note : certaines statistiques "exemples" génériques (réactions/likes,
-- photos publiées, événements organisés) n'ont pas d'équivalent dans le
-- schéma de la S.I.D. et sont donc remplacées par des indicateurs propres
-- au site (quêtes créées/accomplies, achats en boutique).
-- =========================================================

create or replace function public.get_admin_stats()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_total_members int;
  v_active_members int;
  v_pending_members int;
  v_banned_members int;
  v_active_today int;
  v_visits_week int;
  v_visits_month int;
  v_messages_total int;
  v_most_active jsonb;
  v_quests_created int;
  v_quests_completed int;
  v_purchases_count int;
  v_purchases_total numeric;
  v_peak_hour int;
  v_streak int;
  v_weekly jsonb;
  v_heatmap jsonb;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée';
  end if;

  select count(*) into v_total_members from public.profiles;
  select count(*) into v_active_members from public.profiles where status = 'active';
  select count(*) into v_pending_members from public.profiles where status = 'pending';
  select count(*) into v_banned_members from public.profiles where status = 'banned';
  select count(*) into v_active_today from public.profiles where last_seen_at >= date_trunc('day', now());

  select coalesce(sum(visits), 0) into v_visits_week from public.activity_log where day >= current_date - 6;
  select coalesce(sum(visits), 0) into v_visits_month from public.activity_log where day >= current_date - 29;

  select count(*) into v_messages_total from public.chat_messages where not is_deleted;

  select jsonb_build_object('nickname', p.nickname, 'message_count', c.cnt)
    into v_most_active
    from (
      select sender_id, count(*) as cnt
      from public.chat_messages
      where not is_deleted
      group by sender_id
      order by cnt desc
      limit 1
    ) c
    join public.profiles p on p.id = c.sender_id;

  select count(*) into v_quests_created from public.quests;
  select count(*) into v_quests_completed from public.quests where status = 'completed';

  select count(*), coalesce(sum(total_price), 0) into v_purchases_count, v_purchases_total from public.purchases;

  select extract(hour from created_at)::int into v_peak_hour
    from public.chat_messages
    where not is_deleted
    group by 1
    order by count(*) desc
    limit 1;

  -- Série de jours consécutifs où au moins un membre s'est connecté,
  -- comptée seulement si elle touche aujourd'hui ou hier (sinon "cassée").
  with distinct_days as (
    select distinct day from public.activity_log
  ),
  grouped as (
    select day, day - (dense_rank() over (order by day))::int as grp
    from distinct_days
  ),
  streaks as (
    select grp, min(day) as start_day, max(day) as end_day, count(*) as len
    from grouped
    group by grp
  )
  select coalesce(max(len), 0) into v_streak
  from streaks
  where end_day >= current_date - 1;

  select coalesce(jsonb_agg(jsonb_build_object('week_start', week_start, 'message_count', message_count) order by week_start), '[]'::jsonb)
    into v_weekly
    from (
      select date_trunc('week', created_at)::date as week_start, count(*) as message_count
      from public.chat_messages
      where not is_deleted and created_at >= now() - interval '8 weeks'
      group by 1
    ) t;

  select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'count', cnt)), '[]'::jsonb)
    into v_heatmap
    from (
      select extract(dow from created_at)::int as dow, extract(hour from created_at)::int as hour, count(*) as cnt
      from public.chat_messages
      where not is_deleted
      group by 1, 2
    ) h;

  return jsonb_build_object(
    'total_members', v_total_members,
    'active_members', v_active_members,
    'pending_members', v_pending_members,
    'banned_members', v_banned_members,
    'active_today', v_active_today,
    'visits_week', v_visits_week,
    'visits_month', v_visits_month,
    'messages_total', v_messages_total,
    'most_active_member', v_most_active,
    'quests_created', v_quests_created,
    'quests_completed', v_quests_completed,
    'purchases_count', v_purchases_count,
    'purchases_total_value', v_purchases_total,
    'peak_hour', v_peak_hour,
    'streak_days', v_streak,
    'weekly_activity', v_weekly,
    'heatmap', v_heatmap
  );
end;
$$;
