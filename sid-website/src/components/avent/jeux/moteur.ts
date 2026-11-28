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
  | { type: "down" | "move" | "up"; x: number; y: number; id?: number; appui?: boolean }
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

/** Paquet cadeau : boîte dégradée, ruban en croix, reflet, nœud facultatif. */
export function cadeau(g: CanvasRenderingContext2D, pal: Palette, x: number, y: number, w: number, h: number, fond: string, ruban: string, ombre = OMBRE, avecNoeud = false) {
  boite(g, pal, x, y, w, h, fond, { r: 4, ombre, trait: 0 });
  const d = g.createLinearGradient(0, y, 0, y + h);
  d.addColorStop(0, melangeLocal(fond, "rgb(255,255,255)", 0.22));
  d.addColorStop(1, melangeLocal(fond, "rgb(0,0,0)", 0.12));
  g.fillStyle = d;
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(4, w / 2, h / 2));
  g.fill();
  g.fillStyle = ruban;
  const rw = Math.max(3, Math.min(w, h) * 0.18);
  g.fillRect(x + w / 2 - rw / 2, y, rw, h);
  g.fillRect(x, y + h / 2 - rw / 2, w, rw);
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(x + 3, y + 2.5, Math.max(0, w / 2 - rw / 2 - 5), Math.max(1.5, h * 0.12));
  g.lineWidth = TRAIT * 0.85;
  g.strokeStyle = pal.encre;
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(4, w / 2, h / 2));
  g.stroke();
  if (avecNoeud) {
    const s = Math.min(w, h) * 0.42;
    g.fillStyle = ruban;
    g.strokeStyle = pal.encre;
    g.lineWidth = 1.5;
    for (const sens of [-1, 1]) {
      g.beginPath();
      g.ellipse(x + w / 2 + sens * s * 0.45, y - s * 0.12, s * 0.45, s * 0.28, sens * -0.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.arc(x + w / 2, y, s * 0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}
function melangeLocal(c1: string, c2: string, t: number) {
  const f = (c: string) => (c.match(/-?\d+(\.\d+)?/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
  const a = f(c1);
  const b = f(c2);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

/** Petit lutin vu de face : oreilles pointues, joues, bonnet à pompon. */
export function lutin(g: CanvasRenderingContext2D, pal: Palette, x: number, y: number, s: number, bonnet: string) {
  const peau = "rgb(255, 214, 178)";
  // Oreilles
  g.fillStyle = peau;
  g.strokeStyle = pal.encre;
  g.lineWidth = 2;
  for (const sens of [-1, 1]) {
    g.beginPath();
    g.moveTo(x + sens * s * 0.38, y + s * 0.02);
    g.lineTo(x + sens * s * 0.72, y - s * 0.12);
    g.lineTo(x + sens * s * 0.42, y + s * 0.28);
    g.closePath();
    g.fill();
    g.stroke();
  }
  rond(g, pal, x, y + s * 0.15, s * 0.46, peau, { ombre: 2, trait: 2 });
  // Joues
  g.fillStyle = "rgba(240, 110, 120, 0.55)";
  g.beginPath();
  g.arc(x - s * 0.24, y + s * 0.3, s * 0.08, 0, Math.PI * 2);
  g.arc(x + s * 0.24, y + s * 0.3, s * 0.08, 0, Math.PI * 2);
  g.fill();
  // Yeux et sourire
  g.fillStyle = pal.encre;
  g.beginPath();
  g.arc(x - s * 0.15, y + s * 0.12, s * 0.055, 0, Math.PI * 2);
  g.arc(x + s * 0.15, y + s * 0.12, s * 0.055, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(x, y + s * 0.26, s * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
  g.lineWidth = 1.6;
  g.stroke();
  // Bonnet
  g.beginPath();
  g.moveTo(x - s * 0.5, y - s * 0.1);
  g.quadraticCurveTo(x - s * 0.05, y - s * 0.75, x + s * 0.32, y - s * 0.98);
  g.quadraticCurveTo(x + s * 0.2, y - s * 0.5, x + s * 0.5, y - s * 0.1);
  g.closePath();
  g.fillStyle = bonnet;
  g.fill();
  g.lineWidth = 2;
  g.stroke();
  boite(g, pal, x - s * 0.54, y - s * 0.2, s * 1.08, s * 0.18, pal.neige, { r: s * 0.09, ombre: 0, trait: 1.8 });
  rond(g, pal, x + s * 0.32, y - s * 0.98, s * 0.12, pal.neige, { ombre: 0, trait: 1.8 });
}

/** Bonhomme de neige : chapeau, écharpe, boutons, bras en bois. */
export function bonhomme(g: CanvasRenderingContext2D, pal: Palette, x: number, y: number, s: number, echarpe: string) {
  g.strokeStyle = "rgb(110, 72, 44)";
  g.lineWidth = Math.max(1.5, s * 0.05);
  g.beginPath();
  g.moveTo(x - s * 0.3, y + s * 0.2);
  g.lineTo(x - s * 0.62, y - s * 0.02);
  g.moveTo(x + s * 0.3, y + s * 0.2);
  g.lineTo(x + s * 0.62, y - s * 0.04);
  g.stroke();
  rond(g, pal, x, y + s * 0.35, s * 0.42, pal.neige, { ombre: 2, trait: 2 });
  rond(g, pal, x, y - s * 0.18, s * 0.3, pal.neige, { ombre: 0, trait: 2 });
  g.fillStyle = "rgba(150, 175, 220, 0.35)";
  g.beginPath();
  g.arc(x + s * 0.12, y + s * 0.45, s * 0.26, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = pal.encre;
  for (const k of [0.25, 0.42]) {
    g.beginPath();
    g.arc(x, y + s * k, s * 0.035, 0, Math.PI * 2);
    g.fill();
  }
  boite(g, pal, x - s * 0.32, y + s * 0.02, s * 0.64, s * 0.11, echarpe, { r: 2, ombre: 0, trait: 1.5 });
  boite(g, pal, x + s * 0.08, y + s * 0.06, s * 0.12, s * 0.26, echarpe, { r: 2, ombre: 0, trait: 1.5 });
  g.fillStyle = pal.encre;
  g.beginPath();
  g.arc(x - s * 0.1, y - s * 0.22, s * 0.04, 0, Math.PI * 2);
  g.arc(x + s * 0.1, y - s * 0.22, s * 0.04, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = pal.accent2;
  g.beginPath();
  g.moveTo(x, y - s * 0.15);
  g.lineTo(x + s * 0.24, y - s * 0.1);
  g.lineTo(x, y - s * 0.07);
  g.closePath();
  g.fill();
  g.lineWidth = 1.2;
  g.strokeStyle = pal.encre;
  g.stroke();
  boite(g, pal, x - s * 0.27, y - s * 0.45, s * 0.54, s * 0.07, pal.encre, { r: 2, ombre: 0, trait: 0 });
  boite(g, pal, x - s * 0.18, y - s * 0.7, s * 0.36, s * 0.27, pal.encre, { r: 2, ombre: 0, trait: 0 });
  g.fillStyle = echarpe;
  g.fillRect(x - s * 0.18, y - s * 0.52, s * 0.36, s * 0.06);
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
  g.fillStyle = pal.accent2;
  g.fillRect(10, 10, 4, 22);
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

// ---------------------------------------------------------------------
// Couleurs, effets et décors partagés (Lot 103 bis)
// ---------------------------------------------------------------------

function composantes(c: string): [number, number, number] {
  const m = c.match(/-?\d+(\.\d+)?/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0];
}
/** Même couleur, avec une transparence. */
export function teinte(c: string, a: number) {
  const [r, v, b] = composantes(c);
  return `rgba(${r}, ${v}, ${b}, ${a})`;
}
/** Mélange de deux couleurs (t = 0 : la première, 1 : la seconde). */
export function melange(c1: string, c2: string, t: number) {
  const a = composantes(c1);
  const b = composantes(c2);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
export const eclaircir = (c: string, t: number) => melange(c, "rgb(255, 255, 255)", t);
export const assombrir = (c: string, t: number) => melange(c, "rgb(0, 0, 0)", t);

type Particule = { x: number; y: number; vx: number; vy: number; t: number; vie: number; c: string; r: number; forme: "rond" | "carre" | "etoile"; rot: number; vr: number; g: number };
type Flottant = { x: number; y: number; t: number; vie: number; txt: string; c: string; taille: number };

/** Particules, textes qui montent, secousses et éclairs. */
export class Effets {
  parts: Particule[] = [];
  textes: Flottant[] = [];
  secousse = 0;
  eclair = 0;
  eclairCouleur = "rgb(255,255,255)";
  private rng: () => number;
  constructor(rng: () => number) {
    this.rng = rng;
  }

  gerbe(x: number, y: number, couleurs: string[], n = 14, force = 180, o: { gravite?: number; forme?: Particule["forme"]; taille?: number; vie?: number } = {}) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const v = force * (0.35 + this.rng() * 0.75);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - force * 0.3,
        t: 0, vie: (o.vie ?? 0.8) * (0.7 + this.rng() * 0.6),
        c: couleurs[Math.floor(this.rng() * couleurs.length)],
        r: (o.taille ?? 3.5) * (0.6 + this.rng() * 0.8),
        forme: o.forme ?? (this.rng() < 0.5 ? "carre" : "rond"),
        rot: this.rng() * 6, vr: (this.rng() - 0.5) * 12, g: o.gravite ?? 420,
      });
    }
  }
  /** Traînée : une particule qui s'efface sur place. */
  trace(x: number, y: number, c: string, r: number, vie = 0.25) {
    this.parts.push({ x, y, vx: 0, vy: 0, t: 0, vie, c, r, forme: "rond", rot: 0, vr: 0, g: 0 });
  }
  flotte(x: number, y: number, txt: string, c: string, taille = 18) {
    this.textes.push({ x, y, t: 0, vie: 0.9, txt, c, taille });
  }
  secouer(f: number) {
    this.secousse = Math.max(this.secousse, f);
  }
  flash(c: string, f = 0.35) {
    this.eclair = f;
    this.eclairCouleur = c;
  }
  maj(dt: number) {
    for (const p of this.parts) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.2 * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.vie);
    for (const t of this.textes) {
      t.t += dt;
      t.y -= 38 * dt;
    }
    this.textes = this.textes.filter((t) => t.t < t.vie);
    this.secousse = Math.max(0, this.secousse - dt * 18);
    this.eclair = Math.max(0, this.eclair - dt * 1.6);
  }
  /** Décalage de secousse, à appliquer avant de dessiner la scène. */
  decaler(g: CanvasRenderingContext2D) {
    if (this.secousse > 0) g.translate((this.rng() - 0.5) * this.secousse, (this.rng() - 0.5) * this.secousse);
  }
  dessiner(g: CanvasRenderingContext2D, pal: Palette) {
    for (const p of this.parts) {
      const a = 1 - p.t / p.vie;
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = p.c;
      if (p.forme === "rond") {
        g.beginPath();
        g.arc(p.x, p.y, p.r * (p.g === 0 ? a : 1), 0, Math.PI * 2);
        g.fill();
      } else if (p.forme === "carre") {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        g.restore();
      } else {
        etoile(g, p.x, p.y, p.r * 2, p.r * 0.9, p.c, null, p.rot);
      }
    }
    g.globalAlpha = 1;
    for (const t of this.textes) {
      g.globalAlpha = Math.min(1, (1 - t.t / t.vie) * 2);
      texte(g, pal, t.txt, t.x, t.y, { taille: t.taille * (1 + Math.max(0, 0.15 - t.t) * 2), couleur: t.c, contour: true });
    }
    g.globalAlpha = 1;
  }
  /** Éclair plein écran, après tout le reste. */
  voile(g: CanvasRenderingContext2D, l: number, h: number) {
    if (this.eclair <= 0) return;
    g.fillStyle = teinte(this.eclairCouleur, this.eclair);
    g.fillRect(0, 0, l, h);
  }
}

export function etoile(g: CanvasRenderingContext2D, x: number, y: number, R: number, r: number, fond: string, trait: string | null, rot = 0, branches = 5) {
  g.beginPath();
  for (let i = 0; i < branches * 2; i++) {
    const a = (i * Math.PI) / branches - Math.PI / 2 + rot;
    const rr = i % 2 ? r : R;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fond;
  g.fill();
  if (trait) {
    g.lineWidth = Math.min(2, R * 0.18);
    g.lineJoin = "round";
    g.strokeStyle = trait;
    g.stroke();
  }
}

/** Ciel d'hiver : dégradé du fond du thème, étoiles qui scintillent. */
export function ciel(g: CanvasRenderingContext2D, pal: Palette, l: number, h: number, etoiles: { x: number; y: number; r: number }[], t: number) {
  const d = g.createLinearGradient(0, 0, 0, h);
  d.addColorStop(0, assombrir(pal.fond, 0.35));
  d.addColorStop(0.6, pal.fond);
  d.addColorStop(1, eclaircir(pal.fond, 0.18));
  g.fillStyle = d;
  g.fillRect(0, 0, l, h);
  for (const [i, e] of etoiles.entries()) {
    g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + i * 1.7);
    g.fillStyle = "rgb(255, 250, 220)";
    g.beginPath();
    g.arc(e.x, e.y, e.r * 0.7, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Collines enneigées au bas d'une scène. */
export function collines(g: CanvasRenderingContext2D, pal: Palette, l: number, y: number, h: number) {
  g.fillStyle = melange(pal.neige, pal.fond, 0.35);
  g.beginPath();
  g.moveTo(0, y + 18);
  g.bezierCurveTo(l * 0.25, y - 22, l * 0.45, y + 30, l * 0.7, y + 2);
  g.bezierCurveTo(l * 0.85, y - 12, l * 0.95, y + 6, l, y);
  g.lineTo(l, h);
  g.lineTo(0, h);
  g.fill();
  g.fillStyle = pal.neige;
  g.beginPath();
  g.moveTo(0, y + 36);
  g.bezierCurveTo(l * 0.3, y + 10, l * 0.55, y + 52, l, y + 24);
  g.lineTo(l, h);
  g.lineTo(0, h);
  g.fill();
  g.lineWidth = TRAIT;
  g.strokeStyle = pal.encre;
  g.beginPath();
  g.moveTo(0, y + 36);
  g.bezierCurveTo(l * 0.3, y + 10, l * 0.55, y + 52, l, y + 24);
  g.stroke();
}

/** Sapin stylisé. */
export function sapin(g: CanvasRenderingContext2D, pal: Palette, x: number, y: number, s: number) {
  g.fillStyle = assombrir(pal.sapin, 0.15);
  for (let i = 0; i < 3; i++) {
    const w = s * (0.55 - i * 0.12);
    const yy = y - i * s * 0.28;
    g.beginPath();
    g.moveTo(x - w, yy);
    g.lineTo(x + w, yy);
    g.lineTo(x, yy - s * 0.45);
    g.closePath();
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = pal.encre;
    g.stroke();
  }
  g.fillStyle = teinte(pal.neige, 0.9);
  g.beginPath();
  g.arc(x, y - s * 0.98, s * 0.06, 0, Math.PI * 2);
  g.fill();
}

/** Nœud de ruban posé sur un paquet. */
export function noeud(g: CanvasRenderingContext2D, pal: Palette, x: number, y: number, s: number, c: string) {
  g.fillStyle = c;
  g.strokeStyle = pal.encre;
  g.lineWidth = 1.5;
  for (const sens of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + sens * s * 0.45, y - s * 0.12, s * 0.45, s * 0.28, sens * -0.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.beginPath();
  g.arc(x, y, s * 0.2, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

/** Reflet arrondi en haut à gauche d'une boule. */
export function reflet(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = "rgba(255, 255, 255, 0.75)";
  g.beginPath();
  g.ellipse(x - r * 0.35, y - r * 0.38, r * 0.32, r * 0.2, -0.6, 0, Math.PI * 2);
  g.fill();
}

/** Boule avec dégradé, trait et reflet. */
export function bille(g: CanvasRenderingContext2D, pal: Palette, x: number, y: number, r: number, c: string, ombre = 2) {
  if (ombre) {
    g.fillStyle = teinte(pal.encre, 0.9);
    g.beginPath();
    g.arc(x + ombre, y + ombre, r, 0, Math.PI * 2);
    g.fill();
  }
  const d = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  d.addColorStop(0, eclaircir(c, 0.45));
  d.addColorStop(1, c);
  g.fillStyle = d;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = Math.min(TRAIT, r * 0.3);
  g.strokeStyle = pal.encre;
  g.stroke();
  reflet(g, x, y, r);
}
