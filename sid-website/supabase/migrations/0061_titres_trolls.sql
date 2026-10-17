-- =========================================================
-- Lot 35 — Titres équipables et pouvoirs de troll.
--
-- Douze titres secrets, chacun obtenu d'une façon cachée et donnant un
-- pouvoir de troll précis (utilisable seulement quand le titre est équipé).
-- Le titre équipé s'affiche sur le dossier, le trombinoscope, le
-- classement et la messagerie.
--
-- Garde-fous : un pouvoir dure 10 minutes environ, se recharge (3 h en
-- général, 24 h quand il vise tout le S.I.D.), une seule farce à la fois
-- par cible, 30 minutes de répit après chaque farce, bouclier possible
-- posé par l'administration, et interrupteur général.
--
-- Prérequis : migration 0060.
-- =========================================================

-- ---------------------------------------------------------
-- 0) Petits outils
-- ---------------------------------------------------------
create or replace function public._today()
returns date
language sql
stable
security definer set search_path = public
as $$
  select (now() at time zone public.stats_timezone())::date;
$$;

-- Début d'une journée (heure de Paris par défaut).
create or replace function public._day_start(p_day date)
returns timestamptz
language sql
stable
security definer set search_path = public
as $$
  select (p_day::timestamp) at time zone public.stats_timezone();
$$;

-- « Admin » au sens large : fondateur ou au moins une permission d'administration.
create or replace function public._is_admin(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_founder from public.profiles where id = p_user), false)
      or exists (
        select 1 from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        where ur.user_id = p_user
      );
$$;

-- ---------------------------------------------------------
-- 1) Catalogue des titres
-- ---------------------------------------------------------
create table if not exists public.titles (
  id text primary key,
  name text not null,
  power text not null,
  max_level int not null default 1 check (max_level between 1 and 10),
  sort int not null default 0
);

insert into public.titles (id, name, power, max_level, sort) values
  ('dragon',     'Fléau Draconique',           'defi_dragon',  1, 1),
  ('architecte', 'Architecte du Réseau',       'reseau',       1, 2),
  ('foudre',     'Éclair Vivant',              'calcul',       1, 3),
  ('fantome',    'Fantôme 404',                'hantise',      5, 4),
  ('mecene',     'Grand Mécène',               'fete',         5, 5),
  ('abyssal',    'Abyssal',                    'abysses',      1, 6),
  ('magnat',     'Magnat Insatiable',          'huissier',     1, 7),
  ('flatteur',   'Lèche-Bottes Boursier',      'flatterie',    1, 8),
  ('arpenteur',  'Arpenteur des Mondes',       'miroir',       1, 9),
  ('scribe',     'Scribe Infini',              'reecriture',   1, 10),
  ('metronome',  'Métronome',                  'rationnement', 1, 11),
  ('juriste',    'Lecteur des Petites Lignes', 'avenant',      1, 12)
on conflict (id) do update
  set name = excluded.name, power = excluded.power, max_level = excluded.max_level, sort = excluded.sort;

alter table public.titles enable row level security;
drop policy if exists "titles_select" on public.titles;
create policy "titles_select" on public.titles for select to authenticated using (true);

create table if not exists public.user_titles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  title_id text not null references public.titles(id) on delete cascade,
  level int not null default 1 check (level >= 1),
  source text,
  obtained_at timestamptz not null default now(),
  upgraded_at timestamptz,
  seen_at timestamptz,
  primary key (user_id, title_id)
);

alter table public.user_titles enable row level security;
drop policy if exists "user_titles_select" on public.user_titles;
create policy "user_titles_select" on public.user_titles for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission(auth.uid(), 'manage_users')
    or exists (select 1 from public.profiles p where p.id = user_id and not coalesce(p.is_invisible, false))
  );

alter table public.profiles add column if not exists equipped_title text references public.titles(id) on delete set null;

-- On ne peut équiper qu'un titre qu'on possède.
create or replace function public.guard_equipped_title()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.equipped_title is not null
     and new.equipped_title is distinct from old.equipped_title
     and not exists (select 1 from public.user_titles where user_id = new.id and title_id = new.equipped_title) then
    raise exception 'Tu ne possèdes pas ce titre.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_equipped_title on public.profiles;
create trigger trg_guard_equipped_title
  before update of equipped_title on public.profiles
  for each row execute function public.guard_equipped_title();

-- Compteurs et horodatages des conditions cachées (un par membre et par clé).
create table if not exists public.title_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  value numeric not null default 0,
  data jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.title_progress enable row level security;
drop policy if exists "title_progress_select_own" on public.title_progress;
create policy "title_progress_select_own" on public.title_progress for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));

-- Jetons à usage unique (mini-jeu 404, plongée abyssale).
create table if not exists public.title_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists title_challenges_user_idx on public.title_challenges (user_id, created_at desc);
alter table public.title_challenges enable row level security;

-- Boutons qui apparaissent après un cadeau d'anniversaire.
create table if not exists public.hidden_buttons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  path text not null,
  x numeric not null,
  y numeric not null,
  created_at timestamptz not null default now(),
  found_at timestamptz
);
create index if not exists hidden_buttons_user_idx on public.hidden_buttons (user_id) where found_at is null;
alter table public.hidden_buttons enable row level security;

-- Anniversaires : jour et mois seulement, visibles du seul membre.
create table if not exists public.member_birthdays (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  day smallint not null check (day between 1 and 31),
  month smallint not null check (month between 1 and 12),
  updated_at timestamptz not null default now(),
  check (day <= case when month = 2 then 29 when month in (4, 6, 9, 11) then 30 else 31 end)
);
alter table public.member_birthdays enable row level security;
drop policy if exists "member_birthdays_own" on public.member_birthdays;
create policy "member_birthdays_own" on public.member_birthdays for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "member_birthdays_admin" on public.member_birthdays;
create policy "member_birthdays_admin" on public.member_birthdays for select to authenticated
  using (public.has_permission(auth.uid(), 'manage_users'));

create table if not exists public.birthday_gifts (
  id bigserial primary key,
  giver_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  year int not null,
  amount numeric(18,2) not null,
  created_at timestamptz not null default now(),
  unique (giver_id, receiver_id, year)
);
alter table public.birthday_gifts enable row level security;
drop policy if exists "birthday_gifts_select" on public.birthday_gifts;
create policy "birthday_gifts_select" on public.birthday_gifts for select to authenticated
  using (giver_id = auth.uid() or receiver_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));

-- Farces lancées. target_id null = tout le S.I.D.
create table if not exists public.troll_actions (
  id bigserial primary key,
  power text not null,
  title_id text not null references public.titles(id),
  level int not null default 1,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid references public.profiles(id) on delete cascade,
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  ends_at timestamptz not null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null
);
create index if not exists troll_actions_target_idx on public.troll_actions (target_id, ends_at desc);
create index if not exists troll_actions_actor_idx on public.troll_actions (actor_id, power, created_at desc);
create index if not exists troll_actions_everyone_idx on public.troll_actions (ends_at desc) where target_id is null;
alter table public.troll_actions enable row level security;
drop policy if exists "troll_actions_select" on public.troll_actions;
create policy "troll_actions_select" on public.troll_actions for select to authenticated
  using (actor_id = auth.uid() or target_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));

create table if not exists public.troll_responses (
  troll_id bigint not null references public.troll_actions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  result text not null,
  details jsonb,
  created_at timestamptz not null default now(),
  primary key (troll_id, user_id)
);
alter table public.troll_responses enable row level security;
drop policy if exists "troll_responses_select" on public.troll_responses;
create policy "troll_responses_select" on public.troll_responses for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.troll_actions a where a.id = troll_id and a.actor_id = auth.uid())
    or public.has_permission(auth.uid(), 'manage_users')
  );

