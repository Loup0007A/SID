import { assombrir, bandeau, boite, ciel, eclaircir, Effets, flocons, rond, teinte, texte, type CreerJeu, type Saisie } from "./moteur";

/**
 * Le Carillon : quatre cloches jouent une mélodie qui s'allonge d'une note
 * à chaque manche, et de plus en plus vite. Rejoue-la dans l'ordre (toucher
 * les cloches, ou touches 1 à 4). Manche réussie : 25 points par
 * note. Deux erreurs permises : la mélodie est alors rejouée.
 */
const L = 360;
const H = 540;
const NOTES = [523.25, 659.25, 783.99, 1046.5];
const TOUCHES: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, z: 1, q: 2, s: 3 };
// Un seul contexte audio pour toutes les parties (le navigateur en limite le nombre).
let audio: AudioContext | null = null;

type Phase = "ecoute" | "joue" | "pause" | "fin";

export const carillon: CreerJeu = ({ pal, rng }) => {
  const fx = new Effets(rng);
  const etoiles = flocons(40, L, H, rng);
  const couleurs = [pal.accent, pal.accent2, pal.sapin, "rgb(70, 150, 220)"];
  const cloches = [0, 1, 2, 3].map((i) => ({ x: 98 + (i % 2) * 164, y: 190 + Math.floor(i / 2) * 190, eclat: 0, balance: 0 }));
  const melodie: number[] = [];
  let phase: Phase = "pause";
  let pauseT = 1.2;
  let lecture = 0; // indice de la note jouée par le carillon
  let lectureT = 0;
  let saisie = 0; // indice attendu du joueur
  let vies = 2;
  let score = 0;
  let manche = 0;
  let temps = 0;
  let message = "Écoute, puis rejoue";
  let messageT = 2;

  const ecart = () => Math.max(0.24, 0.62 * 0.95 ** manche);

  function son(i: number) {
    try {
      if (!audio) {
        const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
          ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        audio = new Ctor();
      }
      if (audio.state === "suspended") void audio.resume();
      const t0 = audio.currentTime;
      for (const [mult, vol] of [[1, 0.18], [2.01, 0.06], [3.02, 0.03]] as const) {
        const o = audio.createOscillator();
        const v = audio.createGain();
        o.type = "sine";
        o.frequency.value = NOTES[i] * mult;
        v.gain.setValueAtTime(vol, t0);
        v.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
        o.connect(v).connect(audio.destination);
        o.start(t0);
        o.stop(t0 + 0.95);
      }
    } catch {
      // Pas de son : le jeu reste jouable à l'œil.
    }
  }
  function sonner(i: number) {
    cloches[i].eclat = 1;
    cloches[i].balance = 1;
    son(i);
  }
  function nouvelleManche() {
    manche++;
    melodie.push(Math.floor(rng() * 4));
    phase = "pause";
    pauseT = 0.7;
  }
  nouvelleManche();

  const jeu = {
    largeur: L,
    hauteur: H,
    score: 0,
    fini: false,
    maj(dt: number) {
      fx.maj(dt);
      temps += dt;
      messageT -= dt;
      for (const c of cloches) {
        c.eclat = Math.max(0, c.eclat - dt * 2.5);
        c.balance = Math.max(0, c.balance - dt * 1.6);
      }
      if (jeu.fini) return;
      if (phase === "pause") {
        pauseT -= dt;
        if (pauseT <= 0) {
          phase = "ecoute";
          lecture = 0;
          lectureT = 0.2;
        }
      } else if (phase === "ecoute") {
        lectureT -= dt;
        if (lectureT <= 0) {
          if (lecture < melodie.length) {
            sonner(melodie[lecture]);
            lecture++;
            lectureT = ecart();
          } else {
            phase = "joue";
            saisie = 0;
          }
        }
      }
      jeu.score = score;
    },
    dessiner(g: CanvasRenderingContext2D) {
      ciel(g, pal, L, H, etoiles, temps);
      // Poutre et cordes
      boite(g, pal, 24, 66, L - 48, 18, "rgb(150, 96, 58)", { r: 6, ombre: 4 });
      g.save();
      fx.decaler(g);
      // Cordes d'abord, cloches ensuite : les cordes du bas passent derrière.
      g.strokeStyle = pal.encre;
      g.lineWidth = 2.5;
      for (const c of cloches) {
        g.beginPath();
        g.moveTo(c.x + (c.y > 300 ? 30 : 0), 84);
        g.lineTo(c.x, c.y - 60);
        g.stroke();
      }
      cloches.forEach((c, i) => {
        const coul = couleurs[i];
        const ang = Math.sin(temps * 14) * 0.35 * c.balance;
        if (c.eclat > 0) {
          g.fillStyle = teinte(coul, 0.35 * c.eclat);
          g.beginPath();
          g.arc(c.x, c.y, 80 + 20 * (1 - c.eclat), 0, Math.PI * 2);
          g.fill();
        }
        g.save();
        g.translate(c.x, c.y - 60);
        g.rotate(ang);
        // Battant
        rond(g, pal, 0, 92, 10, assombrir(coul, 0.3), { ombre: 0, trait: 2 });
        // Corps de la cloche
        const corps = c.eclat > 0 ? eclaircir(coul, 0.35 * c.eclat) : coul;
        g.fillStyle = pal.encre;
        g.beginPath();
        g.moveTo(-18 + 4, 6 + 4);
        g.quadraticCurveTo(-24 + 4, 60 + 4, -56 + 4, 84 + 4);
        g.lineTo(56 + 4, 84 + 4);
        g.quadraticCurveTo(24 + 4, 60 + 4, 18 + 4, 6 + 4);
        g.closePath();
        g.fill();
        const d = g.createLinearGradient(-56, 0, 56, 0);
        d.addColorStop(0, eclaircir(corps, 0.25));
        d.addColorStop(0.45, corps);
        d.addColorStop(1, assombrir(corps, 0.2));
        g.fillStyle = d;
        g.beginPath();
        g.moveTo(-18, 6);
        g.quadraticCurveTo(-24, 60, -56, 84);
        g.lineTo(56, 84);
        g.quadraticCurveTo(24, 60, 18, 6);
        g.closePath();
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = pal.encre;
        g.stroke();
        boite(g, pal, -58, 80, 116, 10, assombrir(corps, 0.15), { r: 5, ombre: 0, trait: 2.5 });
        rond(g, pal, 0, 4, 8, pal.accent2, { ombre: 0, trait: 2 });
        g.fillStyle = "rgba(255,255,255,0.45)";
        g.beginPath();
        g.ellipse(-14, 40, 5, 20, 0.25, 0, Math.PI * 2);
        g.fill();
        // Houx
        g.fillStyle = pal.sapin;
        g.beginPath();
        g.ellipse(-10, 18, 9, 4, -0.5, 0, Math.PI * 2);
        g.ellipse(10, 18, 9, 4, 0.5, 0, Math.PI * 2);
        g.fill();
        rond(g, pal, 0, 17, 3.5, pal.accent, { ombre: 0, trait: 1.5 });
        g.restore();
        texte(g, pal, String(i + 1), c.x + 40, c.y - 40, { taille: 13, mono: true, couleur: teinte(pal.neige, 0.85) });
      });
      fx.dessiner(g, pal);
      g.restore();
      bandeau(g, pal, L, `${score} pts · manche ${manche}`, "");
      for (let k = 0; k < Math.max(0, vies + 1); k++) rond(g, pal, L - 26 - k * 18, 21, 6, pal.accent, { ombre: 1, trait: 2 });
      // Progression de la mélodie
      const n = melodie.length;
      const larg = Math.min(18, (L - 60) / Math.max(n, 1));
      for (let k = 0; k < n; k++) {
        const x = L / 2 - (n * larg) / 2 + k * larg + larg / 2;
        const fait = phase === "joue" ? k < saisie : phase === "ecoute" ? k < lecture : false;
        rond(g, pal, x, H - 40, Math.min(6, larg / 2 - 1), fait ? couleurs[melodie[k]] : teinte(pal.neige, 0.3), { ombre: 0, trait: 1.5 });
      }
      const etat = phase === "ecoute" ? "Écoute…" : phase === "joue" ? "À toi !" : "";
      if (etat) texte(g, pal, etat, L / 2, H - 70, { taille: 18, couleur: pal.creme, contour: true });
      if (messageT > 0) {
        g.font = `800 17px "Archivo", system-ui, sans-serif`;
        const w = (g.measureText?.(message)?.width ?? 180) + 32;
        boite(g, pal, L / 2 - w / 2, 270, w, 36, pal.encre, { r: 18, ombre: 3, trait: 0 });
        texte(g, pal, message, L / 2, 288, { taille: 17, couleur: pal.creme });
      }
      fx.voile(g, L, H);
    },
    saisie(e: Saisie) {
      if (jeu.fini || phase !== "joue") return;
      let i = -1;
      if (e.type === "down") {
        i = cloches.findIndex((c) => Math.abs(e.x - c.x) < 70 && e.y > c.y - 70 && e.y < c.y + 50);
      } else if (e.type === "keydown" && e.key in TOUCHES) i = TOUCHES[e.key];
      if (i < 0) return;
      sonner(i);
      if (i === melodie[saisie]) {
        saisie++;
        if (saisie >= melodie.length) {
          const gain = 25 * melodie.length;
          score += gain;
          jeu.score = score;
          fx.flotte(L / 2, 290, `+${gain}`, pal.accent2, 24);
          fx.gerbe(L / 2, 290, [pal.accent, pal.accent2, pal.neige, pal.sapin], 24, 220);
          nouvelleManche();
        }
      } else {
        vies--;
        fx.secouer(9);
        fx.flash(pal.accent, 0.3);
        if (vies < 0) {
          jeu.fini = true;
          phase = "fin";
          message = "Fausse note !";
          messageT = 99;
        } else {
          message = "Fausse note, on réécoute";
          messageT = 1.4;
          phase = "pause";
          pauseT = 1.2;
        }
      }
    },
  };
  return jeu;
};
