-- =====================================================================
-- 0111 — Élection du Dictateur : prise du pouvoir par la force (Lot 91)
-- À lancer après 0110. Peut être relancée.
--
-- * election_mode (app_config) : 'election' (proclamation, par défaut) ou
--   'force' (coup d'État). Secret comme l'élu : election_status ne le
--   donne qu'à l'heure de la proclamation.
-- * Même titre « Dictateur » dans les deux cas (rien ne change dans
--   _election_award).
-- * Par la force : l'annonce envoyée à tous devient une alerte de coup
--   d'État (une seule fois par proclamation).
-- =====================================================================

create or replace function public._election_mode()
returns text
language sql stable
security definer set search_path = public
as $$
  select case when value = 'force' then 'force' else 'election' end
  from (select coalesce((select value from public.app_config where key = 'election_mode'), 'election') as value) x;
$$;

-- Par la force : l'annonce « nouveau Dictateur » devient une alerte.
create or replace function public._election_force_notify()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_reveal timestamptz := public._cfg_ts('election_reveal_at');
  v_key text := coalesce(extract(epoch from v_reveal)::bigint::text, '-');
  v_name text;
begin
  if v_reveal is null or now() < v_reveal or public._election_mode() <> 'force' then return; end if;
  if coalesce((select value from public.app_config where key = 'election_force_notified'), '') = v_key then return; end if;
  select p.nickname into v_name from public.profiles p
   where p.id = (select case when value ~* '^[0-9a-f-]{36}$' then value::uuid end from public.app_config where key = 'election_winner');
  if v_name is null then return; end if;
  update public.notifications
     set title = '🚨 ALERTE — Coup d''État au S.I.D.',
         body = v_name || ' a pris le pouvoir par la force. Le Conseil est dissous. Vive le Dictateur.'
   where type = 'announcement'
     and title like '%nouveau Dictateur%'
     and created_at >= v_reveal - interval '1 minute';
  insert into public.app_config (key, value) values ('election_force_notified', v_key)
  on conflict (key) do update set value = excluded.value;
end;
$$;

-- ---------------------------------------------------------------- État public
create or replace function public.election_status()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_starts timestamptz := public._cfg_ts('election_starts_at');
  v_reveal timestamptz := public._cfg_ts('election_reveal_at');
  v_ends timestamptz := public._cfg_ts('election_ends_at');
  v_on boolean := coalesce((public.site_decor()->>'election')::boolean, false);
  v_revealed boolean := v_reveal is not null and now() >= v_reveal;
  v_winner jsonb := null;
begin
  if v_revealed then
    perform public._election_award();
    perform public._election_force_notify();
    select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatar_url', p.avatar_url)
      into v_winner
    from public.profiles p
    where p.id = (select case when value ~* '^[0-9a-f-]{36}$' then value::uuid end from public.app_config where key = 'election_winner');
  end if;
  return jsonb_build_object(
    'on', v_on,
    'now', now(),
    'starts_at', v_starts,
    'reveal_at', v_reveal,
    'ends_at', v_ends,
    'revealed', v_revealed,
    -- Comme l'élu : la manière n'est connue qu'à la proclamation.
    'mode', case when v_revealed then public._election_mode() end,
    'winner', v_winner);
end;
$$;
grant execute on function public.election_status() to anon, authenticated;

-- ---------------------------------------------------------------- Réglages
create or replace function public.election_admin()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  begin
    v_id := nullif((select value from public.app_config where key = 'election_winner'), '')::uuid;
  exception when others then
    v_id := null;
  end;
  return jsonb_build_object(
    'winner', (select nickname from public.profiles where id = v_id),
    'starts_at', public._cfg_ts('election_starts_at'),
    'reveal_at', public._cfg_ts('election_reveal_at'),
    'ends_at', public._cfg_ts('election_ends_at'),
    'mode', public._election_mode(),
    'awarded', coalesce((select value from public.app_config where key = 'election_awarded'), '')
               = coalesce(extract(epoch from public._cfg_ts('election_reveal_at'))::bigint::text, '-'),
    'now', now());
end;
$$;

drop function if exists public.election_set(text, timestamptz, timestamptz, timestamptz);
create or replace function public.election_set(p_winner text, p_starts timestamptz, p_reveal timestamptz, p_ends timestamptz,
                                               p_mode text default 'election')
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid := null;
  v_name text := public._nick_clean(p_winner);
  v_status text;
  v_mode text := case when p_mode = 'force' then 'force' else 'election' end;
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
    ('election_ends_at', p_ends::text),
    ('election_mode', v_mode)
  on conflict (key) do update set value = excluded.value;

  perform public.write_audit('election_set', v_id, jsonb_build_object(
    'elu', coalesce((select nickname from public.profiles where id = v_id), ''),
    'debut', p_starts, 'proclamation', p_reveal, 'fin', p_ends, 'avant', v_old_reveal,
    'maniere', v_mode));
  return public.election_admin();
end;
$$;

revoke execute on function public._election_mode() from public, anon, authenticated;
revoke execute on function public._election_force_notify() from public, anon, authenticated;
revoke execute on function public.election_set(text, timestamptz, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.election_set(text, timestamptz, timestamptz, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';