-- Bouclier posé par l'administration : le membre ne subit plus aucune farce.
create table if not exists public.troll_shields (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  set_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.troll_shields enable row level security;
drop policy if exists "troll_shields_select" on public.troll_shields;
create policy "troll_shields_select" on public.troll_shields for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));

-- Messages « flattés » : la mention est stockée à part, le texte reste intact.
alter table public.chat_messages add column if not exists troll_tag jsonb;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'chat_message', 'quest_validated', 'quest_failed', 'application_decision',
  'quest_confirmation_needed', 'travel_arrived', 'salary_paid', 'money_received',
  'sanction', 'announcement', 'raid_call', 'admin_alert', 'title', 'troll'
));

insert into public.app_config (key, value) values ('trolls_enabled', '1') on conflict (key) do nothing;

-- ---------------------------------------------------------
-- 2) Attribution d'un titre
-- ---------------------------------------------------------
-- Renvoie 'granted' (nouveau), 'upgraded' (niveau +1) ou 'already'.
create or replace function public.grant_title(p_user uuid, p_title text, p_source text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_t public.titles;
  v_row public.user_titles;
begin
  select * into v_t from public.titles where id = p_title;
  if v_t.id is null or p_user is null then
    return 'unknown';
  end if;

  select * into v_row from public.user_titles where user_id = p_user and title_id = p_title for update;
  if v_row.user_id is null then
    insert into public.user_titles (user_id, title_id, level, source) values (p_user, p_title, 1, p_source);
    update public.profiles set equipped_title = p_title where id = p_user and equipped_title is null;
    insert into public.notifications (user_id, type, title, body, link)
    values (p_user, 'title', '🏅 Nouveau titre : ' || v_t.name,
            'Tu as débloqué le titre « ' || v_t.name || ' ». Équipe-le pour transformer ton dossier et utiliser son pouvoir.',
            '/dashboard/titles');
    return 'granted';
  elsif v_row.level < v_t.max_level then
    update public.user_titles set level = level + 1, upgraded_at = now(), seen_at = null
      where user_id = p_user and title_id = p_title;
    insert into public.notifications (user_id, type, title, body, link)
    values (p_user, 'title', '⬆️ ' || v_t.name || ' : niveau ' || (v_row.level + 1),
            'Ton titre « ' || v_t.name || ' » monte au niveau ' || (v_row.level + 1) || ' : son pouvoir est plus fort.',
            '/dashboard/titles');
    return 'upgraded';
  end if;
  return 'already';
end;
$$;

-- Compteur remis à zéro chaque jour ; renvoie la nouvelle valeur.
create or replace function public._bump_daily(p_user uuid, p_key text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_today text := public._today()::text;
  v_val numeric;
begin
  insert into public.title_progress (user_id, key, value, data)
  values (p_user, p_key, 1, jsonb_build_object('day', v_today))
  on conflict (user_id, key) do update
    set value = case when public.title_progress.data->>'day' = v_today then public.title_progress.value + 1 else 1 end,
        data = jsonb_build_object('day', v_today),
        updated_at = now()
  returning value into v_val;
  return v_val::int;
end;
$$;

-- ---------------------------------------------------------
-- 3) Titres de la vitrine
-- ---------------------------------------------------------
create or replace function public.equip_title(p_title text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté.';
  end if;
  if p_title is not null and not exists (select 1 from public.user_titles where user_id = auth.uid() and title_id = p_title) then
    raise exception 'Tu ne possèdes pas ce titre.';
  end if;
  update public.profiles set equipped_title = p_title where id = auth.uid();
end;
$$;

create or replace function public.mark_titles_seen()
returns void
language sql
security definer set search_path = public
as $$
  update public.user_titles set seen_at = now() where user_id = auth.uid() and seen_at is null;
$$;

-- Titre équipé (et niveau) d'une liste de membres, pour les badges.
-- dragon = ce membre a un défi du dragon en cours (forme draconique).
create or replace function public.list_equipped_titles(p_user_ids uuid[])
returns table (user_id uuid, title_id text, title_name text, level int, dragon boolean)
language sql
stable
security definer set search_path = public
as $$
  select p.id, p.equipped_title, t.name, coalesce(ut.level, 1),
         exists (select 1 from public.troll_actions a
                 where a.actor_id = p.id and a.power = 'defi_dragon' and a.cancelled_at is null and a.ends_at > now())
  from public.profiles p
  join public.titles t on t.id = p.equipped_title
  left join public.user_titles ut on ut.user_id = p.id and ut.title_id = p.equipped_title
  where p.id = any(p_user_ids)
    and (not coalesce(p.is_invisible, false) or p.id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));
$$;

-- Nombre de porteurs par titre (la vitrine montre qui a déjà percé le secret).
create or replace function public.title_holder_counts()
returns table (title_id text, holders bigint)
language sql
stable
security definer set search_path = public
as $$
  select t.id, count(ut.user_id) from public.titles t
  left join public.user_titles ut on ut.title_id = t.id
  group by t.id;
$$;

-- ---------------------------------------------------------
-- 4) Conditions cachées
-- ---------------------------------------------------------

-- 4a) Page 404 : un tirage par visite (20 comptés par jour), 1 % de chance.
create or replace function public.roll_glitch()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_chance numeric := public.get_config_numeric('title_404_chance', 0.01);
  v_level int;
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('result', 'none');
  end if;
  if public._bump_daily(v_uid, 'glitch_rolls') > 20 then
    return jsonb_build_object('result', 'none');
  end if;
  select level into v_level from public.user_titles where user_id = v_uid and title_id = 'fantome';
  if coalesce(v_level, 0) >= 5 or random() >= v_chance then
    return jsonb_build_object('result', 'none');
  end if;
  insert into public.title_challenges (user_id, kind, expires_at)
  values (v_uid, 'glitch', now() + interval '10 minutes') returning id into v_id;
  return jsonb_build_object('result', 'game', 'token', v_id, 'level', coalesce(v_level, 0) + 1);
end;
$$;

create or replace function public.claim_glitch(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_c public.title_challenges;
  v_res text;
begin
  select * into v_c from public.title_challenges where id = p_token for update;
  if v_c.id is null or v_c.user_id is distinct from auth.uid() or v_c.kind <> 'glitch'
     or v_c.used_at is not null or v_c.expires_at < now() then
    return jsonb_build_object('result', 'invalid');
  end if;
  if now() - v_c.created_at < interval '5 seconds' then
    return jsonb_build_object('result', 'too_fast');
  end if;
  update public.title_challenges set used_at = now() where id = v_c.id;
  v_res := public.grant_title(v_c.user_id, 'fantome', '404');
  return jsonb_build_object('result', v_res,
    'level', (select level from public.user_titles where user_id = v_c.user_id and title_id = 'fantome'));
end;
$$;

-- 4b) Plongée : 100 000 lignes défilées vers le bas = une chance sur deux, une fois par jour.
create or replace function public.abyss_start()
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  delete from public.title_challenges where user_id = auth.uid() and kind = 'abyss' and used_at is null;
  insert into public.title_challenges (user_id, kind, expires_at)
  values (auth.uid(), 'abyss', now() + interval '6 hours') returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.abyss_claim(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_c public.title_challenges;
  v_last numeric;
  v_next timestamptz;
begin
  select * into v_c from public.title_challenges where id = p_token for update;
  if v_c.id is null or v_c.user_id is distinct from auth.uid() or v_c.kind <> 'abyss'
     or v_c.used_at is not null or v_c.expires_at < now() then
    return jsonb_build_object('result', 'invalid');
  end if;
  if now() - v_c.created_at < interval '2 minutes' then
    return jsonb_build_object('result', 'too_fast');
  end if;
  if exists (select 1 from public.user_titles where user_id = v_c.user_id and title_id = 'abyssal') then
    update public.title_challenges set used_at = now() where id = v_c.id;
    return jsonb_build_object('result', 'already');
  end if;

  select value into v_last from public.title_progress where user_id = v_c.user_id and key = 'abyss_last_roll';
  if v_last is not null and to_timestamp(v_last) > now() - interval '24 hours' then
    return jsonb_build_object('result', 'wait', 'next_at', to_timestamp(v_last) + interval '24 hours');
  end if;

  update public.title_challenges set used_at = now() where id = v_c.id;
  insert into public.title_progress (user_id, key, value) values (v_c.user_id, 'abyss_last_roll', extract(epoch from now()))
  on conflict (user_id, key) do update set value = excluded.value, updated_at = now();

  if random() < public.get_config_numeric('title_abyss_chance', 0.5) then
    perform public.grant_title(v_c.user_id, 'abyssal', 'abysses');
    return jsonb_build_object('result', 'won');
  end if;
  v_next := now() + interval '24 hours';
  return jsonb_build_object('result', 'lost', 'next_at', v_next);
end;
$$;

-- 4c) Anniversaires.
create or replace function public._is_birthday(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.member_birthdays b
    where b.user_id = p_user
      and b.month = extract(month from public._today())
      and (b.day = extract(day from public._today())
           -- 29 février fêté le 28 les années non bissextiles
           or (b.month = 2 and b.day = 29 and extract(day from public._today()) = 28
               and extract(day from (date_trunc('month', public._today()) + interval '1 month - 1 day')) = 28))
  );
