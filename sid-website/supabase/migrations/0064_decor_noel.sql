-- =========================================================
-- Lot 41 : affichage événementiel de Noël, à lancer après 0063.
-- Peut être relancée sans risque. Les fonctions d'affichage ci-dessous sont
-- les mêmes que dans 0067 (tous les événements) : relancer 0064 n'en retire aucun.
--
-- app_config.decor_noel = 'auto' (du 1er décembre au 6 janvier, heure de
-- Paris), 'on' ou 'off'. Même réglage pour les trois sites, depuis
-- Modération → Affichage événementiel.
-- =========================================================

insert into public.app_config (key, value) values ('decor_noel', 'auto') on conflict (key) do nothing;

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
