"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PRESENCE_PINGED_EVENT, activityOf, sinceLabel, type OnlineMember } from "@/lib/presence";
import { useEquippedTitles } from "@/lib/useEquippedTitles";
import { TitleBadge } from "@/components/titles/TitleVisuals";

const FIRST = 6;

function Avatar({ m }: { m: OnlineMember }) {
  if (m.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-display text-sm uppercase text-paper/80">
      {m.nickname.slice(0, 1)}
    </span>
  );
}

/** Petit tableau de l'accueil : qui est sur le site en ce moment, et ce qu'il y fait. */
export function OnlineNow() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<OnlineMember[] | null>(null);
  const [all, setAll] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_online");
    if (error) {
      setRows([]);
      return;
    }
    setRows((data ?? []) as OnlineMember[]);
    setNow(Date.now());
  }, [supabase]);

  useEffect(() => {
    // Laisse le temps au premier signal de présence d'arriver.
    const first = setTimeout(load, 700);
    const t = setInterval(load, 30_000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    // Premier signal de présence envoyé : on se voit dans la liste tout de suite.
    let pinged = false;
    const onPing = () => {
      if (pinged) return;
      pinged = true;
      load();
    };
    window.addEventListener(PRESENCE_PINGED_EVENT, onPing);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(PRESENCE_PINGED_EVENT, onPing);
    };
  }, [load]);

  const titles = useEquippedTitles((rows ?? []).map((r) => r.id));
  if (!rows) return null;

  const others = rows.filter((r) => !r.me);
  const active = rows.filter((r) => !r.idle).length;
  const shown = all ? rows : rows.slice(0, FIRST);

  return (
    <section aria-labelledby="online-now" className="glass-card space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="online-now" className="flex items-center gap-2 font-display text-lg uppercase tracking-wide">
            <span className="online-dot" aria-hidden />
            En ligne maintenant
          </h2>
          <span className="font-mono text-xs text-paper/50">
            {rows.length} {rows.length > 1 ? "membres" : "membre"}
            {active < rows.length ? `, dont ${rows.length - active} absent${rows.length - active > 1 ? "s" : ""}` : ""}
          </span>
        </div>
        <Link href="/dashboard/profile#presence" scroll={false} className="font-mono text-[11px] text-paper/50 underline-offset-2 hover:text-paper hover:underline">
          Ce que les autres voient de toi
        </Link>
      </div>

      {others.length === 0 && <p className="font-body text-sm text-paper/60">Personne d&apos;autre pour l&apos;instant. Tu as le S.I.D. pour toi.</p>}

      <ul className="divide-y divide-white/[0.07]">
        {shown.map((m) => {
          const act = activityOf(m);
          const t = titles.get(m.id);
          return (
            <li key={m.id} className="online-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2 sm:grid-cols-[auto_minmax(0,16rem)_minmax(0,1fr)_auto]">
              <span className="relative">
                <Avatar m={m} />
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink ${m.idle ? "bg-[#e8b04a]" : "bg-[#5fe39a]"}`} title={m.idle ? "Absent" : "Actif"} />
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <Link href={m.me ? "/dashboard/profile" : `/dashboard/profile/${m.id}`} scroll={false} className="max-w-[10rem] shrink-0 truncate font-display uppercase tracking-wide hover:text-blue">
                  {m.nickname}
                </Link>
                {m.me && <span className="shrink-0 font-mono text-[10px] text-paper/45">toi</span>}
                {t && (
                  <span className="hidden min-w-0 overflow-hidden md:inline-flex">
                    <TitleBadge titleId={t.title_id} level={t.level} dragon={t.dragon} size="xs" />
                  </span>
                )}
              </span>
              <span className={`col-start-2 row-start-2 min-w-0 truncate font-body text-sm sm:col-start-auto sm:row-start-auto ${act.muted ? "text-paper/45" : "text-paper/85"}`}>
                <span aria-hidden className="mr-1.5">{act.emoji}</span>
                {act.text}
                {m.masked && !act.muted && <span className="ml-1.5 font-mono text-[10px] text-paper/40">(masquée aux autres)</span>}
                {m.hidden && <span className="ml-1.5 font-mono text-[10px] text-paper/40">👻 invisible pour les autres</span>}
              </span>
              <span className="col-start-3 row-span-2 row-start-1 text-right font-mono text-[11px] text-paper/50 sm:col-start-auto sm:row-span-1 sm:row-start-auto">
                {m.idle ? "absent" : sinceLabel(m.since, now)}
              </span>
            </li>
          );
        })}
      </ul>

      {rows.length > FIRST && (
        <button onClick={() => setAll((a) => !a)} className="font-mono text-xs text-blue underline-offset-2 hover:underline">
          {all ? "Réduire" : `Voir les ${rows.length - FIRST} autres`}
        </button>
      )}
    </section>
  );
}
