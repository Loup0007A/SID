-- =====================================================================
-- 0099 — Lot 82 : pseudos sans espace parasite, élu retrouvé
-- =====================================================================
-- Rejouable. À lancer après 0098.
--
-- « Membre introuvable » à l'enregistrement de l'élection : le pseudo en
-- base gardait un espace en fin (souvent ajouté par le clavier du
-- téléphone à l'inscription), ou des accents encodés autrement. La
-- recherche retirait l'espace d'un côté seulement.
--
-- 1. _nick_clean() : Unicode normalisé (NFC), sans caractère invisible,
--    sans espace au début ni à la fin. Appliqué à chaque écriture du
--    pseudo, et une fois aux pseudos déjà enregistrés.
-- 2. election_set() accepte l'identifiant du membre (envoyé par
--    Modération) ou son pseudo, comparé sans tenir compte de la casse ni
--    de ces différences invisibles.
-- 3. Même comparaison pour le maître du salon Admin (app_config).
-- =====================================================================

create or replace function public._nick_clean(p text)
returns text
language sql immutable
as $$
  select regexp_replace(
           regexp_replace(normalize(coalesce(p, ''), NFC), '[​-‍⁠﻿]', '', 'g'),
           '^[\s   ]+|[\s   ]+$', '', 'g');
$$;

create or replace function public._nick_key(p text)
returns text
language sql immutable
as $$
  select lower(public._nick_clean(p));
$$;

-- ---------------------------------------------------------------- 1. Écritures
create or replace function public.profiles_clean_nickname()
returns trigger
language plpgsql
as $$
begin
  new.nickname := public._nick_clean(new.nickname);
  return new;
end;
$$;

drop trigger if exists trg_profiles_clean_nickname on public.profiles;
create trigger trg_profiles_clean_nickname
  before insert or update of nickname on public.profiles
  for each row execute function public.profiles_clean_nickname();

update public.profiles
set nickname = public._nick_clean(nickname)
where nickname is distinct from public._nick_clean(nickname);

-- ---------------------------------------------------------------- 2. Élection
create or replace function public.election_set(p_winner text, p_starts timestamptz, p_reveal timestamptz, p_ends timestamptz)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid := null;
  v_name text := public._nick_clean(p_winner);
  v_status text;
  v_old_reveal timestamptz := public._cfg_ts('election_reveal_at');
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if v_name <> '' then
    if v_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select id, status into v_id, v_status from public.profiles where id = v_name::uuid;
    else
      select id, status into v_id, v_status from public.profiles
      where public._nick_key(nickname) = public._nick_key(v_name)
      order by (status = 'active') desc, created_at
      limit 1;
    end if;
    if v_id is null then
      raise exception 'Membre introuvable : %.', v_name;
    end if;
    if v_status <> 'active' then
      raise exception 'Ce compte n''est pas actif : %.', (select nickname from public.profiles where id = v_id);
    end if;
  end if;
  if p_reveal is null or p_starts is null or p_ends is null then
    raise exception 'Les trois dates sont nécessaires.';
  end if;
  if not (p_starts <= p_reveal and p_reveal <= p_ends) then
    raise exception 'Ordre attendu : début, proclamation, fin.';
  end if;

  insert into public.app_config (key, value) values
    ('election_winner', coalesce(v_id::text, '')),
    ('election_starts_at', p_starts::text),
    ('election_reveal_at', p_reveal::text),
    ('election_ends_at', p_ends::text)
  on conflict (key) do update set value = excluded.value;

  perform public.write_audit('election_set', v_id, jsonb_build_object(
    'elu', coalesce((select nickname from public.profiles where id = v_id), ''),
    'debut', p_starts, 'proclamation', p_reveal, 'fin', p_ends, 'avant', v_old_reveal));
  return public.election_admin();
end;
$$;

revoke execute on function public.election_set(text, timestamptz, timestamptz, timestamptz) from public, anon;

-- ---------------------------------------------------------------- 3. Salon Admin
create or replace function public._admin_chat_owner()
returns uuid
language sql stable security definer set search_path = public
as $$
  with v as (select public._nick_clean((select value from public.app_config where key = 'admin_chat_owner')) as v)
  select case
    when v.v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (select id from public.profiles where id = v.v::uuid)
    else (select id from public.profiles where public._nick_key(nickname) = lower(v.v) and v.v <> '' limit 1)
  end
  from v;
$$;

-- Si le maître n'était pas retrouvé jusqu'ici, les règles d'or n'ont pas
-- été posées : elles le sont maintenant (une seule fois).
do $$
begin
  perform public._admin_chat_seed_rules(public._admin_chat_sync());
end;
$$;

notify pgrst, 'reload schema';
