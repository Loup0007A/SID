"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PRESENCE_ACTIVITY_EVENT, type PresenceExtra } from "@/lib/presence";

const PING_MS = 45_000; // un signal toutes les 45 s (le navigateur ralentit les onglets cachés)
const IDLE_MS = 5 * 60_000; // sans clic ni touche depuis 5 min : « absent »
const HIDDEN_STOP_MS = 30 * 60_000; // onglet caché depuis 30 min : plus de signal, donc hors ligne

/**
 * Signale au S.I.D. que le membre est là, sur quelle page, et s'il est
 * absent (onglet caché ou inactif). Rien n'est affiché.
 */
export function PresenceTracker() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const pathRef = useRef(pathname);
  const extra = useRef<PresenceExtra | null>(null);
  const lastInput = useRef(Date.now());
  const hiddenSince = useRef<number | null>(null);
  const token = useRef<string | null>(null);

  const ping = useCallback(async () => {
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (hidden && hiddenSince.current && Date.now() - hiddenSince.current > HIDDEN_STOP_MS) return;
    const idle = hidden || Date.now() - lastInput.current > IDLE_MS;
    try {
      await supabase.rpc("presence_ping", { p_page: pathRef.current, p_extra: extra.current, p_idle: idle });
    } catch {
      // silencieux : migration 0063 pas encore lancée
    }
  }, [supabase]);

  // Changement de page.
  useEffect(() => {
    pathRef.current = pathname;
    const t = setTimeout(ping, 300);
    return () => clearTimeout(t);
  }, [pathname, ping]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => (token.current = data.session?.access_token ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => (token.current = session?.access_token ?? null));

    const timer = setInterval(ping, PING_MS);

    // Retour d'absence : on le dit tout de suite.
    let lastMark = 0;
    const onInput = () => {
      const now = Date.now();
      const wasIdle = now - lastInput.current > IDLE_MS;
      lastInput.current = now;
      if (wasIdle && now - lastMark > 2000) {
        lastMark = now;
        void ping();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenSince.current = Date.now();
      else {
        hiddenSince.current = null;
        lastInput.current = Date.now();
      }
      void ping();
    };
    const onActivity = (e: Event) => {
      extra.current = ((e as CustomEvent<PresenceExtra | null>).detail ?? null) as PresenceExtra | null;
      void ping();
    };

    // Plusieurs onglets : quand l'un se ferme, les autres redisent qu'on est là.
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("sid-presence");
      bc.onmessage = (e) => {
        if (e.data === "bye" && document.visibilityState !== "hidden") setTimeout(ping, 1500);
      };
    } catch {
      bc = null;
    }

    // Onglet fermé : on part tout de suite (requête qui survit à la page).
    const onLeave = () => {
      bc?.postMessage("bye");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key || !token.current) return;
      try {
        void fetch(`${url}/rest/v1/rpc/presence_leave`, {
          method: "POST",
          keepalive: true,
          headers: { apikey: key, Authorization: `Bearer ${token.current}`, "Content-Type": "application/json" },
          body: "{}",
        });
      } catch {
        // tant pis : le membre disparaîtra au bout de 3 minutes
      }
    };

    window.addEventListener("pointerdown", onInput, { passive: true });
    window.addEventListener("keydown", onInput);
    window.addEventListener("scroll", onInput, { passive: true });
    window.addEventListener(PRESENCE_ACTIVITY_EVENT, onActivity);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    return () => {
      clearInterval(timer);
      sub.subscription.unsubscribe();
      bc?.close();
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("keydown", onInput);
      window.removeEventListener("scroll", onInput);
      window.removeEventListener(PRESENCE_ACTIVITY_EVENT, onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [supabase, ping]);

  return null;
}
