import { bandeau, bille, borne, boite, cadeau, ciel, collines, Effets, flocons, majFlocons, dessinerFlocons, sapin, teinte, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Casse-cadeaux : la luge renvoie une boule de neige vers des rangées de
 * paquets. 3 vies ; un niveau vidé en amène un plus rapide (+200).
 * Doigt, souris ou flèches ; toucher ou espace pour lancer.
 */
const L = 360;
const H = 540;
const COLS = 7;
const RANGS = 6;
const BW = 44;
const BH = 20;
const GX = (L - COLS * (BW + 4)) / 2 + 2;
const GY = 70;

type Paquet = { x: number; y: number; vie: number; pts: number; couleur: string; ruban: string };

export const cassebriques: CreerJeu = ({ pal, rng }) => {
  const luge = { x: L / 2, w: 74, y: H - 46 };
  const boule = { x: L / 2, y: luge.y - 12, vx: 0, vy: 0, r: 7, collee: true };
  let paquets: Paquet[] = [];
  let niveau = 1;
  let vies = 3;
  let score = 0;
  let cible = L / 2;
  let gauche = false;
  let droite = false;
  let message = "Touche pour lancer";
  const fx = new Effets(rng);
  const etoiles = flocons(26, L, 260, rng);
  const neige = flocons(30, L, H, rng);
  let temps = 0;
  let serie = 0;

  function construire() {
    const couleurs = [pal.accent, pal.accent2, pal.sapin, pal.creme2, pal.accentCarte, pal.neige];
    paquets = [];
    for (let r = 0; r < RANGS; r++)
      for (let c = 0; c < COLS; c++) {
        if (niveau > 1 && rng() < 0.12) continue;
        const dur = niveau >= 3 && r === 0 ? 2 : 1;
        paquets.push({
          x: GX + c * (BW + 4),
          y: GY + r * (BH + 6),
          vie: dur,
          pts: (RANGS - r) * 10,
          couleur: couleurs[r % couleurs.length],
          ruban: r % 2 ? pal.accent : pal.accent2,
        });
      }
  }
  construire();

  const vitesse = () => 290 + niveau * 35;
  function coller() {
    boule.collee = true;
    boule.vx = 0;
    boule.vy = 0;
  }
  function lancer() {
    if (!boule.collee) return;
    boule.collee = false;
    const a = (rng() - 0.5) * 0.8;
    boule.vx = Math.sin(a) * vitesse();
    boule.vy = -Math.cos(a) * vitesse();
    message = "";
  }

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      fx.maj(dt);
      temps += dt;
      majFlocons(neige, dt, L, H);
      if (jeu.fini) return;
      if (gauche) cible -= 420 * dt;
      if (droite) cible += 420 * dt;
      cible = borne(cible, luge.w / 2 + 8, L - luge.w / 2 - 8);
      luge.x += borne(cible - luge.x, -900 * dt, 900 * dt);
      if (boule.collee) {
        boule.x = luge.x;
        boule.y = luge.y - 12;
        return;
      }
      const pas = 4;
      for (let s = 0; s < pas; s++) {
        const d = dt / pas;
        boule.x += boule.vx * d;
        boule.y += boule.vy * d;
        if (boule.x < 10 + boule.r) {
          boule.x = 10 + boule.r;
          boule.vx = Math.abs(boule.vx);
        }
        if (boule.x > L - 10 - boule.r) {
          boule.x = L - 10 - boule.r;
          boule.vx = -Math.abs(boule.vx);
        }
        if (boule.y < 42 + boule.r) {
          boule.y = 42 + boule.r;
          boule.vy = Math.abs(boule.vy);
        }
        // Luge
        if (boule.vy > 0 && boule.y + boule.r >= luge.y - 6 && boule.y < luge.y + 8 && Math.abs(boule.x - luge.x) < luge.w / 2 + boule.r) {
          const k = borne((boule.x - luge.x) / (luge.w / 2), -1, 1);
          const a = k * 1.05;
          const v = vitesse();
          boule.vx = Math.sin(a) * v;
          boule.vy = -Math.cos(a) * v;
          boule.y = luge.y - 6 - boule.r;
          serie = 0;
          fx.gerbe(boule.x, luge.y - 6, [pal.neige], 6, 90, { gravite: 200, forme: "rond", taille: 2, vie: 0.4 });
        }
        // Paquets
        for (const p of paquets) {
          if (p.vie <= 0) continue;
          const nx = borne(boule.x, p.x, p.x + BW);
          const ny = borne(boule.y, p.y, p.y + BH);
          const dx = boule.x - nx;
          const dy = boule.y - ny;
          if (dx * dx + dy * dy < boule.r * boule.r) {
            if (Math.abs(dx) > Math.abs(dy)) boule.vx = Math.sign(dx || -boule.vx) * Math.abs(boule.vx);
            else boule.vy = Math.sign(dy || -boule.vy) * Math.abs(boule.vy);
            p.vie--;
            if (p.vie <= 0) {
              score += p.pts;
              serie++;
              fx.gerbe(p.x + BW / 2, p.y + BH / 2, [p.couleur, p.ruban, pal.neige], 12, 200, { gravite: 520, forme: "carre", taille: 3.5 });
              fx.flotte(p.x + BW / 2, p.y, `+${p.pts}`, pal.accent2, serie > 3 ? 18 : 14);
              fx.secouer(serie > 3 ? 4 : 2);
            } else fx.gerbe(p.x + BW / 2, p.y + BH, [pal.neige], 5, 80, { gravite: 300, forme: "rond", taille: 2 });
            break;
          }
        }
        if (boule.y > H + 20) {
          fx.secouer(8);
          fx.flash(pal.accent, 0.3);
          vies--;
          if (vies <= 0) {
            jeu.fini = true;
            message = "Plus de boule";
          } else {
            message = "Touche pour relancer";
            coller();
          }
          break;
        }
      }
      if (paquets.every((p) => p.vie <= 0)) {
        score += 200;
        fx.flash(pal.accent2, 0.45);
        fx.gerbe(L / 2, H / 2, [pal.accent, pal.accent2, pal.neige, pal.sapin], 40, 300);
        niveau++;
        construire();
        coller();
        message = `Niveau ${niveau} : touche pour lancer`;
      }
      jeu.score = score;
      if (!boule.collee) fx.trace(boule.x, boule.y, teinte(pal.neige, 0.55), boule.r * 0.9, 0.2);
    },
    dessiner(g: CanvasRenderingContext2D) {
      ciel(g, pal, L, H, etoiles, temps);
      g.save();
      fx.decaler(g);
      // Décor : lune, sapins, collines
      g.fillStyle = teinte(pal.neige, 0.18);
      g.beginPath();
      g.arc(296, 290, 40, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = teinte(pal.neige, 0.75);
      g.beginPath();
      g.arc(296, 290, 24, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = teinte(pal.creme2, 0.8);
      for (const [cx, cy, cr] of [[289, 284, 5], [303, 297, 4], [300, 280, 2.5]]) {
        g.beginPath();
        g.arc(cx, cy, cr, 0, Math.PI * 2);
        g.fill();
      }
      sapin(g, pal, 40, H - 70, 70);
      sapin(g, pal, 318, H - 62, 56);
      collines(g, pal, L, H - 66, H);
      dessinerFlocons(g, neige, "rgba(255,255,255,0.55)");
      // Cadre de jeu
      g.strokeStyle = pal.encre;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(6, 40, L - 12, H - 46, 12);
      g.stroke();
      for (const p of paquets) {
        if (p.vie <= 0) continue;
        cadeau(g, pal, p.x, p.y, BW, BH, p.couleur, p.ruban, 2);
        if (p.vie > 1) {
          // Paquet à deux coups : une couche de givre
          g.fillStyle = "rgba(255,255,255,0.55)";
          g.beginPath();
          g.roundRect(p.x + 2, p.y + 2, BW - 4, 6, 3);
          g.fill();
          g.fillStyle = "rgba(255,255,255,0.8)";
          for (let k = 0; k < 4; k++) g.fillRect(p.x + 6 + k * 10, p.y + 8, 2, 4 + (k % 2) * 3);
        }
      }
      // Luge
      const lx = luge.x - luge.w / 2;
      g.strokeStyle = pal.encre;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(lx + 4, luge.y + 13);
      g.lineTo(lx + luge.w - 6, luge.y + 13);
      g.quadraticCurveTo(lx + luge.w + 12, luge.y + 13, lx + luge.w + 6, luge.y - 2);
      g.stroke();
      g.lineWidth = 2;
      for (const k of [0.25, 0.75]) {
        g.beginPath();
        g.moveTo(lx + luge.w * k, luge.y + 5);
        g.lineTo(lx + luge.w * k, luge.y + 13);
        g.stroke();
      }
      boite(g, pal, lx, luge.y - 6, luge.w, 12, pal.accent, { r: 6, ombre: 3 });
      g.fillStyle = "rgba(255,255,255,0.4)";
      g.fillRect(lx + 6, luge.y - 4, luge.w - 12, 3);
      fx.dessiner(g, pal);
      bille(g, pal, boule.x, boule.y, boule.r, pal.neige, 2);
      g.restore();
      bandeau(g, pal, L, `${score} pts · niv. ${niveau}`, "");
      for (let i = 0; i < Math.max(vies, 0); i++) bille(g, pal, L - 26 - i * 18, 21, 6, pal.neige, 1);
      if (message) texte(g, pal, message, L / 2, H - 140, { taille: 17, couleur: pal.creme, contour: true });
      fx.voile(g, L, H);
    },
    saisie(e: Saisie) {
      if (e.type === "down" || e.type === "move") {
        cible = e.x;
        if (e.type === "down") lancer();
      } else if (e.type === "keydown" || e.type === "keyup") {
        const on = e.type === "keydown";
        if (e.key === "ArrowLeft" || e.key === "q" || e.key === "a") gauche = on;
        if (e.key === "ArrowRight" || e.key === "d") droite = on;
        if (on && (e.key === " " || e.key === "ArrowUp")) lancer();
      }
    },
  };
  return jeu;
};
