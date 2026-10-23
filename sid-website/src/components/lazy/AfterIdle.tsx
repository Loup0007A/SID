"use client";

import { useEffect, useState, type ReactNode } from "react";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * N'affiche ses enfants qu'une fois la page affichée et le navigateur au
 * repos (au plus tard après `timeout` ms). Pour ce qui n'est pas urgent :
 * présence en ligne, secrets, survols… Le contenu de la page passe d'abord.
 */
export function AfterIdle({ children, timeout = 2000 }: { children: ReactNode; timeout?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as IdleWindow;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout });
      return () => w.cancelIdleCallback?.(id);
    }
    // Safari : pas de requestIdleCallback.
    const t = setTimeout(() => setReady(true), Math.min(600, timeout));
    return () => clearTimeout(t);
  }, [timeout]);
  return ready ? <>{children}</> : null;
}
