"use client";

import { useSuspendedSections, type MaintenanceSection } from "@/lib/maintenance";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Bannière d'avertissement si la section `sectionKey` (ex: "shop", "chat",
 * "bank", "quests", "registrations") a été désactivée par un admin depuis
 * `/dashboard/admin/moderation`. N'affiche rien si la section est active.
 * Les actions restent bloquées côté base même si ce composant n'est pas
 * utilisé sur une page — c'est un confort d'affichage, pas la protection
 * elle-même.
 */
export function MaintenanceNotice({ sectionKey }: { sectionKey: string }) {
  // Même liste (et même requête) que la barre du haut.
  const suspended = useSuspendedSections();
  const flag = suspended[sectionKey as MaintenanceSection];
  const state = flag ? { disabled: true, message: flag.message } : null;

  if (!state?.disabled) return null;

  return (
    <div className="glass-card border border-red/60 p-4 font-body text-sm text-red-light">
      <SidIcon name="cone" /> {state.message || "Cette section est temporairement fermée par l'administration."}
    </div>
  );
}
