-- =========================================================
-- Lot 30 — Donjons : la Puissance suit l'histoire terminée.
--
-- Le jeu envoie le numéro de l'histoire terminée (`niveau`). Avec N de
-- Puissance, seule l'histoire N+1 rapporte +1 ; rejouer une histoire déjà
-- validée ne rapporte rien, et une histoire « trop loin » est refusée.
-- Une partie Donjons reste valable 24 h (une histoire dure ~3 h).
--
-- Prérequis : migration 0055.
-- =========================================================

drop function if exists public.complete_simulation_run(text, boolean, text);
create or replace function public.complete_simulation_run(p_token_hash text, p_success boolean, p_epreuve text default null, p_niveau int default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_run public.simulation_runs;
  v_skill text;
  v_factor text;
  v_min_seconds numeric := public.get_config_numeric('simulation_min_seconds', 20);
  v_limit int := public.get_config_numeric('simulation_max_results_per_day', 10)::int;
  v_old int;
  v_new int;
  v_points int := 0;
  v_value numeric;
  v_power numeric;
begin
  if p_success is null then
    raise exception 'Résultat manquant';
  end if;

  select * into v_run from public.simulation_runs where token_hash = p_token_hash for update;
  if v_run.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  if v_run.status <> 'started' then
    return jsonb_build_object('result', 'already_completed', 'status', v_run.status, 'points_awarded', v_run.points_awarded);
  end if;

  -- Compétence jouée : imposée pour une simulation à épreuve unique, à
  -- préciser pour l'Intelligence (Potions, Énigmes ou Problème).
  v_skill := case v_run.kind
    when 'donjons' then 'mondes-vivants'
    when 'techniques' then 'techniques'
    else case when public.skill_kind(p_epreuve) = 'intelligence' then p_epreuve end
  end;
  if v_skill is null then
    -- La partie reste ouverte : le bon résultat peut encore arriver.
    return jsonb_build_object('result', 'invalid_epreuve');
  end if;

  -- Donjons : une histoire dure environ 3 h et peut se jouer en plusieurs
  -- fois ; la partie reste valable 24 h.
  if (v_run.kind <> 'donjons' and v_run.expires_at < now())
     or (v_run.kind = 'donjons' and v_run.started_at < now() - interval '24 hours') then
    update public.simulation_runs set status = 'expired', finished_at = now() where id = v_run.id;
    return jsonb_build_object('result', 'expired');
  end if;

  if now() - v_run.started_at < (v_min_seconds || ' seconds')::interval then
    return jsonb_build_object('result', 'too_fast', 'min_seconds', v_min_seconds);
  end if;

  if public.simulation_results_today(v_run.user_id, v_run.kind) >= v_limit then
    update public.simulation_runs set status = 'abandoned', finished_at = now() where id = v_run.id;
    return jsonb_build_object('result', 'daily_limit', 'max_results_per_day', v_limit);
  end if;

  insert into public.member_skills (user_id, skill) values (v_run.user_id, v_skill) on conflict do nothing;
  select points into v_old from public.member_skills where user_id = v_run.user_id and skill = v_skill for update;

  -- Donjons : niveau = numéro de la dernière histoire terminée. Seule
  -- l'histoire suivante fait monter la Puissance ; la partie reste ouverte
  -- sinon (le prochain résultat pourra encore compter).
  if v_run.kind = 'donjons' and p_success and p_niveau is not null then
    if p_niveau <= v_old then
      return jsonb_build_object('result', 'already_validated', 'niveau', p_niveau, 'value', v_old);
    elsif p_niveau > v_old + 1 then
      return jsonb_build_object('result', 'level_locked', 'niveau', p_niveau, 'value', v_old);
    end if;
  end if;

  v_new := v_old;
  if p_success then
    v_new := least(100, v_old + 1);
    v_points := v_new - v_old;
    if v_points > 0 then
      update public.member_skills set points = v_new, updated_at = now()
        where user_id = v_run.user_id and skill = v_skill;
    end if;
  end if;

  update public.simulation_runs
    set status = case when p_success then 'success' else 'failure' end,
        points_awarded = v_points,
        skill = v_skill,
        finished_at = now()
    where id = v_run.id;

  v_factor := public.simulation_factor(v_run.kind);
  execute format('select %I from public.member_stats where user_id = $1', v_factor) into v_value using v_run.user_id;
  select power_score into v_power from public.profiles where id = v_run.user_id;

  return jsonb_build_object(
    'result', 'ok',
    'status', case when p_success then 'success' else 'failure' end,
    'kind', v_run.kind,
    'factor', v_factor,
    'skill', v_skill,
    'skill_value', v_new,
    'points_awarded', v_points,
    'value', v_value,
    'power', v_power
  );
end;
$$;

revoke execute on function public.complete_simulation_run(text, boolean, text, int) from public, anon, authenticated;
grant execute on function public.complete_simulation_run(text, boolean, text, int) to service_role;
