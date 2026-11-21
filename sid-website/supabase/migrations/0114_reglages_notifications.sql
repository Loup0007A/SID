-- =====================================================================
-- 0114 — Réglages : choix des notifications (Lot 93)
-- À lancer après 0113. Peut être relancée sans risque.
--
-- Chaque membre choisit, par catégorie, s'il reçoit une notification
-- partout (cloche + push), sur le site seulement (pas de push) ou jamais.
-- Certaines restent toujours reçues (quêtes, sanctions, annonces, impôts,
-- litiges…). Heures calmes : pas de push entre deux heures (les
-- notifications restent dans la cloche).
-- =====================================================================

alter table public.profiles add column if not exists notif_muted text[] not null default '{}';
alter table public.profiles add column if not exists notif_push_muted text[] not null default '{}';
alter table public.profiles add column if not exists push_quiet_start smallint;
alter table public.profiles add column if not exists push_quiet_end smallint;
do $$ begin
  alter table public.profiles add constraint profiles_push_quiet_check
    check ((push_quiet_start is null and push_quiet_end is null)
        or (push_quiet_start between 0 and 23 and push_quiet_end between 0 and 23 and push_quiet_start <> push_quiet_end));
exception when duplicate_object then null;
end $$;

-- Types qu'un membre peut couper. Les autres arrivent toujours.
create or replace function public._notif_mutable(p_type text)
returns boolean
language sql immutable
as $$
  select p_type = any (array[
    'chat_message', 'money_received', 'salary_paid', 'auction', 'market', 'gift', 'wishlist',
    'business', 'quest_gacha', 'title', 'troll', 'poll', 'wedding',
    'travel_arrived', 'exploration', 'incursion', 'wiki', 'propriete'
  ]);
$$;

-- Heures calmes en cours pour ce membre (heure du jeu, stats_timezone).
create or replace function public._push_quiet_now(p_start smallint, p_end smallint)
returns boolean
language plpgsql stable
as $$
declare
  h int;
begin
  if p_start is null or p_end is null then return false; end if;
  h := extract(hour from now() at time zone public.stats_timezone())::int;
  if p_start < p_end then return h >= p_start and h < p_end; end if;
  return h >= p_start or h < p_end;   -- passe minuit (22 h → 8 h)
end;
$$;

-- Avant tout le reste : une notification coupée n'est pas créée.
create or replace function public._notifications_mute()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public._notif_mutable(new.type)
     and exists (select 1 from public.profiles p where p.id = new.user_id and new.type = any (p.notif_muted)) then
    return null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notifications_0_mute on public.notifications;
create trigger trg_notifications_0_mute before insert on public.notifications
  for each row execute function public._notifications_mute();

-- Push (reprend la version en place) : pas de push pour une catégorie
-- « site seulement » ni pendant les heures calmes.
create or replace function public.trigger_push_notification()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_site_url text;
  v_secret text;
  v_body text := new.body;
  v_prefs record;
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

  if new.type <> 'push_test' then
    select notif_push_muted, push_quiet_start, push_quiet_end into v_prefs
      from public.profiles where id = new.user_id;
    if public._notif_mutable(new.type) and new.type = any (coalesce(v_prefs.notif_push_muted, '{}')) then
      return new;
    end if;
    if public._push_quiet_now(v_prefs.push_quiet_start, v_prefs.push_quiet_end) then
      return new;
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

-- Lire ses choix.
create or replace function public.notif_prefs_get()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'muted', to_jsonb(coalesce(p.notif_muted, '{}')),
    'push_muted', to_jsonb(coalesce(p.notif_push_muted, '{}')),
    'quiet_start', p.push_quiet_start,
    'quiet_end', p.push_quiet_end)
  from public.profiles p where p.id = auth.uid();
$$;

-- Enregistrer ses choix (types inconnus ou toujours reçus : refusés).
create or replace function public.notif_prefs_set(p_muted text[], p_push_muted text[], p_quiet_start int, p_quiet_end int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  t text;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  foreach t in array coalesce(p_muted, '{}') || coalesce(p_push_muted, '{}') loop
    if not public._notif_mutable(t) then raise exception 'Ces notifications ne peuvent pas être coupées : %.', t; end if;
  end loop;
  if (p_quiet_start is null) <> (p_quiet_end is null) then raise exception 'Donne le début et la fin des heures calmes.'; end if;
  if p_quiet_start is not null and (p_quiet_start not between 0 and 23 or p_quiet_end not between 0 and 23 or p_quiet_start = p_quiet_end) then
    raise exception 'Heures calmes : deux heures différentes, de 0 à 23.';
  end if;
  update public.profiles
     set notif_muted = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(p_muted, '{}')) x),
         notif_push_muted = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(p_push_muted, '{}')) x
                              where not x = any (coalesce(p_muted, '{}'))),
         push_quiet_start = p_quiet_start,
         push_quiet_end = p_quiet_end
   where id = auth.uid();
  return public.notif_prefs_get();
end;
$$;

revoke execute on function public._notifications_mute() from public, anon, authenticated;
revoke execute on function public.notif_prefs_get() from public, anon;
revoke execute on function public.notif_prefs_set(text[], text[], int, int) from public, anon;
grant execute on function public.notif_prefs_get() to authenticated;
grant execute on function public.notif_prefs_set(text[], text[], int, int) to authenticated;

notify pgrst, 'reload schema';
