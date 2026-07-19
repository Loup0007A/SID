-- =========================================================
-- S.I.D. — Schéma initial
-- À exécuter dans Supabase (SQL Editor) ou via `supabase db push`
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. PROFILS (comptes)
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  nickname text not null,
  weapons text,
  equipment text,
  description text,
  age int,
  avatar_url text,
  desired_role text,               -- rôle demandé lors de l'inscription (texte libre)
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'banned')),
  is_founder boolean not null default false, -- rôle admin transparent (remplace toute idée de compte caché)
  hidden_fields text[] not null default '{}', -- ex: '{"age","weapons"}' -> masqués aux autres membres
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column public.profiles.hidden_fields is
  'Liste des colonnes que le titulaire du compte a choisi de masquer aux autres membres (hors staff avec la permission manage_users).';

-- Création automatique du profil "pending" à l'inscription,
-- à partir des métadonnées envoyées par le formulaire (voir /register).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, first_name, last_name, nickname, weapons, equipment,
    description, age, avatar_url, desired_role
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'nickname', ''),
    new.raw_user_meta_data->>'weapons',
    new.raw_user_meta_data->>'equipment',
    new.raw_user_meta_data->>'description',
    nullif(new.raw_user_meta_data->>'age', '')::int,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'desired_role'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- 2. ROLES, PERMISSIONS, APPARTENANCES
-- =========================================================
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  color text not null default '#4B5842',
  rank int not null default 0, -- utilisé pour trier l'organigramme / badges
  created_at timestamptz not null default now()
);

-- Catalogue fermé des permissions possibles
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission text not null check (permission in (
    'manage_roles',      -- créer/éditer rôles et permissions
    'manage_org_chart',  -- éditer l'organigramme
    'manage_quests',     -- créer/éditer/valider les quêtes
    'manage_shop',       -- gérer la boutique
    'manage_teams',      -- créer/éditer des groupes/équipes
    'manage_economy',    -- créditer/débiter manuellement de l'argent
    'recruit',           -- traiter les candidatures d'inscription
    'manage_users'       -- éditer les comptes, voir les champs masqués
  )),
  primary key (role_id, permission)
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Fonction utilitaire : est-ce que l'utilisateur `uid` a la permission `perm` ?
-- (is_founder = true équivaut à toutes les permissions ci-dessus, mais PAS à
--  un accès au contenu des salons de discussion privés — voir section chat)
create or replace function public.has_permission(uid uuid, perm text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select
    coalesce((select is_founder from public.profiles where id = uid), false)
    or exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = uid and rp.permission = perm
    );
$$;

-- =========================================================
-- 3. GROUPES / ÉQUIPES (systèmes indépendants inclus)
-- =========================================================
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null default 'other'
    check (type in ('org_branch', 'quest_team', 'guild_team', 'other')),
  is_independent_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_in_group text default 'membre',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- =========================================================
