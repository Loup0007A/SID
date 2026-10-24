-- =========================================================
-- Lot 44 : sept nouveaux événements, à lancer après 0066.
-- Peut être relancée sans risque.
--
--   saint_valentin   du 10 au 14 février
--   poisson_avril    le 1er avril
--   paques           du Vendredi saint au lundi de Pâques
--   premier_mai      le 1er mai
--   fete_musique     le 21 juin
--   quatorze_juillet les 13 et 14 juillet
--   armistice        le 11 novembre
--
-- Chacun : un affichage (réglé dans Modération, comme Halloween et Noël), un
-- titre à obtenir pendant l'événement, et le pouvoir de farce de ce titre.
-- =========================================================

-- ---------------------------------------------------------
-- Dates
-- ---------------------------------------------------------
-- Dimanche de Pâques (calendrier grégorien).
create or replace function public._paques(p_year int)
returns date
language plpgsql
immutable
as $$
declare
  a int := p_year % 19;
  b int := p_year / 100;
  c int := p_year % 100;
  d int := b / 4;
  e int := b % 4;
  f int := (b + 8) / 25;
  g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4;
  k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7;
  m int := (a + 11 * h + 22 * l) / 451;
begin
  return make_date(p_year, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end;
$$;

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
-- Les titres
-- ---------------------------------------------------------
insert into public.titles (id, name, power, max_level, sort, event) values
  ('cupidon', 'Cupidon Masqué', 'coup_de_foudre', 1, 103, 'saint_valentin'),
  ('farceur', 'Farceur d''Avril', 'poisson', 1, 104, 'poisson_avril'),
  ('chasseur', 'Chasseur d''Œufs', 'cloches', 1, 105, 'paques'),
  ('meneur', 'Meneur du 1er Mai', 'greve', 1, 106, 'premier_mai'),
  ('maestro', 'Maestro', 'fanfare', 1, 107, 'fete_musique'),
  ('artificier', 'Artificier', 'artifice', 1, 108, 'quatorze_juillet'),
  ('veilleur', 'Veilleur du Souvenir', 'treve', 1, 109, 'armistice')
on conflict (id) do update
  set name = excluded.name, power = excluded.power, max_level = excluded.max_level, sort = excluded.sort, event = excluded.event;

-- ---------------------------------------------------------
-- Options des farces (Nuée et Blizzard repris de 0065).
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
  else
    return public._troll_params_base(p_power, p_level, p);
  end case;
end;
$$;

-- ▓▓ Partie scellée n° 1 ▓▓
do $q$
declare
  c text := 'e35264fbe3ef1af8118ab45b';
  b bytea := decode('
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
FgbyVw==
', 'base64');
begin
  execute (
    select convert_from(string_agg(set_byte('\x00'::bytea, 0,
             get_byte(b, i) # get_byte(decode(md5(c || (i / 16)::text), 'hex'), i % 16)), '' order by i), 'UTF8')
    from generate_series(0, length(b) - 1) i);
end
$q$;
