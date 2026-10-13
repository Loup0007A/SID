"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Sections que l'administration peut suspendre (Modération → maintenance). */
export type MaintenanceSection = "shop" | "chat" | "bank" | "quests" | "simulations" | "registrations";

export type MaintenanceState = Partial<Record<MaintenanceSection, { message: string | null }>>;

let cache: { at: number; value: MaintenanceState } | null = null;

/** Sections suspendues en ce moment (rafraîchi toutes les 30 s au plus). */
export function useSuspendedSections(): MaintenanceState {
  const [state, setState] = useState<MaintenanceState>(cache?.value ?? {});
  useEffect(() => {
    if (cache && Date.now() - cache.at < 30000) {
      setState(cache.value);
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.rpc("list_maintenance_flags");
      const value: MaintenanceState = {};
      for (const f of (data ?? []) as { key: MaintenanceSection; is_enabled: boolean; message: string | null }[]) {
        if (!f.is_enabled) value[f.key] = { message: f.message };
      }
      cache = { at: Date.now(), value };
      setState(value);
    })();
  }, []);
  return state;
}
