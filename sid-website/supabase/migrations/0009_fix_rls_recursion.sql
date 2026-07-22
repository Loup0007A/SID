-- =========================================================
-- Correctif : "infinite recursion detected in policy for relation ..."
--
-- Cause n°1 (quests) : la policy de `quests` vérifiait `quest_participants`,
-- et la policy de `quest_participants` vérifiait `quests` en retour →
-- boucle infinie entre les deux tables dès qu'une quête privée était
-- concernée.
--
-- Cause n°2 (chat_participants) : la policy de `chat_participants`
-- vérifiait... `chat_participants` elle-même (auto-référence directe).
--
-- Solution : passer par des fonctions SECURITY DEFINER. Une fonction de ce
-- type s'exécute avec les droits de son propriétaire et n'est donc PAS
-- soumise au RLS de la table qu'elle interroge en interne — ça casse la
-- boucle, exactement comme has_permission() le fait déjà pour les rôles.
-- =========================================================

create or replace function public.is_quest_participant(p_quest_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.quest_participants qp
    where qp.quest_id = p_quest_id and qp.user_id = p_user_id
  );
$$;

create or replace function public.quest_created_by(p_quest_id uuid)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select created_by from public.quests where id = p_quest_id;
$$;

create or replace function public.is_channel_participant(p_channel_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.chat_participants cp
    where cp.channel_id = p_channel_id and cp.user_id = p_user_id
  );
$$;

-- ---- quests ----
drop policy if exists "quests_select" on public.quests;
create policy "quests_select" on public.quests for select
  using (
    visibility = 'public'
    or (visibility = 'members' and auth.uid() is not null)
    or (visibility = 'private' and (
      created_by = auth.uid()
      or public.has_permission(auth.uid(), 'manage_quests')
      or public.is_quest_participant(id, auth.uid())
    ))
  );

-- ---- quest_participants ----
drop policy if exists "quest_participants_select" on public.quest_participants;
create policy "quest_participants_select" on public.quest_participants for select
  using (
    user_id = auth.uid()
    or public.has_permission(auth.uid(), 'manage_quests')
    or public.quest_created_by(quest_id) = auth.uid()
  );

-- ---- chat_channels ----
drop policy if exists "chat_channels_select" on public.chat_channels;
create policy "chat_channels_select" on public.chat_channels for select
  using (
    created_by = auth.uid()
    or public.is_channel_participant(id, auth.uid())
  );

-- ---- chat_participants ----
drop policy if exists "chat_participants_select" on public.chat_participants;
create policy "chat_participants_select" on public.chat_participants for select
  using (public.is_channel_participant(channel_id, auth.uid()));

drop policy if exists "chat_participants_insert" on public.chat_participants;
create policy "chat_participants_insert" on public.chat_participants for insert
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.chat_channels c where c.id = channel_id and c.created_by = auth.uid())
  );

-- ---- chat_messages ----
drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select" on public.chat_messages for select
  using (public.is_channel_participant(channel_id, auth.uid()));

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_channel_participant(channel_id, auth.uid())
  );
