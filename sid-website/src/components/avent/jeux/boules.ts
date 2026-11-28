import { bandeau, bonhomme, boite, dessinerFlocons, flocons, lutin, majFlocons, rond, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Bataille de boules de neige : 45 secondes. Des lutins sortent des congères
 * (10 points × multiplicateur), parfois un bonhomme de neige (−30, série
 * perdue). Toutes les 5 touches d'affilée, le multiplicateur monte (×4 au
 * plus). Un tir dans le vide casse la série.
 */
const L = 360;
const H = 540;
const DUREE = 45;
const TROUS: [number, number][] = [];
for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) TROUS.push([70 + c * 110, 130 + r * 102]);

type Cible = { trou: number; t: number; vie: number; bon: boolean; touche: number };

export const boules: CreerJeu = ({ pal, rng }) => {
  let reste = DUREE;
  let score = 0;
  let serie = 0;
  let cibles: Cible[] = [];
  let prochain = 0.6;
  let impacts: { x: number; y: number; t: number; txt: string; bon: boolean }[] = [];
  const fl = flocons(40, L, H, rng);
  const mult = () => Math.min(4, 1 + Math.floor(serie / 5));

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      majFlocons(fl, dt, L, H);
      impacts = impacts.filter((i) => (i.t -= dt) > 0);
      if (jeu.fini) return;
      reste -= dt;
      if (reste <= 0) {
        reste = 0;
        jeu.fini = true;
        return;
      }
      const avance = (DUREE - reste) / DUREE;
      prochain -= dt;
      if (prochain <= 0) {
        const libres = TROUS.map((_, i) => i).filter((i) => !cibles.some((c) => c.trou === i));
        if (libres.length) {
          const vie = 1.5 - avance * 0.75 + rng() * 0.3;
          cibles.push({ trou: libres[Math.floor(rng() * libres.length)], t: 0, vie, bon: rng() > 0.2, touche: -1 });
        }
        prochain = 0.75 - avance * 0.38 + rng() * 0.25;
      }
      for (const c of cibles) c.t += dt;
      cibles = cibles.filter((c) => (c.touche >= 0 ? c.t - c.touche < 0.25 : c.t < c.vie));
      jeu.score = score;
    },
    dessiner(g: CanvasRenderingContext2D) {
      g.fillStyle = pal.fond;
      g.fillRect(0, 0, L, H);
      dessinerFlocons(g, fl, "rgba(255,255,255,0.5)");
      TROUS.forEach(([x, y], i) => {
        const c = cibles.find((k) => k.trou === i);
        if (c) {
          // Monte, reste, redescend.
          const montee = Math.min(1, c.t / 0.15, (c.vie - c.t) / 0.15, c.touche >= 0 ? 1 - (c.t - c.touche) / 0.25 : 1);
          const dy = (1 - Math.max(0, montee)) * 40;
          g.save();
          g.beginPath();
          g.rect(x - 50, y - 70, 100, 70);
          g.clip();
          if (c.bon) lutin(g, pal, x, y - 22 + dy, 40, pal.accent);
          else bonhomme(g, pal, x, y - 26 + dy, 46, pal.sapin);
          g.restore();
        }
        // Congère
        g.beginPath();
        g.ellipse(x + 3, y + 3, 44, 16, 0, 0, Math.PI * 2);
        g.fillStyle = pal.encre;
        g.fill();
        g.beginPath();
        g.ellipse(x, y, 44, 16, 0, 0, Math.PI * 2);
        g.fillStyle = pal.neige;
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = pal.encre;
        g.stroke();
      });
      for (const i of impacts) {
        rond(g, pal, i.x, i.y, 10 + (0.5 - i.t) * 16, pal.neige, { ombre: 0, trait: 2 });
        texte(g, pal, i.txt, i.x, i.y - 26 - (0.5 - i.t) * 30, { taille: 16, couleur: i.bon ? pal.accent2 : pal.accent, contour: true });
      }
      bandeau(g, pal, L, `${score} pts · ×${mult()}`, `${Math.ceil(reste)} s`);
      const barre = Math.min(1, (serie % 5) / 5);
      boite(g, pal, 20, H - 30, L - 40, 12, pal.creme2, { r: 6, ombre: 2, trait: 2 });
      if (mult() < 4) boite(g, pal, 20, H - 30, Math.max(12, (L - 40) * barre), 12, pal.accent2, { r: 6, ombre: 0, trait: 2 });
      else boite(g, pal, 20, H - 30, L - 40, 12, pal.accent, { r: 6, ombre: 0, trait: 2 });
    },
    saisie(e: Saisie) {
      if (jeu.fini || e.type !== "down") return;
      const c = cibles.find((k) => {
        const [x, y] = TROUS[k.trou];
        return k.touche < 0 && Math.abs(e.x - x) < 42 && e.y > y - 72 && e.y < y + 14;
      });
      if (!c) {
        serie = 0;
        impacts.push({ x: e.x, y: e.y, t: 0.5, txt: "raté", bon: false });
        return;
      }
      c.touche = c.t;
      if (c.bon) {
        const pts = 10 * mult();
        score += pts;
        serie++;
        impacts.push({ x: e.x, y: e.y, t: 0.5, txt: `+${pts}`, bon: true });
      } else {
        score = Math.max(0, score - 30);
        serie = 0;
        impacts.push({ x: e.x, y: e.y, t: 0.5, txt: "−30", bon: false });
      }
      jeu.score = score;
    },
  };
  return jeu;
};
