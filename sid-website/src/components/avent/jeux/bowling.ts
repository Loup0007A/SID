import { bandeau, bonhomme, boite, rond, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Bowling des bonshommes de neige : 5 manches de 2 lancers.
 * 1er appui : position de départ (la boule glisse de gauche à droite).
 * 2e appui : direction (la flèche balance). La boule part.
 * Strike : +10, spare : +5.
 */
const L = 360;
const H = 540;
const PISTE_G = 70;
const PISTE_D = 290;
const MANCHES = 5;
const R_QUILLE = 11;
const R_BOULE = 15;

type Quille = { x: number; y: number; vx: number; vy: number; tombee: boolean; x0: number; y0: number; retiree: boolean };
type Phase = "position" | "direction" | "roule" | "bilan" | "fin";

export const bowling: CreerJeu = ({ pal, rng }) => {
  const quilles: Quille[] = [];
  const disposer = () => {
    quilles.length = 0;
    const base = { x: L / 2, y: 120 };
    const ecart = 30;
    for (let rang = 0; rang < 4; rang++)
      for (let i = 0; i <= rang; i++) {
        const x = base.x + (i - rang / 2) * ecart;
        const y = base.y + (3 - rang) * 26;
        quilles.push({ x, y, vx: 0, vy: 0, tombee: false, x0: x, y0: y, retiree: false });
      }
  };
  disposer();

  const boule = { x: L / 2, y: H - 70, vx: 0, vy: 0 };
  let phase: Phase = "position";
  let t = 0;
  let angle = 0;
  let manche = 1;
  let lancer = 1;
  let premier = 0;
  let total = 0;
  let bilanT = 0;
  let message = "";
  const tableau: string[] = [];

  function abattues() {
    return quilles.filter((q) => q.tombee && !q.retiree).length;
  }

  // Après le message : relancer, nouvelle manche ou fin.
  let apres: "relancer" | "manche" | "fin" = "relancer";

  function compter(n: number) {
    if (lancer === 1) {
      if (n === 10) {
        total += 20;
        message = "Strike !";
        tableau.push("X");
        apres = manche >= MANCHES ? "fin" : "manche";
        return;
      }
      premier = n;
      total += n;
      message = n === 0 ? "Dans la rigole" : `${n} quille${n > 1 ? "s" : ""}`;
      for (const q of quilles) if (q.tombee) q.retiree = true;
      apres = "relancer";
    } else {
      total += n;
      if (premier + n === 10) {
        total += 5;
        message = "Spare !";
        tableau.push(`${premier}/`);
      } else {
        message = `${n} quille${n > 1 ? "s" : ""}`;
        tableau.push(`${premier}-${n}`);
      }
      apres = manche >= MANCHES ? "fin" : "manche";
    }
  }
  function enchainer() {
    if (apres === "fin") {
      phase = "fin";
      jeu.score = total;
      jeu.fini = true;
      return;
    }
    if (apres === "manche") {
      manche++;
      lancer = 1;
      disposer();
    } else lancer = 2;
    boule.x = L / 2;
    boule.y = H - 70;
    boule.vx = 0;
    boule.vy = 0;
    t = rng() * 3;
    phase = "position";
  }

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      if (jeu.fini) return;
      t += dt;
      if (phase === "position") {
        boule.x = L / 2 + Math.sin(t * 2.2) * (PISTE_D - PISTE_G - 2 * R_BOULE) * 0.5;
      } else if (phase === "direction") {
        angle = Math.sin(t * 2.6) * 0.32;
      } else if (phase === "roule") {
        const pas = 4;
        for (let s = 0; s < pas; s++) {
          const d = dt / pas;
          boule.x += boule.vx * d;
          boule.y += boule.vy * d;
          // Rigoles
          if (boule.x < PISTE_G + R_BOULE * 0.4 || boule.x > PISTE_D - R_BOULE * 0.4) {
            boule.vx = 0;
            boule.x = boule.x < L / 2 ? PISTE_G - 4 : PISTE_D + 4;
          }
          for (const q of quilles) {
            if (q.retiree) continue;
            const dx = q.x - boule.x;
            const dy = q.y - boule.y;
            const dist = Math.hypot(dx, dy);
            if (dist < R_BOULE + R_QUILLE && dist > 0) {
              const nx = dx / dist;
              const ny = dy / dist;
              const v = Math.max(260, Math.hypot(boule.vx, boule.vy));
              q.vx = nx * v * 0.9;
              q.vy = ny * v * 0.9;
              boule.vx -= nx * 30;
              boule.vy *= 0.97;
              q.x = boule.x + nx * (R_BOULE + R_QUILLE + 0.5);
              q.y = boule.y + ny * (R_BOULE + R_QUILLE + 0.5);
            }
          }
        }
        for (const q of quilles) {
          if (q.retiree) continue;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.vx *= 1 - 2.4 * dt;
          q.vy *= 1 - 2.4 * dt;
          if (Math.hypot(q.x - q.x0, q.y - q.y0) > 7) q.tombee = true;
        }
        // Quilles entre elles
        for (let i = 0; i < quilles.length; i++)
          for (let j = i + 1; j < quilles.length; j++) {
            const a = quilles[i];
            const b = quilles[j];
            if (a.retiree || b.retiree) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 2 * R_QUILLE && dist > 0) {
              const nx = dx / dist;
              const ny = dy / dist;
              const va = a.vx * nx + a.vy * ny;
              const vb = b.vx * nx + b.vy * ny;
              const p = va - vb;
              if (p > 0) {
                a.vx -= p * nx * 0.85;
                a.vy -= p * ny * 0.85;
                b.vx += p * nx * 0.85;
                b.vy += p * ny * 0.85;
              }
              const chev = 2 * R_QUILLE - dist;
              a.x -= (nx * chev) / 2;
              a.y -= (ny * chev) / 2;
              b.x += (nx * chev) / 2;
              b.y += (ny * chev) / 2;
            }
          }
        const calme = quilles.every((q) => q.retiree || Math.hypot(q.vx, q.vy) < 12);
        if ((boule.y < -40 && calme) || t > 6) {
          phase = "bilan";
          bilanT = 1.1;
          compter(abattues());
          jeu.score = total;
        }
      } else if (phase === "bilan") {
        bilanT -= dt;
        if (bilanT <= 0) enchainer();
      }
    },
    dessiner(g: CanvasRenderingContext2D) {
      g.fillStyle = pal.fond;
      g.fillRect(0, 0, L, H);
      boite(g, pal, PISTE_G - 18, 40, PISTE_D - PISTE_G + 36, H - 50, pal.creme2, { r: 8, ombre: 4 });
      boite(g, pal, PISTE_G, 40, PISTE_D - PISTE_G, H - 50, pal.creme, { r: 0, ombre: 0, trait: 2 });
      g.strokeStyle = pal.voile;
      g.lineWidth = 1;
      for (let x = PISTE_G + 22; x < PISTE_D; x += 22) {
        g.beginPath();
        g.moveTo(x, 40);
        g.lineTo(x, H - 10);
        g.stroke();
      }
      // Flèches de visée
      g.fillStyle = pal.accent;
      for (let i = -2; i <= 2; i++) {
        const x = L / 2 + i * 26;
        g.beginPath();
        g.moveTo(x, 330);
        g.lineTo(x - 6, 342);
        g.lineTo(x + 6, 342);
        g.fill();
      }
      for (const q of quilles) {
        if (q.retiree) continue;
        if (q.tombee) {
          g.globalAlpha = 0.6;
          rond(g, pal, q.x, q.y, R_QUILLE * 0.9, pal.neige, { ombre: 0, trait: 2 });
          g.globalAlpha = 1;
        } else bonhomme(g, pal, q.x, q.y - 6, 26, pal.accent);
      }
      if (phase === "direction") {
        g.save();
        g.translate(boule.x, boule.y);
        g.rotate(angle);
        g.strokeStyle = pal.encre;
        g.lineWidth = 4;
        g.setLineDash([8, 6]);
        g.beginPath();
        g.moveTo(0, -R_BOULE - 4);
        g.lineTo(0, -150);
        g.stroke();
        g.setLineDash([]);
        g.restore();
      }
      if (boule.y > -30) rond(g, pal, boule.x, boule.y, R_BOULE, pal.accent, { ombre: 3, trait: 3 });
      bandeau(g, pal, L, `Manche ${Math.min(manche, MANCHES)}/${MANCHES} · lancer ${lancer}`, `${total} pts`);
      if (tableau.length) texte(g, pal, tableau.join("  "), L / 2, H - 22, { taille: 13, mono: true, couleur: pal.encre });
      const aide = phase === "position" ? "Touche pour choisir le départ" : phase === "direction" ? "Touche pour lancer" : "";
      if (aide) texte(g, pal, aide, L / 2, H - 112, { taille: 15, couleur: pal.creme, contour: true });
      if (phase === "bilan" && message) texte(g, pal, message, L / 2, 270, { taille: 30, couleur: pal.creme, contour: true });
    },
    saisie(e: Saisie) {
      const appui = e.type === "down" || (e.type === "keydown" && (e.key === " " || e.key === "Enter"));
      if (!appui) return;
      if (phase === "position") {
        phase = "direction";
        t = 0;
      } else if (phase === "direction") {
        const v = 520;
        boule.vx = Math.sin(angle) * v;
        boule.vy = -Math.cos(angle) * v;
        phase = "roule";
        t = 0;
      }
    },
  };
  return jeu;
};
