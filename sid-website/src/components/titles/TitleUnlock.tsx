"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { POWERS, TITLE_BY_ID, TITLES_CHANGED_EVENT, isTitleId, roman, type TitleId } from "@/lib/titles";
import { TitleAuraLayer } from "@/components/titles/TitleVisuals";
import { SidIcon } from "@/components/icons/SidIcon";

type Unseen = { title_id: TitleId; level: number; upgraded_at: string | null };

/** Grande révélation quand un titre vient d'être gagné ou amélioré. */
export function TitleUnlock({ userId, equipped }: { userId: string; equipped: string | null }) {
  const supabase = createClient();
  const [queue, setQueue] = useState<Unseen[]>([]);
  const [current, setCurrent] = useState<string | null>(equipped);

  const check = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_titles")
      .select("title_id, level, upgraded_at")
      .eq("user_id", userId)
      .is("seen_at", null);
    if (error) return;
    setQueue(((data ?? []) as Unseen[]).filter((u) => isTitleId(u.title_id)));
    const { data: p } = await supabase.from("profiles").select("equipped_title").eq("id", userId).single();
    setCurrent(p?.equipped_title ?? null);
  }, [supabase, userId]);

  useEffect(() => {
    check();
    const again = () => setTimeout(check, 400);
    window.addEventListener(TITLES_CHANGED_EVENT, again);
    return () => window.removeEventListener(TITLES_CHANGED_EVENT, again);
  }, [check]);

  const item = queue[0];
  if (!item) return null;
  const t = TITLE_BY_ID[item.title_id];
  const upgraded = !!item.upgraded_at && item.level > 1;

  async function close(equipIt: boolean) {
    if (equipIt) await supabase.rpc("equip_title", { p_title: item.title_id });
    if (queue.length <= 1) await supabase.rpc("mark_titles_seen");
    setQueue((q) => q.slice(1));
    if (equipIt) setCurrent(item.title_id);
    window.dispatchEvent(new Event("sid:equipped-changed"));
  }

  return (
    <div className="title-unlock fixed inset-0 z-[9500] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="title-unlock-card glass-card relative w-full max-w-md overflow-hidden p-8 text-center">
        <TitleAuraLayer titleId={t.id} />
        <div className="relative z-[1] space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-paper/70">{upgraded ? "Titre amélioré" : "Nouveau titre"}</p>
          <div className="title-unlock-emoji" aria-hidden><SidIcon name={t.icon} size={84} /></div>
          <h2 className="font-display text-3xl uppercase tracking-wide" style={{ color: t.colors[0], textShadow: `0 0 22px ${t.colors[1]}` }}>
            {t.name}
            {t.maxLevel > 1 && <span className="ml-2">{roman(item.level)}</span>}
          </h2>
          <p className="font-body text-sm text-paper/80">{t.how}</p>
          <p className="font-body text-sm text-paper/90">
            Pouvoir : <strong>{POWERS[t.power].name}</strong> — {POWERS[t.power].description}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {current !== t.id && (
              <button
                onClick={() => close(true)}
                className="rounded-lg px-4 py-2 font-display text-sm uppercase tracking-wide text-ink"
                style={{ background: `linear-gradient(110deg, ${t.colors[0]}, ${t.colors[1]})` }}
              >
                Équiper
              </button>
            )}
            <Link href="/dashboard/titles" onClick={() => close(false)} className="rounded-lg border border-white/25 bg-black/30 px-4 py-2 font-display text-sm uppercase tracking-wide text-paper hover:bg-white/10">
              Mes titres
            </Link>
            <button onClick={() => close(false)} className="rounded-lg px-4 py-2 font-mono text-xs uppercase text-paper/70 underline">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
