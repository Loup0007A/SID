/**
 * Les icônes du S.I.D. (Lot 49) : dessinées à la main, toutes dans le même
 * style (« autocollant » : couleurs franches, contour sombre, petit reflet),
 * dans un carré de 48 × 48. Elles remplacent les émojis de l'interface.
 *
 * Pour ajouter une icône : une entrée dans ICONS (le nom devient utilisable
 * partout avec <SidIcon name="…" />).
 */

import type { ReactNode } from "react";

const K = "#231c33"; // contour
type PP = { d: string; f?: string; o?: boolean | number; c?: string; w?: number; op?: number };

/** Forme pleine (contour sombre par défaut). */
function P({ d, f = "none", o = true, op }: PP) {
  return <path d={d} fill={f} stroke={o ? K : undefined} strokeWidth={o ? (typeof o === "number" ? o : 2) : undefined} strokeLinejoin="round" strokeLinecap="round" opacity={op} />;
}
/** Trait seul, de couleur c. */
function L({ d, c = K, w = 2, op }: PP) {
  return <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={op} />;
}
/** Reflet. */
function S({ d, op = 0.45 }: { d: string; op?: number }) {
  return <path d={d} fill="#fff" opacity={op} />;
}
function C({ cx, cy, r, f = "none", o = true }: { cx: number; cy: number; r: number; f?: string; o?: boolean }) {
  return <circle cx={cx} cy={cy} r={r} fill={f} stroke={o ? K : undefined} strokeWidth={o ? 2 : undefined} />;
}

/** Roue dentée (centre, rayon intérieur, extérieur, dents). */
function gear(cx: number, cy: number, r1: number, r2: number, n: number) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / n / 4;
    const a2 = a0 + (Math.PI * 2) / n / 2;
    const a3 = a0 + ((Math.PI * 2) / n) * 0.75;
    const pt = (a: number, r: number) => `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
    d += `${i === 0 ? "M" : "L"}${pt(a0, r1)} L${pt(a1, r2)} L${pt(a2, r2)} L${pt(a3, r1)} `;
  }
  return `${d}Z`;
}
/** Étoile à n branches. */
function star(cx: number, cy: number, r1: number, r2: number, n = 5, rot = -Math.PI / 2) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const r = i % 2 ? r2 : r1;
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)} `;
  }
  return `${d}Z`;
}

const HEART = (x: number, y: number, s: number) =>
  `M${x} ${y + 9 * s} C${x - 10 * s} ${y + 2 * s} ${x - 13 * s} ${y - 5 * s} ${x - 9 * s} ${y - 9 * s} C${x - 6 * s} ${y - 12 * s} ${x - 2 * s} ${y - 11 * s} ${x} ${y - 7 * s} C${x + 2 * s} ${y - 11 * s} ${x + 6 * s} ${y - 12 * s} ${x + 9 * s} ${y - 9 * s} C${x + 13 * s} ${y - 5 * s} ${x + 10 * s} ${y + 2 * s} ${x} ${y + 9 * s} Z`;

