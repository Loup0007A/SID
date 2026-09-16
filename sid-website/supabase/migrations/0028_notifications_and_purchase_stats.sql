-- =========================================================
-- Centre de notifications : jusqu'ici totalement absent du site (voir
-- README, section "limites connues"). Couvre : nouveau message reçu,
-- quête validée, décision sur une candidature, quête en attente de
-- confirmation (créateur), arrivée à destination (carte).
--
-- Aucune policy INSERT n'est créée volontairement : toute création passe
-- par des triggers SECURITY DEFINER ci-dessous, jamais par un insert
-- direct côté client — impossible pour quelqu'un de se notifier lui-même
-- ou de spammer un autre membre.
-- =========================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'chat_message', 'quest_validated', 'application_decision',
    'quest_confirmation_needed', 'travel_arrived', 'salary_paid'
  )),
  title text not null,
  body text,
  link text,
  count int not null default 1,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Réaltime, pour que la cloche se mette à jour sans recharger la page.
alter publication supabase_realtime add table public.notifications;

-- Les notifications de type "nouveau message" s'agrègent par salon plutôt
-- que de s'empiler à l'infini (ex : "3 nouveaux messages" au lieu de 3
-- lignes distinctes) — un seul index partiel sert de clé d'agrégation.
create unique index notifications_chat_aggregate_idx
  on public.notifications (user_id, link)
  where type = 'chat_message';

-- ---------------------------------------------------------
-- Nouveau message : notifie tous les autres participants du salon.
-- ---------------------------------------------------------
create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_link text;
  v_sender_nickname text;
begin
  if new.is_deleted then
    return new;
  end if;

  select nickname into v_sender_nickname from public.profiles where id = new.sender_id;
  v_link := '/dashboard/chat?channel=' || new.channel_id::text;

  for r in
    select user_id from public.chat_participants
    where channel_id = new.channel_id and user_id <> new.sender_id
  loop
    insert into public.notifications (user_id, type, title, body, link, count)
    values (r.user_id, 'chat_message', 'Nouveau message', coalesce(v_sender_nickname, 'Quelqu''un') || ' : ' || left(new.content, 80), v_link, 1)
    on conflict (user_id, link) where type = 'chat_message'
    do update set
      count = public.notifications.count + 1,
      body = excluded.body,
      is_read = false,
      updated_at = now();
  end loop;

  return new;
end;
$$;

create trigger trg_notify_chat_message
  after insert on public.chat_messages
  for each row execute function public.notify_chat_message();

-- ---------------------------------------------------------
-- Quête validée : notifie le participant qui l'a accomplie.
-- ---------------------------------------------------------
create or replace function public.notify_quest_validated()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_title text;
begin
  if new.status = 'validated' and old.status is distinct from 'validated' then
    select title into v_title from public.quests where id = new.quest_id;
    insert into public.notifications (user_id, type, title, body, link)
    values (new.user_id, 'quest_validated', 'Quête validée', '"' || coalesce(v_title, 'Une quête') || '" a été validée, ta récompense a été versée.', '/dashboard/quests');
  end if;
  return new;
end;
$$;

create trigger trg_notify_quest_validated
  after update on public.quest_participants
  for each row execute function public.notify_quest_validated();

-- ---------------------------------------------------------
-- Candidature traitée : notifie le candidat lui-même.
-- ---------------------------------------------------------
create or replace function public.notify_application_decision()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.status = 'pending' and new.status in ('active', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      new.id,
      'application_decision',
      case when new.status = 'active' then 'Candidature acceptée !' else 'Candidature refusée' end,
      case when new.status = 'active' then 'Bienvenue à la S.I.D. ! Ton dossier est actif.' else 'Ta candidature n''a pas été retenue.' end,
      '/dashboard'
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_application_decision
  after update on public.profiles
  for each row execute function public.notify_application_decision();

-- ---------------------------------------------------------
-- Quête en attente de confirmation : notifie son créateur.
-- ---------------------------------------------------------
create or replace function public.notify_quest_confirmation_needed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.pending_expiry_confirmation and not old.pending_expiry_confirmation and new.created_by is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.created_by, 'quest_confirmation_needed', 'Décision requise', 'Ta quête "' || new.title || '" a expiré près de son objectif : à toi de décider.', '/dashboard/quests');
  end if;
  return new;
