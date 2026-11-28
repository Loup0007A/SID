/**
 * Moteur commun des mini-jeux du calendrier de l'avent (Lot 103).
 *
 * Chaque jeu dessine sur un canevas à taille logique fixe ; le composant
 * MiniJeu l'agrandit à la largeur disponible et convertit les touches et
 * clics. Le dessin reprend le style du site : traits d'encre épais, ombres
 * pleines décalées, surfaces crème, couleurs d'accent du thème choisi.
 */

export type Palette = {
  encre: string;
  creme: string;
  creme2: string;
  accent: string;
  accent2: string;
  accentCarte: string;
  fond: string;
  sapin: string;
  neige: string;
  /** encre transparente, pour les ombres douces et les zones de jeu */
  voile: string;
};

export type Saisie =
  | { type: "down" | "move" | "up"; x: number; y: number }
  | { type: "keydown" | "keyup"; key: string };

export interface Jeu {
  largeur: number;
  hauteur: number;
  score: number;
  fini: boolean;
  /** avance le jeu de dt secondes */
  maj(dt: number): void;
  dessiner(g: CanvasRenderingContext2D): void;
  saisie(e: Saisie): void;
}

export type CreerJeu = (o: { pal: Palette; rng: () => number }) => Jeu;

const rgb = (s: string, a = 1) => {
  const v = s.trim().split(/\s+/).join(", ");
  return a === 1 ? `rgb(${v})` : `rgba(${v}, ${a})`;
};

/** Couleurs du thème en cours (variables CSS du site). */
export function lirePalette(el: Element = document.documentElement): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  const encre = v("--encre", "20 22 63");
  return {
    encre: rgb(encre),
    creme: rgb(v("--creme", "255 248 236")),
    creme2: rgb(v("--creme-2", "236 240 255")),
    accent: rgb(v("--accent", "232 71 91")),
    accent2: rgb(v("--accent-2", "242 201 76")),
    accentCarte: rgb(v("--accent-on-card", "180 39 62")),
    fond: rgb(v("--fond", "15 18 44")),
    sapin: "rgb(31, 122, 77)",
    neige: "rgb(250, 252, 255)",
    voile: rgb(encre, 0.12),
  };
}

