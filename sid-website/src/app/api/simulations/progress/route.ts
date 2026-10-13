import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { corsJson, corsPreflight, hashRunToken, isRunToken } from "@/lib/simulationServer";

export const dynamic = "force-dynamic";

/**
 * Progression des simulations synchronisée entre appareils (migration 0050).
 * Utilisée par /sid-sync.js, chargé dans les sites des simulations.
 *
 *   GET  /api/simulations/progress?token=<sid_run>
 *        → { ok, kind, data: { clé: valeur | null }, updated_at }
 *   POST /api/simulations/progress   corps : { token, set: { clé: "valeur" }, remove: ["clé"] }
 *        (accepté aussi en text/plain, pour navigator.sendBeacon)
 *
 * Le jeton de partie identifie le membre et la simulation ; il reste valable
 * 24 h pour la synchronisation. Aucun point ne se gagne par cette route.
 */

const MAX_BODY = 200_000;

export function OPTIONS() {
  return corsPreflight();
}

function admin() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!isRunToken(token)) return corsJson({ ok: false, error: "invalid_token", message: "Jeton invalide." }, 400);

  const client = admin();
  if (!client) return corsJson({ ok: false, error: "server_config", message: "Configuration serveur incomplète." }, 500);

  const { data, error } = await client.rpc("get_simulation_progress", { p_token_hash: hashRunToken(token) });
  if (error || !data) return corsJson({ ok: false, error: "server_error", message: "Erreur du serveur." }, 500);

  const r = data as { result: string };
  if (r.result !== "ok") return corsJson({ ok: false, error: r.result, message: "Partie inconnue ou trop ancienne." }, 404);
  return corsJson({ ok: true, ...r });
}

export async function POST(request: NextRequest) {
  const text = await request.text();
  if (text.length > MAX_BODY) return corsJson({ ok: false, error: "too_large", message: "Envoi trop volumineux." }, 413);

  let body: { token?: unknown; set?: unknown; remove?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return corsJson({ ok: false, error: "invalid_body", message: "Corps de requête invalide." }, 400);
  }
  if (!body || typeof body !== "object") {
    return corsJson({ ok: false, error: "invalid_body", message: "Corps de requête invalide." }, 400);
  }
  if (!isRunToken(body.token)) return corsJson({ ok: false, error: "invalid_token", message: "Jeton invalide." }, 400);

  const set = body.set ?? {};
  const remove = body.remove ?? [];
  if (typeof set !== "object" || Array.isArray(set) || !Array.isArray(remove) || !remove.every((k) => typeof k === "string")) {
    return corsJson({ ok: false, error: "invalid_body", message: "« set » doit être un objet et « remove » une liste de clés." }, 400);
  }

  const client = admin();
  if (!client) return corsJson({ ok: false, error: "server_config", message: "Configuration serveur incomplète." }, 500);

  const { data, error } = await client.rpc("save_simulation_progress", {
    p_token_hash: hashRunToken(body.token),
    p_set: set,
    p_remove: remove,
  });
  if (error) {
    const tooBig = error.message.includes("trop volumineuse");
    return corsJson(
      { ok: false, error: tooBig ? "too_large" : "server_error", message: tooBig ? error.message : "Erreur du serveur." },
      tooBig ? 413 : 500
    );
  }

  const r = data as { result: string; message?: string };
  if (r.result === "not_found") return corsJson({ ok: false, error: "not_found", message: "Partie inconnue ou trop ancienne." }, 404);
  if (r.result !== "ok") return corsJson({ ok: false, error: r.result, message: r.message ?? "Requête refusée." }, 400);
  return corsJson({ ok: true, ...r });
}
