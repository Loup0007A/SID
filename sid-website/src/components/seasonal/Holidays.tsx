"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { daysUntil, useSiteDecor } from "@/components/seasonal/siteDecor";
import type { EventKey } from "@/lib/events";
import { Bells, Bleuet, BleuetStem, Dove, Egg, HeartPath, MuguetSprig, PaperFish, Patrouille, Pigeon } from "@/components/seasonal/drawings";
import { Glyph } from "@/components/icons/SidIcon";
import { Mini, MiniArt, type MiniKind } from "./minis";
import { ArmisticeScene, AvrilScene, JuilletScene, MuguetScene, MusiqueScene, PaquesScene, ValentinScene } from "./scenes";

export { Bells, Bleuet, Dove, Egg, HeartPath, MuguetSprig, PaperFish, Patrouille };

/**
 * Décors des fêtes (Lot 44) : Saint-Valentin, Poisson d'avril, Pâques, 1er mai,
 * Fête de la musique, 14 juillet, 11 novembre. Même principe qu'Halloween et
 * Noël : la base décide ce qui s'affiche (Modération), rien ne capte les clics
 * sauf l'objet du pied de page, et seuls des déplacements et des opacités sont
 * animés.
 */

export type HolidayKey = Exclude<EventKey, "halloween" | "noel" | "grande_chasse">;
export const HOLIDAYS: HolidayKey[] = ["saint_valentin", "poisson_avril", "paques", "premier_mai", "fete_musique", "quatorze_juillet", "armistice"];

// Pseudo-hasard stable (même rendu à chaque affichage).
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function useHoliday(): HolidayKey | null {
  const decor = useSiteDecor();
  if (!decor) return null;
  return HOLIDAYS.find((k) => decor[k]) ?? null;
}

/* ---------------------------------------------------------------
   Petits dessins réutilisés
   --------------------------------------------------------------- */

/* ---------------------------------------------------------------
   Particules (cœurs, pétales, notes, bulles…)
   --------------------------------------------------------------- */

type ParticleSpec = { glyphs: MiniKind[]; count: number; mode: "rise" | "fall" | "drift"; className?: string };

function Particles({ spec }: { spec: ParticleSpec }) {
  const [few, setFew] = useState(false);
  useEffect(() => setFew(!!window.matchMedia?.("(max-width: 640px), (hover: none)").matches), []);
  const n = few ? Math.ceil(spec.count / 2) : spec.count;
  const parts = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        i,
        glyph: spec.glyphs[Math.floor(rnd(i, 9) * spec.glyphs.length)],
        style: {
          left: `${(rnd(i, 1) * 100).toFixed(1)}%`,
          animationDelay: `${(-rnd(i, 3) * 20).toFixed(2)}s`,
          animationDuration: `${(14 + rnd(i, 4) * 16).toFixed(2)}s`,
          ["--s" as string]: (0.6 + rnd(i, 5) * 0.9).toFixed(2),
          ["--dx" as string]: `${((rnd(i, 7) - 0.5) * 120).toFixed(0)}px`,
          ["--o" as string]: (0.35 + rnd(i, 8) * 0.5).toFixed(2),
        } as React.CSSProperties,
      })),
    [n, spec.glyphs]
  );
  return (
    <div className={`hd-particles hd-${spec.mode} ${spec.className ?? ""}`} aria-hidden>
      {parts.map((p) => (
        <span key={p.i} className="hd-p" style={p.style}>
          <Mini kind={p.glyph} />
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Arrière-plans par fête
   --------------------------------------------------------------- */

function ValentinBack() {
  return (
    <>
      <div className="hd-moon hd-moon-rose" />
      <ValentinScene />
      <Particles spec={{ glyphs: ["heart", "heart", "heart", "heartLine"], count: 14, mode: "rise", className: "hd-hearts" }} />
    </>
  );
}

function AvrilBack() {
  const fish = ["#ff9a76", "#7fd8ff", "#ffd86b", "#c9a6ff", "#8ef0b8"];
  return (
    <>
      <AvrilScene />
      <Particles spec={{ glyphs: ["bubble", "bubble", "bubble"], count: 16, mode: "rise", className: "hd-bubbles" }} />
      <div className="hd-swim" aria-hidden>
        {fish.map((c, i) => (
          <PaperFish key={i} color={c} className={i % 2 ? "is-rtl" : ""} style={{ top: `${18 + i * 14}%`, animationDelay: `${-i * 7}s`, animationDuration: `${26 + i * 5}s` }} />
        ))}
      </div>
    </>
  );
}

function PaquesBack() {
  return (
    <>
      <PaquesScene />
      <Particles spec={{ glyphs: ["blossom", "sakura", "petal", "blossom"], count: 14, mode: "fall", className: "hd-petals" }} />
      <div className="hd-nest" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <Egg key={i} hue={i * 2 + 1} style={{ left: `${[9, 31, 74, 91][i]}%`, transform: `rotate(${[-14, 10, -6, 16][i]}deg)` }} />
        ))}
      </div>
    </>
  );
}

function MuguetBack() {
  return (
    <>
      <MuguetScene />
      <Particles spec={{ glyphs: ["petal", "bell", "petal"], count: 14, mode: "fall", className: "hd-white-petals" }} />
      <div className="hd-muguet-row" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <MuguetSprig key={i} style={{ left: `${2 + i * 12 + rnd(i, 2) * 4}%`, height: `${54 + rnd(i, 3) * 26}px`, transform: `scaleX(${i % 2 ? -1 : 1})` }} />
        ))}
      </div>
    </>
  );
}

