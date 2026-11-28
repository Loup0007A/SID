import { bandeau, borne, boite, rond, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Baby-foot des lutins : terrain vertical, tu défends le but du bas et
 * tu tires vers le haut. Les trois barres se déplacent ensemble (doigt,
 * souris ou flèches). 90 secondes.
 */
const L = 360;
const H = 540;
const HAUT = 44; // sous le bandeau
const BAS = H - 8;
const BUT = 128;
const DUREE = 90;

type Barre = { y: number; n: number; ecart: number; joueur: boolean; ox: number; vx: number };

export const babyfoot: CreerJeu = ({ pal, rng }) => {
  const barres: Barre[] = [
    { y: BAS - 46, n: 1, ecart: 0, joueur: true, ox: 0, vx: 0 },
    { y: BAS - 130, n: 2, ecart: 120, joueur: true, ox: 0, vx: 0 },
    { y: HAUT + 210, n: 3, ecart: 96, joueur: true, ox: 0, vx: 0 },
    { y: HAUT + 40, n: 1, ecart: 0, joueur: false, ox: 0, vx: 0 },
    { y: HAUT + 124, n: 2, ecart: 120, joueur: false, ox: 0, vx: 0 },
    { y: BAS - 216, n: 3, ecart: 96, joueur: false, ox: 0, vx: 0 },
  ];
  const balle = { x: L / 2, y: (HAUT + BAS) / 2, vx: 0, vy: 0, r: 8 };
  let cible = 0; // décalage voulu pour mes barres
  let gauche = false;
  let droite = false;
  let reste = DUREE;
  let pause = 1.2;
  let marques = 0;
  let encaisses = 0;
  let message = "C'est parti !";
  let erreurIA = 0;
  let messageT = 1.2;
  const OX = 70; // débattement des barres

  function engagement(versMoi: boolean) {
    balle.x = L / 2 + (rng() - 0.5) * 40;
    balle.y = (HAUT + BAS) / 2;
    balle.vx = (rng() - 0.5) * 160;
    balle.vy = versMoi ? 170 : -170;
    pause = 0.9;
  }
  engagement(rng() < 0.5);

  const figures = (b: Barre) =>
    Array.from({ length: b.n }, (_, i) => ({ x: L / 2 + b.ox + (i - (b.n - 1) / 2) * b.ecart, y: b.y }));

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      if (jeu.fini) return;
      reste -= dt;
      messageT -= dt;
      if (reste <= 0) {
        reste = 0;
        jeu.fini = true;
        return;
      }
      if (gauche) cible -= 260 * dt;
      if (droite) cible += 260 * dt;
      cible = borne(cible, -OX, OX);
      for (const b of barres) {
        const avant = b.ox;
        if (b.joueur) {
          b.ox += borne(cible - b.ox, -520 * dt, 520 * dt);
        } else if (balle.vy < 0) {
          // Les lutins visent la balle quand elle monte vers leur but, avec
          // une erreur tirée à chaque tir et une vitesse limitée.
          const fig = figures({ ...b, ox: 0 });
          const vise = balle.x + erreurIA;
          const plusProche = fig.reduce((m, f) => (Math.abs(f.x - vise) < Math.abs(m.x - vise) ? f : m), fig[0]);
          const voulu = borne(vise - plusProche.x, -OX, OX);
          const vit = 120 + Math.min(90, (DUREE - reste) * 1);
          b.ox += borne(voulu - b.ox, -vit * dt, vit * dt);
        } else {
          b.ox += borne(-b.ox, -50 * dt, 50 * dt);
        }
        b.vx = (b.ox - avant) / Math.max(dt, 1e-3);
      }
      if (pause > 0) {
        pause -= dt;
        return;
      }
      // Sous-pas pour éviter que la balle traverse une figure.
      const pas = 4;
      for (let s = 0; s < pas; s++) {
        const d = dt / pas;
        balle.x += balle.vx * d;
        balle.y += balle.vy * d;
        if (balle.x < 14 + balle.r) {
          balle.x = 14 + balle.r;
          balle.vx = Math.abs(balle.vx) * 0.92;
        }
        if (balle.x > L - 14 - balle.r) {
          balle.x = L - 14 - balle.r;
          balle.vx = -Math.abs(balle.vx) * 0.92;
        }
        const dansBut = Math.abs(balle.x - L / 2) < BUT / 2 - balle.r / 2;
        if (balle.y < HAUT + balle.r) {
          if (dansBut) {
            marques++;
            message = "But !";
            messageT = 1;
            engagement(false);
            break;
          }
          balle.y = HAUT + balle.r;
          balle.vy = Math.abs(balle.vy) * 0.9;
        }
        if (balle.y > BAS - balle.r) {
          if (dansBut) {
            encaisses++;
            message = "But des lutins";
            messageT = 1;
            engagement(true);
            break;
          }
          balle.y = BAS - balle.r;
          balle.vy = -Math.abs(balle.vy) * 0.9;
        }
        for (const b of barres) {
          for (const f of figures(b)) {
            const dx = balle.x - f.x;
            const dy = balle.y - f.y;
            if (Math.abs(dx) < 13 + balle.r && Math.abs(dy) < 8 + balle.r) {
              const sens = b.joueur ? -1 : 1;
              // On ne tape que si la balle arrive du bon côté ou traîne au contact.
              const force = b.joueur ? 430 + rng() * 60 : 330 + rng() * 60 + Math.min(80, (DUREE - reste) * 0.8);
              balle.vy = sens * force;
              balle.vx = borne(dx * 14 + b.vx * 0.35 + (rng() - 0.5) * (b.joueur ? 40 : 160), -330, 330);
              if (b.joueur) erreurIA = (rng() - 0.5) * 2 * Math.max(22, 48 - (DUREE - reste) * 0.25);
              balle.y = f.y + sens * (8 + balle.r + 1);
            }
          }
        }
      }
      // Frottement léger, sans laisser la balle s'arrêter.
      balle.vx *= 1 - 0.12 * dt;
      balle.vy *= 1 - 0.12 * dt;
      const v = Math.hypot(balle.vx, balle.vy);
      if (v < 120) {
        const k = 120 / Math.max(v, 1);
        balle.vx *= k;
        balle.vy = (balle.vy || (rng() < 0.5 ? 1 : -1)) * k;
      }
      jeu.score = Math.max(0, marques * 100 - encaisses * 40);
    },
    dessiner(g: CanvasRenderingContext2D) {
      g.fillStyle = pal.fond;
      g.fillRect(0, 0, L, H);
      // Terrain
      boite(g, pal, 8, HAUT - 4, L - 16, BAS - HAUT + 8, pal.sapin, { r: 14, ombre: 4 });
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(14, (HAUT + BAS) / 2);
      g.lineTo(L - 14, (HAUT + BAS) / 2);
      g.stroke();
      g.beginPath();
      g.arc(L / 2, (HAUT + BAS) / 2, 46, 0, Math.PI * 2);
      g.stroke();
      // Buts
      boite(g, pal, L / 2 - BUT / 2, HAUT - 10, BUT, 12, pal.creme, { r: 3, ombre: 0 });
      boite(g, pal, L / 2 - BUT / 2, BAS - 2, BUT, 12, pal.creme, { r: 3, ombre: 0 });
      // Barres et figures
      for (const b of barres) {
        g.fillStyle = "rgba(255,255,255,0.35)";
        g.fillRect(14, b.y - 2, L - 28, 4);
        for (const f of figures(b)) {
          boite(g, pal, f.x - 13, f.y - 8, 26, 16, b.joueur ? pal.accent : pal.creme2, { r: 5, ombre: 2, trait: 2.5 });
          rond(g, pal, f.x, f.y, 5, b.joueur ? pal.accent2 : pal.sapin, { ombre: 0, trait: 1.5 });
        }
      }
      rond(g, pal, balle.x, balle.y, balle.r, pal.neige, { ombre: 2, trait: 2.5 });
      bandeau(g, pal, L, `Toi ${marques} – ${encaisses} Lutins`, `${Math.ceil(reste)} s`);
      if (messageT > 0) texte(g, pal, message, L / 2, (HAUT + BAS) / 2 - 70, { taille: 30, couleur: pal.creme, contour: true });
    },
    saisie(e: Saisie) {
      if (e.type === "down" || e.type === "move") {
        cible = borne(e.x - L / 2, -OX, OX);
      } else if (e.type === "keydown" || e.type === "keyup") {
        const on = e.type === "keydown";
        if (e.key === "ArrowLeft" || e.key === "q" || e.key === "a") gauche = on;
        if (e.key === "ArrowRight" || e.key === "d") droite = on;
      }
    },
  };
  return jeu;
};
