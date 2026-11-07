"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle } from "@/types/economy";
import { px } from "@/lib/econ";

const PAD = { l: 8, r: 58, t: 12, b: 22 };
const UP = "#8FB3D9";
const DOWN = "#D99A9A";

/**
 * Bougies journalières (ouverture, plus haut, plus bas, clôture) et volume.
 * `refLine` : valeur des fondamentaux, en pointillés.
 */
export function Candles({ candles, height = 300, refLine }: { candles: Candle[]; height?: number; refLine?: { value: number; label: string } }) {
  const box = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // Largeur réelle du conteneur : les textes gardent leur taille, même sur téléphone.
  const [W, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(() => candles.map((c) => ({ ...c, o: Number(c.o), h: Number(c.h), l: Number(c.l), c: Number(c.c), v: Number(c.v) })), [candles]);

  const plotH = height - PAD.t - PAD.b;
  const priceH = plotH * 0.76;
  const volTop = PAD.t + priceH + plotH * 0.06;
  const volH = plotH - priceH - plotH * 0.06;
  const innerW = W - PAD.l - PAD.r;

  const geo = useMemo(() => {
    if (data.length === 0) return null;
    let lo = Math.min(...data.map((d) => d.l));
    let hi = Math.max(...data.map((d) => d.h));
    if (refLine && Number.isFinite(refLine.value) && refLine.value > 0) {
      // La ligne de référence n'écrase pas le graphique si elle est très loin.
      if (refLine.value < hi * 1.6 && refLine.value > lo * 0.6) {
        lo = Math.min(lo, refLine.value);
        hi = Math.max(hi, refLine.value);
      }
    }
    const pad = (hi - lo) * 0.08 || hi * 0.05 || 1;
    lo -= pad;
    hi += pad;
    const vmax = Math.max(...data.map((d) => d.v), 1);
    const step = innerW / Math.max(data.length, 8);
    const bw = Math.max(2, Math.min(14, step * 0.62));
    // Calées à droite : la dernière séance est au bord, même avec peu d'historique.
    const x = (i: number) => PAD.l + innerW - step * (data.length - i - 0.5);
    const y = (p: number) => PAD.t + ((hi - p) / (hi - lo)) * priceH;
    const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
    return { lo, hi, vmax, step, bw, x, y, ticks };
  }, [data, innerW, priceH, refLine]);
  const labelCount = W < 480 ? 4 : 6;
  const empty = !geo || data.length < 2;
  // Le conteneur change entre « pas assez de séances » et le graphique : on le réobserve.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [empty]);

  if (empty || !geo) {
    return (
      <div ref={wrap}>
        <p className="grid place-items-center rounded-lg border border-white/10 bg-black/10 font-body text-sm text-paper/60" style={{ height: height * 0.5 }}>Pas encore assez de séances pour tracer les bougies.</p>
      </div>
    );
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const vx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    let dist = Infinity;
    data.forEach((_, i) => {
      const d = Math.abs(geo.x(i) - vx);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  };

  const h = hover != null ? data[hover] : data[data.length - 1];
  const labelEvery = Math.ceil(data.length / labelCount);

  return (
    <div ref={wrap} className="relative">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-paper/70">
        <span>{new Date(h.day).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span>
        <span>O <b className="text-paper">{px(h.o)}</b></span>
        <span>H <b className="text-paper">{px(h.h)}</b></span>
        <span>B <b className="text-paper">{px(h.l)}</b></span>
        <span>C <b className={h.c >= h.o ? "text-blue-light" : "text-red"}>{px(h.c)}</b></span>
        <span>Vol. <b className="text-paper">{h.v.toLocaleString("fr-FR")}</b></span>
      </div>
      <svg
        ref={box}
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Bougies journalières : ${data.length} séances, dernière clôture ${px(data[data.length - 1].c)} z`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(t)} y2={geo.y(t)} stroke="rgba(255,255,255,0.07)" />
            <text x={W - PAD.r + 6} y={geo.y(t) + 3.5} fontSize="10.5" fill="rgba(237,230,211,0.55)" fontFamily="var(--font-mono)">{px(t)}</text>
          </g>
        ))}
        {refLine && refLine.value > geo.lo && refLine.value < geo.hi && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(refLine.value)} y2={geo.y(refLine.value)} stroke="#f0c27a" strokeDasharray="4 4" strokeOpacity="0.7" />
            <text x={PAD.l + 4} y={geo.y(refLine.value) - 4} fontSize="10" fill="#f0c27a" fillOpacity="0.85" fontFamily="var(--font-mono)">{refLine.label}</text>
          </g>
        )}
        {data.map((d, i) => {
          const up = d.c >= d.o;
          const col = up ? UP : DOWN;
          const x = geo.x(i);
          const top = geo.y(Math.max(d.o, d.c));
          const bot = geo.y(Math.min(d.o, d.c));
          const vh = (d.v / geo.vmax) * volH;
          return (
            <g key={d.day} opacity={hover == null || hover === i ? 1 : 0.55}>
              <line x1={x} x2={x} y1={geo.y(d.h)} y2={geo.y(d.l)} stroke={col} strokeWidth="1.4" />
              <rect x={x - geo.bw / 2} y={top} width={geo.bw} height={Math.max(1.2, bot - top)} fill={up ? "rgba(143,179,217,0.18)" : col} stroke={col} strokeWidth="1.2" rx="1" />
              <rect x={x - geo.bw / 2} y={volTop + volH - vh} width={geo.bw} height={Math.max(0.5, vh)} fill={col} opacity="0.35" />
              {i % labelEvery === 0 && (
                <text x={x} y={height - 6} fontSize="10" textAnchor={x - PAD.l < 20 ? "start" : "middle"} fill="rgba(237,230,211,0.5)" fontFamily="var(--font-mono)">
                  {new Date(d.day).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.l} x2={W - PAD.r} y1={volTop - 2} y2={volTop - 2} stroke="rgba(255,255,255,0.06)" />
        {hover != null && <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t} y2={volTop + volH} stroke="rgba(237,230,211,0.25)" strokeDasharray="2 3" />}
      </svg>
    </div>
  );
}
