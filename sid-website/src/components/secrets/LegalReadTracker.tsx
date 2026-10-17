"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/** Note (pour un membre connecté) qu'une page légale a été lue jusqu'au bout. */
export function LegalReadTracker({ page }: { page: "cgu" | "confidentialite" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opened = Date.now();
    let done = false;
    let wait: ReturnType<typeof setTimeout> | null = null;
    const mark = async () => {
      if (done) return;
      done = true;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.rpc("mark_legal_read", { p_page: page });
    };
    const obs = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || done) return;
      const spent = Date.now() - opened;
      if (spent >= 15000) mark();
      else if (!wait) wait = setTimeout(mark, 15000 - spent);
    });
    if (ref.current) obs.observe(ref.current);
    return () => {
      obs.disconnect();
      if (wait) clearTimeout(wait);
    };
  }, [page]);
  return <div ref={ref} aria-hidden className="h-px w-full" />;
}
