-- =========================================================
-- Correctif des statistiques.
--
-- Cause du décalage d'heures ("heure la plus active", carte thermique,
-- "actifs aujourd'hui", visites) : Postgres travaille en UTC, donc tout
-- était calculé sur l'heure UTC au lieu de l'heure de Paris (1 à 2 h de
-- décalage). Tous les calculs passent maintenant par un fuseau configurable
-- (app_config.stats_timezone, 'Europe/Paris' par défaut).
--
-- Autres améliorations :
-- - séries complètes (les semaines/jours sans activité valent 0 au lieu
--   d'être absents -> courbes correctes) ;
-- - série quotidienne sur 30 jours (messages + visites) ;
-- - argent en circulation, entreprises actives, caisse d'impôts ;
-- - statistiques par objet de boutique avec semaines vides à 0.
--
-- Pour changer de fuseau :
--   update public.app_config set value = 'America/Montreal' where key = 'stats_timezone';
-- =========================================================

insert into public.app_config (key, value) values ('stats_timezone', 'Europe/Paris')
on conflict (key) do nothing;

create or replace function public.stats_timezone()
returns text
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select value from public.app_config where key = 'stats_timezone'), 'Europe/Paris');
$$;

-- Le "jour" d'une visite est désormais le jour local, pas le jour UTC.
create or replace function public.record_visit()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set last_seen_at = now() where id = auth.uid();

  insert into public.activity_log (user_id, day, visits)
  values (auth.uid(), (now() at time zone public.stats_timezone())::date, 1)
  on conflict (user_id, day) do update set visits = public.activity_log.visits + 1;
end;
$$;

create or replace function public.get_admin_stats()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_tz text := public.stats_timezone();
  v_now_local timestamp := now() at time zone public.stats_timezone();
  v_today date := (now() at time zone public.stats_timezone())::date;
  v_week0 date := date_trunc('week', now() at time zone public.stats_timezone())::date;
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
  v_daily jsonb;
  v_heatmap jsonb;
  v_top_item jsonb;
  v_top_buyer jsonb;
  v_top_seller jsonb;
  v_purchases_weekly jsonb;
  v_money numeric;
  v_businesses int;
  v_tax numeric;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée';
  end if;

  select count(*) into v_total_members from public.profiles;
  select count(*) into v_active_members from public.profiles where status = 'active';
  select count(*) into v_pending_members from public.profiles where status = 'pending';
  select count(*) into v_banned_members from public.profiles where status = 'banned';

  -- minuit local converti en instant absolu
  select count(*) into v_active_today from public.profiles
    where last_seen_at >= (v_today::timestamp at time zone v_tz);

  select coalesce(sum(visits), 0) into v_visits_week from public.activity_log where day >= v_today - 6;
  select coalesce(sum(visits), 0) into v_visits_month from public.activity_log where day >= v_today - 29;

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

  -- Heure la plus active (heure locale), à égalité : la plus tôt dans la journée.
  select h into v_peak_hour
    from (
      select extract(hour from created_at at time zone v_tz)::int as h, count(*) as cnt
      from public.chat_messages
      where not is_deleted
      group by 1
    ) x
    order by cnt desc, h asc
    limit 1;

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
  where end_day >= v_today - 1;

  -- 8 dernières semaines, semaines vides incluses
  select coalesce(jsonb_agg(jsonb_build_object('week_start', w.ws, 'message_count', coalesce(c.cnt, 0)) order by w.ws), '[]'::jsonb)
    into v_weekly
    from (select (v_week0 - 7 * g) as ws from generate_series(0, 7) g) w
    left join (
      select date_trunc('week', created_at at time zone v_tz)::date as ws, count(*) as cnt
      from public.chat_messages
      where not is_deleted and created_at >= now() - interval '9 weeks'
      group by 1
    ) c on c.ws = w.ws;

  -- 30 derniers jours, jours vides inclus
  select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'messages', coalesce(m.cnt, 0), 'visits', coalesce(v.visits, 0)) order by d.day), '[]'::jsonb)
    into v_daily
    from (select (v_today - 29 + g) as day from generate_series(0, 29) g) d
    left join (
      select (created_at at time zone v_tz)::date as day, count(*) as cnt
      from public.chat_messages
      where not is_deleted and created_at >= now() - interval '32 days'
      group by 1
    ) m on m.day = d.day
    left join (
      select day, sum(visits) as visits
      from public.activity_log
      where day >= v_today - 29
      group by day
    ) v on v.day = d.day;

  select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'count', cnt)), '[]'::jsonb)
    into v_heatmap
    from (
      select extract(dow from created_at at time zone v_tz)::int as dow,
             extract(hour from created_at at time zone v_tz)::int as hour,
             count(*) as cnt
      from public.chat_messages
      where not is_deleted
      group by 1, 2
    ) h;

  select jsonb_build_object('name', si.name, 'quantity', s.qty)
    into v_top_item
    from (
      select item_id, sum(quantity) as qty
      from public.purchases
      group by item_id
      order by qty desc
      limit 1
    ) s
    join public.shop_items si on si.id = s.item_id;

  select jsonb_build_object('nickname', p.nickname, 'total_spent', s.total)
    into v_top_buyer
    from (
      select user_id, sum(total_price) as total
      from public.purchases
      group by user_id
      order by total desc
      limit 1
    ) s
    join public.profiles p on p.id = s.user_id;

  select jsonb_build_object('nickname', p.nickname, 'total_earned', s.total)
    into v_top_seller
    from (
      select user_id, sum(amount) as total
      from public.transactions
      where reason like 'Vente : %'
      group by user_id
      order by total desc
      limit 1
    ) s
    join public.profiles p on p.id = s.user_id;

  select coalesce(jsonb_agg(jsonb_build_object('week_start', w.ws, 'purchases_count', coalesce(c.cnt, 0), 'total_value', coalesce(c.val, 0)) order by w.ws), '[]'::jsonb)
    into v_purchases_weekly
    from (select (v_week0 - 7 * g) as ws from generate_series(0, 7) g) w
    left join (
      select date_trunc('week', created_at at time zone v_tz)::date as ws, count(*) as cnt, sum(total_price) as val
      from public.purchases
      where created_at >= now() - interval '9 weeks'
      group by 1
    ) c on c.ws = w.ws;

  select coalesce(sum(balance), 0) into v_money from public.wallets;
  select count(*) into v_businesses from public.businesses where not is_closed;
  select coalesce(balance, 0) into v_tax from public.tax_pool where id = true;

  return jsonb_build_object(
    'timezone', v_tz,
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
    'daily_activity', v_daily,
    'heatmap', v_heatmap,
    'top_selling_item', v_top_item,
    'top_buyer', v_top_buyer,
    'top_seller', v_top_seller,
    'purchases_weekly', v_purchases_weekly,
    'money_in_circulation', v_money,
    'businesses_count', v_businesses,
    'tax_pool_balance', coalesce(v_tax, 0)
  );
