-- =========================================================
-- Lot 46 : « La Grande Chasse », à lancer après 0067.
-- Peut être relancée sans risque.
--
-- Une semaine de chasse autour du 11 mars (du 9 au 15) : un affichage sur les
-- trois sites (réglé dans Modération, comme les autres événements), un titre
-- à obtenir pendant l'événement, le pouvoir de farce de ce titre, et un
-- tableau de chasse commun sur l'accueil du Dossier Central.
-- =========================================================

-- ---------------------------------------------------------
-- Dates (mêmes définitions que 0064 et 0067, avec la Grande Chasse)
-- ---------------------------------------------------------
create or replace function public._decor_keys()
returns text[]
language sql
immutable
as $$
  select array['halloween', 'noel', 'saint_valentin', 'poisson_avril', 'paques', 'premier_mai',
               'fete_musique', 'quatorze_juillet', 'armistice', 'grande_chasse'];
$$;

-- Période automatique de chaque événement (jour à l'heure de Paris).
create or replace function public._decor_window(p_key text, p_day date)
returns boolean
language sql
immutable
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
    else false
  end;
$$;

insert into public.app_config (key, value)
select 'decor_' || k, 'auto' from unnest(public._decor_keys()) k
on conflict (key) do nothing;

create or replace function public.site_decor()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  with t as (select (now() at time zone public.stats_timezone())::date as today),
  e as (
    select k, coalesce((select value from public.app_config where key = 'decor_' || k), 'auto') as mode
    from unnest(public._decor_keys()) k
  )
  select jsonb_object_agg(e.k, case e.mode when 'on' then true when 'off' then false else public._decor_window(e.k, t.today) end)
      || jsonb_object_agg(e.k || '_mode', e.mode)
  from e, t;
$$;

create or replace function public.set_site_decor(p_decor text, p_mode text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') or public.is_sandbox_account(auth.uid()) then
    raise exception 'Permission refusée : gestion des comptes requise.';
  end if;
  if p_decor is null or not (p_decor = any (public._decor_keys())) then
    raise exception 'Décor inconnu.';
  end if;
  if p_mode not in ('auto', 'on', 'off') then
    raise exception 'Réglage inconnu.';
  end if;
  insert into public.app_config (key, value) values ('decor_' || p_decor, p_mode)
  on conflict (key) do update set value = excluded.value;
  perform public.write_audit('decor_changed', null, jsonb_build_object('decor', p_decor, 'mode', p_mode));
  return public.site_decor();
end;
$$;

grant execute on function public.site_decor() to anon, authenticated;
grant execute on function public.set_site_decor(text, text) to authenticated;

-- ---------------------------------------------------------
-- Le titre
-- ---------------------------------------------------------
insert into public.titles (id, name, power, max_level, sort, event) values
  ('veneur', 'Grand Veneur', 'assaut', 1, 110, 'grande_chasse')
on conflict (id) do update
  set name = excluded.name, power = excluded.power, max_level = excluded.max_level, sort = excluded.sort, event = excluded.event;

-- ---------------------------------------------------------
-- Options des farces (toutes, avec l'Assaut de Brasombre et la Balance de
-- Varyexis du lot 47).
-- ---------------------------------------------------------
do $$
begin
  if to_regprocedure('public._troll_params_base(text, integer, jsonb)') is null then
    alter function public._troll_params(text, integer, jsonb) rename to _troll_params_base;
  end if;
end;
$$;

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
  else
    return public._troll_params_base(p_power, p_level, p);
  end case;
end;
$$;

-- ---------------------------------------------------------
-- Tableau de chasse (accueil du Dossier Central, pendant l'événement) :
-- chasses réussies aujourd'hui et pendant la semaine, ses propres trophées,
-- et les meilleurs chasseurs (les comptes invisibles n'y figurent pas).
-- ---------------------------------------------------------
create or replace function public.grande_chasse_board()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  with h as (
    select c.user_id, c.used_at, (c.used_at at time zone public.stats_timezone())::date as day
    from public.title_challenges c
    where c.kind = 'ev_grande_chasse' and c.used_at is not null and c.used_at > now() - interval '10 days'
  ),
  per as (
    select user_id, count(distinct day)::int as days, count(*)::int as hunts, max(used_at) as last_at
    from h group by user_id
  )
  select jsonb_build_object(
    'today', (select count(*) from h where day = (now() at time zone public.stats_timezone())::date),
    'week', (select count(*) from h),
    'hunters', (select count(*) from per),
    'mine', coalesce((select days from per where user_id = auth.uid()), 0),
    'mine_today', exists (select 1 from h where user_id = auth.uid() and day = (now() at time zone public.stats_timezone())::date),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'days', per.days, 'hunts', per.hunts) order by per.days desc, per.hunts desc, per.last_at)
      from (select * from per order by days desc, hunts desc, last_at limit 5) per
      join public.profiles p on p.id = per.user_id
      where not coalesce(p.is_invisible, false)
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.grande_chasse_board() to authenticated;

-- ▓▓ Partie scellée n° 1 ▓▓
do $q$
declare
  c text := 'b353ea4c30a7d740ec6c4722';
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