end;
$$;

create trigger trg_notify_quest_confirmation
  after update on public.quests
  for each row execute function public.notify_quest_confirmation_needed();

-- ---------------------------------------------------------
-- Arrivée à destination (carte) : on complète advance_my_travel() pour
-- qu'elle notifie l'utilisateur au moment où son trajet se termine.
-- ---------------------------------------------------------
create or replace function public.advance_my_travel()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_pos public.character_positions;
  v_route public.map_routes;
  v_weight numeric;
  v_path_len numeric;
  v_elapsed numeric;
  v_current jsonb;
  v_remaining jsonb;
  v_next jsonb;
  v_place_name text;
begin
  select * into v_pos from public.character_positions where user_id = auth.uid() for update;

  if v_pos.user_id is null or v_pos.route_id is null or v_pos.travel_started_at is null then
    return;
  end if;

  select * into v_route from public.map_routes where id = v_pos.route_id;

  if v_route.id is null then
    update public.character_positions
      set route_id = null, route_progress = null, travel_started_at = null, planned_path = null
      where user_id = auth.uid();
    return;
  end if;

  if v_route.travel_minutes is not null then
    v_weight := v_route.travel_minutes;
  else
    select coalesce(sum(seg_len), 0) into v_path_len
    from (
      select sqrt(
        power((pt->>'x')::numeric - (lag(pt->>'x') over (order by ord))::numeric, 2) +
        power((pt->>'y')::numeric - (lag(pt->>'y') over (order by ord))::numeric, 2)
      ) as seg_len
      from jsonb_array_elements(coalesce(v_route.path_points, '[]'::jsonb)) with ordinality as t(pt, ord)
    ) s;
    v_weight := greatest(5, coalesce(v_path_len, 0) * 2);
  end if;

  v_elapsed := extract(epoch from (now() - v_pos.travel_started_at)) / 60.0;

  if v_elapsed < v_weight then
    update public.character_positions
      set route_progress = least(1, v_elapsed / greatest(v_weight, 0.001))
      where user_id = auth.uid();
    return;
  end if;

  v_current := coalesce(v_pos.planned_path -> 0, jsonb_build_object('route_id', v_pos.route_id, 'to_place_id', v_route.to_place_id));

  if v_pos.planned_path is not null and jsonb_array_length(v_pos.planned_path) > 1 then
    v_remaining := v_pos.planned_path - 0;
    v_next := v_remaining -> 0;
    update public.character_positions
      set route_id = (v_next->>'route_id')::uuid,
          route_progress = 0,
          travel_started_at = now(),
          planned_path = v_remaining
      where user_id = auth.uid();
  else
    update public.character_positions
      set place_id = (v_current->>'to_place_id')::uuid,
          building_id = null,
          route_id = null,
          route_progress = null,
          travel_started_at = null,
          planned_path = null
      where user_id = auth.uid();

    select name into v_place_name from public.map_places where id = (v_current->>'to_place_id')::uuid;
    insert into public.notifications (user_id, type, title, body, link)
    values (auth.uid(), 'travel_arrived', 'Arrivée à destination', 'Tu es arrivé' || coalesce(' à ' || v_place_name, '') || '.', '/dashboard/map');
  end if;
end;
$$;

-- ---------------------------------------------------------
-- Statistiques d'achats supplémentaires : objet le plus vendu, meilleur
-- acheteur, meilleur vendeur, évolution hebdomadaire des achats.
-- ---------------------------------------------------------
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
  v_top_item jsonb;
  v_top_buyer jsonb;
  v_top_seller jsonb;
  v_purchases_weekly jsonb;
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

  select coalesce(jsonb_agg(jsonb_build_object('week_start', week_start, 'purchases_count', purchases_count, 'total_value', total_value) order by week_start), '[]'::jsonb)
    into v_purchases_weekly
    from (
      select date_trunc('week', created_at)::date as week_start, count(*) as purchases_count, coalesce(sum(total_price), 0) as total_value
      from public.purchases
      where created_at >= now() - interval '8 weeks'
      group by 1
    ) t;

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
    'heatmap', v_heatmap,
    'top_selling_item', v_top_item,
    'top_buyer', v_top_buyer,
    'top_seller', v_top_seller,
    'purchases_weekly', v_purchases_weekly
  );
end;
$$;
