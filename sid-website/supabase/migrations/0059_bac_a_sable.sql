-- =========================================================
-- 0059 : bac à sable (comptes de test temporaires)
-- =========================================================
-- La gestion des comptes (manage_users) peut créer un compte de test :
-- actif tout de suite, invisible des autres membres, avec les permissions
-- choisies (jamais plus que celles de l'admin qui le crée), un rang et un
-- solde de départ, et une date d'expiration. L'admin peut y entrer depuis
-- son navigateur puis revenir à son compte.
--
-- Le compte de test agit sur le vrai site (ses quêtes, messages, achats sont
-- réels). À sa suppression (manuelle, ou automatique après expiration), tout
-- ce qu'il a créé est effacé avec lui.
--
-- Création et suppression du compte de connexion : route /api/admin/sandbox
-- (clé service_role). La logique et les contrôles sont ici, appelés avec la
-- session de l'admin pour que le journal d'audit sache qui a fait quoi.

alter table public.profiles add column if not exists sandbox_expires_at timestamptz;

create table if not exists public.sandbox_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  email text not null,
  permissions text[] not null default '{}',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.sandbox_accounts enable row level security;

drop policy if exists "sandbox_select" on public.sandbox_accounts;
create policy "sandbox_select" on public.sandbox_accounts for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));
-- Pas de policy d'écriture : uniquement via les fonctions ci-dessous.

