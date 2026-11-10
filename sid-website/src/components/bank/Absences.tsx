"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";

/** Banque : prélèvements pour absence prolongée (Lot 76, migration 0093). */

type Mine = {
  enabled: boolean;
  grace: number;
  rate: number;
  exempt_until: string | null;
  total_30: number;
  charges: { day: string; days: number; amount: number; shares: number; list: { name: string; quantity: number }[]; savings: number; wallet: number; debt: number }[];
};

const z = (n: number) => `${Math.round(Number(n)).toLocaleString("fr-FR")} z`;

export function Absences() {
  const supabase = useMemo(() => createClient(), []);
  const [m, setM] = useState<Mine | null>(null);
  useEffect(() => {
    supabase.rpc("my_inactivity").then(({ data, error }) => !error && data && setM(data as Mine));
  }, [supabase]);
  if (!m || !m.enabled) return null;

  const recent = m.charges.filter((c) => Date.now() - new Date(c.day).getTime() < 30 * 86_400_000);
  if (recent.length === 0) {
    return (
      <p className="font-body text-xs text-paper/55">
        <SidIcon name="hourglass" /> Après {m.grace} jours sans visite, chaque jour d&apos;absence coûte {z(m.rate)} × le nombre de jours, pris sur tes actions,
        ton épargne, ton solde, puis en dette.
        {m.exempt_until && ` Tu en es dispensé jusqu'au ${new Date(m.exempt_until).toLocaleDateString("fr-FR")}.`}
      </p>
    );
  }
  return (
    <div className="glass-card space-y-3 border-red/40 p-4 sm:p-6">
      <h2 className="font-display text-lg uppercase text-red">
        <SidIcon name="hourglass" /> Absence prolongée : −{z(m.total_30)} en 30 jours
      </h2>
      <ul className="space-y-1">
        {recent.map((c) => (
          <li key={c.day} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-body text-sm">
            <span className="w-12 shrink-0 font-mono text-[11px] text-paper/50">{new Date(c.day).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span>
            <span className="font-mono text-xs text-red-light">−{z(c.amount)}</span>
            <span className="min-w-0 font-mono text-[11px] text-paper/60">
              {c.days} jours sans visite :{" "}
              {[
                c.shares > 0 && `actions ${c.list.map((l) => `${l.quantity} ${l.name}`).join(", ")} (${z(c.shares)})`,
                c.savings > 0 && `épargne ${z(c.savings)}`,
                c.wallet > 0 && `solde ${z(c.wallet)}`,
                c.debt > 0 && `dette ${z(c.debt)}`,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          </li>
        ))}
      </ul>
      <p className="font-body text-xs text-paper/55">
        À partir de {m.grace} jours sans visite, chaque jour coûte {z(m.rate)} × le nombre de jours d&apos;absence. Une visite par semaine suffit à
        l&apos;éviter.
      </p>
    </div>
  );
}