function MusiqueBack() {
  return (
    <>
      <div className="hd-spots" aria-hidden>
        <i className="hd-spot hd-spot-a" />
        <i className="hd-spot hd-spot-b" />
        <i className="hd-spot hd-spot-c" />
      </div>
      <MusiqueScene />
      <Particles spec={{ glyphs: ["note", "notes", "noteBeam", "noteQuarter"], count: 14, mode: "rise", className: "hd-notes" }} />
    </>
  );
}

function JuilletBack() {
  return <JuilletScene />;
}

function ArmisticeBack() {
  return (
    <>
      <ArmisticeScene />
      <div className="hd-bleuets" aria-hidden>
        {Array.from({ length: 22 }, (_, i) => (
          <BleuetStem key={i} bud={i % 3 === 0} style={{ left: `${(i * 4.6 + rnd(i, 1) * 3).toFixed(1)}%`, bottom: `${(-8 + rnd(i, 2) * 14).toFixed(0)}px`, width: `${(18 + rnd(i, 3) * 14).toFixed(0)}px`, transform: `scaleX(${i % 2 ? -1 : 1}) rotate(${((rnd(i, 4) - 0.5) * 10).toFixed(1)}deg)` }} />
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------
   Survols (une fois par visite)
   --------------------------------------------------------------- */

function Cupid() {
  return (
    <svg viewBox="0 0 120 70" className="hd-fly-art" aria-hidden>
      <g className="hd-cupid">
        <path className="hd-wing" d="M54 30 C44 10 26 8 18 16 C30 18 34 26 36 34 C42 30 48 30 54 34 Z" />
        <circle cx="62" cy="26" r="7" />
        <path d="M56 32 C54 44 58 52 66 54 C72 52 74 42 70 32 Z" />
        <path d="M58 52 L54 62 M68 52 L72 61" className="hd-stroke" />
        <path d="M74 36 L84 30" className="hd-stroke" />
        <path d="M86 16 Q100 32 86 50" className="hd-bow" />
        <path d="M86 16 L86 50" className="hd-string" />
        <path d="M38 33 L92 33" className="hd-arrow" />
        <path d="M92 33 L86 29 L86 37 Z" className="hd-arrow-head" />
      </g>
      <g className="hd-trail">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(${10 - i * 9} ${36 + (i % 2) * 8})`}>
            <g className="hd-trail-h" style={{ animationDelay: `${i * 0.15}s` }}>
              <MiniArt kind="heart" size={9 - i} />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

function NoteStream() {
  return (
    <svg viewBox="0 0 160 60" className="hd-fly-art" aria-hidden>
      {(["note", "notes", "noteBeam", "note", "noteQuarter", "notes"] as MiniKind[]).map((g, i) => (
        <g key={i} transform={`translate(${i * 26 + 14} ${(22 + Math.sin(i * 1.3) * 16).toFixed(1)})`}>
          <g className="hd-flying-note" style={{ animationDelay: `${i * 0.12}s` }}>
            <MiniArt kind={g} size={26} />
          </g>
        </g>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------
   Configuration des fêtes
   --------------------------------------------------------------- */

type FooterSpec = { label: string; lines: string[]; burst: string[] };
type Scene = {
  back: () => ReactNode;
  fly: () => ReactNode;
  garland: GarlandKind;
  greeting: () => string;
  footer: FooterSpec;
};

function parisToday() {
  const p = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return new Date(p.getFullYear(), p.getMonth(), p.getDate());
}

/** Dimanche de Pâques (calendrier grégorien), comme en base. */
export function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}

function FooterIcon({ kind }: { kind: HolidayKey }) {
  switch (kind) {
    case "saint_valentin":
      return (
        <svg viewBox="0 0 32 24" aria-hidden>
          <rect x="1" y="2" width="30" height="20" rx="2" fill="#fdf2f6" />
          <path d="M1 3 L16 14 L31 3" fill="none" stroke="#e7a6bd" strokeWidth="1.6" />
          <path className="hd-seal-heart" d="M16 18 C12 15 10 13 10 11 C10 9.4 11.3 8.4 12.6 8.4 C14 8.4 15.3 9.4 16 10.6 C16.7 9.4 18 8.4 19.4 8.4 C20.7 8.4 22 9.4 22 11 C22 13 20 15 16 18 Z" fill="#e2325f" />
        </svg>
      );
    case "poisson_avril":
      return <PaperFish color="#ff9a76" />;
    case "paques":
      return <Egg hue={1} />;
    case "premier_mai":
      return <MuguetSprig />;
    case "fete_musique":
      return (
        <svg viewBox="0 0 32 32" aria-hidden>
          <path d="M22 3 L29 10 L26 11 L16 21 L11 16 L21 6 Z" fill="#c9a6ff" />
          <path d="M12 15 C6 13 2 17 3 22 C4 27 9 30 13 28 C16 27 17 23 17 20 Z" fill="#ff8a5c" />
          <circle cx="9.5" cy="22.5" r="2.2" fill="#2b1d3a" />
          <path d="M14 19 L24 9" stroke="#fff" strokeWidth="0.8" />
        </svg>
      );
    case "quatorze_juillet":
      return (
        <svg viewBox="0 0 32 32" aria-hidden>
          <path d="M16 2 L20 9 L20 22 L12 22 L12 9 Z" fill="#e2e8f4" />
          <path d="M12 12 L20 12 L20 16 L12 16 Z" fill="#2f5bd8" />
          <path d="M12 16 L20 16 L20 19 L12 19 Z" fill="#e23a3a" />
          <path d="M12 22 L9 28 L12 26 Z M20 22 L23 28 L20 26 Z" fill="#94a3c0" />
          <path d="M14 22 L16 30 L18 22 Z" fill="#ffb02e" />
        </svg>
      );
    case "armistice":
      return <Bleuet />;
  }
}

const SCENES: Record<HolidayKey, Scene> = {
  saint_valentin: {
    back: ValentinBack,
    fly: Cupid,
    garland: "hearts",
    greeting: () => {
      const { days } = daysUntil(2, 14);
      if (days > 1) return `Saint-Valentin dans ${days} jours. Cupidon révise sa visée.`;
      if (days === 1) return "Saint-Valentin demain. Il est encore temps d'écrire un mot doux.";
      return "Joyeuse Saint-Valentin ! Un cœur ailé passe parfois au-dessus des pages…";
    },
    footer: {
      label: "Lettre d'amour",
      lines: ["Roses are red, le S.I.D. est bleu.", "Tu es le zéni de ma vie.", "Quelqu'un pense à toi… peut-être le dragon.", "Cupidon a raté sa cible. Il visait la banque.", "Un cœur offert, zéro zéni dépensé."],
      burst: ["💗", "💘", "💗", "💘", "💗"],
    },
  },
  poisson_avril: {
    back: AvrilBack,
    fly: () => <PaperFish color="#ff9a76" className="hd-fly-art" />,
    garland: "fish",
    greeting: () => "Aujourd'hui, rien n'est vrai. Même pas cette phrase.",
    footer: {
      label: "Poisson",
      lines: [
        "Ton solde vient d'être multiplié par mille. Poisson d'avril !",
        "Le dragon prend sa retraite. Poisson d'avril !",
        "Tu viens de gagner un titre secret… Poisson d'avril !",
        "Les quêtes sont annulées aujourd'hui. Poisson d'avril !",
        "Ton dossier a été effacé. Non : poisson d'avril !",
      ],
      burst: ["🐟", "🐠", "🐟", "🐡", "🐟"],
    },
  },
  paques: {
    back: PaquesBack,
    fly: Bells,
    garland: "eggs",
    greeting: () => {
      const today = parisToday();
      const e = easterSunday(today.getFullYear());
      const d = Math.round((e.getTime() - today.getTime()) / 86400000);
      if (d > 0) return "Les cloches sont parties à Rome. Elles reviennent dimanche, les bras chargés.";
      return "Joyeuses Pâques ! Les cloches sont revenues : des œufs se cachent dans les recoins du site.";
    },
    footer: {
      label: "Œuf",
      lines: ["Piou !", "Un œuf de plus pour la chasse.", "Les cloches sont passées par ici.", "Chocolat noir, au lait ou blanc ? Le dragon a déjà choisi : tous."],
      burst: ["🐣", "🍫", "🌷", "🐣", "✨"],
    },
  },
  premier_mai: {
    back: MuguetBack,
    fly: Pigeon,
    garland: "muguet",
    greeting: () => "1er mai : un brin de muguet pour toi, et repos bien mérité.",
    footer: {
      label: "Brin de muguet",
      lines: ["Un brin de muguet porte-bonheur, rien que pour toi.", "Aujourd'hui, même le dragon fait le pont.", "Bonne fête du Travail !", "Le muguet porte bonheur… et sent très bon."],
      burst: ["🌿", "🤍", "✨", "🌿", "🤍"],
    },
  },
  fete_musique: {
    back: MusiqueBack,
    fly: NoteStream,
    garland: "notes",
    greeting: () => "C'est la fête de la musique ! Le S.I.D. monte le son (sans faire de bruit).",
    footer: {
      label: "Guitare",
      lines: ["Fais du bruit !", "Le dragon joue de la batterie ce soir.", "Ce soir, la banque donne un concert de pièces.", "Un, deux, un, deux… le S.I.D. est prêt !"],
      burst: ["🎵", "🎶", "🎵", "🎶", "🎵"],
    },
  },
  quatorze_juillet: {
    back: JuilletBack,
    fly: Patrouille,
    garland: "bunting",
    greeting: () => {
      const t = parisToday();
      return t.getMonth() === 6 && t.getDate() === 13
        ? "Veille de fête nationale : les fanions sont de sortie."
        : "Bonne fête nationale ! Le feu d'artifice commence à la tombée de la nuit.";
    },
    footer: {
      label: "Fusée",
      lines: ["Bonne fête nationale !", "Liberté, Égalité, Zénis.", "Rendez-vous ce soir sous la tour Eiffel.", "La Patrouille de France vient de survoler les archives."],
      burst: ["🎆", "✨", "🎇", "✨", "🎆"],
    },
  },
  armistice: {
    back: ArmisticeBack,
    fly: Dove,
    garland: "ribbon",
    greeting: () => "11 novembre : nous nous souvenons.",
    footer: {
      label: "Bleuet du souvenir",
      lines: [
        "11 novembre 1918, 11 heures : les armes se taisent. L'armistice est signé.",
        "Le bleuet de France est la fleur du souvenir.",
        "Nous nous souvenons de toutes celles et ceux qui sont tombés.",
      ],
      burst: [],
    },
  },
};

/* ---------------------------------------------------------------
   Décor complet (arrière-plan + survol)
   --------------------------------------------------------------- */

export function HolidayDecor() {
  const key = useHoliday();
  const [mounted, setMounted] = useState(false);
  const [fly, setFly] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!key) return;
    const root = document.documentElement;
    const cls = `decor-${key}`;
    root.classList.add(cls, "decor-holiday");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!reduce) {
      try {
        const k = `sid-hd-fly-${key}`;
        if (!sessionStorage.getItem(k)) {
          sessionStorage.setItem(k, "1");
          t = setTimeout(() => setFly(true), 1500);
        }
      } catch {
        t = setTimeout(() => setFly(true), 1500);
      }
    }
    const gone = setTimeout(() => setFly(false), 17_000);
    return () => {
      clearTimeout(t);
      clearTimeout(gone);
      root.classList.remove(cls, "decor-holiday");
    };
  }, [key]);

  if (!mounted || !key) return null;
  const scene = SCENES[key];
  const Back = scene.back;
  const Fly = scene.fly;
  return createPortal(
    <>
      <div className={`hd-back hd-back-${key}`} aria-hidden>
        <Back />
      </div>
      <div className="hd-front" aria-hidden>
        {fly && (
          <div className={`hd-fly hd-fly-${key}`}>
            <Fly />
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

/* ---------------------------------------------------------------
   Guirlande sous la barre du haut
   --------------------------------------------------------------- */

type GarlandKind = "hearts" | "fish" | "eggs" | "muguet" | "notes" | "bunting" | "ribbon";

function GarlandItem({ kind, i }: { kind: GarlandKind; i: number }) {
  switch (kind) {
    case "hearts":
      return <MiniArt kind="heart" size={15} y={10} className={`hd-g-heart hd-g-c${i % 3}`} />;
    case "fish":
      return (
        <g transform={`translate(0 6) rotate(${i % 2 ? 8 : -8})`}>
          <path d="M-9 0 C-6 -5 2 -6 6 -2 L10 -5 L9.5 0 L10 5 L6 2 C2 6 -6 5 -9 0 Z" className={`hd-g-fish hd-g-c${i % 4}`} />
          <circle cx="-5.5" cy="-0.8" r="1" fill="#1b1b24" />
        </g>
      );
    case "eggs":
      return <ellipse cx="0" cy="9" rx="5" ry="6.6" className={`hd-g-egg hd-g-c${i % 5}`} />;
    case "muguet":
      return (
        <g transform="translate(0 2)">
          <path d="M0 0 Q2 6 0 12" fill="none" stroke="#4f9a5d" strokeWidth="1" />
          <MiniArt kind="bell" size={9} y={15} color="#fbfff7" className="hd-g-bell" />
        </g>
      );
    case "notes":
      return (
        <MiniArt kind={(["note", "notes", "noteBeam"] as MiniKind[])[i % 3]} size={15} y={10} className={`hd-g-note hd-g-c${i % 3}`} />
      );
    case "bunting":
      return <path d="M-7 1 L7 1 L0 15 Z" className={`hd-g-flag hd-g-f${i % 3}`} />;
    default:
      return null;
  }
}

export function HolidayGarland() {
  const key = useHoliday();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!key || !el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [key]);
  if (!key) return null;
  const kind = SCENES[key].garland;
  if (kind === "ribbon") return <div className="hd-ribbon-line" aria-hidden />;
  if (!width) return <div ref={box} className="nl-garland-box" aria-hidden />;

  const small = width < 640;
  const swag = small ? 120 : 170;
  const n = Math.ceil(width / swag);
  const sag = kind === "bunting" ? (small ? 6 : 9) : small ? 9 : 13;
  const per = kind === "bunting" ? (small ? 6 : 9) : small ? 4 : 5;
  let wire = "M0 1";
  const items: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * swag;
    wire += ` Q${x0 + swag / 2} ${1 + sag * 2} ${x0 + swag} 1`;
    for (let k = 1; k <= per; k++) {
      const t = k / (per + 1);
      const y = 1 + 4 * sag * t * (1 - t);
      const slope = (4 * sag * (1 - 2 * t)) / swag;
      items.push({ x: x0 + swag * t, y, r: kind === "bunting" ? (Math.atan(slope) * 180) / Math.PI : 0 });
    }
  }
  return (
    <div ref={box} className="nl-garland-box" aria-hidden>
      <svg className={`nl-garland hd-garland hd-garland-${kind}`} width={width} height={sag * 2 + 24} viewBox={`0 0 ${width} ${sag * 2 + 24}`}>
        <path d={wire} className="hd-wire" />
        {items.map((it, i) => (
          <g key={i} transform={`translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${it.r.toFixed(1)})`} className="hd-g-item" style={{ animationDelay: `${((i * 0.37) % 2.6).toFixed(2)}s` }}>
            <GarlandItem kind={kind} i={i} />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------
   Phrase de l'accueil et objet du pied de page
   --------------------------------------------------------------- */

export function HolidayGreeting() {
  const key = useHoliday();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => setText(key ? SCENES[key].greeting() : null), [key]);
  if (!key || !text) return null;
  return <p className={`hd-greeting hd-greeting-${key} mt-1 font-body text-sm italic`}>{text}</p>;
}

export function HolidayFooter() {
  const key = useHoliday();
  const [msg, setMsg] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  if (!key) return null;
  const f = SCENES[key].footer;
  return (
    <span className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label={f.label}
        onClick={() => {
          setMsg(f.lines[Math.floor(Math.random() * f.lines.length)]);
          setBurst((b) => b + 1);
          setTimeout(() => setMsg(null), key === "armistice" ? 5000 : 2800);
        }}
        className={`hd-footer hd-footer-${key} ${burst ? "is-open" : ""}`}
      >
        <FooterIcon kind={key} />
      </button>
      {burst > 0 && f.burst.length > 0 && (
        <span key={burst} className="nl-sparkles" aria-hidden>
          {f.burst.map((c, i) => (
            <span key={i} style={{ "--x": `${(i - 2) * 16}px`, "--r": `${(i - 2) * 60}deg`, animationDelay: `${i * 40}ms` } as React.CSSProperties}>
              <Glyph e={c} size="1.2em" />
            </span>
          ))}
        </span>
      )}
      {msg && (
        <span role="status" className={`hd-bubble hd-bubble-${key}`}>
          {msg}
        </span>
      )}
    </span>
  );
}
