-- =========================================================
-- Système d'espionnage RP (rôle caché)
-- =========================================================

-- Nouvelle permission dédiée : assigner/retirer le rôle d'espion,
-- consulter les rapports (pour garder un œil sur les abus).
alter table public.role_permissions drop constraint if exists role_permissions_permission_check;
alter table public.role_permissions add constraint role_permissions_permission_check check (permission in (
  'manage_roles','manage_org_chart','manage_quests','manage_shop',
  'manage_teams','manage_economy','recruit','manage_users','manage_espionage'
));

insert into public.role_permissions (role_id, permission)
  select id, 'manage_espionage' from public.roles where name = 'Fondateur'
  on conflict do nothing;

-- Un salon doit explicitement être marqué "espionnable" à sa création.
-- Un DM en tête-à-tête ne peut JAMAIS l'être (contrainte, pas juste une règle d'UI).
alter table public.chat_channels add column spy_eligible boolean not null default false;
alter table public.chat_channels add constraint chat_channels_dm_not_spyable
  check (type <> 'dm' or spy_eligible = false);

-- Rôle caché "Espion" : table séparée du profil pour qu'aucune requête
-- classique sur `profiles` ne puisse jamais exposer ce statut par erreur.
create table public.spy_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  spy_level int not null default 1 check (spy_level between 1 and 3),
  last_spied_at timestamptz,
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.spy_roles enable row level security;

-- Un espion voit sa propre fiche (pour connaître son niveau / cooldown) ;
-- seule la permission manage_espionage voit/attribue le reste.
create policy "spy_roles_select_self_or_admin" on public.spy_roles for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_espionage'));

create policy "spy_roles_manage" on public.spy_roles for all
  using (public.has_permission(auth.uid(), 'manage_espionage'))
  with check (public.has_permission(auth.uid(), 'manage_espionage'));

-- Rapports d'espionnage (visibles par l'espion lui-même + les gestionnaires,
-- pour permettre de vérifier qu'il n'y a pas d'abus du pouvoir)
create table public.spy_reports (
  id uuid primary key default gen_random_uuid(),
  spy_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  snippets jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.spy_reports enable row level security;

create policy "spy_reports_select" on public.spy_reports for select
  using (spy_id = auth.uid() or public.has_permission(auth.uid(), 'manage_espionage'));

create policy "spy_reports_manage" on public.spy_reports for all
  using (public.has_permission(auth.uid(), 'manage_espionage'))
  with check (public.has_permission(auth.uid(), 'manage_espionage'));

-- Liste les salons espionnables qu'un espion peut cibler (sans révéler
-- les autres salons privés, et sans rien renvoyer à un non-espion)
create or replace function public.list_spyable_channels()
returns table(id uuid, name text)
language sql
stable
security definer set search_path = public
as $$
  select c.id, coalesce(c.name, 'Discussion sans nom')
  from public.chat_channels c
  where c.spy_eligible = true
    and exists (select 1 from public.spy_roles sr where sr.user_id = auth.uid())
    and not exists (
      select 1 from public.chat_participants cp
      where cp.channel_id = c.id and cp.user_id = auth.uid()
    );
$$;

-- Action d'espionnage : 1h de cooldown, 1 à 3 messages aléatoires
-- selon le niveau, uniquement sur un salon marqué espionnable, et jamais
-- sur un salon dont l'espion fait déjà partie.
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

  update public.spy_roles set last_spied_at = now() where user_id = auth.uid();

  return v_report;
end;
$$;
