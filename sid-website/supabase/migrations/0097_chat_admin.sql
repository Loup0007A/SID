-- =====================================================================
-- 0097 — Lot 80 : chat Admin
-- =====================================================================
-- Rejouable. À lancer après 0096.
--
-- Un salon « Admin » dans la messagerie, réservé à l'administration :
-- comptes actifs au grade Fondateur (rôle ou statut) ou avec « Gérer les
-- comptes ». Jamais un compte de test (bac à sable).
--
--   - Les membres du salon sont tenus à jour par la base (changement de
--     rôle, de permission, de statut) : personne ne s'y ajoute à la main.
--   - Un seul compte, réglé dans app_config.admin_chat_owner (Kuro), peut
--     épingler des messages en haut du salon, supprimer n'importe quel
--     message du salon et poser des liens vers les autres lieux du S.I.D.
--     ([[/dashboard/…|Texte]], affichés comme des boutons).
--   - Les règles d'or de base sont posées et épinglées au nom de ce compte
--     dès qu'il existe.
-- =====================================================================

-- ---------------------------------------------------------------- Réglage
-- Identifiant du compte (ou son pseudo s'il n'existe pas encore).
insert into public.app_config (key, value) values
  ('admin_chat_owner', coalesce((select id::text from public.profiles where lower(nickname) = 'kuro' limit 1), 'Kuro'))
on conflict (key) do nothing;

-- ---------------------------------------------------------------- Salon
alter table public.chat_channels drop constraint if exists chat_channels_type_check;
alter table public.chat_channels add constraint chat_channels_type_check
  check (type in ('dm', 'group', 'application', 'admin'));
create unique index if not exists chat_channels_one_admin on public.chat_channels ((true)) where type = 'admin';

-- Personne ne crée le salon Admin ni ne s'y ajoute soi-même.
drop policy if exists "chat_channels_insert" on public.chat_channels;
create policy "chat_channels_insert" on public.chat_channels for insert
  with check (created_by = auth.uid() and type <> 'admin');

-- Lu sans les droits de l'appelant : il ne voit pas le salon Admin, la
-- politique ne doit pas conclure pour autant que ce n'en est pas un.
create or replace function public._chat_is_admin_channel(p_channel uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.chat_channels where id = p_channel and type = 'admin');
$$;

