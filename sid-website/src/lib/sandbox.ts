import { createClient } from "@/lib/supabase/client";
import type { PermissionKey } from "@/types/database";

// Bac à sable (migration 0059) : outils côté navigateur pour entrer dans un
// compte de test puis revenir à son compte d'admin.

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  manage_roles: "Rôles et permissions",
  manage_org_chart: "Organigramme",
  manage_quests: "Quêtes",
  manage_shop: "Boutique",
  manage_teams: "Équipes",
  manage_economy: "Économie",
  recruit: "Recrutement",
  manage_users: "Gestion des comptes",
  entreprise: "Entreprises",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

const RETURN_KEY = "sid-bac-a-sable-retour";

type SavedSession = { access_token: string; refresh_token: string; nickname?: string };

function readSaved(): SavedSession | null {
  try {
    const raw = localStorage.getItem(RETURN_KEY);
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
}

/** Nom du compte d'admin auquel « Revenir » ramènera (null si aucun). */
export function savedAdminNickname(): string | null {
  return readSaved()?.nickname ?? null;
}

/**
 * Entre dans un compte de test depuis cet onglet : la session d'admin est
 * mise de côté (dans ce navigateur) pour pouvoir y revenir.
 */
export async function enterSandbox(email: string, password: string, adminNickname?: string): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session && !readSaved()) {
    try {
      localStorage.setItem(RETURN_KEY, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token, nickname: adminNickname }));
    } catch {
      // stockage indisponible : il faudra se reconnecter à la main
    }
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    try {
      localStorage.removeItem(RETURN_KEY);
    } catch {
      // rien
    }
    return error.message;
  }
  window.location.href = "/dashboard";
  return null;
}

/** Quitte le compte de test et rouvre la session d'admin mise de côté. */
export async function leaveSandbox() {
  const supabase = createClient();
  const saved = readSaved();
  await supabase.auth.signOut();
  try {
    localStorage.removeItem(RETURN_KEY);
  } catch {
    // rien
  }
  if (saved) {
    const { error } = await supabase.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token });
    if (!error) {
      window.location.href = "/dashboard/admin/sandbox";
      return;
    }
  }
  window.location.href = "/login";
}

/** « 5 h 12 », « 3 j 4 h », « 12 min ». */
export function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expiré";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${String(min % 60).padStart(2, "0")}`;
  return `${Math.floor(h / 24)} j ${h % 24} h`;
}
