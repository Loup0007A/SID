"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Affichage événementiel : la base décide ce qui est affiché (site_decor),
 * réglé depuis Modération → Affichage événementiel. Même réglage pour le
 * Dossier Central, la Cartographie et le Wiki.
 */
export type DecorMode = "auto" | "on" | "off";
export type SiteDecor = {
  halloween: boolean;
  halloween_mode: DecorMode;
  /** Absents tant que la migration 0064 n'est pas passée. */
  noel?: boolean;
  noel_mode?: DecorMode;
};
export type DecorKey = "halloween" | "noel";
export const DECOR_CHANGED_EVENT = "sid:decor-changed";

const NONE: SiteDecor = { halloween: false, halloween_mode: "auto", noel: false, noel_mode: "auto" };
let cache: { at: number; value: SiteDecor } | null = null;
let inflight: Promise<SiteDecor> | null = null;

async function fetchDecor(force = false): Promise<SiteDecor> {
  if (!force && cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await createClient().rpc("site_decor");
    const value: SiteDecor = !error && data ? { ...NONE, ...(data as SiteDecor) } : NONE;
    cache = { at: Date.now(), value };
    inflight = null;
    return value;
  })();
  return inflight;
}

/** Le décor en vigueur ; se met à jour quand l'administration le change. */
export function useSiteDecor(): SiteDecor | null {
  const [decor, setDecor] = useState<SiteDecor | null>(cache?.value ?? null);
  useEffect(() => {
    let alive = true;
    fetchDecor().then((d) => alive && setDecor(d));
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<SiteDecor | undefined>).detail;
      if (d) {
        cache = { at: Date.now(), value: { ...NONE, ...d } };
        setDecor(cache.value);
      } else fetchDecor(true).then((v) => alive && setDecor(v));
    };
    window.addEventListener(DECOR_CHANGED_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(DECOR_CHANGED_EVENT, onChange);
    };
  }, []);
  return decor;
}

/** Jours entre aujourd'hui (heure de Paris) et une date de l'année en cours. */
export function daysUntil(month: number, day: number, now = new Date()) {
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const today = new Date(paris.getFullYear(), paris.getMonth(), paris.getDate());
  return { days: Math.round((new Date(paris.getFullYear(), month - 1, day).getTime() - today.getTime()) / 86400000), month: paris.getMonth() + 1 };
}
