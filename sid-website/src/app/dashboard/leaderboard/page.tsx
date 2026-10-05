"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LeaderboardEntry } from "@/types/database";
import { ProfileStyle, profileSkinClass } from "@/components/ProfileStyle";
import clsx from "clsx";

type SortKey = "power_score" | "balance" | "reputation" | "quests_completed";

const TABS: { key: SortKey; label: string; unit: string }[] = [
  { key: "power_score", label: "Puissance", unit: "pts" },
  { key: "balance", label: "Argent", unit: "Z" },
  { key: "reputation", label: "Renommée", unit: "pts" },
  { key: "quests_completed", label: "Quêtes accomplies", unit: "" },
];

export default function LeaderboardPage() {
  const supabase = createClient();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("power_score");
  const [styles, setStyles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("list_leaderboard");
      const rows = (data ?? []) as LeaderboardEntry[];
      setEntries(rows);

      const ids = rows.map((r) => r.user_id);
      if (ids.length > 0) {
        const { data: css } = await supabase.rpc("get_profile_css_for", { p_section: "leaderboard", p_user_ids: ids });
        setStyles(new Map(((css ?? []) as { user_id: string; css: string }[]).map((r) => [r.user_id, r.css])));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = [...entries].sort((a, b) => Number(b[sortKey]) - Number(a[sortKey]) || a.nickname.localeCompare(b.nickname));
  const activeTab = TABS.find((t) => t.key === sortKey)!;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Classement du S.I.D.</h1>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSortKey(t.key)}
            className={clsx(
              "rounded-lg border px-4 py-2 font-mono text-xs uppercase tracking-wide",
              sortKey === t.key ? "border-blue bg-blue text-ink" : "border-blue/50 text-blue hover:bg-blue hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sortKey === "power_score" && (
        <p className="font-body text-sm text-paper/60">Le score de puissance est attribué par les administrateurs.</p>
      )}

      <div className="glass-card divide-y divide-white/10 p-2">
        {sorted.map((e, i) => (
          <div key={e.user_id} className={clsx("flex items-center gap-4 px-4 py-3", profileSkinClass(e.user_id))}>
            <ProfileStyle userId={e.user_id} css={styles.get(e.user_id)} />
            <span className={clsx("w-8 shrink-0 text-center font-display text-lg", i === 0 && "text-blue-light", i === 1 && "text-paper/80", i === 2 && "text-red-light")}>
              {i + 1}
            </span>
            <span className="flex-1 font-display uppercase">{e.nickname}</span>
            <span className="font-mono text-sm text-blue-light">
              {Number(e[sortKey]).toLocaleString("fr-FR")} {activeTab.unit}
            </span>
          </div>
        ))}
        {sorted.length === 0 && <p className="p-4 font-body text-paper/60">Aucune donnée pour le moment.</p>}
      </div>
    </div>
  );
}
