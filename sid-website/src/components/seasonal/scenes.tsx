import "./scenes.css";
import type { ReactNode } from "react";
import { Daisy, Tulip } from "./drawings";

/**
 * Paysages des fêtes (Lot 48) : un vrai décor en plusieurs plans derrière le
 * contenu du Dossier Central, comme celui de la Grande Chasse. Chaque scène
 * est un seul dessin SVG (repère 1600 × 400, ancré en bas, rogné sur les
 * côtés) et quelques calques animés en CSS (seuls des déplacements et des
 * opacités bougent). Chargé seulement quand la fête est affichée.
 */

export type SceneKind =
  | "halloween"
  | "noel"
  | "saint_valentin"
  | "poisson_avril"
  | "paques"
  | "premier_mai"
  | "fete_musique"
  | "quatorze_juillet"
  | "armistice";

/* ---------------------------------------------------------------
   Outils de dessin
   --------------------------------------------------------------- */

const W = 1600;
const H = 400;

// Pseudo-hasard stable (même rendu à chaque affichage).
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const f = (n: number) => n.toFixed(1);

type Pt = [number, number];

/** Ligne de crête lissée (Catmull-Rom) fermée vers le bas. */
function smooth(pts: Pt[], bottom = H): string {
  let d = `M${f(pts[0][0])} ${bottom} L${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} L${f(pts[pts.length - 1][0])} ${bottom} Z`;
}

/** Collines douces : hauteur de base, amplitude, graine. */
function hills(base: number, amp: number, seed: number, n = 14): string {
  const pts: Pt[] = Array.from({ length: n + 1 }, (_, i) => [
    (i / n) * W,
    base - amp * (0.5 + 0.35 * Math.sin(i * 1.3 + seed) + 0.15 * Math.sin(i * 2.9 + seed * 1.7)),
  ]);
  return smooth(pts);
}

/** Point de la crête produite par hills() (approché), pour y poser des objets. */
function hillY(base: number, amp: number, seed: number, x: number, n = 14) {
  const t = (x / W) * n;
  const i = Math.floor(t);
  const y = (k: number) => base - amp * (0.5 + 0.35 * Math.sin(k * 1.3 + seed) + 0.15 * Math.sin(k * 2.9 + seed * 1.7));
  return y(i) + (y(i + 1) - y(i)) * (t - i);
}

/** Sapin en trois étages, pied en (x, y). */
function fir(x: number, y: number, h: number) {
  const w = h * 0.42;
  return `M${f(x)} ${f(y - h)} L${f(x + w * 0.45)} ${f(y - h * 0.62)} L${f(x + w * 0.25)} ${f(y - h * 0.62)} L${f(x + w * 0.75)} ${f(y - h * 0.3)} L${f(x + w * 0.5)} ${f(y - h * 0.3)} L${f(x + w)} ${f(y)} L${f(x - w)} ${f(y)} L${f(x - w * 0.5)} ${f(y - h * 0.3)} L${f(x - w * 0.75)} ${f(y - h * 0.3)} L${f(x - w * 0.25)} ${f(y - h * 0.62)} L${f(x - w * 0.45)} ${f(y - h * 0.62)} Z`;
}

type Win = { x: number; y: number; w: number; h: number; on: boolean; blink: boolean };

/**
 * Rangée d'immeubles (toits à la Mansart, cheminées) entre x0 et x1, posée sur
 * baseY. Rend le contour et la liste des fenêtres.
 */
function city(x0: number, x1: number, baseY: number, seed: number, minH: number, maxH: number, litRate = 0.45) {
  let d = "";
  const wins: Win[] = [];
  let x = x0;
  let i = 0;
  while (x < x1) {
    const w = 46 + rnd(i, seed) * 54;
    const h = minH + rnd(i, seed + 1) * (maxH - minH);
    const top = baseY - h;
    const roof = 10 + rnd(i, seed + 2) * 10;
    d += `M${f(x)} ${baseY} L${f(x)} ${f(top)} L${f(x + 5)} ${f(top - roof)} L${f(x + w - 5)} ${f(top - roof)} L${f(x + w)} ${f(top)} L${f(x + w)} ${baseY} Z `;
    // Cheminées
    const nc = 1 + Math.floor(rnd(i, seed + 3) * 3);
    for (let c = 0; c < nc; c++) {
      const cx = x + 8 + rnd(i * 7 + c, seed + 4) * (w - 20);
      d += `M${f(cx)} ${f(top - roof + 1)} L${f(cx)} ${f(top - roof - 9)} L${f(cx + 7)} ${f(top - roof - 9)} L${f(cx + 7)} ${f(top - roof + 1)} Z `;
    }
    // Fenêtres
    const cols = Math.max(2, Math.floor((w - 10) / 13));
    const rows = Math.max(1, Math.floor((h - 12) / 18));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const k = i * 131 + r * 17 + c;
        wins.push({ x: x + 7 + c * ((w - 14) / cols) + 1, y: top + 8 + r * 18, w: 6, h: 9, on: rnd(k, seed + 5) < litRate, blink: rnd(k, seed + 6) < 0.06 });
      }
    x += w + (rnd(i, seed + 7) < 0.3 ? 4 : 0);
    i++;
  }
  return { d, wins };
}

function Windows({ wins, className = "sc-win" }: { wins: Win[]; className?: string }) {
  return (
    <g className={className}>
      {wins
        .filter((w) => w.on)
        .map((w, i) => (
          <rect key={i} x={f(w.x)} y={f(w.y)} width={w.w} height={w.h} rx="1" className={w.blink ? "is-blink" : ""} style={w.blink ? { animationDelay: `${(i % 7) * 1.3}s` } : undefined} />
        ))}
    </g>
  );
}

function Land({ kind, children }: { kind: SceneKind; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className={`sc-land sc-${kind}`} aria-hidden>
      {children}
    </svg>
  );
}

/** Ciel étoilé discret (une tuile répétée, en CSS). */
export function Stars({ className = "" }: { className?: string }) {
  return <div className={`sc-stars ${className}`} aria-hidden />;
}

/* ---------------------------------------------------------------
   Halloween : manoir hanté, cimetière, citrouilles, feux follets
   --------------------------------------------------------------- */

