-- =====================================================================
-- 0116 — Réglages d'affichage gardés sur le compte (Lot 94)
-- À lancer après 0115. Peut être relancée sans risque.
--
-- Thème (clair, sombre, selon l'appareil), mode épuré, animations, taille
-- du texte et décors des fêtes : enregistrés sur le compte pour valoir sur
-- le Dossier Central, la Cartographie et le Wiki (trois adresses
-- différentes, dont le navigateur ne partage pas la mémoire).
-- =====================================================================

alter table public.profiles add column if not exists display_prefs jsonb not null default '{}'::jsonb;

create or replace function public.display_prefs_get()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(display_prefs, '{}'::jsonb) from public.profiles where id = auth.uid();
$$;

-- N'accepte que les clés et valeurs connues ; le reste est ignoré.
create or replace function public.display_prefs_set(p_prefs jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if p_prefs is null or jsonb_typeof(p_prefs) <> 'object' then raise exception 'Réglages invalides.'; end if;
  if p_prefs->>'theme' in ('clair', 'sombre', 'auto') then v := v || jsonb_build_object('theme', p_prefs->>'theme'); end if;
  if jsonb_typeof(p_prefs->'epure') = 'boolean' then v := v || jsonb_build_object('epure', (p_prefs->>'epure')::boolean); end if;
  if p_prefs->>'motion' in ('full', 'calm') then v := v || jsonb_build_object('motion', p_prefs->>'motion'); end if;
  if p_prefs->>'text' in ('normal', 'large', 'xlarge') then v := v || jsonb_build_object('text', p_prefs->>'text'); end if;
  if jsonb_typeof(p_prefs->'decor') = 'boolean' then v := v || jsonb_build_object('decor', (p_prefs->>'decor')::boolean); end if;
  update public.profiles set display_prefs = v where id = auth.uid();
  return v;
end;
$$;

revoke execute on function public.display_prefs_get() from public, anon;
revoke execute on function public.display_prefs_set(jsonb) from public, anon;
grant execute on function public.display_prefs_get() to authenticated;
grant execute on function public.display_prefs_set(jsonb) to authenticated;

notify pgrst, 'reload schema';
