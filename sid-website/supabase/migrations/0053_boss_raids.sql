-- =========================================================
-- Lot 27 — Raids de boss (Donjons)
--
-- Un membre mort face au gardien d'une île peut demander de l'aide : un
-- raid est ouvert, tous les membres actifs reçoivent une notification, et
-- ceux qui le rejoignent combattent le même boss en temps réel (échanges
-- par Supabase Realtime, canal « raid:<id> », relayés par la page du S.I.D.
-- qui affiche le jeu).
--
-- Un raid reste ouvert 30 minutes au plus. Le boss est un dragon quand la
-- Puissance du membre qui appelle à l'aide atteint 90.
--
-- Prérequis : migration 0049 (member_stats).
-- =========================================================

create table public.boss_raids (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  story int not null check (story between 1 and 100),
  chapter int not null check (chapter between 1 and 10),
  boss_name text not null default 'Gardien',
  dragon boolean not null default false,
  status text not null default 'open' check (status in ('open', 'won', 'closed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  finished_at timestamptz
);

create index boss_raids_open_idx on public.boss_raids (status, expires_at);

create table public.boss_raid_members (
  raid_id uuid not null references public.boss_raids(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (raid_id, user_id)
);

alter table public.boss_raids enable row level security;
alter table public.boss_raid_members enable row level security;

create policy "boss_raids_select" on public.boss_raids for select using (auth.uid() is not null);
create policy "boss_raid_members_select" on public.boss_raid_members for select using (auth.uid() is not null);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'chat_message', 'quest_validated', 'quest_failed', 'application_decision',
  'quest_confirmation_needed', 'travel_arrived', 'salary_paid', 'money_received',
  'sanction', 'announcement', 'raid_call'
));

-- Appel à l'aide : ouvre le raid (et ferme les précédents du même membre),
-- prévient tous les autres membres actifs.
create or replace function public.create_boss_raid(p_story int, p_chapter int, p_boss_name text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nick text;
  v_strength numeric;
  v_raid public.boss_raids;
begin
  if v_uid is null then
    raise exception 'Non connecté';
  end if;
  if coalesce((select is_frozen from public.profiles where id = v_uid), false) then
    raise exception 'Compte gelé';
  end if;

  update public.boss_raids set status = 'closed', finished_at = now()
    where host_id = v_uid and status = 'open';

  select nickname into v_nick from public.profiles where id = v_uid;
  select strength into v_strength from public.member_stats where user_id = v_uid;

  insert into public.boss_raids (host_id, story, chapter, boss_name, dragon)
  values (v_uid, p_story, p_chapter, left(coalesce(nullif(trim(p_boss_name), ''), 'Gardien'), 80), coalesce(v_strength, 0) >= 90)
  returning * into v_raid;

  insert into public.boss_raid_members (raid_id, user_id) values (v_raid.id, v_uid);

  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'raid_call',
         format('⚔️ %s appelle à l''aide !', coalesce(v_nick, 'Un membre')),
         format('%s — histoire %s, île %s. Rejoins le raid avant 30 minutes.',
                case when v_raid.dragon then 'Un dragon' else v_raid.boss_name end, p_story, p_chapter),
         '/dashboard/simulations/donjons?raid=' || v_raid.id
  from public.profiles p
  where p.status = 'active' and p.id <> v_uid;

  return to_jsonb(v_raid) || jsonb_build_object('host_nickname', v_nick);
end;
$$;

create or replace function public.join_boss_raid(p_raid_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_raid public.boss_raids;
begin
  if v_uid is null then
    raise exception 'Non connecté';
  end if;
  select * into v_raid from public.boss_raids where id = p_raid_id;
  if v_raid.id is null then
    raise exception 'Raid introuvable';
  end if;
  if v_raid.status <> 'open' or v_raid.expires_at < now() then
    raise exception 'Ce raid est terminé.';
  end if;
  insert into public.boss_raid_members (raid_id, user_id) values (p_raid_id, v_uid) on conflict do nothing;
  return to_jsonb(v_raid) || jsonb_build_object(
    'host_nickname', (select nickname from public.profiles where id = v_raid.host_id),
    'is_host', v_raid.host_id = v_uid
  );
end;
$$;

create or replace function public.finish_boss_raid(p_raid_id uuid, p_won boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.boss_raid_members where raid_id = p_raid_id and user_id = auth.uid()) then
    raise exception 'Tu ne participes pas à ce raid.';
  end if;
  update public.boss_raids
    set status = case when p_won then 'won' else 'closed' end, finished_at = now()
    where id = p_raid_id and status = 'open'
      and (p_won or host_id = auth.uid());
end;
$$;

-- Raids ouverts (pour la page Donjons).
create or replace function public.list_open_boss_raids()
returns table (
  id uuid, host_id uuid, host_nickname text, story int, chapter int, boss_name text,
  dragon boolean, created_at timestamptz, expires_at timestamptz, members bigint
)
language sql
stable
security definer set search_path = public
as $$
  select r.id, r.host_id, p.nickname, r.story, r.chapter, r.boss_name, r.dragon, r.created_at, r.expires_at,
         (select count(*) from public.boss_raid_members m where m.raid_id = r.id)
  from public.boss_raids r
  join public.profiles p on p.id = r.host_id
  where r.status = 'open' and r.expires_at > now() and auth.uid() is not null
  order by r.created_at desc;
$$;