function Pumpkin({ x, y, s, i }: { x: number; y: number; s: number; i: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className="hs-pumpkin">
      <ellipse cx="0" cy="-15" rx="23" ry="16" className="hs-pk" />
      <path className="hs-pk-rib" d="M0 -31 C-6 -22 -6 -8 0 1 M0 -31 C6 -22 6 -8 0 1 M-12 -29 C-20 -20 -19 -8 -11 0 M12 -29 C20 -20 19 -8 11 0" />
      <path className="hs-pk-stem" d="M-2 -30 C-2 -36 0 -40 4 -41 L5 -38 C2 -37 2 -34 2 -30 Z" />
      <path className="hs-pk-face" style={{ animationDelay: `${i * 0.7}s` }} d="M-12 -20 L-5 -24 L-5 -17 Z M12 -20 L5 -24 L5 -17 Z M-13 -10 Q0 -1 13 -10 L9 -9 L7 -6 L3 -8 L0 -5 L-3 -8 L-7 -6 L-9 -9 Z" />
    </g>
  );
}

function Manor() {
  // Pied du manoir en (0, 0), il monte vers les y négatifs.
  const body =
    "M-40 0 L-40 -150 L-46 -150 L-20 -212 L6 -150 L0 -150 L0 -96 L8 -96 L74 -142 L140 -96 L150 -96 L150 -122 L144 -122 L168 -176 L192 -122 L186 -122 L186 0 Z " +
    "M100 -128 L100 -150 L112 -150 L112 -120 Z M-20 -212 L-20 -226 M168 -176 L168 -188";
  const lit = [
    [-28, -132, 0], [-28, -100, 1], [-28, -66, 0], [16, -78, 1], [42, -78, 0], [96, -78, 1], [122, -78, 0], [16, -42, 0], [122, -42, 1], [158, -104, 0], [158, -70, 1],
  ];
  return (
    <g transform="translate(1420 236)">
      <path className="hs-manor" d={body} />
      <path className="hs-manor-line" d="M-20 -212 L-20 -228 M168 -176 L168 -190" />
      {lit.map(([x, y, b], i) => (
        <rect key={i} x={x} y={y} width="12" height="18" rx="6" className={`hs-win ${b ? "is-flicker" : ""}`} style={{ animationDelay: `${i * 0.9}s` }} />
      ))}
      <path className="hs-door" d="M60 0 L60 -26 Q69 -38 78 -26 L78 0 Z" />
      <circle cx="69" cy="-118" r="9" className="hs-win is-flicker" style={{ animationDelay: "2.2s" }} />
    </g>
  );
}

