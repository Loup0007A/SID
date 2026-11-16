-- =========================================================
-- Lot 80 : « Élection du Dictateur », à lancer après 0097.
-- Peut être relancée sans risque.
--
-- Une petite fête : un compte à rebours, puis la proclamation du nouveau
-- Dictateur (cérémonie, confettis), sur les trois sites. Pas de vote : le
-- S.I.D. désigne lui-même l'élu, choisi dans Modération. Aucun grade ni
-- droit en plus : l'annonce, le décor et le titre de l'événement.
--
--   election_winner     compte de l'élu (choisi dans Modération)
--   election_starts_at  début de l'affichage (compte à rebours)
--   election_reveal_at  proclamation
--   election_ends_at    fin de l'affichage
--
-- L'affichage suit Modération → Affichage événementiel, comme les autres
-- événements : « Automatique » = du début à la fin réglés.
-- =========================================================

insert into public.app_config (key, value) values
  ('election_winner', ''),
  ('election_starts_at', ''),
  ('election_reveal_at', ''),
  ('election_ends_at', ''),
  ('election_awarded', '')
on conflict (key) do nothing;

-- Horodatage lu dans app_config (vide ou illisible : null).
create or replace function public._cfg_ts(p_key text)
returns timestamptz
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v text := (select value from public.app_config where key = p_key);
begin
  if v is null or btrim(v) = '' then
    return null;
  end if;
  return v::timestamptz;
exception when others then
  return null;
end;
$$;
revoke execute on function public._cfg_ts(text) from public, anon, authenticated;

-- ---------------------------------------------------------
-- Affichage : l'élection rejoint les événements (même réglage, mêmes
-- trois sites).
-- ---------------------------------------------------------
create or replace function public._decor_keys()
returns text[]
language sql
immutable
as $$
  select array['halloween', 'noel', 'saint_valentin', 'poisson_avril', 'paques', 'premier_mai',
               'fete_musique', 'quatorze_juillet', 'armistice', 'grande_chasse', 'election'];
$$;

