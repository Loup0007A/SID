-- =====================================================================
-- Lot 71 : notifications regroupées sur deux heures. Rejouable. Après 0087.
--
-- Jusqu'ici, une notification regroupée (0081) ne l'était que tant qu'elle
-- n'avait pas été lue : dès qu'on l'ouvrait, le message suivant en créait
-- une nouvelle. Un fil de litige actif donnait ainsi une notification par
-- message.
--
-- Désormais, une notification du même sujet arrivée moins de deux heures
-- après la précédente la rejoint, lue ou non :
--   - elle redevient non lue et remonte en haut de la liste ;
--   - son texte montre la dernière nouvelle, « Voir le détail » les liste
--     toutes ;
--   - une notification push part quand le groupe se rouvre (comme pour une
--     nouvelle notification), pas à chaque ajout d'un groupe non lu.
-- Même sujet = même groupe (0081), ou, pour les autres notifications, même
-- type, même titre et même lien. Restent à part : messages privés (déjà
-- regroupés par conversation), annonces, sanctions, tests push.
-- La durée se règle dans app_config.notif_group_window_minutes (120).
-- Les doublons déjà reçus sont fusionnés au lancement.
-- =====================================================================

insert into public.app_config (key, value) values ('notif_group_window_minutes', '120')
on conflict (key) do nothing;

create or replace function public._notif_window()
returns interval
language sql stable security definer set search_path = public
as $$
  select make_interval(mins => greatest(0, public.get_config_numeric('notif_group_window_minutes', 120))::int);
$$;

-- Types jamais fusionnés automatiquement.
create or replace function public._notif_solo(p_type text)
returns boolean
language sql immutable
as $$
  select p_type in ('chat_message', 'announcement', 'sanction', 'push_test');
$$;

-- ---------------------------------------------------------------------
-- 1. Regroupement explicite (0081) : lu ou non, sur deux heures
-- ---------------------------------------------------------------------
create or replace function public._notify_grouped(p_user uuid, p_type text, p_key text, p_title text, p_line text,
                                                  p_amount numeric default null, p_unit text default 'notifications',
                                                  p_link text default null)
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
  where user_id = p_user and type = p_type and group_key = p_key
    and (updated_at > now() - public._notif_window()
         or (not is_read and (created_at at time zone v_tz)::date = (now() at time zone v_tz)::date))
  order by updated_at desc
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
      -- Des montants : le total. Sinon : la dernière nouvelle.
      body = case when v_total is not null
                  then (v_row.count + 1) || ' ' || p_unit || case when v_total <> 0 then ' · ' || public._fmt_z(v_total, true) || ' z' else '' end
                  else p_line end,
      title = p_title,
      link = coalesce(p_link, v_row.link),
      is_read = false,
      seen_at = null,
      updated_at = now()
  where id = v_row.id;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Les autres notifications : même type, titre et lien sur deux heures
-- ---------------------------------------------------------------------
create or replace function public._notifications_merge()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.notifications;
  v_details jsonb;
begin
  if new.group_key is not null or public._notif_solo(new.type) or public._notif_window() = interval '0' then
    return new;
  end if;

  select * into v_row from public.notifications
  where user_id = new.user_id and type = new.type and title = new.title
    and coalesce(link, '') = coalesce(new.link, '')
    and (group_key is null or group_key like 'auto:%')
    and updated_at > now() - public._notif_window()
  order by updated_at desc
  limit 1
  for update;
  if v_row.id is null then return new; end if;

  v_details := case when jsonb_array_length(coalesce(v_row.details, '[]'::jsonb)) > 0 then v_row.details
                    else jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('at', v_row.created_at, 'text', v_row.body))) end;
  if jsonb_array_length(v_details) >= 100 then v_details := v_details - 0; end if;

  update public.notifications
  set count = coalesce(v_row.count, 1) + 1,
      details = v_details || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('at', now(), 'text', new.body))),
      body = new.body,
      group_key = coalesce(v_row.group_key, 'auto:' || md5(new.type || '|' || new.title || '|' || coalesce(new.link, ''))),
      is_read = false,
      seen_at = null,
      updated_at = now()
  where id = v_row.id;
  return null;
end;
$$;

drop trigger if exists trg_notifications_merge on public.notifications;
create trigger trg_notifications_merge before insert on public.notifications
  for each row execute function public._notifications_merge();

-- ---------------------------------------------------------------------
-- 3. Push : un groupe qui se rouvre part en notification push
-- ---------------------------------------------------------------------
create or replace function public.trigger_push_notification()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_site_url text;
  v_secret text;
  v_body text := new.body;
begin
  if tg_op = 'UPDATE' then
    if new.group_key is not null then
      -- Groupe déjà lu qui reçoit une nouvelle : comme une nouvelle notification.
      if not (old.is_read and not new.is_read) then
        return new;
      end if;
    else
      if not (coalesce(new.count, 1) > coalesce(old.count, 1) or (old.is_read and not new.is_read)) then
        return new;
      end if;
      if coalesce(new.count, 1) > 1 then
        v_body := new.count || ' nouveaux messages · ' || coalesce(new.body, '');
      end if;
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
      'tag', case when new.type = 'chat_message' then 'chat:' || coalesce(new.link, '')
                  when new.group_key is not null then new.type || ':' || new.group_key
                  else new.type end
    )
  );
  return new;
exception when others then
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Les doublons déjà reçus : fusionnés (sans montant, 8 derniers jours)
-- ---------------------------------------------------------------------
do $$
declare
  g record;
  v_keep uuid;
begin
  for g in
    with n as (
      select x.*,
             coalesce(x.group_key, 'auto:' || md5(x.type || '|' || x.title || '|' || coalesce(x.link, ''))) as k
      from public.notifications x
      where not public._notif_solo(x.type) and x.amount is null and x.created_at > now() - interval '8 days'
    ), o as (
      select n.*,
             case when lag(n.updated_at) over w is null or n.created_at - lag(n.updated_at) over w > public._notif_window() then 1 else 0 end as brk
      from n window w as (partition by n.user_id, n.type, n.k order by n.created_at)
    ), i as (
      select o.*, sum(o.brk) over (partition by o.user_id, o.type, o.k order by o.created_at) as island from o
    )
    select user_id, type, k, island,
           array_agg(id order by created_at) as ids,
           min(created_at) as first_at,
           max(updated_at) as last_at,
           bool_and(is_read) as all_read,
           jsonb_agg(d order by (d->>'at')::timestamptz) filter (where d is not null) as details
    from i
    left join lateral (
      select e as d from jsonb_array_elements(case when jsonb_array_length(coalesce(i.details, '[]'::jsonb)) > 0 then i.details
                                                   else jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('at', i.created_at, 'text', i.body))) end) e
    ) dd on true
    group by user_id, type, k, island
    having count(distinct id) > 1
  loop
    v_keep := g.ids[array_length(g.ids, 1)];
    update public.notifications
    set count = jsonb_array_length(g.details),
        details = (select jsonb_agg(e.value order by e.ord) from jsonb_array_elements(g.details) with ordinality e(value, ord)
                   where e.ord > jsonb_array_length(g.details) - 100),
        group_key = coalesce(group_key, g.k),
        created_at = g.first_at,
        updated_at = g.last_at,
        is_read = g.all_read,
        seen_at = case when g.all_read then seen_at end
    where id = v_keep;
    delete from public.notifications where id = any (g.ids) and id <> v_keep;
  end loop;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['public._notif_window()', 'public._notif_solo(text)', 'public._notifications_merge()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
