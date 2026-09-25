"use client";

import { useId, useMemo, useState } from "react";

export interface LineSeries {
  name: string;
  /** couleur hex, ex: "#8FB3D9" */
  color: string;
  values: number[];
  dashed?: boolean;
}

interface LineChartProps {
  /** un libellé par point (même longueur que chaque série) */
  labels: string[];
  series: LineSeries[];
  height?: number;
  /** format du tooltip */
  formatValue?: (n: number) => string;
  /** format des graduations de l'axe Y (compact par défaut) */
  formatAxis?: (n: number) => string;
  /** ligne horizontale de référence (ex : valeur intrinsèque d'une action) */
  refLine?: { value: number; label: string; color?: string };
  /** aire sous la courbe */
  fill?: boolean;
  /** force l'axe Y à partir de 0 (compteurs) ; laisser false pour des prix */
  zeroBased?: boolean;
}

const W = 640;
const PAD = { l: 48, r: 14, t: 14, b: 26 };

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Courbe lissée (spline cardinale bornée pour éviter tout dépassement artificiel). */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  const f = (n: number) => n.toFixed(1);
  if (pts.length === 1) return `M${f(pts[0].x)},${f(pts[0].y)}`;
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6, lo, hi);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6, lo, hi);
    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2.x)},${f(p2.y)}`;
  }
  return d;
}

export function LineChart({
  labels,
  series,
  height = 220,
  formatValue = (n) => full.format(n),
  formatAxis = (n) => compact.format(n),
  refLine,
  fill = true,
  zeroBased = false,
}: LineChartProps) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const n = labels.length;
  const H = height;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const { min, max } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    if (refLine) all.push(refLine.value);
    if (all.length === 0) return { min: 0, max: 1 };
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    if (zeroBased) lo = Math.min(0, lo);
    if (hi === lo) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.08;
    return { min: zeroBased ? lo : lo - pad, max: hi + pad };
  }, [series, refLine, zeroBased]);

  if (n < 2) {
    return <p className="font-body text-sm text-paper/60">Pas encore assez de données pour tracer une courbe.</p>;
  }

  const x = (i: number) => PAD.l + (i / (n - 1)) * innerW;
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * innerH;
  const baseY = PAD.t + innerH;

  const yTicks = [0, 1, 2, 3].map((k) => min + ((max - min) * k) / 3);
  const xTickIdx = Array.from(new Set([0, 1, 2, 3, 4].map((k) => Math.round((k * (n - 1)) / 4))));

  function indexFromClientX(clientX: number, el: SVGSVGElement) {
    const r = el.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    return clamp(Math.round(((vx - PAD.l) / innerW) * (n - 1)), 0, n - 1);
  }

  const showDots = n <= 31;
  const tipLeftPct = hover !== null ? clamp((x(hover) / W) * 100, 14, 86) : 0;

  return (
    <div className="relative">
      {series.length > 1 && (
        <div className="mb-1 flex flex-wrap gap-3 font-mono text-[10px] uppercase text-paper/70">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-white/15 bg-ink/95 px-3 py-1.5 font-mono text-[11px] shadow-lg"
          style={{ left: `${tipLeftPct}%` }}
        >
          <p className="text-paper/60">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} style={{ color: s.color }}>
              {series.length > 1 ? `${s.name} : ` : ""}
              {formatValue(s.values[hover])}
            </p>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        style={{ touchAction: "pan-y" }}
        onMouseMove={(e) => setHover(indexFromClientX(e.clientX, e.currentTarget))}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => setHover(indexFromClientX(e.touches[0].clientX, e.currentTarget))}
        onTouchMove={(e) => setHover(indexFromClientX(e.touches[0].clientX, e.currentTarget))}
        role="img"
        aria-label="Graphique en courbe"
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.name} id={`${gid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-white/10" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="fill-paper/50 font-mono" fontSize={10}>
              {formatAxis(v)}
            </text>
          </g>
        ))}

        {xTickIdx.map((i, k) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor={k === 0 ? "start" : k === xTickIdx.length - 1 ? "end" : "middle"}
            className="fill-paper/50 font-mono"
            fontSize={10}
          >
            {labels[i]}
          </text>
        ))}

        {refLine && (
          <g>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(refLine.value)}
              y2={y(refLine.value)}
              stroke={refLine.color ?? "#E8C547"}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              opacity={0.8}
            />
            <text x={W - PAD.r} y={y(refLine.value) - 4} textAnchor="end" fontSize={10} className="font-mono" fill={refLine.color ?? "#E8C547"}>
              {refLine.label}
            </text>
          </g>
        )}

        {series.map((s, i) => {
          const pts = s.values.map((v, idx) => ({ x: x(idx), y: y(v) }));
          const line = smoothPath(pts);
          return (
            <g key={s.name}>
              {fill && <path d={`${line} L${x(n - 1).toFixed(1)},${baseY} L${x(0).toFixed(1)},${baseY} Z`} fill={`url(#${gid}-g${i})`} />}
              <path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? "6 4" : undefined}
              />
              {showDots && pts.map((p, idx) => <circle key={idx} cx={p.x} cy={p.y} r={2.5} fill={s.color} />)}
            </g>
          );
        })}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={baseY} className="stroke-white/30" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke="#262A38" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
