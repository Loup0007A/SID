import { assombrir, bandeau, boite, cadeau, directionTouche, Effets, etoile, glissement, rond, teinte, texte, type CreerJeu, type Saisie } from "./moteur";

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
  const fx = new Effets(rng);
  let temps = 0;
  let pasT = 0; // avancement dans la case (0 → 1), pour un mouvement fluide
  let precedent: [number, number][] = corps.map(([c, r]) => [c, r]);
  const traces: { c: number; r: number; t: number }[] = [];

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
      fx.maj(dt);
      temps += dt;
      for (const t of traces) t.t += dt;
      while (traces.length && traces[0].t > 2.5) traces.shift();
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
          fx.gerbe(OX + corps[0][0] * T + T / 2, OY + corps[0][1] * T + T / 2, [pal.neige, pal.accent, pal.accent2], 30, 220);
          fx.secouer(12);
          fx.flash(pal.accent, 0.35);
          message = "Tournée terminée";
          messageT = 99;
          break;
        }
        const ancien = corps;
        corps = [n, ...queue];
        precedent = corps.map((_, i) => ancien[Math.min(i, ancien.length - 1)]);
        traces.push({ c: ancien[ancien.length - 1][0], r: ancien[ancien.length - 1][1], t: 0 });
        if (mange) {
          score += dore ? 30 : 10;
          fx.gerbe(OX + n[0] * T + T / 2, OY + n[1] * T + T / 2, dore ? [pal.accent2, pal.neige] : [pal.accent, pal.accent2, pal.neige], dore ? 22 : 12, 160, { forme: dore ? "etoile" : "carre", gravite: 120 });
          fx.flotte(OX + n[0] * T + T / 2, OY + n[1] * T, dore ? "+30" : "+10", pal.accent2, dore ? 20 : 15);
          if (dore) fx.flash(pal.accent2, 0.2);
          periode = Math.max(0.075, periode * 0.97);
          placer();
        }
      }
      jeu.score = score;
      pasT = jeu.fini ? 1 : Math.min(1, acc / periode);
    },
    dessiner(g: CanvasRenderingContext2D) {
      g.fillStyle = pal.fond;
      g.fillRect(0, 0, L, H);
      g.save();
      fx.decaler(g);
      // Champ de neige
      boite(g, pal, OX - 4, OY - 4, C * T + 8, R * T + 8, pal.neige, { r: 12, ombre: 4 });
      g.save();
      g.beginPath();
      g.roundRect(OX - 2, OY - 2, C * T + 4, R * T + 4, 10);
      g.clip();
      g.fillStyle = teinte(pal.creme2, 0.9);
      for (let i = 0; i < 14; i++) {
        const x = OX + ((i * 97) % (C * T));
        const y = OY + ((i * 151) % (R * T));
        g.beginPath();
        g.ellipse(x, y, 40, 14, 0, 0, Math.PI * 2);
        g.fill();
      }
      // Traces de patins
      for (const t of traces) {
        g.fillStyle = teinte(pal.creme2, Math.max(0, 1 - t.t / 2.5));
        g.fillRect(OX + t.c * T + 3, OY + t.r * T + 3, T - 6, T - 6);
      }
      g.restore();
      // Cadeau ou étoile dorée
      const [gc, gr] = cadeauPos;
      const sautille = Math.abs(Math.sin(temps * 5)) * 2.5;
      if (dore) {
        const x = OX + gc * T + T / 2;
        const y = OY + gr * T + T / 2 - sautille;
        g.fillStyle = teinte(pal.accent2, 0.3);
        g.beginPath();
        g.arc(x, y, 13 + Math.sin(temps * 8) * 2, 0, Math.PI * 2);
        g.fill();
        etoile(g, x, y, 10, 4.5, pal.accent2, pal.encre, temps * 1.5);
      } else cadeau(g, pal, OX + gc * T + 1, OY + gr * T + 4 - sautille, T - 2, T - 5, pal.accent, pal.accent2, 2, true);
      // Attelage (position fluide entre deux cases)
      const pos = (i: number) => {
        const [c1, r1] = precedent[i] ?? corps[i];
        const [c2, r2] = corps[i];
        return [OX + (c1 + (c2 - c1) * pasT) * T + T / 2, OY + (r1 + (r2 - r1) * pasT) * T + T / 2];
      };
      // Rênes
      g.strokeStyle = "rgb(110, 72, 44)";
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < corps.length; i++) {
        const [x, y] = pos(i);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      const dernier = corps.length - 1;
      for (let i = dernier - 1; i >= 0; i--) {
        const [x, y] = pos(i);
        const pas = Math.sin(temps * 18 + i) * 1.5;
        const brun = "rgb(150, 98, 60)";
        g.fillStyle = assombrir(brun, 0.3);
        g.fillRect(x - 6, y + 4 + pas, 3, 5);
        g.fillRect(x + 3, y + 4 - pas, 3, 5);
        rond(g, pal, x, y, T / 2 - 1.5, brun, { ombre: 2, trait: 2 });
        rond(g, pal, x, y + 2.5, 3.6, "rgb(236, 206, 170)", { ombre: 0, trait: 0 });
        g.strokeStyle = "rgb(110, 72, 44)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - 4, y - 6);
        g.lineTo(x - 7, y - 12);
        g.lineTo(x - 10, y - 11);
        g.moveTo(x - 7, y - 12);
        g.lineTo(x - 6, y - 15);
        g.moveTo(x + 4, y - 6);
        g.lineTo(x + 7, y - 12);
        g.lineTo(x + 10, y - 11);
        g.moveTo(x + 7, y - 12);
        g.lineTo(x + 6, y - 15);
        g.stroke();
        g.fillStyle = pal.encre;
        g.fillRect(x - 3.5, y - 3, 2, 2);
        g.fillRect(x + 1.5, y - 3, 2, 2);
        if (i === 0) {
          g.fillStyle = teinte(pal.accent, 0.35 + 0.25 * Math.sin(temps * 9));
          g.beginPath();
          g.arc(x, y + 3, 6, 0, Math.PI * 2);
          g.fill();
          rond(g, pal, x, y + 3, 2.6, pal.accent, { ombre: 0, trait: 1 });
        } else rond(g, pal, x, y + 3, 1.8, pal.encre, { ombre: 0, trait: 0 });
      }
      // Traîneau et Père Noël, en queue d'attelage
      const [hx, hy] = pos(dernier);
      boite(g, pal, hx - T / 2 + 1, hy - 5, T - 2, 12, pal.accent, { r: 5, ombre: 2, trait: 2 });
      g.fillStyle = pal.accent2;
      g.fillRect(hx - T / 2 + 3, hy + 3, T - 6, 2);
      rond(g, pal, hx, hy - 7, 5.5, "rgb(255, 214, 178)", { ombre: 0, trait: 1.6 });
      g.fillStyle = pal.neige;
      g.beginPath();
      g.arc(hx, hy - 4.5, 4, 0, Math.PI);
      g.fill();
      g.beginPath();
      g.moveTo(hx - 6, hy - 9);
      g.lineTo(hx + 6, hy - 9);
      g.lineTo(hx + 4, hy - 17);
      g.closePath();
      g.fillStyle = pal.accent;
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = pal.encre;
      g.stroke();
      rond(g, pal, hx + 4, hy - 17, 2, pal.neige, { ombre: 0, trait: 1 });
      fx.dessiner(g, pal);
      g.restore();
      bandeau(g, pal, L, `${score} pts`, `${corps.length - 1} renne${corps.length > 2 ? "s" : ""}`);
      if (messageT > 0) {
        // Sur la neige, le message passe sur une pastille sombre pour rester lisible.
        g.font = `800 17px "Archivo", system-ui, sans-serif`;
        const w = g.measureText(message).width + 32;
        const y = OY + R * T * 0.4;
        boite(g, pal, L / 2 - w / 2, y - 18, w, 36, pal.encre, { r: 18, ombre: 3, trait: 0 });
        texte(g, pal, message, L / 2, y, { taille: 17, couleur: pal.creme });
      }
      fx.voile(g, L, H);
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