export function HalloweenScene() {
  const stones: [number, number, number][] = [[250, 0, -7], [300, 1, 5], [360, 2, -3], [1160, 1, 6], [1210, 0, -5], [1520, 2, 4]];
  return (
    <>
      <Stars className="sc-stars-violet" />
      <Land kind="halloween">
        <path className="hs-far" d={hills(250, 80, 1.3)} />
        <path className="hs-hill-manor" d="M1160 400 L1160 310 C1240 262 1320 238 1400 236 C1480 234 1560 236 1600 244 L1600 400 Z" />
        <Manor />
        <path className="hs-mid" d={hills(318, 50, 4.1)} />
        {/* Arbre mort */}
        <path
          className="hs-tree"
          d="M150 330 C154 296 150 268 140 244 C132 224 118 214 102 206 M140 244 C150 226 166 216 186 212 M146 286 C164 270 186 262 206 248 C220 238 228 224 230 208 M186 262 C200 266 214 266 228 260 M144 270 C128 262 114 258 96 260 M160 330 C158 312 164 296 174 284"
        />
        <path className="hs-noose" d="M206 248 L206 270" />
        {/* Tombes et grille */}
        <g className="hs-stones">
          {stones.map(([x, k, rot], i) => {
            const y = hillY(318, 50, 4.1, x) + 4;
            const shape =
              k === 0
                ? `M${x - 10} ${y} L${x - 10} ${y - 24} Q${x} ${y - 38} ${x + 10} ${y - 24} L${x + 10} ${y} Z`
                : k === 1
                  ? `M${x - 3} ${y} L${x - 3} ${y - 18} L${x - 11} ${y - 18} L${x - 11} ${y - 25} L${x - 3} ${y - 25} L${x - 3} ${y - 34} L${x + 3} ${y - 34} L${x + 3} ${y - 25} L${x + 11} ${y - 25} L${x + 11} ${y - 18} L${x + 3} ${y - 18} L${x + 3} ${y} Z`
                  : `M${x - 8} ${y} L${x - 8} ${y - 20} L${x + 8} ${y - 20} L${x + 8} ${y} Z`;
            return <path key={i} d={shape} transform={`rotate(${rot} ${x} ${y})`} />;
          })}
        </g>
        <g className="hs-fence">
          {Array.from({ length: 22 }, (_, i) => {
            const x = 1150 + i * 15;
            const y = hillY(318, 50, 4.1, x) + 6;
            return <path key={i} d={`M${x} ${y} L${x} ${y - 30} M${x - 3} ${y - 26} L${x} ${y - 34} L${x + 3} ${y - 26}`} />;
          })}
          <path d={`M1150 ${hillY(318, 50, 4.1, 1150) - 16} L1465 ${hillY(318, 50, 4.1, 1465) - 16} M1150 ${hillY(318, 50, 4.1, 1150) - 4} L1465 ${hillY(318, 50, 4.1, 1465) - 4}`} />
        </g>
        <path className="hs-near" d={hills(368, 22, 2.2)} />
        {Array.from({ length: 70 }, (_, i) => {
          const x = rnd(i, 1) * W;
          const y = hillY(368, 22, 2.2, x) + 3;
          const h = 8 + rnd(i, 2) * 14;
          return <path key={i} className="hs-grass" d={`M${f(x)} ${f(y)} Q${f(x + 2)} ${f(y - h / 2)} ${f(x + 4 - rnd(i, 3) * 8)} ${f(y - h)}`} />;
        })}
        {[
          [110, 1.1],
          [190, 0.8],
          [1430, 1.25],
          [1515, 0.85],
          [760, 0.7],
        ].map(([x, s], i) => (
          <Pumpkin key={i} x={x} y={hillY(368, 22, 2.2, x) + 6} s={s} i={i} />
        ))}
      </Land>
      <div className="hs-wisps" aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} style={{ left: `${(6 + rnd(i, 4) * 88).toFixed(1)}%`, bottom: `${(6 + rnd(i, 5) * 22).toFixed(1)}%`, animationDelay: `${(-rnd(i, 6) * 12).toFixed(1)}s` }} />
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   Noël : montagnes, forêt, village éclairé, grand sapin
   --------------------------------------------------------------- */

function House({ x, y, w, h, i, church = false }: { x: number; y: number; w: number; h: number; i: number; church?: boolean }) {
  const roof = h * 0.7;
  return (
    <g className="nv-house">
      <path className="nv-wall" d={`M${x} ${y} L${x} ${y - h} L${x + w / 2} ${y - h - roof} L${x + w} ${y - h} L${x + w} ${y} Z`} />
      <path className="nv-roof-snow" d={`M${x - 4} ${y - h + 2} L${x + w / 2} ${y - h - roof - 2} L${x + w + 4} ${y - h + 2} L${x + w} ${y - h + 4} L${x + w / 2} ${y - h - roof + 5} L${x} ${y - h + 4} Z`} />
      {church ? (
        <>
          <path className="nv-wall" d={`M${x + w / 2 - 10} ${y - h - roof + 6} L${x + w / 2 - 10} ${y - h - roof - 40} L${x + w / 2} ${y - h - roof - 74} L${x + w / 2 + 10} ${y - h - roof - 40} L${x + w / 2 + 10} ${y - h - roof + 6} Z`} />
          <path className="nv-roof-snow" d={`M${x + w / 2 - 12} ${y - h - roof - 38} L${x + w / 2} ${y - h - roof - 76} L${x + w / 2 + 12} ${y - h - roof - 38} L${x + w / 2} ${y - h - roof - 66} Z`} />
          <circle cx={x + w / 2} cy={y - h - roof - 28} r="5" className="nv-window" />
          <path className="nv-window" d={`M${x + w / 2 - 6} ${y} L${x + w / 2 - 6} ${y - 18} Q${x + w / 2} ${y - 26} ${x + w / 2 + 6} ${y - 18} L${x + w / 2 + 6} ${y} Z`} />
          <circle cx={x + w / 2} cy={y - h + 10} r="7" className="nv-window nv-rose" />
        </>
      ) : (
        <>
          <rect x={x + w * 0.18} y={y - h * 0.72} width={w * 0.22} height={h * 0.3} rx="1" className="nv-window" style={{ animationDelay: `${i * 0.8}s` }} />
          <rect x={x + w * 0.6} y={y - h * 0.72} width={w * 0.22} height={h * 0.3} rx="1" className={`nv-window ${i % 3 === 0 ? "is-off" : ""}`} />
          <path className="nv-chimney" d={`M${x + w * 0.7} ${y - h - roof * 0.4} L${x + w * 0.7} ${y - h - roof * 0.9} L${x + w * 0.82} ${y - h - roof * 0.9} L${x + w * 0.82} ${y - h - roof * 0.2} Z`} />
          {i % 2 === 0 && <path className="nv-smoke" style={{ animationDelay: `${i * 1.3}s` }} d={`M${x + w * 0.76} ${y - h - roof - 4} c-6 -10 6 -16 0 -28 c-5 -10 5 -16 2 -26`} />}
        </>
      )}
    </g>
  );
}

export function NoelScene() {
  const peaks: Pt[] = [[0, 200], [120, 150], [220, 196], [360, 118], [470, 186], [600, 140], [720, 200], [860, 126], [980, 190], [1120, 110], [1240, 176], [1380, 132], [1500, 186], [1600, 150]];
  const peakPath = `M0 ${H} ` + peaks.map(([x, y]) => `L${x} ${y}`).join(" ") + ` L${W} ${H} Z`;
  // Neige au sommet : suit les deux pentes, bord inférieur dentelé.
  const caps = peaks
    .map(([x, y], i) => {
      if (i === 0 || i === peaks.length - 1 || y > 170) return "";
      const [xl, yl] = peaks[i - 1];
      const [xr, yr] = peaks[i + 1];
      const t = 0.3;
      const lx = x + (xl - x) * t, ly = y + (yl - y) * t;
      const rx = x + (xr - x) * t, ry = y + (yr - y) * t;
      const m1x = lx + (rx - lx) * 0.25, m2x = lx + (rx - lx) * 0.5, m3x = lx + (rx - lx) * 0.75;
      const my = Math.max(ly, ry);
      return `M${f(lx)} ${f(ly)} L${x} ${y} L${f(rx)} ${f(ry)} L${f(m3x)} ${f(my - 6)} L${f(m2x)} ${f(my + 4)} L${f(m1x)} ${f(my - 8)} Z`;
    })
    .join(" ");
  const forest: string[] = [];
  for (let i = 0; i < 70; i++) {
    const x = (i / 70) * W + rnd(i, 3) * 18;
    const base = hillY(300, 40, 2.6, x) + 6;
    forest.push(fir(x, base, 34 + rnd(i, 4) * 30));
  }
  const houses = [
    { x: 1250, w: 46, h: 34 },
    { x: 1306, w: 60, h: 46, church: true },
    { x: 1378, w: 44, h: 30 },
    { x: 1430, w: 52, h: 38 },
    { x: 1492, w: 40, h: 28 },
    { x: 1538, w: 50, h: 34 },
  ];
  return (
    <>
      <Stars />
      <Land kind="noel">
        <path className="nv-mount" d={peakPath} />
        <path className="nv-cap" d={caps} />
        <path className="nv-hill-far" d={hills(300, 40, 2.6)} />
        <path className="nv-forest" d={forest.join(" ")} />
        {houses.map((h, i) => (
          <House key={i} x={h.x} y={hillY(330, 30, 0.8, h.x + h.w / 2) + 4} w={h.w} h={h.h} i={i} church={h.church} />
        ))}
        <path className="nv-snow" d={hills(330, 30, 0.8)} />
        <path className="nv-snow-near" d={hills(372, 18, 5.2)} />
        {/* Grand sapin décoré */}
        <g transform={`translate(190 ${hillY(372, 18, 5.2, 190) + 6})`}>
          <path className="nv-tree" d={fir(0, 0, 150)} />
          <path className="nv-tree-snow" d="M-10 -128 L0 -150 L10 -128 L4 -131 L0 -124 L-4 -131 Z M-22 -92 L-10 -94 L0 -88 L10 -94 L22 -92 L18 -88 L-18 -88 Z M-38 -46 L-22 -48 L-8 -42 L8 -48 L24 -42 L38 -46 L32 -41 L-32 -41 Z" />
          <path className="nv-tinsel" d="M-14 -112 Q0 -104 16 -114 M-30 -72 Q0 -60 30 -74 M-46 -30 Q0 -14 46 -32" />
          {Array.from({ length: 22 }, (_, i) => {
            const t = rnd(i, 7);
            const yy = -16 - t * 120;
            const half = (1 - t) * 52 + 6;
            const xx = (rnd(i, 8) - 0.5) * 2 * half * 0.8;
            return <circle key={i} cx={f(xx)} cy={f(yy)} r={2.4} className={`nv-bulb nv-bulb-${i % 4}`} style={{ animationDelay: `${(i % 6) * 0.4}s` }} />;
          })}
          <path className="nv-tree-star" d="M0 -166 L4 -156 L15 -155 L6 -148 L9 -137 L0 -143 L-9 -137 L-6 -148 L-15 -155 L-4 -156 Z" />
          <rect x="-34" y="-12" width="18" height="14" className="nv-gift nv-gift-a" />
          <rect x="12" y="-10" width="22" height="12" className="nv-gift nv-gift-b" />
          <rect x="-8" y="-8" width="14" height="10" className="nv-gift nv-gift-c" />
        </g>
        {/* Bonhomme de neige */}
        <g transform={`translate(1440 ${hillY(372, 18, 5.2, 1440) + 4})`} className="nv-snowman">
          <circle cx="0" cy="-16" r="16" />
          <circle cx="0" cy="-42" r="11" />
          <circle cx="0" cy="-60" r="8" />
          <path className="nv-hat" d="M-8 -66 L8 -66 L6 -68 L6 -80 L-6 -80 L-6 -68 Z" />
          <path className="nv-carrot" d="M2 -60 L12 -58 L2 -57 Z" />
          <path className="nv-scarf" d="M-8 -52 Q0 -48 8 -52 L8 -48 Q0 -44 -8 -48 Z M5 -50 L8 -38 L4 -38 Z" />
          <path className="nv-arm" d="M-10 -44 L-26 -54 M10 -44 L26 -56 M22 -54 L26 -60" />
        </g>
        {/* Réverbères */}
        {[360, 1210].map((x, i) => {
          const y = hillY(372, 18, 5.2, x) + 4;
          return (
            <g key={i}>
              <path className="nv-lamp" d={`M${x} ${y} L${x} ${y - 62} M${x - 6} ${y - 62} L${x + 6} ${y - 62} L${x + 4} ${y - 72} L${x - 4} ${y - 72} Z`} />
              <circle cx={x} cy={y - 66} r="16" className="nv-lamp-glow" />
            </g>
          );
        })}
      </Land>
    </>
  );
}

/* ---------------------------------------------------------------
   Saint-Valentin : toits au crépuscule, pont, lanternes en cœur
   --------------------------------------------------------------- */

export function ValentinScene() {
  const left = city(0, 330, 300, 3, 70, 150, 0.4);
  const right = city(1270, 1600, 300, 9, 80, 160, 0.4);
  const far = city(300, 1300, 292, 21, 30, 80, 0.2);
  const bridgeY = 330;
  return (
    <>
      <Stars className="sc-stars-rose" />
      <div className="vs-lanterns" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} style={{ left: `${(4 + rnd(i, 2) * 92).toFixed(1)}%`, animationDelay: `${(-rnd(i, 3) * 40).toFixed(1)}s`, animationDuration: `${(34 + rnd(i, 4) * 22).toFixed(1)}s`, ["--sz" as string]: `${(14 + rnd(i, 5) * 12).toFixed(0)}px` }} />
        ))}
      </div>
      <Land kind="saint_valentin">
        <path className="vs-far" d={far.d} />
        <Windows wins={far.wins} className="sc-win vs-win-far" />
        <path className="vs-city" d={left.d + right.d} />
        <Windows wins={[...left.wins, ...right.wins]} className="sc-win vs-win" />
        <rect x="0" y="300" width={W} height="100" className="vs-river" />
        <path className="vs-moonpath" d="M1180 304 L1260 304 M1196 314 L1250 314 M1170 326 L1270 326 M1200 340 L1236 340 M1186 356 L1254 356" />
        {/* Pont des amoureux */}
        <path className="vs-bridge" d={`M420 ${bridgeY + 70} L420 ${bridgeY - 6} Q800 ${bridgeY - 92} 1180 ${bridgeY - 6} L1180 ${bridgeY + 70} L1140 ${bridgeY + 70} Q1100 ${bridgeY + 6} 1040 ${bridgeY + 70} L960 ${bridgeY + 70} Q880 ${bridgeY - 10} 800 ${bridgeY - 10} Q720 ${bridgeY - 10} 640 ${bridgeY + 70} L560 ${bridgeY + 70} Q500 ${bridgeY + 6} 460 ${bridgeY + 70} Z`} />
        <path className="vs-rail" d={`M430 ${bridgeY - 22} Q800 ${bridgeY - 108} 1170 ${bridgeY - 22}`} />
        {Array.from({ length: 30 }, (_, i) => {
          const t = (i + 0.5) / 30;
          const x = 430 + 740 * t;
          const y = (1 - t) * (1 - t) * (bridgeY - 22) + 2 * (1 - t) * t * (bridgeY - 108) + t * t * (bridgeY - 22);
          const y2 = (1 - t) * (1 - t) * (bridgeY - 6) + 2 * (1 - t) * t * (bridgeY - 92) + t * t * (bridgeY - 6);
          return (
            <g key={i}>
              <line className="vs-rail" x1={f(x)} y1={f(y)} x2={f(x)} y2={f(y2)} />
              {i % 2 === 0 && <path className="vs-lock" d={`M${f(x - 3)} ${f(y + 6)} h6 v5 h-6 Z`} />}
            </g>
          );
        })}
        {[480, 1120].map((x, i) => {
          const t = (x - 430) / 740;
          const y = (1 - t) * (1 - t) * (bridgeY - 22) + 2 * (1 - t) * t * (bridgeY - 108) + t * t * (bridgeY - 22);
          return (
            <g key={i}>
              <path className="vs-lamp" d={`M${x} ${f(y)} L${x} ${f(y - 46)} M${x - 5} ${f(y - 46)} L${x + 5} ${f(y - 46)}`} />
              <circle cx={x} cy={f(y - 50)} r="4" className="vs-lamp-light" />
              <circle cx={x} cy={f(y - 50)} r="20" className="vs-lamp-glow" />
            </g>
          );
        })}
        {/* Le banc des amoureux */}
        <g transform="translate(1420 392)" className="vs-couple">
          <path d="M-46 0 L-46 -18 L46 -18 L46 0 L42 0 L42 -14 L-42 -14 L-42 0 Z M-46 -24 L46 -24 L46 -30 L-46 -30 Z M-40 -18 L-40 -40 L-36 -40 L-36 -18 Z M36 -18 L36 -40 L40 -40 L40 -18 Z" />
          <path d="M-20 -18 L-24 -50 Q-22 -62 -12 -64 Q-4 -62 -4 -50 L-6 -18 Z M-14 -66 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0" />
          <path d="M4 -18 L4 -52 Q8 -62 16 -62 Q24 -60 24 -50 L22 -18 Z M10 -68 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0" />
          <path className="vs-heart" d="M0 -92 C-8 -98 -12 -104 -8 -110 C-5 -114 -1 -112 0 -108 C1 -112 5 -114 8 -110 C12 -104 8 -98 0 -92 Z" />
        </g>
      </Land>
    </>
  );
}

