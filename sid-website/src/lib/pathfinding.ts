import type { MapRoute, TravelPlan, TravelPlanStep } from "@/types/map";

/**
 * Longueur d'un tracé (somme des segments {x,y}), utilisée en secours quand
 * `travel_minutes` n'est pas renseigné sur la route.
 */
function pathLength(points: { x: number; y: number }[] | null): number {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/** Poids (en minutes) d'une route : temps renseigné, sinon estimation à partir du tracé. */
export function routeWeight(route: MapRoute): number {
  if (route.travel_minutes != null) return route.travel_minutes;
  return Math.max(5, pathLength(route.path_points) * 2);
}

/**
 * Plus court chemin (Dijkstra) entre deux lieux, sur le graphe formé par
 * `map_routes` (arêtes bidirectionnelles). Renvoie `null` si aucun chemin
 * n'existe entre les deux lieux.
 */
export function findShortestPath(routes: MapRoute[], fromPlaceId: string, toPlaceId: string): TravelPlan | null {
  if (fromPlaceId === toPlaceId) return { totalMinutes: 0, steps: [] };

  // Liste d'adjacence : placeId -> [{ route, neighborPlaceId }]
  const adjacency = new Map<string, { route: MapRoute; neighbor: string }[]>();
  for (const route of routes) {
    const w = routeWeight(route);
    if (!adjacency.has(route.from_place_id)) adjacency.set(route.from_place_id, []);
    if (!adjacency.has(route.to_place_id)) adjacency.set(route.to_place_id, []);
    adjacency.get(route.from_place_id)!.push({ route, neighbor: route.to_place_id });
    adjacency.get(route.to_place_id)!.push({ route, neighbor: route.from_place_id });
    void w; // le poids est recalculé via routeWeight() au moment du parcours
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, { route: MapRoute; from: string }>();
  const visited = new Set<string>();
  dist.set(fromPlaceId, 0);

  // File de priorité simplifiée (nombre de lieux généralement faible sur ce
  // type de carte RP ; pas besoin d'un tas binaire pour rester performant).
  while (true) {
    let current: string | null = null;
    let currentDist = Infinity;
    for (const [placeId, d] of dist) {
      if (!visited.has(placeId) && d < currentDist) {
        current = placeId;
        currentDist = d;
      }
    }
    if (current === null) break;
    if (current === toPlaceId) break;
    visited.add(current);

    for (const { route, neighbor } of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      const alt = currentDist + routeWeight(route);
      if (alt < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, alt);
        prev.set(neighbor, { route, from: current });
      }
    }
  }

  if (!dist.has(toPlaceId)) return null;

  // Reconstruit le chemin à rebours.
  const steps: TravelPlanStep[] = [];
  let cursor = toPlaceId;
  while (cursor !== fromPlaceId) {
    const step = prev.get(cursor);
    if (!step) return null;
    steps.unshift({ route_id: step.route.id, to_place_id: cursor, weight_minutes: routeWeight(step.route) });
    cursor = step.from;
  }

  return { totalMinutes: dist.get(toPlaceId)!, steps };
}
