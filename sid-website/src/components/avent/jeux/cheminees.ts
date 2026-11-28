import { assombrir, bandeau, boite, cadeau, ciel, eclaircir, Effets, flocons, rond, teinte, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Livraison par la cheminée : 60 secondes. Le traîneau survole les toits,
 * qui défilent de plus en plus vite. Toucher (ou espace) lâche un cadeau :
 * dans une cheminée, 50 points + 10 par livraison réussie d'affilée (série
 * de 10 au plus). Une cheminée qui fume a le feu allumé : −30 et la série
 * repart de zéro. Un cadeau sur un toit casse aussi la série.
 */
const L = 360;
const H = 540;
const SOL = H - 30;
const DUREE = 60;
const TX = 96; // position du traîneau
const TY = 108;

type Maison = { x: number; w: number; h: number; cx: number; cw: number; feu: boolean; livree: boolean; couleur: string; fenetres: boolean[] };
type Paquet = { x: number; y: number; vy: number; rot: number; couleur: string; ruban: string };

export const cheminees: CreerJeu = ({ pal, rng }) => {
  const fx = new Effets(rng);
  const etoiles = flocons(30, L, 200, rng);
  const neige = flocons(26, L, H, rng);
  const murs = ["rgb(196, 128, 74)", "rgb(176, 96, 70)", "rgb(214, 170, 120)", "rgb(150, 110, 150)"];
  const maisons: Maison[] = [];
  const paquets: Paquet[] = [];
  let temps = 0;
  let reste = DUREE;
  let score = 0;
  let serie = 0;
  let recharge = 0;
  let decor = 0;
  let message = "Touche pour lâcher un cadeau";
  let messageT = 2.2;

  const vitesse = () => 115 + (DUREE - reste) * 2.3;
  const toitY = (m: Maison, x: number) => {
    const haut = SOL - m.h;
    const centre = m.x + m.w / 2;
    return haut - 42 * Math.max(0, 1 - Math.abs(x - centre) / (m.w / 2 + 8));
  };
  function ajouter(x: number) {
    const w = 96 + rng() * 60;
    const cw = Math.max(20, 34 - (DUREE - reste) * 0.2) + rng() * 6;
    const m: Maison = {
      x,
      w,
      h: 80 + rng() * 110,
      cx: w * (0.2 + rng() * 0.6),
      cw,
      feu: DUREE - reste > 8 && rng() < 0.24,
      livree: false,
      couleur: murs[Math.floor(rng() * murs.length)],
      fenetres: Array.from({ length: 6 }, () => rng() < 0.6),
    };
    maisons.push(m);
  }
  let x0 = 200;
  while (x0 < L + 200) {
    ajouter(x0);
    x0 += maisons[maisons.length - 1].w + 40 + rng() * 70;
  }

  function lacher() {
    if (jeu.fini || recharge > 0 || paquets.length >= 2) return;
    recharge = 0.32;
    const c = [pal.accent, pal.sapin, pal.accent2, pal.creme2][Math.floor(rng() * 4)];
    paquets.push({ x: TX + 4, y: TY + 16, vy: 60, rot: 0, couleur: c, ruban: c === pal.accent2 ? pal.accent : pal.accent2 });
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
      for (const f of neige) {
        f.y += f.v * dt;
        f.x -= vitesse() * 0.3 * dt;
        if (f.y > H) f.y = -4;
        if (f.x < 0) f.x += L;
      }
      if (jeu.fini) return;
      reste -= dt;
      if (reste <= 0) {
        reste = 0;
        jeu.fini = true;
        message = "Tournée finie !";
        messageT = 99;
        return;
      }
      recharge = Math.max(0, recharge - dt);
      const v = vitesse();
      decor += v * dt;
      for (const m of maisons) m.x -= v * dt;
      while (maisons.length && maisons[0].x + maisons[0].w < -20) maisons.shift();
      const der = maisons[maisons.length - 1];
      if (der.x + der.w < L + 60) ajouter(der.x + der.w + 36 + rng() * 80);

      for (const p of [...paquets]) {
        p.vy += 900 * dt;
        p.y += p.vy * dt;
        p.rot += dt * 4;
        const m = maisons.find((k) => p.x > k.x - 6 && p.x < k.x + k.w + 6);
        if (!m) {
          if (p.y > SOL - 6) {
            paquets.splice(paquets.indexOf(p), 1);
            serie = 0;
            fx.gerbe(p.x, SOL - 4, [pal.neige], 10, 120, { gravite: 300, forme: "rond", taille: 2.5 });
          }
          continue;
        }
        const chx = m.x + m.cx;
        const haut = toitY(m, chx) - 26;
        if (Math.abs(p.x - chx) < m.cw / 2 - 3 && p.y >= haut && p.y < haut + 14 && !m.livree) {
          paquets.splice(paquets.indexOf(p), 1);
          m.livree = true;
          if (m.feu) {
            score = Math.max(0, score - 30);
            serie = 0;
            fx.gerbe(chx, haut, [pal.accent, pal.accent2, "rgb(120,120,120)"], 16, 160, { gravite: -60 });
            fx.flotte(chx, haut - 20, "−30, du feu !", pal.accent, 15);
            fx.secouer(5);
          } else {
            const gain = 50 + 10 * Math.min(serie, 10);
            serie++;
            score += gain;
            fx.gerbe(chx, haut, [pal.accent2, pal.neige, pal.accent], 18, 180, { forme: "etoile", gravite: 120, taille: 3 });
            fx.flotte(chx, haut - 22, `+${gain}`, pal.accent2, 16 + Math.min(serie, 6));
          }
          continue;
        }
        if (p.y >= toitY(m, p.x) - 6) {
          paquets.splice(paquets.indexOf(p), 1);
          serie = 0;
          fx.gerbe(p.x, toitY(m, p.x), [pal.neige, p.couleur], 10, 120, { gravite: 300 });
        }
      }
      jeu.score = score;
    },
    dessiner(g: CanvasRenderingContext2D) {
      ciel(g, pal, L, H, etoiles, temps);
      rond(g, pal, 300, 70, 20, pal.neige, { ombre: 0, trait: 0 });
      g.fillStyle = teinte(pal.fond, 1);
      // Collines lointaines (parallaxe)
      g.fillStyle = assombrir(pal.fond, 0.2);
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= L; x += 10) g.lineTo(x, SOL - 150 - Math.sin((x + decor * 0.15) / 70) * 20 - Math.sin((x + decor * 0.15) / 23) * 6);
      g.lineTo(L, H);
      g.fill();
      g.save();
      fx.decaler(g);
      // Maisons
      for (const m of maisons) {
        const haut = SOL - m.h;
        boite(g, pal, m.x, haut, m.w, m.h + 10, m.couleur, { r: 2, ombre: 3 });
        // Fenêtres éclairées
        m.fenetres.forEach((on, i) => {
          const fx0 = m.x + 14 + (i % 3) * ((m.w - 40) / 2);
          const fy0 = haut + 18 + Math.floor(i / 3) * 34;
          if (fy0 + 20 > SOL) return;
          boite(g, pal, fx0, fy0, 14, 18, on ? pal.accent2 : assombrir(m.couleur, 0.35), { r: 2, ombre: 0, trait: 2 });
        });
        // Toit
        g.fillStyle = assombrir(pal.accentCarte, 0.1);
        g.beginPath();
        g.moveTo(m.x - 8, haut + 2);
        g.lineTo(m.x + m.w / 2, haut - 42);
        g.lineTo(m.x + m.w + 8, haut + 2);
        g.closePath();
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = pal.encre;
        g.stroke();
        g.fillStyle = pal.neige;
        g.beginPath();
        g.moveTo(m.x - 8, haut + 2);
        g.lineTo(m.x + m.w / 2, haut - 42);
        g.lineTo(m.x + m.w + 8, haut + 2);
        g.lineTo(m.x + m.w + 2, haut + 2);
        g.lineTo(m.x + m.w / 2, haut - 34);
        g.lineTo(m.x - 2, haut + 2);
        g.closePath();
        g.fill();
        // Cheminée
        const chx = m.x + m.cx;
        const top = toitY(m, chx) - 26;
        boite(g, pal, chx - m.cw / 2, top, m.cw, toitY(m, chx) - top + 10, "rgb(170, 70, 56)", { r: 2, ombre: 2, trait: 2.5 });
        boite(g, pal, chx - m.cw / 2 - 4, top - 4, m.cw + 8, 8, m.livree && !m.feu ? pal.accent2 : pal.neige, { r: 2, ombre: 0, trait: 2 });
        g.fillStyle = pal.encre;
        g.fillRect(chx - m.cw / 2 + 4, top - 1, m.cw - 8, 3);
        if (m.feu) {
          for (let k = 0; k < 3; k++) {
            const a = (temps * 1.5 + k / 3) % 1;
            g.fillStyle = `rgba(200, 200, 210, ${0.6 * (1 - a)})`;
            g.beginPath();
            g.arc(chx + Math.sin(a * 6 + k) * 6, top - 8 - a * 40, 6 + a * 10, 0, Math.PI * 2);
            g.fill();
          }
          g.fillStyle = teinte(pal.accent, 0.8);
          g.beginPath();
          g.arc(chx, top - 2, 5 + Math.sin(temps * 20) * 1.5, Math.PI, 0);
          g.fill();
        }
      }
      // Sol
      g.fillStyle = pal.neige;
      g.fillRect(0, SOL, L, H - SOL);
      g.strokeStyle = pal.encre;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, SOL);
      g.lineTo(L, SOL);
      g.stroke();
      for (const f of neige) {
        g.fillStyle = "rgba(255,255,255,0.6)";
        g.beginPath();
        g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        g.fill();
      }
      // Cadeaux en chute
      for (const p of paquets) {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(Math.sin(p.rot) * 0.3);
        cadeau(g, pal, -8, -8, 16, 16, p.couleur, p.ruban, 2, true);
        g.restore();
      }
      // Traîneau, Père Noël et deux rennes
      const by = TY + Math.sin(temps * 3) * 4;
      for (let k = 0; k < 2; k++) {
        const rx = TX + 70 + k * 34;
        const ry = by - 4 + Math.sin(temps * 6 + k) * 3;
        rond(g, pal, rx, ry, 10, "rgb(150, 98, 60)", { ombre: 2, trait: 2 });
        rond(g, pal, rx + 10, ry - 8, 6, "rgb(150, 98, 60)", { ombre: 0, trait: 2 });
        rond(g, pal, rx + 15, ry - 7, 2.4, k === 1 ? pal.accent : pal.encre, { ombre: 0, trait: 0 });
        g.strokeStyle = "rgb(110, 72, 44)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(rx + 8, ry - 13);
        g.lineTo(rx + 5, ry - 21);
        g.moveTo(rx + 12, ry - 13);
        g.lineTo(rx + 15, ry - 21);
        g.stroke();
      }
      g.strokeStyle = "rgb(110, 72, 44)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(TX + 22, by);
      g.lineTo(TX + 62, by - 2);
      g.stroke();
      rond(g, pal, TX + 2, by - 16, 8, "rgb(255, 214, 178)", { ombre: 0, trait: 2 });
      g.fillStyle = pal.accent;
      g.beginPath();
      g.moveTo(TX - 7, by - 20);
      g.lineTo(TX + 9, by - 20);
      g.lineTo(TX + 8, by - 32);
      g.closePath();
      g.fill();
      g.strokeStyle = pal.encre;
      g.lineWidth = 1.5;
      g.stroke();
      rond(g, pal, TX + 8, by - 32, 2.5, pal.neige, { ombre: 0, trait: 1 });
      g.fillStyle = pal.neige;
      g.beginPath();
      g.arc(TX + 2, by - 12, 5.5, 0, Math.PI);
      g.fill();
      boite(g, pal, TX - 22, by - 8, 46, 18, pal.accent, { r: 7, ombre: 3, trait: 2.5 });
      g.fillStyle = eclaircir(pal.accent, 0.3);
      g.fillRect(TX - 18, by - 5, 38, 3);
      g.strokeStyle = pal.accent2;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(TX - 22, by + 16);
      g.lineTo(TX + 20, by + 16);
      g.quadraticCurveTo(TX + 32, by + 16, TX + 28, by + 6);
      g.stroke();
      // Cadeaux prêts dans le traîneau
      if (recharge <= 0 && paquets.length < 2) cadeau(g, pal, TX - 16, by - 20, 12, 12, pal.sapin, pal.accent2, 0);
      fx.dessiner(g, pal);
      g.restore();
      bandeau(g, pal, L, `${score} pts${serie > 1 ? ` · série ${serie}` : ""}`, `${Math.ceil(reste)} s`);
      if (messageT > 0) {
        g.font = `800 16px "Archivo", system-ui, sans-serif`;
        const w = (g.measureText?.(message)?.width ?? 200) + 30;
        boite(g, pal, L / 2 - w / 2, 220, w, 34, pal.encre, { r: 17, ombre: 3, trait: 0 });
        texte(g, pal, message, L / 2, 237, { taille: 16, couleur: pal.creme });
      }
      fx.voile(g, L, H);
    },
    saisie(e: Saisie) {
      if (e.type === "down" || (e.type === "keydown" && (e.key === " " || e.key === "ArrowDown" || e.key === "Enter"))) lacher();
    },
  };
  return jeu;
};
