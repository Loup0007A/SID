"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CURSOR_EVENT, CURSOR_KEY, readCursorMode } from "@/lib/cursorPrefs";

const CursorTrail = dynamic(() => import("@/components/CursorTrail").then((m) => m.CursorTrail), { ssr: false });

/**
 * La traînée du curseur n'est téléchargée que si elle peut servir : souris,
 * animations autorisées, et pas désactivée dans les réglages.
 */
export function LazyCursorTrail() {
  const [want, setWant] = useState(false);
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setWant(fine.matches && !calm.matches && readCursorMode() !== "off");
    update();
    const onStorage = (e: StorageEvent) => e.key === CURSOR_KEY && update();
    fine.addEventListener?.("change", update);
    calm.addEventListener?.("change", update);
    window.addEventListener(CURSOR_EVENT, update);
    window.addEventListener("storage", onStorage);
    return () => {
      fine.removeEventListener?.("change", update);
      calm.removeEventListener?.("change", update);
      window.removeEventListener(CURSOR_EVENT, update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return want ? <CursorTrail /> : null;
}
