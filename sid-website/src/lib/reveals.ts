"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Reveals } from "@/lib/navigation";

/**
 * Pages dévoilées par l'administration (Lot 66). Gardées dans le navigateur
 * pour que la tuile apparaisse tout de suite, puis relues une fois par
 * ouverture de l'onglet.
 */
const KEY = "sid-reveals-v1";
export const REVEALS_CHANGED_EVENT = "sid:reveals";
let inflight: Promise<Reveals> | null = null;

function cached(): Reveals {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Reveals;
  } catch {
    return {};
  }
}

export function storeReveals(r: Reveals) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new CustomEvent(REVEALS_CHANGED_EVENT, { detail: r }));
}

export function useReveals(): Reveals {
  const [r, setR] = useState<Reveals>({});
  useEffect(() => {
    setR(cached());
    inflight ??= Promise.resolve(createClient().rpc("site_reveals")).then(({ data }) => {
      const next = (data ?? {}) as Reveals;
      storeReveals(next);
      return next;
    });
    inflight.then(setR, () => {});
    const on = (e: Event) => setR((e as CustomEvent<Reveals>).detail);
    window.addEventListener(REVEALS_CHANGED_EVENT, on);
    return () => window.removeEventListener(REVEALS_CHANGED_EVENT, on);
  }, []);
  return r;
}
