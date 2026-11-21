"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_COMFORT, applyComfort, normalizeComfort, readComfort, sameComfort, writeComfort, writeComfortCookie, type ComfortPrefs } from "@/lib/comfortPrefs";

/**
 * Réglages d'affichage du compte (Lots 94-95) : relus à l'ouverture et posés
 * s'ils diffèrent de ceux du navigateur. Un compte sans réglage reçoit
 * ceux du navigateur. Suit aussi les réglages clair/sombre et « réduire les
 * animations » de l'appareil. Fichier identique sur les trois sites.
 */
export default function ComfortSync() {
  useEffect(() => {
    let off = false;
    const sb = createClient();
    // Le cookie évite au middleware de relire le compte à chaque appareil.
    writeComfortCookie(readComfort());
    sb.rpc("display_prefs_get").then(({ data, error }) => {
      if (off || error || !data || typeof data !== "object") return;
      const remote = data as Partial<ComfortPrefs>;
      const local = readComfort();
      if (Object.keys(remote).length === 0) {
        if (!sameComfort(local, DEFAULT_COMFORT)) void sb.rpc("display_prefs_set", { p_prefs: local });
        return;
      }
      const r = normalizeComfort(remote);
      if (!sameComfort(r, local)) writeComfort(r);
    });
    const queries = ["(prefers-color-scheme: dark)", "(prefers-reduced-motion: reduce)"].map((q) => window.matchMedia?.(q));
    const follow = () => applyComfort(readComfort());
    queries.forEach((mq) => mq?.addEventListener?.("change", follow));
    return () => {
      off = true;
      queries.forEach((mq) => mq?.removeEventListener?.("change", follow));
    };
  }, []);
  return null;
}

/** Enregistre sur le compte (après writeComfort). */
export async function saveComfortToAccount(p: ComfortPrefs) {
  const { error } = await createClient().rpc("display_prefs_set", { p_prefs: p });
  return error ? error.message : null;
}
