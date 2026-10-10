-- =========================================================
-- Journal d'audit : qui a fait quoi, et quand, pour les actions sensibles
-- d'administration (bannir/muter/geler, rôles et permissions, sanctions,
-- ajustements de solde ou de renommée, suspension d'une section du site,
-- réinitialisation de mot de passe, confirmation d'email…).
--
-- Principe : des triggers posés sur les tables concernées écrivent dans
-- `audit_log`, sans toucher aux fonctions existantes — donc rien à
-- reprogrammer à chaque nouvelle fonctionnalité, et impossible
-- d'"oublier" de journaliser un chemin d'accès. Seules adjust_wallet et
-- adjust_reputation (qui ne laissent aucune trace distinctive dans leurs
-- tables) sont recréées pour écrire elles-mêmes dans le journal.
--
-- Écriture : uniquement via write_audit(), non exécutable par les
-- membres (personne ne peut fabriquer une fausse entrée). Lecture :
-- permission manage_users. Aucune policy update/delete : le journal est
-- en ajout seul depuis le site.
-- =========================================================

create table public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_nickname text,        -- instantané : reste lisible même si le pseudo change plus tard
  action text not null,
  target_user_id uuid,        -- volontairement sans clé étrangère : le journal survit à la suppression d'un compte
  target_label text,
  details jsonb not null default '{}'::jsonb
);

