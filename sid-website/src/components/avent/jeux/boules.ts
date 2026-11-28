import { assombrir, bandeau, bille, bonhomme, boite, ciel, collines, dessinerFlocons, eclaircir, Effets, flocons, lutin, majFlocons, sapin, teinte, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Bataille de boules de neige : 45 secondes. Chaque lutin touché accélère
 * le jeu (vitesse × 1,045 par touche, ×4 au plus) ; un bonhomme touché la
 * fait redescendre un peu. Des lutins sortent des congères
 * (10 points × multiplicateur), parfois un bonhomme de neige (−30, série
 * perdue). Toutes les 5 touches d'affilée, le multiplicateur monte (×4 au
 * plus). Un tir dans le vide casse la série.
 */
const L = 360;
const H = 540;
const DUREE = 45;
const TROUS: [number, number][] = [];
for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) TROUS.push([70 + c * 110, 152 + r * 100]);

type Cible = { trou: number; t: number; vie: number; bon: boolean; touche: number };

const melangeSol = (pal: { creme2: string; fond: string }) => eclaircir(pal.fond, 0.55);

export const boules: CreerJeu = ({ pal, rng }) => {
  let reste = DUREE;
  let score = 0;
  let serie = 0;
  let cibles: Cible[] = [];
  let prochain = 0.6;
  const fl = flocons(40, L, H, rng);
  const etoiles = flocons(30, L, 100, rng);
  const fx = new Effets(rng);
  let temps = 0;
  // Boules lancées depuis le bas de l'écran (décor : le score est déjà compté)
  let tirs: { x: number; y: number; t: number; touche: boolean; bon: boolean }[] = [];
  const DUREE_TIR = 0.14;
  const mult = () => Math.min(4, 1 + Math.floor(serie / 5));
  // Chaque lutin touché accélère le jeu de 4,5 % : croissance exponentielle
  // (×1,5 après 9 touches, ×2,4 après 20, ×4 au plus).
  let touches = 0;
  const vitesse = () => Math.min(4, 1.045 ** touches);

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      majFlocons(fl, dt, L, H);
      fx.maj(dt);
      temps += dt;
      for (const t of tirs) {
        const avant = t.t;
        t.t += dt;
        if (avant < DUREE_TIR && t.t >= DUREE_TIR) {
          fx.gerbe(t.x, t.y, [pal.neige, pal.creme2], 12, 150, { gravite: 300, forme: "rond", taille: 3, vie: 0.5 });
          if (t.touche && t.bon) fx.gerbe(t.x, t.y - 10, [pal.accent2], 5, 60, { gravite: 0, forme: "etoile", taille: 3, vie: 0.7 });
        }
      }
      tirs = tirs.filter((t) => t.t < DUREE_TIR + 0.05);
      if (jeu.fini) return;
      reste -= dt;
      if (reste <= 0) {
        reste = 0;
        jeu.fini = true;
        return;
      }
      prochain -= dt;
      if (prochain <= 0) {
        const libres = TROUS.map((_, i) => i).filter((i) => !cibles.some((c) => c.trou === i));
        if (libres.length) {
          const vie = Math.max(0.38, (1.5 + rng() * 0.3) / vitesse());
          cibles.push({ trou: libres[Math.floor(rng() * libres.length)], t: 0, vie, bon: rng() > 0.2, touche: -1 });
        }
        prochain = Math.max(0.16, (0.8 + rng() * 0.25) / vitesse());
      }
      for (const c of cibles) c.t += dt;
      cibles = cibles.filter((c) => (c.touche >= 0 ? c.t - c.touche < 0.25 : c.t < c.vie));
      jeu.score = score;
    },
    dessiner(g: CanvasRenderingContext2D) {
      ciel(g, pal, L, H, etoiles, temps);
      g.save();
      fx.decaler(g);
      // Village au loin
      const maisons = [[18, 70, 40], [66, 54, 50], [262, 60, 46], [312, 44, 40]];
      for (const [x, w, h] of maisons) {
        const y = 108;
        g.fillStyle = assombrir(pal.fond, 0.35);
        g.fillRect(x, y - h, w, h);
        g.beginPath();
        g.moveTo(x - 4, y - h);
        g.lineTo(x + w / 2, y - h - 18);
        g.lineTo(x + w + 4, y - h);
        g.fill();
        g.fillStyle = pal.neige;
        g.fillRect(x - 4, y - h - 2, w + 8, 4);
        g.fillStyle = teinte(pal.accent2, 0.85);
        g.fillRect(x + 8, y - h + 10, 8, 8);
        if (w > 44) g.fillRect(x + w - 18, y - h + 10, 8, 8);
      }
      sapin(g, pal, 150, 110, 44);
      sapin(g, pal, 214, 112, 36);
      collines(g, pal, L, 96, H);
      const sol = g.createLinearGradient(0, 130, 0, H);
      sol.addColorStop(0, teinte(pal.creme2, 0));
      sol.addColorStop(1, teinte(melangeSol(pal), 0.9));
      g.fillStyle = sol;
      g.fillRect(0, 130, L, H - 130);
      dessinerFlocons(g, fl, "rgba(255,255,255,0.5)");
      TROUS.forEach(([x, y], i) => {
        const c = cibles.find((k) => k.trou === i);
        // Fond de la congère (creux)
        g.fillStyle = teinte(pal.creme2, 1);
        g.beginPath();
        g.ellipse(x, y - 2, 38, 10, 0, Math.PI, 0);
        g.fill();
        if (c) {
          const montee = Math.min(1, c.t / 0.15, (c.vie - c.t) / 0.15);
          const touche = c.touche >= 0 ? (c.t - c.touche) / 0.25 : 0;
          const dy = (1 - Math.max(0, montee)) * 46 + touche * 40;
          g.save();
          g.beginPath();
          g.rect(x - 52, y - 80, 104, 80);
          g.clip();
          g.translate(x, y - 22 + dy);
          if (c.touche >= 0) g.rotate((c.bon ? 1 : -1) * touche * 0.6);
          if (c.bon) {
            lutin(g, pal, 0, 0, 40, pal.accent);
            // Bras qui salue
            const salut = Math.sin(temps * 14) * 0.5;
            g.strokeStyle = pal.encre;
            g.lineWidth = 3;
            g.beginPath();
            g.moveTo(16, 18);
            g.lineTo(16 + Math.cos(-1 + salut) * 14, 18 + Math.sin(-1 + salut) * 14);
            g.stroke();
          } else bonhomme(g, pal, 0, -4, 46, pal.sapin);
          if (c.touche >= 0 && c.bon) {
            for (let k = 0; k < 3; k++) {
              const a = temps * 8 + (k * Math.PI * 2) / 3;
              g.fillStyle = pal.accent2;
              g.fillRect(Math.cos(a) * 14 - 2, -26 + Math.sin(a) * 4 - 2, 4, 4);
            }
          }
          g.restore();
        }
        // Congère (devant)
        g.fillStyle = pal.encre;
        g.beginPath();
        g.ellipse(x + 3, y + 4, 46, 17, 0, 0, Math.PI * 2);
        g.fill();
        const d = g.createLinearGradient(0, y - 16, 0, y + 16);
        d.addColorStop(0, pal.neige);
        d.addColorStop(1, eclaircir(pal.creme2, 0.1));
        g.fillStyle = d;
        g.beginPath();
        g.ellipse(x, y + 1, 46, 17, 0, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = pal.encre;
        g.stroke();
        g.fillStyle = "rgba(255,255,255,0.9)";
        g.beginPath();
        g.ellipse(x - 14, y - 6, 14, 4, -0.1, 0, Math.PI * 2);
        g.fill();
      });
      // Boules en vol : de la main du joueur vers le point visé
      for (const t of tirs) {
        if (t.t >= DUREE_TIR) continue;
        const k = t.t / DUREE_TIR;
        const x = L / 2 + (t.x - L / 2) * k;
        const y = H + 10 + (t.y - H - 10) * k - Math.sin(k * Math.PI) * 60;
        bille(g, pal, x, y, 9 - k * 3, pal.neige, 2);
      }
      fx.dessiner(g, pal);
      g.restore();
      bandeau(g, pal, L, `${score} pts · vitesse ×${vitesse().toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`, `${Math.ceil(reste)} s`);
      // Multiplicateur
      const m = mult();
      const barre = m >= 4 ? 1 : (serie % 5) / 5;
      boite(g, pal, 20, H - 30, L - 94, 14, pal.creme2, { r: 7, ombre: 2, trait: 2 });
      if (barre > 0) boite(g, pal, 20, H - 30, Math.max(14, (L - 94) * barre), 14, m >= 4 ? pal.accent : pal.accent2, { r: 7, ombre: 0, trait: 2 });
      boite(g, pal, L - 66, H - 36, 48, 26, m > 1 ? pal.accent2 : pal.creme, { r: 9, ombre: 2, trait: 2 });
      texte(g, pal, `×${m}`, L - 42, H - 23, { taille: 16 });
      if (reste < 5 && reste > 0) texte(g, pal, `${Math.ceil(reste)}`, L / 2, H / 2, { taille: 70, couleur: teinte(pal.creme, 0.5) });
      fx.voile(g, L, H);
    },
    saisie(e: Saisie) {
      if (jeu.fini || e.type !== "down") return;
      const c = cibles.find((k) => {
        const [x, y] = TROUS[k.trou];
        return k.touche < 0 && Math.abs(e.x - x) < 42 && e.y > y - 72 && e.y < y + 14;
      });
      if (!c) {
        if (serie >= 5) fx.flotte(e.x, e.y - 20, "série perdue", pal.creme, 14);
        serie = 0;
        tirs.push({ x: e.x, y: e.y, t: 0, touche: false, bon: false });
        return;
      }
      tirs.push({ x: e.x, y: e.y, t: 0, touche: true, bon: c.bon });
      c.touche = c.t;
      if (c.bon) {
        const pts = 10 * mult();
        score += pts;
        serie++;
        touches++;
        fx.flotte(e.x, e.y - 24, `+${pts}`, pal.accent2, 16 + mult() * 2);
        if (serie % 5 === 0 && mult() > 1) {
          fx.flotte(L / 2, H - 70, `×${mult()}`, pal.accent2, 30);
          fx.flash(pal.accent2, 0.2);
        }
      } else {
        score = Math.max(0, score - 30);
        serie = 0;
        touches = Math.max(0, touches - 3);
        fx.flotte(e.x, e.y - 24, "−30", pal.accent, 18);
        fx.secouer(7);
      }
      jeu.score = score;
    },
  };
  return jeu;
};
