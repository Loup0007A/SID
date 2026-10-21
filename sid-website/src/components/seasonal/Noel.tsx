"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { daysUntil, useSiteDecor } from "@/components/seasonal/siteDecor";

/**
 * Décor de Noël (Lot 41). La base décide s'il est affiché (site_decor :
 * automatique du 1er décembre au 6 janvier, toujours, ou désactivé depuis
 * Modération). Rien ne capte les clics, sauf le cadeau du pied de page.
 */

/* ---------------------------------------------------------------
   Dessins
   --------------------------------------------------------------- */

/** Un renne au galop, tête à gauche (le traîneau vole de droite à gauche). */
function Reindeer({ x, nose = false }: { x: number; nose?: boolean }) {
  return (
    <g transform={`translate(${x} 6)`}>
      <ellipse cx="18" cy="16" rx="10" ry="4.4" />
      <path
        d="M10.5 14 C9 11 7.6 8.6 6.2 7"
        className="nl-stroke"
        style={{ strokeWidth: 3.2 }}
      />
      <ellipse
        cx="4.6"
        cy="6.4"
        rx="3.3"
        ry="2"
        transform="rotate(-18 4.6 6.4)"
      />
      <path
        d="M6.2 4.6 L7.4 0.8 M7 2.2 L9.6 1 M5 4.8 L3.4 1.2 M3.9 2.6 L1.6 1.9"
        className="nl-stroke nl-antler"
      />
      <path
        d="M11 19 L7.4 23.6 M13.6 19.4 L10.6 25 M23.6 19 L29 22 M25.8 18.2 L31.2 19.6"
        className="nl-stroke nl-leg"
      />
      <path d="M27.6 13.2 L30.4 11.6" className="nl-stroke" />
      {nose && <circle cx="1.5" cy="6.9" r="1.25" className="nl-nose" />}
    </g>
  );
}

function Sleigh({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="-4 -2 176 48"
      className={`nl-sleigh ${className}`}
      style={style}
      aria-hidden
    >
      <path
        d="M32 21 L44 22 M66 21 L78 22 M100 21 L116 25"
        className="nl-rein"
      />
      <Reindeer x={0} nose />
      <Reindeer x={34} />
      <Reindeer x={68} />
      {/* Traîneau */}
      <path d="M118 22 L150 21 Q156 21 155 27 L152 33 L126 33 Q120 33 120 28 Z" />
      <path
        d="M114 39 L153 39 Q160 39 160 34 M127 33 L125 39 M147 33 L148 39 M114 39 Q110 39 111 35"
        className="nl-stroke nl-runner"
      />
      {/* Hotte et Père Noël */}
      <path d="M140 21 Q138 12 146 12 Q153 12 152 21 Z" className="nl-sack" />
      <circle cx="131" cy="17" r="5" />
      <circle cx="129.6" cy="10.2" r="3" />
      <path
        d="M127 8.6 Q130 2.6 135.6 6.4 L137.6 5.2"
        className="nl-stroke nl-hat"
      />
      <circle cx="137.8" cy="5" r="1.1" className="nl-pompom" />
      {/* Poussière d'étoiles */}
      <g className="nl-trail">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle
            key={i}
            cx={162 + i * 4}
            cy={36 - (i % 2) * 5}
            r={1.3 - i * 0.15}
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </g>
    </svg>
  );
}

/** Étoile du berger, en haut à droite. */
function NorthStar() {
  return (
    <svg viewBox="-50 -50 100 100" className="nl-star" aria-hidden>
      <path
        className="nl-star-rays"
        d="M0 -48 L3 -3 L48 0 L3 3 L0 48 L-3 3 L-48 0 L-3 -3 Z"
      />
      <path
        className="nl-star-core"
        d="M0 -20 L5 -5 L20 0 L5 5 L0 20 L-5 5 L-20 0 L-5 -5 Z"
        transform="rotate(45)"
      />
      <circle r="4.5" className="nl-star-heart" />
    </svg>
  );
}