create index audit_log_created_idx on public.audit_log (created_at desc, id desc);
create index audit_log_action_idx on public.audit_log (action, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select" on public.audit_log for select
  using (public.has_permission(auth.uid(), 'manage_users'));

-- ---------------------------------------------------------
-- Écriture interne
-- ---------------------------------------------------------
create or replace function public.write_audit(
  p_action text,
  p_target uuid default null,
  p_details jsonb default '{}'::jsonb,
  p_target_label text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_nick text;
  v_label text := p_target_label;
begin
  if v_actor is not null then
    select nickname into v_nick from public.profiles where id = v_actor;
  end if;
  if v_label is null and p_target is not null then
    select nickname into v_label from public.profiles where id = p_target;
  end if;

  insert into public.audit_log (actor_id, actor_nickname, action, target_user_id, target_label, details)
  values (v_actor, v_nick, p_action, p_target, v_label, coalesce(p_details, '{}'::jsonb));
end;
$$;

revoke execute on function public.write_audit(text, uuid, jsonb, text) from public, anon, authenticated;

-- Pour les routes serveur (réinitialisation de mot de passe, confirmation
-- d'email) : liste blanche d'actions, réservée à manage_users.
create or replace function public.log_admin_action(p_action text, p_target uuid default null, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée';
  end if;
  if p_action not in ('password_reset', 'email_confirmed') then
    raise exception 'Action non journalisable';
  end if;
  perform public.write_audit(p_action, p_target, p_details);
end;
$$;

-- ---------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------
create or replace function public.audit_profiles_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_changes jsonb := '{}'::jsonb;
  k text;
begin
  foreach k in array array['status', 'is_muted', 'is_frozen', 'is_founder', 'member_rank', 'power_score'] loop
    if v_old -> k is distinct from v_new -> k then
      v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k));
    end if;
  end loop;
  if v_changes <> '{}'::jsonb then
    perform public.write_audit('profile_changed', new.id, v_changes, new.nickname);
  end if;
  return new;
end;
$$;

-- La clause WHEN évite de réveiller le trigger à chaque simple mise à jour
-- de last_seen_at (une par visite).
drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after update on public.profiles
  for each row
  when (
    old.status is distinct from new.status
    or old.is_muted is distinct from new.is_muted
    or old.is_frozen is distinct from new.is_frozen
    or old.is_founder is distinct from new.is_founder
    or old.member_rank is distinct from new.member_rank
    or old.power_score is distinct from new.power_score
  )
  execute function public.audit_profiles_change();

create or replace function public.audit_user_roles()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.user_roles := case when tg_op = 'DELETE' then old else new end;
  v_role text;
begin
  select name into v_role from public.roles where id = v_row.role_id;
  perform public.write_audit(
    case when tg_op = 'DELETE' then 'role_removed' else 'role_assigned' end,
    v_row.user_id,
    jsonb_build_object('role', v_role)
  );
  return null;
end;
$$;

drop trigger if exists trg_audit_user_roles on public.user_roles;
create trigger trg_audit_user_roles
  after insert or delete on public.user_roles
  for each row execute function public.audit_user_roles();

create or replace function public.audit_role_permissions()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.role_permissions := case when tg_op = 'DELETE' then old else new end;
  v_role text;
begin
  select name into v_role from public.roles where id = v_row.role_id;
  perform public.write_audit(
    case when tg_op = 'DELETE' then 'permission_revoked' else 'permission_granted' end,
    null,
    jsonb_build_object('role', v_role, 'permission', v_row.permission)
  );
  return null;
end;
$$;

drop trigger if exists trg_audit_role_permissions on public.role_permissions;
create trigger trg_audit_role_permissions
  after insert or delete on public.role_permissions
  for each row execute function public.audit_role_permissions();

create or replace function public.audit_roles()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('role_created', null, jsonb_build_object('name', new.name));
  elsif tg_op = 'DELETE' then
    perform public.write_audit('role_deleted', null, jsonb_build_object('name', old.name));
  elsif old.name is distinct from new.name or old.rank is distinct from new.rank or old.color is distinct from new.color then
    perform public.write_audit('role_updated', null, jsonb_build_object('name', new.name, 'previous_name', old.name));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_roles on public.roles;
create trigger trg_audit_roles
  after insert or update or delete on public.roles
  for each row execute function public.audit_roles();

create or replace function public.audit_sanctions()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('sanction_issued', new.user_id, jsonb_build_object(
      'type', new.type, 'reason', new.reason, 'amount', new.amount, 'expires_at', new.expires_at));
  elsif old.is_active and not new.is_active then
    perform public.write_audit('sanction_ended', new.user_id, jsonb_build_object('type', new.type));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_sanctions on public.sanctions;
create trigger trg_audit_sanctions
  after insert or update on public.sanctions
  for each row execute function public.audit_sanctions();

create or replace function public.audit_maintenance()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.write_audit('maintenance_changed', null, jsonb_build_object('section', new.key, 'enabled', new.is_enabled));
  return null;
end;
$$;

drop trigger if exists trg_audit_maintenance on public.maintenance_flags;
create trigger trg_audit_maintenance
  after update on public.maintenance_flags
  for each row when (old.is_enabled is distinct from new.is_enabled)
  execute function public.audit_maintenance();

-- ---------------------------------------------------------
-- Ajustements manuels : recréés (logique inchangée) pour journaliser.
-- ---------------------------------------------------------
create or replace function public.adjust_wallet(p_user_id uuid, p_amount numeric, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Permission refusée';
  end if;

  update public.wallets set balance = balance + p_amount where user_id = p_user_id;

  insert into public.transactions (user_id, amount, reason, created_by)
  values (p_user_id, p_amount, coalesce(p_reason, 'Ajustement manuel'), auth.uid());

  perform public.write_audit('wallet_adjusted', p_user_id,
    jsonb_build_object('amount', p_amount, 'reason', coalesce(p_reason, 'Ajustement manuel')));
end;
$$;

create or replace function public.adjust_reputation(p_user_id uuid, p_amount int, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not (public.has_permission(auth.uid(), 'manage_economy') or public.has_permission(auth.uid(), 'manage_users')) then
    raise exception 'Permission refusée';
  end if;

  update public.profiles set reputation = reputation + p_amount where id = p_user_id;

  perform public.write_audit('reputation_adjusted', p_user_id,
    jsonb_build_object('amount', p_amount, 'reason', p_reason));
end;
$$;

-- ---------------------------------------------------------
-- Lecture paginée, filtrable par type d'action.
-- ---------------------------------------------------------
create or replace function public.list_audit_log(p_limit int default 50, p_offset int default 0, p_action text default null)
returns table (
  id bigint,
  created_at timestamptz,
  actor_id uuid,
  actor_nickname text,
  action text,
  target_user_id uuid,
  target_label text,
  details jsonb
)
language sql
stable
security definer set search_path = public
as $$
  select a.id, a.created_at, a.actor_id,
         coalesce(a.actor_nickname, p.nickname),
         a.action, a.target_user_id,
         coalesce(t.nickname, a.target_label),
         a.details
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id
  left join public.profiles t on t.id = a.target_user_id
  where public.has_permission(auth.uid(), 'manage_users')
    and (p_action is null or a.action = p_action)
  order by a.created_at desc, a.id desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;