/* ---------------------------------------------------------------
   Poisson d'avril : fonds marins, rayons de lumière, récifs
   --------------------------------------------------------------- */

export function AvrilScene() {
  const corals = [
    { x: 120, c: "a", s: 1.2 },
    { x: 260, c: "b", s: 0.9 },
    { x: 1330, c: "a", s: 1 },
    { x: 1480, c: "b", s: 1.3 },
  ];
  return (
    <>
      <div className="av-rays" aria-hidden>
        {[8, 26, 47, 68, 86].map((x, i) => (
          <i key={i} style={{ left: `${x}%`, animationDelay: `${-i * 2.3}s` }} />
        ))}
      </div>
      <div className="av-school" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} style={{ left: `${(rnd(i, 1) * 120).toFixed(0)}px`, top: `${(rnd(i, 2) * 60).toFixed(0)}px` }} />
        ))}
      </div>
      <Land kind="poisson_avril">
        <path className="av-reef-far" d={hills(250, 90, 0.6)} />
        <path className="av-reef" d={hills(310, 60, 3.4)} />
        {/* Coraux branchus et éventails */}
        {corals.map((c, i) => {
          const y = hillY(352, 26, 1.9, c.x) + 4;
          return c.c === "a" ? (
            <g key={i} transform={`translate(${c.x} ${y}) scale(${c.s})`} className="av-coral-a">
              <path d="M0 0 C-2 -24 -12 -38 -26 -52 M-6 -22 C-14 -26 -22 -24 -32 -30 M0 0 C2 -30 10 -46 18 -66 M8 -38 C16 -40 26 -46 30 -58 M3 -16 C12 -18 20 -26 22 -38 M-14 -38 C-12 -50 -16 -58 -14 -70" />
            </g>
          ) : (
            <g key={i} transform={`translate(${c.x} ${y}) scale(${c.s})`} className="av-coral-b">
              <path d="M0 0 C-30 -10 -44 -40 -40 -66 C-20 -78 20 -78 40 -66 C44 -40 30 -10 0 0 Z" />
              <path className="av-fan-lines" d="M0 0 L-34 -60 M0 0 L-18 -72 M0 0 L0 -76 M0 0 L18 -72 M0 0 L34 -60 M-38 -40 Q0 -54 38 -40 M-28 -20 Q0 -30 28 -20" />
            </g>
          );
        })}
        <path className="av-sand" d={hills(352, 26, 1.9)} />
        {/* Anémones et algues */}
        {[70, 200, 330, 1260, 1400, 1550].map((x, i) => {
          const y = hillY(352, 26, 1.9, x) + 6;
          return (
            <g key={i} className="av-weed" style={{ animationDelay: `${-i * 0.9}s` }}>
              <path d={`M${x} ${y} C${x - 16} ${y - 30} ${x + 14} ${y - 54} ${x - 4} ${y - 86} C${x + 12} ${y - 60} ${x - 6} ${y - 34} ${x + 8} ${y} Z`} />
              <path d={`M${x + 12} ${y} C${x + 2} ${y - 22} ${x + 22} ${y - 40} ${x + 12} ${y - 62} C${x + 26} ${y - 42} ${x + 12} ${y - 22} ${x + 18} ${y} Z`} />
            </g>
          );
        })}
        {[[540, 0], [980, 1], [1180, 0]].map(([x, k], i) => {
          const y = hillY(352, 26, 1.9, x) + 10;
          return k === 0 ? (
            <path key={i} className="av-star" d={`M${x} ${y - 16} L${x + 4} ${y - 5} L${x + 15} ${y - 5} L${x + 6} ${y + 1} L${x + 10} ${y + 12} L${x} ${y + 5} L${x - 10} ${y + 12} L${x - 6} ${y + 1} L${x - 15} ${y - 5} L${x - 4} ${y - 5} Z`} />
          ) : (
            <path key={i} className="av-shell" d={`M${x - 12} ${y} Q${x} ${y - 22} ${x + 12} ${y} Z M${x - 6} ${y} L${x - 2} ${y - 14} M${x} ${y} L${x} ${y - 16} M${x + 6} ${y} L${x + 2} ${y - 14}`} />
          );
        })}
      </Land>
    </>
  );
}

