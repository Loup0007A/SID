-- =========================================================
-- Modération : mute (empêche d'envoyer des messages en chat, mais laisse
-- le compte actif et visible). Le bannissement utilise déjà le statut
-- 'banned' existant sur profiles — rien à ajouter côté schéma pour ça,
-- juste l'UI admin (voir /dashboard/admin/users).
-- =========================================================

alter table public.profiles add column is_muted boolean not null default false;

drop policy if exists "chat_messages_insert" on public.chat_messages;

create policy "chat_messages_insert" on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_channel_participant(channel_id, auth.uid())
    and not coalesce((select is_muted from public.profiles where id = auth.uid()), false)
  );

-- Pratique pour l'écran admin : liste tous les profils, quel que soit leur
-- statut (y compris "pending"/"banned"/"rejected"), réservé à manage_users.
create or replace function public.list_all_profiles_for_admin()
returns setof public.profiles
language sql
stable
security definer set search_path = public
as $$
  select * from public.profiles
  where public.has_permission(auth.uid(), 'manage_users')
  order by created_at desc;
$$;
