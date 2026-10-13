-- =========================================================
-- Lot 26 — Donjons : un point par île (chapitre) terminée.
--
-- Le jeu 3D envoie désormais un résultat à la fin de chaque chapitre
-- (10 par histoire) au lieu d'un seul à la fin de l'histoire. Quand
-- l'administration règle le niveau Donjons d'un membre à N, les histoires
-- 1 à N/10 (arrondi en dessous) sont marquées terminées dans le jeu.
--
-- Prérequis : migration 0051.
-- =========================================================

do $$
begin
  if to_regclass('public.member_skills') is null then
    raise exception 'Applique d''abord la migration 0051_skills_items_prerequisites.sql.';
  end if;
end;
$$;

create or replace function public.set_member_levels(p_user_id uuid, p_levels jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_email text;
  v_key text;
  v_val jsonb;
  v_level int;
  v_old int;
  v_changes jsonb := '{}'::jsonb;
  v_intel jsonb := '{}'::jsonb;
  v_tech jsonb := '{}'::jsonb;
  v_donj jsonb := '{}'::jsonb;
  v_prefix text;
begin
  if not (public.has_permission(auth.uid(), 'manage_users') or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if p_levels is null or jsonb_typeof(p_levels) <> 'object' then
    raise exception 'Niveaux invalides';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Membre introuvable';
  end if;

  select lower(trim(email)) into v_email from auth.users where id = p_user_id;
  v_prefix := 'sq_' || public.sid_fnv(coalesce(v_email, '')) || '_prog_';

  for v_key, v_val in select * from jsonb_each(p_levels) loop
    if public.skill_kind(v_key) is null then
      raise exception 'Compétence inconnue : %', v_key;
    end if;
    if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric <> round((v_val #>> '{}')::numeric) then
      raise exception 'Le niveau doit être un nombre entier.';
    end if;
    v_level := (v_val #>> '{}')::int;
    if v_level not between 0 and 100 then
      raise exception 'Chaque niveau doit être compris entre 0 et 100.';
    end if;

    select points into v_old from public.member_skills where user_id = p_user_id and skill = v_key;
    v_old := coalesce(v_old, 0);
    if v_old = v_level then
      continue;
    end if;

    insert into public.member_skills as ms (user_id, skill, points) values (p_user_id, v_key, v_level)
    on conflict (user_id, skill) do update set points = excluded.points, updated_at = now();
    v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('from', v_old, 'to', v_level));

    -- Progression dans les sites : niveau N réussi = N débloqué (N+1 ouvert).
    case v_key
      when 'potions' then v_intel := v_intel || jsonb_build_object(v_prefix || '1', v_level::text);
      when 'enigmes' then v_intel := v_intel || jsonb_build_object(v_prefix || '2', v_level::text);
      when 'probleme' then v_intel := v_intel || jsonb_build_object(v_prefix || '3', v_level::text);
      when 'techniques' then v_tech := jsonb_build_object('sqt_prog', v_level::text);
      when 'mondes-vivants' then
        -- Donjons : 1 point par île (chapitre), 10 îles par histoire.
        v_donj := jsonb_build_object('mv-done',
          '[' || coalesce((select string_agg(i::text, ',' order by i) from generate_series(1, v_level / 10) i), '') || ']');
    end case;
  end loop;

  if v_changes = '{}'::jsonb then
    return;
  end if;

  perform public.write_simulation_progress(p_user_id, 'intelligence', v_intel);
  perform public.write_simulation_progress(p_user_id, 'techniques', v_tech);
  perform public.write_simulation_progress(p_user_id, 'donjons', v_donj);
  perform public.write_audit('levels_changed', p_user_id, v_changes);
end;
$$;
