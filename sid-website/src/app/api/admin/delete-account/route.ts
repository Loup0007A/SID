import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Suppression d'un compte À LA DEMANDE DU MEMBRE (page « Mes données »).
// Les contrôles sont en base (purge_member_for_deletion : demande en cours,
// jamais un fondateur ni soi-même) ; la clé service_role ne sert qu'à
// supprimer ensuite le compte de connexion.
export async function POST(request: NextRequest) {
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  if (!body.userId) return NextResponse.json({ error: "userId manquant." }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Configuration serveur manquante." }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("purge_member_for_deletion", { p_user: body.userId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: delError } = await admin.auth.admin.deleteUser(body.userId);
  if (delError) {
    return NextResponse.json(
      { error: `Données effacées et compte désactivé, mais le compte de connexion n'a pas pu être supprimé : ${delError.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, details: data });
}
