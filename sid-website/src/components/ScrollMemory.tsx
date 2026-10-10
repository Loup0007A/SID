"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const KEY_PREFIX = "sid-scroll:";
const RESTORE_TIMEOUT_MS = 2500;

/**
 * Mémorise la position de défilement de CHAQUE page du tableau de bord, et
 * la restaure quand on y revient — au lieu de toujours repartir tout en
 * haut. Les pages chargent leurs données après coup (la hauteur grandit au
 * fil des secondes) : on attend donc que la page soit assez haute pour
 * atteindre la position mémorisée, sans dépasser ~2,5 s, et on abandonne
 * dès que l'utilisateur fait lui-même défiler la page.
 *
 * La mémoire est propre à l'onglet (sessionStorage) : elle repart à zéro à
 * la fermeture de l'onglet.
 */
export function ScrollMemory() {
  const pathname = usePathname();

  // Page réellement affichée, mise à jour dès que React a remplacé le
  // contenu (avant que le navigateur ne signale le moindre défilement).
  // Sans ça, en quittant une page, le navigateur remonte l'affichage parce
  // que la nouvelle page est encore courte (ses données ne sont pas
  // chargées), et l'enregistreur de l'ANCIENNE page notait cette position
  // remontée à sa place — on perdait alors l'endroit où on se trouvait.
  const activePath = useRef(pathname);
  useLayoutEffect(() => {
    activePath.current = pathname;
  }, [pathname]);

  // Le navigateur ne doit pas se battre avec nous lors d'un retour arrière.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // Restauration (déclarée AVANT l'enregistrement, pour lire la position
  // mémorisée avant qu'un défilement de la nouvelle page ne l'écrase).
  useEffect(() => {
    let target = 0;
    try {
      target = Number(sessionStorage.getItem(KEY_PREFIX + pathname)) || 0;
    } catch {
      target = 0;
    }

    if (target <= 0) {
      window.scrollTo(0, 0);
      return;
    }

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
        window.scrollTo(0, target);
        return;
      }
      if (performance.now() - start > RESTORE_TIMEOUT_MS) {
        window.scrollTo(0, Math.max(0, max));
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    window.addEventListener("keydown", stop);
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [pathname]);

  // Enregistrement de la position au fil du défilement.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (activePath.current !== pathname) return; // on a déjà changé de page
        try {
          sessionStorage.setItem(KEY_PREFIX + pathname, String(Math.round(window.scrollY)));
        } catch {
          // stockage indisponible (navigation privée stricte) : pas grave
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