$$;

-- Les membres dont c'est l'anniversaire aujourd'hui (la date elle-même reste privée).
create or replace function public.birthdays_today()
returns table (user_id uuid, nickname text)
language sql
stable
security definer set search_path = public
as $$
  select p.id, p.nickname from public.profiles p
  where p.status = 'active'
    and (not coalesce(p.is_invisible, false) or p.id = auth.uid())
    and public._is_birthday(p.id)
  order by p.nickname;
$$;

-- Ce que le visiteur peut faire pour l'anniversaire d'un membre.
create or replace function public.birthday_gift_state(p_target uuid)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'birthday', public._is_birthday(p_target),
    'already', exists (select 1 from public.birthday_gifts g
                       where g.giver_id = auth.uid() and g.receiver_id = p_target
                         and g.year = extract(year from public._today())),
    'amount', 2000000
  );
$$;

create or replace function public.offer_birthday_gift(p_target uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_amount numeric := 2000000;
  v_giver text;
  v_receiver text;
  v_paths text[] := array[
    '/dashboard', '/dashboard/quests', '/dashboard/shop', '/dashboard/bank', '/dashboard/members',
    '/dashboard/leaderboard', '/dashboard/notifications', '/dashboard/profile', '/dashboard/org-chart',
    '/dashboard/tech', '/dashboard/settings', '/dashboard/privacy', '/dashboard/titles'
  ];
begin
  if v_uid is null then
    raise exception 'Non connecté.';
  end if;
  if p_target = v_uid then
    raise exception 'Pas à toi-même !';
  end if;
  select nickname into v_receiver from public.profiles where id = p_target and status = 'active';
  if v_receiver is null or not public._is_birthday(p_target) then
    raise exception 'Ce n''est pas son anniversaire aujourd''hui.';
  end if;
  if exists (select 1 from public.birthday_gifts where giver_id = v_uid and receiver_id = p_target
             and year = extract(year from public._today())) then
    raise exception 'Tu lui as déjà fait ce cadeau cette année.';
  end if;

  update public.wallets set balance = balance - v_amount where user_id = v_uid and balance >= v_amount;
  if not found then
    raise exception 'Il te faut 2 000 000 zénis sur ton portefeuille.';
  end if;
  update public.wallets set balance = balance + v_amount where user_id = p_target;
  if not found then
    insert into public.wallets (user_id, balance) values (p_target, v_amount);
  end if;

  select nickname into v_giver from public.profiles where id = v_uid;
  insert into public.transactions (user_id, amount, reason, created_by) values
    (v_uid, -v_amount, 'Cadeau d''anniversaire pour ' || v_receiver || ' 🎂', v_uid),
    (p_target, v_amount, 'Cadeau d''anniversaire de ' || coalesce(v_giver, 'un membre') || ' 🎂', v_uid);
  insert into public.birthday_gifts (giver_id, receiver_id, year, amount)
  values (v_uid, p_target, extract(year from public._today()), v_amount);

  insert into public.hidden_buttons (user_id, path, x, y)
  values (v_uid, v_paths[1 + floor(random() * array_length(v_paths, 1))::int],
          round((3 + random() * 91)::numeric, 2), round((4 + random() * 90)::numeric, 2));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.my_hidden_button()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select to_jsonb(b) - 'user_id' - 'found_at'
  from public.hidden_buttons b
  where b.user_id = auth.uid() and b.found_at is null
  order by b.created_at
  limit 1;
$$;

create or replace function public.press_hidden_button(p_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_res text;
begin
  update public.hidden_buttons set found_at = now()
    where id = p_id and user_id = auth.uid() and found_at is null;
  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;
  v_res := public.grant_title(auth.uid(), 'mecene', 'anniversaire');
  return jsonb_build_object('result', v_res,
    'level', (select level from public.user_titles where user_id = auth.uid() and title_id = 'mecene'));
end;
$$;

-- 4d) Conditions générales lues, puis 100 clics sur « S.I.D. ».
create or replace function public.mark_legal_read(p_page text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or p_page not in ('cgu', 'confidentialite') then
    return;
  end if;
  insert into public.title_progress (user_id, key, value)
  values (auth.uid(), 'legal_' || p_page, extract(epoch from now()))
  on conflict (user_id, key) do update set value = excluded.value, updated_at = now();
end;
$$;

create or replace function public.claim_sid_clicks(p_clicks int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_cgu numeric;
  v_priv numeric;
begin
  if auth.uid() is null or coalesce(p_clicks, 0) < 100 then
    return jsonb_build_object('result', 'none');
  end if;
  select value into v_cgu from public.title_progress where user_id = auth.uid() and key = 'legal_cgu';
  select value into v_priv from public.title_progress where user_id = auth.uid() and key = 'legal_confidentialite';
  if v_cgu is null or v_priv is null
     or to_timestamp(v_cgu) < now() - interval '24 hours'
     or to_timestamp(v_priv) < now() - interval '24 hours' then
    return jsonb_build_object('result', 'none');
  end if;
  return jsonb_build_object('result', public.grant_title(auth.uid(), 'juriste', 'cgu'));
end;
$$;

-- 4e) Magnat : 1 000 000 000 de zénis dépensés et 20 objets achetés le même jour.
create or replace function public._check_magnat(p_user uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_start timestamptz := public._day_start(public._today());
  v_spent numeric;
  v_items numeric;
begin
  if p_user is null or exists (select 1 from public.user_titles where user_id = p_user and title_id = 'magnat') then
    return;
  end if;
  select coalesce(sum(-amount), 0) into v_spent from public.transactions
    where user_id = p_user and amount < 0 and created_at >= v_start
      and coalesce(reason, '') not like 'Dépôt en banque%';
  if v_spent < public.get_config_numeric('title_magnat_spend', 1000000000) then
    return;
  end if;
  select coalesce(sum(quantity), 0) into v_items from public.purchases
    where user_id = p_user and created_at >= v_start and status <> 'cancelled';
  if v_items >= public.get_config_numeric('title_magnat_items', 20) then
    perform public.grant_title(p_user, 'magnat', 'depenses');
  end if;
end;
$$;

create or replace function public.trg_title_purchase()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  begin
    perform public._check_magnat(new.user_id);
  exception when others then
    null; -- un souci de titre ne doit jamais bloquer un achat
  end;
  return new;
end;
$$;

drop trigger if exists trg_title_purchase on public.purchases;
create trigger trg_title_purchase after insert on public.purchases
  for each row execute function public.trg_title_purchase();

drop trigger if exists trg_title_spending on public.transactions;
create trigger trg_title_spending after insert on public.transactions
  for each row when (new.amount < 0) execute function public.trg_title_purchase();

-- 4f) Messagerie : la flatterie (« tu es le meilleur ! » en rouge et en gras à
-- un admin) et le métronome (exactement un message par jour, 30 jours de suite).
create or replace function public.trg_title_chat()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_text text;
  v_day date;
  v_today_count int;
  v_days int;
  v_good int;
begin
  begin
    v_text := lower(btrim(regexp_replace(new.content, '[  \s]+', ' ', 'g')));
    if new.is_bold and lower(coalesce(new.color, '')) in ('#b23b2e', '#d99a9a')
       and v_text in ('tu es le meilleur !', 'tu es le meilleur!')
       and exists (select 1 from public.chat_channels c where c.id = new.channel_id and c.type = 'dm')
       and exists (select 1 from public.chat_participants cp
                   where cp.channel_id = new.channel_id and cp.user_id <> new.sender_id and public._is_admin(cp.user_id)) then
      insert into public.title_progress (user_id, key, value)
      values (new.sender_id, 'flatterie_at', extract(epoch from now()))
      on conflict (user_id, key) do update set value = excluded.value, updated_at = now();
    end if;

    if not exists (select 1 from public.user_titles where user_id = new.sender_id and title_id = 'metronome') then
      v_day := (new.created_at at time zone public.stats_timezone())::date;
      select count(*) into v_today_count from public.chat_messages
        where sender_id = new.sender_id and created_at >= public._day_start(v_day) and created_at < public._day_start(v_day + 1);
      if v_today_count = 1 then
        select count(*), count(*) filter (where c = 1) into v_days, v_good from (
          select (m.created_at at time zone public.stats_timezone())::date as d, count(*) as c
          from public.chat_messages m
          where m.sender_id = new.sender_id
            and m.created_at >= public._day_start(v_day - 29) and m.created_at < public._day_start(v_day + 1)
          group by 1
        ) s;
        if v_days = 30 and v_good = 30 then
          perform public.grant_title(new.sender_id, 'metronome', 'messagerie');
        end if;
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_title_chat on public.chat_messages;
create trigger trg_title_chat after insert on public.chat_messages
  for each row execute function public.trg_title_chat();

-- Achat d'actions dans l'heure qui suit la flatterie : 100 actions = titre.
create or replace function public.trg_title_shares()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_at numeric;
  v_qty numeric;
begin
  begin
    select value into v_at from public.title_progress where user_id = new.user_id and key = 'flatterie_at';
    if v_at is not null and to_timestamp(v_at) >= now() - interval '1 hour' then
      select coalesce(sum(quantity), 0) into v_qty from public.business_share_lots
        where user_id = new.user_id and bought_at >= to_timestamp(v_at) and bought_at <= to_timestamp(v_at) + interval '1 hour';
      if v_qty >= 100 then
        perform public.grant_title(new.user_id, 'flatteur', 'bourse');
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_title_shares on public.business_share_lots;
create trigger trg_title_shares after insert on public.business_share_lots
  for each row execute function public.trg_title_shares();

-- 4g) Carte : un million de kilomètres parcourus (trajets terminés, sur les
-- deux cartes). Compté à partir de cette migration.
create or replace function public._map_km_per_unit()
returns numeric
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v numeric;
begin
  if to_regclass('public.map_settings') is not null then
    execute 'select km_per_unit from public.map_settings where id = 1' into v;
  end if;
  return coalesce(v, 5);
end;
$$;

-- Longueur d'une route (en unités de carte) : départ, points de passage, arrivée.
create or replace function public._route_length_units(p_route uuid)
returns numeric
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_len numeric;
begin
  execute $q$
    with r as (select * from public.map_routes where id = $1),
    pts as (
      select 0 as ord, f.x::numeric as x, f.y::numeric as y from r join public.map_places f on f.id = r.from_place_id
      union all
      select t.ord, (t.pt->>'x')::numeric, (t.pt->>'y')::numeric
        from r, jsonb_array_elements(coalesce(r.path_points, '[]'::jsonb)) with ordinality as t(pt, ord)
      union all
      select 100000, d.x::numeric, d.y::numeric from r join public.map_places d on d.id = r.to_place_id
    )
    select coalesce(sum(seg), 0) from (
      select sqrt(power(x - lag(x) over (order by ord), 2) + power(y - lag(y) over (order by ord), 2)) as seg from pts
    ) s
  $q$ into v_len using p_route;
  return coalesce(v_len, 0);
end;
$$;

create or replace function public._place_distance_units(p_a uuid, p_b uuid)
returns numeric
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v numeric;
begin
  execute 'select sqrt(power(b.x - a.x, 2) + power(b.y - a.y, 2)) from public.map_places a, public.map_places b where a.id = $1 and b.id = $2'
    into v using p_a, p_b;
  return coalesce(v, 0);
end;
$$;

create or replace function public.trg_title_travel()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  v_units numeric := 0;
  v_total numeric;
begin
  begin
    if (o->>'route_id') is not null and (o->>'travel_started_at') is not null
       and ((n->>'route_id') is distinct from (o->>'route_id') or (n->>'travel_started_at') is distinct from (o->>'travel_started_at')) then
      v_units := public._route_length_units((o->>'route_id')::uuid);
    elsif (o->>'flight_target_place_id') is not null and (o->>'place_id') is not null
          and (n->>'place_id') = (o->>'flight_target_place_id') and (n->>'place_id') is distinct from (o->>'place_id') then
      v_units := public._place_distance_units((o->>'place_id')::uuid, (n->>'place_id')::uuid);
    end if;

    if v_units > 0 then
      insert into public.title_progress (user_id, key, value)
      values (new.user_id, 'travel_km', v_units * public._map_km_per_unit())
      on conflict (user_id, key) do update set value = public.title_progress.value + excluded.value, updated_at = now()
      returning value into v_total;
      if v_total >= public.get_config_numeric('title_travel_km', 1000000) then
        perform public.grant_title(new.user_id, 'arpenteur', 'carte');
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.character_positions') is not null then
    execute 'drop trigger if exists trg_title_travel on public.character_positions';
    execute 'create trigger trg_title_travel after update on public.character_positions for each row execute function public.trg_title_travel()';
  end if;
end;
$$;

-- 4h) Wiki : une fiche de plus de 1 000 lignes écrites (lignes non vides).
create or replace function public.trg_title_wiki()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_lines int;
  v_user uuid;
