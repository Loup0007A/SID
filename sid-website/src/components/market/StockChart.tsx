"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { px } from "@/lib/econ";

/**
 * Graphique de cours façon site boursier (Lot 73) : périodes 1J à MAX,
 * ligne ou bougies, axe des prix à droite avec le dernier cours, ligne de
 * référence, volumes, réticule au survol. Données : market_chart (0090).
 */

export const UP = "#26a69a";
export const DOWN = "#ef5350";

type Range = "1J" | "5J" | "1M" | "6M" | "1A" | "MAX";
const RANGES: Range[] = ["1J", "5J", "1M", "6M", "1A", "MAX"];
const RANGE_LABEL: Record<Range, string> = { "1J": "aujourd'hui", "5J": "sur 5 jours", "1M": "sur 1 mois", "6M": "sur 6 mois", "1A": "sur 1 an", MAX: "depuis le début" };

type Point = { t: string; o?: number; h?: number; l?: number; c: number; v?: number };
type Chart = {
  range: Range;
  daily: boolean;
  from: string | null;
  to: string | null;
  now: string;
  bucket_minutes?: number;
  points: Point[];
  base: number | null;
  prev_close?: number | null;
  price?: number;
};

const PAD0 = { l: 8, t: 14, b: 26 };

/** Graduations « rondes » : 1, 2, 2,5 ou 5 × 10^n. */
function niceTicks(lo: number, hi: number, count = 5) {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

const pctTxt = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const absTxt = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${px(Math.abs(x))}`;

export function StockChart({ businessId, index = false, height = 340, defaultRange = "1M" }: { businessId?: string; index?: boolean; height?: number; defaultRange?: Range }) {
  const supabase = useMemo(() => createClient(), []);
  const [range, setRange] = useState<Range>(defaultRange);
  const [mode, setMode] = useState<"ligne" | "bougies">("ligne");
  const [chart, setChart] = useState<Chart | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const [W, setW] = useState(720);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = index ? await supabase.rpc("market_index_chart", { p_range: range }) : await supabase.rpc("market_chart", { p_business: businessId, p_range: range });
    setChart((data ?? null) as Chart | null);
    setLoading(false);
  }, [supabase, businessId, index, range]);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = useMemo(
    () =>
      (chart?.points ?? []).map((p) => ({
        t: new Date(p.t).getTime(),
        o: Number(p.o ?? p.c),
        h: Number(p.h ?? p.c),
        l: Number(p.l ?? p.c),
        c: Number(p.c),
        v: Number(p.v ?? 0),
      })),
    [chart]
  );

  // Marge droite à la largeur des prix affichés sur l'axe.
  const widest = Math.max(1, ...pts.map((p) => p.h), Number(chart?.price ?? 0), Number(chart?.base ?? 0));
  const PAD = { ...PAD0, r: Math.max(58, Math.round(18 + 7 * px(widest * 1.1).length)) };
  const showVol = !index && pts.some((p) => p.v > 0);
  const plotH = height - PAD.t - PAD.b;
  const priceH = showVol ? plotH * 0.8 : plotH;
  const volTop = PAD.t + priceH + 6;
  const volH = plotH - priceH - 6;
  const innerW = W - PAD.l - PAD.r;
  const candles = mode === "bougies" && !index;

  const geo = useMemo(() => {
    if (!chart) return null;
    const base = chart.base != null ? Number(chart.base) : pts[0]?.o ?? Number(chart.price ?? 0);
    const last = pts.length ? pts[pts.length - 1].c : Number(chart.price ?? base);
    const vals = pts.flatMap((p) => (candles ? [p.h, p.l] : [p.c]));
    if (base) vals.push(base);
    if (!vals.length) vals.push(last || 1);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const pad = (hi - lo) * 0.1 || hi * 0.02 || 1;
    lo -= pad;
    hi += pad;
    const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * priceH;

    // Axe du temps : proportionnel en séance, un pas par jour sinon.
    const bucket = (chart.bucket_minutes ?? 1440) * 60_000;
    let x: (i: number) => number;
    let step: number;
    if (!chart.daily && chart.from && chart.to) {
      const t0 = new Date(chart.from).getTime();
      const t1 = new Date(chart.to).getTime();
      const tx = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * innerW;
      x = (i: number) => tx(pts[i].t + bucket / 2);
      step = (bucket / (t1 - t0)) * innerW;
      return { lo, hi, y, x, tx, step, base, last, t0, t1, bucket };
    }
    step = innerW / Math.max(pts.length, 1);
    x = (i: number) => PAD.l + step * (i + 0.5);
    return { lo, hi, y, x, tx: null as null | ((t: number) => number), step, base, last, t0: 0, t1: 0, bucket };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, pts, candles, priceH, innerW, PAD.r]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo || !pts.length) return;
    const r = svg.current?.getBoundingClientRect();
    if (!r) return;
    const vx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    let d = Infinity;
    pts.forEach((_, i) => {
      const dd = Math.abs(geo.x(i) - vx);
      if (dd < d) {
        d = dd;
        best = i;
      }
    });
    setHover(best);
  };

  // En-tête : cours survolé ou dernier cours, variation sur la période.
  const shown = hover != null ? pts[hover] : null;
  const cur = shown ? shown.c : geo?.last ?? 0;
  const ref = geo?.base ?? 0;
  const diff = ref ? cur - ref : 0;
  const up = diff >= 0;
  const color = up ? UP : DOWN;
  const when = (t: number) =>
    chart?.daily
      ? new Date(t).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: range === "MAX" || range === "1A" ? "numeric" : undefined })
      : new Date(t).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  // Libellés du temps.
  const xLabels = useMemo(() => {
    if (!geo || !chart) return [] as { x: number; text: string }[];
    const out: { x: number; text: string }[] = [];
    if (!chart.daily && geo.tx) {
      const t0 = geo.t0;
      const t1 = geo.t1;
      if (range === "1J") {
        for (let h = 0; h <= 24; h += W < 520 ? 6 : 3) {
          const t = t0 + h * 3_600_000;
          out.push({ x: geo.tx(t), text: `${String(h % 24).padStart(2, "0")}:00` });
        }
      } else {
        const dayMs = 86_400_000;
        const every = range === "5J" ? 1 : W < 520 ? 10 : 5;
        const start = new Date(t0);
        start.setHours(24, 0, 0, 0);
        for (let t = start.getTime(), i = 0; t < t1; t += dayMs, i++) {
          if (i % every) continue;
          out.push({
            x: geo.tx(t),
            text: range === "5J" ? new Date(t).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }) : new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
          });
        }
      }
    } else {
      const n = pts.length;
      const maxLabels = W < 520 ? 4 : 7;
      const every = Math.max(1, Math.ceil(n / maxLabels));
      pts.forEach((p, i) => {
        if (i % every === 0)
          out.push({
            x: geo.x(i),
            text: new Date(p.t).toLocaleDateString("fr-FR", range === "MAX" || range === "1A" ? { month: "short", year: "2-digit" } : { day: "2-digit", month: "2-digit" }),
          });
      });
    }
    return out.filter((l) => l.x >= PAD.l && l.x <= W - PAD.r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, chart, pts, range, W, PAD.r]);

  const linePath = useMemo(() => {
    if (!geo || pts.length === 0) return "";
    return pts.map((p, i) => `${i ? "L" : "M"}${geo.x(i).toFixed(1)},${geo.y(p.c).toFixed(1)}`).join(" ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, pts]);
  const areaPath = linePath && geo ? `${linePath} L${geo.x(pts.length - 1).toFixed(1)},${(PAD.t + priceH).toFixed(1)} L${geo.x(0).toFixed(1)},${(PAD.t + priceH).toFixed(1)} Z` : "";
  const vmax = Math.max(1, ...pts.map((p) => p.v));
  const gid = `g-${businessId ?? "idx"}-${up ? "u" : "d"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-paper/55">{shown ? when(shown.t) : `Variation ${RANGE_LABEL[range]}`}</p>
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-display text-3xl text-paper" style={{ fontVariantNumeric: "tabular-nums" }}>
              {px(cur)}
              {!index && <span className="ml-1 text-base text-paper/55">z</span>}
            </span>
            {ref > 0 && (
              <span className="font-mono text-sm" style={{ color, fontVariantNumeric: "tabular-nums" }}>
                {absTxt(diff)} ({pctTxt(diff / ref)})
              </span>
            )}
          </p>
          {shown && candles && (
            <p className="font-mono text-[11px] text-paper/65" style={{ fontVariantNumeric: "tabular-nums" }}>
              O {px(shown.o)} · H {px(shown.h)} · B {px(shown.l)} · C {px(shown.c)}
              {shown.v > 0 && ` · Vol. ${shown.v.toLocaleString("fr-FR")}`}
            </p>
          )}
          {shown && !candles && shown.v > 0 && <p className="font-mono text-[11px] text-paper/65">Volume {shown.v.toLocaleString("fr-FR")}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/12 p-0.5" role="tablist" aria-label="Période">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={range === r}
                onClick={() => {
                  setHover(null);
                  setRange(r);
                }}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] ${range === r ? "bg-white/15 text-paper" : "text-paper/55 hover:text-paper"}`}
              >
                {r}
              </button>
            ))}
          </div>
          {!index && (
            <div className="flex rounded-lg border border-white/12 p-0.5" aria-label="Type de graphique">
              {(["ligne", "bougies"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  title={m === "ligne" ? "Ligne" : "Bougies"}
                  className={`rounded-md px-2 py-1 ${mode === m ? "bg-white/15 text-paper" : "text-paper/55 hover:text-paper"}`}
                >
                  {m === "ligne" ? (
                    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden>
                      <path d="M1 11 L5 6 L8 8 L15 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden>
                      <path d="M4 1v12M12 2v10" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="2" y="4" width="4" height="6" fill="currentColor" />
                      <rect x="10" y="4" width="4" height="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  )}
                  <span className="sr-only">{m}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={wrap} className="relative">
        {!geo ? (
          <div className="grid place-items-center rounded-lg border border-white/10 font-body text-sm text-paper/55" style={{ height }}>
            {loading ? "Chargement…" : "Graphique indisponible."}
          </div>
        ) : (
          <svg
            ref={svg}
            viewBox={`0 0 ${W} ${height}`}
            width={W}
            height={height}
            className="block touch-none select-none"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label={`Cours ${RANGE_LABEL[range]} : ${px(geo.last)}, ${pctTxt(ref ? diff / ref : 0)}`}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grille et axe des prix */}
            {niceTicks(geo.lo, geo.hi, Math.max(3, Math.round(priceH / 55))).map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(t)} y2={geo.y(t)} stroke="rgba(255,255,255,0.06)" />
                {/* Pas de graduation sous l'étiquette du dernier cours ou de la référence. */}
                {Math.abs(geo.y(t) - geo.y(geo.last)) > 14 &&
                  !(geo.base > 0 && Math.abs(geo.y(geo.base) - geo.y(geo.last)) > 18 && Math.abs(geo.y(t) - geo.y(geo.base)) <= 14) && (
                    <text x={W - PAD.r + 8} y={geo.y(t) + 3.5} fontSize="11" fill="rgba(237,230,211,0.5)" fontFamily="var(--font-mono)">
                      {px(t)}
                    </text>
                  )}
              </g>
            ))}
            <line x1={W - PAD.r} x2={W - PAD.r} y1={PAD.t} y2={PAD.t + plotH} stroke="rgba(255,255,255,0.08)" />

            {/* Libellés du temps */}
            {xLabels.map((l) => (
              <g key={`${l.x}-${l.text}`}>
                <line x1={l.x} x2={l.x} y1={PAD.t} y2={PAD.t + plotH} stroke="rgba(255,255,255,0.035)" />
                <text x={l.x} y={height - 8} fontSize="10.5" textAnchor="middle" fill="rgba(237,230,211,0.5)" fontFamily="var(--font-mono)">
                  {l.text}
                </text>
              </g>
            ))}

            {/* Référence : clôture de la veille ou début de période */}
            {geo.base > 0 && (
              <g>
                <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(geo.base)} y2={geo.y(geo.base)} stroke="rgba(237,230,211,0.4)" strokeDasharray="2 4" />
                <text x={W - PAD.r - 6} y={geo.y(geo.base) + (geo.y(geo.base) > PAD.t + 16 ? -5 : 13)} textAnchor="end" fontSize="10" fill="rgba(237,230,211,0.5)" fontFamily="var(--font-mono)">
                  {range === "1J" ? "clôture veille" : "début de période"}
                </text>
                {Math.abs(geo.y(geo.base) - geo.y(geo.last)) > 18 && (
                  <>
                    <rect x={W - PAD.r + 2} y={geo.y(geo.base) - 9} width={PAD.r - 4} height="18" rx="3" fill="rgba(237,230,211,0.14)" />
                    <text x={W - PAD.r + 8} y={geo.y(geo.base) + 4} fontSize="11" fill="rgba(237,230,211,0.75)" fontFamily="var(--font-mono)">
                      {px(geo.base)}
                    </text>
                  </>
                )}
              </g>
            )}

            {/* Volumes */}
            {showVol &&
              pts.map((p, i) => {
                const h = (p.v / vmax) * volH;
                const w = Math.max(1, Math.min(geo.step * 0.7, 14));
                return <rect key={`v${p.t}`} x={geo.x(i) - w / 2} y={volTop + volH - h} width={w} height={Math.max(0.5, h)} fill={p.c >= p.o ? UP : DOWN} opacity={hover === i ? 0.7 : 0.35} />;
              })}

            {pts.length === 0 ? (
              <text x={PAD.l + innerW / 2} y={PAD.t + priceH / 2} textAnchor="middle" fontSize="13" fill="rgba(237,230,211,0.55)" fontFamily="var(--font-body)">
                Aucun échange sur cette période.
              </text>
            ) : candles ? (
              pts.map((p, i) => {
                const c = p.c >= p.o ? UP : DOWN;
                const w = Math.max(1.5, Math.min(geo.step * 0.7, 16));
                const top = geo.y(Math.max(p.o, p.c));
                const bot = geo.y(Math.min(p.o, p.c));
                return (
                  <g key={`c${p.t}`} opacity={hover == null || hover === i ? 1 : 0.75}>
                    <line x1={geo.x(i)} x2={geo.x(i)} y1={geo.y(p.h)} y2={geo.y(p.l)} stroke={c} strokeWidth="1.2" />
                    <rect x={geo.x(i) - w / 2} y={top} width={w} height={Math.max(1, bot - top)} fill={c} />
                  </g>
                );
              })
            ) : (
              <g>
                <path d={areaPath} fill={`url(#${gid})`} />
                <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
                {pts.length === 1 && <circle cx={geo.x(0)} cy={geo.y(pts[0].c)} r="3" fill={color} />}
              </g>
            )}

            {/* Dernier cours : étiquette sur l'axe */}
            {pts.length > 0 && (
              <g>
                <line x1={geo.x(pts.length - 1)} x2={W - PAD.r} y1={geo.y(geo.last)} y2={geo.y(geo.last)} stroke={color} strokeDasharray="1 3" opacity="0.8" />
                {!candles && <circle cx={geo.x(pts.length - 1)} cy={geo.y(geo.last)} r="3.2" fill={color} stroke="#1e2130" strokeWidth="1.5" />}
                <rect x={W - PAD.r + 2} y={geo.y(geo.last) - 9} width={PAD.r - 4} height="18" rx="3" fill={color} />
                <text x={W - PAD.r + 8} y={geo.y(geo.last) + 4} fontSize="11" fontWeight="600" fill="#0f1117" fontFamily="var(--font-mono)">
                  {px(geo.last)}
                </text>
              </g>
            )}

            {/* Réticule */}
            {hover != null && pts[hover] && (
              <g pointerEvents="none">
                <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t} y2={PAD.t + plotH} stroke="rgba(237,230,211,0.35)" strokeDasharray="3 3" />
                <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(pts[hover].c)} y2={geo.y(pts[hover].c)} stroke="rgba(237,230,211,0.35)" strokeDasharray="3 3" />
                <circle cx={geo.x(hover)} cy={geo.y(pts[hover].c)} r="4" fill={color} stroke="#fff" strokeWidth="1.2" />
                <rect x={W - PAD.r + 2} y={geo.y(pts[hover].c) - 9} width={PAD.r - 4} height="18" rx="3" fill="#3a3f55" />
                <text x={W - PAD.r + 8} y={geo.y(pts[hover].c) + 4} fontSize="11" fill="#ede6d3" fontFamily="var(--font-mono)">
                  {px(pts[hover].c)}
                </text>
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