/* ---------------------------------------------------------------
   Pâques : soleil, nuages, collines fleuries, clocher
   --------------------------------------------------------------- */

const TULIPS: [string, string, string][] = [
  ["#c2185b", "#ff4f7e", "#ff8fab"],
  ["#d9831a", "#ffb13d", "#ffd27a"],
  ["#7b3fc4", "#a46cf0", "#cfa8ff"],
  ["#c8324a", "#f2556c", "#ffd0d8"],
];

function BlossomTree({ x, y, s, i }: { x: number; y: number; s: number; i: number }) {
  const puffs = Array.from({ length: 22 }, (_, k) => {
    const a = rnd(i * 31 + k, 1) * Math.PI * 2;
    const rr = Math.sqrt(rnd(i * 31 + k, 2));
    return { cx: Math.cos(a) * rr * 40, cy: -66 + Math.sin(a) * rr * 26, r: 7 + rnd(i * 31 + k, 3) * 8, k };
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="pq-trunk" d="M-3 0 C-2 -16 -4 -30 -14 -46 M-2 -26 C6 -36 16 -42 24 -54 M-3 0 L3 0 C3 -14 2 -24 4 -36 M-8 -38 C-18 -44 -26 -46 -34 -52" />
      {puffs.map((p) => (
        <circle key={`s${p.k}`} cx={f(p.cx + 2)} cy={f(p.cy + 4)} r={f(p.r)} className="pq-bloom-shade" />
      ))}
      {puffs.map((p) => (
        <circle key={p.k} cx={f(p.cx)} cy={f(p.cy)} r={f(p.r * 0.86)} className={`pq-bloom pq-bloom-${p.k % 3}`} />
      ))}
      {Array.from({ length: 6 }, (_, k) => (
        <circle key={`p${k}`} cx={f((rnd(i * 7 + k, 4) - 0.5) * 90)} cy={f(-4 - rnd(i * 7 + k, 5) * 10)} r="2" className="pq-bloom pq-bloom-1" />
      ))}
    </g>
  );
}

export function PaquesScene() {
  const meadow = (x: number) => hillY(366, 20, 2.4, x);
  return (
    <>
      <div className="pq-sun" aria-hidden>
        <i className="pq-sun-rays" />
        <i className="pq-sun-disk" />
      </div>
      <div className="pq-clouds" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="pq-butterflies" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`pq-bfly pq-bfly-${i}`}>
            <i />
            <i />
          </span>
        ))}
      </div>
      <Land kind="paques">
        <path className="pq-hill-far" d={hills(270, 60, 1.1)} />
        {/* Village et clocher sur la colline */}
        <g transform={`translate(1430 ${hillY(270, 60, 1.1, 1430) + 6})`} className="pq-village">
          <path d="M-60 0 L-60 -20 L-48 -32 L-36 -20 L-36 0 Z M-34 0 L-34 -16 L-22 -26 L-10 -16 L-10 0 Z M-8 0 L-8 -40 L-8 -64 L0 -84 L8 -64 L8 -40 L8 0 Z M10 0 L10 -22 L24 -34 L38 -22 L38 0 Z M40 0 L40 -16 L52 -26 L64 -16 L64 0 Z" />
          <path className="pq-bell" d="M-4 -52 Q0 -60 4 -52 L5 -46 L-5 -46 Z" />
          <path className="pq-cross" d="M0 -84 L0 -96 M-4 -92 L4 -92" />
        </g>
        <path className="pq-hill-mid" d={hills(318, 44, 3.7)} />
        {[[120, 1.1], [270, 0.8], [1240, 0.9], [1500, 1.2]].map(([x, s], i) => (
          <BlossomTree key={i} x={x} y={hillY(318, 44, 3.7, x) + 8} s={s} i={i} />
        ))}
        <path className="pq-meadow" d={hills(366, 20, 2.4)} />
        {Array.from({ length: 46 }, (_, i) => {
          const x = rnd(i, 11) * W;
          const y = meadow(x) + 6 + rnd(i, 12) * 20;
          const s = 0.62 + rnd(i, 13) * 0.42;
          return i % 3 === 0 ? (
            <Tulip key={i} x={x} y={y} s={s} lean={(rnd(i, 14) - 0.5) * 14} color={TULIPS[i % TULIPS.length]} />
          ) : (
            <Daisy key={i} x={x} y={y} s={s * 0.78} />
          );
        })}
      </Land>
    </>
  );
}

