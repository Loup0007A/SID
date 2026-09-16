-- =========================================================
-- Notifications PUSH (navigateur), en plus de la cloche in-app.
--
-- Architecture : Postgres ne peut pas envoyer de notification push
-- lui-même (ça nécessite de signer une requête HTTP avec les clés VAPID,
-- ce qui se fait côté Node). Le flux est donc :
--   1) une notification est créée (triggers de la migration 0028)
--   2) un trigger ICI appelle, via l'extension pg_net, une route API du
--      site (POST /api/push/send) avec l'id du destinataire
--   3) cette route (côté Next.js) lit les abonnements push du membre dans
--      `push_subscriptions` et envoie les notifications via la librairie
--      `web-push`.
--
-- pg_net n'est pas garanti disponible sur tous les projets Supabase (comme
-- pg_cron) : le bloc d'activation ci-dessous échoue silencieusement si
-- l'extension n'existe pas, et le trigger d'appel avale aussi ses propres
-- erreurs pour ne JAMAIS bloquer la création d'une notification in-app à
-- cause d'un problème d'envoi push. Sans push configuré, la cloche
-- in-app continue de fonctionner normalement.
-- =========================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
exception when others then
  raise notice 'pg_net indisponible sur ce projet : les notifications resteront in-app uniquement (pas de push navigateur).';
end;
$$;

-- Abonnements push (un navigateur/appareil = un abonnement). Un membre peut
-- avoir plusieurs abonnements (plusieurs appareils).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_own" on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Petite table de configuration (URL du site + secret partagé avec la
-- route API), à remplir manuellement une fois le site déployé — voir la
-- notice d'installation. Tant qu'elle est vide, le trigger n'appelle rien.
create table public.app_config (
  key text primary key,
  value text
);

alter table public.app_config enable row level security;
-- Aucune policy select/insert/update pour les rôles authenticated/anon :
-- cette table ne doit être lue/modifiée que depuis le SQL Editor
-- (rôle postgres), jamais depuis le site.

create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_site_url text;
  v_secret text;
begin
  select value into v_site_url from public.app_config where key = 'site_url';
  select value into v_secret from public.app_config where key = 'push_webhook_secret';

  if v_site_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := v_site_url || '/api/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'title', new.title,
      'body', new.body,
      'link', new.link
    )
  );

  return new;
exception when others then
  -- pg_net absent, endpoint indisponible, etc. : on n'empêche jamais la
  -- notification in-app d'exister pour autant.
  return new;
end;
$$;

create trigger trg_push_on_notification
  after insert on public.notifications
  for each row execute function public.trigger_push_notification();
