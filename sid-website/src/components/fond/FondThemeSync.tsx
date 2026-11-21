"use client";

import { useEffect } from "react";
import { useSiteDecor } from "@/components/seasonal/siteDecor";
import { themeFromDecor } from "@/lib/fondTheme";

/** Met à jour le thème du fond quand l'affichage événementiel change. */
export function FondThemeSync() {
  const decor = useSiteDecor();
  useEffect(() => {
    if (!decor) return;
    let t: string = themeFromDecor(decor);
    const root = document.documentElement;
    // Élection prise par la force : posé par le décor de l'élection.
    if (t === "election" && root.dataset.electionMode === "force") t = "election_force";
    if (t === "sid") delete root.dataset.theme;
    else root.dataset.theme = t;
  }, [decor]);
  return null;
}
