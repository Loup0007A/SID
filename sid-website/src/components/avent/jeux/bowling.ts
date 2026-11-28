import { assombrir, bandeau, bille, bonhomme, boite, ciel, eclaircir, Effets, flocons, rond, teinte, texte, type CreerJeu, type Saisie } from "./moteur";

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
const TRAIT_PISTE = 3;

type Quille = { x: number; y: number; vx: number; vy: number; tombee: boolean; x0: number; y0: number; retiree: boolean; rot: number; touchee: boolean };
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
        quilles.push({ x, y, vx: 0, vy: 0, tombee: false, x0: x, y0: y, retiree: false, rot: 0, touchee: false });
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
  const fx = new Effets(rng);
  const etoiles = flocons(24, L, 60, rng);
  let temps = 0;
  let roulis = 0;

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
        fx.gerbe(L / 2, 150, [pal.accent, pal.accent2, pal.neige, pal.sapin], 46, 300, { gravite: 360 });
        fx.secouer(10);
        fx.flash(pal.accent2, 0.35);
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
        fx.gerbe(L / 2, 150, [pal.accent2, pal.neige], 24, 220, { forme: "etoile", taille: 4 });
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
      fx.maj(dt);
      temps += dt;
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
          roulis += Math.hypot(boule.vx, boule.vy) * d / R_BOULE;
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
              if (!q.touchee) {
                q.touchee = true;
                fx.gerbe(q.x, q.y, [pal.neige, pal.creme2], 8, 140, { gravite: 0, forme: "rond", taille: 3, vie: 0.5 });
                fx.secouer(3);
              }
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
          if (q.tombee) q.rot = Math.min(Math.PI / 2, q.rot + dt * 7) * (q.vx < 0 ? 1 : 1);
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
      ciel(g, pal, L, H, etoiles, temps);
      g.save();
      fx.decaler(g);
      // Guirlande lumineuse
      g.strokeStyle = pal.encre;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 46);
      for (let x = 0; x <= L; x += 30) g.quadraticCurveTo(x + 15, 58, x + 30, 46);
      g.stroke();
      const ampoules = [pal.accent, pal.accent2, pal.sapin, pal.neige];
      for (let i = 0, x = 15; x < L; x += 30, i++) {
        const allume = Math.sin(temps * 4 + i) > -0.2;
        rond(g, pal, x, 54, 4.5, allume ? ampoules[i % 4] : assombrir(ampoules[i % 4], 0.5), { ombre: 0, trait: 1.5 });
        if (allume) {
          g.fillStyle = teinte(ampoules[i % 4], 0.25);
          g.beginPath();
          g.arc(x, 54, 10, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Rigoles
      boite(g, pal, PISTE_G - 20, 66, PISTE_D - PISTE_G + 40, H - 72, assombrir(pal.creme2, 0.25), { r: 10, ombre: 5 });
      // Piste en lattes de bois
      const bois = ["rgb(236, 196, 140)", "rgb(226, 182, 124)", "rgb(240, 204, 150)"];
      const larg = (PISTE_D - PISTE_G) / 10;
      for (let i = 0; i < 10; i++) {
        g.fillStyle = bois[i % 3];
        g.fillRect(PISTE_G + i * larg, 66, larg + 0.5, H - 72);
      }
      const brillant = g.createLinearGradient(PISTE_G, 0, PISTE_D, 0);
      brillant.addColorStop(0, "rgba(255,255,255,0)");
      brillant.addColorStop(0.45, "rgba(255,255,255,0.28)");
      brillant.addColorStop(0.55, "rgba(255,255,255,0.28)");
      brillant.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = brillant;
      g.fillRect(PISTE_G, 66, PISTE_D - PISTE_G, H - 72);
      g.strokeStyle = "rgba(120, 74, 34, 0.25)";
      g.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        g.beginPath();
        g.moveTo(PISTE_G + i * larg, 66);
        g.lineTo(PISTE_G + i * larg, H - 6);
        g.stroke();
      }
      g.strokeStyle = pal.encre;
      g.lineWidth = TRAIT_PISTE;
      g.strokeRect(PISTE_G, 66, PISTE_D - PISTE_G, H - 72);
      // Ligne de faute, flèches et repères
      g.fillStyle = pal.accent;
      g.fillRect(PISTE_G, H - 110, PISTE_D - PISTE_G, 4);
      for (let i = -2; i <= 2; i++) {
        const x = L / 2 + i * 26;
        const y = 330 + Math.abs(i) * 10;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 7, y + 14);
        g.lineTo(x + 7, y + 14);
        g.closePath();
        g.fillStyle = pal.accent;
        g.fill();
        g.strokeStyle = pal.encre;
        g.lineWidth = 1.5;
        g.stroke();
        rond(g, pal, x, H - 140, 2.5, pal.encre, { ombre: 0, trait: 0 });
      }
      // Quilles : debout, ou couchées dans le sens de leur chute
      const ordre = quilles.filter((q) => !q.retiree).sort((a, b) => a.y - b.y);
      for (const q of ordre) {
        if (q.tombee) {
          g.save();
          g.translate(q.x, q.y);
          g.rotate(q.rot * (q.x < q.x0 ? -1 : 1));
          g.globalAlpha = 0.85;
          bonhomme(g, pal, 0, -6, 24, pal.accent);
          g.restore();
          g.globalAlpha = 1;
        } else {
          g.fillStyle = teinte(pal.encre, 0.18);
          g.beginPath();
          g.ellipse(q.x + 2, q.y + 9, 11, 4, 0, 0, Math.PI * 2);
          g.fill();
          bonhomme(g, pal, q.x, q.y - 6, 26, pal.accent);
        }
      }
      // Visée
      if (phase === "direction" || phase === "position") {
        g.save();
        g.translate(boule.x, boule.y);
        g.rotate(phase === "direction" ? angle : 0);
        g.strokeStyle = phase === "direction" ? pal.accent : teinte(pal.encre, 0.35);
        g.lineWidth = 4;
        g.setLineDash([10, 8]);
        g.lineDashOffset = -temps * 30;
        g.beginPath();
        g.moveTo(0, -R_BOULE - 6);
        g.lineTo(0, -170);
        g.stroke();
        g.setLineDash([]);
        if (phase === "direction") {
          g.fillStyle = pal.accent;
          g.beginPath();
          g.moveTo(0, -184);
          g.lineTo(-9, -168);
          g.lineTo(9, -168);
          g.closePath();
          g.fill();
          g.lineWidth = 2;
          g.strokeStyle = pal.encre;
          g.stroke();
        }
        g.restore();
      }
      fx.dessiner(g, pal);
      if (boule.y > -30) {
        bille(g, pal, boule.x, boule.y, R_BOULE, pal.accent, 3);
        g.fillStyle = assombrir(pal.accent, 0.55);
        for (let i = 0; i < 3; i++) {
          const a = roulis + i * 0.5;
          const px = boule.x + Math.cos(a) * R_BOULE * 0.45;
          const py = boule.y + Math.sin(a) * R_BOULE * 0.2 - 3;
          g.beginPath();
          g.arc(px, py, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
      bandeau(g, pal, L, `Manche ${Math.min(manche, MANCHES)}/${MANCHES} · lancer ${lancer}`, `${total} pts`);
      if (tableau.length) {
        boite(g, pal, 70, H - 34, L - 140, 24, teinte(pal.creme, 0.92), { r: 8, ombre: 2, trait: 2 });
        texte(g, pal, tableau.join("  "), L / 2, H - 22, { taille: 13, mono: true, couleur: pal.encre });
      }
      const aide = phase === "position" ? "Touche pour choisir le départ" : phase === "direction" ? "Touche pour lancer" : "";
      if (aide) texte(g, pal, aide, L / 2, 290, { taille: 15, couleur: pal.creme, contour: true });
      if (phase === "bilan" && message) {
        const k = 1 + Math.max(0, bilanT - 0.9) * 2;
        texte(g, pal, message, L / 2, 270, { taille: 32 * k, couleur: message.includes("!") ? pal.accent2 : pal.creme, contour: true });
      }
      fx.voile(g, L, H);
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
