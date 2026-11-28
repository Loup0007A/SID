import { assombrir, bandeau, cadeau, boite, Effets, etoile, flocons, melange, rond, teinte, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Pile de cadeaux : un paquet glisse de gauche à droite ; toucher le lâche
 * sur la pile. La partie qui dépasse tombe. Dépôt parfait (à 4 px près) :
 * +5 et le paquet reprend un peu de largeur. 10 points par paquet posé.
 */
const L = 360;
const H = 540;
const HP = 26; // hauteur d'un paquet
const SOL = H - 40;

type Bloc = { x: number; w: number; couleur: string; ruban: string };
type Chute = { x: number; y: number; w: number; vy: number; couleur: string; ruban: string; rot: number };

export const pile: CreerJeu = ({ pal, rng }) => {
  const couleurs = [pal.accent, pal.sapin, pal.accent2, pal.creme2, pal.accentCarte];
  const pileB: Bloc[] = [{ x: L / 2 - 100, w: 200, couleur: pal.creme, ruban: pal.accent }];
  let mobile: Bloc & { v: number } = { x: 0, w: 200, couleur: couleurs[0], ruban: pal.accent2, v: 170 };
  let chutes: Chute[] = [];
  let score = 0;
  let parfaits = 0;
  let camera = 0;
  let message = "Touche pour lâcher";
  let messageT = 2;
  const fx = new Effets(rng);
  const etoiles = flocons(60, L, 2400, rng);
  let temps = 0;
  let anneau = 0;

  const yDe = (i: number) => SOL - (i + 1) * HP;

  function nouveau() {
    const n = pileB.length;
    const haut = pileB[n - 1];
    const v = Math.min(420, 170 + n * 9) * (rng() < 0.5 ? 1 : -1);
    mobile = { x: v > 0 ? -haut.w : L, w: haut.w, couleur: couleurs[n % couleurs.length], ruban: n % 2 ? pal.accent2 : pal.accent, v };
  }
  nouveau();

  function lacher() {
    const haut = pileB[pileB.length - 1];
    const dx = mobile.x - haut.x;
    if (Math.abs(dx) <= 4) {
      mobile.x = haut.x;
      score += 15;
      parfaits++;
      const w = Math.min(200, haut.w + 6);
      pileB.push({ x: haut.x - (w - haut.w) / 2, w, couleur: mobile.couleur, ruban: mobile.ruban });
      message = "Parfait !";
      anneau = 0.5;
      fx.gerbe(L / 2, yDe(pileB.length - 1), [pal.accent2, pal.neige], 18, 200, { forme: "etoile", taille: 3.5, gravite: 200 });
      fx.flotte(haut.x + haut.w / 2, yDe(pileB.length - 1) - 10, "+15", pal.accent2, 20);
      messageT = 0.7;
    } else {
      const g0 = Math.max(mobile.x, haut.x);
      const d0 = Math.min(mobile.x + mobile.w, haut.x + haut.w);
      const w = d0 - g0;
      const y = yDe(pileB.length);
      if (w <= 0) {
        chutes.push({ x: mobile.x, y, w: mobile.w, vy: 0, couleur: mobile.couleur, ruban: mobile.ruban, rot: 0 });
        jeu.fini = true;
        fx.secouer(10);
        message = "La pile est finie";
        messageT = 99;
        return;
      }
      const reste = dx > 0 ? { x: d0, w: mobile.x + mobile.w - d0 } : { x: mobile.x, w: g0 - mobile.x };
      chutes.push({ ...reste, y, vy: 0, couleur: mobile.couleur, ruban: mobile.ruban, rot: 0 });
      pileB.push({ x: g0, w, couleur: mobile.couleur, ruban: mobile.ruban });
      score += 10;
      fx.gerbe(g0 + w / 2, y + HP, [pal.neige], 6, 90, { gravite: 300, forme: "rond", taille: 2.5, vie: 0.4 });
      fx.secouer(2);
    }
    nouveau();
  }

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      fx.maj(dt);
      temps += dt;
      anneau = Math.max(0, anneau - dt);
      messageT -= dt;
      for (const c of chutes) {
        c.vy += 900 * dt;
        c.y += c.vy * dt;
        c.rot += dt * 2;
      }
      chutes = chutes.filter((c) => c.y < H + 200 + camera);
      // La caméra monte avec la pile.
      const voulu = Math.max(0, (pileB.length - 9) * HP);
      camera += (voulu - camera) * Math.min(1, dt * 4);
      if (jeu.fini) return;
      mobile.x += mobile.v * dt;
      if (mobile.x < -mobile.w * 0.6) {
        mobile.x = -mobile.w * 0.6;
        mobile.v = Math.abs(mobile.v);
      }
      if (mobile.x > L - mobile.w * 0.4) {
        mobile.x = L - mobile.w * 0.4;
        mobile.v = -Math.abs(mobile.v);
      }
      jeu.score = score;
    },
    dessiner(g: CanvasRenderingContext2D) {
      // Le ciel s'assombrit et se remplit d'étoiles à mesure que la pile monte.
      const hauteur = Math.min(1, camera / 1400);
      const d = g.createLinearGradient(0, 0, 0, H);
      d.addColorStop(0, melange(pal.fond, "rgb(8, 10, 30)", 0.2 + hauteur * 0.7));
      d.addColorStop(1, melange(pal.fond, "rgb(8, 10, 30)", hauteur * 0.5));
      g.fillStyle = d;
      g.fillRect(0, 0, L, H);
      for (const [i, e] of etoiles.entries()) {
        const y = ((e.y + camera * 0.3) % 2400) - 1800 + H;
        if (y < -4 || y > H) continue;
        g.globalAlpha = (0.3 + 0.5 * hauteur) * (0.6 + 0.4 * Math.sin(temps * 2 + i));
        g.fillStyle = "rgb(255, 250, 220)";
        g.beginPath();
        g.arc(e.x, y, e.r * 0.7, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      if (hauteur > 0.3) {
        g.globalAlpha = Math.min(1, (hauteur - 0.3) * 2);
        rond(g, pal, 290, 90, 22, pal.neige, { ombre: 0, trait: 2 });
        g.globalAlpha = 1;
      }
      g.save();
      g.translate(0, camera);
      fx.decaler(g);
      // Toit enneigé et cheminée
      g.fillStyle = assombrir(pal.accentCarte, 0.15);
      g.beginPath();
      g.moveTo(-10, H + 40);
      g.lineTo(L / 2, SOL - 6);
      g.lineTo(L + 10, H + 40);
      g.closePath();
      g.fill();
      g.strokeStyle = pal.encre;
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = teinte(pal.encre, 0.25);
      g.lineWidth = 1.5;
      for (let k = 1; k < 4; k++) {
        g.beginPath();
        g.moveTo(L / 2 - k * 60, SOL - 6 + k * 26);
        g.lineTo(L / 2 + k * 60, SOL - 6 + k * 26);
        g.stroke();
      }
      boite(g, pal, L / 2 - 110, SOL, 220, 16, pal.neige, { r: 8, ombre: 3 });
      // Paquets posés
      pileB.forEach((bl, i) => {
        if (i === 0) {
          boite(g, pal, bl.x, yDe(0), bl.w, HP, "rgb(176, 90, 60)", { r: 3, ombre: 3 });
          g.strokeStyle = teinte(pal.encre, 0.35);
          g.lineWidth = 1;
          for (let k = 1; k < 3; k++) {
            g.beginPath();
            g.moveTo(bl.x, yDe(0) + (HP / 3) * k);
            g.lineTo(bl.x + bl.w, yDe(0) + (HP / 3) * k);
            g.stroke();
          }
        } else cadeau(g, pal, bl.x, yDe(i), bl.w, HP, bl.couleur, bl.ruban, 3, i === pileB.length - 1 && jeu.fini);
      });
      // Anneau du dépôt parfait
      if (anneau > 0) {
        const h = pileB[pileB.length - 1];
        g.strokeStyle = teinte(pal.accent2, anneau * 2);
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(h.x - (0.5 - anneau) * 40, yDe(pileB.length - 1) - (0.5 - anneau) * 20, h.w + (0.5 - anneau) * 80, HP + (0.5 - anneau) * 40, 8);
        g.stroke();
      }
      for (const c of chutes) {
        g.save();
        g.translate(c.x + c.w / 2, c.y + HP / 2);
        g.rotate(c.rot * (c.x < L / 2 ? -1 : 1));
        cadeau(g, pal, -c.w / 2, -HP / 2, c.w, HP, c.couleur, c.ruban, 3);
        g.restore();
      }
      if (!jeu.fini) {
        const y = yDe(pileB.length);
        // Repère de chute
        const h = pileB[pileB.length - 1];
        const g0 = Math.max(mobile.x, h.x);
        const d0 = Math.min(mobile.x + mobile.w, h.x + h.w);
        if (d0 > g0) {
          g.fillStyle = teinte(pal.neige, 0.25);
          g.fillRect(g0, y + HP - 2, d0 - g0, 4);
        }
        cadeau(g, pal, mobile.x, y, mobile.w, HP, mobile.couleur, mobile.ruban, 3, true);
        etoile(g, mobile.x + mobile.w - 8, y + 6, 4, 1.8, teinte(pal.neige, 0.5 + 0.5 * Math.sin(temps * 6)), null, temps);
      }
      fx.dessiner(g, pal);
      g.restore();
      bandeau(g, pal, L, `${score} pts`, `${pileB.length - 1} paquets · ${parfaits} parfaits`);
      if (messageT > 0) texte(g, pal, message, L / 2, 110, { taille: 22 + Math.max(0, Math.min(messageT, 0.7) - 0.5) * 30, couleur: message === "Parfait !" ? pal.accent2 : pal.creme, contour: true });
      fx.voile(g, L, H);
    },
    saisie(e: Saisie) {
      if (jeu.fini) return;
      if (e.type === "down" || (e.type === "keydown" && (e.key === " " || e.key === "Enter"))) lacher();
    },
  };
  return jeu;
};
