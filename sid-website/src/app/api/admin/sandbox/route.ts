import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Bac à sable : comptes de test temporaires créés par la gestion des comptes.
// Les contrôles et le journal d'audit sont en base (migration 0059), appelés
// avec la session de l'admin ; la clé service_role ne sert qu'aux comptes de
// connexion (création, mot de passe, suppression).
//
// POST { action: "create", nickname?, permissions, hours, rank, balance }
// POST { action: "login", userId }   → nouveau mot de passe pour y entrer
// POST { action: "delete", userId }  → efface le compte et ce qu'il a créé
// POST { action: "cleanup" }         → efface les comptes de test expirés

const PERMISSIONS = ["manage_roles", "manage_org_chart", "manage_quests", "manage_shop", "manage_teams", "manage_economy", "recruit", "manage_users", "entreprise"];
const RANKS = ["E", "D", "C", "B", "A", "S"];

function password() {
  return randomBytes(12).toString("base64url");
}

type Body = {
  action?: string;
  userId?: string;
  nickname?: string;
  permissions?: unknown;
  hours?: unknown;
  rank?: unknown;
  balance?: unknown;
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  // 1. L'appelant : connecté, gestion des comptes, et pas lui-même un compte de test.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const [{ data: allowed }, { data: isSandbox }] = await Promise.all([
    supabase.rpc("has_permission", { uid: user.id, perm: "manage_users" }),
    supabase.rpc("is_sandbox_account", { uid: user.id }),
  ]);
  if (!allowed || isSandbox) return NextResponse.json({ error: "Permission refusée." }, { status: 403 });

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Configuration serveur manquante." }, { status: 500 });
  }

  // Efface un compte de test : d'abord ses données (en base, avec contrôles),
  // puis son compte de connexion.
  async function remove(userId: string) {
    const { data, error } = await supabase.rpc("purge_sandbox_account", { p_user: userId });
    if (error) return { ok: false, error: error.message };
    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) return { ok: false, error: `Données effacées et compte désactivé, mais suppression du compte de connexion impossible : ${delError.message}` };
    return { ok: true, details: data };
  }

  switch (body.action) {
    case "create": {
      const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p): p is string => typeof p === "string" && PERMISSIONS.includes(p)) : [];
      const hours = Math.max(1, Math.min(24 * 30, Math.round(Number(body.hours) || 24)));
      const rank = typeof body.rank === "string" && RANKS.includes(body.rank) ? body.rank : "E";
      const balance = Math.max(0, Math.min(1_000_000, Number(body.balance) || 0));
      const tag = randomBytes(4).toString("hex");
      const nickname = (typeof body.nickname === "string" && body.nickname.trim().slice(0, 40)) || `Testeur-${tag.slice(0, 4).toUpperCase()}`;
      const email = `sandbox-${tag}@sid-quest.test`;
      const pwd = password();

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: pwd,
        email_confirm: true,
        user_metadata: { nickname, first_name: "Compte", last_name: "de test" },
      });
      if (createError || !created.user) {
        return NextResponse.json({ error: `Création du compte impossible : ${createError?.message ?? "inconnue"}` }, { status: 500 });
      }

      const { data: setup, error: setupError } = await supabase.rpc("setup_sandbox_account", {
        p_user: created.user.id,
        p_permissions: permissions,
        p_hours: hours,
        p_rank: rank,
        p_balance: balance,
      });
      if (setupError) {
        await admin.auth.admin.deleteUser(created.user.id);
        const hint = setupError.message.includes("setup_sandbox_account") ? " (la migration 0059 doit être lancée sur la base)" : "";
        return NextResponse.json({ error: `${setupError.message}${hint}` }, { status: 400 });
      }
      return NextResponse.json({ userId: created.user.id, email, password: pwd, nickname, ...(setup as object) });
    }

    case "login": {
      if (!body.userId) return NextResponse.json({ error: "userId manquant." }, { status: 400 });
      // Seulement un compte de test encore valide (lecture soumise au RLS de l'admin).
      const { data: row } = await supabase.from("sandbox_accounts").select("email, expires_at").eq("user_id", body.userId).maybeSingle();
      if (!row) return NextResponse.json({ error: "Ce n'est pas un compte de test." }, { status: 400 });
      if (new Date(row.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Ce compte de test a expiré." }, { status: 400 });
      const pwd = password();
      const { error } = await admin.auth.admin.updateUserById(body.userId, { password: pwd });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ email: row.email, password: pwd });
    }

    case "delete": {
      if (!body.userId) return NextResponse.json({ error: "userId manquant." }, { status: 400 });
      const res = await remove(body.userId);
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    case "cleanup": {
      const { data: rows, error } = await supabase.rpc("list_sandbox_accounts");
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      const expired = ((rows ?? []) as { user_id: string; expired: boolean }[]).filter((r) => r.expired);
      const results = [];
      for (const r of expired) results.push(await remove(r.user_id));
      return NextResponse.json({ removed: results.filter((r) => r.ok).length, errors: results.filter((r) => !r.ok).map((r) => r.error) });
    }

    default:
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }
}
