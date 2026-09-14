-- =========================================================
-- Permet d'afficher "entre qui et qui" pour chaque conversation privée
-- (DM), au lieu du générique "Message privé". Un seul appel RPC renvoie,
-- pour chaque DM dont l'utilisateur connecté fait partie, le pseudo de
-- l'autre participant.
-- =========================================================

create or replace function public.list_dm_partner_names()
returns table (channel_id uuid, partner_id uuid, partner_nickname text)
language sql
stable
security definer set search_path = public
as $$
  select cp.channel_id, cp2.user_id, p.nickname
  from public.chat_participants cp
  join public.chat_channels c on c.id = cp.channel_id and c.type = 'dm'
  join public.chat_participants cp2 on cp2.channel_id = cp.channel_id and cp2.user_id <> cp.user_id
  join public.profiles p on p.id = cp2.user_id
  where cp.user_id = auth.uid();
$$;