/** Générateur pseudo-aléatoire à graine (mulberry32). */
export function hasard(graine: number) {
  let a = graine >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const borne = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const TRAIT = 3;
export const OMBRE = 4;
export const POLICE = '"Archivo", system-ui, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';

function chemin(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  if (r > 0) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  else g.rect(x, y, w, h);
}

/** Boîte à la manière du site : ombre pleine, fond, trait d'encre. */
export function boite(
  g: CanvasRenderingContext2D,
  pal: Palette,
  x: number,
  y: number,
  w: number,
  h: number,
  fond: string,
  o: { r?: number; ombre?: number; trait?: number } = {},
) {
  const r = o.r ?? 6;
  const om = o.ombre ?? OMBRE;
  if (om > 0) {
    g.fillStyle = pal.encre;
    chemin(g, x + om, y + om, w, h, r);
    g.fill();
  }
  g.fillStyle = fond;
  chemin(g, x, y, w, h, r);
  g.fill();
  if ((o.trait ?? TRAIT) > 0) {
    g.lineWidth = o.trait ?? TRAIT;
    g.strokeStyle = pal.encre;
    g.stroke();
  }
}

export function rond(g: CanvasRenderingContext2D, pal: Palette, x: number, y: number, r: number, fond: string, o: { ombre?: number; trait?: number } = {}) {
  const om = o.ombre ?? 3;
  if (om > 0) {
    g.fillStyle = pal.encre;
    g.beginPath();
    g.arc(x + om, y + om, r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = fond;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  if ((o.trait ?? TRAIT) > 0) {
    g.lineWidth = o.trait ?? TRAIT;
    g.strokeStyle = pal.encre;
    g.stroke();
  }
}

/** Paquet cadeau : boîte et ruban en croix. */
export function cadeau(g: CanvasRenderingContext2D, pal: Palette, x: number, y: number, w: number, h: number, fond: string, ruban: string, ombre = OMBRE) {
  boite(g, pal, x, y, w, h, fond, { r: 4, ombre });
  g.fillStyle = ruban;
  const rw = Math.max(3, Math.min(w, h) * 0.16);
  g.fillRect(x + w / 2 - rw / 2, y + 1.5, rw, h - 3);
  g.fillRect(x + 1.5, y + h / 2 - rw / 2, w - 3, rw);
  g.lineWidth = 1.5;
  g.strokeStyle = pal.encre;
  g.strokeRect(x + w / 2 - rw / 2, y + 1.5, rw, h - 3);
  g.strokeRect(x + 1.5, y + h / 2 - rw / 2, w - 3, rw);
}

/** Petit lutin vu de face (bonnet pointu). */
export function lutin(g: CanvasRenderingContext2D, pal: Palette, x: number, y: number, s: number, bonnet: string) {
  rond(g, pal, x, y + s * 0.15, s * 0.5, pal.creme, { ombre: 2, trait: 2 });
  g.fillStyle = pal.encre;
  g.beginPath();
  g.arc(x - s * 0.17, y + s * 0.12, s * 0.06, 0, Math.PI * 2);
  g.arc(x + s * 0.17, y + s * 0.12, s * 0.06, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x - s * 0.52, y - s * 0.12);
  g.lineTo(x + s * 0.52, y - s * 0.12);
  g.lineTo(x + s * 0.15, y - s * 0.95);
  g.closePath();
  g.fillStyle = bonnet;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = pal.encre;
  g.stroke();
  rond(g, pal, x + s * 0.15, y - s * 0.95, s * 0.12, pal.neige, { ombre: 0, trait: 2 });
}

/** Bonhomme de neige. */
export function bonhomme(g: CanvasRenderingContext2D, pal: Palette, x: number, y: number, s: number, echarpe: string) {
  rond(g, pal, x, y + s * 0.35, s * 0.42, pal.neige, { ombre: 2, trait: 2 });
  rond(g, pal, x, y - s * 0.18, s * 0.3, pal.neige, { ombre: 0, trait: 2 });
  g.fillStyle = echarpe;
  g.fillRect(x - s * 0.3, y + s * 0.05, s * 0.6, s * 0.1);
  g.fillStyle = pal.encre;
  g.beginPath();
  g.arc(x - s * 0.1, y - s * 0.22, s * 0.04, 0, Math.PI * 2);
  g.arc(x + s * 0.1, y - s * 0.22, s * 0.04, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = pal.accent2;
  g.beginPath();
  g.moveTo(x, y - s * 0.14);
  g.lineTo(x + s * 0.22, y - s * 0.1);
  g.lineTo(x, y - s * 0.07);
  g.fill();
  boite(g, pal, x - s * 0.2, y - s * 0.62, s * 0.4, s * 0.16, pal.encre, { r: 2, ombre: 0, trait: 0 });
}

/** Texte posé avec un léger contour, centré par défaut. */
export function texte(
  g: CanvasRenderingContext2D,
  pal: Palette,
  t: string,
  x: number,
  y: number,
  o: { taille?: number; couleur?: string; align?: CanvasTextAlign; mono?: boolean; gras?: boolean; contour?: boolean } = {},
) {
  g.font = `${o.gras === false ? 500 : 800} ${o.taille ?? 16}px ${o.mono ? MONO : POLICE}`;
  g.textAlign = o.align ?? "center";
  g.textBaseline = "middle";
  if (o.contour) {
    g.lineWidth = 4;
    g.strokeStyle = pal.encre;
    g.lineJoin = "round";
    g.strokeText(t, x, y);
  }
  g.fillStyle = o.couleur ?? pal.encre;
  g.fillText(t, x, y);
}

/** Bandeau de score en haut du canevas. */
export function bandeau(g: CanvasRenderingContext2D, pal: Palette, largeur: number, gauche: string, droite: string) {
  boite(g, pal, 6, 6, largeur - 12, 30, pal.creme, { r: 10, ombre: 3 });
  texte(g, pal, gauche, 18, 21, { taille: 14, align: "left", mono: true });
  texte(g, pal, droite, largeur - 18, 21, { taille: 14, align: "right", mono: true });
}

/** Flocons de fond, déterministes. */
export function flocons(n: number, l: number, h: number, rng: () => number) {
  return Array.from({ length: n }, () => ({ x: rng() * l, y: rng() * h, r: 1 + rng() * 2.2, v: 10 + rng() * 25 }));
}
export function dessinerFlocons(g: CanvasRenderingContext2D, fl: { x: number; y: number; r: number }[], couleur: string) {
  g.fillStyle = couleur;
  for (const f of fl) {
    g.beginPath();
    g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    g.fill();
  }
}
export function majFlocons(fl: { x: number; y: number; v: number }[], dt: number, l: number, h: number) {
  for (const f of fl) {
    f.y += f.v * dt;
    f.x += Math.sin(f.y / 30) * 6 * dt;
    if (f.y > h) {
      f.y = -4;
      f.x = (f.x * 7.31) % l;
    }
  }
}

/** Direction d'un glissement de doigt (ou null si trop court). */
export function glissement(x0: number, y0: number, x1: number, y1: number, min = 18): "haut" | "bas" | "gauche" | "droite" | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "droite" : "gauche") : dy > 0 ? "bas" : "haut";
}

export function directionTouche(k: string): "haut" | "bas" | "gauche" | "droite" | null {
  switch (k) {
    case "ArrowUp":
    case "z":
    case "w":
      return "haut";
    case "ArrowDown":
    case "s":
      return "bas";
    case "ArrowLeft":
    case "q":
    case "a":
      return "gauche";
    case "ArrowRight":
    case "d":
      return "droite";
    default:
      return null;
  }
}
