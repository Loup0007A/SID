#!/usr/bin/env node
/**
 * Fonds du site (Lot 90) : génère, pour le S.I.D. et pour chaque évent,
 *  - public/fonds/<clé>.svg   le motif du fond (formes en transparence) ;
 *  - public/fonds/p-<clé>.svg la forme des particules qui tombent (masque) ;
 *  - src/app/fonds.css        les couleurs de chaque thème.
 * Toujours le même résultat (hasard à graine). Relancer après un changement :
 *   node scripts/fonds.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const W = 1600;
const H = 1000;

// ─── Hasard à graine ───────────────────────────────────────────────────
function rng(seed) {
  let a = 0;
  for (const c of seed) a = (Math.imul(a ^ c.charCodeAt(0), 2654435761) + 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f1 = (x) => Math.round(x * 10) / 10;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");

// Lisibilité (Lot 95) : le fond est assombri, teinte gardée, juste assez
// pour que le texte crème posé dessus atteigne 4,6:1 (WCAG AA : 4,5:1).
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function lisible(fond, creme, cible = 4.6) {
  let h = fond;
  for (let k = 1; contraste(h, creme) < cible && k < 100; k++) {
    h = "#" + [1, 3, 5].map((i) => Math.round(parseInt(fond.slice(i, i + 2), 16) * (1 - k / 100)).toString(16).padStart(2, "0")).join("");
  }
  return h;
}

// ─── Formes (unité : environ -50…50, centrées) ────────────────────────
// Chaque forme rend du SVG pour une couleur donnée.
const P = (d, c, extra = "") => `<path d="${d}" fill="${c}"${extra}/>`;
const star = (n, ro, ri) => {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 ? ri : ro;
    d += `${i ? "L" : "M"}${f1(Math.cos(a) * r)} ${f1(Math.sin(a) * r)}`;
  }
  return d + "Z";
};
const circle = (cx, cy, r) => `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(r * 2)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-r * 2)} 0Z`;
const lens = "M0 -50C24 -24 24 24 0 50C-24 24 -24 -24 0 -50Z";

const SHAPES = {
  // Éclat du sceau : pointe vers l'extérieur, large aux deux tiers, fin au pied.
  eclat: (c) => P("M0 -50C6 -40 20 -22 22 -10C23 4 8 30 0 50C-8 30 -23 4 -22 -10C-20 -22 -6 -40 0 -50Z", c),
  heart: (c) => P("M0 34C-44 6 -50 -26 -26 -38C-12 -45 -2 -36 0 -26C2 -36 12 -45 26 -38C50 -26 44 6 0 34Z", c),
  star5: (c) => P(star(5, 50, 21), c),
  star4: (c) => P("M0 -50C5 -10 10 -5 50 0C10 5 5 10 0 50C-5 10 -10 5 -50 0C-10 -5 -5 -10 0 -50Z", c),
  snowflake: (c) => {
    let g = "";
    for (let i = 0; i < 6; i++) {
      g += `<g transform="rotate(${i * 60})"><path d="M0 0V-48M0 -30L-12 -40M0 -30L12 -40M0 -16L-9 -24M0 -16L9 -24" stroke="${c}" stroke-width="6" stroke-linecap="round" fill="none"/></g>`;
    }
    return g;
  },
  bauble: (c) => P(circle(0, 6, 40) + "M-9 -42h18v10h-18Z", c),
  bat: (c) => P("M0 -8L4 -18L7 -9C9 -10 11 -11 12 -10C24 -24 40 -22 50 -12C44 -8 40 -4 38 2C34 -2 28 -2 25 4C21 -1 15 0 12 6C8 4 4 8 0 14C-4 8 -8 4 -12 6C-15 0 -21 -1 -25 4C-28 -2 -34 -2 -38 2C-40 -4 -44 -8 -50 -12C-40 -22 -24 -24 -12 -10C-11 -11 -9 -10 -7 -9L-4 -18Z", c),
  moon: (c) => P("M14 -46A47 47 0 1 0 14 46A36 36 0 1 1 14 -46Z", c),
  pumpkin: (c) => P("M-4 -24C-4 -34 0 -42 10 -44L12 -38C6 -36 4 -30 4 -24Z", c) + `<g fill="${c}"><ellipse cx="-20" cy="8" rx="22" ry="30"/><ellipse cx="20" cy="8" rx="22" ry="30"/><ellipse cx="0" cy="6" rx="22" ry="32"/></g>`,
  fish: (c) => P("M-46 0C-26 -26 14 -26 28 0C14 26 -26 26 -46 0ZM28 0L50 -20V20Z" + circle(-28, -5, 5), c, ' fill-rule="evenodd"'),
  bubble: (c) => P(circle(0, 0, 40) + circle(0, 0, 30), c, ' fill-rule="evenodd"'),
  egg: (c) => P("M0 -48C26 -48 38 2 36 18C34 38 18 48 0 48C-18 48 -34 38 -36 18C-38 2 -26 -48 0 -48Z", c),
  flower: (c) => {
    let d = "";
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      d += circle(Math.cos(a) * 26, Math.sin(a) * 26, 20);
    }
    return P(d, c) + P(circle(0, 0, 12), "#ffffff", ' fill-opacity="0.5"');
  },
  leaf: (c) => P(lens, c),
  bell: (c) => P("M-16 -8C-16 -28 16 -28 16 -8L20 12C14 8 10 16 5 11C1 17 -3 17 -5 11C-10 16 -14 8 -20 12ZM-3 -34h6v10h-6Z", c),
  note: (c) => P("M8 -44h7v66h-7ZM15 -44C34 -34 38 -14 26 -2C30 -16 24 -26 15 -28Z", c) + `<ellipse cx="-4" cy="24" rx="15" ry="11" transform="rotate(-22 -4 24)" fill="${c}"/>`,
  vinyl: (c) => P(circle(0, 0, 46) + circle(0, 0, 9), c, ' fill-rule="evenodd"'),
  poppy: (c) => P(circle(-16, -12, 22) + circle(16, -12, 22) + circle(-14, 14, 22) + circle(14, 14, 22), c),
  cornflower: (c) => {
    let d = "";
    for (let i = 0; i < 12; i++) d += `<path transform="rotate(${i * 30})" d="M0 -8L-7 -44L-2 -38L0 -48L2 -38L7 -44Z" fill="${c}"/>`;
    return d + P(circle(0, 0, 9), c);
  },
  burst: (c) => {
    let g = "";
    for (let i = 0; i < 14; i++) {
      const L = i % 2 ? 40 : 50;
      g += `<g transform="rotate(${f1((i * 360) / 14)})"><path d="M0 -10L2.5 -${L - 8}L0 -${L - 4}L-2.5 -${L - 8}Z" fill="${c}"/><circle cx="0" cy="-${L}" r="3.5" fill="${c}"/></g>`;
    }
    return g;
  },
  confetti: (c) => P("M-30 -10H30V10H-30Z", c),
  flame: (c) => P("M0 -50C18 -22 32 -4 32 16A32 32 0 0 1 -32 16C-32 -4 -18 -22 0 -50Z", c),
  claw: (c) =>
    P("M-30 -46C-14 -18 -14 18 -30 46C-22 18 -22 -18 -30 -46Z", c) +
    P("M-2 -50C14 -18 14 18 -2 50C6 18 6 -18 -2 -50Z", c) +
    P("M26 -46C42 -18 42 18 26 46C34 18 34 -18 26 -46Z", c),
  ballot: (c) => P("M-40 -28H40V32H-40ZM-40 -28L0 4L40 -28", c, ` stroke="${c}"`) + P("M-14 -6L-4 6L16 -16", "none", ` stroke="#ffffff" stroke-opacity="0.6" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"`),
  dot: (c) => P(circle(0, 0, 50), c),
  cocarde: (c) => P(circle(0, 0, 50) + circle(0, 0, 36) + circle(0, 0, 22), c, ' fill-rule="evenodd"'),
  // Coup d'État : panneau d'alerte, goutte, bande de chevrons.
  alerte: (c) => P("M0 -46L48 40H-48ZM-5 -14H5L3 16H-3ZM0 22A5 5 0 1 1 -0.1 22Z", c, ' fill-rule="evenodd"'),
  goutte: (c) => P("M0 -50C14 -26 32 -6 32 16A32 32 0 0 1 -32 16C-32 -6 -14 -26 0 -50Z", c),
  chevrons: (c) => P("M-50 -14L-30 -14L-10 14L-30 14ZM-14 -14L6 -14L26 14L6 14ZM22 -14L42 -14L62 14L42 14Z", c),
};

// Formes qui ont un haut et un bas : peu tournées.
const UPRIGHT = { pumpkin: 18, bell: 25, egg: 30, note: 20, ballot: 14, flame: 16, fish: 30, bat: 25, heart: 30, poppy: 360, bauble: 20 };
const tilt = (r, shape) => { const a = UPRIGHT[shape]; return a === undefined ? r() * 360 : (r() - 0.5) * 2 * a; };

// ─── Composition ───────────────────────────────────────────────────────
// Rosettes : rayons d'une même forme autour d'un centre (le sceau).
function rosette(r, x, y, R, shape, colors, op) {
  const n = 7 + Math.floor(r() * 6);
  let g = `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(r() * 360)})">`;
  for (let i = 0; i < n; i++) {
    const a = (i * 360) / n + (r() - 0.5) * 22;
    const L = R * (0.45 + r() * 0.55);
    const s = L / 100;
    const c = colors[Math.floor(r() * colors.length)];
    g += `<g transform="rotate(${f1(a)}) translate(0 ${f1(-R * 0.3 - L / 2)}) scale(${f1(s * 1.15 * 100) / 100} ${f1(s * 100) / 100})" opacity="${f1((op[0] + r() * (op[1] - op[0])) * 100) / 100}">${SHAPES[shape](c)}</g>`;
  }
  return g + "</g>";
}

function place(r, items, placed, tries = 60) {
  const out = [];
  for (const it of items) {
    for (let k = 0; k < tries; k++) {
      const x = it.x ?? r() * W;
      const y = it.y ?? r() * H;
      const ok = placed.every((p) => Math.hypot(p.x - x, p.y - y) > (p.s + it.s) * 0.5);
      if (ok || it.x !== undefined || k === tries - 1) {
        placed.push({ x, y, s: it.s });
        out.push({ ...it, x, y });
        break;
      }
    }
  }
  return out;
}

function motif(key, t) {
  const r = rng("fond-" + key);
  const op = t.opacity ?? [0.16, 0.26];
  let body = "";
  const placed = [];
  // Grandes formes : coins et bords (là où le contenu ne passe pas).
  const big = [
    { x: W - 60, y: 70, s: 520 },
    { x: 60, y: H - 50, s: 560 },
    { x: W - 260, y: H - 140, s: 260 },
    { x: 300, y: 120, s: 220 },
  ];
  const sizes = [...big, ...Array.from({ length: 9 }, () => ({ s: 120 + r() * 80 })), ...Array.from({ length: 26 }, () => ({ s: 40 + r() * 50 }))];
  for (const it of place(r, sizes, placed)) {
    const shape = pick(r, t.shapes);
    const c = t.colors[Math.floor(r() * t.colors.length)];
    if (t.rosette && it.s >= 100) {
      body += rosette(r, it.x, it.y, it.s / 2.3, t.rosette, t.colors, op);
    } else {
      const sc = it.s / 100;
      body += `<g transform="translate(${f1(it.x)} ${f1(it.y)}) rotate(${f1(tilt(r, shape))}) scale(${f1(sc * 100) / 100})" opacity="${f1((op[0] + r() * (op[1] - op[0])) * 100) / 100}">${SHAPES[shape](c)}</g>`;
    }
  }
  // Poussière : petits points et petites formes.
  for (let i = 0; i < 46; i++) {
    const x = r() * W;
    const y = r() * H;
    const s = 6 + r() * 16;
    const c = t.colors[Math.floor(r() * t.colors.length)];
    const shape = r() < 0.5 ? "dot" : pick(r, t.shapes);
    body += `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(tilt(r, shape))}) scale(${f1((s / 100) * 100) / 100})" opacity="${f1((op[0] + 0.06 + r() * 0.1) * 100) / 100}">${SHAPES[shape](c)}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
}

function pick(r, list) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [s, w] of list) if ((x -= w) <= 0) return s;
  return list[0][0];
}

// Particule : une forme blanche, utilisée comme masque.
function particle(shape) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-56 -56 112 112">${SHAPES[shape]("#fff")}</svg>`;
}

// ─── Thèmes ────────────────────────────────────────────────────────────
// fond / haut (halo clair) / bas (halo sombre) / encre / creme / creme2 /
// accent / accent2 / accentCarte (rouge lisible sur carte) / couleurs du
// motif / forme et sens des particules (1 : tombent, -1 : montent).
const THEMES = {
  sid: {
    fond: "#2F5BD8", haut: "#7AA0FF", bas: "#0E1E78", encre: "#14163F", creme: "#FFF8EC", creme2: "#ECF0FF",
    accent: "#E8475B", accent2: "#F2C94C", accentCarte: "#C42A43",
    colors: ["#14163F", "#E8475B", "#F2C94C", "#FFF8EC", "#9DBBFF"], shapes: [["eclat", 3], ["star4", 1]], rosette: "eclat",
    particle: "eclat", sens: 1, pcolors: ["#F2C94C", "#E8475B", "#FFF8EC", "#14163F"],
  },
  noel: {
    fond: "#C62F3B", haut: "#FF8A78", bas: "#4E0714", encre: "#0F2A22", creme: "#FFF8EC", creme2: "#EEF6EE",
    accent: "#1F7A4D", accent2: "#F2C94C", accentCarte: "#B3202F",
    colors: ["#0F2A22", "#1F7A4D", "#F2C94C", "#FFF8EC"], shapes: [["snowflake", 3], ["star5", 2], ["bauble", 2]],
    particle: "snowflake", sens: 1, pcolors: ["#FFF8EC", "#FFFFFF", "#F2C94C", "#FFF8EC"],
  },
  halloween: {
    fond: "#E8661E", haut: "#FFB35C", bas: "#4A1606", encre: "#1E0F2E", creme: "#FFF6E8", creme2: "#F3ECFF",
    accent: "#6E3BA6", accent2: "#F2D14B", accentCarte: "#A8361A",
    colors: ["#1E0F2E", "#6E3BA6", "#F2D14B", "#FFF6E8"], shapes: [["bat", 3], ["moon", 1], ["pumpkin", 2]],
    particle: "bat", sens: 1, pcolors: ["#1E0F2E", "#6E3BA6", "#1E0F2E", "#F2D14B"],
  },
  saint_valentin: {
    fond: "#E8508A", haut: "#FFA6C6", bas: "#6E1038", encre: "#3A0A24", creme: "#FFF6F4", creme2: "#FFE9F0",
    accent: "#C21D52", accent2: "#FFD166", accentCarte: "#B0174A",
    colors: ["#3A0A24", "#C21D52", "#FFD166", "#FFF6F4", "#FFB8D0"], shapes: [["heart", 1]],
    particle: "heart", sens: -1, pcolors: ["#FFF6F4", "#C21D52", "#FFD166", "#3A0A24"],
  },
  poisson_avril: {
    fond: "#169FB2", haut: "#7FE3EE", bas: "#053E4B", encre: "#0B2E3A", creme: "#F4FCFB", creme2: "#E1F5F6",
    accent: "#FF7A59", accent2: "#FFD166", accentCarte: "#C2412A",
    colors: ["#0B2E3A", "#FF7A59", "#FFD166", "#F4FCFB"], shapes: [["fish", 3], ["bubble", 1]],
    particle: "bubble", sens: -1, pcolors: ["#F4FCFB", "#F4FCFB", "#FFD166", "#FF7A59"],
  },
  paques: {
    fond: "#6DB33F", haut: "#D2F28A", bas: "#2A5214", encre: "#22301A", creme: "#FFFBEE", creme2: "#F5F0FF",
    accent: "#E66FA2", accent2: "#F5C842", accentCarte: "#B83A6F",
    colors: ["#22301A", "#E66FA2", "#F5C842", "#FFFBEE", "#9FD0FF"], shapes: [["egg", 3], ["flower", 2]],
    particle: "leaf", sens: 1, pcolors: ["#FFFBEE", "#E66FA2", "#F5C842", "#9FD0FF"],
  },
  premier_mai: {
    fond: "#2E9E63", haut: "#8EE3A8", bas: "#0B3F25", encre: "#0E2A1C", creme: "#FBFFF6", creme2: "#E8F6EB",
    accent: "#F4F1E1", accent2: "#F2C94C", accentCarte: "#1F6B43",
    colors: ["#0E2A1C", "#FBFFF6", "#B7F5C9", "#F2C94C"], shapes: [["leaf", 2], ["bell", 3]],
    particle: "bell", sens: 1, pcolors: ["#FBFFF6", "#FBFFF6", "#B7F5C9", "#FBFFF6"],
  },
  fete_musique: {
    fond: "#7440DE", haut: "#C29BFF", bas: "#250C63", encre: "#1A0B3B", creme: "#FFF8FF", creme2: "#F0E9FF",
    accent: "#FF5FA2", accent2: "#FFD84A", accentCarte: "#C2276A",
    colors: ["#1A0B3B", "#FF5FA2", "#FFD84A", "#FFF8FF"], shapes: [["note", 3], ["vinyl", 1]],
    particle: "note", sens: -1, pcolors: ["#FFF8FF", "#FFD84A", "#FF5FA2", "#1A0B3B"],
  },
  quatorze_juillet: {
    fond: "#1E3A9E", haut: "#5A7BFF", bas: "#060D3A", encre: "#0A0F33", creme: "#FFF9F0", creme2: "#EEF2FF",
    accent: "#E63946", accent2: "#FFD166", accentCarte: "#C42531",
    colors: ["#FFF9F0", "#E63946", "#FFD166", "#8FB0FF"], shapes: [["burst", 3], ["star4", 1]], opacity: [0.2, 0.32],
    particle: "star4", sens: 1, pcolors: ["#FFF9F0", "#E63946", "#FFD166", "#FFF9F0"],
  },
  armistice: {
    fond: "#4E5D45", haut: "#93A27A", bas: "#1C2416", encre: "#1A1F16", creme: "#F7F3E8", creme2: "#ECEBE0",
    accent: "#6E8FCB", accent2: "#C8102E", accentCarte: "#3F5E9C",
    colors: ["#1A1F16", "#6E8FCB", "#C8102E", "#F7F3E8"], shapes: [["cornflower", 3], ["poppy", 1], ["leaf", 1]],
    particle: "leaf", sens: 1, pcolors: ["#6E8FCB", "#F7F3E8", "#6E8FCB", "#C8102E"], opacity: [0.14, 0.22],
  },
  grande_chasse: {
    fond: "#B83E1E", haut: "#FF9A4D", bas: "#300B05", encre: "#1D0E0A", creme: "#FFF5E6", creme2: "#FBEADB",
    accent: "#FF7A2A", accent2: "#F2C94C", accentCarte: "#A8331A",
    colors: ["#1D0E0A", "#FF7A2A", "#F2C94C", "#FFF5E6"], shapes: [["claw", 2], ["flame", 3]],
    particle: "flame", sens: -1, pcolors: ["#F2C94C", "#FF7A2A", "#FFF5E6", "#F2C94C"],
  },
  election: {
    fond: "#8A1A38", haut: "#E2577A", bas: "#2A0612", encre: "#1E0711", creme: "#FFF6E8", creme2: "#FBEDE4",
    accent: "#F0C27A", accent2: "#F2C94C", accentCarte: "#9E1A3A",
    colors: ["#1E0711", "#F0C27A", "#FFF6E8", "#E2577A"], shapes: [["star5", 3], ["cocarde", 2], ["ballot", 1]],
    particle: "confetti", sens: 1, pcolors: ["#F0C27A", "#FFF6E8", "#E2577A", "#F0C27A"],
  },
};

// Élection par la force (Lot 91) : rouge sang, alertes. Thème posé à la
// proclamation quand l'élu a pris le pouvoir par la force.
THEMES.election_force = {
  fond: "#8E0B14", haut: "#E0303A", bas: "#1A0204", encre: "#14030A", creme: "#FFF1EC", creme2: "#F8E1DC",
  accent: "#FF2D2D", accent2: "#F2C94C", accentCarte: "#A30F1B",
  colors: ["#14030A", "#FF3B3B", "#F2C94C", "#FFF1EC"], shapes: [["alerte", 3], ["goutte", 2], ["chevrons", 2]],
  particle: "goutte", sens: 1, pcolors: ["#FF3B3B", "#14030A", "#C1121F", "#FF3B3B"], opacity: [0.16, 0.3],
};
UPRIGHT.alerte = 12;
UPRIGHT.goutte = 8;

// ─── Écriture ──────────────────────────────────────────────────────────
mkdirSync(join(ROOT, "public/fonds"), { recursive: true });
let css = `/* Généré par scripts/fonds.mjs (Lot 90) : ne pas modifier à la main.
   Couleurs de chaque thème ; :root porte le S.I.D., html[data-theme] un évent. */\n`;
const particles = new Set();
for (const [key, t] of Object.entries(THEMES)) {
  writeFileSync(join(ROOT, `public/fonds/${key}.svg`), motif(key, t));
  particles.add(t.particle);
  const sel = key === "sid" ? ":root" : `html[data-theme="${key}"]`;
  css += `${sel} {
  --fond: ${hexRgb(lisible(t.fond, t.creme))}; --fond-haut: ${hexRgb(t.haut)}; --fond-bas: ${hexRgb(t.bas)};
  --encre: ${hexRgb(t.encre)}; --creme: ${hexRgb(t.creme)}; --creme-2: ${hexRgb(t.creme2)};
  --accent: ${hexRgb(t.accent)}; --accent-2: ${hexRgb(t.accent2)}; --accent-on-card: ${hexRgb(lisible(t.accentCarte, t.creme, 6))};
  --motif: url(/fonds/${key}.svg); --particule: url(/fonds/p-${t.particle}.svg); 
  --p1: ${hexRgb(t.pcolors[0])}; --p2: ${hexRgb(t.pcolors[1])}; --p3: ${hexRgb(t.pcolors[2])}; --p4: ${hexRgb(t.pcolors[3])};
}\n`;
}
css += `/* Particules qui montent (bulles, cœurs, notes, braises). */\n`;
for (const [key, t] of Object.entries(THEMES)) {
  if (t.sens < 0) css += `html[data-theme="${key}"] .fond-particules i { top: auto; bottom: -40px; animation-name: fond-monte; }\n`;
}
for (const p of particles) writeFileSync(join(ROOT, `public/fonds/p-${p}.svg`), particle(p));
writeFileSync(join(ROOT, "src/app/fonds.css"), css);
console.log(`${Object.keys(THEMES).length} thèmes, ${particles.size} particules`);