-- ---------------------------------------------------------
-- Permissions : rôles + fondateur + permissions du bac à sable (tant que
-- le compte de test n'a pas expiré). Un compte de test expiré n'a plus
-- aucune permission, même par un rôle.
-- ---------------------------------------------------------
create or replace function public.has_permission(uid uuid, perm text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select
    case
      when exists (select 1 from public.sandbox_accounts s where s.user_id = uid and s.expires_at <= now()) then false
      else
        coalesce((select is_founder from public.profiles where id = uid), false)
        or exists (
          select 1
          from public.user_roles ur
          join public.role_permissions rp on rp.role_id = ur.role_id
          where ur.user_id = uid and rp.permission = perm
        )
        or exists (
          select 1 from public.sandbox_accounts s
          where s.user_id = uid and s.expires_at > now() and perm = any(s.permissions)
        )
    end;
$$;

create or replace function public.is_sandbox_account(uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.sandbox_accounts where user_id = uid);
$$;

-- ---------------------------------------------------------
-- Protection : sandbox_expires_at ne se modifie que par les fonctions.
-- (reprise de 0058 + cette règle)
-- ---------------------------------------------------------
create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_is_staff boolean;
begin
  -- Uniquement les appels directs depuis le navigateur / l'API.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  v_is_staff := public.has_permission(v_uid, 'manage_users');

  if new.is_founder is distinct from old.is_founder then
    if not coalesce((select p.is_founder from public.profiles p where p.id = v_uid), false) then
      raise exception 'Seul un fondateur peut modifier ce statut.';
    end if;
  end if;

  if (new.power_score is distinct from old.power_score
      or new.reputation is distinct from old.reputation
      or new.member_rank is distinct from old.member_rank
      or new.is_muted is distinct from old.is_muted)
     and not v_is_staff then
    raise exception 'Permission refusée : champ réservé à l''administration.';
  end if;

  if (new.status is distinct from old.status
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at)
     and not (v_is_staff or public.has_permission(v_uid, 'recruit')) then
    raise exception 'Permission refusée : statut du compte.';
  end if;

  if new.is_invisible is distinct from old.is_invisible
     and v_uid is distinct from new.id and not v_is_staff then
    raise exception 'Permission refusée : seul le membre ou la gestion des comptes peut rendre ce compte invisible.';
  end if;

  -- Un compte de test reste invisible ; personne ne change sa date d'expiration à la main.
  if new.sandbox_expires_at is distinct from old.sandbox_expires_at then
    raise exception 'Permission refusée : réglage du bac à sable.';
  end if;
  if new.sandbox_expires_at is not null and not new.is_invisible then
    raise exception 'Un compte de test reste invisible.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------
-- Mise en place d'un compte de test (appelée par /api/admin/sandbox juste
-- après la création du compte de connexion, avec la session de l'admin).
-- ---------------------------------------------------------
create or replace function public.setup_sandbox_account(
  p_user uuid,
  p_permissions text[],
  p_hours int,
  p_rank text default 'E',
  p_balance numeric default 1000
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_email text;
  v_profile public.profiles;
  v_perm text;
  v_perms text[] := '{}';
  v_expires timestamptz;
  v_hours int := greatest(1, least(coalesce(p_hours, 24), 24 * 30));
begin
  if v_admin is null or not public.has_permission(v_admin, 'manage_users') then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if public.is_sandbox_account(v_admin) then
    raise exception 'Un compte de test ne peut pas créer d''autre compte de test.';
  end if;

  -- Uniquement un compte de connexion tout juste créé pour le bac à sable :
  -- impossible de transformer un vrai compte en compte de test (qui serait
  -- ensuite effacé avec tout son historique).
  select email into v_email from auth.users where id = p_user;
  select * into v_profile from public.profiles where id = p_user;
  if v_email is null or v_profile.id is null
     or v_email not like 'sandbox-%@sid-quest.test'
     or v_profile.status <> 'pending'
     or v_profile.created_at < now() - interval '10 minutes'
     or exists (select 1 from public.sandbox_accounts where user_id = p_user) then
    raise exception 'Ce compte ne peut pas devenir un compte de test.';
  end if;

  -- Jamais plus de permissions que l'admin lui-même.
  foreach v_perm in array coalesce(p_permissions, '{}') loop
    if v_perm not in ('manage_roles', 'manage_org_chart', 'manage_quests', 'manage_shop', 'manage_teams',
                      'manage_economy', 'recruit', 'manage_users', 'entreprise') then
      raise exception 'Permission inconnue : %', v_perm;
    end if;
    if not public.has_permission(v_admin, v_perm) then
      raise exception 'Tu ne peux pas donner une permission que tu n''as pas : %', v_perm;
    end if;
    if not v_perm = any(v_perms) then
      v_perms := v_perms || v_perm;
    end if;
  end loop;

  if p_rank not in ('E', 'D', 'C', 'B', 'A', 'S') then
    raise exception 'Rang invalide.';
  end if;
  v_expires := now() + make_interval(hours => v_hours);

  insert into public.sandbox_accounts (user_id, created_by, email, permissions, expires_at)
  values (p_user, v_admin, v_email, v_perms, v_expires);

  update public.profiles
  set status = 'active',
      reviewed_by = v_admin,
      reviewed_at = now(),
      member_rank = p_rank,
      is_invisible = true,
      sandbox_expires_at = v_expires,
      description = 'Compte de test (bac à sable) : il sera supprimé à son expiration.'
  where id = p_user;

  insert into public.wallets (user_id, balance) values (p_user, greatest(0, coalesce(p_balance, 0)))
  on conflict (user_id) do update set balance = excluded.balance;

  perform public.write_audit('sandbox_created', p_user,
    jsonb_build_object('permissions', v_perms, 'heures', v_hours, 'rang', p_rank, 'solde', p_balance));

  return jsonb_build_object('user_id', p_user, 'email', v_email, 'permissions', v_perms, 'expires_at', v_expires);
end;
$$;

-- ---------------------------------------------------------
-- Liste des comptes de test (page Bac à sable)
-- ---------------------------------------------------------
create or replace function public.list_sandbox_accounts()
returns table (
  user_id uuid,
  nickname text,
  email text,
  permissions text[],
  member_rank text,
  expires_at timestamptz,
  expired boolean,
  created_at timestamptz,
  created_by_nickname text
)
language sql
stable
security definer set search_path = public
as $$
  select s.user_id, p.nickname, s.email, s.permissions, p.member_rank, s.expires_at, s.expires_at <= now(),
         s.created_at, c.nickname
  from public.sandbox_accounts s
  join public.profiles p on p.id = s.user_id
  left join public.profiles c on c.id = s.created_by
  where public.has_permission(auth.uid(), 'manage_users')
    and not public.is_sandbox_account(auth.uid())
  order by s.created_at desc;
$$;

-- ---------------------------------------------------------
-- Effacement d'un compte de test et de tout ce qu'il a créé. Ne touche
-- qu'aux comptes de test. Appelée avec la session de l'admin, juste avant
-- la suppression du compte de connexion par /api/admin/sandbox.
-- Liens « sans cascade » vers le profil : ce qu'il a créé ou envoyé
-- (created_by, sender_id, founder_id, ou colonne obligatoire) est supprimé ;
-- les autres liens (titulaire d'un poste, relecteur…) sont simplement vidés.
-- ---------------------------------------------------------
create or replace function public.purge_sandbox_account(p_user uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_nick text;
  r record;
  v_done int := 0;
  v_failed text[] := '{}';
begin
  if v_admin is null or not public.has_permission(v_admin, 'manage_users') or public.is_sandbox_account(v_admin) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if not public.is_sandbox_account(p_user) then
    raise exception 'Ce compte n''est pas un compte de test : il ne peut pas être effacé ici.';
  end if;

  select nickname into v_nick from public.profiles where id = p_user;

  -- D'abord, le compte ne peut plus rien faire.
  update public.sandbox_accounts set expires_at = least(expires_at, now()) where user_id = p_user;
  update public.profiles set status = 'banned' where id = p_user;

  for r in
    select c.conrelid::regclass as tbl, a.attname as col, a.attnotnull as notnull
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and c.confdeltype in ('a', 'r')
      and array_length(c.conkey, 1) = 1
      and c.conrelid <> 'public.sandbox_accounts'::regclass
  loop
    begin
      if r.notnull or r.col in ('created_by', 'sender_id', 'founder_id') then
        execute format('delete from %s where %I = $1', r.tbl, r.col) using p_user;
      else
        execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using p_user;
      end if;
      v_done := v_done + 1;
    exception when others then
      v_failed := v_failed || (r.tbl::text || '.' || r.col);
    end;
  end loop;

  perform public.write_audit('sandbox_deleted', p_user, jsonb_build_object('liens_nettoyes', v_done, 'echecs', v_failed), v_nick);
  return jsonb_build_object('ok', true, 'cleaned', v_done, 'failed', v_failed);
end;
$$;

revoke execute on function public.setup_sandbox_account(uuid, text[], int, text, numeric) from public, anon;
revoke execute on function public.purge_sandbox_account(uuid) from public, anon;
grant execute on function public.setup_sandbox_account(uuid, text[], int, text, numeric) to authenticated;
grant execute on function public.purge_sandbox_account(uuid) to authenticated;
