-- =========================================================
-- Permettre d'ajouter des membres à un salon de groupe existant.
-- Jusqu'ici, seul le créateur du salon (created_by) pouvait insérer des
-- lignes dans chat_participants. On autorise maintenant n'importe quel
-- participant actuel du salon à en ajouter d'autres (comportement standard
-- d'un "groupe" de messagerie). is_channel_participant() est déjà en
-- SECURITY DEFINER (voir 0009_fix_rls_recursion.sql), donc pas de risque
-- de récursion RLS ici.
--
-- On restreint volontairement cette possibilité aux salons de type
-- "group" : un DM reste strictement à deux personnes, et un fil de
-- candidature ("application") ne doit pas être élargi par un candidat.
-- =========================================================

drop policy if exists "chat_participants_insert" on public.chat_participants;

create policy "chat_participants_insert" on public.chat_participants for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_channels c
      where c.id = channel_id and c.created_by = auth.uid()
    )
    or (
      exists (select 1 from public.chat_channels c where c.id = channel_id and c.type = 'group')
      and public.is_channel_participant(channel_id, auth.uid())
    )
  );

-- Pratique pour peupler l'UI "ajouter des membres" : liste les
-- participants actuels d'un salon (juste id + pseudo), utilisable par
-- n'importe quel participant du salon en question.
create or replace function public.list_channel_participants(p_channel_id uuid)
returns table (user_id uuid, nickname text)
language sql
stable
security definer set search_path = public
as $$
  select p.id, p.nickname
  from public.chat_participants cp
  join public.profiles p on p.id = cp.user_id
  where cp.channel_id = p_channel_id
    and public.is_channel_participant(p_channel_id, auth.uid());
$$;
