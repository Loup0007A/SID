"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const KEY_PREFIX = "sid-scroll:";
const RESTORE_TIMEOUT_MS = 1200;

// Vrai quand la prochaine page vient d'un « retour » / « avancer » du
// navigateur (ou d'un rechargement) : c'est le seul cas où l'on remet la
// position. En cliquant un lien, on arrive en haut, comme partout ailleurs.
let restoreNext = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    restoreNext = true;
  });
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload" || nav?.type === "back_forward") restoreNext = true;
  } catch {
    // ancien navigateur : pas de restauration au chargement
  }
}

/**
 * Retour arrière : on retrouve l'endroit où l'on était sur la page. Les
 * pages chargent leurs données après coup ; on attend au plus ~1,2 s qu'elles
 * soient assez hautes, et on abandonne dès que la personne touche, clique,
 * fait défiler ou tape une touche — jamais de saut pendant qu'on descend.
 */
export function ScrollMemory() {
  const pathname = usePathname();

  // Page réellement affichée (mise à jour avant tout défilement de la
  // nouvelle page), pour que l'ancienne n'enregistre pas une fausse position.
  const activePath = useRef(pathname);
  useLayoutEffect(() => {
    activePath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  // Restauration (seulement après un retour arrière ou un rechargement).
  useEffect(() => {
    if (!restoreNext) {
      // Nouvelle page ouverte par un lien (souvent sans défilement automatique) : en haut.
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }
    restoreNext = false;
    let target = 0;
    try {
      target = Number(sessionStorage.getItem(KEY_PREFIX + pathname)) || 0;
    } catch {
      target = 0;
    }
    if (target <= 0) return;

    let cancelled = false;
    let raf = 0;
    const start = performance.now();
    const stop = () => {
      cancelled = true;
    };
    const tick = () => {
      if (cancelled) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= target - 2) {
        window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
        return;
      }
      if (performance.now() - start > RESTORE_TIMEOUT_MS) return; // trop tard : on ne saute plus
      raf = requestAnimationFrame(tick);
    };
    const opts = { passive: true, capture: true } as const;
    window.addEventListener("wheel", stop, opts);
    window.addEventListener("touchstart", stop, opts);
    window.addEventListener("pointerdown", stop, opts);
    window.addEventListener("keydown", stop, opts);
    tick();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop, opts);
      window.removeEventListener("touchstart", stop, opts);
      window.removeEventListener("pointerdown", stop, opts);
      window.removeEventListener("keydown", stop, opts);
    };
  }, [pathname]);

  // Enregistrement de la position au fil du défilement.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (activePath.current !== pathname) return;
        try {
          sessionStorage.setItem(KEY_PREFIX + pathname, String(Math.round(window.scrollY)));
        } catch {
          // stockage indisponible : pas grave
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  return null;
}