begin
  begin
    select count(*) into v_lines
      from regexp_split_to_table(coalesce(new.content, ''), E'\n') as l(line)
      where btrim(l.line) <> '';
    if v_lines >= public.get_config_numeric('title_wiki_lines', 1000) then
      v_user := coalesce(auth.uid(), new.created_by);
      if v_user is not null then
        perform public.grant_title(v_user, 'scribe', 'wiki');
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.wiki_entries') is not null then
    execute 'drop trigger if exists trg_title_wiki on public.wiki_entries';
    execute 'create trigger trg_title_wiki after insert or update of content on public.wiki_entries for each row execute function public.trg_title_wiki()';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 5) Les pouvoirs de troll
-- ---------------------------------------------------------
-- Durée (minutes), recharge (minutes), et si le pouvoir peut viser tout le S.I.D.
create or replace function public._troll_spec(p_power text, p_level int, p_everyone boolean)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'minutes', case p_power
      when 'hantise' then 10 + 2 * (greatest(p_level, 1) - 1)
      when 'fete' then 10 + 3 * (greatest(p_level, 1) - 1)
      else 10 end,
    'cooldown', case
      when p_everyone then 1440
      when p_power = 'defi_dragon' then 120
      else 180 end,
    'everyone_allowed', p_power = 'defi_dragon' or (p_power = 'fete' and p_level >= 3)
  );
$$;

create or replace function public._trolls_enabled()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select value from public.app_config where key = 'trolls_enabled'), '1') in ('1', 'true', 'on');
$$;

