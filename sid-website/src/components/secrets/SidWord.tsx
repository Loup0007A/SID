"use client";

import { useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { announceTitlesChanged } from "@/lib/titles";

/** Le mot « S.I.D. » du pied de page. Rien de spécial… en apparence. */
export function SidWord() {
  const clicks = useRef<number[]>([]);
  const sent = useRef(false);

  async function onClick() {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 180_000), now];
    if (clicks.current.length >= 100 && !sent.current) {
      sent.current = true;
      const supabase = createClient();
      const { data } = await supabase.rpc("claim_sid_clicks", { p_clicks: clicks.current.length });
      if ((data as { result?: string } | null)?.result === "granted") announceTitlesChanged();
      clicks.current = [];
      setTimeout(() => (sent.current = false), 5000);
    }
  }

  return (
    <span onClick={onClick} className="select-none">
      S.I.D.
    </span>
  );
}
