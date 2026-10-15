-- =========================================================
-- 0058 : comptes invisibles
-- =========================================================
-- Un compte invisible n'apparaît plus aux autres membres : trombinoscope,
-- rôles, classement, profil public, carte, organigramme et listes de choix
-- (nouvelle conversation, quêtes, entreprises — filtrés côté site).
-- Le membre garde tout le reste : ce qu'il écrit ou fait reste signé de son
-- nom (messages, quêtes, boutique, raids…).
-- Le membre lui-même et la gestion des comptes (manage_users) le voient
-- toujours. Seuls le membre et la gestion des comptes peuvent changer ce
-- réglage ; chaque changement est inscrit au journal d'audit.

alter table public.profiles add column if not exists is_invisible boolean not null default false;

-- Le viewer courant peut-il voir ce compte s'il est invisible ?
create or replace function public.can_see_invisible(p_target uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select auth.uid() is not distinct from p_target
      or coalesce(public.has_permission(auth.uid(), 'manage_users'), false);
$$;

-- ---------------------------------------------------------
-- Protection : personne d'autre que le membre ou la gestion des comptes ne
-- change ce réglage (reprise de 0037 + la règle is_invisible).
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

  return new;
end;
$$;

-- ---------------------------------------------------------
-- Changement de visibilité : carte + journal d'audit.
-- ---------------------------------------------------------
create or replace function public.on_profile_invisible_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_invisible is distinct from old.is_invisible then
    if to_regclass('public.character_positions') is not null then
      execute 'update public.character_positions set is_visible = $1 where user_id = $2'
        using not new.is_invisible, new.id;
    end if;
    perform public.write_audit(
      case when new.is_invisible then 'account_invisible' else 'account_visible' end,
      new.id,
      jsonb_build_object('par_le_membre', auth.uid() is not distinct from new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_invisible_change on public.profiles;
create trigger trg_profile_invisible_change
  after update of is_invisible on public.profiles
  for each row execute function public.on_profile_invisible_change();

-- Carte : un compte invisible reste masqué, même s'il redemande à être vu.
do $$
begin
  if to_regclass('public.character_positions') is not null then
    execute $f$
      create or replace function public.keep_invisible_off_map()
      returns trigger
      language plpgsql
      security definer set search_path = public
      as $b$
      begin
        if exists (select 1 from public.profiles p where p.id = new.user_id and p.is_invisible) then
          new.is_visible := false;
        end if;
        return new;
      end;
      $b$;
    $f$;
    execute 'drop trigger if exists trg_keep_invisible_off_map on public.character_positions';
    execute 'create trigger trg_keep_invisible_off_map before insert or update on public.character_positions
             for each row execute function public.keep_invisible_off_map()';
  end if;
end $$;

-- ---------------------------------------------------------
-- Trombinoscope
-- ---------------------------------------------------------
create or replace function public.list_roster()
returns setof jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  r public.profiles;
  v_staff boolean := coalesce(public.has_permission(auth.uid(), 'manage_users'), false);
  can_see_all boolean;
  result jsonb;
begin
  for r in select * from public.profiles where status = 'active' order by nickname loop
    if r.is_invisible and r.id is distinct from auth.uid() and not v_staff then
      continue;
    end if;
    can_see_all := (r.id = auth.uid()) or v_staff;
    result := to_jsonb(r);
    if not can_see_all then
      result := (result - r.hidden_fields) - 'is_invisible';
    end if;
    return next result;
  end loop;
end;
$$;

-- Rôles affichés sur le trombinoscope et les profils
create or replace function public.list_member_roles()
returns table(user_id uuid, role_name text, role_color text, role_rank int)
language sql
stable
security definer set search_path = public
as $$
  select ur.user_id, r.name, r.color, r.rank
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id and p.status = 'active'
  where not p.is_invisible or public.can_see_invisible(p.id)
  order by r.rank desc;
$$;

-- ---------------------------------------------------------
-- Profil public. Le viewer est désormais l'utilisateur connecté (le
-- paramètre « viewer » n'est plus qu'un repli pour les appels serveur).
-- ---------------------------------------------------------
create or replace function public.get_visible_profile(target uuid, viewer uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  p public.profiles;
  v_viewer uuid := coalesce(auth.uid(), viewer);
  result jsonb;
  can_see_all boolean;
begin
  select * into p from public.profiles where id = target;
  if p.id is null then
    return null;
  end if;

  can_see_all := (v_viewer = target) or coalesce(public.has_permission(v_viewer, 'manage_users'), false);

  if p.is_invisible and not can_see_all then
    return null;
  end if;

  result := to_jsonb(p);
  if not can_see_all then
    result := (result - p.hidden_fields) - 'is_invisible';
  end if;
  return result;
end;
$$;

-- ---------------------------------------------------------
-- Classement (reprise de 0051 + filtre)
-- ---------------------------------------------------------
create or replace function public.list_leaderboard()
returns table (
  user_id uuid,
  nickname text,
  balance numeric,
  reputation int,
  quests_completed bigint,
  power_score numeric,
  intelligence numeric,
  strength numeric,
  technique numeric
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
    p.power_score,
    coalesce(s.intelligence, 0),
    coalesce(s.strength, 0),
    coalesce(s.technique, 0)
  from public.profiles p
  left join public.wallets w on w.user_id = p.id
  left join public.member_stats s on s.user_id = p.id
  left join (
    select qp.user_id, count(*) as cnt
    from public.quest_participants qp
    where qp.status = 'validated'
    group by qp.user_id
  ) qc on qc.user_id = p.id
  where p.status = 'active'
    and (not p.is_invisible or public.can_see_invisible(p.id));
$$;