-- Ce dont la page Titres a besoin : titre équipé, pouvoir, recharges, farces récentes.
create or replace function public.troll_status()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_title record;
  v_last_one timestamptz;
  v_last_all timestamptz;
  v_spec jsonb;
  v_spec_all jsonb;
begin
  select t.id, t.name, t.power, coalesce(ut.level, 1) as level into v_title
  from public.profiles p
  join public.titles t on t.id = p.equipped_title
  left join public.user_titles ut on ut.user_id = p.id and ut.title_id = t.id
  where p.id = v_uid;

  if v_title.id is not null then
    select max(created_at) into v_last_one from public.troll_actions
      where actor_id = v_uid and power = v_title.power and target_id is not null;
    select max(created_at) into v_last_all from public.troll_actions
      where actor_id = v_uid and power = v_title.power and target_id is null;
    v_spec := public._troll_spec(v_title.power, v_title.level, false);
    v_spec_all := public._troll_spec(v_title.power, v_title.level, true);
  end if;

  return jsonb_build_object(
    'enabled', public._trolls_enabled(),
    'shielded', exists (select 1 from public.troll_shields where user_id = v_uid),
    'title', v_title.id,
    'power', v_title.power,
    'level', v_title.level,
    'minutes', v_spec->'minutes',
    'everyone_allowed', coalesce((v_spec->>'everyone_allowed')::boolean, false),
    'ready_at', case when v_last_one is not null then v_last_one + make_interval(mins => (v_spec->>'cooldown')::int) end,
    'ready_all_at', case when v_last_all is not null then v_last_all + make_interval(mins => (v_spec_all->>'cooldown')::int) end,
    'recent', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object(
          'id', a.id, 'power', a.power, 'created_at', a.created_at, 'ends_at', a.ends_at,
          'cancelled', a.cancelled_at is not null,
          'target', coalesce((select nickname from public.profiles where id = a.target_id), case when a.target_id is null then 'Tout le S.I.D.' end),
          'responses', (select coalesce(jsonb_agg(jsonb_build_object('who', pr.nickname, 'result', r.result) order by r.created_at), '[]'::jsonb)
                        from public.troll_responses r join public.profiles pr on pr.id = r.user_id where r.troll_id = a.id)
        ) as x
        from public.troll_actions a
        where a.actor_id = v_uid and a.created_at > now() - interval '3 days'
        order by a.created_at desc
        limit 15
      ) s), '[]'::jsonb)
  );
end;
$$;

create or replace function public.launch_troll(p_power text, p_target uuid, p_params jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_title record;
  v_everyone boolean := p_target is null;
  v_spec jsonb;
  v_last timestamptz;
  v_until timestamptz;
  v_target public.profiles;
  v_params jsonb := '{}'::jsonb;
  v_key text;
  v_val text;
  v_n int := 0;
  v_id bigint;
  v_ends timestamptz;
begin
  if v_uid is null then
    raise exception 'Non connecté.';
  end if;
  if not public._trolls_enabled() then
    raise exception 'Les farces sont désactivées par l''administration pour le moment.';
  end if;

  select t.id, t.name, t.power, coalesce(ut.level, 1) as level into v_title
  from public.profiles p
  join public.titles t on t.id = p.equipped_title
  join public.user_titles ut on ut.user_id = p.id and ut.title_id = t.id
  where p.id = v_uid;
  if v_title.id is null or v_title.power <> p_power then
    raise exception 'Équipe d''abord le titre qui donne ce pouvoir.';
  end if;

  v_spec := public._troll_spec(p_power, v_title.level, v_everyone);
  if v_everyone and not (v_spec->>'everyone_allowed')::boolean then
    raise exception 'Ce pouvoir ne vise qu''une seule personne.';
  end if;

  select max(created_at) into v_last from public.troll_actions
    where actor_id = v_uid and power = p_power and (target_id is null) = v_everyone;
  if v_last is not null and v_last + make_interval(mins => (v_spec->>'cooldown')::int) > now() then
    raise exception 'Pouvoir en recharge : encore % min.',
      ceil(extract(epoch from (v_last + make_interval(mins => (v_spec->>'cooldown')::int) - now())) / 60);
  end if;

  if not v_everyone then
    if p_target = v_uid then
      raise exception 'Pas sur toi-même !';
    end if;
    select * into v_target from public.profiles where id = p_target;
    if v_target.id is null or v_target.status <> 'active'
       or (coalesce(v_target.is_invisible, false) and not public.has_permission(v_uid, 'manage_users')) then
      raise exception 'Membre introuvable.';
    end if;
    if exists (select 1 from public.troll_shields where user_id = p_target) then
      raise exception '% est protégé des farces par l''administration.', v_target.nickname;
    end if;
    if exists (select 1 from public.troll_actions where target_id = p_target and cancelled_at is null and ends_at > now()) then
      raise exception '% subit déjà une farce : attends qu''elle se termine.', v_target.nickname;
    end if;
    select max(ends_at) + interval '30 minutes' into v_until from public.troll_actions
      where target_id = p_target and cancelled_at is null and ends_at <= now();
    if v_until is not null and v_until > now() then
      raise exception '% se remet de sa dernière farce : encore % min de répit.', v_target.nickname,
        ceil(extract(epoch from (v_until - now())) / 60);
    end if;
  end if;

  -- Réseau : uniquement des liens internes du tableau de bord.
  if p_power = 'reseau' then
    if jsonb_typeof(p_params->'map') = 'object' then
      for v_key, v_val in select key, value #>> '{}' from jsonb_each(p_params->'map') loop
        if v_key ~ '^/dashboard(/[a-z0-9-]+)*$' and v_val ~ '^/dashboard(/[a-z0-9-]+)*$' and v_n < 30 then
          v_params := jsonb_set(v_params, array['map'], coalesce(v_params->'map', '{}'::jsonb) || jsonb_build_object(v_key, v_val));
          v_n := v_n + 1;
        end if;
      end loop;
    end if;
    v_params := v_params || jsonb_build_object(
      'logic', case when p_params->>'logic' in ('fixe', 'rotation', 'aleatoire', 'echange') then p_params->>'logic' else 'fixe' end,
      'every', least(greatest(coalesce((p_params->>'every')::int, 30), 10), 120)
    );
    if v_n = 0 and v_params->>'logic' <> 'aleatoire' then
      raise exception 'Relie au moins un lien à une autre page.';
    end if;
  end if;

  v_ends := now() + make_interval(mins => (v_spec->>'minutes')::int);
  insert into public.troll_actions (power, title_id, level, actor_id, target_id, params, ends_at)
  values (p_power, v_title.id, v_title.level, v_uid, p_target, v_params, v_ends)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'ends_at', v_ends);
end;
$$;

-- Farces en cours qui touchent le membre connecté.
create or replace function public.my_trolls()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'power', a.power, 'level', a.level, 'params', a.params,
    'actor_id', a.actor_id, 'actor', p.nickname, 'everyone', a.target_id is null,
    'created_at', a.created_at, 'ends_at', a.ends_at
  ) order by a.created_at), '[]'::jsonb)
  from public.troll_actions a
  join public.profiles p on p.id = a.actor_id
  where a.cancelled_at is null and a.ends_at > now()
    and public._trolls_enabled()
    and (a.target_id = auth.uid() or (a.target_id is null and a.actor_id <> auth.uid()))
    and not exists (select 1 from public.troll_shields s where s.user_id = auth.uid())
    and not exists (select 1 from public.troll_responses r where r.troll_id = a.id and r.user_id = auth.uid());
$$;

