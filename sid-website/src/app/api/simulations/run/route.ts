import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { corsJson, corsPreflight, hashRunToken, isRunToken } from "@/lib/simulationServer";

export const dynamic = "force-dynamic";

// GET /api/simulations/run?token=<jeton> — permet au site d'une simulation
// de vérifier, avant de lancer la partie, que le jeton reçu est valable,
// et d'afficher le pseudo du joueur.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!isRunToken(token)) {
    return corsJson({ ok: false, error: "invalid_token", message: "Jeton manquant ou mal formé." }, 400);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return corsJson({ ok: false, error: "server_config", message: "Configuration serveur incomplète." }, 500);
  }

  const { data, error } = await admin.rpc("get_simulation_run", { p_token_hash: hashRunToken(token) });
  if (error) {
    return corsJson({ ok: false, error: "server_error", message: "Erreur du serveur." }, 500);
  }
  if (!data) {
    return corsJson({ ok: false, error: "not_found", message: "Partie inconnue." }, 404);
  }

  const run = data as { kind: string; status: string; nickname: string; started_at: string; expires_at: string };
  return corsJson({
    ok: true,
    kind: run.kind,
    status: run.status,
    playable: run.status === "started",
    nickname: run.nickname,
    started_at: run.started_at,
    expires_at: run.expires_at,
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