/* ---------------------------------------------------------------
   1er mai : sous-bois du matin, rayons, fougères
   --------------------------------------------------------------- */

function Trunks({ n, seed, base, cls, h }: { n: number; seed: number; base: number; cls: string; h: number }) {
  return (
    <g className={cls}>
      {Array.from({ length: n }, (_, i) => {
        const x = (i / n) * W + rnd(i, seed) * (W / n) * 0.8;
        const w = 7 + rnd(i, seed + 1) * 12;
        const lean = (rnd(i, seed + 5) - 0.5) * 30;
        return (
          <path
            key={i}
            d={`M${f(x - w / 2)} ${base} C${f(x - w / 2 + lean * 0.3)} ${f(base - h * 0.4)} ${f(x - w * 0.3 + lean * 0.8)} ${f(base - h * 0.7)} ${f(x - w * 0.25 + lean)} ${f(base - h)} L${f(x + w * 0.25 + lean)} ${f(base - h)} C${f(x + w * 0.3 + lean * 0.8)} ${f(base - h * 0.7)} ${f(x + w / 2 + lean * 0.3)} ${f(base - h * 0.4)} ${f(x + w / 2)} ${base} Z`}
          />
        );
      })}
      {Array.from({ length: n + 4 }, (_, i) => (
        <ellipse key={`c${i}`} cx={f((i / (n + 3)) * W)} cy={f(base - h - 4 + rnd(i, seed + 2) * 24)} rx={f(80 + rnd(i, seed + 3) * 60)} ry={f(30 + rnd(i, seed + 4) * 18)} />
      ))}
    </g>
  );
}

