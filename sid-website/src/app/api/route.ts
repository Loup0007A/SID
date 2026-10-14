import type { NextRequest } from "next/server";
import { corsJson, corsPreflight, isRunToken } from "@/lib/simulationServer";
import { lookupRun, recordSimulationResult } from "@/lib/simulationRecord";
import { interpretSiteReport, siteForEpreuve } from "@/lib/simulationSites";

export const dynamic = "force-dynamic";

/**
 * GET /api — adresse appelée par les trois sites (Potions, Techniques,
 * 3D-game-world) à la fin de chaque tentative, dans leur format :
 *   /api?epreuve=potions&statut=reussi&reussi=1&debut=…&email=…&sig=…&sid_run=<jeton>…
 *
 * Le jeton `sid_run` arrive tout seul : le S.I.D. l'ajoute à l'adresse de
 * l'iframe et les sites recopient dans leurs résultats les paramètres
 * d'adresse qu'ils ne connaissent pas.
 *
 * Un résultat SANS jeton n'est jamais compté : l'e-mail et la « signature »
 * `sig` des sites sont calculés dans le navigateur avec un sel public,
 * donc n'importe qui pourrait les fabriquer pour n'importe quelle adresse.
 * Seule une partie lancée depuis le S.I.D. rapporte des points.
 *
 * Les sites appellent cette adresse en mode « no-cors » et n'en lisent pas
 * la réponse : elle sert surtout au diagnostic (onglet Réseau du navigateur).
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;

  if (!q.has("epreuve") && !q.has("sid_run")) {
    return corsJson({
      api: "S.I.D.",
      message:
        "Adresse de réception des résultats des simulations (Potions, Techniques, 3D-game-world). Détails : API_SIMULATIONS.md.",
      simulations: "/api/simulations",
    });
  }

  const site = siteForEpreuve(q.get("epreuve"));
  if (!site) {
    return corsJson({ ok: false, counted: false, error: "unknown_epreuve", message: "Épreuve inconnue." }, 400);
  }

  const token = q.get("sid_run");
  if (!isRunToken(token)) {
    return corsJson(
      {
        ok: false,
        counted: false,
        error: "no_run",
        message: "Résultat reçu mais non compté : pour gagner un point, lance la simulation depuis le S.I.D.",
      },
      202
    );
  }

  let run;
  try {
    run = await lookupRun(token);
  } catch {
    return corsJson({ ok: false, counted: false, error: "server_error", message: "Erreur du serveur." }, 500);
  }
  if (!run) {
    return corsJson({ ok: false, counted: false, result: "not_found", error: "not_found", message: "Partie inconnue." }, 404);
  }

  const verdict = interpretSiteReport(
    site,
    { epreuve: q.get("epreuve"), statut: q.get("statut"), reussi: q.get("reussi"), debut: q.get("debut") },
    run.startedAt
  );
  if (verdict.action === "ignore") {
    return corsJson({ ok: false, counted: false, error: "ignored", message: `Non compté : ${verdict.reason}.` }, 202);
  }

  const outcome = await recordSimulationResult({
    token,
    success: verdict.success,
    signature: q.get("sid_sig"),
    epreuve: q.get("epreuve"),
    niveau: q.get("niveau") ? Number(q.get("niveau")) : null,
    expectedKind: site.kind,
    run,
  });
  return corsJson({ ...outcome.body, counted: outcome.body.ok === true }, outcome.status);
}

export async function OPTIONS() {
  return corsPreflight();
}
