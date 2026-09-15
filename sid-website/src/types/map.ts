export interface MapPlace {
  id: string;
  name: string;
  type: string;
}

export interface MapRoute {
  id: string;
  name: string | null;
  from_place_id: string;
  to_place_id: string;
  path_points: { x: number; y: number }[] | null;
  color: string | null;
  travel_minutes: number | null;
}

export interface CityBuilding {
  id: string;
  name: string;
}

export interface CharacterPosition {
  user_id: string;
  place_id: string | null;
  building_id: string | null;
  route_id: string | null;
  route_progress: number | null;
  travel_started_at: string | null;
  planned_path: { route_id: string; to_place_id: string }[] | null;
  note: string | null;
  is_visible: boolean;
  updated_at: string;
}

// Renvoyé par list_active_positions() — positions + pseudo/avatar déjà joints
export interface ActivePosition {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  place_id: string | null;
  building_id: string | null;
  route_id: string | null;
  route_progress: number | null;
  travel_started_at: string | null;
  note: string | null;
  is_visible: boolean;
  updated_at: string;
}

// Renvoyé par list_map_quests() — quêtes localisées sur la carte
export interface MapQuest {
  id: string;
  title: string;
  place_id: string;
}

export interface TravelPlanStep {
  route_id: string;
  to_place_id: string;
  weight_minutes: number;
}

export interface TravelPlan {
  totalMinutes: number;
  steps: TravelPlanStep[];
}
