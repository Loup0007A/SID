import { SIMULATION_SITES, STAT_LABELS } from "@/lib/simulationSites";
import { corsJson, corsPreflight } from "@/lib/simulationServer";

export const dynamic = "force-dynamic";

// GET /api/simulations — sommaire de l'API, utile pour vérifier depuis un
// site de simulation que le S.I.D. répond. Détails : API_SIMULATIONS.md.
export async function GET() {
  return corsJson({
    api: "S.I.D. — simulations",
    version: 1,
    endpoints: {
      run: "GET /api/simulations/run?token=<jeton> — infos sur la partie en cours",
      result: "POST /api/simulations/result — { token, success } : enregistre le résultat",
    },
    simulations: Object.values(SIMULATION_SITES).map((s) => ({
      kind: s.kind,
      label: s.label,
      factor: s.factor,
      factor_label: STAT_LABELS[s.factor],
      connected: Boolean(s.url),
      in_development: s.inDevelopment,
    })),
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
