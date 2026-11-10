"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { StreakMeter, WheelPanel } from "@/components/wheel/Wheel";
import { KIND_LABEL, RARITY, pct, prizeText, type WheelStatus } from "@/types/wheel";

/** Roue du jour (Lot 76, migration 0093). */

function untilReset(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "maintenant";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export default function WheelPage() {
  const supabase = useMemo(() => createClient(), []);
  const [st, setSt] = useState<WheelStatus | null>(null);
  const [missing, setMissing] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("wheel_status");
    if (error) setMissing(true);
    else setSt(data as WheelStatus);
  }, [supabase]);
  useEffect(() => {
    load();
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (missing) return <p className="glass-card max-w-xl p-6 font-body text-sm text-paper/70">La roue du jour arrive bientôt.</p>;
  if (!st) return <p className="font-body text-paper/60">Chargement de la roue…</p>;

  const today = new Map(st.all.map((p) => [p.id, p]));
  const tomorrow = new Map(st.tomorrow.map((p) => [p.id, p]));
  const cap = new Map(st.at_cap.map((p) => [p.id, p]));
  const boost = st.rare_day1 > 0 ? st.rare_now / st.rare_day1 : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Roue du jour</h1>
        <p className="max-w-2xl font-body text-sm text-paper/70">
          Un tour par jour, remis à zéro à minuit. Chaque jour de visite d&apos;affilée allonge ta série et fait grossir les parts des gains rares. Un jour
          manqué, et la série repart de 1.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section className="glass-card space-y-5 p-4 sm:p-6">
          <StreakMeter streak={st.streak} cap={st.cap} />
          <WheelPanel status={st} onSpun={() => load()} />
          {!st.available && (
            <p className="text-center font-mono text-[11px] text-paper/55">Prochain tour dans {untilReset(st.next_reset)}</p>
          )}
        </section>

        <div className="min-w-0 space-y-6">
          <section className="glass-card space-y-3 p-4 sm:p-5">
            <h2 className="font-display text-lg uppercase">Tes chances</h2>
            <p className="font-body text-sm text-paper/70">
              Gains épiques et légendaires : <b className="text-paper">{pct(st.rare_now)}</b> aujourd&apos;hui
              {st.streak > 1 && st.rare_day1 === 0 && st.rare_now > 0
                ? ", contre 0 % au premier jour"
                : boost && boost > 1.05
                  ? `, ${boost.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} fois plus qu'au premier jour`
                  : ""}
              .
            </p>
            <div className="hidden grid-cols-[1fr_5rem_5rem_5rem] gap-x-3 border-b border-white/10 pb-1 font-mono text-[10px] uppercase text-paper/45 sm:grid">
              <span>Gain</span>
              <span className="text-right">Aujourd&apos;hui</span>
              <span className="text-right">Demain</span>
              <span className="text-right">{st.cap} jours</span>
            </div>
            <ul className="divide-y divide-white/5">
              {st.all.map((p) => {
                const r = RARITY[p.rarity];
                const t = tomorrow.get(p.id);
                const c = cap.get(p.id);
                const up = t && today.get(p.id) && t.probability > (today.get(p.id)?.probability ?? 0) + 0.0005;
                return (
                  <li key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-2 sm:grid-cols-[1fr_5rem_5rem_5rem]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.kind === "rien" ? "#22202e" : r.fill, boxShadow: `0 0 0 1.5px ${r.ring}` }} />
                      <span className="min-w-0">
                        <span className="block truncate font-body text-sm text-paper">{prizeText(p)}</span>
                        <span className="block font-mono text-[10px] uppercase text-paper/50">
                          {r.label} · {KIND_LABEL[p.kind]}
                        </span>
                      </span>
                    </span>
                    <span className={clsx("text-right font-mono text-sm", p.available ? "text-paper" : "text-paper/45")}>
                      {p.available ? pct(p.probability) : p.reason}
                      <span className="block text-[10px] text-paper/45 sm:hidden">aujourd&apos;hui</span>
                    </span>
                    <span className={clsx("hidden text-right font-mono text-xs sm:block", up ? "text-green-300" : "text-paper/55")}>{t ? pct(t.probability) : "—"}</span>
                    <span className="hidden text-right font-mono text-xs text-paper/55 sm:block">{c ? pct(c.probability) : "—"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="font-body text-xs text-paper/50">
              Les gains et leurs chances sont fixés par l&apos;administration. Le tirage se fait sur le serveur, au moment où tu tournes.
            </p>
          </section>

          {st.history.length > 0 && (
            <section className="glass-card space-y-2 p-4 sm:p-5">
              <h2 className="font-display text-lg uppercase">Tes derniers tours</h2>
              <ul className="space-y-1">
                {st.history.map((h) => (
                  <li key={h.day} className="flex items-baseline gap-3 font-body text-sm">
                    <span className="w-14 shrink-0 font-mono text-[11px] text-paper/50">{new Date(h.day).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span>
                    <span className="min-w-0 flex-1 truncate" style={{ color: h.kind === "rien" ? "rgba(237,230,211,0.5)" : RARITY[h.rarity].ring }}>
                      {h.kind === "rien" ? "Rien" : prizeText({ ...h, detail: null })}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-paper/45">série {h.streak}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
