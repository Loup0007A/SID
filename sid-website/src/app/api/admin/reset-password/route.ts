import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Génère un mot de passe temporaire lisible, que l'admin peut communiquer
// au membre concerné (qui devra le changer depuis /dashboard/profile).
function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(request: NextRequest) {
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { userId } = body;
  if (!userId) {
    return NextResponse.json({ error: "userId manquant." }, { status: 400 });
  }

  // 1. Vérifie que l'appelant est authentifié ET a la permission manage_users,
  // via le client "normal" (soumis au RLS / cookies de session).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data: allowed, error: permError } = await supabase.rpc("has_permission", {
    uid: user.id,
    perm: "manage_users",
  });

  if (permError || !allowed) {
    return NextResponse.json({ error: "Permission refusée." }, { status: 403 });
  }

  // 2. Effectue la réinitialisation avec la clé service_role (seule capable
  // d'appeler l'API d'administration Auth de Supabase).
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Configuration serveur manquante." }, { status: 500 });
  }

  const tempPassword = generateTempPassword();
  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ tempPassword });
}
