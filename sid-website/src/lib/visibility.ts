import type { Profile } from "@/types/database";

// Comptes invisibles (migration 0058) : ils sont retirés des listes de choix
// (nouvelle conversation, bénéficiaire d'une quête, embauche, organigramme…),
// sauf pour le membre lui-même et la gestion des comptes.
export function visibleMembers<T extends Pick<Profile, "id"> & { is_invisible?: boolean | null }>(
  list: T[],
  viewerId: string | null | undefined,
  canSeeInvisible: boolean
): T[] {
  if (canSeeInvisible) return list;
  return list.filter((m) => !m.is_invisible || m.id === viewerId);
}