-- 4. ORGANIGRAMME
-- =========================================================
create table public.org_nodes (
  id uuid primary key default gen_random_uuid(),
  label text not null,               -- titre du poste
  parent_id uuid references public.org_nodes(id) on delete cascade,
  holder_id uuid references public.profiles(id),
  group_id uuid references public.groups(id),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 5. QUÊTES
-- =========================================================
create table public.quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  reward numeric(10,2) not null default 0,
  difficulty text not null default 'D' check (difficulty in ('E','D','C','B','A','S')),
  deadline timestamptz,
  status text not null default 'open'
    check (status in ('open','in_progress','completed','failed','cancelled')),
  visibility text not null default 'members'
    check (visibility in ('public','members','private')),
  max_participants int,
  assigned_group_id uuid references public.groups(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.quest_participants (
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'assigned'
    check (status in ('assigned','submitted','validated','rejected')),
  joined_at timestamptz not null default now(),
  primary key (quest_id, user_id)
);

-- =========================================================
-- 6. ÉCONOMIE (portefeuilles + transactions)
-- =========================================================
create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null, -- positif = crédit, négatif = débit
  reason text,
  related_quest_id uuid references public.quests(id),
  related_purchase_id uuid, -- FK ajoutée après création de purchases
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- 7. BOUTIQUE
-- =========================================================
create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  stock int, -- null = illimité
  image_url text,
  visibility text not null default 'members' check (visibility in ('public','members')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.shop_items(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity int not null default 1,
  total_price numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','delivered','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.transactions
  add constraint transactions_purchase_fk
  foreign key (related_purchase_id) references public.purchases(id);

-- =========================================================
-- 8. MESSAGERIE PRIVÉE / DE GROUPE
-- =========================================================
create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'group' check (type in ('dm','group','application')),
  name text,
  related_application_id uuid references public.profiles(id), -- fil de discussion recrutement
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.chat_participants (
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (channel_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 9. FONCTION DE PROFIL "PUBLIC" (redaction des champs masqués)
-- =========================================================
create or replace function public.get_visible_profile(target uuid, viewer uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  p public.profiles;
  result jsonb;
  can_see_all boolean;
begin
  select * into p from public.profiles where id = target;
  if p.id is null then
    return null;
  end if;

  can_see_all := (viewer = target) or public.has_permission(viewer, 'manage_users');

  result := to_jsonb(p);

  if not can_see_all then
    -- on retire les champs que le titulaire a choisi de masquer
    select result - elem
    into result
    from unnest(p.hidden_fields) as elem;
  end if;

  return result;
end;
$$;

-- =========================================================
-- 10. ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.org_nodes enable row level security;
alter table public.quests enable row level security;
alter table public.quest_participants enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.shop_items enable row level security;
alter table public.purchases enable row level security;
alter table public.chat_channels enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

-- ---- profiles ----
-- Lecture : soi-même, staff (manage_users/recruit), ou tout membre actif
-- (le masquage des champs se fait via get_visible_profile côté application)
create policy "profiles_select" on public.profiles for select
  using (
    auth.uid() = id
    or public.has_permission(auth.uid(), 'manage_users')
    or public.has_permission(auth.uid(), 'recruit')
    or status = 'active'
  );

create policy "profiles_update_self" on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_update_staff" on public.profiles for update
  using (public.has_permission(auth.uid(), 'manage_users') or public.has_permission(auth.uid(), 'recruit'));

-- ---- roles / permissions / user_roles ----
create policy "roles_select_all" on public.roles for select using (true);
create policy "roles_manage" on public.roles for all
  using (public.has_permission(auth.uid(), 'manage_roles'))
  with check (public.has_permission(auth.uid(), 'manage_roles'));

create policy "role_permissions_select_all" on public.role_permissions for select using (true);
create policy "role_permissions_manage" on public.role_permissions for all
  using (public.has_permission(auth.uid(), 'manage_roles'))
  with check (public.has_permission(auth.uid(), 'manage_roles'));

create policy "user_roles_select_all" on public.user_roles for select using (true);
create policy "user_roles_manage" on public.user_roles for all
  using (public.has_permission(auth.uid(), 'manage_roles'))
  with check (public.has_permission(auth.uid(), 'manage_roles'));

-- ---- groups / group_members ----
create policy "groups_select_all" on public.groups for select using (true);
create policy "groups_manage" on public.groups for all
  using (public.has_permission(auth.uid(), 'manage_teams'))
  with check (public.has_permission(auth.uid(), 'manage_teams'));

create policy "group_members_select_all" on public.group_members for select using (true);
create policy "group_members_manage" on public.group_members for all
  using (public.has_permission(auth.uid(), 'manage_teams'))
  with check (public.has_permission(auth.uid(), 'manage_teams'));

-- ---- org_nodes ----
create policy "org_nodes_select_all" on public.org_nodes for select using (true);
create policy "org_nodes_manage" on public.org_nodes for all
  using (public.has_permission(auth.uid(), 'manage_org_chart'))
  with check (public.has_permission(auth.uid(), 'manage_org_chart'));

-- ---- quests ----
create policy "quests_select" on public.quests for select
  using (
    visibility = 'public'
    or (visibility = 'members' and auth.uid() is not null)
    or (visibility = 'private' and (
      created_by = auth.uid()
      or public.has_permission(auth.uid(), 'manage_quests')
      or exists (select 1 from public.quest_participants qp where qp.quest_id = id and qp.user_id = auth.uid())
    ))
  );

create policy "quests_manage" on public.quests for all
  using (public.has_permission(auth.uid(), 'manage_quests'))
  with check (public.has_permission(auth.uid(), 'manage_quests'));

-- ---- quest_participants ----
create policy "quest_participants_select" on public.quest_participants for select
  using (
    user_id = auth.uid()
    or public.has_permission(auth.uid(), 'manage_quests')
    or exists (select 1 from public.quests q where q.id = quest_id and q.created_by = auth.uid())
  );

create policy "quest_participants_join" on public.quest_participants for insert
  with check (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_quests'));

create policy "quest_participants_update" on public.quest_participants for update
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_quests'));

create policy "quest_participants_delete" on public.quest_participants for delete
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_quests'));

-- ---- wallets ----
create policy "wallets_select" on public.wallets for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

create policy "wallets_manage" on public.wallets for all
  using (public.has_permission(auth.uid(), 'manage_economy'))
  with check (public.has_permission(auth.uid(), 'manage_economy'));

-- ---- transactions ----
create policy "transactions_select" on public.transactions for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy'));

create policy "transactions_insert" on public.transactions for insert
  with check (public.has_permission(auth.uid(), 'manage_economy'));

-- ---- shop_items ----
create policy "shop_items_select" on public.shop_items for select
  using (
    (visibility = 'public' and is_active)
    or (visibility = 'members' and auth.uid() is not null)
    or public.has_permission(auth.uid(), 'manage_shop')
  );

create policy "shop_items_manage" on public.shop_items for all
  using (public.has_permission(auth.uid(), 'manage_shop'))
  with check (public.has_permission(auth.uid(), 'manage_shop'));

-- ---- purchases ----
create policy "purchases_select" on public.purchases for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_shop'));

create policy "purchases_insert" on public.purchases for insert
  with check (user_id = auth.uid());

create policy "purchases_update_staff" on public.purchases for update
  using (public.has_permission(auth.uid(), 'manage_shop'));

-- ---- chat : uniquement les participants du salon (y compris le fondateur,
--       AUCUNE dérogation de lecture pour préserver la confidentialité) ----
create policy "chat_channels_select" on public.chat_channels for select
  using (exists (
    select 1 from public.chat_participants cp
    where cp.channel_id = id and cp.user_id = auth.uid()
  ));

create policy "chat_channels_insert" on public.chat_channels for insert
  with check (created_by = auth.uid());

create policy "chat_participants_select" on public.chat_participants for select
  using (exists (
    select 1 from public.chat_participants cp2
    where cp2.channel_id = channel_id and cp2.user_id = auth.uid()
  ));

create policy "chat_participants_insert" on public.chat_participants for insert
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.chat_channels c where c.id = channel_id and c.created_by = auth.uid())
  );

create policy "chat_messages_select" on public.chat_messages for select
  using (exists (
    select 1 from public.chat_participants cp
    where cp.channel_id = channel_id and cp.user_id = auth.uid()
  ));

create policy "chat_messages_insert" on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_participants cp
      where cp.channel_id = channel_id and cp.user_id = auth.uid()
    )
  );

-- =========================================================
-- 11. DONNÉES DE DÉPART (rôles de base)
-- =========================================================
insert into public.roles (name, description, color, rank) values
  ('Fondateur', 'Accès complet à l''administration de la plateforme', '#B08D45', 100),
  ('État-Major', 'Gestion de la hiérarchie et des équipes', '#8C3B2E', 90),
  ('Officier Recruteur', 'Traite les candidatures d''entrée dans la S.I.D.', '#3E5C5B', 70),
  ('Maître des Quêtes', 'Crée et valide les quêtes/missions', '#4B5842', 70),
  ('Intendant', 'Gère la boutique et l''économie', '#4B5842', 70),
  ('Agent', 'Membre actif de la S.I.D.', '#6B7A5E', 10);

insert into public.role_permissions (role_id, permission)
  select id, unnest(array['manage_roles','manage_org_chart','manage_quests','manage_shop','manage_teams','manage_economy','recruit','manage_users'])
  from public.roles where name = 'Fondateur';

insert into public.role_permissions (role_id, permission)
  select id, unnest(array['manage_org_chart','manage_teams'])
  from public.roles where name = 'État-Major';

insert into public.role_permissions (role_id, permission)
  select id, 'recruit' from public.roles where name = 'Officier Recruteur';

insert into public.role_permissions (role_id, permission)
  select id, 'manage_quests' from public.roles where name = 'Maître des Quêtes';

insert into public.role_permissions (role_id, permission)
  select id, unnest(array['manage_shop','manage_economy'])
  from public.roles where name = 'Intendant';

-- Un portefeuille est automatiquement créé pour chaque nouveau profil
create or replace function public.handle_new_profile_wallet()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.wallets (user_id, balance) values (new.id, 0);
  return new;
end;
$$;

create trigger on_profile_created_wallet
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile_wallet();