const FIRS: [number, number][] = [
  [90, 0.8],
  [128, 1.05],
  [164, 0.7],
  [1014, 0.75],
  [1052, 1.1],
  [1094, 0.85],
  [1150, 0.65],
];

function Fir({ x, s, lit = false }: { x: number; s: number; lit?: boolean }) {
  return (
    <g transform={`translate(${x} 104) scale(${s})`}>
      <path
        className="nl-fir"
        d="M0 -64 L13 -42 L7 -42 L19 -22 L11 -22 L24 0 L-24 0 L-11 -22 L-19 -22 L-7 -42 L-13 -42 Z"
      />
      <path
        className="nl-fir-snow"
        d="M0 -64 L6 -54 L2 -55 L0 -52 L-3 -55 L-6 -54 Z M-9 -40 L-5 -41 L-2 -38 L2 -41 L6 -40 L8 -37 L-8 -37 Z M-14 -20 L-9 -21 L-5 -18 L0 -21 L5 -18 L10 -21 L14 -18 L-14 -18 Z"
      />
      {lit && (
        <g className="nl-fir-lights">
          {[
            [-6, -46, "r"],
            [5, -38, "g"],
            [-10, -30, "b"],
            [8, -27, "o"],
            [-3, -24, "r"],
            [-15, -12, "o"],
            [-4, -9, "b"],
            [9, -11, "r"],
            [16, -5, "g"],
            [-12, -4, "g"],
          ].map(([cx, cy, c], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="1.7"
              className={`nl-bulb nl-bulb-${c}`}
              style={{ animationDelay: `${(i % 5) * 0.45}s` }}
            />
          ))}
          <path
            className="nl-fir-top"
            d="M0 -71 L1.8 -66.4 L6.6 -66.2 L2.8 -63.2 L4.1 -58.6 L0 -61.4 L-4.1 -58.6 L-2.8 -63.2 L-6.6 -66.2 L-1.8 -66.4 Z"
          />
        </g>
      )}
    </g>
  );
}

/** Collines enneigées, sapins et chalet éclairé, au bas de l'écran. */
function SnowyHills() {
  return (
    <svg
      viewBox="0 0 1200 130"
      preserveAspectRatio="xMidYMax slice"
      className="nl-hills"
      aria-hidden
    >
      <path
        className="nl-hill-far"
        d="M0 90 C150 70 280 86 410 78 C540 70 640 94 790 84 C930 74 1040 64 1200 80 L1200 130 L0 130 Z"
      />
      {FIRS.map(([x, s], i) => (
        <Fir key={i} x={x} s={s} lit={i === 4} />
      ))}
      {/* Chalet */}
      <g className="nl-cabin" transform="translate(860 104)">
        <path
          className="nl-smoke"
          d="M24 -50 C20 -60 30 -64 26 -74 C22 -82 30 -88 28 -96"
        />
        <path
          className="nl-cabin-body"
          d="M-2 0 L-2 -24 L40 -24 L40 0 Z M20 -30 L22 -30 L22 -46 L28 -46 L28 -34"
        />
        <path
          className="nl-cabin-roof"
          d="M-10 -22 L19 -44 L48 -22 L44 -20 L19 -38 L-6 -20 Z"
        />
        <rect
          x="6"
          y="-17"
          width="10"
          height="9"
          rx="1"
          className="nl-window"
        />
        <rect
          x="24"
          y="-17"
          width="10"
          height="9"
          rx="1"
          className="nl-window"
        />
      </g>
      <path
        className="nl-hill"
        d="M0 108 C170 94 310 112 480 104 C650 96 770 116 940 106 C1050 100 1130 98 1200 104 L1200 130 L0 130 Z"
      />
    </svg>
  );
}

