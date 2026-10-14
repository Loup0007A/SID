-- =========================================================
-- Lot 31 — Niveau caché 101 et rang Divin.
--
-- Le niveau 101 de Donjons (« Le Trône de l'Archive ») ne s'ouvre qu'une
-- fois les 100 niveaux terminés. Le réussir fait passer au rang Divin,
-- au-dessus de S. Il ne rapporte pas de Puissance (déjà à 100).
--
-- Prérequis : migration 0056.
-- =========================================================

alter table public.profiles drop constraint if exists profiles_member_rank_check;
alter table public.profiles add constraint profiles_member_rank_check
  check (member_rank in ('E', 'D', 'C', 'B', 'A', 'S', 'Divin'));

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
  v_divine boolean := false;
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

  -- Niveau caché 101 (Donjons) : rang Divin.
  if v_run.kind = 'donjons' and p_success and p_niveau = 101 then
    update public.profiles set member_rank = 'Divin' where id = v_run.user_id and member_rank <> 'Divin';
    if found then
      v_divine := true;
      insert into public.notifications (user_id, type, title, body, link)
      values (v_run.user_id, 'announcement', '✦ Tu es devenu Divin',
              'Le Primordial est vaincu : le Trône de l''Archive t''a reconnu. Ton rang est désormais Divin.',
              '/dashboard/profile');
      perform public.write_audit('rank_divine', v_run.user_id, jsonb_build_object('niveau', 101));
    end if;
  end if;

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
    'divine', v_divine,
    'value', v_value,
    'power', v_power
  );
end;
$$;

revoke execute on function public.complete_simulation_run(text, boolean, text, int) from public, anon, authenticated;
grant execute on function public.complete_simulation_run(text, boolean, text, int) to service_role;

create or replace function public.buy_tech(p_node text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_node public.tech_nodes;
  v_level int;
  v_cost int;
  v_avail int;
  v_rank text;
  v_ranks text[] := array['E', 'D', 'C', 'B', 'A', 'S'];
begin
  if v_uid is null then
    raise exception 'Non connecté';
  end if;
  if coalesce((select is_frozen from public.profiles where id = v_uid), false) then
    raise exception 'Compte gelé';
  end if;
  select * into v_node from public.tech_nodes where key = p_node;
  if v_node.key is null then
    raise exception 'Amélioration inconnue';
  end if;

  -- Un achat à la fois par membre.
  perform pg_advisory_xact_lock(hashtext('tech:' || v_uid::text));

  v_level := public.tech_level(v_uid, p_node);
  if v_level >= v_node.max_level then
    raise exception 'Niveau maximal déjà atteint.';
  end if;
  if v_node.requires_key is not null and public.tech_level(v_uid, v_node.requires_key) < v_node.requires_level then
    raise exception 'Il faut d''abord « % » niveau %.',
      (select label from public.tech_nodes where key = v_node.requires_key), v_node.requires_level;
  end if;

  v_cost := v_node.cost_base + v_node.cost_step * v_level;
  v_avail := public.tech_points_available(v_uid);
  if v_avail < v_cost then
    raise exception 'Il te faut % points (tu en as %).', v_cost, v_avail;
  end if;

  if p_node = 'rank' then
    select member_rank into v_rank from public.profiles where id = v_uid;
    if v_rank in ('S', 'Divin') then
      raise exception 'Tu es déjà au rang le plus haut que l''arbre puisse donner (S). Le rang Divin se gagne au niveau caché 101.';
    end if;
    update public.profiles set member_rank = v_ranks[array_position(v_ranks, v_rank) + 1] where id = v_uid
      returning member_rank into v_rank;
  end if;

  insert into public.member_tech as mt (user_id, node, level) values (v_uid, p_node, v_level + 1)
  on conflict (user_id, node) do update set level = mt.level + 1;
  insert into public.tech_purchases (user_id, node, level, cost) values (v_uid, p_node, v_level + 1, v_cost);

  return jsonb_build_object('node', p_node, 'level', v_level + 1, 'cost', v_cost,
    'points', public.tech_points_available(v_uid), 'rank', v_rank);
end;
$$;
