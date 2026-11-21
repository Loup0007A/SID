-- =====================================================================
-- 0120 — Contrôle des droits (Lot 96)
-- À lancer après 0119 (et après les migrations du Wiki et de la
-- Cartographie). Peut être relancée sans risque.
--
-- Trouvé par scripts/audit-securite.sh :
--
-- 1. Un membre pouvait lever lui-même ses sanctions en modifiant sa fiche
--    (gel, fin de gel, fin de bannissement, fin de mutisme) et changer la
--    date d'expiration d'un compte de test. Ces champs sont maintenant
--    réservés à la gestion des comptes.
-- 2. Un message de la messagerie gardait son salon et son auteur, mais sa
--    date pouvait être changée par son auteur. Elle ne bouge plus.
-- 3. Sans être connecté (avec la clé publique, visible dans le code du
--    site), on pouvait lire toutes les fiches actives : prénom, nom, âge…
--    et appeler la plupart des fonctions du jeu. Sans session, il ne reste
--    que ce dont les pages publiques ont besoin.
-- 4. Les champs qu'un membre masque (prénom, nom, âge, armes, équipement,
--    description, rôle voulu) n'étaient masqués que par l'affichage : la
--    base les envoyait quand même. Ils ne sont plus lisibles que par le
--    membre lui-même et la gestion des comptes (fonctions my_profile,
--    profiles_full, get_visible_profile, list_roster). Ses réglages
--    (affichage, notifications, heures calmes) ne sont lisibles que par lui.
-- 5. get_visible_profile acceptait un « lecteur » choisi par l'appelant :
--    sans session, on pouvait se faire passer pour un administrateur.
--
-- Pour une nouvelle colonne de profiles lisible par tous les membres :
--   grant select (ma_colonne) on public.profiles to authenticated;
-- (sinon elle n'est lisible que par les fonctions ci-dessus).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Sanctions : réservées à la gestion des comptes
-- ---------------------------------------------------------------------
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

  -- Lot 96 : sanctions, compte de test, date d'inscription.
  if (new.is_frozen is distinct from old.is_frozen
      or new.freeze_until is distinct from old.freeze_until
      or new.mute_until is distinct from old.mute_until
      or new.ban_until is distinct from old.ban_until
      or new.sandbox_expires_at is distinct from old.sandbox_expires_at
      or new.created_at is distinct from old.created_at)
     and not v_is_staff then
    raise exception 'Permission refusée : sanctions et dates réservées à la gestion des comptes.';
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

-- ---------------------------------------------------------------------
-- 2. Messagerie : salon, auteur et date fixés à l'envoi
-- ---------------------------------------------------------------------
create or replace function public._chat_message_garde_origine()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.channel_id := old.channel_id;
    new.sender_id := old.sender_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_chat_message_garde_origine on public.chat_messages;
create trigger trg_chat_message_garde_origine before update on public.chat_messages
  for each row execute function public._chat_message_garde_origine();

-- ---------------------------------------------------------------------
-- 3. Limite de débit (fonctions coûteuses ou sensibles)
-- ---------------------------------------------------------------------
create table if not exists public.limites_debit (
  cle text not null,
  user_id uuid not null,
  fenetre timestamptz not null,
  n int not null default 1,
  primary key (cle, user_id, fenetre)
);
alter table public.limites_debit enable row level security;
revoke all on public.limites_debit from anon, authenticated;

-- Au plus p_max appels par membre et par tranche de p_secondes.
create or replace function public._limite_debit(p_cle text, p_max int, p_secondes int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_f timestamptz := to_timestamp(floor(extract(epoch from now()) / p_secondes) * p_secondes);
  v_n int;
begin
  if v_uid is null then return; end if;
  insert into public.limites_debit as l (cle, user_id, fenetre) values (p_cle, v_uid, v_f)
  on conflict (cle, user_id, fenetre) do update set n = l.n + 1
  returning n into v_n;
  if v_n > p_max then
    raise exception 'Trop de demandes d''affilée : réessaie dans quelques secondes.' using errcode = '54000';
  end if;
  if random() < 0.02 then
    delete from public.limites_debit where fenetre < now() - interval '1 day';
  end if;
end;
$$;
revoke execute on function public._limite_debit(text, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Fiches : lecture
-- ---------------------------------------------------------------------
-- Champs jamais montrés aux autres membres (ni sans session).
create or replace function public._profil_champs_prives()
returns text[]
language sql immutable
as $$
  select array['first_name', 'last_name', 'age', 'weapons', 'equipment', 'description', 'desired_role',
               'display_prefs', 'notif_muted', 'notif_push_muted', 'push_quiet_start', 'push_quiet_end']
$$;
-- Réglages personnels : retirés même quand le membre ne masque rien.
create or replace function public._profil_reglages()
returns text[]
language sql immutable
as $$
  select array['display_prefs', 'notif_muted', 'notif_push_muted', 'push_quiet_start', 'push_quiet_end']
$$;

do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name <> all (public._profil_champs_prives());
  revoke select on public.profiles from anon, authenticated;
  execute format('grant select (%s) on public.profiles to authenticated', v_cols);
end $$;

-- Sa propre fiche, complète.
create or replace function public.my_profile()
returns setof public.profiles
language sql stable security definer set search_path = public
as $$
  select * from public.profiles where id = auth.uid()
$$;
revoke execute on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- Fiches complètes pour la gestion des comptes et le recrutement.
create or replace function public.profiles_full(p_status text default null)
returns setof public.profiles
language plpgsql stable security definer set search_path = public
as $$
begin
  if not (public.has_permission(auth.uid(), 'manage_users') or public.has_permission(auth.uid(), 'recruit')) then
    raise exception 'Permission refusée.' using errcode = '42501';
  end if;
  return query select * from public.profiles p where p_status is null or p.status = p_status order by p.nickname;
end;
$$;
revoke execute on function public.profiles_full(text) from public, anon;
grant execute on function public.profiles_full(text) to authenticated;

create or replace function public.get_visible_profile(target uuid, viewer uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  p public.profiles;
  -- Lot 96 : depuis le navigateur, le lecteur est toujours la session.
  v_viewer uuid := case when current_user in ('anon', 'authenticated') then auth.uid() else coalesce(auth.uid(), viewer) end;
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
    result := ((result - p.hidden_fields) - 'is_invisible') - public._profil_reglages();
  end if;
  return result;
end;
$$;

create or replace function public.list_roster()
returns setof jsonb
language plpgsql stable security definer set search_path = public
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
      result := ((result - r.hidden_fields) - 'is_invisible') - public._profil_reglages();
    end if;
    return next result;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Sans session : seulement les pages publiques
-- ---------------------------------------------------------------------
-- Tables lisibles sans session : quests (quêtes publiques de l'accueil)
-- et maintenance_flags. Les autres données de membres sont fermées.
revoke select on public.user_roles, public.groups, public.businesses, public.business_share_price_history,
  public.roles, public.role_permissions, public.shop_items from anon;

-- Fonctions appelables sans session (rendu des pages publiques et de la
-- page de connexion). Les fonctions utilisées par les règles d'accès
-- (has_permission…) restent ouvertes : la base les appelle pour décider.
create or replace function public._fonctions_sans_session()
returns text[]
language sql immutable
as $$
  select array['public_config', 'glitched_members', 'site_decor', 'election_status', 'list_maintenance_flags']
$$;

do $$
declare
  r record;
  v_keep text[];
begin
  select public._fonctions_sans_session() || coalesce(array_agg(distinct p.proname), '{}') into v_keep
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where exists (
    select 1 from pg_policy pol
    where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
          ~ ('(^|[^a-z_])' || p.proname || '\(')
  );

  for r in
    select p.oid::regprocedure as f, has_function_privilege('authenticated', p.oid, 'execute') as auth_ok
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where p.prokind = 'f' and p.prosecdef
      and pg_get_function_result(p.oid) not in ('trigger', 'event_trigger')
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname <> all (v_keep)
  loop
    if r.auth_ok then execute format('grant execute on function %s to authenticated', r.f); end if;
    execute format('grant execute on function %s to service_role', r.f);
    execute format('revoke execute on function %s from public, anon', r.f);
  end loop;
end $$;

-- Les fonctions créées par les prochaines migrations ne sont plus ouvertes
-- sans session par défaut (les membres connectés les gardent).
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public grant execute on functions to authenticated, service_role;
