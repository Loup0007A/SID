"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Liens directs (Lot 59) : `/dashboard/shop?objet=<id>`, `/dashboard/quests?quete=<id>`.
 * La page appelle `useDeepLink("objet", ready, open)` : l'identifiant présent
 * dans l'adresse est transmis une fois, dès que les données de la page sont
 * prêtes (quel que soit l'ordre d'arrivée de l'adresse et des données).
 * La palette de recherche annonce aussi chaque lien choisi (`sid:deeplink`)
 * une fois la nouvelle adresse en place.
 */
export const DEEPLINK_EVENT = "sid:deeplink";

/** Prévient la page quand l'adresse `href` est effectivement affichée. */
export function announceDeepLink(href: string) {
  const target = new URL(href, window.location.origin);
  let tries = 0;
  const tick = () => {
    if (window.location.pathname === target.pathname && window.location.search === target.search) {
      window.dispatchEvent(new CustomEvent(DEEPLINK_EVENT, { detail: href }));
    } else if (tries++ < 50) setTimeout(tick, 100);
  };
  tick();
}

export function useDeepLink(param: string, ready: boolean, onId: (id: string) => void) {
  const cb = useRef(onId);
  cb.current = onId;
  const [pending, setPending] = useState<string | null>(null);
  const handled = useRef<string | null>(null);

  // L'adresse au chargement de la page.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get(param);
    if (id) setPending(id);
  }, [param]);

  // Un lien choisi plus tard (palette) pour cette même page.
  useEffect(() => {
    const on = (e: Event) => {
      const url = new URL((e as CustomEvent<string>).detail, window.location.origin);
      if (url.pathname !== window.location.pathname) return;
      const id = url.searchParams.get(param);
      if (id) {
        handled.current = null;
        setPending(id);
      }
    };
    window.addEventListener(DEEPLINK_EVENT, on);
    return () => window.removeEventListener(DEEPLINK_EVENT, on);
  }, [param]);

  // Transmis quand les données sont là.
  useEffect(() => {
    if (!ready || !pending || handled.current === pending) return;
    handled.current = pending;
    cb.current(pending);
    setPending(null);
  }, [ready, pending]);
}
