-- =========================================================
-- XP & niveaux pour le rôle Espion
-- Barème (modifiable librement) : 0-49 xp = niveau 1, 50-149 = niveau 2,
-- 150+ = niveau 3. Chaque mission d'espionnage réussie rapporte 15 xp.
-- =========================================================

alter table public.spy_roles add column xp int not null default 0;

create or replace function public.compute_spy_level(p_xp int)
returns int
language sql
immutable
as $$
  select case
    when p_xp >= 150 then 3
    when p_xp >= 50 then 2
    else 1
  end;
$$;

-- Remplace espionner() pour y ajouter le gain d'XP et la mise à jour du niveau
create or replace function public.espionner(p_channel_id uuid)
returns public.spy_reports
language plpgsql
security definer set search_path = public
as $$
declare
  v_spy public.spy_roles;
  v_channel public.chat_channels;
  v_snippets jsonb;
  v_report public.spy_reports;
  v_xp_gain int := 15;
  v_new_xp int;
begin
  select * into v_spy from public.spy_roles where user_id = auth.uid();
  if v_spy.user_id is null then
    raise exception 'Permission refusée';
  end if;

  if v_spy.last_spied_at is not null and v_spy.last_spied_at > now() - interval '1 hour' then
    raise exception 'Encore en récupération, réessaie plus tard.';
  end if;

  select * into v_channel from public.chat_channels where id = p_channel_id;
  if v_channel.id is null or not v_channel.spy_eligible then
    raise exception 'Cible invalide';
  end if;

  if exists (select 1 from public.chat_participants where channel_id = p_channel_id and user_id = auth.uid()) then
    raise exception 'Impossible d''espionner un salon dont tu fais déjà partie';
  end if;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_snippets
  from (
    select m.content, p.nickname as sender_nickname, m.created_at
    from public.chat_messages m
    join public.profiles p on p.id = m.sender_id
    where m.channel_id = p_channel_id
    order by random()
    limit v_spy.spy_level
  ) t;

  insert into public.spy_reports (spy_id, channel_id, snippets)
  values (auth.uid(), p_channel_id, v_snippets)
  returning * into v_report;

  v_new_xp := v_spy.xp + v_xp_gain;

  update public.spy_roles
    set last_spied_at = now(),
        xp = v_new_xp,
        spy_level = public.compute_spy_level(v_new_xp)
    where user_id = auth.uid();

  return v_report;
end;
$$;