-- Période automatique de chaque événement (jour à l'heure de Paris).
-- L'élection n'a pas de date fixe : elle suit ses réglages.
create or replace function public._decor_window(p_key text, p_day date)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select case p_key
    when 'halloween' then (extract(month from p_day) = 10 and extract(day from p_day) >= 15)
                       or (extract(month from p_day) = 11 and extract(day from p_day) <= 2)
    when 'noel' then extract(month from p_day) = 12 or (extract(month from p_day) = 1 and extract(day from p_day) <= 6)
    when 'saint_valentin' then extract(month from p_day) = 2 and extract(day from p_day) between 10 and 14
    when 'poisson_avril' then extract(month from p_day) = 4 and extract(day from p_day) = 1
    when 'paques' then p_day between public._paques(extract(year from p_day)::int) - 2 and public._paques(extract(year from p_day)::int) + 1
    when 'premier_mai' then extract(month from p_day) = 5 and extract(day from p_day) = 1
    when 'fete_musique' then extract(month from p_day) = 6 and extract(day from p_day) = 21
    when 'quatorze_juillet' then extract(month from p_day) = 7 and extract(day from p_day) in (13, 14)
    when 'armistice' then extract(month from p_day) = 11 and extract(day from p_day) = 11
    when 'grande_chasse' then extract(month from p_day) = 3 and extract(day from p_day) between 9 and 15
    when 'election' then coalesce(
      p_day between (public._cfg_ts('election_starts_at') at time zone public.stats_timezone())::date
                and (public._cfg_ts('election_ends_at') at time zone public.stats_timezone())::date, false)
    else false
  end;
$$;

insert into public.app_config (key, value)
select 'decor_' || k, 'auto' from unnest(public._decor_keys()) k
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- Options de la farce du titre (toutes, avec le Décret du Dictateur).
-- ---------------------------------------------------------
create or replace function public._troll_params(p_power text, p_level int, p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  p0 jsonb := case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end;
begin
  case p_power
  when 'nuee' then
    return jsonb_build_object('density', public._jint(p0, 'density', 2, 1, 3), 'hanging', public._jint(p0, 'hanging', 3, 0, 5));
  when 'blizzard' then
    return jsonb_build_object('intensity', public._jint(p0, 'intensity', 2, 1, 3), 'frost', public._jbool(p0, 'frost', true));
  when 'coup_de_foudre' then
    return jsonb_build_object('color', public._jpick(p0, 'color', array['rose', 'rouge', 'arcenciel'], 'rose'), 'name', public._jbool(p0, 'name', true));
  when 'poisson' then
    return jsonb_build_object('count', public._jint(p0, 'count', 6, 2, 12), 'fake', public._jbool(p0, 'fake', true));
  when 'cloches' then
    return jsonb_build_object('amount', public._jint(p0, 'amount', 2, 1, 3));
  when 'greve' then
    return jsonb_build_object('every', public._jint(p0, 'every', 2, 1, 3), 'placards', public._jbool(p0, 'placards', true));
  when 'fanfare' then
    return jsonb_build_object('tempo', public._jpick(p0, 'tempo', array['lent', 'moyen', 'rapide'], 'moyen'), 'bounce', public._jbool(p0, 'bounce', true));
  when 'artifice' then
    return jsonb_build_object('intensity', public._jint(p0, 'intensity', 2, 1, 3), 'patrouille', public._jbool(p0, 'patrouille', true));
  when 'treve' then
    return jsonb_build_object('message', coalesce(public._jtxt(p0->>'message', 60), ''));
  when 'assaut' then
    return jsonb_build_object('beast', public._jpick(p0, 'beast', array['braise', 'givre', 'orage'], 'braise'),
      'fury', public._jint(p0, 'fury', 2, 1, 3), 'repel', public._jbool(p0, 'repel', true),
      'message', coalesce(public._jtxt(p0->>'message', 60), ''));
  when 'balance' then
    return jsonb_build_object('rythme', public._jint(p0, 'rythme', 2, 1, 3), 'penchant', public._jint(p0, 'penchant', 2, 1, 3),
      'constellation', public._jbool(p0, 'constellation', true), 'message', coalesce(public._jtxt(p0->>'message', 60), ''));
  when 'decret' then
    return jsonb_build_object('decree', coalesce(public._jtxt(p0->>'decree', 80), ''),
      'seal', public._jpick(p0, 'seal', array['or', 'pourpre', 'noir'], 'or'),
      'confetti', public._jbool(p0, 'confetti', true));
  else
    return public._troll_params_base(p_power, p_level, p);
  end case;
end;
$$;

-- ▓▓ Partie scellée n° 1 ▓▓
do $q$
declare
  c text := 'ad34bdb61dee30e8df4a6e18';
  b bytea := decode('
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
', 'base64');
begin
  execute (
    select convert_from(string_agg(set_byte('\x00'::bytea, 0,
             get_byte(b, i) # get_byte(decode(md5(c || (i / 16)::text), 'hex'), i % 16)), '' order by i), 'UTF8')
    from generate_series(0, length(b) - 1) i);
end
$q$;

-- ---------------------------------------------------------
-- État public : dates, et l'élu seulement après la proclamation.
-- ---------------------------------------------------------
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
    'winner', v_winner);
end;
$$;
grant execute on function public.election_status() to anon, authenticated;

-- Réglages (Modération) : l'élu se voit ici avant la proclamation.
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
    'awarded', coalesce((select value from public.app_config where key = 'election_awarded'), '')
               = coalesce(extract(epoch from public._cfg_ts('election_reveal_at'))::bigint::text, '-'),
    'now', now());
end;
$$;

create or replace function public.election_set(p_winner text, p_starts timestamptz, p_reveal timestamptz, p_ends timestamptz)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid := null;
  v_old_reveal timestamptz := public._cfg_ts('election_reveal_at');
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if nullif(btrim(coalesce(p_winner, '')), '') is not null then
    select id into v_id from public.profiles
    where lower(nickname) = lower(btrim(p_winner)) and status = 'active'
    limit 1;
    if v_id is null then
      raise exception 'Membre introuvable : %.', btrim(p_winner);
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
    'elu', btrim(coalesce(p_winner, '')), 'debut', p_starts, 'proclamation', p_reveal, 'fin', p_ends,
    'avant', v_old_reveal));
  return public.election_admin();
end;
$$;

revoke execute on function public.election_admin() from public, anon;
revoke execute on function public.election_set(text, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.election_admin() to authenticated;
grant execute on function public.election_set(text, timestamptz, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
