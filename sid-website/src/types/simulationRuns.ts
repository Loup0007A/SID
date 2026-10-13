import type { SimulationKind, SkillKey } from "@/lib/simulationSites";

export type SimulationRunStatus = "started" | "success" | "failure" | "abandoned" | "expired";

/** Renvoyé par get_simulation_overview() (migration 0049). */
export interface SimulationOverview {
  intelligence: number;
  strength: number;
  technique: number;
  power: number;
  /** Points par compétence (migration 0051). */
  skills: Partial<Record<SkillKey, number>>;
  /** Objets « réinitialisation des délais » possédés. */
  cooldown_resets: number;
  max_results_per_day: number;
  min_seconds: number;
  enabled: boolean;
  results_today: Record<SimulationKind, number>;
  recent_runs: {
    kind: SimulationKind;
    skill: SkillKey | null;
    status: SimulationRunStatus;
    points_awarded: number;
    started_at: string;
    finished_at: string | null;
  }[];
}

/** Réponse de POST /api/simulations/result. */
export interface SimulationResultResponse {
  ok: boolean;
  result?: string;
  status?: SimulationRunStatus;
  points_awarded?: number;
  value?: number;
  power?: number;
  message: string;
}
