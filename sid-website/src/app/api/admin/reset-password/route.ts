import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomInt } from "crypto";

// Génère un mot de passe temporaire lisible, que l'admin peut communiquer
// au membre concerné (qui devra le changer depuis /dashboard/profile).
function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[randomInt(chars.length)];
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
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "userId manquant ou invalide." }, { status: 400 });
  }

  // 1. Vérifie que l'appelant est authentifié ET a la permission manage_users,
  // via le client "normal" (soumis au RLS / cookies de session).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // Gestion des comptes, et jamais sur un fondateur ni un autre
  // administrateur sauf par un fondateur ; jamais depuis un compte de test
  // (admin_peut_gerer_compte, migration 0127).
  const { data: allowed, error: permError } = await supabase.rpc("admin_peut_gerer_compte", { p_cible: userId });
  if (permError) {
    return NextResponse.json(
      { error: /admin_peut_gerer_compte|PGRST202/.test(`${permError.message} ${permError.code}`) ? "Lance d'abord la migration 0127." : permError.message },
      { status: 503 }
    );
  }
  if (!allowed) {
    return NextResponse.json({ error: "Permission refusée : ce compte ne se gère que par un fondateur." }, { status: 403 });
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

  // Trace dans le journal d'audit (qui a réinitialisé le mot de passe de
  // qui). Un échec d'écriture du journal n'annule pas la réinitialisation.
  const { error: auditError } = await supabase.rpc("log_admin_action", { p_action: "password_reset", p_target: userId });
  if (auditError) console.error("Journal d'audit :", auditError.message);

  return NextResponse.json({ tempPassword });
}
