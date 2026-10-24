import "./varyexis.css";
import { useId, useMemo } from "react";

/**
 * Le signe de Varyexis, le monstre de l'Équilibre (Lot 47) : une balance qui
 * porte le monde, sous une couronne d'étoiles, tracée en constellation.
 * Partagé par le ciel du titre « Enfant de l'Équilibre », la farce « Balance
 * de Varyexis » et son aperçu.
 *
 * Pour redessiner le signe : changer STARS (x, y, rayon dans un carré de
 * 400 × 400) et LINES (paires d'étoiles reliées).
 */

export const STARS: Record<string, [number, number, number]> = {
  // couronne
  c0: [200, 34, 4.2], c1: [168, 58, 2.6], c2: [232, 58, 2.6], c3: [140, 46, 1.6], c4: [260, 46, 1.6],
  // axe et fléau
  a1: [200, 80, 2.2],
  b0: [78, 108, 3], b1: [139, 104, 2], b2: [200, 100, 3.2], b3: [261, 104, 2], b4: [322, 108, 3],
  // plateaux
  l0: [52, 214, 2.4], l1: [78, 224, 2.8], l2: [104, 214, 2.4],
  r0: [296, 214, 2.4], r1: [322, 224, 2.8], r2: [348, 214, 2.4],
  // le monde
  w0: [200, 132, 2.4], w1: [240, 155, 2], w2: [240, 201, 2], w3: [200, 224, 2.4], w4: [160, 201, 2], w5: [160, 155, 2],
  // le socle
  f0: [200, 270, 2.2], f2: [200, 300, 1.8], f1: [162, 318, 2.6], f3: [238, 318, 2.6],
};

export const LINES: [string, string][] = [
  ["c3", "c1"], ["c1", "c0"], ["c0", "c2"], ["c2", "c4"],
  ["c0", "a1"], ["a1", "b2"],
  ["b0", "b1"], ["b1", "b2"], ["b2", "b3"], ["b3", "b4"],
  ["b0", "l0"], ["b0", "l2"], ["b4", "r0"], ["b4", "r2"],
  ["l0", "l1"], ["l1", "l2"], ["r0", "r1"], ["r1", "r2"],
  ["b2", "w0"], ["w0", "w1"], ["w1", "w2"], ["w2", "w3"], ["w3", "w4"], ["w4", "w5"], ["w5", "w0"],
  ["w3", "f0"], ["f0", "f2"], ["f2", "f1"], ["f2", "f3"],
];

/** L'œil de l'Équilibre, au centre du monde. */
export const EYE: [number, number] = [200, 178];

export function VaryexisSign({ className = "", draw = false, lit = false }: { className?: string; draw?: boolean; lit?: boolean }) {
  const halo = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-halo`;
  return (
    <svg viewBox="0 0 400 360" className={`vx-sign ${draw ? "is-draw" : ""} ${lit ? "is-lit" : ""} ${className}`} aria-hidden>
      <defs>
        <radialGradient id={halo}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#bcd0ff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#7d8cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="vx-world-glow" cx={EYE[0]} cy={EYE[1]} r="58" />
      <g className="vx-lines">
        {LINES.map(([a, b], i) => (
          <line
            key={i}
            x1={STARS[a][0]}
            y1={STARS[a][1]}
            x2={STARS[b][0]}
            y2={STARS[b][1]}
            pathLength={1}
            style={{ animationDelay: `${(0.6 + i * 0.09).toFixed(2)}s` }}
          />
        ))}
      </g>
      <g className="vx-stars">
        {Object.entries(STARS).map(([k, [x, y, r]], i) => (
          <g key={k} className="vx-star" style={{ animationDelay: `${(i * 0.07).toFixed(2)}s` }}>
            <circle className="vx-star-halo" cx={x} cy={y} r={r * 4} fill={`url(#${halo})`} />
            <circle className="vx-star-core" cx={x} cy={y} r={r} style={{ animationDelay: `${(-(i * 0.37) % 4).toFixed(2)}s` }} />
          </g>
        ))}
      </g>
      <g className="vx-eye">
        <circle cx={EYE[0]} cy={EYE[1]} r="22" fill={`url(#${halo})`} />
        <path d={`M${EYE[0] - 12} ${EYE[1]} Q${EYE[0]} ${EYE[1] - 8} ${EYE[0] + 12} ${EYE[1]} Q${EYE[0]} ${EYE[1] + 8} ${EYE[0] - 12} ${EYE[1]} Z`} className="vx-eye-lid" />
        <circle cx={EYE[0]} cy={EYE[1]} r="3.4" className="vx-eye-core" />
      </g>
    </svg>
  );
}

// Hasard reproductible (mêmes étoiles à chaque affichage).
function rnd(i: number, k: number) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Un ciel entier : étoiles (trois scintillements), voie lactée, nébuleuses. */
export function StarField({ count = 260, className = "" }: { count?: number; className?: string }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: rnd(i, 1) * 1600,
        y: rnd(i, 2) * 1000,
        r: rnd(i, 3) < 0.92 ? 0.5 + rnd(i, 4) * 0.9 : 1.4 + rnd(i, 5) * 1.2,
        g: i % 3,
        warm: rnd(i, 6) > 0.82,
      })),
    [count]
  );
  return (
    <div className={`vx-field ${className}`} aria-hidden>
      <div className="vx-nebula" />
      <div className="vx-milky" />
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" className="vx-field-stars">
        {[0, 1, 2].map((g) => (
          <g key={g} className={`vx-tw vx-tw${g}`}>
            {stars
              .filter((s) => s.g === g)
              .map((s, i) => (
                <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} className={s.warm ? "is-warm" : ""} />
              ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
