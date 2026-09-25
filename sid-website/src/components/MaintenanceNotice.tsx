"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Bannière d'avertissement si la section `sectionKey` (ex: "shop", "chat",
 * "bank", "quests", "registrations") a été désactivée par un admin depuis
 * `/dashboard/admin/moderation`. N'affiche rien si la section est active.
 * Les actions restent bloquées côté base même si ce composant n'est pas
 * utilisé sur une page — c'est un confort d'affichage, pas la protection
 * elle-même.
 */
export function MaintenanceNotice({ sectionKey }: { sectionKey: string }) {
  const supabase = createClient();
  const [state, setState] = useState<{ disabled: boolean; message: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("list_maintenance_flags");
      const row = (data ?? []).find((f: { key: string; is_enabled: boolean; message: string | null }) => f.key === sectionKey);
      setState(row ? { disabled: !row.is_enabled, message: row.message } : { disabled: false, message: null });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey]);

  if (!state?.disabled) return null;

  return (
    <div className="glass-card border border-red/60 p-4 font-body text-sm text-red-light">
      🚧 {state.message || "Cette section est temporairement fermée par l'administration."}
    </div>
  );
}
