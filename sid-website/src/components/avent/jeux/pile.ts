import { bandeau, cadeau, boite, texte, type CreerJeu, type Saisie } from "./moteur";

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
      messageT = 0.7;
    } else {
      const g0 = Math.max(mobile.x, haut.x);
      const d0 = Math.min(mobile.x + mobile.w, haut.x + haut.w);
      const w = d0 - g0;
      const y = yDe(pileB.length);
      if (w <= 0) {
        chutes.push({ x: mobile.x, y, w: mobile.w, vy: 0, couleur: mobile.couleur, ruban: mobile.ruban, rot: 0 });
        jeu.fini = true;
        message = "La pile est finie";
        messageT = 99;
        return;
      }
      const reste = dx > 0 ? { x: d0, w: mobile.x + mobile.w - d0 } : { x: mobile.x, w: g0 - mobile.x };
      chutes.push({ ...reste, y, vy: 0, couleur: mobile.couleur, ruban: mobile.ruban, rot: 0 });
      pileB.push({ x: g0, w, couleur: mobile.couleur, ruban: mobile.ruban });
      score += 10;
    }
    nouveau();
  }

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
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
      g.fillStyle = pal.fond;
      g.fillRect(0, 0, L, H);
      g.save();
      g.translate(0, camera);
      boite(g, pal, 20, SOL, L - 40, 60, pal.neige, { r: 10, ombre: 4 });
      pileB.forEach((b, i) => {
        if (i === 0) boite(g, pal, b.x, yDe(0), b.w, HP, pal.creme, { r: 4, ombre: 3 });
        else cadeau(g, pal, b.x, yDe(i), b.w, HP, b.couleur, b.ruban, 3);
      });
      for (const c of chutes) {
        g.save();
        g.translate(c.x + c.w / 2, c.y + HP / 2);
        g.rotate(c.rot * (c.x < L / 2 ? -1 : 1));
        cadeau(g, pal, -c.w / 2, -HP / 2, c.w, HP, c.couleur, c.ruban, 3);
        g.restore();
      }
      if (!jeu.fini) cadeau(g, pal, mobile.x, yDe(pileB.length), mobile.w, HP, mobile.couleur, mobile.ruban, 3);
      g.restore();
      bandeau(g, pal, L, `${score} pts`, `${pileB.length - 1} paquets · ${parfaits} parfaits`);
      if (messageT > 0) texte(g, pal, message, L / 2, 110, { taille: 22, couleur: pal.creme, contour: true });
    },
    saisie(e: Saisie) {
      if (jeu.fini) return;
      if (e.type === "down" || (e.type === "keydown" && (e.key === " " || e.key === "Enter"))) lacher();
    },
  };
  return jeu;
};