export function MuguetScene() {
  return (
    <>
      <div className="mm-beams" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </div>
      <Land kind="premier_mai">
        <Trunks n={14} seed={2} base={300} cls="mm-trunks-far" h={260} />
        <rect x="0" y="230" width={W} height="90" className="mm-mist" />
        <Trunks n={9} seed={7} base={340} cls="mm-trunks" h={330} />
        <path className="mm-ground" d={hills(360, 22, 1.6)} />
        {Array.from({ length: 16 }, (_, i) => {
          const x = (i / 16) * W + rnd(i, 3) * 60;
          const y = hillY(360, 22, 1.6, x) + 8;
          const s = 0.7 + rnd(i, 4) * 0.7;
          return (
            <g key={i} transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`} className="mm-fern">
              <path d="M0 0 C-4 -30 -20 -54 -44 -70" />
              {Array.from({ length: 7 }, (_, k) => {
                const t = (k + 1) / 8;
                const px = -44 * t * t;
                const py = -70 * t;
                return <path key={k} d={`M${f(px)} ${f(py)} q${f(-8 + t * 4)} ${f(-10 + t * 4)} ${f(-14 + t * 8)} ${f(-6)} M${f(px)} ${f(py)} q${f(8 - t * 2)} ${f(-6)} ${f(10 - t * 6)} ${f(-16 + t * 4)}`} />;
              })}
            </g>
          );
        })}
      </Land>
    </>
  );
}

/* ---------------------------------------------------------------
   Fête de la musique : ville, guinguette, scène, foule
   --------------------------------------------------------------- */

export function MusiqueScene() {
  const sky = city(0, W, 300, 13, 60, 170, 0.32);
  const wire = (y0: number, sag: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * W;
      const seg = (x % 400) / 400;
      pts.push([x, y0 + Math.sin(seg * Math.PI) * sag]);
    }
    return pts;
  };
  const w1 = wire(150, 34);
  const crowd =
    "M0 400 L0 372 " +
    Array.from({ length: 54 }, (_, i) => {
      const x = i * 30 + 15;
      const h = 352 + rnd(i, 4) * 14;
      const arm = rnd(i, 5) > 0.7;
      return arm
        ? `L${x - 11} ${h + 16} L${x - 13} ${h - 18} L${x - 10} ${h - 20} L${x - 7} ${h + 2} Q${x} ${h - 16} ${x + 7} ${h + 2} L${x + 11} ${h + 16}`
        : `L${x - 11} ${h + 16} Q${x - 10} ${h + 2} ${x} ${h - 4} Q${x + 10} ${h + 2} ${x + 11} ${h + 16}`;
    }).join(" ") +
    ` L${W} 372 L${W} 400 Z`;
  return (
    <>
      <Land kind="fete_musique">
        <path className="fm-city" d={sky.d} />
        <Windows wins={sky.wins} className="sc-win fm-win" />
        {/* Guirlande de guinguette */}
        <path className="fm-wire" d={`M${w1.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")}`} />
        {w1.map(([x, y], i) => (
          <g key={i}>
            <line className="fm-wire" x1={f(x)} y1={f(y)} x2={f(x)} y2={f(y + 7)} />
            <circle cx={f(x)} cy={f(y + 11)} r="4.2" className={`fm-bulb fm-bulb-${i % 4}`} style={{ animationDelay: `${(i % 7) * 0.35}s` }} />
          </g>
        ))}
        {/* La scène */}
        <g className="fm-stage">
          <path className="fm-truss" d="M40 360 L40 210 L330 210 L330 360 M40 222 L330 222 M52 210 L52 360 M318 210 L318 360 M40 210 L52 222 L64 210 L76 222 L88 210 L100 222 L112 210 L124 222 L136 210 L148 222 L160 210 L172 222 L184 210 L196 222 L208 210 L220 222 L232 210 L244 222 L256 210 L268 222 L280 210 L292 222 L304 210 L318 222 L330 210" />
          {[70, 120, 170, 220, 270, 300].map((x, i) => (
            <g key={i}>
              <path className="fm-can" d={`M${x - 6} 224 L${x + 6} 224 L${x + 8} 236 L${x - 8} 236 Z`} />
              <path className={`fm-beam fm-beam-${i % 3}`} style={{ animationDelay: `${-i * 1.1}s` }} d={`M${x - 6} 236 L${x - 34} 352 L${x + 34} 352 L${x + 6} 236 Z`} />
            </g>
          ))}
          <path className="fm-floor" d="M28 360 L342 360 L342 372 L28 372 Z" />
          {/* Le groupe */}
          <path className="fm-band" d="M120 360 L122 318 Q120 306 128 302 Q136 306 134 318 L136 360 Z M128 296 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M110 330 L150 318 L152 322 L114 336 Z M220 360 L222 322 Q220 310 228 306 Q236 310 234 322 L236 360 Z M228 300 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M236 316 L252 306 L254 310 L238 322 Z M178 360 L178 332 L196 332 L196 360 Z M170 344 L204 344 L204 360 L170 360 Z" />
          <path className="fm-speaker" d="M8 360 L8 300 L36 300 L36 360 Z M334 360 L334 300 L362 300 L362 360 Z" />
          <circle cx="22" cy="318" r="7" className="fm-cone" />
          <circle cx="22" cy="342" r="9" className="fm-cone" />
          <circle cx="348" cy="318" r="7" className="fm-cone" />
          <circle cx="348" cy="342" r="9" className="fm-cone" />
        </g>
        {/* Platines à droite */}
        <g className="fm-stage">
          <path className="fm-speaker" d="M1400 360 L1400 290 L1436 290 L1436 360 Z M1540 360 L1540 290 L1576 290 L1576 360 Z M1446 360 L1446 330 L1530 330 L1530 360 Z" />
          <path className="fm-band" d="M1486 330 L1488 300 Q1486 288 1494 284 Q1502 288 1500 300 L1502 330 Z M1494 278 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M1478 300 L1488 312 M1510 298 L1520 286" />
          <circle cx="1418" cy="310" r="8" className="fm-cone" />
          <circle cx="1418" cy="338" r="10" className="fm-cone" />
          <circle cx="1558" cy="310" r="8" className="fm-cone" />
          <circle cx="1558" cy="338" r="10" className="fm-cone" />
          <rect x="1454" y="336" width="20" height="4" className="fm-led" />
          <rect x="1502" y="336" width="20" height="4" className="fm-led fm-led-b" />
        </g>
        <path className="fm-crowd" d={crowd} />
        {Array.from({ length: 12 }, (_, i) => {
          const x = 60 + rnd(i, 8) * 1480;
          return <rect key={i} x={f(x)} y={f(344 + rnd(i, 9) * 10)} width="3" height="5" rx="1" className="fm-phone" style={{ animationDelay: `${(i % 5) * 0.6}s` }} />;
        })}
      </Land>
    </>
  );
}

/* ---------------------------------------------------------------
   14 juillet : Paris la nuit, la Seine, vrais feux d'artifice
   --------------------------------------------------------------- */

function Burst({ x, y, r, color, delay, rays = 26 }: { x: string; y: string; r: number; color: string; delay: number; rays?: number }) {
  return (
    <div className="jl-burst" style={{ left: x, top: y, ["--c" as string]: color, ["--r" as string]: `${r}px`, animationDelay: `${delay}s` }}>
      <i className="jl-rocket" style={{ animationDelay: `${delay}s` }} />
      <svg viewBox="-100 -100 200 200" className="jl-rays" style={{ animationDelay: `${delay}s` }}>
        {Array.from({ length: rays }, (_, i) => {
          const a = (i / rays) * Math.PI * 2;
          const l = 70 + (i % 3) * 10;
          return <line key={i} x1={f(Math.cos(a) * 18)} y1={f(Math.sin(a) * 18)} x2={f(Math.cos(a) * l)} y2={f(Math.sin(a) * l + 10)} />;
        })}
        {Array.from({ length: rays }, (_, i) => {
          const a = ((i + 0.5) / rays) * Math.PI * 2;
          return <circle key={`s${i}`} cx={f(Math.cos(a) * 88)} cy={f(Math.sin(a) * 88 + 16)} r="2.2" className="jl-spark" />;
        })}
      </svg>
    </div>
  );
}

export function JuilletScene() {
  const paris = city(0, W, 300, 31, 70, 140, 0.38);
  const qx = 1475;
  return (
    <>
      <div className="jl-sky" aria-hidden>
        <Burst x="14%" y="16%" r={120} color="#5b8bff" delay={0} />
        <Burst x="70%" y="10%" r={150} color="#ff4d5a" delay={2.3} rays={30} />
        <Burst x="44%" y="24%" r={100} color="#f4f6ff" delay={4.1} />
        <Burst x="86%" y="26%" r={110} color="#ffd36b" delay={5.6} />
        <Burst x="30%" y="6%" r={90} color="#5b8bff" delay={7} rays={22} />
        <Burst x="58%" y="30%" r={80} color="#ff4d5a" delay={8.4} rays={20} />
      </div>
      <Land kind="quatorze_juillet">
        <path className="jl-city" d={paris.d} />
        <Windows wins={paris.wins} className="sc-win jl-win" />
        {/* Un dôme */}
        <path className="jl-city" d="M300 200 L300 160 Q340 108 380 160 L380 200 Z M336 112 L336 96 L344 96 L344 112 Z" />
        {/* La tour */}
        <g transform={`translate(${qx} 300)`}>
          <path
            className="jl-tower"
            d="M-62 0 Q-40 -58 -18 -110 L-12 -170 L-6 -250 L-2 -300 L2 -300 L6 -250 L12 -170 L18 -110 Q40 -58 62 0 L42 0 Q22 -44 0 -44 Q-22 -44 -42 0 Z M-28 -110 L28 -110 L28 -118 L-28 -118 Z M-16 -176 L16 -176 L16 -182 L-16 -182 Z"
          />
          <path className="jl-lattice" d="M-40 -60 L-14 -108 M40 -60 L14 -108 M-30 -30 L30 -30 M-12 -130 L12 -160 M12 -130 L-12 -160 M-8 -200 L8 -230 M8 -200 L-8 -230" />
          <circle cx="0" cy="-306" r="3" className="jl-beacon" />
          <path className="jl-searchlight" d="M0 -306 L-420 -360 L-420 -330 Z" />
        </g>
        <rect x="0" y="300" width={W} height="100" className="jl-seine" />
        {/* Reflets des feux dans la Seine */}
        {[["14%", "#5b8bff", 0], ["70%", "#ff4d5a", 2.3], ["44%", "#f4f6ff", 4.1], ["86%", "#ffd36b", 5.6]].map(([x, c, d], i) => (
          <rect key={i} x={`${parseFloat(x as string) * 16 - 40}`} y="306" width="80" height="60" className="jl-reflect" style={{ fill: c as string, animationDelay: `${d}s` }} />
        ))}
        {/* Un pont */}
        <path className="jl-bridge" d="M380 318 L1220 318 L1220 336 L1200 336 Q1150 300 1100 336 L1020 336 Q970 300 920 336 L840 336 Q790 300 740 336 L660 336 Q610 300 560 336 L480 336 Q430 300 400 336 L380 336 Z" />
        {Array.from({ length: 8 }, (_, i) => {
          const x = 420 + i * 110;
          return (
            <g key={i}>
              <path className="jl-bridge" d={`M${x} 318 L${x} 296 M${x - 4} 296 L${x + 4} 296`} />
              <circle cx={x} cy="292" r="3" className="jl-lamp" />
            </g>
          );
        })}
        {/* Les quais, les spectateurs */}
        <path className="jl-quai" d="M0 400 L0 368 L380 368 L380 400 Z M1220 400 L1220 368 L1600 368 L1600 400 Z" />
        <path
          className="jl-quai"
          d={Array.from({ length: 22 }, (_, i) => {
            const x = i < 11 ? 20 + i * 32 : 1240 + (i - 11) * 32;
            const h = 340 + rnd(i, 3) * 8;
            return `M${x - 8} 368 Q${x - 8} ${h + 10} ${x} ${h} Q${x + 8} ${h + 10} ${x + 8} 368 Z M${x} ${h - 5} m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0`;
          }).join(" ")}
        />
      </Land>
      <div className="jl-haze" aria-hidden />
    </>
  );
}

/* ---------------------------------------------------------------
   11 novembre : aube sobre, peupliers, monument
   --------------------------------------------------------------- */

export function ArmisticeScene() {
  return (
    <>
      <div className="am-sun" aria-hidden />
      <Land kind="armistice">
        <path className="am-hill-far" d={hills(270, 46, 2.1)} />
        <g className="am-poplars">
          {Array.from({ length: 16 }, (_, i) => {
            const x = 80 + i * 96 + rnd(i, 2) * 30;
            const y = hillY(270, 46, 2.1, x) + 4;
            const h = 70 + rnd(i, 3) * 40;
            return <ellipse key={i} cx={f(x)} cy={f(y - h / 2)} rx={f(9 + rnd(i, 4) * 4)} ry={f(h / 2)} />;
          })}
        </g>
        <rect x="0" y="236" width={W} height="80" className="am-mist" />
        <path className="am-hill" d={hills(322, 30, 4.4)} />
        {/* Le monument */}
        <g transform={`translate(1450 ${hillY(322, 30, 4.4, 1450) + 4})`}>
          <path className="am-monument" d="M-60 0 L-60 -10 L-48 -10 L-48 -20 L-36 -20 L-36 -30 L36 -30 L36 -20 L48 -20 L48 -10 L60 -10 L60 0 Z M-14 -30 L-10 -150 L0 -166 L10 -150 L14 -30 Z" />
          <path className="am-wreath" d="M-12 -44 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z" />
          <path className="am-pole" d="M80 0 L80 -120" />
          <g className="am-flag">
            <path className="am-f0" d="M80 -120 L96 -118 L96 -98 L80 -100 Z" />
            <path className="am-f1" d="M96 -118 L112 -120 L112 -100 L96 -98 Z" />
            <path className="am-f2" d="M112 -120 L128 -117 L128 -97 L112 -100 Z" />
          </g>
        </g>
        <path className="am-field" d={hills(368, 16, 0.9)} />
        {Array.from({ length: 90 }, (_, i) => {
          const x = rnd(i, 5) * W;
          const y = hillY(368, 16, 0.9, x) + 6;
          return <path key={i} className="am-grass" d={`M${f(x)} ${f(y)} Q${f(x + 2)} ${f(y - 10)} ${f(x + 1 - rnd(i, 6) * 4)} ${f(y - 16 - rnd(i, 7) * 12)}`} />;
        })}
      </Land>
      <div className="am-mist-drift" aria-hidden />
    </>
  );
}

export const SCENES: Record<SceneKind, () => JSX.Element> = {
  halloween: HalloweenScene,
  noel: NoelScene,
  saint_valentin: ValentinScene,
  poisson_avril: AvrilScene,
  paques: PaquesScene,
  premier_mai: MuguetScene,
  fete_musique: MusiqueScene,
  quatorze_juillet: JuilletScene,
  armistice: ArmisticeScene,
};
