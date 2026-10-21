-- =========================================================
-- Lot 41 : affichage événementiel de Noël, à lancer après 0063.
-- Peut être relancée sans risque.
--
-- app_config.decor_noel = 'auto' (du 1er décembre au 6 janvier, heure de
-- Paris), 'on' ou 'off'. Même réglage pour les trois sites, depuis
-- Modération → Affichage événementiel.
-- =========================================================

insert into public.app_config (key, value) values ('decor_noel', 'auto') on conflict (key) do nothing;

create or replace function public.site_decor()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  with c as (
    select coalesce((select value from public.app_config where key = 'decor_halloween'), 'auto') as hw,
           coalesce((select value from public.app_config where key = 'decor_noel'), 'auto') as noel,
           (now() at time zone public.stats_timezone())::date as today
  )
  select jsonb_build_object(
    'halloween', case c.hw
                   when 'on' then true
                   when 'off' then false
                   else (extract(month from c.today) = 10 and extract(day from c.today) >= 15)
                     or (extract(month from c.today) = 11 and extract(day from c.today) <= 2)
                 end,
    'halloween_mode', c.hw,
    'noel', case c.noel
              when 'on' then true
              when 'off' then false
              else extract(month from c.today) = 12
                or (extract(month from c.today) = 1 and extract(day from c.today) <= 6)
            end,
    'noel_mode', c.noel)
  from c;
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
  if p_decor is null or p_decor not in ('halloween', 'noel') then
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
