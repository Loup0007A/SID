import { bandeau, borne, boite, cadeau, rond, texte, type CreerJeu, type Saisie } from "./moteur";

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
  let eclats: { x: number; y: number; vx: number; vy: number; t: number; c: string }[] = [];

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
      if (jeu.fini) return;
      if (gauche) cible -= 420 * dt;
      if (droite) cible += 420 * dt;
      cible = borne(cible, luge.w / 2 + 8, L - luge.w / 2 - 8);
      luge.x += borne(cible - luge.x, -900 * dt, 900 * dt);
      eclats = eclats.filter((e) => (e.t -= dt) > 0);
      for (const e of eclats) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vy += 500 * dt;
      }
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
              for (let i = 0; i < 6; i++)
                eclats.push({ x: p.x + BW / 2, y: p.y + BH / 2, vx: (rng() - 0.5) * 220, vy: -rng() * 180, t: 0.7, c: p.couleur });
            }
            break;
          }
        }
        if (boule.y > H + 20) {
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
        niveau++;
        construire();
        coller();
        message = `Niveau ${niveau} : touche pour lancer`;
      }
      jeu.score = score;
    },
    dessiner(g: CanvasRenderingContext2D) {
      g.fillStyle = pal.fond;
      g.fillRect(0, 0, L, H);
      boite(g, pal, 6, 40, L - 12, H - 46, pal.creme2, { r: 12, ombre: 4 });
      for (const p of paquets) {
        if (p.vie <= 0) continue;
        cadeau(g, pal, p.x, p.y, BW, BH, p.couleur, p.ruban, 2);
        if (p.vie > 1) {
          g.fillStyle = "rgba(255,255,255,0.45)";
          g.fillRect(p.x + 3, p.y + 3, BW - 6, 4);
        }
      }
      for (const e of eclats) {
        g.fillStyle = e.c;
        g.fillRect(e.x - 3, e.y - 3, 6, 6);
      }
      // Luge
      boite(g, pal, luge.x - luge.w / 2, luge.y - 6, luge.w, 12, pal.accent, { r: 6, ombre: 3 });
      g.strokeStyle = pal.encre;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(luge.x - luge.w / 2 + 6, luge.y + 12);
      g.lineTo(luge.x + luge.w / 2 - 2, luge.y + 12);
      g.quadraticCurveTo(luge.x + luge.w / 2 + 10, luge.y + 12, luge.x + luge.w / 2 + 6, luge.y + 2);
      g.stroke();
      rond(g, pal, boule.x, boule.y, boule.r, pal.neige, { ombre: 2, trait: 2.5 });
      bandeau(g, pal, L, `${score} pts · niv. ${niveau}`, "●".repeat(Math.max(vies, 0)));
      if (message) texte(g, pal, message, L / 2, H - 120, { taille: 17, couleur: pal.creme, contour: true });
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
