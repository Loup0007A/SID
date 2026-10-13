import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAT_LABELS, isSimulationKind, type StatKey } from "@/lib/simulationSites";
import { corsJson, corsPreflight, hashRunToken, isRunToken, verifySignature } from "@/lib/simulationServer";

export const dynamic = "force-dynamic";

// Réponse de complete_simulation_run (voir la migration 0049).
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

// POST /api/simulations/result — appelée par le site d'une simulation (ou
// relayée par la page du S.I.D. qui l'affiche) quand une partie se termine.
// Corps : { "token": "<jeton reçu dans sid_run>", "success": true | false }
export async function POST(request: NextRequest) {
  let body: { token?: unknown; success?: unknown; signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return corsJson({ ok: false, error: "invalid_json", message: "Corps de requête JSON invalide." }, 400);
  }

  const { token, success } = body;
  if (!isRunToken(token)) {
    return corsJson({ ok: false, error: "invalid_token", message: "Jeton manquant ou mal formé." }, 400);
  }
  if (typeof success !== "boolean") {
    return corsJson({ ok: false, error: "invalid_success", message: "« success » doit valoir true ou false." }, 400);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return corsJson({ ok: false, error: "server_config", message: "Configuration serveur incomplète." }, 500);
  }

  const tokenHash = hashRunToken(token);

  const { data: run, error: runError } = await admin.rpc("get_simulation_run", { p_token_hash: tokenHash });
  if (runError) {
    return corsJson({ ok: false, error: "server_error", message: "Erreur du serveur." }, 500);
  }
  const kind = (run as { kind?: unknown } | null)?.kind;
  if (!run || !isSimulationKind(kind)) {
    return corsJson({ ok: false, result: "not_found", error: "not_found", message: "Partie inconnue." }, 404);
  }

  const signature =
    request.headers.get("x-sid-signature") ?? (typeof body.signature === "string" ? body.signature : null);
  const check = verifySignature(kind, token, success, signature);
  if (check !== "ok") {
    return corsJson(
      { ok: false, error: "invalid_signature", message: check === "missing" ? "Signature manquante." : "Signature invalide." },
      401
    );
  }

  const { data, error } = await admin.rpc("complete_simulation_run", { p_token_hash: tokenHash, p_success: success });
  if (error || !data) {
    return corsJson({ ok: false, error: "server_error", message: "Erreur du serveur." }, 500);
  }

  const r = data as CompleteResult;
  return corsJson(
    { ok: r.result === "ok", ...r, ...(r.result === "ok" ? {} : { error: r.result }), message: messageFor(r) },
    HTTP_STATUS[r.result] ?? 500
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
