-- =========================================================
-- 1) Classement de PUISSANCE : score saisi à la main par les admins.
--    Chaque modification est journalisée (qui, quand, ancienne/nouvelle valeur).
-- 2) Protection des colonnes sensibles de `profiles` (correctif sécurité) :
--    la policy "profiles_update_self" laissait un membre modifier SA propre
--    ligne en entier via l'API (is_founder, reputation, status, etc.).
--    Un trigger bloque désormais ces champs pour les appels directs du
--    navigateur ; les fonctions SECURITY DEFINER et le SQL Editor ne sont
--    pas concernés.
-- 3) Vocabulaire : "de la S.I.D." -> "du S.I.D." dans les textes stockés en base.
-- =========================================================

alter table public.profiles add column if not exists power_score int not null default 0;
alter table public.profiles drop constraint if exists profiles_power_score_check;
alter table public.profiles add constraint profiles_power_score_check check (power_score >= 0);

create table if not exists public.power_score_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  old_score int not null,
  new_score int not null,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.power_score_log enable row level security;

drop policy if exists "power_score_log_select" on public.power_score_log;
create policy "power_score_log_select" on public.power_score_log for select
  using (public.has_permission(auth.uid(), 'manage_users') or public.has_permission(auth.uid(), 'manage_economy'));

create or replace function public.set_power_score(p_user_id uuid, p_score int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_old int;
begin
  if not (public.has_permission(auth.uid(), 'manage_users') or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if p_score is null or p_score < 0 then
    raise exception 'Le score de puissance doit être un entier positif ou nul.';
  end if;

  select power_score into v_old from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Membre introuvable';
  end if;

  update public.profiles set power_score = p_score where id = p_user_id;

  insert into public.power_score_log (user_id, old_score, new_score, changed_by)
  values (p_user_id, v_old, p_score, auth.uid());
end;
$$;

-- Classement : on ajoute power_score (le type de retour change -> drop d'abord).
drop function if exists public.list_leaderboard();
create function public.list_leaderboard()
returns table (
  user_id uuid,
  nickname text,
  balance numeric,
  reputation int,
  quests_completed bigint,
  power_score int
)
language sql
stable
security definer set search_path = public
as $$
  select
    p.id,
    p.nickname,
    coalesce(w.balance, 0),
    p.reputation,
    coalesce(qc.cnt, 0),
    p.power_score
  from public.profiles p
  left join public.wallets w on w.user_id = p.id
  left join (
    select qp.user_id, count(*) as cnt
    from public.quest_participants qp
    where qp.status = 'validated'
    group by qp.user_id
  ) qc on qc.user_id = p.id
  where p.status = 'active';
$$;

-- ---------------------------------------------------------
-- Protection des colonnes sensibles (NON security definer volontairement :
-- on a besoin de current_user = le rôle réel de l'appelant).
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

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_columns on public.profiles;
create trigger trg_protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_sensitive_columns();

-- ---------------------------------------------------------
-- "de la S.I.D." -> "du S.I.D." dans les textes stockés en base.
-- ---------------------------------------------------------
update public.roles
  set description = replace(replace(description, 'dans la S.I.D.', 'dans le S.I.D.'), 'de la S.I.D.', 'du S.I.D.')
  where description like '%la S.I.D.%';

create or replace function public.notify_application_decision()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.status = 'pending' and new.status in ('active', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      new.id,
      'application_decision',
      case when new.status = 'active' then 'Candidature acceptée !' else 'Candidature refusée' end,
      case when new.status = 'active' then 'Bienvenue au S.I.D. ! Ton dossier est actif.' else 'Ta candidature n''a pas été retenue.' end,
      '/dashboard'
    );
  end if;
  return new;
end;
$$;
