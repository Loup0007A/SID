"use client";

import "./balance-effects.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { readOptions } from "@/lib/trollOptions";
import type { ActiveTroll } from "@/lib/titles";
import { VaryexisSign } from "@/components/seasonal/varyexisArt";

/* ---------------------------------------------------------------
   Balance de Varyexis (Enfant de l'Équilibre) : la page de la cible est
   posée sur la balance du monstre de l'Équilibre. Des étoiles tombent dans
   ses plateaux ; dès qu'elle penche, toute la page penche avec. La cible
   retire des étoiles (un clic sur un plateau) pour la rééquilibrer.
   --------------------------------------------------------------- */

const EVERY = [3600, 2200, 1200]; // ms entre deux étoiles, selon le rythme
const TILT = [1.5, 3, 5]; // degrés, selon le penchant
const PIVOT = { x: 130, y: 34 };
const ARM = 96;
const DROP = 56; // longueur des chaînes

type Side = "l" | "r";
type Fall = { id: number; side: Side; x: number; y: number; dx: number; dy: number; dur: number };
type Out = { id: number; x: number; y: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Bout du fléau (repère du dessin 260 × 180), selon l'angle en degrés. */
function end(side: Side, angle: number) {
  const a = (angle * Math.PI) / 180;
  const k = side === "l" ? -1 : 1;
  return { x: PIVOT.x + k * ARM * Math.cos(a), y: PIVOT.y + k * ARM * Math.sin(a) };
}

function StarGlyph({ x, y, r = 4.2 }: { x: number; y: number; r?: number }) {
  return <path className="vb-star" d={`M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`} />;
}

/** Le dessin de la balance (aussi utilisé par l'aperçu du panneau). */
export function BalanceArt({ left, right, angle, onPlate }: { left: number; right: number; angle: number; onPlate?: (s: Side) => void }) {
  const plates: [Side, number][] = [
    ["l", left],
    ["r", right],
  ];
  return (
    <svg viewBox="0 0 260 180" className="vb-art" aria-hidden={!onPlate}>
      <path className="vb-pillar" d="M130 34 L130 158 M104 166 L156 166 L148 158 L112 158 Z" />
      <circle className="vb-pivot" cx={PIVOT.x} cy={PIVOT.y} r="5" />
      <g className="vb-beam" style={{ transform: `rotate(${angle}deg)` }}>
        <path d={`M${PIVOT.x - ARM} ${PIVOT.y} L${PIVOT.x + ARM} ${PIVOT.y}`} />
        <circle cx={PIVOT.x - ARM} cy={PIVOT.y} r="3" />
        <circle cx={PIVOT.x + ARM} cy={PIVOT.y} r="3" />
      </g>
      <StarGlyph x={PIVOT.x} y={PIVOT.y - 14} r={6} />
      {plates.map(([side, n]) => {
        // Le plateau est dessiné à l'horizontale, puis déplacé (en douceur) au bout du fléau.
        const e = end(side, angle);
        const lx = PIVOT.x + (side === "l" ? -ARM : ARM);
        const ly = PIVOT.y;
        const py = ly + DROP;
        return (
          <g key={side} className="vb-plate-move" style={{ transform: `translate(${(e.x - lx).toFixed(2)}px, ${(e.y - ly).toFixed(2)}px)` }}>
            <g
              className={`vb-plate ${onPlate ? "is-clickable" : ""}`}
              onClick={onPlate ? () => onPlate(side) : undefined}
              role={onPlate ? "button" : undefined}
              aria-label={onPlate ? `Retirer une étoile du plateau ${side === "l" ? "de gauche" : "de droite"}` : undefined}
            >
              <path className="vb-chain" d={`M${lx} ${ly} L${lx - 26} ${py} M${lx} ${ly} L${lx + 26} ${py}`} />
              <path className="vb-dish" d={`M${lx - 32} ${py} Q${lx} ${py + 18} ${lx + 32} ${py} Z`} />
              {Array.from({ length: Math.min(n, 7) }, (_, i) => (
                <StarGlyph key={i} x={lx - 18 + (i % 4) * 12 + (i >= 4 ? 6 : 0)} y={py - 4 - (i >= 4 ? 9 : 0)} />
              ))}
              {n > 7 && (
                <text x={lx} y={py - 24} className="vb-count">
                  +{n - 7}
                </text>
              )}
              <rect x={lx - 40} y={ly - 4} width="80" height={DROP + 24} className="vb-hit" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function BalanceVaryexis({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("balance", troll.params, troll.level);
  const [w, setW] = useState({ l: 0, r: 0 });
  const [falls, setFalls] = useState<Fall[]>([]);
  const [outs, setOuts] = useState<Out[]>([]);
  const [tilt, setTilt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const lastTilt = useRef(0);
  const tiltTimer = useRef<ReturnType<typeof setTimeout>>();
  const seq = useRef(1);
  const reduce = useRef(false);
  const diff = w.r - w.l;
  const angle = clamp(diff * 4, -18, 18);
  angleRef.current = angle;

  // Où tombe une étoile : le plateau, dans l'écran.
  const plateOnScreen = useCallback((side: Side) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return null;
    const k = r.width / 260;
    const e = end(side, angleRef.current);
    return { x: r.left + e.x * k, y: r.top + (e.y + DROP - 6) * k };
  }, []);

  useEffect(() => {
    reduce.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const html = document.documentElement;
    html.classList.add("troll-balance");
    return () => {
      clearTimeout(tiltTimer.current);
      html.classList.remove("troll-balance", "troll-penche");
    };
  }, []);

  // Les étoiles tombent, de temps en temps (un peu au hasard).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const spawn = () => {
      if (!document.hidden) {
        const side: Side = Math.random() < 0.5 ? "l" : "r";
        const to = plateOnScreen(side);
        if (to) {
          const vw = window.innerWidth;
          const x = side === "l" ? rand(0.04, 0.46) * vw : rand(0.54, 0.96) * vw;
          const y = -24;
          setFalls((f) => [...f.slice(-14), { id: seq.current++, side, x, y, dx: to.x - x, dy: to.y - y, dur: rand(1.3, 2.1) }]);
        }
      }
      t = setTimeout(spawn, EVERY[o.rythme - 1] * rand(0.6, 1.4));
    };
    t = setTimeout(spawn, 1200);
    return () => clearTimeout(t);
  }, [o.rythme, plateOnScreen]);

  function land(f: Fall) {
    setFalls((l) => l.filter((x) => x.id !== f.id));
    setW((v) => ({ ...v, [f.side]: v[f.side] + 1 }));
  }

  function lighten(side: Side) {
    if (!w[side]) return;
    setW((v) => ({ ...v, [side]: Math.max(0, v[side] - 1) }));
    const at = plateOnScreen(side);
    if (at) {
      const id = seq.current++;
      setOuts((l) => [...l.slice(-6), { id, x: at.x, y: at.y }]);
      setTimeout(() => setOuts((l) => l.filter((x) => x.id !== id)), 1100);
    }
  }

  // Elle penche : la page penche avec elle (par à-coups, pas en continu).
  useEffect(() => {
    if (reduce.current || Math.abs(diff) < 3) return;
    const now = Date.now();
    if (now - lastTilt.current < 6000) return;
    lastTilt.current = now;
    const deg = Math.sign(diff) * TILT[o.penchant - 1] * Math.min(1, 0.5 + Math.abs(diff) / 8);
    setTilt(deg);
    const html = document.documentElement;
    html.style.setProperty("--vb-tilt", `${deg.toFixed(2)}deg`);
    html.classList.add("troll-penche");
    clearTimeout(tiltTimer.current);
    tiltTimer.current = setTimeout(() => {
      html.classList.remove("troll-penche");
      setTilt(0);
    }, 2200);
  }, [diff, o.penchant]);

  return (
    <div data-troll-ui className="vb-root">
      <div className="vb-night" aria-hidden />
      {o.constellation && <VaryexisSign className="vb-sign" />}
      {falls.map((f) => (
        <span
          key={f.id}
          className="vb-fall"
          style={{ left: f.x, top: f.y, "--dx": `${f.dx.toFixed(0)}px`, "--dy": `${f.dy.toFixed(0)}px`, animationDuration: `${f.dur.toFixed(2)}s` } as React.CSSProperties}
          onAnimationEnd={(e) => e.target === e.currentTarget && land(f)}
          aria-hidden
        >
          <i />
        </span>
      ))}
      {outs.map((s) => (
        <span key={s.id} className="vb-out" style={{ left: s.x, top: s.y }} aria-hidden>
          <i />
        </span>
      ))}
      <div ref={box} className={`vb-balance ${tilt ? "is-creak" : ""}`}>
        <BalanceArt left={w.l} right={w.r} angle={angle} onPlate={lighten} />
        <p className="vb-caption">
          {Math.abs(diff) >= 3 ? "Elle penche ! Retire des étoiles du plateau le plus lourd." : "La balance de Varyexis"}
        </p>
        {o.message && <p className="vb-msg">« {o.message} »</p>}
      </div>
    </div>
  );
}