/** Flocons qui tombent, en deux ou trois couches (seul le déplacement est animé). */
function Snowfall() {
  return (
    <div className="nl-snow" aria-hidden>
      <div className="nl-snow-layer nl-snow-far" />
      <div className="nl-snow-layer nl-snow-mid" />
      <div className="nl-snow-layer nl-snow-near" />
    </div>
  );
}

/* ---------------------------------------------------------------
   Décor complet
   --------------------------------------------------------------- */

export function NoelDecor() {
  const decor = useSiteDecor();
  const [mounted, setMounted] = useState(false);
  const [sleigh, setSleigh] = useState(0);
  const [comet, setComet] = useState(0);
  const on = !!decor?.noel;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("decor-noel", on);
    if (!on) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return () => root.classList.remove("decor-noel");
    // Le traîneau passe une fois par visite, puis une étoile filante de temps en temps.
    let first: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!sessionStorage.getItem("sid-nl-sleigh")) {
        sessionStorage.setItem("sid-nl-sleigh", "1");
        first = setTimeout(() => setSleigh(1), 1400);
      }
    } catch {
      first = setTimeout(() => setSleigh(1), 1400);
    }
    const t = setInterval(() => setComet((n) => n + 1), 150_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      root.classList.remove("decor-noel");
    };
  }, [on]);

  // Une fois passé, le traîneau quitte la page (plus d'animation cachée).
  useEffect(() => {
    if (!sleigh) return;
    const t = setTimeout(() => setSleigh(0), 15_000);
    return () => clearTimeout(t);
  }, [sleigh]);
  const [cometOn, setCometOn] = useState(false);
  useEffect(() => {
    if (!comet) return;
    setCometOn(true);
    const t = setTimeout(() => setCometOn(false), 2_400);
    return () => clearTimeout(t);
  }, [comet]);

  if (!mounted || !on) return null;

  return createPortal(
    <>
      <div className="nl-back" aria-hidden>
        <div className="nl-aurora" />
        <NorthStar />
        <Snowfall />
        <SnowyHills />
      </div>
      <div className="nl-front" aria-hidden>
        {sleigh > 0 && <Sleigh className="nl-fly" />}
        {cometOn && <span key={comet} className="nl-comet" />}
      </div>
    </>,
    document.body,
  );
}

/* ---------------------------------------------------------------
   Guirlande sous la barre du haut
   --------------------------------------------------------------- */

const BULB_COLORS = ["r", "o", "g", "b"];