-- Réponse de la cible (duel contre le dragon, etc.).
create or replace function public.answer_troll(p_id bigint, p_result text, p_details jsonb default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_a public.troll_actions;
  v_me text;
begin
  select * into v_a from public.troll_actions where id = p_id;
  if v_a.id is null or not (v_a.target_id = auth.uid() or (v_a.target_id is null and v_a.actor_id <> auth.uid())) then
    raise exception 'Farce introuvable.';
  end if;
  if p_result not in ('victoire', 'defaite', 'fuite', 'fini') then
    raise exception 'Résultat inconnu.';
  end if;
  insert into public.troll_responses (troll_id, user_id, result, details)
  values (p_id, auth.uid(), p_result, p_details)
  on conflict (troll_id, user_id) do nothing;
  if not found then
    return;
  end if;

  if v_a.power = 'defi_dragon' and v_a.target_id is not null then
    select nickname into v_me from public.profiles where id = auth.uid();
    insert into public.notifications (user_id, type, title, body, link)
    values (v_a.actor_id, 'troll',
      case p_result when 'victoire' then '🗡 ' || v_me || ' a terrassé ton dragon'
                    when 'defaite' then '🔥 ' || v_me || ' a fini carbonisé'
                    else '🏃 ' || v_me || ' a fui devant ton dragon' end,
      case p_result when 'victoire' then 'Ta forme draconique n''a pas suffi. Revanche dans 2 heures ?'
                    when 'defaite' then 'Ton souffle a eu raison de ' || v_me || '. Le dragon règne.'
                    else 'Le duel n''a même pas eu lieu.' end,
      '/dashboard/titles');
  end if;
end;
$$;

create or replace function public.cancel_troll(p_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_a public.troll_actions;
begin
  select * into v_a from public.troll_actions where id = p_id for update;
  if v_a.id is null then
    raise exception 'Farce introuvable.';
  end if;
  if v_a.actor_id <> auth.uid() and not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée.';
  end if;
  if v_a.cancelled_at is not null or v_a.ends_at <= now() then
    return;
  end if;
  update public.troll_actions set cancelled_at = now(), cancelled_by = auth.uid() where id = p_id;
  if v_a.actor_id <> auth.uid() then
    perform public.write_audit('troll_cancelled', v_a.target_id,
      jsonb_build_object('pouvoir', v_a.power, 'par', (select nickname from public.profiles where id = v_a.actor_id)));
  end if;
end;
$$;

-- Flatterie forcée : chaque message de la cible reçoit une mention.
create or replace function public.trg_troll_flatterie()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor text;
begin
  begin
    select p.nickname into v_actor
    from public.troll_actions a join public.profiles p on p.id = a.actor_id
    where a.target_id = new.sender_id and a.power = 'flatterie' and a.cancelled_at is null and a.ends_at > now()
    order by a.created_at desc limit 1;
    if v_actor is not null and public._trolls_enabled() then
      new.troll_tag := jsonb_build_object('kind', 'flatterie', 'by', v_actor);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_troll_flatterie on public.chat_messages;
create trigger trg_troll_flatterie before insert on public.chat_messages
  for each row execute function public.trg_troll_flatterie();

-- ---------------------------------------------------------
-- 6) Administration
-- ---------------------------------------------------------
create or replace function public.admin_titles_overview()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  return jsonb_build_object(
    'enabled', public._trolls_enabled(),
    'holders', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', ut.user_id, 'nickname', p.nickname, 'title_id', ut.title_id,
                                          'level', ut.level, 'source', ut.source, 'obtained_at', ut.obtained_at,
                                          'equipped', p.equipped_title = ut.title_id) order by ut.obtained_at desc)
      from public.user_titles ut join public.profiles p on p.id = ut.user_id), '[]'::jsonb),
    'trolls', coalesce((
      select jsonb_agg(x order by (x->>'id')::bigint desc) from (
        select jsonb_build_object('id', a.id, 'power', a.power, 'actor', pa.nickname,
          'target', coalesce(pt.nickname, 'Tout le S.I.D.'), 'created_at', a.created_at, 'ends_at', a.ends_at,
          'cancelled', a.cancelled_at is not null, 'active', a.cancelled_at is null and a.ends_at > now()) as x
        from public.troll_actions a
        join public.profiles pa on pa.id = a.actor_id
        left join public.profiles pt on pt.id = a.target_id
        order by a.id desc limit 60
      ) s), '[]'::jsonb),
    'shields', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'nickname', p.nickname, 'reason', s.reason, 'created_at', s.created_at))
      from public.troll_shields s join public.profiles p on p.id = s.user_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_grant_title(p_user uuid, p_title text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_res text;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  v_res := public.grant_title(p_user, p_title, 'admin');
  if v_res = 'unknown' then
    raise exception 'Titre ou membre inconnu.';
  end if;
  perform public.write_audit('title_granted', p_user, jsonb_build_object('titre', p_title, 'resultat', v_res));
  return v_res;
end;
$$;

create or replace function public.admin_revoke_title(p_user uuid, p_title text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  update public.profiles set equipped_title = null where id = p_user and equipped_title = p_title;
  delete from public.user_titles where user_id = p_user and title_id = p_title;
  if found then
    perform public.write_audit('title_revoked', p_user, jsonb_build_object('titre', p_title));
  end if;
end;
$$;

create or replace function public.set_trolls_enabled(p_enabled boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  insert into public.app_config (key, value) values ('trolls_enabled', case when p_enabled then '1' else '0' end)
  on conflict (key) do update set value = excluded.value;
  perform public.write_audit('trolls_toggled', null, jsonb_build_object('actives', p_enabled));
end;
$$;

create or replace function public.set_troll_shield(p_user uuid, p_on boolean, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if p_on then
    insert into public.troll_shields (user_id, set_by, reason) values (p_user, auth.uid(), nullif(btrim(p_reason), ''))
    on conflict (user_id) do update set set_by = excluded.set_by, reason = excluded.reason, created_at = now();
    update public.troll_actions set cancelled_at = now(), cancelled_by = auth.uid()
      where target_id = p_user and cancelled_at is null and ends_at > now();
  else
    delete from public.troll_shields where user_id = p_user;
  end if;
  perform public.write_audit(case when p_on then 'troll_shield_on' else 'troll_shield_off' end, p_user,
    jsonb_build_object('raison', nullif(btrim(p_reason), '')));
end;
$$;

-- ---------------------------------------------------------
-- 7) Droits
-- ---------------------------------------------------------
revoke execute on function public.grant_title(uuid, text, text) from public, anon, authenticated;
revoke execute on function public._bump_daily(uuid, text) from public, anon, authenticated;
revoke execute on function public._check_magnat(uuid) from public, anon, authenticated;
revoke execute on function public._is_admin(uuid) from public, anon, authenticated;
revoke execute on function public._is_birthday(uuid) from public, anon, authenticated;
revoke execute on function public._route_length_units(uuid) from public, anon, authenticated;
revoke execute on function public._place_distance_units(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._map_km_per_unit() from public, anon, authenticated;

-- Les détenteurs du rang Divin ont déjà vaincu le niveau 101 de Donjons.
do $$
declare
  r record;
begin
  for r in select id from public.profiles where member_rank = 'Divin' loop
    perform public.grant_title(r.id, 'dragon', 'simulation');
  end loop;
end;
$$;

-- ---------------------------------------------------------
-- 8) Fonctions existantes complétées
-- ---------------------------------------------------------

-- Simulations : niveau 101 des trois simulations (copie de 0057 + titres).
create or replace function public.complete_simulation_run(p_token_hash text, p_success boolean, p_epreuve text default null, p_niveau int default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_run public.simulation_runs;
  v_skill text;
  v_factor text;
  v_min_seconds numeric := public.get_config_numeric('simulation_min_seconds', 20);
  v_limit int := public.get_config_numeric('simulation_max_results_per_day', 10)::int;
  v_old int;
  v_new int;
  v_points int := 0;
  v_value numeric;
  v_power numeric;
  v_divine boolean := false;
  v_title text;
  v_title_result text;
  v_ok101 boolean;
begin
  if p_success is null then
    raise exception 'Résultat manquant';
  end if;

  select * into v_run from public.simulation_runs where token_hash = p_token_hash for update;
  if v_run.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  if v_run.status <> 'started' then
    return jsonb_build_object('result', 'already_completed', 'status', v_run.status, 'points_awarded', v_run.points_awarded);
  end if;

  -- Compétence jouée : imposée pour une simulation à épreuve unique, à
  -- préciser pour l'Intelligence (Potions, Énigmes ou Problème).
  v_skill := case v_run.kind
    when 'donjons' then 'mondes-vivants'
    when 'techniques' then 'techniques'
    else case when public.skill_kind(p_epreuve) = 'intelligence' then p_epreuve end
  end;
  if v_skill is null then
    -- La partie reste ouverte : le bon résultat peut encore arriver.
    return jsonb_build_object('result', 'invalid_epreuve');
  end if;

  -- Niveaux cachés 101 de l'Intelligence et des Techniques : seulement après
  -- les 100 niveaux (les trois épreuves à 100 pour l'Intelligence).
  if p_niveau = 101 and v_run.kind in ('intelligence', 'techniques') then
    if v_run.kind = 'techniques' then
      v_ok101 := coalesce((select points from public.member_skills where user_id = v_run.user_id and skill = 'techniques'), 0) >= 100;
    else
      v_ok101 := (select count(*) from public.member_skills
                  where user_id = v_run.user_id and skill in ('potions', 'enigmes', 'probleme') and points >= 100) = 3;
    end if;
    if not v_ok101 then
      return jsonb_build_object('result', 'level_locked', 'niveau', 101, 'value', 100);
    end if;
  end if;

  -- Donjons : une histoire dure environ 3 h et peut se jouer en plusieurs
  -- fois ; la partie reste valable 24 h.
  if (v_run.kind <> 'donjons' and v_run.expires_at < now())
     or (v_run.kind = 'donjons' and v_run.started_at < now() - interval '24 hours') then
    update public.simulation_runs set status = 'expired', finished_at = now() where id = v_run.id;
    return jsonb_build_object('result', 'expired');
  end if;

  if now() - v_run.started_at < (v_min_seconds || ' seconds')::interval then
    return jsonb_build_object('result', 'too_fast', 'min_seconds', v_min_seconds);
  end if;

  if public.simulation_results_today(v_run.user_id, v_run.kind) >= v_limit then
    update public.simulation_runs set status = 'abandoned', finished_at = now() where id = v_run.id;
    return jsonb_build_object('result', 'daily_limit', 'max_results_per_day', v_limit);
  end if;

  insert into public.member_skills (user_id, skill) values (v_run.user_id, v_skill) on conflict do nothing;
  select points into v_old from public.member_skills where user_id = v_run.user_id and skill = v_skill for update;

  -- Donjons : niveau = numéro de la dernière histoire terminée. Seule
  -- l'histoire suivante fait monter la Puissance ; la partie reste ouverte
  -- sinon (le prochain résultat pourra encore compter).
  if v_run.kind = 'donjons' and p_success and p_niveau is not null then
    if p_niveau <= v_old then
      return jsonb_build_object('result', 'already_validated', 'niveau', p_niveau, 'value', v_old);
    elsif p_niveau > v_old + 1 then
      return jsonb_build_object('result', 'level_locked', 'niveau', p_niveau, 'value', v_old);
    end if;
  end if;

  v_new := v_old;
  if p_success then
    v_new := least(100, v_old + 1);
    v_points := v_new - v_old;
    if v_points > 0 then
      update public.member_skills set points = v_new, updated_at = now()
        where user_id = v_run.user_id and skill = v_skill;
    end if;
  end if;

  update public.simulation_runs
    set status = case when p_success then 'success' else 'failure' end,
        points_awarded = v_points,
        skill = v_skill,
        finished_at = now()
    where id = v_run.id;

  -- Niveau caché 101 (Donjons) : rang Divin.
  if v_run.kind = 'donjons' and p_success and p_niveau = 101 then
    update public.profiles set member_rank = 'Divin' where id = v_run.user_id and member_rank <> 'Divin';
    if found then
      v_divine := true;
      insert into public.notifications (user_id, type, title, body, link)
      values (v_run.user_id, 'announcement', '✦ Tu es devenu Divin',
              'Le Primordial est vaincu : le Trône de l''Archive t''a reconnu. Ton rang est désormais Divin.',
              '/dashboard/profile');
      perform public.write_audit('rank_divine', v_run.user_id, jsonb_build_object('niveau', 101));
    end if;
  end if;

  -- Niveau 101 réussi (les trois simulations) : le titre de la simulation.
  if p_success and p_niveau = 101 then
    v_title := case v_run.kind when 'donjons' then 'dragon' when 'intelligence' then 'architecte' else 'foudre' end;
    v_title_result := public.grant_title(v_run.user_id, v_title, 'simulation');
  end if;

  v_factor := public.simulation_factor(v_run.kind);
  execute format('select %I from public.member_stats where user_id = $1', v_factor) into v_value using v_run.user_id;
  select power_score into v_power from public.profiles where id = v_run.user_id;

  return jsonb_build_object(
    'result', 'ok',
    'status', case when p_success then 'success' else 'failure' end,
    'kind', v_run.kind,
    'factor', v_factor,
    'skill', v_skill,
    'skill_value', v_new,
    'points_awarded', v_points,
    'divine', v_divine,
    'title', v_title,
    'title_name', (select name from public.titles where id = v_title),
    'title_result', v_title_result,
    'value', v_value,
    'power', v_power
  );
end;
$$;


revoke execute on function public.complete_simulation_run(text, boolean, text, int) from public, anon, authenticated;
grant execute on function public.complete_simulation_run(text, boolean, text, int) to service_role;

-- Export des données : + titres, farces, anniversaire (copie de 0060).
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
  v_part jsonb;
  r record;
begin
  if v_uid is null then
    raise exception 'Non connecté.';
  end if;

  v_out := jsonb_build_object(
    'export', jsonb_build_object('date', now(), 'format', 'JSON', 'note', 'Toutes les données liées à ton compte sur le S.I.D. (Dossier Central, Cartographie, Wiki).'),
    'compte', jsonb_build_object('email', (select email from auth.users where id = v_uid)),
    'dossier', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'actions_d_administration_te_concernant', coalesce((
      select jsonb_agg(jsonb_build_object('date', a.created_at, 'action', a.action, 'par', a.actor_nickname, 'details', a.details) order by a.created_at)
      from public.audit_log a where a.target_user_id = v_uid), '[]'::jsonb),
    'abonnements_push', (select count(*) from public.push_subscriptions ps where ps.user_id = v_uid)
  );

  for r in
    select * from (values
      ('portefeuille', 'public.wallets', 'user_id'),
      ('compte_bancaire', 'public.bank_accounts', 'user_id'),
      ('transactions', 'public.transactions', 'user_id'),
      ('achats', 'public.purchases', 'user_id'),
      ('objets_consommables', 'public.member_consumables', 'user_id'),
      ('quetes_creees', 'public.quests', 'created_by'),
      ('participations_aux_quetes', 'public.quest_participants', 'user_id'),
      ('messages_envoyes', 'public.chat_messages', 'sender_id'),
      ('salons', 'public.chat_participants', 'user_id'),
      ('notifications', 'public.notifications', 'user_id'),
      ('visites_par_jour', 'public.activity_log', 'user_id'),
      ('caracteristiques', 'public.member_stats', 'user_id'),
      ('competences', 'public.member_skills', 'user_id'),
      ('simulations', 'public.simulation_runs', 'user_id'),
      ('progression_des_simulations', 'public.simulation_progress', 'user_id'),
      ('blessures', 'public.simulation_injuries', 'user_id'),
      ('arbre_technologique', 'public.tech_purchases', 'user_id'),
      ('sanctions', 'public.sanctions', 'user_id'),
      ('historique_puissance', 'public.power_score_log', 'user_id'),
      ('apparence_personnalisee', 'public.profile_styles', 'user_id'),
      ('raids', 'public.boss_raid_members', 'user_id'),
      ('entreprises_fondees', 'public.businesses', 'founder_id'),
      ('actions_d_entreprises', 'public.business_shareholders', 'user_id'),
      ('emplois', 'public.business_employees', 'user_id'),
      ('roles', 'public.user_roles', 'user_id'),
      ('groupes', 'public.group_members', 'user_id'),
      ('role_espion', 'public.spy_roles', 'user_id'),
      ('rapports_d_espion', 'public.spy_reports', 'spy_id'),
      ('compte_de_test', 'public.sandbox_accounts', 'user_id'),
      ('demandes_donnees', 'public.privacy_requests', 'user_id'),
      ('carte_position', 'public.character_positions', 'user_id'),
      ('carte_commentaires', 'public.map_comments', 'user_id'),
      ('carte_locations_de_montures', 'public.mount_rental_log', 'user_id'),
      ('carte_marche_noir_achats', 'public.black_market_sales', 'buyer_id'),
      ('carte_marche_noir_ventes', 'public.black_market_sales', 'seller_id'),
      ('wiki_commentaires', 'public.wiki_comments', 'author_id'),
      ('wiki_favoris', 'public.wiki_favorites', 'user_id'),
      ('wiki_notes_personnelles', 'public.wiki_notes', 'user_id'),
      ('wiki_signalements', 'public.wiki_reports', 'author_id'),
      ('titres', 'public.user_titles', 'user_id'),
      ('progression_des_titres', 'public.title_progress', 'user_id'),
      ('anniversaire', 'public.member_birthdays', 'user_id'),
      ('cadeaux_d_anniversaire_offerts', 'public.birthday_gifts', 'giver_id'),
      ('cadeaux_d_anniversaire_recus', 'public.birthday_gifts', 'receiver_id'),
      ('farces_lancees', 'public.troll_actions', 'actor_id'),
      ('farces_subies', 'public.troll_actions', 'target_id'),
      ('reponses_aux_farces', 'public.troll_responses', 'user_id')
    ) as t(k, tbl, col)
  loop
    if to_regclass(r.tbl) is not null and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = split_part(r.tbl, '.', 2) and c.column_name = r.col
    ) then
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(x) - array[''token_hash'', ''endpoint'', ''auth'', ''p256dh'']), ''[]''::jsonb) from %s x where x.%I = $1',
        r.tbl, r.col) into v_part using v_uid;
      v_out := v_out || jsonb_build_object(r.k, v_part);
    end if;
  end loop;

  return v_out;
end;
$$;


-- Journal par membre : + titres et farces (copie de 0060).
create or replace function public.admin_member_timeline(p_user uuid, p_days int default 60, p_limit int default 400)
returns table (at timestamptz, source text, action text, label text, details jsonb, amount numeric, actor text)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 60), 1), 3650));
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;

  return query
  select * from (
    -- Administration : ce qu'on lui a fait, et ce qu'il a fait (s'il est admin)
    select a.created_at, 'admin'::text,
           a.action, case when a.actor_id = p_user and a.target_user_id is distinct from p_user then 'a agi sur ' || coalesce(a.target_label, '—') else null end,
           a.details, null::numeric, a.actor_nickname
    from public.audit_log a
    where (a.target_user_id = p_user or a.actor_id = p_user) and a.created_at > v_since
    union all
    select t.created_at, 'argent', 'transaction', t.reason, null::jsonb, t.amount::numeric, null::text
    from public.transactions t where t.user_id = p_user and t.created_at > v_since
    union all
    select pu.created_at, 'boutique', 'achat',
           coalesce(si.name, 'Objet') || case when pu.quantity > 1 then ' ×' || pu.quantity else '' end,
           jsonb_build_object('statut', pu.status), -pu.total_price::numeric, null::text
    from public.purchases pu left join public.shop_items si on si.id = pu.item_id
    where pu.user_id = p_user and pu.created_at > v_since
    union all
    select qp.joined_at, 'quete', 'participation', q.title, jsonb_build_object('statut', qp.status), null::numeric, null::text
    from public.quest_participants qp join public.quests q on q.id = qp.quest_id
    where qp.user_id = p_user and qp.joined_at > v_since
    union all
    select q.created_at, 'quete', 'creation', q.title, null::jsonb, null::numeric, null::text
    from public.quests q where q.created_by = p_user and q.created_at > v_since
    union all
    select coalesce(r.finished_at, r.started_at), 'simulation', r.kind, r.status,
           jsonb_build_object('points', r.points_awarded,
                              'duree_s', case when r.finished_at is not null then extract(epoch from r.finished_at - r.started_at)::int end),
           null::numeric, null::text
    from public.simulation_runs r where r.user_id = p_user and r.started_at > v_since
    union all
    -- Messages : seulement le nombre par jour, jamais le contenu
    select max(m.created_at), 'messages', 'messages', null::text,
           jsonb_build_object('nombre', count(*), 'salons', count(distinct m.channel_id)), null::numeric, null::text
    from public.chat_messages m where m.sender_id = p_user and m.created_at > v_since
    group by date_trunc('day', m.created_at)
    union all
    select (al.day + time '12:00')::timestamptz, 'visite', 'visites', null::text,
           jsonb_build_object('nombre', al.visits), null::numeric, null::text
    from public.activity_log al where al.user_id = p_user and al.day > v_since::date
    union all
    select sa.created_at, 'sanction', sa.type, sa.reason,
           jsonb_build_object('active', sa.is_active, 'expire', sa.expires_at), sa.amount::numeric,
           (select nickname from public.profiles where id = sa.issued_by)
    from public.sanctions sa where sa.user_id = p_user and sa.created_at > v_since
    union all
    select pl.created_at, 'puissance', 'puissance', null::text,
           jsonb_build_object('avant', pl.old_score, 'apres', pl.new_score), null::numeric,
           (select nickname from public.profiles where id = pl.changed_by)
    from public.power_score_log pl where pl.user_id = p_user and pl.created_at > v_since
    union all
    select tp.created_at, 'techno', tp.node, null::text, jsonb_build_object('niveau', tp.level, 'cout', tp.cost), null::numeric, null::text
    from public.tech_purchases tp where tp.user_id = p_user and tp.created_at > v_since
    union all
    select bm.joined_at, 'raid', 'raid', null::text, null::jsonb, null::numeric, null::text
    from public.boss_raid_members bm where bm.user_id = p_user and bm.joined_at > v_since
    union all
    select aa.created_at, 'alerte', aa.kind, aa.title, aa.details || jsonb_build_object('gravite', aa.severity, 'statut', aa.status), null::numeric, null::text
    from public.activity_alerts aa where aa.user_id = p_user and aa.created_at > v_since
    union all
    select ut.obtained_at, 'titre', 'titre', t.name, jsonb_build_object('niveau', ut.level, 'source', ut.source), null::numeric, null::text
    from public.user_titles ut join public.titles t on t.id = ut.title_id
    where ut.user_id = p_user and ut.obtained_at > v_since
    union all
    select ta.created_at, 'troll', ta.power,
           case when ta.actor_id = p_user
                then 'a trollé ' || coalesce((select nickname from public.profiles where id = ta.target_id), 'tout le S.I.D.')
                else 'trollé par ' || coalesce((select nickname from public.profiles where id = ta.actor_id), '?') end,
           jsonb_build_object('annulee', ta.cancelled_at is not null, 'fin', ta.ends_at), null::numeric,
           (select nickname from public.profiles where id = ta.actor_id)
    from public.troll_actions ta
    where (ta.actor_id = p_user or ta.target_id = p_user) and ta.created_at > v_since
  ) x
  order by 1 desc
  limit least(greatest(coalesce(p_limit, 400), 1), 2000);
end;
$$;

