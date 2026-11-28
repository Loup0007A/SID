import { assombrir, bandeau, bille, borne, boite, ciel, eclaircir, Effets, flocons, rond, teinte, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Baby-foot des lutins : terrain vertical, tu défends le but du bas et
 * tu tires vers le haut. Chacune de tes trois barres bouge seule :
 * - doigt : pose le doigt près d'une barre et glisse (un doigt par barre,
 *   plusieurs à la fois si tu veux) ;
 * - souris : la barre la plus proche du pointeur le suit ;
 * - clavier : ↑ ↓ (ou 1, 2, 3) choisissent la barre, ← → la déplacent.
 * 90 secondes.
 */
const L = 360;
const H = 540;
const HAUT = 60; // sous le bandeau et le but du haut
const BAS = H - 24;
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
  // Décalage voulu pour chacune de mes barres (0 gardien, 1 défense, 2 attaque).
  const cibles = [0, 0, 0];
  let choisie = 2; // barre pilotée au clavier
  const doigts = new Map<number, { barre: number; x0: number; ox0: number }>();
  const barreProche = (y: number) => [0, 1, 2].reduce((m, i) => (Math.abs(barres[i].y - y) < Math.abs(barres[m].y - y) ? i : m), 0);
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
  const fx = new Effets(rng);
  const etoiles = flocons(30, L, H, rng);
  let temps = 0;
  const coups = new Map<number, number>(); // barre → temps restant du geste de frappe

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
      fx.maj(dt);
      temps += dt;
      for (const [k, v] of coups) coups.set(k, Math.max(0, v - dt));
      if (jeu.fini) return;
      reste -= dt;
      messageT -= dt;
      if (reste <= 0) {
        reste = 0;
        jeu.fini = true;
        return;
      }
      if (gauche) cibles[choisie] -= 300 * dt;
      if (droite) cibles[choisie] += 300 * dt;
      for (let i = 0; i < 3; i++) cibles[i] = borne(cibles[i], -OX, OX);
      for (const b of barres) {
        const avant = b.ox;
        if (b.joueur) {
          const i = barres.indexOf(b);
          b.ox += borne(cibles[i] - b.ox, -620 * dt, 620 * dt);
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
            fx.gerbe(balle.x, HAUT + 4, [pal.accent, pal.accent2, pal.neige, pal.sapin], 34, 260, { gravite: 380 });
            fx.flotte(L / 2, HAUT + 60, "+100", pal.accent2, 24);
            fx.secouer(9);
            fx.flash(pal.accent2, 0.3);
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
            fx.gerbe(balle.x, BAS - 4, [pal.neige, pal.creme2], 18, 160);
            fx.secouer(5);
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
              coups.set(barres.indexOf(b), 0.18);
              fx.gerbe(balle.x, balle.y, [pal.neige], 5, 90, { gravite: 0, forme: "rond", taille: 2, vie: 0.3 });
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
      if (pause <= 0) fx.trace(balle.x, balle.y, teinte(pal.neige, 0.5), balle.r * 0.8, 0.18);
    },
    dessiner(g: CanvasRenderingContext2D) {
      ciel(g, pal, L, H, etoiles, temps);
      g.save();
      fx.decaler(g);
      const bois = "rgb(150, 96, 58)";
      // Cadre en bois
      boite(g, pal, 4, HAUT - 10, L - 8, BAS - HAUT + 20, bois, { r: 16, ombre: 5 });
      g.strokeStyle = teinte(assombrir(bois, 0.4), 0.35);
      g.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(8, HAUT - 6 + i * 3);
        g.bezierCurveTo(L * 0.3, HAUT - 8 + i * 3, L * 0.6, HAUT - 2 + i * 2, L - 8, HAUT - 6 + i * 3);
        g.stroke();
      }
      // Pelouse rayée
      const X0 = 14;
      const W = L - 28;
      g.save();
      g.beginPath();
      g.roundRect(X0, HAUT - 2, W, BAS - HAUT + 4, 10);
      g.clip();
      const bandes = 10;
      for (let i = 0; i < bandes; i++) {
        g.fillStyle = i % 2 ? pal.sapin : eclaircir(pal.sapin, 0.12);
        g.fillRect(X0, HAUT - 2 + ((BAS - HAUT + 4) / bandes) * i, W, (BAS - HAUT + 4) / bandes + 1);
      }
      const voileHaut = g.createLinearGradient(0, HAUT, 0, BAS);
      voileHaut.addColorStop(0, "rgba(0,0,0,0.18)");
      voileHaut.addColorStop(0.5, "rgba(0,0,0,0)");
      voileHaut.addColorStop(1, "rgba(0,0,0,0.18)");
      g.fillStyle = voileHaut;
      g.fillRect(X0, HAUT - 2, W, BAS - HAUT + 4);
      // Lignes
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.lineWidth = 2;
      const mi = (HAUT + BAS) / 2;
      g.beginPath();
      g.moveTo(X0, mi);
      g.lineTo(X0 + W, mi);
      g.stroke();
      g.beginPath();
      g.arc(L / 2, mi, 44, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "rgba(255,255,255,0.8)";
      g.beginPath();
      g.arc(L / 2, mi, 3, 0, Math.PI * 2);
      g.fill();
      for (const [y0, sens] of [[HAUT - 2, 1], [BAS + 2, -1]] as const) {
        g.strokeRect(L / 2 - 90, y0, 180, sens * 62);
        g.strokeRect(L / 2 - 46, y0, 92, sens * 24);
        g.beginPath();
        g.arc(L / 2, y0 + sens * 62, 26, sens > 0 ? 0 : Math.PI, sens > 0 ? Math.PI : Math.PI * 2);
        g.stroke();
      }
      g.restore();
      // Buts avec filets
      for (const [y0, h0] of [[HAUT - 16, 14], [BAS + 2, 14]] as const) {
        boite(g, pal, L / 2 - BUT / 2, y0, BUT, h0, pal.neige, { r: 3, ombre: 0, trait: 2.5 });
        g.strokeStyle = teinte(pal.encre, 0.35);
        g.lineWidth = 1;
        for (let x = L / 2 - BUT / 2 + 6; x < L / 2 + BUT / 2; x += 8) {
          g.beginPath();
          g.moveTo(x, y0 + 1);
          g.lineTo(x, y0 + h0 - 1);
          g.stroke();
        }
        g.beginPath();
        g.moveTo(L / 2 - BUT / 2, y0 + h0 / 2);
        g.lineTo(L / 2 + BUT / 2, y0 + h0 / 2);
        g.stroke();
      }
      // Barres et joueurs
      barres.forEach((b, ib) => {
        const tige = g.createLinearGradient(0, b.y - 3, 0, b.y + 3);
        tige.addColorStop(0, "rgb(235, 238, 245)");
        tige.addColorStop(0.5, "rgb(160, 168, 185)");
        tige.addColorStop(1, "rgb(110, 118, 135)");
        g.fillStyle = tige;
        g.fillRect(0, b.y - 3, L, 6);
        g.strokeStyle = pal.encre;
        g.lineWidth = 1.5;
        g.strokeRect(-1, b.y - 3, L + 2, 6);
        // Poignée côté de son camp ; la barre pilotée au clavier est soulignée
        if (b.joueur && ib === choisie) {
          g.fillStyle = teinte(pal.accent2, 0.35 + 0.15 * Math.sin(temps * 6));
          g.fillRect(14, b.y - 9, L - 28, 18);
        }
        boite(g, pal, b.joueur ? L - 10 : -4, b.y - 6, 14, 12, b.joueur ? (ib === choisie ? pal.accent2 : pal.accent) : pal.creme2, { r: 4, ombre: 0, trait: 2 });
        const coup = coups.get(ib) ?? 0;
        for (const f of figures(b)) {
          const maillot = b.joueur ? pal.accent : pal.creme2;
          const sens = b.joueur ? -1 : 1;
          // Pied qui frappe
          if (coup > 0) {
            boite(g, pal, f.x - 4, f.y + sens * (6 + coup * 30), 8, 8, assombrir(maillot, 0.25), { r: 3, ombre: 0, trait: 1.5 });
          }
          boite(g, pal, f.x - 14, f.y - 8, 28, 16, maillot, { r: 7, ombre: 2, trait: 2.2 });
          g.fillStyle = b.joueur ? eclaircir(maillot, 0.35) : pal.sapin;
          g.fillRect(f.x - 2.5, f.y - 7, 5, 14);
          rond(g, pal, f.x, f.y, 6.5, "rgb(255, 214, 178)", { ombre: 0, trait: 1.6 });
          g.fillStyle = b.joueur ? pal.accent2 : pal.sapin;
          g.beginPath();
          g.arc(f.x, f.y, 6.5, Math.PI, 0);
          g.fill();
          g.fillStyle = pal.neige;
          g.beginPath();
          g.arc(f.x, f.y - 6.5, 2, 0, Math.PI * 2);
          g.fill();
        }
      });
      fx.dessiner(g, pal);
      bille(g, pal, balle.x, balle.y, balle.r, pal.neige, 2);
      g.strokeStyle = teinte(pal.encre, 0.4);
      g.lineWidth = 1.2;
      g.beginPath();
      const rot = (balle.x + balle.y) / 9;
      g.arc(balle.x, balle.y, balle.r * 0.55, rot, rot + 1.4);
      g.stroke();
      g.restore();
      bandeau(g, pal, L, `Toi ${marques} – ${encaisses} Lutins`, `${Math.ceil(reste)} s`);
      if (reste < 10 && reste > 0) {
        g.fillStyle = teinte(pal.accent, 0.25 + 0.2 * Math.sin(temps * 8));
        g.fillRect(6, 36, L - 12, 3);
      }
      if (messageT > 0) texte(g, pal, message, L / 2, (HAUT + BAS) / 2 - 70, { taille: 30 + Math.max(0, messageT - 0.8) * 30, couleur: pal.creme, contour: true });
      fx.voile(g, L, H);
    },
    saisie(e: Saisie) {
      if (e.type === "down") {
        const i = barreProche(e.y);
        choisie = i;
        doigts.set(e.id ?? 0, { barre: i, x0: e.x, ox0: cibles[i] });
      } else if (e.type === "move") {
        const d = doigts.get(e.id ?? 0);
        if (d && e.appui !== false) cibles[d.barre] = borne(d.ox0 + (e.x - d.x0), -OX, OX);
        else if (!d && e.appui === false) {
          // Souris sans clic : la barre la plus proche suit le pointeur.
          const i = barreProche(e.y);
          choisie = i;
          const fig = figures({ ...barres[i], ox: 0 });
          const proche = fig.reduce((m, f) => (Math.abs(f.x - e.x) < Math.abs(m.x - e.x) ? f : m), fig[0]);
          cibles[i] = borne(e.x - proche.x, -OX, OX);
        }
      } else if (e.type === "up") {
        doigts.delete(e.id ?? 0);
      } else if (e.type === "keydown" || e.type === "keyup") {
        const on = e.type === "keydown";
        if (e.key === "ArrowLeft" || e.key === "q" || e.key === "a") gauche = on;
        if (e.key === "ArrowRight" || e.key === "d") droite = on;
        if (on && (e.key === "ArrowUp" || e.key === "z" || e.key === "w")) choisie = Math.min(2, choisie + 1);
        if (on && (e.key === "ArrowDown" || e.key === "s")) choisie = Math.max(0, choisie - 1);
        if (on && ["1", "2", "3"].includes(e.key)) choisie = Number(e.key) - 1;
      }
    },
  };
  return jeu;
};
