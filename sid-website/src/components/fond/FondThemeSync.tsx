"use client";

import { useEffect } from "react";
import { useSiteDecor } from "@/components/seasonal/siteDecor";
import { themeFromDecor } from "@/lib/fondTheme";

/** Met à jour le thème du fond quand l'affichage événementiel change. */
export function FondThemeSync() {
  const decor = useSiteDecor();
  useEffect(() => {
    if (!decor) return;
    const t = themeFromDecor(decor);
    const root = document.documentElement;
    if (t === "sid") delete root.dataset.theme;
    else root.dataset.theme = t;
  }, [decor]);
  return null;
}
