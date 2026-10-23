import { createClient } from "@/lib/supabase/client";
import type { PermissionKey, Profile } from "@/types/database";
import { currentUserId } from "@/lib/session";

export type CurrentUser = { profile: Profile | null; permissions: Set<PermissionKey> };

const FOUNDER_PERMISSIONS: PermissionKey[] = [
  "manage_roles",
  "manage_org_chart",
  "manage_quests",
  "manage_shop",
  "manage_teams",
  "manage_economy",
  "recruit",
  "manage_users",
  "entreprise",
];

// Le layout du tableau de bord et la page ouverte demandent tous deux le
// profil au même moment : une seule série de requêtes sert les deux, et le
// résultat reste valable quelques secondes (navigation rapide entre pages).
const FRESH_MS = 5000;
let cache: { uid: string; at: number; value: CurrentUser } | null = null;
let inflight: { uid: string; promise: Promise<CurrentUser> } | null = null;

/** À appeler après une modification de son propre profil ou de ses rôles. */
export function invalidateCurrentUser() {
  cache = null;
}

/** Récupère le profil connecté + l'ensemble de ses permissions (rôles + fondateur). */
export async function loadCurrentUser(opts: { fresh?: boolean } = {}): Promise<CurrentUser> {
  const uid = await currentUserId();
  if (!uid) return { profile: null, permissions: new Set() };
  if (!opts.fresh && cache && cache.uid === uid && Date.now() - cache.at < FRESH_MS) return cache.value;
  if (inflight && inflight.uid === uid) return inflight.promise;
  const promise = fetchCurrentUser(uid)
    .then((value) => {
      cache = { uid, at: Date.now(), value };
      return value;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { uid, promise };
  return promise;
}

async function fetchCurrentUser(uid: string): Promise<CurrentUser> {
  const supabase = createClient();
  // Tout part en même temps (un seul aller-retour) : profil, rôles avec leurs
  // permissions, et droits du compte de test le cas échéant.
  const [{ data: profile }, roles, { data: sb }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).single(),
    supabase.from("user_roles").select("role_id, roles(role_permissions(permission))").eq("user_id", uid),
    supabase.from("sandbox_accounts").select("permissions").eq("user_id", uid).maybeSingle(),
  ]);

  if (!profile) return { profile: null, permissions: new Set() };

  // Compte de test (bac à sable) : seulement les permissions choisies par
  // l'admin, et plus rien une fois expiré.
  if (profile.sandbox_expires_at) {
    if (new Date(profile.sandbox_expires_at).getTime() <= Date.now()) return { profile, permissions: new Set() };
    return { profile, permissions: new Set<PermissionKey>(((sb?.permissions ?? []) as string[]) as PermissionKey[]) };
  }

  if (profile.is_founder) return { profile, permissions: new Set(FOUNDER_PERMISSIONS) };

  type RoleRow = { role_id: string; roles: { role_permissions: { permission: string }[] } | { role_permissions: { permission: string }[] }[] | null };
  const rows = roles.data as RoleRow[] | null;
  if (roles.error) {
    // Repli : deux requêtes (si la relation rôles → permissions n'est pas lisible d'un coup).
    const { data: roleRows } = await supabase.from("user_roles").select("role_id").eq("user_id", uid);
    const roleIds = (roleRows ?? []).map((r) => r.role_id);
    if (roleIds.length === 0) return { profile, permissions: new Set() };
    const { data: permRows } = await supabase.from("role_permissions").select("permission").in("role_id", roleIds);
    return { profile, permissions: new Set<PermissionKey>((permRows ?? []).map((r) => r.permission as PermissionKey)) };
  }
  const permissions = new Set<PermissionKey>();
  for (const r of rows ?? []) {
    const linked = Array.isArray(r.roles) ? r.roles : r.roles ? [r.roles] : [];
    for (const role of linked) for (const p of role.role_permissions ?? []) permissions.add(p.permission as PermissionKey);
  }
  return { profile, permissions };
}

export function can(permissions: Set<PermissionKey>, ...anyOf: PermissionKey[]) {
  return anyOf.some((p) => permissions.has(p));
}
