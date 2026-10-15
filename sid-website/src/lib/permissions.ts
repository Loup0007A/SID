import { createClient } from "@/lib/supabase/client";
import type { PermissionKey, Profile } from "@/types/database";

/** Récupère le profil connecté + l'ensemble de ses permissions (rôles + fondateur). */
export async function loadCurrentUser(): Promise<{
  profile: Profile | null;
  permissions: Set<PermissionKey>;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { profile: null, permissions: new Set() };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return { profile: null, permissions: new Set() };

  // Compte de test (bac à sable) : seulement les permissions choisies par
  // l'admin, et plus rien une fois expiré.
  if (profile.sandbox_expires_at) {
    if (new Date(profile.sandbox_expires_at).getTime() <= Date.now()) return { profile, permissions: new Set() };
    const { data: sb } = await supabase.from("sandbox_accounts").select("permissions").eq("user_id", user.id).maybeSingle();
    return { profile, permissions: new Set<PermissionKey>(((sb?.permissions ?? []) as string[]) as PermissionKey[]) };
  }

  if (profile.is_founder) {
    return {
      profile,
      permissions: new Set([
        "manage_roles",
        "manage_org_chart",
        "manage_quests",
        "manage_shop",
        "manage_teams",
        "manage_economy",
        "recruit",
        "manage_users",
        "entreprise",
      ]),
    };
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id);

  const roleIds = (roleRows ?? []).map((r) => r.role_id);
  if (roleIds.length === 0) return { profile, permissions: new Set() };

  const { data: permRows } = await supabase
    .from("role_permissions")
    .select("permission")
    .in("role_id", roleIds);

  const permissions = new Set<PermissionKey>((permRows ?? []).map((r) => r.permission as PermissionKey));
  return { profile, permissions };
}

export function can(permissions: Set<PermissionKey>, ...anyOf: PermissionKey[]) {
  return anyOf.some((p) => permissions.has(p));
}
