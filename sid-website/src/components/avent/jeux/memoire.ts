import { bandeau, boite, ciel, eclaircir, Effets, etoile, flocons, teinte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Mémoire des boules de Noël : 75 secondes. Retourne deux cartes ; deux
 * boules identiques restent visibles (100 points + 20 par paire trouvée
 * d'affilée, jusqu'à +200), sinon elles se retournent (−10). Un plateau terminé rapporte
 * 200 et en amène un plus grand (16, 20 puis 24 cartes).
 */
const L = 360;
const H = 540;
const DUREE = 75;
const MOTIFS = ["uni", "rayures", "pois", "etoile", "flocon", "zigzag"] as const;

type Carte = { motif: (typeof MOTIFS)[number]; couleur: string; x: number; y: number; w: number; h: number; face: boolean; trouvee: boolean; flip: number; secoue: number };

export const memoire: CreerJeu = ({ pal, rng }) => {
  const fx = new Effets(rng);
  const etoiles = flocons(30, L, H, rng);
  const couleurs = [pal.accent, pal.accent2, pal.sapin, pal.creme2, "rgb(130, 90, 200)", "rgb(60, 170, 210)"];
  let cartes: Carte[] = [];
  let plateau = 0;
  let reste = DUREE;
  let temps = 0;
  let score = 0;
  let serie = 0;
  let ouvertes: Carte[] = [];
  let attente = 0;

  function distribuer() {
    plateau++;
    const cols = 4;
    const rangs = Math.min(6, 3 + plateau);
    const paires = (cols * rangs) / 2;
    const modeles: { motif: Carte["motif"]; couleur: string }[] = [];
    const tous = MOTIFS.flatMap((m) => couleurs.map((c) => ({ motif: m, couleur: c })));
    while (modeles.length < paires) {
      const m = tous.splice(Math.floor(rng() * tous.length), 1)[0];
      modeles.push(m);
    }
    const jeu = [...modeles, ...modeles];
    for (let i = jeu.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [jeu[i], jeu[j]] = [jeu[j], jeu[i]];
    }
    const zoneH = H - 70;
    const gap = 8;
    const w = (L - 24 - gap * (cols - 1)) / cols;
    const h = Math.min(w * 1.15, (zoneH - gap * (rangs - 1)) / rangs);
    const y0 = 52 + (zoneH - (h * rangs + gap * (rangs - 1))) / 2;
    cartes = jeu.map((m, i) => ({
      ...m,
      x: 12 + (i % cols) * (w + gap),
      y: y0 + Math.floor(i / cols) * (h + gap),
      w,
      h,
      face: false,
      trouvee: false,
      flip: 0,
      secoue: 0,
    }));
    ouvertes = [];
  }
  distribuer();

  function dessinerBoule(g: CanvasRenderingContext2D, c: Carte, cx: number, cy: number, r: number) {
    g.fillStyle = teinte(pal.encre, 0.9);
    g.beginPath();
    g.arc(cx + 2, cy + 2, r, 0, Math.PI * 2);
    g.fill();
    const d = g.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
    d.addColorStop(0, eclaircir(c.couleur, 0.45));
    d.addColorStop(1, c.couleur);
    g.fillStyle = d;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    const motifC = c.couleur === pal.creme2 || c.couleur === pal.accent2 ? pal.accent : pal.neige;
    g.fillStyle = motifC;
    g.strokeStyle = motifC;
    g.lineWidth = 3;
    if (c.motif === "rayures") for (let k = -2; k <= 2; k++) g.fillRect(cx - r, cy + k * r * 0.4 - 2, r * 2, 4);
    else if (c.motif === "pois")
      for (let a = 0; a < 6; a++) {
        g.beginPath();
        g.arc(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.13, 0, Math.PI * 2);
        g.fill();
      }
    else if (c.motif === "etoile") etoile(g, cx, cy, r * 0.55, r * 0.24, motifC, null);
    else if (c.motif === "flocon")
      for (let a = 0; a < 6; a++) {
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos((a * Math.PI) / 3) * r * 0.62, cy + Math.sin((a * Math.PI) / 3) * r * 0.62);
        g.stroke();
      }
    else if (c.motif === "zigzag") {
      g.beginPath();
      for (let k = 0; k <= 8; k++) g.lineTo(cx - r + (k * r) / 4, cy + (k % 2 ? -r * 0.22 : r * 0.22));
      g.stroke();
    }
    g.restore();
    g.lineWidth = 2.5;
    g.strokeStyle = pal.encre;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.beginPath();
    g.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
    g.fill();
    // Attache
    boite(g, pal, cx - r * 0.22, cy - r - 7, r * 0.44, 8, pal.accent2, { r: 2, ombre: 0, trait: 2 });
  }

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      fx.maj(dt);
      temps += dt;
      for (const c of cartes) {
        const vise = c.face || c.trouvee ? 1 : 0;
        c.flip += Math.sign(vise - c.flip) * Math.min(Math.abs(vise - c.flip), dt * 7);
        c.secoue = Math.max(0, c.secoue - dt);
      }
      if (jeu.fini) return;
      reste -= dt;
      if (reste <= 0) {
        reste = 0;
        jeu.fini = true;
        return;
      }
      if (attente > 0) {
        attente -= dt;
        if (attente <= 0) {
          for (const c of ouvertes) c.face = false;
          ouvertes = [];
        }
      }
      jeu.score = score;
    },
    dessiner(g: CanvasRenderingContext2D) {
      ciel(g, pal, L, H, etoiles, temps);
      g.save();
      fx.decaler(g);
      for (const c of cartes) {
        const k = Math.abs(Math.cos(c.flip * Math.PI)); // largeur apparente pendant le retournement
        const montree = c.flip > 0.5;
        const dx = c.secoue > 0 ? Math.sin(c.secoue * 60) * 3 : 0;
        const w = c.w * Math.max(0.04, k);
        const x = c.x + (c.w - w) / 2 + dx;
        if (montree) {
          boite(g, pal, x, c.y, w, c.h, c.trouvee ? eclaircir(pal.accent2, 0.75) : pal.creme, { r: 10, ombre: 3 });
          if (k > 0.3) {
            g.save();
            g.translate(x + w / 2, c.y + c.h / 2 + 4);
            g.scale(k, 1);
            dessinerBoule(g, c, 0, 0, Math.min(c.w, c.h) * 0.3);
            g.restore();
          }
        } else {
          boite(g, pal, x, c.y, w, c.h, pal.accent, { r: 10, ombre: 3 });
          if (k > 0.3) {
            g.save();
            g.beginPath();
            g.roundRect(x + 5, c.y + 5, w - 10, c.h - 10, 7);
            g.clip();
            g.strokeStyle = teinte(pal.neige, 0.35);
            g.lineWidth = 3;
            for (let t = -c.h; t < c.w + c.h; t += 12) {
              g.beginPath();
              g.moveTo(x + t, c.y);
              g.lineTo(x + t - c.h, c.y + c.h);
              g.stroke();
            }
            g.restore();
            etoile(g, x + w / 2, c.y + c.h / 2, 10 * k, 4.5 * k, pal.accent2, pal.encre);
          }
        }
      }
      fx.dessiner(g, pal);
      g.restore();
      bandeau(g, pal, L, `${score} pts · plateau ${plateau}`, `${Math.ceil(reste)} s`);
      if (reste < 10 && reste > 0) {
        g.fillStyle = teinte(pal.accent, 0.35 + 0.2 * Math.sin(temps * 8));
        g.fillRect(6, 38, L - 12, 3);
      }
      fx.voile(g, L, H);
    },
    saisie(e: Saisie) {
      if (jeu.fini || e.type !== "down" || attente > 0) return;
      const c = cartes.find((k) => e.x >= k.x && e.x <= k.x + k.w && e.y >= k.y && e.y <= k.y + k.h);
      if (!c || c.face || c.trouvee) return;
      c.face = true;
      ouvertes.push(c);
      if (ouvertes.length < 2) return;
      const [a, b] = ouvertes;
      if (a.motif === b.motif && a.couleur === b.couleur) {
        a.trouvee = b.trouvee = true;
        const gain = 100 + 20 * Math.min(serie, 10);
        serie++;
        score += gain;
        for (const k of [a, b]) fx.gerbe(k.x + k.w / 2, k.y + k.h / 2, [a.couleur, pal.accent2, pal.neige], 10, 160, { forme: "etoile", gravite: 80, taille: 3 });
        fx.flotte(b.x + b.w / 2, b.y, `+${gain}`, pal.accent2, 18);
        ouvertes = [];
        if (cartes.every((k) => k.trouvee)) {
          score += 200;
          fx.flotte(L / 2, H / 2, "Plateau terminé : +200", pal.accent2, 22);
          fx.flash(pal.accent2, 0.35);
          distribuer();
        }
      } else {
        serie = 0;
        score = Math.max(0, score - 10);
        a.secoue = b.secoue = 0.3;
        attente = 0.75;
      }
      jeu.score = score;
    },
  };
  return jeu;
};
