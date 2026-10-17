"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { announceTitlesChanged } from "@/lib/titles";

type Spot = { id: string; path: string; x: number; y: number };

export const HIDDEN_BUTTON_EVENT = "sid:hidden-button";

/** Presque invisible, quelque part sur une page précise. */
export function HiddenButton() {
  const supabase = createClient();
  const pathname = usePathname();
  const [spot, setSpot] = useState<Spot | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_hidden_button");
    if (!error) setSpot((data as Spot | null) ?? null);
  }, [supabase]);

  useEffect(() => {
    load();
    window.addEventListener(HIDDEN_BUTTON_EVENT, load);
    return () => window.removeEventListener(HIDDEN_BUTTON_EVENT, load);
  }, [load]);

  if (!spot || spot.path !== pathname) return null;

  async function press() {
    if (!spot) return;
    const id = spot.id;
    setSpot(null);
    await supabase.rpc("press_hidden_button", { p_id: id });
    announceTitlesChanged();
    load();
  }

  return (
    <button
      type="button"
      onClick={press}
      aria-hidden
      tabIndex={-1}
      className="sid-speck absolute z-[5]"
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
    >
      ✦
    </button>
  );
}
