import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SIMULATION_SITES, isSimulationKind } from "@/lib/simulationSites";
import { hashRunToken, newRunToken } from "@/lib/simulationServer";

export const dynamic = "force-dynamic";

// POST /api/simulations/start — appelée par la page d'une simulation dans
// le tableau de bord (membre connecté, même site : pas de CORS). Crée la
// partie et renvoie le jeton à transmettre à l'iframe.
export async function POST(request: NextRequest) {
  let body: { kind?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!isSimulationKind(body.kind)) {
    return NextResponse.json({ error: "Simulation inconnue." }, { status: 400 });
  }
  const site = SIMULATION_SITES[body.kind];

  if (!site.url) {
    return NextResponse.json(
      { error: "Cette simulation est encore en développement : son site n'est pas encore branché au S.I.D." },
      { status: 409 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const token = newRunToken();
  const { data, error } = await supabase.rpc("start_simulation_run", {
    p_kind: site.kind,
    p_token_hash: hashRunToken(token),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Le site de la simulation reçoit le jeton et l'adresse de l'API dans son URL.
  const iframeUrl = new URL(site.url);
  iframeUrl.searchParams.set("sid_run", token);
  iframeUrl.searchParams.set("sid_api", `${request.nextUrl.origin}/api/simulations`);
  // Les sites identifient aussi le joueur par son e-mail : on le leur donne
  // pour qu'ils n'aient pas à le redemander (seul le jeton compte côté S.I.D.).
  if (user.email) iframeUrl.searchParams.set("email", user.email);

  return NextResponse.json(
    { token, iframe_url: iframeUrl.toString(), ...(data as Record<string, unknown>) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
