"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventKey } from "@/lib/events";

/**
 * Affichage événementiel : la base décide ce qui est affiché (site_decor),
 * réglé depuis Modération → Affichage événementiel. Même réglage pour le
 * Dossier Central, la Cartographie et le Wiki.
 */
export type DecorMode = "auto" | "on" | "off";
export type DecorKey = EventKey;
/** Pour chaque événement : affiché ou non, et son réglage (`<clé>_mode`). Les
 *  clés absentes (migration pas encore lancée) valent « non affiché ». */
export type SiteDecor = Partial<Record<DecorKey, boolean>> & Partial<Record<`${DecorKey}_mode`, DecorMode>>;
export const DECOR_CHANGED_EVENT = "sid:decor-changed";

const NONE: SiteDecor = {};
const STORE_KEY = "sid-decor-v1";
const FRESH_MS = 5 * 60_000;

// Gardé aussi le temps de la visite (sessionStorage) : à l'ouverture d'une
// autre page, le décor (et son code) peut se charger sans attendre la base.
function fromStore(): { at: number; value: SiteDecor } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { at: number; value: SiteDecor };
    return Date.now() - c.at < FRESH_MS ? c : null;
  } catch {
    return null;
  }
}

let cache: { at: number; value: SiteDecor } | null = fromStore();
let inflight: Promise<SiteDecor> | null = null;

async function fetchDecor(force = false): Promise<SiteDecor> {
  if (!force && cache && Date.now() - cache.at < FRESH_MS) return cache.value;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await createClient().rpc("site_decor");
    const value: SiteDecor = !error && data ? { ...NONE, ...(data as SiteDecor) } : NONE;
    cache = { at: Date.now(), value };
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(cache));
    } catch {
      /* stockage indisponible */
    }
    inflight = null;
    return value;
  })();
  return inflight;
}

/** Le décor en vigueur ; se met à jour quand l'administration le change. */
// Avant la première hydratation, on rend comme le serveur (rien) pour éviter
// un décalage ; le décor gardé est appliqué juste après.
let hydrated = false;

export function useSiteDecor(): SiteDecor | null {
  const [decor, setDecor] = useState<SiteDecor | null>(hydrated ? (cache?.value ?? null) : null);
  useEffect(() => {
    hydrated = true;
    let alive = true;
    if (cache && Date.now() - cache.at < FRESH_MS) setDecor(cache.value);
    fetchDecor().then((d) => alive && setDecor(d));
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<SiteDecor | undefined>).detail;
      if (d) {
        cache = { at: Date.now(), value: { ...NONE, ...d } };
        try {
          sessionStorage.setItem(STORE_KEY, JSON.stringify(cache));
        } catch {
          /* stockage indisponible */
        }
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
