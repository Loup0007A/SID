-- =====================================================================
-- 0094 — Lot 77 : identité du jeu dans app_config, rubriques du site
-- =====================================================================
-- Rejouable. Ne change aucune valeur déjà posée.
--
-- 1. Les noms qui font le RP se règlent dans app_config (voir SETUP.md) :
--    nom du RP, des trois sites (et leur genre), de la monnaie, adresses,
--    contact. Les sites gardent leurs textes d'origine (« S.I.D. »,
--    « zénis », « 12 z ») et les remplacent à l'affichage par ces valeurs.
-- 2. public_config() : ces valeurs, lisibles sans connexion (pages
--    publiques, manifeste, carte, wiki).
-- 3. tabs_hidden : rubriques retirées du site principal (Modération →
--    Rubriques du site). site_tabs_set() les enregistre.
-- =====================================================================

insert into public.app_config (key, value) values
  ('rp_name', 'S.I.D.'),
  ('rp_full_name', 'Système International Dictatorial'),
  ('site_name', 'Dossier Central'),
  ('map_name', 'Cartographie'),
  ('wiki_name', 'Wiki'),
  -- Genre de chaque nom (m, f, pl) : choisit l'article (« du », « de la », « de l' », « des »).
  ('rp_gender', 'm'),
  ('site_gender', 'm'),
  ('map_gender', 'f'),
  ('wiki_gender', 'm'),
  ('site_description', 'Plateforme communautaire du S.I.D.'),
  ('currency_name', 'zéni'),
  ('currency_plural', 'zénis'),
  ('currency_symbol', 'z'),
  ('contact_email', ''),
  -- Même adresse que site_url (notifications push, 0079) si elle est déjà posée.
  ('url_site', coalesce((select nullif(value, '') from public.app_config where key = 'site_url'), 'https://sid-quest.vercel.app')),
  ('url_map', 'https://sid-map.vercel.app'),
  ('url_wiki', 'https://sid-wiki.vercel.app'),
  ('tabs_hidden', '[]')
on conflict (key) do nothing;

-- Valeurs publiques (aucune donnée de membre, aucun réglage économique).
create or replace function public.public_config()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from public.app_config
  where key = any (array[
    'rp_name', 'rp_full_name', 'site_name', 'map_name', 'wiki_name', 'site_description',
    'rp_gender', 'site_gender', 'map_gender', 'wiki_gender',
    'currency_name', 'currency_plural', 'currency_symbol', 'contact_email',
    'url_site', 'url_map', 'url_wiki', 'tabs_hidden', 'stats_timezone']);
$$;
revoke all on function public.public_config() from public;
grant execute on function public.public_config() to anon, authenticated;

-- Rubriques masquées (clés de src/lib/navigation.ts).
create or replace function public.site_tabs_set(p_hidden text[])
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_old text := coalesce((select value from public.app_config where key = 'tabs_hidden'), '[]');
  v_new jsonb;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Réservé à la modération.';
  end if;
  if exists (select 1 from unnest(coalesce(p_hidden, '{}')) k where k !~ '^[a-z0-9-]{1,40}$') then
    raise exception 'Clé de rubrique invalide.';
  end if;
  -- Jamais : le dossier, les notifications, les réglages, les données personnelles.
  if p_hidden && array['profile', 'notifications', 'settings', 'privacy'] then
    raise exception 'Cette rubrique ne peut pas être retirée du site.';
  end if;
  select coalesce(jsonb_agg(distinct k order by k), '[]'::jsonb) into v_new from unnest(coalesce(p_hidden, '{}')) k;
  insert into public.app_config (key, value) values ('tabs_hidden', v_new::text)
  on conflict (key) do update set value = excluded.value;
  perform public.write_audit('site_tabs', null, jsonb_build_object('avant', v_old::jsonb, 'apres', v_new));
  return v_new;
end;
$$;
revoke all on function public.site_tabs_set(text[]) from public, anon;
grant execute on function public.site_tabs_set(text[]) to authenticated;

notify pgrst, 'reload schema';