export const ICONS = {
  /* ------------------------- Pages ------------------------- */
  profile: (
    <>
      <P d="M9 11h30a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V15a4 4 0 0 1 4-4z" f="#f3e7c9" />
      <P d="M5 18v-3a4 4 0 0 1 4-4h30a4 4 0 0 1 4 4v3z" f="#5b8bff" />
      <C cx={16} cy={26} r={4.6} f="#8fb0ff" />
      <P d="M8.5 36c.8-4.6 3.7-6.4 7.5-6.4s6.7 1.8 7.5 6.4" f="#8fb0ff" />
      <L d="M28 25h10M28 30h10M28 35h6" c="#b7a27a" w={2.2} />
      <S d="M9 13.5h12v1.6H9z" op={0.5} />
    </>
  ),
  chat: (
    <>
      <P d="M19 6h20a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5h-1v6l-7-6H19a5 5 0 0 1-5-5V11a5 5 0 0 1 5-5z" f="#cfe0ff" />
      <P d="M8 17h19a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H17l-8 6v-6H8a5 5 0 0 1-5-5v-9a5 5 0 0 1 5-5z" f="#5b8bff" />
      <circle cx="11" cy="26.5" r="2" fill="#fff" />
      <circle cx="17.5" cy="26.5" r="2" fill="#fff" />
      <circle cx="24" cy="26.5" r="2" fill="#fff" />
    </>
  ),
  bell: (
    <>
      <P d="M24 7c-7.5 0-12 5.6-12 13v7.5L8 34h32l-4-6.5V20c0-7.4-4.5-13-12-13z" f="#ffcf5a" />
      <P d="M19 34a5 5 0 0 0 10 0z" f="#e09a32" />
      <C cx={24} cy={6} r={2.6} f="#e09a32" />
      <L d="M16.5 15c1-2.6 2.6-4 4.6-4.8" c="#fff" w={2.6} op={0.7} />
      <C cx={37} cy={12} r={5} f="#ff4f5e" />
    </>
  ),
  medal: (
    <>
      <P d="M13 4h9l4 14h-9z" f="#5b8bff" />
      <P d="M35 4h-9l-4 14h9z" f="#ff4f5e" />
      <C cx={24} cy={30} r={12.5} f="#ffcf5a" />
      <circle cx="24" cy="30" r="8.6" fill="#f0b73a" />
      <path d={star(24, 30.5, 6.6, 2.8)} fill="#fff4c9" />
      <S d="M15 26a10 10 0 0 1 6-6.5l.8 1.6A8 8 0 0 0 17 27z" />
    </>
  ),
  gear: (
    <>
      <P d={gear(24, 24, 15, 20, 9)} f="#a9b6d6" />
      <C cx={24} cy={24} r={6.5} f="#3a3552" />
      <S d="M14 18a12 12 0 0 1 6-5l.8 1.8a10 10 0 0 0-5 4.2z" />
    </>
  ),
  padlock: (
    <>
      <L d="M15.5 22v-6a8.5 8.5 0 0 1 17 0v6" c={K} w={7} />
      <L d="M15.5 22v-6a8.5 8.5 0 0 1 17 0v6" c="#b9c2d6" w={3.4} />
      <P d="M12 21h24a3 3 0 0 1 3 3v15a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4V24a3 3 0 0 1 3-3z" f="#ffcf5a" />
      <circle cx="24" cy="30" r="3.2" fill="#5a3d12" />
      <path d="M22.4 31.5h3.2l1 6h-5.2z" fill="#5a3d12" />
      <S d="M12.5 24h4v12h-4z" op={0.35} />
    </>
  ),
  scroll: (
    <>
      <P d="M11 11h26v26H11z" f="#f4e4bb" />
      <P d="M9 5.5h30a3.5 3.5 0 0 1 0 7H9a3.5 3.5 0 0 1 0-7z" f="#e2c48a" />
      <P d="M9 35.5h30a3.5 3.5 0 0 1 0 7H9a3.5 3.5 0 0 1 0-7z" f="#e2c48a" />
      <L d="M16 18h16M16 23h16M16 28h10" c="#b0925c" w={2.2} />
      <C cx={33} cy={31} r={4.4} f="#d6343b" />
      <path d="M31 34.5l-1 5 3-2 3 2-1-5z" fill="#d6343b" stroke={K} strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  tree: (
    <>
      <L d="M24 44V30M24 34l-7-6M24 32l6-5" c="#7a5230" w={4.5} />
      <P d="M24 4c7 0 12 4.4 12.6 10.4C40.5 16 42 19.6 41 23.5 40 28 35.8 30.5 31 30H17c-4.8.5-9-2-10-6.5-1-3.9.5-7.5 4.4-9.1C12 8.4 17 4 24 4z" f="#4fbf7a" />
      <L d="M16 19h7l3-4h5M22 24h6l2 3" c="#d6ffe4" w={1.8} />
      <circle cx="16" cy="19" r="2" fill="#d6ffe4" />
      <circle cx="31" cy="15" r="2" fill="#d6ffe4" />
      <circle cx="30" cy="27" r="2" fill="#d6ffe4" />
      <S d="M14 12a10 10 0 0 1 6-4.6l.6 1.6a8.5 8.5 0 0 0-5 3.8z" />
    </>
  ),
  map: (
    <>
      <P d="M5 11l12-4 14 4 12-4v30l-12 4-14-4-12 4z" f="#c5e6ad" />
      <path d="M17 7v30l14 4V11z" fill="#a4d38b" />
      <L d="M17 7v30M31 11v30" c={K} w={1.6} />
      <L d="M9 33c4-6 8-1 12-7s7-7 11-5" c="#d6343b" w={2} op={0.85} />
      <P d="M36 6.5a6.2 6.2 0 0 0-6.2 6.2c0 5.2 6.2 11.3 6.2 11.3s6.2-6.1 6.2-11.3A6.2 6.2 0 0 0 36 6.5z" f="#ff4f5e" />
      <circle cx="36" cy="12.7" r="2.2" fill="#fff" />
    </>
  ),
  trophy: (
    <>
      <L d="M14 10H8.5v3a6 6 0 0 0 6 6M34 10h5.5v3a6 6 0 0 1-6 6" c={K} w={5.4} />
      <L d="M14 10H8.5v3a6 6 0 0 0 6 6M34 10h5.5v3a6 6 0 0 1-6 6" c="#e0a23a" w={2.6} />
      <P d="M13 5h22v11a11 11 0 0 1-22 0z" f="#ffcf5a" />
      <P d="M21 26h6v8h-6z" f="#e0a23a" />
      <P d="M14 34h20a2 2 0 0 1 2 2v5H12v-5a2 2 0 0 1 2-2z" f="#7a5230" />
      <path d={star(24, 14, 5, 2.2)} fill="#fff4c9" />
      <S d="M16 8h3v9a8 8 0 0 0 2 5l-1.6 1.2A10 10 0 0 1 16 17z" />
    </>
  ),
  orgchart: (
    <>
      <L d="M24 15v5M10 20h28M10 20v6M24 20v6M38 20v6" c={K} w={2.2} />
      <P d="M17 5h14a2 2 0 0 1 2 2v8H15V7a2 2 0 0 1 2-2z" f="#c9a6ff" />
      <P d="M4 26h12v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" f="#7aa2ff" />
      <P d="M18 26h12v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z" f="#5fdc8a" />
      <P d="M32 26h12v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z" f="#ffcf5a" />
    </>
  ),
  people: (
    <>
      <C cx={31} cy={15} r={6} f="#a8bde8" />
      <P d="M20 37c0-7.5 4.8-11.5 11-11.5S42 29.5 42 37z" f="#a8bde8" />
      <C cx={18} cy={18} r={7} f="#5b8bff" />
      <P d="M5 42c0-8.6 5.6-13 13-13s13 4.4 13 13z" f="#5b8bff" />
      <S d="M13.5 15a5 5 0 0 1 3-3l.6 1.4a3.6 3.6 0 0 0-2.2 2.2z" />
    </>
  ),
  castle: (
    <>
      <P d="M4 42V13h3v3.5h2.5V13h3v3.5H15V13h3v9h12v-9h3v3.5h2.5V13h3v3.5H41V13h3v29z" f="#b9c1d8" />
      <P d="M19 42v-8a5 5 0 0 1 10 0v8z" f="#4a3f5c" />
      <L d="M24 22V6" c={K} w={2} />
      <P d="M24 6l9 3-9 3z" f="#ff4f5e" />
      <path d="M8 24h4v5H8zM36 24h4v5h-4z" fill="#4a3f5c" />
      <S d="M5.5 15h1.5v25H5.5z" op={0.5} />
    </>
  ),
  brain: (
    <>
      <P d="M23 9.5c-2-3.5-7.5-3.5-9.5.5-4 .2-6.8 3.8-5.4 7.6-3.2 2-3.4 7-.4 9.3-1 4 2 7.8 6 7.6 1.6 3.6 6.2 4.4 9.3 1.5z" f="#ff9ec4" />
      <P d="M25 9.5c2-3.5 7.5-3.5 9.5.5 4 .2 6.8 3.8 5.4 7.6 3.2 2 3.4 7 .4 9.3 1 4-2 7.8-6 7.6-1.6 3.6-6.2 4.4-9.3 1.5z" f="#ff86b6" />
      <L d="M24 10v26M14 16c2 0 3 1 3 3M11 25c2.4-.6 4 .4 4.6 2.6M33 16c-2 0-3 1-3 3M37 25c-2.4-.6-4 .4-4.6 2.6M18 31c1-1.6 2.6-2 4-1.4M30 31c-1-1.6-2.6-2-4-1.4" c="#b84f7f" w={1.8} />
      <L d="M22 38l-2 6M26 38l2 6" c={K} w={2} />
      <S d="M13 13a5 5 0 0 1 4-3l.4 1.6a3.4 3.4 0 0 0-2.6 2z" />
    </>
  ),
  gi: (
    <>
      <P d="M15 7l9 5 9-5 9 7-4 8-4-2v22H14V20l-4 2-4-8z" f="#f4f1ea" />
      <L d="M15 7l9 15 9-15" c={K} w={2} />
      <P d="M13 27h22v5H13z" f="#1d1a24" />
      <P d="M22 29l-3 10 3-1 2-7zM26 29l3 10-3-1-2-7z" f="#1d1a24" />
    </>
  ),
  cart: (
    <>
      <L d="M3 8h6l5 22h23" c={K} w={3} />
      <P d="M11 14h31l-4 14H14z" f="#7aa2ff" />
      <P d="M17 6h8v8h-8z" f="#ffcf5a" />
      <P d="M27 9h7v5h-7z" f="#5fdc8a" />
      <C cx={18} cy={37} r={3.6} f="#3a3552" />
      <C cx={34} cy={37} r={3.6} f="#3a3552" />
      <L d="M16 19h22M17 24h19" c="#cfe0ff" w={1.6} />
    </>
  ),
  bank: (
    <>
      <P d="M4 17L24 6l20 11z" f="#ffcf5a" />
      <P d="M7 17h34v4H7z" f="#e8ecf6" />
      <P d="M10 21h5v14h-5zM19.5 21h5v14h-5zM29 21h5v14h-5z" f="#e8ecf6" />
      <P d="M36.5 21h1.5v14h-1.5z" f="#e8ecf6" o={false} />
      <P d="M6 35h36v4H6zM4 39h40v4H4z" f="#b9c1d8" />
      <circle cx="24" cy="12.5" r="2.6" fill="#e09a32" />
    </>
  ),
  office: (
    <>
      <P d="M11 6h18v37H11z" f="#8fb3e8" />
      <P d="M29 16h10v27H29z" f="#6d93d0" />
      {[10, 16, 22, 28].map((y) => (
        <g key={y}>
          <rect x="14" y={y} width="4" height="3.6" rx=".6" fill="#e9f4ff" />
          <rect x="22" y={y} width="4" height="3.6" rx=".6" fill="#e9f4ff" />
        </g>
      ))}
      <rect x="32" y="20" width="4" height="3" rx=".6" fill="#e9f4ff" />
      <rect x="32" y="26" width="4" height="3" rx=".6" fill="#e9f4ff" />
      <P d="M17 35h6v8h-6z" f="#3a3552" />
      <L d="M6 43h36" c={K} w={2.4} />
    </>
  ),
  clipboard: (
    <>
      <P d="M10 8h28a2 2 0 0 1 2 2v31a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" f="#c98f55" />
      <P d="M12 12h24v28H12z" f="#fbfaf5" />
      <P d="M17 5h14v7H17z" f="#9aa3b8" />
      <L d="M15 19l2 2 3.5-4M15 27l2 2 3.5-4M15 35l2 2 3.5-4" c="#2fa866" w={2.2} />
      <L d="M24 20h9M24 28h9M24 36h6" c="#9aa3b8" w={2} />
    </>
  ),
  rank: (
    <>
      <P d="M24 4l16 6v12c0 10-7 17-16 22-9-5-16-12-16-22V10z" f="#5b8bff" />
      <L d="M15 19l9 6 9-6M15 27l9 6 9-6" c="#ffcf5a" w={3.6} />
      <S d="M11 12l12-4.5v2L13 13v8h-2z" op={0.35} />
    </>
  ),
  coins: (
    <>
      <P d="M4 33v5c0 2.2 5 4 11 4s11-1.8 11-4v-5" f="#e09a32" />
      <ellipse cx="15" cy="33" rx="11" ry="4" fill="#ffcf5a" stroke={K} strokeWidth="2" />
      <P d="M4 26v5c0 2.2 5 4 11 4s11-1.8 11-4v-5" f="#e09a32" />
      <ellipse cx="15" cy="26" rx="11" ry="4" fill="#ffcf5a" stroke={K} strokeWidth="2" />
      <C cx={32} cy={24} r={12} f="#ffcf5a" />
      <circle cx="32" cy="24" r="8.4" fill="#f0b73a" />
      <L d="M28.5 19.5h7l-7 9h7" c="#7a4a0e" w={2.4} />
      <S d="M24 20a9 9 0 0 1 5-5.4l.6 1.4a7.6 7.6 0 0 0-4.2 4.6z" />
    </>
  ),
  dna: (
    <>
      <L d="M16 4c0 10 16 10 16 20s-16 10-16 20" c={K} w={6} />
      <L d="M32 4c0 10-16 10-16 20s16 10 16 20" c={K} w={6} />
      <L d="M18 9h12M21 14h6M21 34h6M18 39h12" c="#c9d1e6" w={2.4} />
      <L d="M16 4c0 10 16 10 16 20s-16 10-16 20" c="#5b8bff" w={3.2} />
      <L d="M32 4c0 10-16 10-16 20s16 10 16 20" c="#ff6fa0" w={3.2} />
    </>
  ),
  chart: (
    <>
      <L d="M6 6v36h36" c={K} w={2.6} />
      <P d="M11 28h7v13h-7z" f="#5fdc8a" />
      <P d="M21 20h7v21h-7z" f="#7aa2ff" />
      <P d="M31 12h7v29h-7z" f="#ffcf5a" />
      <L d="M10 22l9-7 7 4 12-11" c="#ff4f5e" w={2.6} />
      <L d="M33 8h5v5" c="#ff4f5e" w={2.6} />
    </>
  ),
  shieldUser: (
    <>
      <P d="M24 4l16 6v12c0 10-7 17-16 22-9-5-16-12-16-22V10z" f="#7aa2ff" />
      <circle cx="24" cy="19" r="5" fill="#fff" />
      <path d="M15 33c1.4-5 4.8-7.4 9-7.4s7.6 2.4 9 7.4c-2.6 2.6-5.6 4.6-9 6.2-3.4-1.6-6.4-3.6-9-6.2z" fill="#fff" />
    </>
  ),
  siren: (
    <>
      <L d="M24 3v4M10 8l3 3M38 8l-3 3M5 21h4M39 21h4" c="#ffcf5a" w={2.6} />
      <P d="M12 35V24a12 12 0 0 1 24 0v11z" f="#ff4f5e" />
      <P d="M8 35h32a2 2 0 0 1 2 2v5H6v-5a2 2 0 0 1 2-2z" f="#3a3552" />
      <S d="M16 31v-7a8 8 0 0 1 5-7.4l.8 1.8A6 6 0 0 0 18 24v7z" op={0.55} />
    </>
  ),
  scales: (
    <>
      <L d="M24 9v31M16 42h16M7 14h34" c={K} w={3} />
      <L d="M24 9v31M16 42h16M7 14h34" c="#e0a23a" w={1.4} />
      <L d="M7 14l-4 13M7 14l4 13M41 14l-4 13M41 14l4 13" c={K} w={1.4} />
      <P d="M2 27h10a5 5 0 0 1-10 0z" f="#ffcf5a" />
      <P d="M36 27h10a5 5 0 0 1-10 0z" f="#ffcf5a" />
      <C cx={24} cy={8} r={3} f="#ffcf5a" />
    </>
  ),
  masks: (
    <>
      <g transform="rotate(-12 16 20)">
        <P d="M5 9c6-2.4 15-2.4 21 0 0 13-3.4 21-10.5 21S5 22 5 9z" f="#ffcf5a" />
        <path d="M9.5 15.5c1.4-1.6 3.6-1.6 5 0M17 15.5c1.4-1.6 3.6-1.6 5 0" fill="none" stroke={K} strokeWidth="2" strokeLinecap="round" />
        <path d="M10 21c3 4 8 4 11 0z" fill={K} />
      </g>
      <g transform="rotate(12 32 28)">
        <P d="M22 17c6-2.4 15-2.4 21 0 0 13-3.4 21-10.5 21S22 30 22 17z" f="#9b7bff" />
        <path d="M26.5 23c1.4 1.4 3.6 1.4 5 0M34 23c1.4 1.4 3.6 1.4 5 0" fill="none" stroke={K} strokeWidth="2" strokeLinecap="round" />
        <path d="M27 33c3-4 8-4 11 0z" fill={K} />
      </g>
    </>
  ),
  bucket: (
    <>
      <L d="M12 19c0-9 24-9 24 0" c={K} w={2.4} />
      <P d="M8 18h32l-4 24H12z" f="#ff9a4c" />
      <P d="M9 18c2-5 7-7 15-7s13 2 15 7z" f="#f2d38a" />
      <L d="M30 8l8-6" c="#7a5230" w={3} />
      <P d="M27 10l4-3 2 3-3 3z" f="#9aa3b8" />
      <L d="M10 27h28" c="#e0742a" w={2} />
    </>
  ),
  magnifier: (
    <>
      <L d="M30 30l11 11" c={K} w={7.5} />
      <L d="M30 30l11 11" c="#9b6a3c" w={4} />
      <C cx={20} cy={20} r={13} f="#cfeeff" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="#e0a23a" strokeWidth="2.6" />
      <L d="M15 22c0-4 2.2-6.4 5-6.4s5 2.4 5 6.4M18 24c0-3 .8-4.6 2-4.6s2 1.6 2 4.6" c="#5a7fa8" w={1.6} />
      <S d="M11 15a10 10 0 0 1 5-5l.8 1.6a8 8 0 0 0-4 4z" op={0.8} />
    </>
  ),
  home: (
    <>
      <P d="M6 22L24 7l18 15" f="none" />
      <P d="M10 20v21h28V20L24 9z" f="#f3e7c9" />
      <P d="M5 22L24 6l19 16-3 3-16-13L8 25z" f="#ff6b5e" />
      <P d="M20 41V30h8v11z" f="#7a5230" />
      <P d="M31 24h5v5h-5z" f="#9fd8ff" />
    </>
  ),
  swords: (
    <>
      <L d="M8 8l26 26M40 8L14 34" c={K} w={5.4} />
      <L d="M8 8l26 26M40 8L14 34" c="#dfe6f4" w={2.6} />
      <L d="M30 36l6-6M18 36l-6-6" c={K} w={4.6} />
      <L d="M30 36l6-6M18 36l-6-6" c="#ffcf5a" w={2.4} />
      <L d="M35 37l5 5M13 37l-5 5" c="#7a5230" w={3.6} />
    </>
  ),
  camera: (
    <>
      <P d="M5 15h26a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V18a3 3 0 0 1 3-3z" f="#5b6b8c" />
      <P d="M34 22l11-6v20l-11-6z" f="#3a4560" />
      <C cx={12} cy={10} r={4.5} f="#8a97b8" />
      <C cx={24} cy={10} r={4.5} f="#8a97b8" />
      <circle cx="9" cy="21" r="2" fill="#ff4f5e" />
    </>
  ),
  compass: (
    <>
      <C cx={24} cy={24} r={18} f="#f3e7c9" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="#c9b48a" strokeWidth="1.6" />
      <P d="M24 9l5 15h-10z" f="#ff4f5e" />
      <P d="M24 39l-5-15h10z" f="#5b8bff" />
      <circle cx="24" cy="24" r="2.4" fill={K} />
      <L d="M24 4.5v3M24 40.5v3M4.5 24h3M40.5 24h3" c={K} w={2} />
    </>
  ),
  idcard: (
    <>
      <P d="M9 11h30a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V15a4 4 0 0 1 4-4z" f="#f3e7c9" />
      <C cx={16} cy={23} r={4.6} f="#8fb0ff" />
      <P d="M8.5 33c.8-4.6 3.7-6.4 7.5-6.4s6.7 1.8 7.5 6.4" f="#8fb0ff" />
      <L d="M28 21h10M28 26h10M28 31h6" c="#b7a27a" w={2.2} />
    </>
  ),
  megaphone: (
    <>
      <P d="M6 18h7l20-10v28L13 26H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" f="#ffcf5a" />
      <P d="M9 26l3 12h5l-2-12z" f="#e09a32" />
      <L d="M38 14c2 2.4 3 5.2 3 8s-1 5.6-3 8M36 18c1 1.2 1.4 2.6 1.4 4s-.4 2.8-1.4 4" c="#ff6b5e" w={2.4} />
    </>
  ),
  warning: (
    <>
      <P d="M24 5l20 35H4z" f="#ffcf5a" />
      <L d="M24 17v11" c={K} w={4} />
      <circle cx="24" cy="34" r="2.4" fill={K} />
    </>
  ),
  check: (
    <>
      <C cx={24} cy={24} r={18} f="#2fc47a" />
      <L d="M15 24l6 6 12-13" c="#fff" w={4.4} />
    </>
  ),
  cross: (
    <>
      <C cx={24} cy={24} r={18} f="#ff4f5e" />
      <L d="M17 17l14 14M31 17L17 31" c="#fff" w={4.4} />
    </>
  ),
  hourglass: (
    <>
      <P d="M10 4h28v4H10zM10 40h28v4H10z" f="#7a5230" />
      <P d="M13 8h22c0 8-7 12-7 16s7 8 7 16H13c0-8 7-12 7-16s-7-8-7-16z" f="#cfeeff" />
      <path d="M16 13h16c-1 3-5 6-8 8-3-2-7-5-8-8zM15.5 38c1-4 5-7 8.5-8 3.5 1 7.5 4 8.5 8z" fill="#ffcf5a" />
    </>
  ),
  moneyFly: (
    <>
      <g transform="rotate(-12 24 24)">
        <P d="M6 14h32v18H6z" f="#5fbf86" />
      </g>
      <g transform="rotate(-2 24 26)">
        <P d="M8 17h32v18H8z" f="#8fe0ac" />
        <circle cx="24" cy="26" r="5.4" fill="#c4f2d4" stroke={K} strokeWidth="1.6" />
        <L d="M21.6 23.6h4.8l-4.8 5h4.8" c="#2f7a4a" w={1.8} />
        <circle cx="13" cy="26" r="1.6" fill="#5fbf86" />
        <circle cx="35" cy="26" r="1.6" fill="#5fbf86" />
      </g>
      <path d={star(41, 9, 4, 1.4, 4, 0)} fill="#ffe27a" />
      <path d={star(7, 40, 3, 1.1, 4, 0)} fill="#ffe27a" />
    </>
  ),
  trash: (
    <>
      <P d="M10 12h28l-3 30H13z" f="#b9c1d8" />
      <P d="M7 8h34v5H7z" f="#8a97b8" />
      <P d="M19 4h10v4H19z" f="#8a97b8" />
      <L d="M18 18l1 19M24 18v19M30 18l-1 19" c="#5b6b8c" w={2} />
    </>
  ),
  bulb: (
    <>
      <P d="M24 4a13 13 0 0 0-8 23.3V33h16v-5.7A13 13 0 0 0 24 4z" f="#ffe27a" />
      <P d="M16 33h16v4H16zM18 37h12v3a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3z" f="#9aa3b8" />
      <L d="M20 26c0-4 4-4 4-8M28 26c0-4-4-4-4-8" c="#e09a32" w={1.8} />
      <S d="M15 15a9 9 0 0 1 5-6l.8 1.6a7.4 7.4 0 0 0-4 5z" op={0.7} />
    </>
  ),
  tag: (
    <>
      <P d="M6 8v14l20 20 16-16L22 6H8a2 2 0 0 0-2 2z" f="#ffcf5a" />
      <C cx={14} cy={14} r={3.4} f="#fff" />
    </>
  ),
  shield: (
    <>
      <P d="M24 4l16 6v12c0 10-7 17-16 22-9-5-16-12-16-22V10z" f="#7aa2ff" />
      <P d="M24 8.5l11.8 4.4V22c0 7.6-5 13-11.8 17-6.8-4-11.8-9.4-11.8-17v-9.1z" f="#a8c2ff" o={false} />
      <path d={star(24, 22, 7, 3)} fill="#fff" />
    </>
  ),
  power: (
    <>
      <L d="M24 6v16" c="currentColor" w={4} />
      <L d="M14 12a15 15 0 1 0 20 0" c="currentColor" w={4} />
    </>
  ),
  podium1: (
    <>
      <C cx={24} cy={22} r={14} f="#ffcf5a" />
      <circle cx="24" cy="22" r="10" fill="#f0b73a" />
      <L d="M21 18l4-3v14" c="#7a4a0e" w={3} />
      <P d="M14 34l-3 10 6-3 4 4 3-9z" f="#ff4f5e" />
      <P d="M34 34l3 10-6-3-4 4-3-9z" f="#5b8bff" />
    </>
  ),
  podium2: (
    <>
      <C cx={24} cy={22} r={14} f="#dfe6f0" />
      <circle cx="24" cy="22" r="10" fill="#c3cdda" />
      <L d="M19.5 17.5c1-2 7.5-2.5 7.5 1.5 0 3-7 6-7 10h8" c="#4a5568" w={2.8} />
      <P d="M14 34l-3 10 6-3 4 4 3-9z" f="#ff4f5e" />
      <P d="M34 34l3 10-6-3-4 4-3-9z" f="#5b8bff" />
    </>
  ),
  podium3: (
    <>
      <C cx={24} cy={22} r={14} f="#e3a06a" />
      <circle cx="24" cy="22" r="10" fill="#cd7f45" />
      <L d="M19.5 16h8l-4.5 5c3 0 5 1.6 5 4.2s-2.4 4.3-5.2 4.3c-2 0-3.4-.8-4.3-2" c="#5a2f12" w={2.8} />
      <P d="M14 34l-3 10 6-3 4 4 3-9z" f="#ff4f5e" />
      <P d="M34 34l3 10-6-3-4 4-3-9z" f="#5b8bff" />
    </>
  ),
  candy: (
    <>
      <P d="M14 24L4 15l2.4 9L4 33z" f="#ff9ec4" />
      <P d="M34 24l10-9-2.4 9 2.4 9z" f="#ff9ec4" />
      <ellipse cx="24" cy="24" rx="12" ry="9" fill="#ff6fa0" stroke={K} strokeWidth="2" />
      <L d="M17 17c3 4 4 10 2 15M25 15.5c3 5 3 12 0 17M32 17.5c2 4 2 9 0 13" c="#fff" w={2.4} op={0.75} />
      <L d="M6 19l3 5-3 5M42 19l-3 5 3 5" c="#e07aa4" w={1.4} />
    </>
  ),
  lollipop: (
    <>
      <L d="M24 28v17" c="#f3e7c9" w={4} />
      <C cx={24} cy={17} r={13} f="#ffcf5a" />
      <L d="M24 17m-8 0a8 8 0 1 0 8-8 6 6 0 1 1-6 6 4 4 0 1 0 4-4" c="#ff6fa0" w={2.6} />
    </>
  ),
  chocolate: (
    <>
      <P d="M8 10h32v28H8z" f="#7a4a2a" />
      <L d="M8 19.3h32M8 28.6h32M18.7 10v28M29.3 10v28" c="#5a321a" w={2} />
      <P d="M28 30l12-6v14H28z" f="#e8ecf6" />
    </>
  ),
  snowflake: (
    <>
      <L d="M24 4v40M6.7 14l34.6 20M6.7 34l34.6-20" c={K} w={5} />
      <L d="M24 4v40M6.7 14l34.6 20M6.7 34l34.6-20" c="#cfe9ff" w={2.6} />
      <L d="M19 8l5 4 5-4M19 40l5-4 5 4M8 21l6-1-1-6M40 27l-6 1 1 6M8 27l6 1-1 6M40 21l-6-1 1-6" c="#cfe9ff" w={2} />
    </>
  ),
  sparkle: (
    <>
      <P d="M24 4c1.6 9 5 12.4 14 14-9 1.6-12.4 5-14 14-1.6-9-5-12.4-14-14 9-1.6 12.4-5 14-14z" f="#ffe27a" />
      <P d="M38 30c.8 4 2.2 5.4 6 6-3.8.6-5.2 2-6 6-.8-4-2.2-5.4-6-6 3.8-.6 5.2-2 6-6z" f="#fff4c9" />
    </>
  ),
  starGold: (
    <>
      <P d={star(24, 25, 20, 8.6)} f="#ffcf5a" />
      <S d="M24 10l3 8.6-3 .4z" op={0.6} />
    </>
  ),

  /* ------------------------- Fêtes ------------------------- */
  pumpkin: (
    <>
      <P d="M23 10c0-4 2-6 5-7l1.6 2.6c-2 .8-3 2.4-3 4.4z" f="#4b7a2f" />
      <P d="M24 11c-4-2-11-1.4-15 3-5 5.6-5 15.6 0 21.4 4 4.4 11 4.6 15 2.6 4 2 11 1.8 15-2.6 5-5.8 5-15.8 0-21.4-4-4.4-11-5-15-3z" f="#f07d24" />
      <L d="M24 11c-3 6-3 21 0 27M24 11c3 6 3 21 0 27M14 13c-4 6-4 17 0 23M34 13c4 6 4 17 0 23" c="#c4520f" w={1.6} />
      <path d="M14 20l5-2.6.4 5zM34 20l-5-2.6-.4 5zM13 28c5 6 17 6 22 0l-4 .6-2 2.4-2.6-2-2.4 2.4-2.4-2.4-2.6 2-2-2.4z" fill="#ffd36b" stroke={K} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  ),
  fir: (
    <>
      <P d="M21 38h6v6h-6z" f="#7a5230" />
      <P d="M24 6l9 11h-4l8 10h-4l8 11H7l8-11h-4l8-10h-4z" f="#2f9e5b" />
      <path d={star(24, 7, 5.4, 2.2)} fill="#ffcf5a" stroke={K} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="21" cy="19" r="2" fill="#ff4f5e" />
      <circle cx="28" cy="25" r="2" fill="#6cc2ff" />
      <circle cx="18" cy="31" r="2" fill="#ffcf5a" />
      <circle cx="30" cy="34" r="2" fill="#ff4f5e" />
      <L d="M17 23c4 2 10 2 13-1M13 34c6 2.6 15 2.6 21-1" c="#ffe27a" w={1.4} op={0.8} />
    </>
  ),
  heartArrow: (
    <>
      <L d="M4 40L44 8" c={K} w={4.4} />
      <L d="M4 40L44 8" c="#e0a23a" w={2} />
      <P d={HEART(24, 25, 1.45)} f="#ff4f7e" />
      <L d="M4 40l1-6M4 40l6-1M7 37.6l1-6M7 37.6l6-1" c="#ff9ec4" w={1.8} />
      <P d="M44 8l-7 1.5 3.6 2.4L42 16z" f="#e0a23a" />
      <S d="M14 18a5 5 0 0 1 4-3l.6 1.4a3.6 3.6 0 0 0-2.8 2.2z" op={0.6} />
    </>
  ),
  fish: (
    <>
      <P d="M5 24c6-10 20-12 29-5l9-7-2 12 2 12-9-7C25 36 11 34 5 24z" f="#7fd8ff" />
      <L d="M18 15c3 5 3 13 0 18M25 15.5c2.6 5 2.6 12 0 17" c="#4aa8d8" w={1.8} />
      <circle cx="12" cy="22" r="2.6" fill="#fff" stroke={K} strokeWidth="1.4" />
      <circle cx="11.6" cy="22.2" r="1.2" fill={K} />
      <S d="M9 20c3-4 8-6 13-6v1.6c-4.6 0-9 1.8-11.6 5.4z" />
    </>
  ),
  egg: (
    <>
      <P d="M24 4C15 4 9 18 9 27c0 9 6.6 16 15 16s15-7 15-16C39 18 33 4 24 4z" f="#ffd1e0" />
      <path d="M9.6 22l5-3.4 5 3.4 4.4-3.4 4.6 3.4 5-3.4 4.8 3.4v5.4l-4.8-3.4-5 3.4-4.6-3.4-4.4 3.4-5-3.4-5 3.4z" fill="#7aa2ff" />
      <circle cx="18" cy="34" r="2" fill="#ffcf5a" />
      <circle cx="24" cy="37" r="2" fill="#5fdc8a" />
      <circle cx="30" cy="34" r="2" fill="#ffcf5a" />
      <circle cx="24" cy="12" r="2" fill="#5fdc8a" />
      <S d="M15 15c1.4-4 3.6-6.6 6-7.6l.6 1.6c-2 .8-3.8 3-5 6.4z" op={0.7} />
    </>
  ),
  muguet: (
    <>
      <P d="M14 44c-6-12-4-28 6-38-2 14-1 26 2 38z" f="#3aa35e" />
      <P d="M36 44c6-10 4-24-4-32 1 12 0 22-4 32z" f="#2f8a4f" />
      <L d="M23 44c0-14 3-26 12-34" c="#4e9a5c" w={2} />
      {[
        [33, 13],
        [30.5, 19],
        [28.5, 25],
        [27, 31],
      ].map(([x, y], i) => (
        <g key={i}>
          <L d={`M${x} ${y - 3}l2 1`} c="#4e9a5c" w={1.4} />
          <P d={`M${x + 2} ${y - 2}c-3.2 0-4.6 2.4-4.6 5.4l1.4-1 1.6 1.4 1.6-1.4 1.6 1.4 1.6-1.4 1.4 1c0-3-1.4-5.4-4.6-5.4z`} f="#fbfff7" o={1.2} />
        </g>
      ))}
    </>
  ),
  notes: (
    <>
      <L d="M17 34V10l22-5v24" c={K} w={4.4} />
      <L d="M17 34V10l22-5v24" c="#c9a6ff" w={2.2} />
      <P d="M17 11l22-5v6l-22 5z" f="#c9a6ff" />
      <ellipse cx="12" cy="35" rx="6" ry="4.6" transform="rotate(-18 12 35)" fill="#c9a6ff" stroke={K} strokeWidth="2" />
      <ellipse cx="34" cy="30" rx="6" ry="4.6" transform="rotate(-18 34 30)" fill="#c9a6ff" stroke={K} strokeWidth="2" />
    </>
  ),
  firework: (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const c = ["#ff4f5e", "#f4f6ff", "#5b8bff"][i % 3];
        return <L key={i} d={`M${24 + Math.cos(a) * 6} ${22 + Math.sin(a) * 6}L${24 + Math.cos(a) * 18} ${22 + Math.sin(a) * 18}`} c={c} w={2.6} />;
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const a = ((i + 0.5) / 12) * Math.PI * 2;
        return <circle key={`s${i}`} cx={24 + Math.cos(a) * 20} cy={22 + Math.sin(a) * 20} r="1.4" fill="#ffe27a" />;
      })}
      <circle cx="24" cy="22" r="3" fill="#ffe27a" />
      <L d="M24 46v-8" c="#ffcf5a" w={2} op={0.7} />
    </>
  ),
  dove: (
    <>
      <P d="M6 27c5-2 9-2 13 0 4-6 11-9 17-8 3-3 7-3 9-1-2 0-3.6 1.4-4 3 2 5 0 12-7 15-8 3-17 1-22-4l-7 1z" f="#f4f6fb" />
      <P d="M19 27c-1-8 4-17 13-21-1 6 0 10 3 13-5 0-11 3-16 8z" f="#dfe6f4" />
      <L d="M23 13c1 3 3 5 6 6M21 18c2 2 4 3 7 3" c="#b9c4dc" w={1.4} />
      <circle cx="39" cy="20" r="1.3" fill={K} />
      <P d="M44.6 20.4l3 .8-3 1z" f="#ffb347" o={1.2} />
      <L d="M42 24c2 1 4 1 5.4 3" c="#4e9a5c" w={1.6} />
      <P d="M44 25c1.6-1 3-.6 3.4.6-1.4.4-2.6.2-3.4-.6zM45.6 27.6c1.4-.4 2.6.4 2.4 1.6-1.2-.2-2-.8-2.4-1.6z" f="#5fae6e" o={false} />
    </>
  ),
  bleuet: (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 45} 24 24)`}>
          <P d="M24 21l-6.4-15 3.2 1.6L24 3.6l3.2 4 3.2-1.6z" f="#4f7be6" o={1.4} />
        </g>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <g key={`b${i}`} transform={`rotate(${i * 45 + 22.5} 24 24)`}>
          <path d="M24 22l-3.4-9 1.8.8L24 11l1.6 2.8 1.8-.8z" fill="#7a9cff" />
        </g>
      ))}
      <C cx={24} cy={24} r={5} f="#26306f" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={`d${i}`} cx={24 + Math.cos(i * 1.256) * 2.4} cy={24 + Math.sin(i * 1.256) * 2.4} r=".9" fill="#c9d4ff" />
      ))}
    </>
  ),
  bow: (
    <>
      <L d="M12 4c14 6 18 26 12 40" c={K} w={5.4} />
      <L d="M12 4c14 6 18 26 12 40" c="#a0662f" w={3} />
      <L d="M12 4l12 40" c="#e9e2cf" w={1.2} />
      <L d="M4 25h38" c={K} w={3.8} />
      <L d="M4 25h38" c="#d8c6a4" w={1.8} />
      <P d="M44 25l-7-4v8z" f="#9aa3b8" />
      <P d="M4 25l-2-4h6l2 4-2 4H2z" f="#ff4f5e" />
    </>
  ),
  horn: (
    <>
      <P d="M5 30c4-12 16-20 30-18 4 .6 6 4 4 7-11-2-20 2-27 13z" f="#e8d6b0" />
      <P d="M33 9c6-3 11 1 10 8-.5 4-5 4-7 2 4-2 4-7-2-8z" f="#c79a5a" />
      <L d="M17 20l3 4M24 16l2 4" c="#7a4a22" w={2} />
      <P d="M5 30l-3 5 6-1z" f="#7a4a22" />
      <L d="M9 28c2 11 20 12 25-6" c="#b3121b" w={1.6} />
    </>
  ),
  claws: (
    <>
      {[0, 1, 2].map((i) => (
        <P key={i} d={`M${7 + i * 11} 5c4 11 8 22 15 35-9-7-14-18-17-32z`} f="#ff8a2a" o={1.4} />
      ))}
    </>
  ),
  starBalance: (
    <>
      <C cx={24} cy={24} r={21} f="#1d2260" />
      <L d="M24 10v24M12 16h24M12 16l-4 10M12 16l4 10M36 16l-4 10M36 16l4 10M18 38h12" c="#d6dcff" w={1.4} />
      <path d="M7 26h10a5 5 0 0 1-10 0zM31 26h10a5 5 0 0 1-10 0z" fill="#e8d6a0" />
      {[
        [24, 10, 2],
        [12, 16, 1.6],
        [36, 16, 1.6],
        [24, 34, 1.6],
        [14, 8, 1],
        [35, 33, 1],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" />
      ))}
    </>
  ),

  /* ------------------------- Titres ------------------------- */
  dragon: (
    <>
      <P d="M5 44c0-11 5-20 13-24 1-7 7-12 15-12 3 0 6 .8 8 2.6l5 .4-1.6 4.4c1.2 2 1.2 4.4 0 6.6l-6.4 1.2c-2 3.6-6 5.8-10.4 5.8-3 6-8 11-13 15z" f="#4fbf7a" />
      <P d="M27 9c-3-4-8-6-13-5 4 1.4 7 3.6 9 7z" f="#e8d6b0" />
      <P d="M33 8c-1-4-4-6.6-8-7 2.6 2 4 4.4 4.6 7.6z" f="#e8d6b0" />
      <P d="M14 22l-7-1.4 4.6 5zM11 29.4l-6.4.6 5 3.6zM9 37l-6 2.4 6.4 1.6z" f="#2f8a4f" />
      <L d="M46 17l-9 1.6c-2 .4-3.4 1.4-4 3" c="#1f6b3f" w={1.6} />
      <path d="M40 18.4l1 2 1-2.2M36.5 19l1 2.2 1.2-2.4" fill="#fff" />
      <ellipse cx="34" cy="13" rx="2.8" ry="2.1" fill="#ffcf5a" stroke={K} strokeWidth="1.4" />
      <path d="M34 11.3v3.4" stroke={K} strokeWidth="1.3" />
      <circle cx="43" cy="12.6" r=".9" fill={K} />
      <L d="M16 31c3 1 6 0 8-2M13.6 37c3 1 6 0 8-2" c="#2f8a4f" w={1.6} />
      <P d="M46.6 21c2 1 2 3.4 1 4.6-.6-1.4-2-2.2-3.4-2.4z" f="#ff8a2a" o={1.2} />
      <S d="M17 22c1-5 5-9.6 10-11l.4 1.4c-4.4 1.4-7.8 5.4-8.8 9.8z" op={0.5} />
    </>
  ),
  web: (
    <>
      <L d="M24 3v42M3 24h42M9 9l30 30M39 9L9 39" c="#7ee8ff" w={1.6} />
      {[7, 13, 19].map((r) => (
        <path key={r} d={Array.from({ length: 9 }, (_, i) => `${i ? "L" : "M"}${(24 + Math.cos((i * Math.PI) / 4) * r).toFixed(1)} ${(24 + Math.sin((i * Math.PI) / 4) * r).toFixed(1)}`).join(" ")} fill="none" stroke="#7ee8ff" strokeWidth="1.6" />
      ))}
      {[
        [24, 5],
        [43, 24],
        [10, 38],
        [37, 37],
        [24, 24],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="#36e6ff" stroke={K} strokeWidth="1.4" />
      ))}
    </>
  ),
  bolt: (
    <>
      <P d="M28 3L10 27h11l-4 18 21-26H26z" f="#ffe27a" />
      <S d="M26 7L14 24h3l10-14z" op={0.6} />
    </>
  ),
  ghost: (
    <>
      <P d="M24 5C14 5 9 13 9 22v20l5-4 5 4 5-4 5 4 5-4 5 4V22c0-9-5-17-15-17z" f="#f4f6fb" />
      <ellipse cx="18.5" cy="21" rx="2.6" ry="3.6" fill={K} />
      <ellipse cx="29.5" cy="21" rx="2.6" ry="3.6" fill={K} />
      <ellipse cx="24" cy="29.5" rx="3" ry="2.4" fill={K} />
      <S d="M13 15c1.4-4 4.4-6.6 8-7.4l.4 1.6c-3 .8-5.6 3-6.8 6.4z" op={0.9} />
    </>
  ),
  gift: (
    <>
      <P d="M7 20h34v8H7z" f="#e5454c" />
      <P d="M10 28h28v15H10z" f="#d6343b" />
      <P d="M21 20h6v23h-6z" f="#ffcf5a" />
      <P d="M24 20c-4-8-12-8-11-3 1 3 7 3 11 3 4 0 10 0 11-3 1-5-7-5-11 3z" f="#ffcf5a" />
    </>
  ),
  wave: (
    <>
      <P d="M3 40c4-14 14-28 28-30 8-1 14 4 14 10-4-4-10-4-13 0 4 0 7 3 7 7-6-3-14 0-16 8l-2 5z" f="#3a8be8" />
      <P d="M21 40c2-8 10-11 16-8-4 0-7 3-8 8z" f="#7fc4ff" />
      <path d="M31 10c8-1 14 4 14 10-4-4-10-4-13 0" fill="#e9f6ff" stroke={K} strokeWidth="1.6" strokeLinejoin="round" />
      <L d="M3 44h42" c="#3a8be8" w={2.4} />
    </>
  ),
  moneyBag: (
    <>
      <P d="M17 12h14l-3 5c8 3 13 11 13 18 0 6-6 9-17 9S7 41 7 35c0-7 5-15 13-18z" f="#e0b45a" />
      <P d="M16 7c3 1 5 1 8-1 3 2 5 2 8 1l-1 5H17z" f="#c9953f" />
      <L d="M18 14h12" c="#7a4a0e" w={2.4} />
      <L d="M20.5 25h7l-7 9.5h7" c="#7a4a0e" w={2.8} />
      <S d="M12 31c1-5 4-9 8-11l.6 1.4c-3.4 1.8-6 5.2-7 9.6z" op={0.5} />
    </>
  ),
  lips: (
    <>
      <P d="M4 22c6-8 12-10 16-7 2-2 6-2 8 0 4-3 10-1 16 7-5 9-12 14-20 14S9 31 4 22z" f="#ff4f6e" />
      <L d="M5 22c8 3 13 3 19 1 6 2 11 2 19-1" c="#b8183a" w={2} />
      <S d="M12 18c3-2 6-2 7-1l-.6 1.4c-1-.6-3.4-.4-5.6 1z" op={0.6} />
    </>
  ),
  quill: (
    <>
      <P d="M40 4C26 6 15 16 11 33l4 1c3-6 7-10 13-12-3-1-6-1-8 0 4-3 9-5 14-5-3-1-6-1-8-1 5-3 10-7 14-12z" f="#f4f6fb" />
      <L d="M38 7C27 14 18 24 13 36" c="#9aa8c8" w={1.6} />
      <P d="M11 33l4 1-6 10z" f="#3a3552" />
    </>
  ),
  metronome: (
    <>
      <P d="M18 5h12l9 37H9z" f="#b8743d" />
      <P d="M14 32h20l2 10H12z" f="#8a5228" />
      <L d="M24 34L32 9" c={K} w={4.4} />
      <L d="M24 34L32 9" c="#e8ecf6" w={2} />
      <P d="M27 18h6v5h-6z" f="#ffcf5a" />
      <L d="M17 26h3M17 21h3M16 16h3" c="#f3d2a8" w={1.6} />
    </>
  ),
  gavel: (
    <>
      <L d="M22 22l18 18" c={K} w={6.4} />
      <L d="M22 22l18 18" c="#b8743d" w={3.4} />
      <P d="M9 17l10-10 10 10-10 10z" f="#8a5228" />
      <P d="M7 15l12-12 3 3L10 18zM16 24l12-12 3 3-12 12z" f="#c98f55" />
      <P d="M4 44h18v-4H4z" f="#5b6b8c" />
    </>
  ),
  bat: (
    <>
      <P d="M24 12c-2 0-3 1.2-3.4 3l-2-5-1.2 5.6C13 9.4 7 8 1 11c5 2 8 7 8 13 3.4-3 8.4-2.6 11 2 2-3 4-4.4 4-4.4s2 1.4 4 4.4c2.6-4.6 7.6-5 11-2 0-6 3-11 8-13-6-3-12-1.6-16.4 4.6L29.4 10l-2 5c-.4-1.8-1.4-3-3.4-3z" f="#7a52b8" />
      <L d="M8 21l8-7M13 25l5-9M40 21l-8-7M35 25l-5-9" c="#a785e0" w={1.4} />
      <ellipse cx="24" cy="21" rx="4" ry="7" fill="#5e3f92" stroke={K} strokeWidth="1.8" />
      <circle cx="22.4" cy="18" r="1.2" fill="#ffb347" />
      <circle cx="25.6" cy="18" r="1.2" fill="#ffb347" />
    </>
  ),
  elfHat: (
    <>
      <P d="M8 34c4-14 12-26 26-30-4 6-4 12 0 18 2 3 3 7 2 12z" f="#2f9e5b" />
      <P d="M6 33h32a3 3 0 0 1 0 6H6a3 3 0 0 1 0-6z" f="#d6343b" />
      <C cx={36} cy={6} r={4.4} f="#f4f6fb" />
      <L d="M18 22c4 1 9 0 13-3" c="#4fbf7a" w={1.6} />
      <circle cx="16" cy="36" r="1.6" fill="#ffcf5a" />
      <circle cx="24" cy="36" r="1.6" fill="#ffcf5a" />
      <circle cx="32" cy="36" r="1.6" fill="#ffcf5a" />
    </>
  ),
  wingedHeart: (
    <>
      <P d="M18 22C12 12 3 12 2 16c5 0 7 3 8 7 3-2 6-2 8 0zM30 22c6-10 15-10 16-6-5 0-7 3-8 7-3-2-6-2-8 0z" f="#f4f6fb" />
      <P d={HEART(24, 27, 1.25)} f="#ff4f7e" />
      <S d="M18 22a4 4 0 0 1 3-2.4l.4 1.2a2.8 2.8 0 0 0-2 1.8z" op={0.7} />
    </>
  ),
  basket: (
    <>
      <L d="M10 22c0-16 28-16 28 0" c={K} w={5} />
      <L d="M10 22c0-16 28-16 28 0" c="#c98f55" w={2.6} />
      <ellipse cx="17" cy="22" rx="5" ry="6.4" fill="#ffd1e0" stroke={K} strokeWidth="1.8" />
      <ellipse cx="25" cy="20" rx="5" ry="6.4" fill="#bfe3ff" stroke={K} strokeWidth="1.8" />
      <ellipse cx="32" cy="23" rx="5" ry="6.4" fill="#fff1a8" stroke={K} strokeWidth="1.8" />
      <P d="M6 24h36l-5 19H11z" f="#c98f55" />
      <L d="M8 30h32M10 36h28M18 24l2 19M30 24l-2 19" c="#9b6a3c" w={1.6} />
    </>
  ),
  fist: (
    <>
      <P d="M14 44V30l-3-6c-1-3 1-5 3-4V12a3 3 0 0 1 6 0V9a3 3 0 0 1 6 0v1a3 3 0 0 1 6 0v2a3 3 0 0 1 6 0v14c0 6-3 10-7 12v6z" f="#ffb48a" />
      <L d="M20 12v8M26 10v9M32 12v8M14 24c4-1 8 0 11 3" c="#c97a54" w={1.8} />
      <P d="M13 40h21v4H13z" f="#d6343b" />
    </>
  ),
  clef: (
    <>
      <L d="M26 44c-4 0-6-2-6-4.6 0-2 1.6-3.4 3.4-3.4 2 0 3 1.4 3 3M27 40c0-10-1-24-1-32 0-3 2-5 4-5 1.6 0 2 2 1.6 4-1 5-10 9-13 15-3 6 0 13 7 13 5 0 8-3 8-7 0-3.6-2.6-6-6-6-3.4 0-5.6 2.4-5.6 5.4" c={K} w={5} />
      <L d="M26 44c-4 0-6-2-6-4.6 0-2 1.6-3.4 3.4-3.4 2 0 3 1.4 3 3M27 40c0-10-1-24-1-32 0-3 2-5 4-5 1.6 0 2 2 1.6 4-1 5-10 9-13 15-3 6 0 13 7 13 5 0 8-3 8-7 0-3.6-2.6-6-6-6-3.4 0-5.6 2.4-5.6 5.4" c="#ffcf5a" w={2.6} />
    </>
  ),
  rocket: (
    <>
      <P d="M24 3c6 6 8 14 6 24H18c-2-10 0-18 6-24z" f="#e8ecf6" />
      <P d="M18 27l-6 6 7 1zM30 27l6 6-7 1z" f="#ff4f5e" />
      <C cx={24} cy={15} r={3.4} f="#5b8bff" />
      <P d="M20 28h8l-1 4h-6z" f="#9aa3b8" />
      <P d="M21 33c1 5 2 8 3 11 1-3 2-6 3-11z" f="#ffb347" o={1.2} />
      {[
        [10, 10, "#ff4f5e"],
        [38, 8, "#5b8bff"],
        [40, 20, "#ffe27a"],
        [8, 22, "#f4f6ff"],
      ].map(([x, y, c], i) => (
        <path key={i} d={star(x as number, y as number, 3, 1.2, 4, 0)} fill={c as string} />
      ))}
    </>
  ),

  /* ------------------------- Divers ------------------------- */
  tricolor: (
    <>
      <L d="M9 44V5" c={K} w={3.4} />
      <L d="M9 44V5" c="#d6dcea" w={1.4} />
      <P d="M11 7h10v20H11z" f="#2f5bd8" o={false} />
      <P d="M21 7h10v20H21z" f="#f4f6fb" o={false} />
      <P d="M31 7h10v20H31z" f="#e23a3a" o={false} />
      <P d="M11 7h30v20H11z" />
    </>
  ),
  menu: (
    <>
      <P d="M7 10h34a3 3 0 0 1 0 6H7a3 3 0 0 1 0-6zM7 21h34a3 3 0 0 1 0 6H7a3 3 0 0 1 0-6zM7 32h34a3 3 0 0 1 0 6H7a3 3 0 0 1 0-6z" f="#cfd6ea" />
    </>
  ),
  question: (
    <>
      <C cx={24} cy={24} r={19} f="#c9a6ff" />
      <path d="M17.5 18.5a6.5 6.5 0 1 1 9.4 5.8c-1.8.9-2.9 2.2-2.9 4.2v1.5" fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" />
      <circle cx="24" cy="36.5" r="2.8" fill="#fff" />
    </>
  ),
  tools: (
    <>
      <P d="M30 5a9 9 0 0 0-8.6 11.6L6.6 31.4a4 4 0 0 0 0 5.6l4.4 4.4a4 4 0 0 0 5.6 0l14.8-14.8A9 9 0 0 0 43 18l-6 1.6-4.6-4.6L34 9z" f="#a9b6d6" />
      <circle cx="11.6" cy="36.4" r="2.2" fill="#3a3552" />
      <P d="M8 8l6-2 8 8-4 4-8-8z" f="#ff8a2a" />
      <P d="M20 18l20 20a3 3 0 0 1-4 4L16 22z" f="#d6823a" />
    </>
  ),
  flag: (
    <>
      <L d="M10 44V5" c={K} w={3.6} />
      <L d="M10 44V5" c="#b9c2d6" w={1.6} />
      <P d="M11 7c8-4 13 4 21 0 3-1.4 5-1.6 7-1v20c-2-.6-4-.4-7 1-8 4-13-4-21 0z" f="#ff4f5e" />
      <S d="M14 10c4-1.4 7 0 10 1.4v3c-3-1.4-6-2.6-10-1.4z" op={0.4} />
    </>
  ),
  film: (
    <>
      <P d="M5 12h38v26H5z" f="#3a3552" />
      <path d="M8 15h4v4H8zM8 23h4v4H8zM8 31h4v4H8zM36 15h4v4h-4zM36 23h4v4h-4zM36 31h4v4h-4z" fill="#f4f6fb" />
      <P d="M16 15h16v20H16z" f="#5b8bff" o={false} />
      <path d="M21 19.5v11l9-5.5z" fill="#fff" />
    </>
  ),
  link: (
    <>
      <L d="M20.5 27.5a8 8 0 0 0 11.3 0l7-7a8 8 0 0 0-11.3-11.3l-3 3" c={K} w={7} />
      <L d="M27.5 20.5a8 8 0 0 0-11.3 0l-7 7a8 8 0 0 0 11.3 11.3l3-3" c={K} w={7} />
      <L d="M20.5 27.5a8 8 0 0 0 11.3 0l7-7a8 8 0 0 0-11.3-11.3l-3 3" c="#5b8bff" w={3.4} />
      <L d="M27.5 20.5a8 8 0 0 0-11.3 0l-7 7a8 8 0 0 0 11.3 11.3l3-3" c="#8fb0ff" w={3.4} />
    </>
  ),
  printer: (
    <>
      <P d="M14 5h20v11H14z" f="#f4f6fb" />
      <P d="M6 16h36a3 3 0 0 1 3 3v14H3V19a3 3 0 0 1 3-3z" f="#8f9bbb" />
      <P d="M13 27h22v16H13z" f="#f4f6fb" />
      <L d="M17 32h14M17 37h10" c="#9aa3b8" w={2} />
      <circle cx="38" cy="22" r="2" fill="#5fdc8a" />
    </>
  ),
  helmet: (
    <>
      <P d="M8 30C8 17 15 7 24 7s16 10 16 23v6H8z" f="#a9b6d6" />
      <P d="M22 7h4v29h-4z" f="#ffcf5a" />
      <P d="M12 24h24v6H12z" f="#3a3552" />
      <P d="M6 36h36v5H6z" f="#8f9bbb" />
      <S d="M12 20c1-5 4-9 8-11v4c-3 2-5 4-6 7z" />
    </>
  ),
  pants: (
    <>
      <P d="M12 5h24l3 38H27l-3-24-3 24H9z" f="#5b8bff" />
      <P d="M12 5h24v6H12z" f="#3f6fe0" />
      <circle cx="24" cy="8" r="1.6" fill="#ffcf5a" />
      <L d="M17 11l-1 6M31 11l1 6" c="#8fb0ff" w={1.6} />
    </>
  ),
  boot: (
    <>
      <P d="M14 4h14v22l12 6c3 1.4 4 3.6 4 6v4H8V38l4-4z" f="#b8662a" />
      <P d="M8 38h36v4H8z" f="#3a3552" />
      <P d="M13 4h16v6H13z" f="#d6823a" />
      <L d="M17 16h8M17 21h8" c="#7a4318" w={2} />
    </>
  ),
  hello: (
    <>
      <P d="M14 26V12a3 3 0 0 1 6 0v10V8a3 3 0 0 1 6 0v14V10a3 3 0 0 1 6 0v14-8a3 3 0 0 1 6 0v14c0 8-6 14-14 14-6 0-9-3-12-8l-5-8a3 3 0 0 1 5-3z" f="#ffd6b8" />
      <L d="M5 12c1-3 3-5 6-6M3 20c0-2 .6-4 2-5" c="#ffcf5a" w={2.4} />
    </>
  ),
  radar: (
    <>
      <P d="M8 36a20 20 0 0 1 28-28z" f="#cfe0ff" />
      <L d="M14 30a12 12 0 0 1 16-16M19 25a5 5 0 0 1 6-6" c="#5b8bff" w={2.2} />
      <L d="M22 26L38 10" c={K} w={2.6} />
      <circle cx="39" cy="9" r="3" fill="#ff4f5e" stroke={K} strokeWidth="1.6" />
      <P d="M12 44l8-14 8 14z" f="#8f9bbb" />
    </>
  ),
  shades: (
    <>
      <L d="M3 18h42" c="#c9cfe0" w={3} />
      <P d="M6 17h15l-1 9a6 6 0 0 1-6 5h-2a6 6 0 0 1-6-5z" f="#4b3f7a" />
      <P d="M27 17h15l-1 9a6 6 0 0 1-6 5h-2a6 6 0 0 1-6-5z" f="#4b3f7a" />
      <S d="M9 19.5h6l-4.4 8z" op={0.5} />
      <S d="M30 19.5h6l-4.4 8z" op={0.5} />
    </>
  ),
  gem: (
    <>
      <P d="M14 8h20l8 11-18 23L6 19z" f="#7fd8ff" />
      <P d="M6 19h36" f="none" />
      <path d="M14 8l4 11 6-11 6 11 4-11M6 19l18 23 18-23M18 19l6 23 6-23" fill="none" stroke="#3a9bd0" strokeWidth="1.4" strokeLinejoin="round" />
      <S d="M15 10h7l-4 8H9z" op={0.55} />
    </>
  ),
  palette: (
    <>
      <P d="M24 5C12 5 4 13 4 23c0 10 8 18 18 18 3 0 4-2 3-4.6-1-2.4.4-4.4 3-4.4h6c5 0 10-4 10-10C44 12 35 5 24 5z" f="#f3e7c9" />
      <circle cx="14" cy="22" r="3.4" fill="#ff4f5e" />
      <circle cx="19" cy="13" r="3.4" fill="#ffcf5a" />
      <circle cx="29" cy="12" r="3.4" fill="#5fdc8a" />
      <circle cx="36" cy="20" r="3.4" fill="#5b8bff" />
    </>
  ),
  horse: (
    <>
      <P d="M12 44c0-10 2-17 7-23l-2-9 5 4c3-2 6-3 10-2 5 2 8 7 9 12 .6 3-1 5-3.4 5.2-2 .2-3.4-1-4.6-2.6L30 26c-1 4 0 10 2 18z" f="#c08452" />
      <P d="M17 12l5 4c-2 2-4 4-5 6-2-3-2-7 0-10z" f="#8a5a32" />
      <path d="M20 17c-4 4-7 10-8 17" fill="none" stroke="#6a3c1c" strokeWidth="4" strokeLinecap="round" />
      <circle cx="31.5" cy="18" r="1.8" fill={K} />
      <circle cx="40.6" cy="27.4" r="1.1" fill={K} />
      <S d="M27 15c2-1 4-1 6 0l-1 1.6c-1.6-.6-3-.6-4.4 0z" />
    </>
  ),
  walker: (
    <>
      <C cx={26} cy={7} r={4.6} f="#ffd6b8" />
      <L d="M25 14l-3 13 6 6v10M22 27l-6 16M24 17l-8 6M25 17l7 7 6-2" c={K} w={6.4} />
      <L d="M25 14l-3 13 6 6v10M22 27l-6 16M24 17l-8 6M25 17l7 7 6-2" c="#5b8bff" w={3.4} />
    </>
  ),
  layers: (
    <>
      <P d="M24 26L4 17l20-9 20 9z" f="#8fb0ff" />
      <P d="M8 23l-4 2 20 9 20-9-4-2-16 7z" f="#5b8bff" />
      <P d="M8 31l-4 2 20 9 20-9-4-2-16 7z" f="#3f6fe0" />
      <S d="M12 16l12-5.4 3 1.4-12 5.4z" op={0.5} />
    </>
  ),
  mountain: (
    <>
      <P d="M2 42l15-26 8 12 6-8 15 22z" f="#8f9bbb" />
      <P d="M17 16l-5 9 3-1 2 3 3-3 3 2z" f="#f4f6fb" />
      <P d="M31 20l-3.6 5 2.6-.6 1.6 2 2.2-2 1.8 1z" f="#f4f6fb" />
    </>
  ),
  leafy: (
    <>
      <P d="M8 40C6 22 18 8 42 6c0 22-14 36-34 34z" f="#5fdc8a" />
      <L d="M8 40C16 30 24 22 36 12M18 30h9M24 24v-8" c="#2f8a4f" w={2.2} />
      <S d="M14 30c2-8 8-15 16-19-6 5-10 11-13 19z" op={0.35} />
    </>
  ),
  ruler: (
    <>
      <P d="M4 34L34 4l10 10-30 30z" f="#ffcf5a" />
      <L d="M12 26l4 4M17 21l3 3M22 16l4 4M27 11l3 3M32 6l4 4" c="#8a5a12" w={2} />
    </>
  ),
  mage: (
    <>
      <P d="M24 3L12 34h24z" f="#7b4fd6" />
      <P d="M6 34h36l-3 6H9z" f="#5a36a8" />
      <path d={star(25, 17, 4, 1.7)} fill="#ffcf5a" />
      <circle cx="20" cy="27" r="1.6" fill="#ffcf5a" />
      <circle cx="29" cy="25" r="1.2" fill="#ffcf5a" />
    </>
  ),
  frame: (
    <>
      <P d="M5 8h38v32H5z" f="#d6a14a" />
      <P d="M10 13h28v22H10z" f="#9fd8ff" />
      <P d="M10 35l9-11 6 7 4-4 9 8z" f="#5fdc8a" o={false} />
      <circle cx="31" cy="19" r="3" fill="#ffcf5a" />
    </>
  ),
  memo: (
    <>
      <P d="M8 5h24l8 8v30H8z" f="#f4f6fb" />
      <P d="M32 5v8h8" f="#dfe6f4" />
      <L d="M14 20h18M14 26h18M14 32h12" c="#9aa3b8" w={2.2} />
      <P d="M38 22l5 5-13 13-6 1 1-6z" f="#ffcf5a" />
    </>
  ),
  sleigh: (
    <>
      <P d="M8 14c0-4 3-6 6-6v4c-1 0-2 1-2 2v12h22l6-8h4l-6 14H12a4 4 0 0 1-4-4z" f="#e23a3a" />
      <P d="M12 18h20v8H12z" f="#ffcf5a" o={false} />
      <path d="M12 26h22" stroke={K} strokeWidth="2" />
      <L d="M4 41h32c5 0 8-2 9-6" c={K} w={3.4} />
      <L d="M4 41h32c5 0 8-2 9-6" c="#d6dcea" w={1.4} />
      <L d="M14 34v7M32 34v7" c={K} w={2.6} />
      <S d="M10 15c0-2 1.4-3.4 3-3.6v2c-1 .4-1.4 1-1.4 2z" />
    </>
  ),
  boom: (
    <>
      <P d="M24 3l4.6 10.6L39 8l-3.6 11.2L46 24l-10.6 4.6L39 40l-11-4.4L24 46l-4-10.4L9 40l3.6-11.4L2 24l10.6-4.8L9 8l11 5.6z" f="#ff8a2a" />
      <P d="M24 12l2.6 7 7.4-2.4-3 6.8L37 27l-7 1.6 1.4 7.4L24 32l-6.4 4 1.4-7.4L11 27l6-3.6-3-6.8 7.4 2.4z" f="#ffd257" o={false} />
    </>
  ),
  info: (
    <>
      <C cx={24} cy={24} r={19} f="#5b8bff" />
      <circle cx="24" cy="14.5" r="3" fill="#fff" />
      <path d="M24 21v15" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  flask: (
    <>
      <P d="M19 4h10v12l11 22a4 4 0 0 1-3.6 6H11.6A4 4 0 0 1 8 38l11-22z" f="#eef3fb" />
      <path d="M13 30h22l4.2 8.6a2.4 2.4 0 0 1-2.2 3.4H11a2.4 2.4 0 0 1-2.2-3.4z" fill="#5fdc8a" />
      <L d="M17 4h14" c={K} w={2.6} />
      <circle cx="20" cy="36" r="2" fill="#fff" opacity=".7" />
      <circle cx="27" cy="33" r="1.4" fill="#fff" opacity=".7" />
    </>
  ),
  pin: (
    <>
      <P d="M24 44C16 34 10 26 10 18a14 14 0 0 1 28 0c0 8-6 16-14 26z" f="#ff4f5e" />
      <C cx={24} cy={18} r={5.5} f="#fff" />
      <path d="M15 14a10 10 0 0 1 6-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".6" />
    </>
  ),
  road: (
    <>
      <P d="M18 4h12l12 40H6z" f="#4a4560" />
      <path d="M24 8v6M24 20v7M24 33v8" stroke="#ffd257" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M17.6 6.6L9.6 41M30.4 6.6l8 34.4" stroke="#f4f6fb" strokeWidth="1.4" opacity=".8" />
    </>
  ),
  envelope: (
    <>
      <P d="M5 12h38v26H5z" f="#f4f6fb" />
      <P d="M5 12l19 15 19-15" f="#dfe6f4" />
      <L d="M5 38l14-12M43 38L29 26" c="#b9c4dc" w={1.6} />
    </>
  ),
  cone: (
    <>
      <P d="M19 6h10l9 32H10z" f="#ff8a2a" />
      <path d="M17.4 14h13.2l1.6 6H15.8zM14.6 25h18.8l1.8 6H12.8z" fill="#f4f6fb" />
      <P d="M5 38h38v5H5z" f="#3a3552" />
    </>
  ),
  pen: (
    <>
      <P d="M34 4l10 10-24 24-12 2 2-12z" f="#5b8bff" />
      <P d="M30 8l10 10" f="none" />
      <L d="M30 8l10 10" c={K} w={2} />
      <P d="M10 28l10 10-12 2z" f="#f3e7c9" />
      <path d="M8 40l2.4-5 2.6 2.6z" fill={K} />
      <L d="M22 44h20" c="#9aa3b8" w={2} />
    </>
  ),
  dice: (
    <>
      <P d="M8 12l16-7 16 7v22l-16 9-16-9z" f="#f4f6fb" />
      <P d="M8 12l16 8 16-8" f="none" />
      <L d="M24 20v23" c={K} w={2} />
      <path d="M8 12l16 8 16-8-16-7z" fill="#e3e8f4" stroke={K} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="24" cy="12.5" rx="2.4" ry="1.4" fill="#ff4f5e" />
      <circle cx="14" cy="24" r="1.8" fill={K} />
      <circle cx="18" cy="32" r="1.8" fill={K} />
      <circle cx="30" cy="25" r="1.8" fill={K} />
      <circle cx="34" cy="31" r="1.8" fill={K} />
      <circle cx="32" cy="28" r="1.8" fill={K} />
    </>
  ),
  crown: (
    <>
      <P d="M5 16l9 8 10-14 10 14 9-8-4 22H9z" f="#ffcf5a" />
      <P d="M9 38h30v5H9z" f="#e09a32" />
      <circle cx="24" cy="28" r="3" fill="#ff4f5e" stroke={K} strokeWidth="1.4" />
      <circle cx="14" cy="31" r="2" fill="#5b8bff" />
      <circle cx="34" cy="31" r="2" fill="#5fdc8a" />
    </>
  ),
  baby: (
    <>
      <C cx={24} cy={24} r={17} f="#ffd6b8" />
      <path d="M17 22a2 2 0 1 0 4 0M27 22a2 2 0 1 0 4 0" fill="none" stroke={K} strokeWidth="2" strokeLinecap="round" />
      <path d="M19 31c3 3 7 3 10 0" fill="none" stroke={K} strokeWidth="2" strokeLinecap="round" />
      <path d="M22 8c2 0 4 2 3 4" fill="none" stroke={K} strokeWidth="2" strokeLinecap="round" />
      <circle cx="15" cy="28" r="2" fill="#ff9ec4" opacity=".7" />
      <circle cx="33" cy="28" r="2" fill="#ff9ec4" opacity=".7" />
    </>
  ),
  book: (
    <>
      <P d="M8 6h28a4 4 0 0 1 4 4v32H12a4 4 0 0 1-4-4z" f="#5b8bff" />
      <P d="M12 34h28v8H12a4 4 0 0 1 0-8z" f="#f4f6fb" />
      <L d="M16 14h16M16 20h12" c="#cfe0ff" w={2.2} />
    </>
  ),
  phone: (
    <>
      <P d="M14 3h20a3 3 0 0 1 3 3v36a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" f="#3a3552" />
      <P d="M14 8h20v30H14z" f="#9fd8ff" />
      <circle cx="24" cy="41.5" r="1.6" fill="#9aa3b8" />
      <L d="M18 15h12M18 21h8" c="#fff" w={2} op={0.8} />
    </>
  ),
  backpack: (
    <>
      <L d="M17 10V8a7 7 0 0 1 14 0v2" c={K} w={2.6} />
      <P d="M12 10h24a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" f="#d6823a" />
      <P d="M14 26h20v12H14z" f="#b8662a" />
      <L d="M14 30h20" c={K} w={1.6} />
      <circle cx="24" cy="18" r="2" fill="#ffcf5a" />
    </>
  ),
  skull: (
    <>
      <P d="M24 5C14 5 8 12 8 21c0 6 3 10 7 12v6h18v-6c4-2 7-6 7-12 0-9-6-16-16-16z" f="#f4f1ea" />
      <ellipse cx="17.5" cy="22" rx="4.4" ry="5" fill={K} />
      <ellipse cx="30.5" cy="22" rx="4.4" ry="5" fill={K} />
      <path d="M24 27l-2.6 5h5.2z" fill={K} />
      <L d="M19 39v-4M24 39v-4M29 39v-4" c={K} w={1.8} />
    </>
  ),
  ufo: (
    <>
      <P d="M15 22a9 9 0 0 1 18 0z" f="#9fe8ff" />
      <P d="M4 26c0-3 9-5 20-5s20 2 20 5-9 7-20 7-20-4-20-7z" f="#a9b6d6" />
      <circle cx="13" cy="27" r="1.8" fill="#ffe27a" />
      <circle cx="24" cy="29" r="1.8" fill="#ffe27a" />
      <circle cx="35" cy="27" r="1.8" fill="#ffe27a" />
      <path d="M16 33l-4 11h24l-4-11z" fill="#d6ffe4" opacity=".35" />
    </>
  ),
  cake: (
    <>
      <L d="M17 8v6M24 6v8M31 8v6" c="#ff9ec4" w={2.6} />
      <path d="M17 4c1 1.4 1 2.6 0 3.6M24 2c1 1.4 1 2.6 0 3.6M31 4c1 1.4 1 2.6 0 3.6" fill="#ffb347" stroke="#ffb347" strokeWidth="2" />
      <P d="M9 22c0-4 7-7 15-7s15 3 15 7v18H9z" f="#ffd1e0" />
      <P d="M9 22c0 3 7 5 15 5s15-2 15-5c-1 4-3 6-5 6-2 0-2-2-4-2s-2 3-6 3-4-3-6-3-2 2-4 2-4-2-5-6z" f="#fff" o={false} />
      <P d="M6 40h36v4H6z" f="#9aa3b8" />
      <L d="M9 33h30" c="#ff6fa0" w={2} />
    </>
  ),
  balloon: (
    <>
      <L d="M24 33c-2 4 3 6 0 12" c="#e8ecf6" w={1.4} />
      <P d="M24 3c-8 0-13 6-13 13 0 8 7 15 13 17 6-2 13-9 13-17 0-7-5-13-13-13z" f="#ff4f5e" />
      <P d="M22 33h4l1 3h-6z" f="#d6343b" />
      <S d="M16 12c1-3 3.4-5 6-5.6l.4 1.4c-2.2.6-4 2.4-4.8 4.8z" op={0.7} />
    </>
  ),
  champagne: (
    <>
      <g transform="rotate(-14 16 24)">
        <P d="M10 6h12l-1 12a5 5 0 0 1-10 0z" f="#fff3c4" />
        <L d="M16 23v14M11 38h10" c="#e8ecf6" w={2.4} />
      </g>
      <g transform="rotate(14 32 24)">
        <P d="M26 6h12l-1 12a5 5 0 0 1-10 0z" f="#fff3c4" />
        <L d="M32 23v14M27 38h10" c="#e8ecf6" w={2.4} />
      </g>
      <path d={star(24, 6, 4, 1.4, 4, 0)} fill="#ffe27a" />
    </>
  ),
  disco: (
    <>
      <L d="M24 2v6" c="#9aa3b8" w={2} />
      <C cx={24} cy={26} r={18} f="#b9c4dc" />
      <path d="M8 22h32M7 30h34M10 15h28M10 37h28M24 8v36M15 10c-3 10-3 22 0 32M33 10c3 10 3 22 0 32" fill="none" stroke="#7d8bb0" strokeWidth="1.4" />
      <path d="M15 17h6v6h-6zM27 25h6v6h-6zM21 31h5v5h-5z" fill="#fff" opacity=".85" />
      <path d="M33 15h4v4h-4z" fill="#ff9ec4" />
      <path d="M12 27h4v4h-4z" fill="#9fd8ff" />
    </>
  ),
  potato: (
    <>
      <P d="M10 14c6-8 22-8 28 0 6 8 4 22-6 26-8 3-18 2-23-4-5-6-4-16 1-22z" f="#d8a865" />
      <circle cx="18" cy="18" r="1.4" fill="#9b6a3c" />
      <circle cx="30" cy="16" r="1.2" fill="#9b6a3c" />
      <circle cx="33" cy="28" r="1.4" fill="#9b6a3c" />
      <circle cx="16" cy="31" r="1.2" fill="#9b6a3c" />
      <circle cx="24" cy="25" r="1.1" fill="#9b6a3c" />
    </>
  ),
  pirate: (
    <>
      <L d="M8 4v40" c="#9b6a3c" w={3.4} />
      <P d="M10 6h30l-4 9 4 9H10z" f="#1d1a24" />
      <circle cx="25" cy="13.6" r="4" fill="#f4f1ea" />
      <L d="M19 18l12 4M31 18l-12 4" c="#f4f1ea" w={1.8} />
      <circle cx="23.6" cy="13" r="1" fill={K} />
      <circle cx="26.4" cy="13" r="1" fill={K} />
    </>
  ),
  bottle: (
    <>
      <P d="M20 4h8v5h-8z" f="#ff9ec4" />
      <P d="M18 9h12l-1 4H19z" f="#e8ecf6" />
      <P d="M17 13h14a3 3 0 0 1 3 3v24a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V16a3 3 0 0 1 3-3z" f="#e9f4ff" />
      <path d="M15 26h18v14a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z" fill="#fff8e6" />
      <L d="M20 20h3M20 25h3M20 30h3" c="#9fb4e6" w={1.6} />
    </>
  ),
  demon: (
    <>
      <P d="M12 14l-4-11 9 7zM36 14l4-11-9 7z" f="#ff4f5e" />
      <C cx={24} cy={26} r={17} f="#9b5be0" />
      <path d="M14 21l7 3M34 21l-7 3" stroke={K} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="18" cy="26" rx="2" ry="2.6" fill={K} />
      <ellipse cx="30" cy="26" rx="2" ry="2.6" fill={K} />
      <path d="M15 32c5 6 13 6 18 0" fill="none" stroke={K} strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  lizard: (
    <>
      <P d="M40 10c3 0 5 2 4 4-1 3-5 3-8 4-5 2-7 7-9 12-2 6-6 12-14 14-5 1-10-1-11-3 6 1 11-2 13-7 2-6 4-13 9-18 4-4 9-6 16-6z" f="#7fd36a" />
      <L d="M30 18l-4-6M27 25l6 1M18 33l-5-3M20 37l2 5" c="#4e9a3c" w={2.2} />
      <circle cx="40" cy="12.6" r="1.2" fill={K} />
    </>
  ),
  fire: (
    <>
      <P d="M24 3c3 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 5-12 1 4 3 5 4 5-1-6 0-12 3-17z" f="#ff7a2a" />
      <P d="M24 22c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 2 3 2z" f="#ffd36b" />
    </>
  ),
  tooth: (
    <>
      <P d="M12 8c4-4 8-3 12-1 4-2 8-3 12 1 4 4 3 11 1 15-2 5-2 9-3 14-1 4-4 5-5 1l-2-9c-1-3-5-3-6 0l-2 9c-1 4-4 3-5-1-1-5-1-9-3-14-2-4-3-11 1-15z" f="#f4f6fb" />
      <S d="M15 12c2-2 4-2 6-1l-.6 1.4c-1.4-.6-3-.4-4.2.6z" op={0.8} />
    </>
  ),
  eye: (
    <>
      <P d="M3 24c5-9 12-14 21-14s16 5 21 14c-5 9-12 14-21 14S8 33 3 24z" f="#f4f6fb" />
      <C cx={24} cy={24} r={8.4} f="#5b8bff" />
      <circle cx="24" cy="24" r="4" fill={K} />
      <circle cx="26.4" cy="21.6" r="1.8" fill="#fff" />
    </>
  ),
  mouse: (
    <>
      <P d="M24 4c-8 0-12 6-12 13v12c0 8 5 15 12 15s12-7 12-15V17c0-7-4-13-12-13z" f="#e8ecf6" />
      <L d="M12 19h24M24 4v15" c={K} w={2} />
      <P d="M22 9h4v7h-4z" f="#9aa3b8" />
    </>
  ),
  octopus: (
    <>
      <P d="M24 4c-9 0-14 7-14 14 0 4 1 7 3 9-3 3-7 4-10 4 3 3 8 3 11 1 0 4-2 8-5 10 4 1 8-1 10-5 1 4 3 7 5 8 2-1 4-4 5-8 2 4 6 6 10 5-3-2-5-6-5-10 3 2 8 2 11-1-3 0-7-1-10-4 2-2 3-5 3-9 0-7-5-14-14-14z" f="#ff7aa8" />
      <circle cx="19" cy="17" r="2.4" fill="#fff" stroke={K} strokeWidth="1.4" />
      <circle cx="29" cy="17" r="2.4" fill="#fff" stroke={K} strokeWidth="1.4" />
      <circle cx="19.4" cy="17.4" r="1" fill={K} />
      <circle cx="29.4" cy="17.4" r="1" fill={K} />
    </>
  ),
  tropical: (
    <>
      <P d="M5 24c7-11 22-12 30-4l8-7-1 11 1 11-8-7c-8 8-23 7-30-4z" f="#ffb347" />
      <path d="M15 14c3 6 3 14 0 20h5c2-6 2-14 0-20zM27 15c2 6 2 12 0 18h4c1-6 1-12 0-18z" fill="#f4f6fb" stroke={K} strokeWidth="1.2" />
      <circle cx="11" cy="22" r="1.6" fill={K} />
    </>
  ),
  jelly: (
    <>
      <P d="M8 22a16 16 0 0 1 32 0c-3 2-5 1-8 0-3 2-6 2-8 0-3 2-5 2-8 0-3 1-5 2-8 0z" f="#c9a6ff" />
      <L d="M14 24c-2 6 2 10 0 18M21 24c-1 6 2 12 0 18M27 24c1 6-2 12 0 18M34 24c2 6-2 10 0 18" c="#e6d6ff" w={2} />
      <S d="M14 14c2-3 5-5 8-5.6l.4 1.4c-2.6.6-5 2.2-6.6 4.6z" op={0.6} />
    </>
  ),
  runner: (
    <>
      <C cx={30} cy={8} r={4.4} f="#ffb48a" />
      <L d="M27 15l-6 11 7 5-3 11M21 26l-8 6M27 15l7 7 7-2M27 15l-8 2-4 6" c={K} w={6} />
      <L d="M27 15l-6 11 7 5-3 11M21 26l-8 6M27 15l7 7 7-2M27 15l-8 2-4 6" c="#5b8bff" w={3.2} />
      <L d="M3 20h7M5 28h6" c="#9fd8ff" w={2.2} />
    </>
  ),
  dagger: (
    <>
      <P d="M24 3l4 6v19h-8V9z" f="#dfe6f4" />
      <P d="M14 28h20v4H14z" f="#ffcf5a" />
      <P d="M21 32h6v10h-6z" f="#9b6a3c" />
      <C cx={24} cy={44} r={2.4} f="#ffcf5a" />
    </>
  ),
  calendar: (
    <>
      <P d="M7 9h34a2 2 0 0 1 2 2v30a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z" f="#f4f6fb" />
      <P d="M5 11a2 2 0 0 1 2-2h34a2 2 0 0 1 2 2v7H5z" f="#ff4f5e" />
      <L d="M15 5v8M33 5v8" c={K} w={3} />
      {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => <rect key={`${c}${r}`} x={10 + c * 7.5} y={22 + r * 6.4} width="4.6" height="3.8" rx="1" fill={c === 2 && r === 1 ? "#5b8bff" : "#c9d1e6"} />))}
    </>
  ),
  clock: (
    <>
      <C cx={24} cy={24} r={19} f="#f4f6fb" />
      <L d="M24 11v13l8 5" c={K} w={3} />
      <L d="M24 7v2M24 39v2M7 24h2M39 24h2" c="#9aa3b8" w={2} />
      <circle cx="24" cy="24" r="2" fill="#ff4f5e" />
    </>
  ),
  gamepad: (
    <>
      <P d="M14 14h20c6 0 10 5 10 12 0 8-3 13-7 13-3 0-5-4-8-4H19c-3 0-5 4-8 4-4 0-7-5-7-13 0-7 4-12 10-12z" f="#7a86b8" />
      <L d="M14 21v8M10 25h8" c="#fff" w={3} />
      <circle cx="33" cy="22" r="2.2" fill="#ff4f5e" />
      <circle cx="37" cy="27" r="2.2" fill="#5fdc8a" />
    </>
  ),
  receipt: (
    <>
      <P d="M10 4h28v40l-4-3-4 3-4-3-4 3-4-3-4 3-4-3z" f="#f4f6fb" />
      <L d="M16 13h16M16 19h16M16 25h10" c="#9aa3b8" w={2} />
      <L d="M16 33h16" c={K} w={2.4} />
    </>
  ),
  store: (
    <>
      <P d="M6 20h36v22H6z" f="#f3e7c9" />
      <P d="M4 12l4-7h32l4 7v4a5 5 0 0 1-10 0 5 5 0 0 1-10 0 5 5 0 0 1-10 0 5 5 0 0 1-10 0z" f="#ff6b5e" />
      <path d="M14 12v4M24 12v4M34 12v4" stroke="#fff" strokeWidth="5" opacity=".55" />
      <P d="M11 26h11v16H11z" f="#7a5230" />
      <P d="M27 26h10v8H27z" f="#9fd8ff" />
    </>
  ),
  footprints: (
    <>
      <P d="M13 14c3-1 6 2 6 7s-1 9-4 9-5-4-5-8 0-7 3-8z" f="#c9a27a" />
      <P d="M31 18c3-1 6 2 6 7s-1 9-4 9-5-4-5-8 0-7 3-8z" f="#c9a27a" />
      <ellipse cx="14.6" cy="35" rx="3.4" ry="3" fill="#c9a27a" stroke={K} strokeWidth="1.6" />
      <ellipse cx="32.6" cy="39" rx="3.4" ry="3" fill="#c9a27a" stroke={K} strokeWidth="1.6" />
    </>
  ),
  muscle: (
    <>
      <P d="M8 40c-2-8 0-16 6-22l4-8c1-3 5-4 7-2l2 2-4 6 2 3c6-3 13-2 16 4 3 6 0 13-7 16-8 3-18 3-26 1z" f="#ffb48a" />
      <L d="M24 22c-2 4-2 8 1 11M30 28c3 1 5 3 6 6" c="#c97a54" w={1.8} />
    </>
  ),
  heart: (
    <>
      <P d={HEART(24, 24, 1.9)} f="#ff4f7e" />
      <S d="M12 16a6 6 0 0 1 5-4l.4 1.6a4.6 4.6 0 0 0-3.8 3.2z" op={0.6} />
    </>
  ),
  tulip: (
    <>
      <L d="M24 44V22" c="#3e8f50" w={3} />
      <P d="M24 40c-6-2-10-7-11-14 6 1 10 5 11 10z" f="#4fbf7a" />
      <P d="M24 36c5-2 9-7 10-12-6 1-9 4-10 8z" f="#3aa35e" />
      <P d="M15 8c0 8 2 14 9 14s9-6 9-14l-4.6 4L24 5l-4.4 7z" f="#ff5a6e" />
      <S d="M18 11c0 4 1 7 3 8.4l-.8 1.2C17.6 19 16.6 15.6 16.6 11.6z" op={0.5} />
    </>
  ),
  chick: (
    <>
      <P d="M9 30c0-9 7-16 15-16s15 7 15 16c0 7-6 12-15 12S9 37 9 30z" f="#ffe27a" />
      <P d="M9 32l6-4 4 4 5-4 5 4 4-4 6 4v4c-2 4-7 7-15 7s-13-3-15-7z" f="#f4f1ea" />
      <path d="M10 32l5-3.4 4 3.4 5-3.4 5 3.4 4-3.4 5 3.4" fill="none" stroke={K} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="19" cy="22" r="1.6" fill={K} />
      <circle cx="29" cy="22" r="1.6" fill={K} />
      <P d="M22 25h4l-2 3z" f="#ff9a4c" o={1.2} />
      <P d="M21 14c0-4 3-6 3-6s3 2 3 6" f="#ffe27a" o={1.4} />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;
