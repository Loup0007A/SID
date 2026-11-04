-- =====================================================================
-- 0079 — Notifications push : chaque message compte, abonnement fiable,
--        test et diagnostic
-- =====================================================================
--
-- 1. Les notifications de messagerie sont regroupées par conversation (le
--    compteur augmente au lieu de créer une ligne) : seul le PREMIER message
--    non lu déclenchait un push. Le push part maintenant aussi quand le
--    compteur augmente ou qu'une notification lue redevient non lue.
-- 2. S'abonner depuis un appareil déjà utilisé par un autre compte échouait
--    (l'abonnement appartenait à l'autre compte) : push_subscribe le reprend.
-- 3. push_self_test : s'envoyer une notification de test par la chaîne
--    complète (base → pg_net → site → appareil).
-- 4. push_diagnostic (admins) : pg_net, réglages app_config, et les dernières
--    réponses du site à pg_net (401 = secret différent, 404 = mauvaise
--    adresse, 501 = clés VAPID absentes sur Vercel…).
--
-- RÉGLAGES NÉCESSAIRES (une fois, dans le SQL Editor) :
--   insert into public.app_config (key, value) values
--     ('site_url', 'https://sid-quest.vercel.app'),
--     ('push_webhook_secret', '<le même texte que PUSH_WEBHOOK_SECRET sur Vercel>')
--   on conflict (key) do update set value = excluded.value;
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Push aussi à la mise à jour (messagerie regroupée)
-- ---------------------------------------------------------------------
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
    -- Seulement s'il y a du nouveau : compteur en hausse, ou notification
    -- lue qui redevient non lue.
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
  -- Jamais bloquer la notification de la cloche à cause du push.
  return new;
end;
$$;

drop trigger if exists trg_push_on_notification_update on public.notifications;
create trigger trg_push_on_notification_update
  after update on public.notifications
  for each row execute function public.trigger_push_notification();

-- ---------------------------------------------------------------------
-- 2. S'abonner (reprend l'abonnement de l'appareil s'il était à un autre compte)
-- ---------------------------------------------------------------------
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error', 'not_authenticated'); end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    return jsonb_build_object('error', 'invalid');
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> v_uid;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id;
  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Notification de test (chaîne complète), une par minute au plus
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
  v_types text[];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'notifications_type_check';
  if v_def is null or v_def like '%push_test%' then return; end if;
  -- Deux écritures possibles : ARRAY['a'::text, 'b'::text] ou '{a,b}'::text[].
  if v_def ~ '\{' then
    v_types := string_to_array(substring(v_def from '\{([^}]*)\}'), ',');
  else
    select array_agg(m[1]) into v_types from regexp_matches(v_def, '''([a-z_]+)''', 'g') as m;
  end if;
  if v_types is null or cardinality(v_types) < 5 then
    raise exception 'Liste des types de notification illisible (%), migration arrêtée par prudence.', v_def;
  end if;
  alter table public.notifications drop constraint notifications_type_check;
  execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))',
                 array_append(v_types, 'push_test'));
end;
$$;

create or replace function public.push_self_test()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error', 'not_authenticated'); end if;
  if exists (select 1 from public.notifications where user_id = v_uid and type = 'push_test' and created_at > now() - interval '1 minute') then
    return jsonb_build_object('error', 'too_soon');
  end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (v_uid, 'push_test', 'Test du S.I.D.', 'Si tu lis ceci sur ton écran, les notifications push fonctionnent.', '/dashboard/profile');
  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Diagnostic du push côté base (admins)
-- ---------------------------------------------------------------------
create or replace function public.push_diagnostic()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_recent jsonb := '[]'::jsonb;
  v_has_net boolean := exists (select 1 from pg_extension where extname = 'pg_net');
begin
  if not (public.has_permission(auth.uid(), 'manage_users')
          or coalesce((select is_founder from public.profiles where id = auth.uid()), false)) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if v_has_net and to_regclass('net._http_response') is not null then
    execute $q$
      select coalesce(jsonb_agg(r order by r->>'at' desc), '[]'::jsonb) from (
        select jsonb_build_object('status', status_code, 'error', error_msg, 'timed_out', timed_out,
                                  'body', left(coalesce(content, ''), 160), 'at', created) as r
          from net._http_response order by created desc limit 8
      ) s
    $q$ into v_recent;
  end if;
  return jsonb_build_object(
    'pg_net', v_has_net,
    'site_url', (select value from public.app_config where key = 'site_url'),
    'secret_set', exists (select 1 from public.app_config where key = 'push_webhook_secret' and coalesce(value, '') <> ''),
    'subscriptions', (select count(*) from public.push_subscriptions),
    'subscribers', (select count(distinct user_id) from public.push_subscriptions),
    'recent', v_recent
  );
end;
$$;

revoke execute on function public.push_subscribe(text, text, text) from public, anon;
revoke execute on function public.push_self_test() from public, anon;
revoke execute on function public.push_diagnostic() from public, anon;
grant execute on function public.push_subscribe(text, text, text) to authenticated;
grant execute on function public.push_self_test() to authenticated;
grant execute on function public.push_diagnostic() to authenticated;
