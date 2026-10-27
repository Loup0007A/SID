"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LineChart } from "@/components/LineChart";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Évolution du portefeuille (Lot 60) : le solde de fin de journée sur 7, 30
 * ou 90 jours, recalculé à rebours depuis le solde actuel avec le relevé des
 * mouvements, et d'où vient (ou où part) l'argent sur la période.
 */

type Tx = { amount: number; reason: string; created_at: string };
const PERIODS = [7, 30, 90] as const;

const z = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} z`;
// Graduations assez précises pour des soldes proches (4,898 M et 4,9 M).
const axisFmt = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 3 });
const axis = (n: number) => axisFmt.format(n);
const dayKey = (d: Date) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(d);

/** « Récompense quête : Q1 » → « Récompense quête » : on regroupe par nature. */
function kind(reason: string) {
  const k = reason.split(/\s[:·—-]\s|\s\(/)[0].trim();
  return k.length > 40 ? `${k.slice(0, 38)}…` : k || "Autre";
}

export function WalletHistory({ userId, balance }: { userId: string; balance: number }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [txs, setTxs] = useState<Tx[] | null>(null);

  useEffect(() => {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    createClient()
      .from("transactions")
      .select("amount, reason, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000)
      .then(({ data }) => setTxs(((data ?? []) as Tx[]).map((t) => ({ ...t, amount: Number(t.amount) }))));
  }, [userId]);

  const view = useMemo(() => {
    if (!txs) return null;
    const now = new Date();
    const start = new Date(now.getTime() - (days - 1) * 86_400_000);
    // Solde en fin de chaque jour, du plus récent au plus ancien.
    const keys: string[] = [];
    for (let i = 0; i < days; i++) keys.push(dayKey(new Date(now.getTime() - i * 86_400_000)));
    const byDay = new Map<string, number>();
    for (const t of txs) byDay.set(dayKey(new Date(t.created_at)), (byDay.get(dayKey(new Date(t.created_at))) ?? 0) + t.amount);
    const closing: number[] = [];
    let b = balance;
    for (const k of keys) {
      closing.push(b);
      b -= byDay.get(k) ?? 0; // solde de la veille au soir
    }
    closing.reverse();
    keys.reverse();

    const inPeriod = txs.filter((t) => new Date(t.created_at) >= new Date(dayKey(start) + "T00:00:00"));
    const group = (sign: 1 | -1) => {
      const m = new Map<string, number>();
      for (const t of inPeriod) if (Math.sign(t.amount) === sign) m.set(kind(t.reason), (m.get(kind(t.reason)) ?? 0) + Math.abs(t.amount));
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    };
    const income = group(1);
    const spend = group(-1);
    return {
      labels: keys.map((k) => new Date(k + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })),
      closing,
      income,
      spend,
      totalIn: inPeriod.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0),
      totalOut: inPeriod.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0),
      net: closing[closing.length - 1] - (closing[0] - (byDay.get(keys[0]) ?? 0)),
      count: inPeriod.length,
    };
  }, [txs, days, balance]);

  return (
    <section className="glass-card space-y-4 p-6" aria-labelledby="wallet-history">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="wallet-history" className="font-display text-lg uppercase">
          <SidIcon name="chart" /> Évolution du portefeuille
        </h2>
        <div className="flex gap-1" role="group" aria-label="Période">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={days === p}
              onClick={() => setDays(p)}
              className={`rounded-full border px-3 py-1 font-mono text-xs ${days === p ? "border-blue bg-blue text-ink" : "border-white/20 text-paper/75 hover:border-blue/60"}`}
            >
              {p} j
            </button>
          ))}
        </div>
      </div>

      {!view ? (
        <p className="font-mono text-xs text-paper/65">Chargement du relevé…</p>
      ) : view.count === 0 ? (
        <p className="font-body text-sm text-paper/70">Aucun mouvement sur cette période : ton solde n&apos;a pas bougé.</p>
      ) : (
        <>
          <p className="font-body text-sm text-paper/75">
            Sur {days} jours :{" "}
            <strong className={view.net >= 0 ? "text-[#b9e3c6]" : "text-red"}>
              {view.net >= 0 ? "+" : "−"}
              {z(Math.abs(view.net))}
            </strong>{" "}
            ({view.count} mouvement{view.count > 1 ? "s" : ""}).
          </p>
          <LineChart labels={view.labels} series={[{ name: "Solde", color: "#8FB3D9", values: view.closing }]} height={200} formatValue={z} formatAxis={axis} />
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Rentrées", view.income, view.totalIn, "#b9e3c6"],
                ["Dépenses", view.spend, view.totalOut, "#e8a5a5"],
              ] as const
            ).map(([title, rows, total, color]) => (
              <div key={title}>
                <p className="mb-2 flex justify-between font-mono text-[11px] uppercase tracking-wide text-paper/70">
                  <span>{title}</span>
                  <span style={{ color }}>{z(total)}</span>
                </p>
                {rows.length === 0 ? (
                  <p className="font-body text-xs text-paper/65">Rien sur la période.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {rows.map(([label, v]) => (
                      <li key={label}>
                        <div className="flex justify-between gap-2 font-body text-xs text-paper/85">
                          <span className="truncate">{label}</span>
                          <span className="shrink-0 font-mono">{z(v)}</span>
                        </div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(3, (v / (rows[0][1] || 1)) * 100)}%`, background: color }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
