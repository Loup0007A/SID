-- =====================================================================
-- 0118 — Animations « selon l'appareil » (Lot 95)
-- À lancer après 0117. Peut être relancée sans risque.
--
-- Le réglage des animations accepte « auto » : calmes si le système de
-- l'appareil demande de réduire les animations, vivantes sinon. C'est le
-- choix par défaut des comptes qui n'ont rien réglé.
-- =====================================================================

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
  if p_prefs->>'motion' in ('full', 'calm', 'auto') then v := v || jsonb_build_object('motion', p_prefs->>'motion'); end if;
  if p_prefs->>'text' in ('normal', 'large', 'xlarge') then v := v || jsonb_build_object('text', p_prefs->>'text'); end if;
  if jsonb_typeof(p_prefs->'decor') = 'boolean' then v := v || jsonb_build_object('decor', (p_prefs->>'decor')::boolean); end if;
  update public.profiles set display_prefs = v where id = auth.uid();
  return v;
end;
$$;

grant execute on function public.display_prefs_set(jsonb) to authenticated;
revoke execute on function public.display_prefs_set(jsonb) from public, anon;

notify pgrst, 'reload schema';
