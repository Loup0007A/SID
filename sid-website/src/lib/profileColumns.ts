import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fiches des membres (Lot 96, migration 0120) : les champs qu'un membre peut
 * masquer (prénom, nom, âge, armes, équipement, description, rôle voulu) et
 * ses réglages ne sont plus lisibles directement dans la table `profiles`.
 *  - les fiches des autres : PROFILE_PUBLIC_COLUMNS (un `select("*")` est refusé) ;
 *  - sa propre fiche, complète : myProfile() ;
 *  - fiches complètes pour la gestion des comptes : fullProfiles().
 * Les fiches vues par un autre membre (champs non masqués compris) passent
 * par get_visible_profile / list_roster.
 */
// Typé comme « * » : mêmes lignes, les champs privés en moins.
export const PROFILE_PUBLIC_COLUMNS = "id, nickname, avatar_url, status, is_founder, hidden_fields, reviewed_by, reviewed_at, created_at, member_rank, is_muted, reputation, last_seen_at, power_score, sandbox_expires_at, mute_until, is_frozen, freeze_until, ban_until, is_invisible, terms_version, terms_accepted_at, presence_visible, activity_visible, equipped_title" as "*";

/** Sa fiche complète. Avant la migration 0120 : lecture directe (même résultat). */
export async function myProfile(sb: SupabaseClient, uid: string) {
  const r = await sb.rpc("my_profile").maybeSingle();
  if (!r.error) return r;
  return sb.from("profiles").select("*").eq("id", uid).maybeSingle();
}

/** Fiches complètes (gestion des comptes, recrutement), d'un statut donné ou toutes. */
export async function fullProfiles(sb: SupabaseClient, status: string | null) {
  const r = await sb.rpc("profiles_full", { p_status: status });
  if (!r.error || !/profiles_full|PGRST202/.test(`${r.error.message} ${r.error.code}`)) return r;
  const q = sb.from("profiles").select("*").order("nickname");
  return status ? q.eq("status", status) : q;
}
