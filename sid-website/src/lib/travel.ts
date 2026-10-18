import type { CharacterPosition, MapRoute } from "@/types/map";
import { routeWeight } from "@/lib/pathfinding";

/**
 * État d'un trajet en cours, calculé à partir de ce que le serveur a posé
 * (migration 0113 de la Cartographie, partagée par les deux sites) :
 * place_id = départ de l'étape en cours, travel_duration_minutes = durée de
 * l'étape, planned_path = étapes restantes avec leur durée.
 */
export function tripState(pos: CharacterPosition | null, routes: MapRoute[], nowMs: number) {
  if (!pos?.travel_started_at) return null;
  const legs = pos.planned_path ?? [];
  const route = pos.route_id ? routes.find((r) => r.id === pos.route_id) : undefined;

  let destinationId: string | null = null;
  if (pos.flight_target_place_id && !pos.route_id) destinationId = pos.flight_target_place_id;
  else if (legs.length > 0) destinationId = legs[legs.length - 1].to_place_id;
  else if (route) destinationId = route.from_place_id === pos.place_id ? route.to_place_id : route.from_place_id;

  const legMinutes = pos.travel_duration_minutes ?? (route ? routeWeight(route) : 30);
  const elapsedSec = (nowMs - new Date(pos.travel_started_at).getTime()) / 1000;
  const legSecondsLeft = Math.max(0, legMinutes * 60 - elapsedSec);
  const laterSeconds =
    legs.slice(1).reduce((sum, l) => {
      const r = routes.find((x) => x.id === l.route_id);
      return sum + (l.minutes ?? (r ? routeWeight(r) : 30));
    }, 0) * 60;

  return {
    isFlight: !!pos.flight_target_place_id && !pos.route_id,
    destinationId,
    nextStopId: legs[0]?.to_place_id ?? destinationId,
    /** étapes restantes, étape en cours comprise */
    legCount: Math.max(1, legs.length),
    legSecondsLeft,
    totalSecondsLeft: legSecondsLeft + laterSeconds,
    legProgress: legMinutes > 0 ? Math.min(1, Math.max(0, elapsedSec / (legMinutes * 60))) : 1,
  };
}

/** 1 h 05 min 12 s → « 1:05:12 », 4 min 3 s → « 4:03 ». */
export function formatCountdown(secondsLeft: number) {
  const s = Math.max(0, Math.round(secondsLeft));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const mm = h > 0 ? m.toString().padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${rem.toString().padStart(2, "0")}`;
}

/** 75 → « 1 h 15 min », 12 → « 12 min ». */
export function formatMinutes(min: number) {
  const m = Math.ceil(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}
