import { assombrir, bandeau, boite, bonhomme, ciel, Effets, etoile, flocons, lutin, sapin, teinte, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Course de luge : la luge file sur la neige de plus en plus vite. Toucher
 * (ou espace, ↑) fait sauter ; garder appuyé saute plus haut. Les rochers
 * et les bonshommes de neige arrêtent la course. 1 point tous les 12 px
 * parcourus, 25 par étoile attrapée.
 */
const L = 360;
const H = 540;
const SOL = H - 120;
const LX = 78;

type Obstacle = { x: number; w: number; h: number; type: "rocher" | "bonhomme" | "double" };
type Etoile = { x: number; y: number; prise: boolean };

export const luge: CreerJeu = ({ pal, rng }) => {
  const fx = new Effets(rng);
  const etoilesCiel = flocons(36, L, 220, rng);
  const obstacles: Obstacle[] = [];
  const bonus: Etoile[] = [];
  let temps = 0;
  let distance = 0;
  let etoiles = 0;
  let vitesse = 250;
  let y = 0; // hauteur au-dessus du sol (négatif = en l'air)
  let vy = 0;
  let appui = false;
  let tenu = 0;
  let prochain = 420;
  let message = "Touche pour sauter";
  let messageT = 2;
  const sapins = Array.from({ length: 7 }, (_, i) => ({ x: i * 64 + rng() * 30, s: 40 + rng() * 26 }));

  function sauter() {
    if (jeu.fini) return;
    if (y >= -0.5) {
      vy = -540;
      tenu = 0;
      fx.gerbe(LX, SOL, [pal.neige], 8, 100, { gravite: 300, forme: "rond", taille: 2.5, vie: 0.5 });
    }
  }

  function generer(x: number) {
    const r = rng();
    const avance = Math.min(1, distance / 30000);
    if (r < 0.45) obstacles.push({ x, w: 30, h: 22, type: "rocher" });
    else if (r < 0.8) obstacles.push({ x, w: 30, h: 46, type: "bonhomme" });
    else obstacles.push({ x, w: 58, h: 24, type: "double" });
    if (rng() < 0.55) bonus.push({ x: x + 20 + rng() * 60, y: SOL - 70 - rng() * 70, prise: false });
    // Écart toujours plus long qu'un saut, pour qu'aucun enchaînement ne soit impossible.
    prochain = x + vitesse * 0.75 + 60 + rng() * (220 - avance * 60);
  }

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      fx.maj(dt);
      temps += dt;
      messageT -= dt;
      if (jeu.fini) return;
      vitesse = Math.min(640, 250 + temps * 6.5);
      const dx = vitesse * dt;
      distance += dx;
      for (const o of obstacles) o.x -= dx;
      for (const b of bonus) b.x -= dx;
      for (const s of sapins) {
        s.x -= dx * 0.35;
        if (s.x < -40) s.x += L + 80;
      }
      prochain -= dx;
      if (prochain < L + 40) generer(Math.max(L + 40, prochain));
      while (obstacles.length && obstacles[0].x + obstacles[0].w < -20) obstacles.shift();
      while (bonus.length && bonus[0].x < -20) bonus.shift();

      // Saut : gravité réduite tant qu'on garde appuyé (0,22 s au plus)
      if (appui && vy < 0 && tenu < 0.22) {
        tenu += dt;
        vy += 900 * dt;
      } else vy += 2100 * dt;
      y += vy * dt;
      if (y > 0) {
        if (vy > 400) fx.gerbe(LX, SOL, [pal.neige], 6, 90, { gravite: 300, forme: "rond", taille: 2, vie: 0.4 });
        y = 0;
        vy = 0;
      }
      if (y === 0 && Math.floor(temps * 20) % 2 === 0) fx.trace(LX - 22, SOL - 2 + rng() * 3, teinte(pal.neige, 0.9), 2.5, 0.3);

      // Collisions (boîtes un peu réduites, pour être juste)
      const gx = LX - 20;
      const gw = 40;
      const gy = SOL + y - 24;
      for (const o of obstacles) {
        if (gx + gw - 6 > o.x + 4 && gx + 6 < o.x + o.w - 4 && gy + 24 > SOL - o.h + 4) {
          jeu.fini = true;
          message = "Chute !";
          messageT = 99;
          fx.gerbe(LX, SOL - 10, [pal.neige, pal.accent, pal.accent2], 30, 240);
          fx.secouer(12);
          fx.flash(pal.accent, 0.3);
          break;
        }
      }
      for (const b of bonus) {
        if (!b.prise && Math.abs(b.x - LX) < 24 && Math.abs(b.y - (gy + 8)) < 26) {
          b.prise = true;
          etoiles++;
          fx.gerbe(b.x, b.y, [pal.accent2, pal.neige], 12, 140, { forme: "etoile", gravite: 0, taille: 3 });
          fx.flotte(b.x, b.y - 14, "+25", pal.accent2, 16);
        }
      }
      jeu.score = Math.floor(distance / 12) + etoiles * 25;
    },
    dessiner(g: CanvasRenderingContext2D) {
      ciel(g, pal, L, H, etoilesCiel, temps);
      // Montagnes (parallaxe lente) : pics réguliers, sommets enneigés
      const decal = (distance * 0.08) % 130;
      for (let k = -1; k < 5; k++) {
        const px = k * 130 - decal + 40;
        const hauteurPic = 120 + ((k + Math.floor((distance * 0.08) / 130)) % 3 + 3) % 3 * 30;
        const top = SOL - hauteurPic;
        g.fillStyle = assombrir(pal.fond, 0.25);
        g.beginPath();
        g.moveTo(px - 110, SOL);
        g.lineTo(px, top);
        g.lineTo(px + 110, SOL);
        g.closePath();
        g.fill();
        g.fillStyle = teinte(pal.neige, 0.9);
        g.beginPath();
        g.moveTo(px - 30, top + 30 * (hauteurPic / 110) * 0.9);
        g.lineTo(px, top);
        g.lineTo(px + 30, top + 30 * (hauteurPic / 110) * 0.9);
        g.lineTo(px + 14, top + 22);
        g.lineTo(px, top + 32);
        g.lineTo(px - 14, top + 22);
        g.closePath();
        g.fill();
      }
      for (const s of sapins) sapin(g, pal, s.x, SOL - 4, s.s);
      g.save();
      fx.decaler(g);
      // Piste
      const d = g.createLinearGradient(0, SOL, 0, H);
      d.addColorStop(0, pal.neige);
      d.addColorStop(1, teinte(pal.creme2, 1));
      g.fillStyle = d;
      g.fillRect(0, SOL, L, H - SOL);
      g.strokeStyle = pal.encre;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, SOL);
      g.lineTo(L, SOL);
      g.stroke();
      g.strokeStyle = teinte(pal.encre, 0.12);
      g.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const x = ((k * 80 - distance) % (L + 80) + L + 80) % (L + 80) - 40;
        g.beginPath();
        g.moveTo(x, SOL + 30 + (k % 3) * 22);
        g.lineTo(x + 40, SOL + 30 + (k % 3) * 22);
        g.stroke();
      }
      // Étoiles à attraper
      for (const b of bonus) {
        if (b.prise) continue;
        g.fillStyle = teinte(pal.accent2, 0.3);
        g.beginPath();
        g.arc(b.x, b.y, 14, 0, Math.PI * 2);
        g.fill();
        etoile(g, b.x, b.y + Math.sin(temps * 5 + b.x) * 3, 11, 5, pal.accent2, pal.encre, temps);
      }
      // Obstacles
      for (const o of obstacles) {
        if (o.type === "bonhomme") bonhomme(g, pal, o.x + o.w / 2, SOL - 24, 50, pal.accent);
        else {
          const n = o.type === "double" ? 2 : 1;
          for (let k = 0; k < n; k++) {
            const rx = o.x + k * 28;
            g.fillStyle = pal.encre;
            g.beginPath();
            g.ellipse(rx + 17, SOL - 8, 16, 13, 0, Math.PI, 0);
            g.fill();
            g.fillStyle = "rgb(130, 135, 150)";
            g.beginPath();
            g.moveTo(rx, SOL);
            g.quadraticCurveTo(rx + 2, SOL - 24, rx + 15, SOL - 23);
            g.quadraticCurveTo(rx + 30, SOL - 22, rx + 30, SOL);
            g.closePath();
            g.fill();
            g.lineWidth = 2.5;
            g.strokeStyle = pal.encre;
            g.stroke();
            g.fillStyle = pal.neige;
            g.beginPath();
            g.ellipse(rx + 14, SOL - 21, 9, 4, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      // Luge et lutin
      const ly = SOL + y;
      const pente = Math.max(-0.35, Math.min(0.35, vy / 1600));
      g.save();
      g.translate(LX, ly);
      g.rotate(pente);
      lutin(g, pal, -2, -30, 26, pal.accent);
      boite(g, pal, -22, -14, 42, 10, pal.accent, { r: 4, ombre: 2, trait: 2 });
      g.strokeStyle = pal.accent2;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-22, -1);
      g.lineTo(18, -1);
      g.quadraticCurveTo(28, -1, 26, -10);
      g.stroke();
      g.restore();
      fx.dessiner(g, pal);
      g.restore();
      bandeau(g, pal, L, `${jeu.score} pts`, `${Math.round(vitesse / 10)} km/h · ★ ${etoiles}`);
      if (messageT > 0) {
        g.font = `800 17px "Archivo", system-ui, sans-serif`;
        const w = (g.measureText?.(message)?.width ?? 160) + 32;
        boite(g, pal, L / 2 - w / 2, 160, w, 36, pal.encre, { r: 18, ombre: 3, trait: 0 });
        texte(g, pal, message, L / 2, 178, { taille: 17, couleur: pal.creme });
      }
      fx.voile(g, L, H);
    },
    saisie(e: Saisie) {
      const touche = e.type === "keydown" && (e.key === " " || e.key === "ArrowUp" || e.key === "z" || e.key === "w");
      const lache = e.type === "keyup" && (e.key === " " || e.key === "ArrowUp" || e.key === "z" || e.key === "w");
      if (e.type === "down" || touche) {
        appui = true;
        sauter();
      } else if (e.type === "up" || lache) appui = false;
    },
  };
  return jeu;
};
