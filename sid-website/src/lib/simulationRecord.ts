import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SIMULATION_SITES, STAT_LABELS, isSimulationKind, type SimulationKind, type StatKey } from "@/lib/simulationSites";
import { hashRunToken, verifySignature } from "@/lib/simulationServer";

/**
 * Enregistrement d'un résultat de simulation, commun aux deux portes
 * d'entrée de l'API :
 *  - POST /api/simulations/result  (format décrit dans API_SIMULATIONS.md) ;
 *  - GET  /api                     (format déjà utilisé par les trois sites).
 * Les règles (jeton à usage unique, durée minimale, limite du jour, plafond
 * de 100) sont appliquées en base par complete_simulation_run (migration 0049).
 */

type CompleteResult = {
  result: "ok" | "not_found" | "already_completed" | "expired" | "too_fast" | "daily_limit";
  status?: string;
  factor?: StatKey;
  points_awarded?: number;
  value?: number;
  power?: number;
  min_seconds?: number;
  max_results_per_day?: number;
};

const HTTP_STATUS: Record<CompleteResult["result"], number> = {
  ok: 200,
  not_found: 404,
  already_completed: 409,
  expired: 410,
  too_fast: 425,
  daily_limit: 429,
};

function messageFor(r: CompleteResult): string {
  switch (r.result) {
    case "ok": {
      const label = r.factor ? STAT_LABELS[r.factor] : "le facteur";
      if (r.status === "failure") return "Simulation échouée : aucun point cette fois.";
      if (!r.points_awarded) return `Simulation réussie, mais ${label} est déjà au maximum (100).`;
      return `Simulation réussie : +1 ${label} (${r.value}/100).`;
    }
    case "not_found":
      return "Partie inconnue.";
    case "already_completed":
      return "Le résultat de cette partie a déjà été enregistré.";
    case "expired":
      return "Cette partie a expiré : relance une simulation depuis le S.I.D.";
    case "too_fast":
      return `Résultat envoyé trop tôt : une partie dure au moins ${r.min_seconds ?? "?"} secondes.`;
    case "daily_limit":
      return `Limite du jour atteinte (${r.max_results_per_day ?? "?"} résultats pour cette simulation). Reviens demain !`;
  }
}

export type RecordOutcome = { status: number; body: Record<string, unknown> };

export type RunInfo = {
  kind: SimulationKind;
  status: string;
  startedAt: number;
};

/** Infos sur une partie à partir de son jeton (null si inconnue). Lève une erreur si le serveur est mal configuré. */
export async function lookupRun(token: string): Promise<RunInfo | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_simulation_run", { p_token_hash: hashRunToken(token) });
  if (error) throw new Error(error.message);
  const run = data as { kind?: unknown; status?: string; started_at?: string } | null;
  if (!run || !isSimulationKind(run.kind)) return null;
  return { kind: run.kind, status: run.status ?? "", startedAt: Date.parse(run.started_at ?? "") };
}

export async function recordSimulationResult(opts: {
  token: string;
  success: boolean;
  signature: string | null;
  /** Si renseigné : refuse le résultat s'il ne relève pas de cette simulation. */
  expectedKind?: SimulationKind;
  /** Partie déjà lue par l'appelant (évite une seconde lecture). */
  run?: RunInfo | null;
}): Promise<RecordOutcome> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { status: 500, body: { ok: false, error: "server_config", message: "Configuration serveur incomplète." } };
  }

  let run = opts.run;
  if (run === undefined) {
    try {
      run = await lookupRun(opts.token);
    } catch {
      return { status: 500, body: { ok: false, error: "server_error", message: "Erreur du serveur." } };
    }
  }
  if (!run) {
    return { status: 404, body: { ok: false, result: "not_found", error: "not_found", message: "Partie inconnue." } };
  }

  if (opts.expectedKind && opts.expectedKind !== run.kind) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "wrong_simulation",
        message: `Ce résultat relève de « ${SIMULATION_SITES[opts.expectedKind].label} », pas de la partie « ${SIMULATION_SITES[run.kind].label} » en cours.`,
      },
    };
  }

  const check = verifySignature(run.kind, opts.token, opts.success, opts.signature);
  if (check !== "ok") {
    return {
      status: 401,
      body: { ok: false, error: "invalid_signature", message: check === "missing" ? "Signature manquante." : "Signature invalide." },
    };
  }

  const { data, error } = await admin.rpc("complete_simulation_run", {
    p_token_hash: hashRunToken(opts.token),
    p_success: opts.success,
  });
  if (error || !data) {
    return { status: 500, body: { ok: false, error: "server_error", message: "Erreur du serveur." } };
  }

  const r = data as CompleteResult;
  return {
    status: HTTP_STATUS[r.result] ?? 500,
    body: { ok: r.result === "ok", ...r, ...(r.result === "ok" ? {} : { error: r.result }), message: messageFor(r) },
  };
}
