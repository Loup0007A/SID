import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Confirme manuellement l'email d'un compte (cas où le membre ne reçoit
// jamais le message de confirmation). Même schéma de sécurité que
// /api/admin/reset-password : la permission de l'appelant est revérifiée
// côté serveur AVANT toute utilisation de la clé service_role.
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

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Configuration serveur manquante." }, { status: 500 });
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { email_confirm: true });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
