"use client";

import { useEffect, useMemo, useState } from "react";

// Taches de sang (formes générées une fois, stables d'un rendu à l'autre).
function splatPath(seed: number, cx: number, cy: number, r: number): string {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = 14;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = i % 2 === 0 ? 0.7 + rand() * 0.5 : 0.35 + rand() * 0.3;
    const spike = rand() < 0.25 ? 1.6 + rand() * 0.8 : 1;
    pts.push(`${(cx + Math.cos(a) * r * k * spike).toFixed(1)},${(cy + Math.sin(a) * r * k * spike).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/**
 * Écran de la « perte temporaire d'un membre » (Donjons, niveau 50+) :
 * la simulation est fermée jusqu'à `until`, sur fond taché de sang.
 */
export function BloodLockout({ until, onHealed }: { until: string; onHealed?: () => void }) {
  const end = new Date(until).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, end - now);
  useEffect(() => {
    if (left === 0) onHealed?.();
  }, [left === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const splats = useMemo(
    () =>
      [
        [11, 60, 50, 38], [23, 300, 30, 22], [37, 520, 70, 46], [51, 160, 190, 28], [71, 420, 210, 34],
        [89, 600, 180, 18], [97, 240, 120, 12], [113, 80, 220, 16], [131, 560, 260, 24],
      ].map(([seed, x, y, r]) => ({ d: splatPath(seed, x, y, r), drops: [0, 1, 2].map((k) => ({ x: x + (k - 1) * r * 0.9, y: y + r * (1.2 + k * 0.3), r: 2 + (k % 2) * 2 })) })),
    []
  );

  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);

  return (
    <div className="relative overflow-hidden rounded-lg border border-red-900/70 bg-[#1a0306] p-6 text-center">
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 660 300" preserveAspectRatio="xMidYMid slice">
        {splats.map((sp, i) => (
          <g key={i} fill={i % 3 === 0 ? "#5e0008" : "#8b0010"} opacity={0.85}>
            <path d={sp.d} />
            {sp.drops.map((dr, k) => (
              <circle key={k} cx={dr.x} cy={dr.y} r={dr.r} />
            ))}
          </g>
        ))}
      </svg>
      <div className="relative space-y-3">
        <p className="font-display text-2xl uppercase tracking-wide text-[#ff5a5a]">Perte temporaire d&apos;un membre</p>
        <p className="font-body text-sm text-paper/80">
          Le dernier coup a été de trop. Le temps de te soigner, l&apos;accès à la simulation est fermé.
        </p>
        <p className="font-mono text-3xl text-paper">
          {m}:{String(s).padStart(2, "0")}
        </p>
        <p className="font-mono text-[11px] uppercase text-paper/65">
          Retour possible à {new Date(end).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