/** Guirlande lumineuse accrochée sous la barre du haut (posée dans le header). */
export function NoelGarland() {
  const decor = useSiteDecor();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const on = !!decor?.noel;
  useEffect(() => {
    const el = box.current;
    if (!on || !el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [on]);
  if (!on) return null;
  if (!width) return <div ref={box} className="nl-garland-box" aria-hidden />;

  const swag = width < 640 ? 120 : 170;
  const n = Math.ceil(width / swag);
  const sag = width < 640 ? 9 : 13;
  let wire = "M0 1";
  const bulbs: { x: number; y: number; c: string; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * swag;
    wire += ` Q${x0 + swag / 2} ${1 + sag * 2} ${x0 + swag} 1`;
    const per = width < 640 ? 4 : 5;
    for (let k = 1; k <= per; k++) {
      const t = k / (per + 1);
      const y = 1 + 2 * sag * 2 * t * (1 - t);
      bulbs.push({
        x: x0 + swag * t,
        y,
        c: BULB_COLORS[(i * per + k) % 4],
        d: ((i * per + k) * 0.37) % 2.6,
      });
    }
  }
  return (
    <div ref={box} className="nl-garland-box" aria-hidden>
      <svg
        className="nl-garland"
        width={width}
        height={sag * 2 + 16}
        viewBox={`0 0 ${width} ${sag * 2 + 16}`}
        aria-hidden
      >
        <path d={wire} className="nl-wire" />
        {bulbs.map((b, i) => (
          <g
            key={i}
            transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}
          >
            <rect
              x="-1.6"
              y="-0.5"
              width="3.2"
              height="3"
              rx="0.6"
              className="nl-socket"
            />
            <ellipse
              cx="0"
              cy="6"
              rx="2.9"
              ry="4.2"
              className={`nl-bulb nl-bulb-${b.c}`}
              style={{ animationDelay: `${b.d.toFixed(2)}s` }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------
   Phrase de l'accueil et cadeau du pied de page
   --------------------------------------------------------------- */

function greeting() {
  const { days, month } = daysUntil(12, 25);
  if (month === 12 && days > 1)
    return `Noël dans ${days} jours. Le S.I.D. a sorti les guirlandes.`;
  if (month === 12 && days === 1)
    return "C'est le réveillon. Un traîneau a été signalé au-dessus des archives.";
  if (month === 12 && days === 0)
    return "Joyeux Noël ! Un cadeau t'attend en bas de la page.";
  if (month === 12)
    return "Les rennes se reposent. La nouvelle année approche.";
  if (month === 1) {
    const day = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }),
    ).getDate();
    if (day === 1) return "Bonne année ! Que tes zénis se multiplient.";
    if (day === 6) return "C'est l'Épiphanie. Qui aura la fève ?";
    return "Bonne année ! Les guirlandes restent jusqu'aux Rois.";
  }
  return "Le S.I.D. a sorti les guirlandes.";
}

export function NoelGreeting() {
  const decor = useSiteDecor();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => setText(greeting()), []);
  if (!decor?.noel || !text) return null;
  return <p className="nl-greeting mt-1 font-body text-sm italic">{text}</p>;
}

const LINES = [
  "Ho ho ho !",
  "Tu as été sage cette année ? Le S.I.D. le sait.",
  "Une boîte vide… mais très bien emballée.",
  "Le dragon a mangé le dernier chocolat. Il nie tout.",
  "Les rennes sont garés devant la Cartographie.",
  "Le père Noël est passé par la bourse. Les zénis tremblent.",
  "Attention, ce paquet fait tic-tac.",
];

export function NoelGift() {
  const decor = useSiteDecor();
  const [msg, setMsg] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  if (!decor?.noel) return null;
  return (
    <span className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label="Cadeau"
        onClick={() => {
          setMsg(LINES[Math.floor(Math.random() * LINES.length)]);
          setBurst((b) => b + 1);
          setTimeout(() => setMsg(null), 2600);
        }}
        className="nl-gift"
      >
        <svg viewBox="0 0 32 32" aria-hidden>
          <g key={burst} className={burst ? "nl-lid nl-lid-pop" : "nl-lid"}>
            <rect
              x="4"
              y="9"
              width="24"
              height="6"
              rx="1.2"
              className="nl-box-lid"
            />
            <rect x="14" y="9" width="4" height="6" className="nl-ribbon" />
            <path
              d="M16 9 C12 3 7 5 9.5 8.4 C11 9.6 14 9.4 16 9 C18 9.4 21 9.6 22.5 8.4 C25 5 20 3 16 9 Z"
              className="nl-bow"
            />
          </g>
          <rect x="6" y="15" width="20" height="14" rx="1" className="nl-box" />
          <rect x="14" y="15" width="4" height="14" className="nl-ribbon" />
        </svg>
      </button>
      {burst > 0 && (
        <span key={burst} className="nl-sparkles" aria-hidden>
          {["❄️", "✨", "⭐", "❄️", "✨"].map((c, i) => (
            <span
              key={i}
              style={
                {
                  "--x": `${(i - 2) * 16}px`,
                  "--r": `${(i - 2) * 60}deg`,
                  animationDelay: `${i * 40}ms`,
                } as React.CSSProperties
              }
            >
              {c}
            </span>
          ))}
        </span>
      )}
      {msg && (
        <span role="status" className="nl-bubble">
          {msg}
        </span>
      )}
    </span>
  );
}
