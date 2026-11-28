import { bandeau, boite, directionTouche, glissement, rond, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Le Glouton du réveillon : labyrinthe, chocolats (10), étoiles (50) qui
 * retournent les lutins pendant 6 s (200, 400, 800, 1 600 points). Le
 * labyrinthe vidé, on recommence plus vite. 3 vies. Flèches ou glissement.
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
      if (jeu.fini) return;
      bouche += dt * 10;
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) message = "";
        return;
      }
      const vMoi = 6.2 + niveau * 0.35;
      avancer(moi, vMoi, dt, () => (voulu && !mur(moi.c + DV[voulu][0], moi.r + DV[voulu][1]) ? voulu : moi.vers));
      const ch = grille[moi.r]?.[moi.c];
      if (ch === "." || ch === "*") {
        grille[moi.r][moi.c] = " ";
        restants--;
        score += ch === "." ? 10 : 50;
        if (ch === "*") {
          enchaine = 0;
          for (const f of fantomes) if (!f.mange) f.peur = Math.max(2.5, 6.5 - niveau * 0.5);
        }
        if (restants <= 0) {
          score += 500;
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
        const v = f.mange ? 12 : f.peur > 0 ? 3.6 : 5 + niveau * 0.4;
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
            score += 200 * 2 ** Math.min(enchaine, 3);
            enchaine++;
          } else {
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
      g.fillStyle = pal.fond;
      g.fillRect(0, 0, L, H);
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          const ch = grille[r][c];
          const x = OX + c * T;
          const y = OY + r * T;
          if (ch === "#") boite(g, pal, x + 1, y + 1, T - 2, T - 2, pal.creme2, { r: 4, ombre: 0, trait: 2 });
          else if (ch === "-") {
            g.fillStyle = pal.accent2;
            g.fillRect(x, y + T / 2 - 2, T, 4);
          } else if (ch === ".") {
            g.fillStyle = "rgb(122, 72, 40)";
            g.fillRect(x + T / 2 - 3, y + T / 2 - 3, 6, 6);
            g.strokeStyle = pal.encre;
            g.lineWidth = 1;
            g.strokeRect(x + T / 2 - 3, y + T / 2 - 3, 6, 6);
          } else if (ch === "*") {
            const k = 1 + Math.sin(bouche) * 0.12;
            g.save();
            g.translate(x + T / 2, y + T / 2);
            g.scale(k, k);
            g.beginPath();
            for (let i = 0; i < 10; i++) {
              const a = (i * Math.PI) / 5 - Math.PI / 2;
              const rr = i % 2 ? 3 : 7.5;
              g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            g.closePath();
            g.fillStyle = pal.accent2;
            g.fill();
            g.lineWidth = 1.5;
            g.strokeStyle = pal.encre;
            g.stroke();
            g.restore();
          }
        }
      for (const f of fantomes) {
        const x = OX + (f.c + f.dc) * T + T / 2;
        const y = OY + (f.r + f.dr) * T + T / 2;
        if (f.mange) {
          g.fillStyle = pal.neige;
          g.beginPath();
          g.arc(x - 3, y, 2.5, 0, Math.PI * 2);
          g.arc(x + 3, y, 2.5, 0, Math.PI * 2);
          g.fill();
          continue;
        }
        const peur = f.peur > 0;
        const clignote = peur && f.peur < 1.5 && Math.floor(f.peur * 6) % 2 === 0;
        const corps = peur ? (clignote ? pal.neige : pal.creme2) : f.couleur;
        g.beginPath();
        g.arc(x, y - 1, 7.5, Math.PI, 0);
        g.lineTo(x + 7.5, y + 7.5);
        for (let i = 0; i < 3; i++) g.lineTo(x + 7.5 - (i + 0.5) * 5, y + (i % 2 ? 7.5 : 4.5));
        g.lineTo(x - 7.5, y + 7.5);
        g.closePath();
        g.fillStyle = corps;
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = pal.encre;
        g.stroke();
        // Bonnet
        g.beginPath();
        g.moveTo(x - 6, y - 6);
        g.lineTo(x + 6, y - 6);
        g.lineTo(x + 3, y - 14);
        g.closePath();
        g.fillStyle = peur ? pal.encre : pal.neige;
        g.fill();
        g.fillStyle = pal.encre;
        g.beginPath();
        g.arc(x - 2.8, y - 1, 1.6, 0, Math.PI * 2);
        g.arc(x + 2.8, y - 1, 1.6, 0, Math.PI * 2);
        g.fill();
      }
      const mx = OX + (moi.c + moi.dc) * T + T / 2;
      const my = OY + (moi.r + moi.dr) * T + T / 2;
      const ouv = moi.vers ? Math.abs(Math.sin(bouche)) * 0.7 : 0.25;
      const rot = { droite: 0, bas: Math.PI / 2, gauche: Math.PI, haut: -Math.PI / 2 }[moi.vers ?? voulu ?? "droite"];
      rond(g, pal, mx, my, 8, pal.accent2, { ombre: 2, trait: 0 });
      g.beginPath();
      g.moveTo(mx, my);
      g.arc(mx, my, 8, rot + ouv, rot + Math.PI * 2 - ouv);
      g.closePath();
      g.fillStyle = pal.accent2;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = pal.encre;
      g.stroke();
      bandeau(g, pal, L, `${score} pts · niv. ${niveau}`, "♥".repeat(Math.max(vies, 0)));
      if (message) texte(g, pal, message, L / 2, OY + 9.5 * T, { taille: 22, couleur: pal.creme, contour: true });
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