end;
$$;

-- Statistiques par objet : semaines vides à 0 (courbe continue), fuseau local.
create or replace function public.get_shop_item_stats(p_item_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_tz text := public.stats_timezone();
  v_week0 date := date_trunc('week', now() at time zone public.stats_timezone())::date;
  v_item public.shop_items;
  v_quantity_sold bigint;
  v_revenue numeric;
  v_unique_buyers bigint;
  v_weekly jsonb;
begin
  select * into v_item from public.shop_items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Objet introuvable';
  end if;

  if not (v_item.created_by = auth.uid() or public.has_permission(auth.uid(), 'manage_shop')) then
    raise exception 'Permission refusée';
  end if;

  select coalesce(sum(quantity), 0), coalesce(sum(total_price), 0), count(distinct user_id)
    into v_quantity_sold, v_revenue, v_unique_buyers
    from public.purchases
    where item_id = p_item_id;

  select coalesce(jsonb_agg(jsonb_build_object('week_start', w.ws, 'quantity', coalesce(c.qty, 0), 'revenue', coalesce(c.rev, 0)) order by w.ws), '[]'::jsonb)
    into v_weekly
    from (select (v_week0 - 7 * g) as ws from generate_series(0, 7) g) w
    left join (
      select date_trunc('week', created_at at time zone v_tz)::date as ws, sum(quantity) as qty, sum(total_price) as rev
      from public.purchases
      where item_id = p_item_id and created_at >= now() - interval '9 weeks'
      group by 1
    ) c on c.ws = w.ws;

  return jsonb_build_object(
    'item_name', v_item.name,
    'quantity_sold', v_quantity_sold,
    'revenue', v_revenue,
    'unique_buyers', v_unique_buyers,
    'weekly_sales', v_weekly
  );
end;
$$;
