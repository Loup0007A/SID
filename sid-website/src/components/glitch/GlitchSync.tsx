"use client";

/**
 * Relit la liste des membres en lieu inconnu (Lot 81) : à l'ouverture, au
 * retour sur l'onglet, chaque minute, et tout de suite après un brouillage
 * fait depuis la Cartographie (événement « sid:glitch-changed »).
 * Fichier identique dans les trois sites.
 */

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateGlitched } from "@/lib/glitch";

export const GLITCH_CHANGED_EVENT = "sid:glitch-changed";

export function GlitchSync() {
  useEffect(() => {
    const supabase = createClient();
    let last = 0;
    let alive = true;
    const load = (force = false) => {
      if (!force && (document.hidden || Date.now() - last < 10_000)) return;
      last = Date.now();
      supabase.rpc("glitched_members").then(({ data, error }) => {
        if (alive && !error && Array.isArray(data)) updateGlitched(data);
      });
    };
    const onVisible = () => load();
    const onChanged = () => load(true);
    load(true);
    const t = setInterval(load, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(GLITCH_CHANGED_EVENT, onChanged);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(GLITCH_CHANGED_EVENT, onChanged);
    };
  }, []);
  return null;
}
