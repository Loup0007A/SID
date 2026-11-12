-- =====================================================================
-- 0095 — Lot 78 : fermer la Cartographie ou le Wiki, adresses des simulations
-- =====================================================================
-- Rejouable. Ne change aucune valeur déjà posée.
--
-- 1. map_enabled, wiki_enabled ('on' / 'off') : un site fermé n'est plus
--    ouvert aux membres (Modération → Rubriques du site). sites_set() les
--    enregistre.
-- 2. sim_url_donjons, sim_url_intelligence, sim_url_techniques,
--    sim_url_arena : adresse de chaque simulation. Vide : celle du code
--    (src/lib/simulationSites.ts). 'off' : simulation débranchée.
-- 3. public_config() renvoie aussi ces valeurs.
-- =====================================================================

insert into public.app_config (key, value) values
  ('map_enabled', 'on'),
  ('wiki_enabled', 'on'),
  ('sim_url_donjons', ''),
  ('sim_url_intelligence', ''),
  ('sim_url_techniques', ''),
  ('sim_url_arena', '')
on conflict (key) do nothing;

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
    'url_site', 'url_map', 'url_wiki', 'tabs_hidden', 'stats_timezone',
    'map_enabled', 'wiki_enabled',
    'sim_url_donjons', 'sim_url_intelligence', 'sim_url_techniques', 'sim_url_arena']);
$$;
revoke all on function public.public_config() from public;
grant execute on function public.public_config() to anon, authenticated;

-- Ouvrir ou fermer la Cartographie et le Wiki.
create or replace function public.sites_set(p_map boolean, p_wiki boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_old jsonb := jsonb_build_object(
    'carte', coalesce((select value from public.app_config where key = 'map_enabled'), 'on'),
    'wiki', coalesce((select value from public.app_config where key = 'wiki_enabled'), 'on'));
  v_new jsonb;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Réservé à la modération.';
  end if;
  if p_map is null or p_wiki is null then
    raise exception 'Valeurs manquantes.';
  end if;
  insert into public.app_config (key, value) values
    ('map_enabled', case when p_map then 'on' else 'off' end),
    ('wiki_enabled', case when p_wiki then 'on' else 'off' end)
  on conflict (key) do update set value = excluded.value;
  v_new := jsonb_build_object('carte', case when p_map then 'on' else 'off' end, 'wiki', case when p_wiki then 'on' else 'off' end);
  if v_new is distinct from v_old then
    perform public.write_audit('sites', null, jsonb_build_object('avant', v_old, 'apres', v_new));
  end if;
  return v_new;
end;
$$;
revoke all on function public.sites_set(boolean, boolean) from public, anon;
grant execute on function public.sites_set(boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
