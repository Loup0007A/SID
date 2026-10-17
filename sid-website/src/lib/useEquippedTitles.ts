"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isTitleId, type EquippedTitle } from "@/lib/titles";

/** Titres équipés d'une liste de membres (pour afficher les badges). */
export function useEquippedTitles(userIds: string[]): Map<string, EquippedTitle> {
  const [map, setMap] = useState<Map<string, EquippedTitle>>(new Map());
  const key = Array.from(new Set(userIds)).sort().join(",");

  useEffect(() => {
    if (!key) {
      setMap(new Map());
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .rpc("list_equipped_titles", { p_user_ids: key.split(",") })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const rows = ((data ?? []) as EquippedTitle[]).filter((r) => isTitleId(r.title_id));
        setMap(new Map(rows.map((r) => [r.user_id, r])));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return map;
}
