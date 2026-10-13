import type { NextRequest } from "next/server";
import { corsJson, corsPreflight, isRunToken } from "@/lib/simulationServer";
import { recordSimulationResult } from "@/lib/simulationRecord";

export const dynamic = "force-dynamic";

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

  const signature =
    request.headers.get("x-sid-signature") ?? (typeof body.signature === "string" ? body.signature : null);
  const outcome = await recordSimulationResult({ token, success, signature });
  return corsJson(outcome.body, outcome.status);
}

export async function OPTIONS() {
  return corsPreflight();
}
