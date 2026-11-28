import { bandeau, boite, cadeau, directionTouche, glissement, rond, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Le Traîneau : le Père Noël ramasse les cadeaux (10 points, 30 pour une
 * étoile dorée), un renne s'ajoute à chaque cadeau et l'attelage accélère.
 * Toucher un bord ou un renne arrête la tournée. Flèches ou glissement ;
 * toucher la moitié gauche ou droite du terrain tourne aussi.
 */
const L = 360;
const T = 20;
const C = 17;
const R = 23;
const OX = (L - C * T) / 2;
const OY = 44;
const H = OY + R * T + 8;

type Dir = "haut" | "bas" | "gauche" | "droite";
const DV: Record<Dir, [number, number]> = { haut: [0, -1], bas: [0, 1], gauche: [-1, 0], droite: [1, 0] };
const INVERSE: Record<Dir, Dir> = { haut: "bas", bas: "haut", gauche: "droite", droite: "gauche" };
const TOURNE: Record<Dir, { g: Dir; d: Dir }> = {
  haut: { g: "gauche", d: "droite" },
  bas: { g: "droite", d: "gauche" },
  gauche: { g: "bas", d: "haut" },
  droite: { g: "haut", d: "bas" },
};

export const traineau: CreerJeu = ({ pal, rng }) => {
  let corps: [number, number][] = [
    [8, 14],
    [8, 15],
    [8, 16],
  ];
  let dir: Dir = "haut";
  const file: Dir[] = [];
  let acc = 0;
  let periode = 0.17;
  let score = 0;
  let cadeauPos: [number, number] = [8, 6];
  let dore = false;
  let message = "Glisse ou utilise les flèches";
  let messageT = 2;
  let depart0: { x: number; y: number } | null = null;
  let glisse = false;

  function placer() {
    const libres: [number, number][] = [];
    for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) if (!corps.some(([x, y]) => x === c && y === r)) libres.push([c, r]);
    cadeauPos = libres[Math.floor(rng() * libres.length)];
    dore = rng() < 0.15;
  }
  placer();

  function vouloir(d: Dir) {
    const dernier = file.length ? file[file.length - 1] : dir;
    if (d !== dernier && d !== INVERSE[dernier] && file.length < 3) file.push(d);
  }

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      if (jeu.fini) return;
      messageT -= dt;
      acc += dt;
      while (acc >= periode && !jeu.fini) {
        acc -= periode;
        if (file.length) dir = file.shift()!;
        const [hc, hr] = corps[0];
        const n: [number, number] = [hc + DV[dir][0], hr + DV[dir][1]];
        const mange = n[0] === cadeauPos[0] && n[1] === cadeauPos[1];
        const queue = mange ? corps : corps.slice(0, -1);
        if (n[0] < 0 || n[0] >= C || n[1] < 0 || n[1] >= R || queue.some(([x, y]) => x === n[0] && y === n[1])) {
          jeu.fini = true;
          message = "Tournée terminée";
          messageT = 99;
          break;
        }
        corps = [n, ...queue];
        if (mange) {
          score += dore ? 30 : 10;
          periode = Math.max(0.075, periode * 0.97);
          placer();
        }
      }
      jeu.score = score;
    },
    dessiner(g: CanvasRenderingContext2D) {
      g.fillStyle = pal.fond;
      g.fillRect(0, 0, L, H);
      boite(g, pal, OX - 4, OY - 4, C * T + 8, R * T + 8, pal.neige, { r: 10, ombre: 4 });
      g.fillStyle = pal.voile;
      for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) if ((c + r) % 2 === 0) g.fillRect(OX + c * T, OY + r * T, T, T);
      const [gc, gr] = cadeauPos;
      if (dore) {
        const x = OX + gc * T + T / 2;
        const y = OY + gr * T + T / 2;
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          const rr = i % 2 ? 4 : 9;
          g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.closePath();
        g.fillStyle = pal.accent2;
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = pal.encre;
        g.stroke();
      } else cadeau(g, pal, OX + gc * T + 3, OY + gr * T + 3, T - 6, T - 6, pal.accent, pal.accent2, 2);
      // Rennes (de la queue vers la tête), puis le traîneau en tête.
      for (let i = corps.length - 1; i >= 1; i--) {
        const [c, r] = corps[i];
        const x = OX + c * T + T / 2;
        const y = OY + r * T + T / 2;
        rond(g, pal, x, y, T / 2 - 2, "rgb(150, 98, 60)", { ombre: 2, trait: 2 });
        g.strokeStyle = pal.encre;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - 4, y - 5);
        g.lineTo(x - 7, y - 10);
        g.moveTo(x + 4, y - 5);
        g.lineTo(x + 7, y - 10);
        g.stroke();
        if (i === 1) rond(g, pal, x, y + 2, 2.6, pal.accent, { ombre: 0, trait: 1 });
      }
      const [hc, hr] = corps[0];
      boite(g, pal, OX + hc * T + 1, OY + hr * T + 3, T - 2, T - 6, pal.accent, { r: 4, ombre: 2, trait: 2 });
      rond(g, pal, OX + hc * T + T / 2, OY + hr * T + T / 2 - 1, 4, pal.creme, { ombre: 0, trait: 1.5 });
      bandeau(g, pal, L, `${score} pts`, `${corps.length - 1} renne${corps.length > 2 ? "s" : ""}`);
      if (messageT > 0) texte(g, pal, message, L / 2, OY + R * T * 0.4, { taille: 18, couleur: pal.creme, contour: true });
    },
    saisie(e: Saisie) {
      if (e.type === "keydown") {
        const d = directionTouche(e.key);
        if (d) vouloir(d);
      } else if (e.type === "down") {
        depart0 = { x: e.x, y: e.y };
        glisse = false;
      } else if (e.type === "move" && depart0) {
        const d = glissement(depart0.x, depart0.y, e.x, e.y, 16);
        if (d) {
          vouloir(d);
          glisse = true;
          depart0 = { x: e.x, y: e.y };
        }
      } else if (e.type === "up") {
        // Appui sans glissement : tourner à gauche ou à droite selon le côté.
        if (depart0 && !glisse) {
          const dernier = file.length ? file[file.length - 1] : dir;
          vouloir(e.x < L / 2 ? TOURNE[dernier].g : TOURNE[dernier].d);
        }
        depart0 = null;
      }
    },
  };
  return jeu;
};
