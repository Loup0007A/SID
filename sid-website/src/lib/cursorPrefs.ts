/** Réglage du curseur (Réglages → Curseur), propre à chaque navigateur. */

export type CursorMode = "full" | "click" | "off";
export const CURSOR_KEY = "sid-cursor";
export const CURSOR_EVENT = "sid:cursor-changed";

export function readCursorMode(): CursorMode {
  try {
    const v = localStorage.getItem(CURSOR_KEY);
    return v === "click" || v === "off" ? v : "full";
  } catch {
    return "full";
  }
}

export function writeCursorMode(mode: CursorMode) {
  try {
    localStorage.setItem(CURSOR_KEY, mode);
  } catch {
    /* navigation privée : tant pis, le réglage vaut pour cette page */
  }
  window.dispatchEvent(new CustomEvent(CURSOR_EVENT, { detail: mode }));
}
