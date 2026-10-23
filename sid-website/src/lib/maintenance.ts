"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Sections que l'administration peut suspendre (Modération → maintenance). */
export type MaintenanceSection = "shop" | "chat" | "bank" | "quests" | "simulations" | "registrations";

export type MaintenanceState = Partial<Record<MaintenanceSection, { message: string | null }>>;

let cache: { at: number; value: MaintenanceState } | null = null;
let inflight: Promise<MaintenanceState> | null = null;

// Plusieurs composants le demandent en même temps (barre du haut, page) :
// une seule requête pour tous.
function fetchSuspended(): Promise<MaintenanceState> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await createClient().rpc("list_maintenance_flags");
    const value: MaintenanceState = {};
    for (const f of (data ?? []) as { key: MaintenanceSection; is_enabled: boolean; message: string | null }[]) {
      if (!f.is_enabled) value[f.key] = { message: f.message };
    }
    cache = { at: Date.now(), value };
    return value;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Sections suspendues en ce moment (rafraîchi toutes les 30 s au plus). */
export function useSuspendedSections(): MaintenanceState {
  const [state, setState] = useState<MaintenanceState>(cache?.value ?? {});
  useEffect(() => {
    if (cache && Date.now() - cache.at < 30000) {
      setState(cache.value);
      return;
    }
    let alive = true;
    fetchSuspended().then((v) => alive && setState(v));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
