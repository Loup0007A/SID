import { assombrir, bandeau, bille, directionTouche, Effets, eclaircir, etoile, glissement, teinte, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Le Glouton du réveillon : labyrinthe, chocolats (25), étoiles (120) qui
 * retournent les lutins pendant 6 s (500, 1 000, 2 000, 4 000 points). Le
 * labyrinthe vidé (+1 200), on recommence plus vite : la vitesse croît de façon
 * exponentielle (glouton ×1,10, lutins ×1,15 par niveau, peur ×0,82).
 * 3 vies. Flèches ou glissement.
 */
const PLAN = [
  "###################",
  "#........#........#",
  "#*##.###.#.###.##*#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.### # ###.####",
  "   #.#   G   #.#   ",
  "####.# ##-## #.####",
  "    .  #GGG#  .    ",
  "####.# ##### #.####",
  "   #.#       #.#   ",
  "####.# ##### #.####",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#*.#.....P.....#.*#",
  "##.#.#.#####.#.#.##",
  "#....#...#...#....#",
  "#.######.#.######.#",
  "#.................#",
  "###################",
];
const C = 19;
const R = PLAN.length;
const T = 18;
const OX = (360 - C * T) / 2;
const OY = 44;
const L = 360;
const H = OY + R * T + 10;

type Dir = "haut" | "bas" | "gauche" | "droite";
const DV: Record<Dir, [number, number]> = { haut: [0, -1], bas: [0, 1], gauche: [-1, 0], droite: [1, 0] };
const INVERSE: Record<Dir, Dir> = { haut: "bas", bas: "haut", gauche: "droite", droite: "gauche" };

type Acteur = { c: number; r: number; vers: Dir | null; p: number; dc: number; dr: number };
type Fantome = Acteur & { maison: [number, number]; peur: number; mange: boolean; sortie: number; couleur: string };

export const glouton: CreerJeu = ({ pal, rng }) => {
  let grille: string[][] = [];
  let restants = 0;
  const depart = { c: 9, r: 15 };
  const maisons: [number, number][] = [];
  PLAN.forEach((ligne, r) =>
    [...ligne].forEach((ch, c) => {
      if (ch === "P") {
        depart.c = c;
        depart.r = r;
      }
      if (ch === "G") maisons.push([c, r]);
    }),
  );
  function remplir() {
    grille = PLAN.map((l) => [...l].map((ch) => (ch === "P" || ch === "G" ? " " : ch)));
    restants = grille.flat().filter((ch) => ch === "." || ch === "*").length;
  }
  remplir();

  const mur = (c: number, r: number, fantome = false) => {
    if (r < 0 || r >= R) return true;
    const cc = ((c % C) + C) % C;
    const ch = grille[r][cc];
    return ch === "#" || (ch === "-" && !fantome);
  };

  const moi: Acteur = { c: depart.c, r: depart.r, vers: null, p: 0, dc: 0, dr: 0 };
  let voulu: Dir | null = null;
  let bouche = 0;
  const couleurs = [pal.accent, pal.sapin, pal.accent2];
  const fantomes: Fantome[] = maisons.slice(0, 3).map(([c, r], i) => ({
    c, r, vers: null, p: 0, dc: 0, dr: 0, maison: [c, r], peur: 0, mange: false, sortie: 1 + i * 2.5, couleur: couleurs[i % couleurs.length],
  }));
  let niveau = 1;
  let vies = 3;
  let score = 0;
  let enchaine = 0;
  let pause = 1;
  let message = "Prêt ?";
  const fx = new Effets(rng);
  let temps = 0;
  const px = (a: { c: number; dc: number }) => OX + (a.c + a.dc) * T + T / 2;
  const py = (a: { r: number; dr: number }) => OY + (a.r + a.dr) * T + T / 2;

  function reinitPositions() {
    Object.assign(moi, { c: depart.c, r: depart.r, vers: null, p: 0, dc: 0, dr: 0 });
    voulu = null;
    fantomes.forEach((f, i) => Object.assign(f, { c: f.maison[0], r: f.maison[1], vers: null, p: 0, dc: 0, dr: 0, peur: 0, mange: false, sortie: 1 + i * 2.5 }));
    pause = 1;
  }

  // Avance un acteur d'une fraction de case ; choisit sa direction au centre des cases.
  function avancer(a: Acteur, vitesse: number, dt: number, choisir: () => Dir | null, fantome = false) {
    a.p += vitesse * dt;
    while (a.p >= 1 || a.vers === null) {
      if (a.vers !== null) {
        a.c = (((a.c + DV[a.vers][0]) % C) + C) % C;
        a.r += DV[a.vers][1];
        a.p -= 1;
      }
      const d = choisir();
      if (d && !mur(a.c + DV[d][0], a.r + DV[d][1], fantome)) a.vers = d;
      else if (a.vers && mur(a.c + DV[a.vers][0], a.r + DV[a.vers][1], fantome)) a.vers = null;
      if (a.vers === null) {
        a.p = 0;
        break;
      }
    }
    a.dc = a.vers ? DV[a.vers][0] * a.p : 0;
    a.dr = a.vers ? DV[a.vers][1] * a.p : 0;
  }

  function choixFantome(f: Fantome): Dir | null {
    const options = (Object.keys(DV) as Dir[]).filter((d) => !mur(f.c + DV[d][0], f.r + DV[d][1], true) && (f.vers === null || d !== INVERSE[f.vers]));
    if (options.length === 0) return f.vers ? INVERSE[f.vers] : null;
    let cible: [number, number] = [moi.c, moi.r];
    if (f.mange) cible = f.maison;
    else if (grille[f.r][f.c] === " " && maisons.some(([c, r]) => c === f.c && r === f.r)) cible = [9, 6];
    if (f.peur > 0 && !f.mange) return options[Math.floor(rng() * options.length)];
    if (!f.mange && rng() < 0.18) return options[Math.floor(rng() * options.length)];
    options.sort((a, b) => {
      const da = Math.hypot(f.c + DV[a][0] - cible[0], f.r + DV[a][1] - cible[1]);
      const db = Math.hypot(f.c + DV[b][0] - cible[0], f.r + DV[b][1] - cible[1]);
      return da - db;
    });
    return options[0];
  }

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      fx.maj(dt);
      temps += dt;
      if (jeu.fini) return;
      bouche += dt * 10;
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) message = "";
        return;
      }
      const vMoi = Math.min(12, 6.4 * 1.1 ** (niveau - 1));
      avancer(moi, vMoi, dt, () => (voulu && !mur(moi.c + DV[voulu][0], moi.r + DV[voulu][1]) ? voulu : moi.vers));
      const ch = grille[moi.r]?.[moi.c];
      if (ch === "." || ch === "*") {
        grille[moi.r][moi.c] = " ";
        restants--;
        score += ch === "." ? 25 : 120;
        if (ch === "*") {
          enchaine = 0;
          fx.gerbe(px(moi), py(moi), [pal.accent2, pal.neige], 14, 150, { forme: "etoile", taille: 3, gravite: 0 });
          fx.flash(pal.creme2, 0.18);
          for (const f of fantomes) if (!f.mange) f.peur = Math.max(1.5, 6.5 * 0.82 ** (niveau - 1));
        }
        if (restants <= 0) {
          score += 1200;
          fx.flash(pal.accent2, 0.5);
          fx.flotte(L / 2, OY + 7 * T, "+1200", pal.accent2, 26);
          niveau++;
          remplir();
          reinitPositions();
          message = `Niveau ${niveau}`;
        }
      }
      for (const f of fantomes) {
        if (f.sortie > 0) {
          f.sortie -= dt;
          continue;
        }
        if (f.peur > 0) f.peur -= dt;
        const v = f.mange ? 14 : f.peur > 0 ? 3.6 : Math.min(12.5, 5.2 * 1.15 ** (niveau - 1));
        avancer(f, v, dt, () => choixFantome(f), true);
        if (f.mange && f.c === f.maison[0] && f.r === f.maison[1]) {
          f.mange = false;
          f.peur = 0;
        }
        const dx = f.c + f.dc - (moi.c + moi.dc);
        const dy = f.r + f.dr - (moi.r + moi.dr);
        if (!f.mange && Math.hypot(dx, dy) < 0.7) {
          if (f.peur > 0) {
            f.mange = true;
            f.peur = 0;
            const gain = 500 * 2 ** Math.min(enchaine, 3);
            score += gain;
            enchaine++;
            fx.flotte(px(f), py(f) - 8, `+${gain}`, pal.accent2, 18);
            fx.gerbe(px(f), py(f), [f.couleur, pal.neige], 12, 160, { gravite: 0 });
            fx.secouer(4);
          } else {
            fx.gerbe(px(moi), py(moi), [pal.accent2, pal.neige, pal.accent], 26, 200, { gravite: 200 });
            fx.secouer(10);
            fx.flash(pal.accent, 0.35);
            vies--;
            if (vies <= 0) {
              jeu.fini = true;
              message = "Attrapé !";
            } else {
              message = "Aïe !";
              reinitPositions();
            }
            break;
          }
        }
      }
      jeu.score = score;
    },
    dessiner(g: CanvasRenderingContext2D) {
      const fondJeu = assombrir(pal.fond, 0.45);
      g.fillStyle = pal.fond;
      g.fillRect(0, 0, L, H);
      g.save();
      fx.decaler(g);
      g.fillStyle = fondJeu;
      g.beginPath();
      g.roundRect(OX - 4, OY - 4, C * T + 8, R * T + 8, 12);
      g.fill();
      const estMur = (c: number, r: number) => r >= 0 && r < R && c >= 0 && c < C && grille[r][c] === "#";
      // Murs : ombre, glaçage, contour seulement sur les bords libres
      g.fillStyle = pal.encre;
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (estMur(c, r)) g.fillRect(OX + c * T + 3, OY + r * T + 3, T, T);
      const pain = "rgb(196, 128, 74)";
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          if (!estMur(c, r)) continue;
          const x = OX + c * T;
          const y = OY + r * T;
          g.fillStyle = pain;
          g.fillRect(x, y, T, T);
          if (!estMur(c, r - 1)) {
            g.fillStyle = pal.neige;
            g.fillRect(x, y, T, 5);
            g.beginPath();
            g.arc(x + T * 0.3, y + 5, 2.5, 0, Math.PI);
            g.arc(x + T * 0.75, y + 5, 2, 0, Math.PI);
            g.fill();
          }
        }
      g.strokeStyle = pal.encre;
      g.lineWidth = 2.5;
      g.lineCap = "round";
      g.beginPath();
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          if (!estMur(c, r)) continue;
          const x = OX + c * T;
          const y = OY + r * T;
          if (!estMur(c, r - 1)) { g.moveTo(x, y); g.lineTo(x + T, y); }
          if (!estMur(c, r + 1)) { g.moveTo(x, y + T); g.lineTo(x + T, y + T); }
          if (!estMur(c - 1, r)) { g.moveTo(x, y); g.lineTo(x, y + T); }
          if (!estMur(c + 1, r)) { g.moveTo(x + T, y); g.lineTo(x + T, y + T); }
        }
      g.stroke();
      g.lineCap = "butt";
      // Porte, chocolats, étoiles
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          const ch = grille[r][c];
          const x = OX + c * T + T / 2;
          const y = OY + r * T + T / 2;
          if (ch === "-") {
            g.fillStyle = pal.accent;
            g.fillRect(x - T / 2, y - 2, T, 4);
            g.fillStyle = pal.neige;
            g.fillRect(x - 2, y - 2, 4, 4);
          } else if (ch === ".") {
            g.fillStyle = "rgb(236, 196, 140)";
            g.beginPath();
            g.arc(x, y, 3.4, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "rgb(122, 70, 38)";
            g.beginPath();
            g.arc(x + 0.4, y + 0.4, 1.9, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "rgba(255, 245, 225, 0.9)";
            g.beginPath();
            g.arc(x - 1, y - 1.2, 1, 0, Math.PI * 2);
            g.fill();
          } else if (ch === "*") {
            const k = 1 + Math.sin(temps * 6) * 0.15;
            g.fillStyle = teinte(pal.accent2, 0.25);
            g.beginPath();
            g.arc(x, y, 11 * k, 0, Math.PI * 2);
            g.fill();
            etoile(g, x, y, 9.5 * k, 4.4 * k, pal.accent2, pal.encre, temps * 0.8);
          }
        }
      fx.dessiner(g, pal);
      // Lutins
      for (const f of fantomes) {
        const x = px(f);
        const y = py(f);
        const regard = f.vers ? { haut: [0, -1.4], bas: [0, 1.4], gauche: [-1.4, 0], droite: [1.4, 0] }[f.vers] : [0, 0];
        if (f.mange) {
          for (const sens of [-1, 1]) {
            g.fillStyle = pal.neige;
            g.beginPath();
            g.arc(x + sens * 3.2, y, 2.8, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = pal.encre;
            g.beginPath();
            g.arc(x + sens * 3.2 + regard[0], y + regard[1], 1.3, 0, Math.PI * 2);
            g.fill();
          }
          continue;
        }
        const peur = f.peur > 0;
        const clignote = peur && f.peur < 1.5 && Math.floor(f.peur * 6) % 2 === 0;
        const corps = peur ? (clignote ? pal.neige : eclaircir(pal.fond, 0.35)) : f.couleur;
        const ondule = Math.sin(temps * 14) * 1.2;
        g.fillStyle = teinte(pal.encre, 0.9);
        g.beginPath();
        g.ellipse(x + 2, y + 9, 7, 2.5, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(x, y - 1, 8, Math.PI, 0);
        g.lineTo(x + 8, y + 7.5);
        for (let i = 0; i < 4; i++) g.lineTo(x + 8 - (i + 0.5) * 4, y + (i % 2 ? 7.5 + ondule : 4.5 - ondule));
        g.lineTo(x - 8, y + 7.5);
        g.closePath();
        g.fillStyle = corps;
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = pal.encre;
        g.stroke();
        // Bonnet
        g.beginPath();
        g.moveTo(x - 7, y - 5);
        g.quadraticCurveTo(x, y - 16, x + 6, y - 15);
        g.lineTo(x + 7, y - 5);
        g.closePath();
        g.fillStyle = peur ? pal.encre : pal.neige;
        g.fill();
        g.lineWidth = 1.5;
        g.stroke();
        if (peur) {
          g.strokeStyle = pal.encre;
          g.lineWidth = 1.4;
          g.beginPath();
          g.moveTo(x - 5, y + 3);
          for (let i = 0; i < 5; i++) g.lineTo(x - 5 + (i + 1) * 2, y + (i % 2 ? 3 : 1.5));
          g.stroke();
          g.fillStyle = pal.encre;
          g.fillRect(x - 3.5, y - 2.5, 2, 2);
          g.fillRect(x + 1.5, y - 2.5, 2, 2);
        } else {
          for (const sens of [-1, 1]) {
            g.fillStyle = pal.neige;
            g.beginPath();
            g.arc(x + sens * 3, y - 1, 2.6, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = pal.encre;
            g.beginPath();
            g.arc(x + sens * 3 + regard[0], y - 1 + regard[1], 1.3, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      // Glouton
      const mx = px(moi);
      const my = py(moi);
      const ouv = moi.vers ? Math.abs(Math.sin(bouche)) * 0.75 : 0.25;
      const rot = { droite: 0, bas: Math.PI / 2, gauche: Math.PI, haut: -Math.PI / 2 }[moi.vers ?? voulu ?? "droite"];
      const puissant = fantomes.some((f) => f.peur > 0);
      if (puissant) {
        g.fillStyle = teinte(pal.accent2, 0.3 + 0.15 * Math.sin(temps * 10));
        g.beginPath();
        g.arc(mx, my, 13, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = teinte(pal.encre, 0.9);
      g.beginPath();
      g.moveTo(mx + 2, my + 2);
      g.arc(mx + 2, my + 2, 8.5, rot + ouv, rot + Math.PI * 2 - ouv);
      g.closePath();
      g.fill();
      const dg = g.createRadialGradient(mx - 3, my - 3, 1, mx, my, 9);
      dg.addColorStop(0, eclaircir(pal.accent2, 0.5));
      dg.addColorStop(1, pal.accent2);
      g.fillStyle = dg;
      g.beginPath();
      g.moveTo(mx, my);
      g.arc(mx, my, 8.5, rot + ouv, rot + Math.PI * 2 - ouv);
      g.closePath();
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = pal.encre;
      g.stroke();
      // Œil
      const oeil = rot - Math.PI / 2 + 0.35;
      g.fillStyle = pal.encre;
      g.beginPath();
      g.arc(mx + Math.cos(oeil) * 4.2, my + Math.sin(oeil) * 4.2, 1.6, 0, Math.PI * 2);
      g.fill();
      g.restore();
      bandeau(g, pal, L, `${score} pts · niv. ${niveau}`, "");
      for (let i = 0; i < Math.max(vies, 0); i++) bille(g, pal, L - 26 - i * 18, 21, 6, pal.accent2, 1);
      if (message) texte(g, pal, message, L / 2, OY + 9.5 * T, { taille: 24, couleur: pal.accent2, contour: true });
      fx.voile(g, L, H);
    },
    saisie(e: Saisie) {
      if (e.type === "keydown") {
        const d = directionTouche(e.key);
        if (d) voulu = d;
      } else if (e.type === "down") {
        depart0 = { x: e.x, y: e.y };
      } else if (e.type === "move" && depart0) {
        const d = glissement(depart0.x, depart0.y, e.x, e.y, 14);
        if (d) {
          voulu = d;
          depart0 = { x: e.x, y: e.y };
        }
      } else if (e.type === "up") depart0 = null;
    },
  };
  let depart0: { x: number; y: number } | null = null;
  return jeu;
};
