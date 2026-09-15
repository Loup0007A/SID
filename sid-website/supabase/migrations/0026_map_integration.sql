-- =========================================================
-- Intégration avec sid-map (sid-map.vercel.app), même projet Supabase.
-- Cette migration suppose que les tables `map_places`, `map_routes`,
-- `city_buildings`, `character_positions` et la colonne `quests.place_id`
-- existent déjà (créées côté sid-map) — assure-toi d'avoir appliqué ses
-- migrations avant celle-ci.
--
-- Ajoute ce qu'il faut pour le chronomètre de trajet :
-- - `travel_started_at` : horodatage de départ, pour recalculer la
--   progression sans dépendre d'un timer client fragile (comme demandé).
-- - `planned_path` : trajets à plusieurs segments (ex: A -> B -> C). Le
--   segment 0 est toujours le segment actif, reflété par `route_id`.
--   Chaque élément est un objet {"route_id": "...", "to_place_id": "..."}
--   — on stocke la destination de chaque segment explicitement plutôt que
--   de se fier à map_routes.to_place_id, car les routes sont bidirectionnelles
--   et l'ordre from/to en base ne dit pas dans quel sens on les emprunte.
-- =========================================================

alter table public.character_positions add column if not exists travel_started_at timestamptz;
alter table public.character_positions add column if not exists planned_path jsonb;

-- ---------------------------------------------------------
-- Démarre un trajet (simple ou multi-segments) pour l'utilisateur connecté.
-- p_planned_path : [{ "route_id": uuid, "to_place_id": uuid }, ...], dans
-- l'ordre de parcours. Calculé côté client par src/lib/pathfinding.ts.
-- ---------------------------------------------------------
create or replace function public.start_travel(p_planned_path jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_first jsonb;
begin
  if p_planned_path is null or jsonb_array_length(p_planned_path) = 0 then
    raise exception 'Trajet vide';
  end if;

  v_first := p_planned_path -> 0;

  insert into public.character_positions (user_id, route_id, route_progress, travel_started_at, planned_path, place_id, building_id, updated_at)
  values (auth.uid(), (v_first->>'route_id')::uuid, 0, now(), p_planned_path, null, null, now())
  on conflict (user_id) do update
    set route_id = excluded.route_id,
        route_progress = 0,
        travel_started_at = now(),
        planned_path = excluded.planned_path,
        place_id = null,
        building_id = null,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------
-- Fait avancer le trajet en cours de l'utilisateur connecté : si le
-- segment actif est terminé, passe au suivant (nouveau travel_started_at)
-- ou finalise l'arrivée (place_id = destination du dernier segment).
-- Tant que le segment n'est pas fini, rafraîchit juste route_progress (pour
-- les affichages qui ne recalculent pas eux-mêmes depuis travel_started_at).
-- Pas de vérification de permission : chacun ne fait avancer que SA PROPRE
-- position (auth.uid()). Se déclenche à la consultation du site, comme
-- check_and_pay_my_salary / process_expired_quests — aucune dépendance à
-- un job planifié, donc sid-quest ET sid-map peuvent l'appeler.
-- ---------------------------------------------------------
create or replace function public.advance_my_travel()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_pos public.character_positions;
  v_route public.map_routes;
  v_weight numeric;
  v_path_len numeric;
  v_elapsed numeric;
  v_current jsonb;
  v_remaining jsonb;
  v_next jsonb;
begin
  select * into v_pos from public.character_positions where user_id = auth.uid() for update;

  if v_pos.user_id is null or v_pos.route_id is null or v_pos.travel_started_at is null then
    return;
  end if;

  select * into v_route from public.map_routes where id = v_pos.route_id;

  if v_route.id is null then
    -- Route supprimée entre-temps : on arrête le trajet proprement, sans
    -- pouvoir le finaliser sur un lieu précis.
    update public.character_positions
      set route_id = null, route_progress = null, travel_started_at = null, planned_path = null
      where user_id = auth.uid();
    return;
  end if;

  if v_route.travel_minutes is not null then
    v_weight := v_route.travel_minutes;
  else
    select coalesce(sum(seg_len), 0) into v_path_len
    from (
      select sqrt(
        power((pt->>'x')::numeric - (lag(pt->>'x') over (order by ord))::numeric, 2) +
        power((pt->>'y')::numeric - (lag(pt->>'y') over (order by ord))::numeric, 2)
      ) as seg_len
      from jsonb_array_elements(coalesce(v_route.path_points, '[]'::jsonb)) with ordinality as t(pt, ord)
    ) s;
    v_weight := greatest(5, coalesce(v_path_len, 0) * 2);
  end if;

  v_elapsed := extract(epoch from (now() - v_pos.travel_started_at)) / 60.0;

  if v_elapsed < v_weight then
    update public.character_positions
      set route_progress = least(1, v_elapsed / greatest(v_weight, 0.001))
      where user_id = auth.uid();
    return;
  end if;

  v_current := coalesce(v_pos.planned_path -> 0, jsonb_build_object('route_id', v_pos.route_id, 'to_place_id', v_route.to_place_id));

  if v_pos.planned_path is not null and jsonb_array_length(v_pos.planned_path) > 1 then
    v_remaining := v_pos.planned_path - 0;
    v_next := v_remaining -> 0;
    update public.character_positions
      set route_id = (v_next->>'route_id')::uuid,
          route_progress = 0,
          travel_started_at = now(),
          planned_path = v_remaining
      where user_id = auth.uid();
  else
    update public.character_positions
      set place_id = (v_current->>'to_place_id')::uuid,
          building_id = null,
          route_id = null,
          route_progress = null,
          travel_started_at = null,
          planned_path = null
      where user_id = auth.uid();
  end if;
end;
$$;