drop policy if exists "chat_participants_insert" on public.chat_participants;
create policy "chat_participants_insert" on public.chat_participants for insert
  with check (
    not public._chat_is_admin_channel(channel_id)
    and (
      user_id = auth.uid()
      or exists (select 1 from public.chat_channels c where c.id = channel_id and c.created_by = auth.uid())
      or (
        exists (select 1 from public.chat_channels c where c.id = channel_id and c.type = 'group')
        and public.is_channel_participant(channel_id, auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------- Qui
create or replace function public._admin_chat_owner()
returns uuid
language sql stable security definer set search_path = public
as $$
  with v as (select coalesce((select value from public.app_config where key = 'admin_chat_owner'), '') as v)
  select case
    when v.v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (select id from public.profiles where id = v.v::uuid)
    else (select id from public.profiles where lower(nickname) = lower(v.v) and v.v <> '' limit 1)
  end
  from v;
$$;

create or replace function public._admin_chat_member(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_uid and p.status = 'active'
      and not exists (select 1 from public.sandbox_accounts s where s.user_id = p.id)
      and (p.is_founder
           or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                      where ur.user_id = p.id and r.name = 'Fondateur')
           or public.has_permission(p.id, 'manage_users'))
  );
$$;

revoke execute on function public._admin_chat_owner() from public, anon, authenticated;
revoke execute on function public._admin_chat_member(uuid) from public, anon, authenticated;

-- Crée le salon s'il manque, ajoute qui y a droit, retire qui ne l'a plus.
create or replace function public._admin_chat_sync()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_chan uuid;
begin
  select id into v_chan from public.chat_channels where type = 'admin';
  if v_chan is null then
    insert into public.chat_channels (type, name, created_by)
    values ('admin', 'Admin', public._admin_chat_owner())
    on conflict do nothing
    returning id into v_chan;
    if v_chan is null then
      select id into v_chan from public.chat_channels where type = 'admin';
    end if;
  end if;

  delete from public.chat_participants cp
  where cp.channel_id = v_chan and not public._admin_chat_member(cp.user_id);

  insert into public.chat_participants (channel_id, user_id)
  select v_chan, p.id from public.profiles p
  where public._admin_chat_member(p.id)
  on conflict do nothing;

  return v_chan;
end;
$$;
revoke execute on function public._admin_chat_sync() from public, anon, authenticated;

-- Tenu à jour à chaque changement de rôle, de permission, de statut ou de
-- compte de test.
create or replace function public.trg_admin_chat_sync()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public._admin_chat_sync();
  return null;
end;
$$;

drop trigger if exists trg_admin_chat_user_roles on public.user_roles;
create trigger trg_admin_chat_user_roles after insert or delete or update on public.user_roles
  for each statement execute function public.trg_admin_chat_sync();
drop trigger if exists trg_admin_chat_role_permissions on public.role_permissions;
create trigger trg_admin_chat_role_permissions after insert or delete or update on public.role_permissions
  for each statement execute function public.trg_admin_chat_sync();
drop trigger if exists trg_admin_chat_profiles on public.profiles;
create trigger trg_admin_chat_profiles after update of status, is_founder on public.profiles
  for each statement execute function public.trg_admin_chat_sync();
drop trigger if exists trg_admin_chat_sandbox on public.sandbox_accounts;
create trigger trg_admin_chat_sandbox after insert or delete on public.sandbox_accounts
  for each statement execute function public.trg_admin_chat_sync();

-- ---------------------------------------------------------------- Épingles
create table if not exists public.chat_pins (
  message_id uuid primary key references public.chat_messages(id) on delete cascade,
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  pinned_by uuid references public.profiles(id) on delete set null,
  pinned_at timestamptz not null default now()
);
create index if not exists chat_pins_channel_idx on public.chat_pins (channel_id, pinned_at);
alter table public.chat_pins enable row level security;
drop policy if exists "chat_pins_select" on public.chat_pins;
create policy "chat_pins_select" on public.chat_pins for select
  to authenticated using (public.is_channel_participant(channel_id, auth.uid()));
grant select on public.chat_pins to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.chat_pins;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

-- ---------------------------------------------------------------- Règles d'or
create or replace function public._admin_chat_seed_rules(p_chan uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid := public._admin_chat_owner();
  v_msg uuid;
begin
  if v_owner is null or coalesce((select value from public.app_config where key = 'admin_chat_rules_seeded'), '') = 'oui' then
    return;
  end if;

  insert into public.chat_messages (channel_id, sender_id, content, kind)
  values (p_chan, v_owner, E'RÈGLES D''OR DE L''ADMINISTRATION\n\n'
    || E'1. Vérifier le motif de chaque retrait avant de le valider. Motif absent ou flou : on refuse, en disant pourquoi. [[/dashboard/admin/economy#retraits|Retraits à valider]]\n\n'
    || E'2. Jamais pour soi : pas de virement, de titre, de grade ni de déblocage sur son propre compte, ni sur un compte de test qu''on utilise.\n\n'
    || E'3. Chaque sanction (mute, gel, amende, retrait d''objet, bannissement) a un motif écrit, que le membre peut lire.\n\n'
    || E'4. En cas de doute, on demande ici avant d''agir. Une décision lourde (bannissement, faillite forcée, réforme monétaire) se prend à deux.\n\n'
    || E'5. Une erreur se corrige tout de suite et se signale ici : on rembourse, puis on écrit ce qui s''est passé.\n\n'
    || E'6. Avant d''accuser, on vérifie le journal d''audit. [[/dashboard/admin/audit|Journal d''audit]]\n\n'
    || E'7. Pas de faveur pour un ami, pas de représailles contre un rival, en jeu comme hors jeu.\n\n'
    || E'8. Ce qui se dit ici reste ici. Les données d''un membre ne servent qu''à l''administration.',
    'say')
  returning id into v_msg;

  insert into public.chat_pins (message_id, channel_id, pinned_by) values (v_msg, p_chan, v_owner)
  on conflict do nothing;

  insert into public.app_config (key, value) values ('admin_chat_rules_seeded', 'oui')
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke execute on function public._admin_chat_seed_rules(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- RPC
-- Ouvre le salon : le synchronise et dit si l'appelant en est le maître.
create or replace function public.admin_chat_open()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_chan uuid;
  v_owner uuid;
begin
  if not public._admin_chat_member(auth.uid()) then
    return jsonb_build_object('error', 'not_member');
  end if;
  v_chan := public._admin_chat_sync();
  perform public._admin_chat_seed_rules(v_chan);
  v_owner := public._admin_chat_owner();
  return jsonb_build_object(
    'channel_id', v_chan,
    'owner_id', v_owner,
    'owner_nickname', (select nickname from public.profiles where id = v_owner),
    'is_owner', v_owner is not null and v_owner = auth.uid());
end;
$$;

-- Épingler / désépingler (maître du salon seulement).
create or replace function public.admin_chat_pin(p_message_id uuid, p_on boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_chan uuid;
begin
  if public._admin_chat_owner() is distinct from auth.uid() then
    return jsonb_build_object('error', 'not_owner');
  end if;
  select m.channel_id into v_chan
  from public.chat_messages m join public.chat_channels c on c.id = m.channel_id
  where m.id = p_message_id and c.type = 'admin' and not m.is_deleted;
  if v_chan is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if p_on then
    insert into public.chat_pins (message_id, channel_id, pinned_by) values (p_message_id, v_chan, auth.uid())
    on conflict (message_id) do nothing;
  else
    delete from public.chat_pins where message_id = p_message_id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Supprimer n'importe quel message du salon (maître du salon seulement).
create or replace function public.admin_chat_delete(p_message_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if public._admin_chat_owner() is distinct from auth.uid() then
    return jsonb_build_object('error', 'not_owner');
  end if;
  update public.chat_messages m set is_deleted = true
  from public.chat_channels c
  where m.id = p_message_id and c.id = m.channel_id and c.type = 'admin';
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  delete from public.chat_pins where message_id = p_message_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_chat_open() from public, anon;
revoke execute on function public.admin_chat_pin(uuid, boolean) from public, anon;
revoke execute on function public.admin_chat_delete(uuid) from public, anon;
grant execute on function public.admin_chat_open() to authenticated;
grant execute on function public.admin_chat_pin(uuid, boolean) to authenticated;
grant execute on function public.admin_chat_delete(uuid) to authenticated;

-- Premier remplissage.
do $$
begin
  perform public._admin_chat_seed_rules(public._admin_chat_sync());
end;
$$;

notify pgrst, 'reload schema';
