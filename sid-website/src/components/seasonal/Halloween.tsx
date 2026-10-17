"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

/**
 * Décor d'Halloween (Lot 37). La base décide s'il est affiché
 * (site_decor : automatique du 15 octobre au 2 novembre, toujours, ou
 * désactivé depuis Modération). Rien ne capte les clics, sauf la lanterne
 * du pied de page.
 */

export type SiteDecor = { halloween: boolean; halloween_mode: "auto" | "on" | "off" };
export const DECOR_CHANGED_EVENT = "sid:decor-changed";

let cache: { at: number; value: SiteDecor } | null = null;
let inflight: Promise<SiteDecor> | null = null;

async function fetchDecor(force = false): Promise<SiteDecor> {
  if (!force && cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await createClient().rpc("site_decor");
    const value: SiteDecor = !error && data ? (data as SiteDecor) : { halloween: false, halloween_mode: "auto" };
    cache = { at: Date.now(), value };
    inflight = null;
    return value;
  })();
  return inflight;
}

/** Le décor en vigueur ; se met à jour quand l'administration le change. */
export function useSiteDecor(): SiteDecor | null {
  const [decor, setDecor] = useState<SiteDecor | null>(cache?.value ?? null);
  useEffect(() => {
    let alive = true;
    fetchDecor().then((d) => alive && setDecor(d));
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<SiteDecor | undefined>).detail;
      if (d) {
        cache = { at: Date.now(), value: d };
        setDecor(d);
      } else fetchDecor(true).then((v) => alive && setDecor(v));
    };
    window.addEventListener(DECOR_CHANGED_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(DECOR_CHANGED_EVENT, onChange);
    };
  }, []);
  return decor;
}

/* ---------------------------------------------------------------
   Dessins
   --------------------------------------------------------------- */

function Bat({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const wing = "M32 17 C27 9 17 6 5 10 C9 12 10.5 15 9.5 19.5 C13 16.5 16.5 17.5 18.5 21.5 C20.5 17.5 24 17.5 27 20.5 C28.5 18.5 30 17.8 32 18.6 Z";
  return (
    <svg viewBox="0 0 64 32" className={`hw-bat ${className}`} style={style} aria-hidden>
      <g className="hw-wing hw-wing-l">
        <path d={wing} />
      </g>
      <g className="hw-wing hw-wing-r">
        <path d={wing} transform="translate(64 0) scale(-1 1)" />
      </g>
      <ellipse cx="32" cy="18" rx="3.6" ry="5.6" />
      <path d="M29.6 13.4 L30.4 9.2 L31.6 12.6 Z M34.4 13.4 L33.6 9.2 L32.4 12.6 Z" />
      <circle cx="30.9" cy="15.6" r="0.55" className="hw-eye" />
      <circle cx="33.1" cy="15.6" r="0.55" className="hw-eye" />
    </svg>
  );
}

function Cobweb() {
  const R = 120;
  const angles = [0, 14, 30, 47, 63, 78, 90].map((a) => (a * Math.PI) / 180);
  const pt = (a: number, r: number) => [Math.cos(a) * r, Math.sin(a) * r];
  const rings = [24, 46, 70, 96];
  return (
    <svg viewBox="0 0 120 120" className="hw-web" aria-hidden>
      {angles.map((a, i) => {
        const [x, y] = pt(a, R * 1.42);
        return <line key={i} x1="0" y1="0" x2={x} y2={y} />;
      })}
      {rings.map((r, k) => (
        <path
          key={k}
          d={angles
            .slice(1)
            .map((a, i) => {
              const [x0, y0] = pt(angles[i], r);
              const [x1, y1] = pt(a, r);
              const mid = (angles[i] + a) / 2;
              const [cx, cy] = pt(mid, r * 0.86);
              return `${i === 0 ? `M${x0.toFixed(1)} ${y0.toFixed(1)} ` : ""}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
            })
            .join(" ")}
        />
      ))}
      <g className="hw-spider">
        <line x1="58" y1="38" x2="58" y2="78" className="hw-thread" />
        <g transform="translate(58 82)">
          <path d="M-2 -1 L-9 -6 L-11 -2 M-2 0 L-10 -1 L-12 3 M-2 1 L-9 4 L-10 9 M-1 2 L-6 7 L-6 12 M2 -1 L9 -6 L11 -2 M2 0 L10 -1 L12 3 M2 1 L9 4 L10 9 M1 2 L6 7 L6 12" className="hw-legs" />
          <ellipse cx="0" cy="2" rx="3.4" ry="4.2" />
          <circle cx="0" cy="-2.6" r="2.2" />
          <circle cx="-0.8" cy="-3" r="0.45" className="hw-eye" />
          <circle cx="0.8" cy="-3" r="0.45" className="hw-eye" />
        </g>
      </g>
    </svg>
  );
}

/** Collines, tombes et arbre nu, en silhouette au bas de l'écran. */
function Graveyard() {
  return (
    <svg viewBox="0 0 1200 130" preserveAspectRatio="xMidYMax slice" className="hw-graveyard" aria-hidden>
      <path className="hw-hill-far" d="M0 92 C140 70 260 86 380 78 C520 68 610 92 760 84 C900 76 1010 64 1200 82 L1200 130 L0 130 Z" />
      <path className="hw-hill" d="M0 108 C160 96 300 112 470 104 C640 96 760 116 930 106 C1040 100 1120 98 1200 104 L1200 130 L0 130 Z" />
      {/* Tombes */}
      <g className="hw-stones">
        <path d="M168 104 L168 84 Q178 72 188 84 L188 104 Z" transform="rotate(-6 178 104)" />
        <path d="M214 106 L214 92 Q221 84 228 92 L228 106 Z" transform="rotate(5 221 106)" />
        <path d="M884 106 L884 82 Q896 68 908 82 L908 106 Z" transform="rotate(4 896 106)" />
        <path d="M936 104 L936 94 L944 94 L944 86 L950 86 L950 94 L958 94 L958 100 L950 100 L950 106 L944 106 L944 100 L936 100 Z" />
        <path d="M1010 104 L1010 90 Q1017 82 1024 90 L1024 104 Z" transform="rotate(-8 1017 104)" />
      </g>
      {/* Arbre nu */}
      <path
        className="hw-tree"
        d="M612 104 C616 86 614 70 606 56 C598 44 586 40 574 34 M606 56 C612 46 622 40 636 38 M612 80 C624 70 640 66 654 58 C664 52 670 44 672 34 M640 66 C650 70 660 70 670 66 M610 70 C600 64 590 62 578 64 M620 104 C618 90 622 78 630 70"
      />
    </svg>
  );
}

function Moon() {
  return (
    <div className="hw-moon-wrap" aria-hidden>
      <div className="hw-moon" />
      <div className="hw-cloud" />
    </div>
  );
}

/* ---------------------------------------------------------------
   Décor complet
   --------------------------------------------------------------- */

const FLOCK = [
  { d: 0, s: 1, y: 0, t: 7.5 },
  { d: 0.35, s: 0.7, y: 34, t: 8.2 },
  { d: 0.6, s: 0.85, y: -26, t: 7.8 },
  { d: 1.1, s: 0.55, y: 60, t: 9 },
  { d: 1.4, s: 0.65, y: 12, t: 8.6 },
];

export function HalloweenDecor() {
  const decor = useSiteDecor();
  const [mounted, setMounted] = useState(false);
  const [flock, setFlock] = useState(false);
  const [straggler, setStraggler] = useState(0);
  const [strayOn, setStrayOn] = useState(false);
  const on = !!decor?.halloween;

  useEffect(() => {
    if (!straggler) return;
    setStrayOn(true);
    const t = setTimeout(() => setStrayOn(false), 12_500);
    return () => clearTimeout(t);
  }, [straggler]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("decor-halloween", on);
    if (!on) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    // Le vol de chauves-souris : une fois par visite, puis une retardataire de temps en temps.
    let first: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!sessionStorage.getItem("sid-hw-flock")) {
        sessionStorage.setItem("sid-hw-flock", "1");
        first = setTimeout(() => setFlock(true), 900);
      }
    } catch {
      first = setTimeout(() => setFlock(true), 900);
    }
    const t = setInterval(() => setStraggler((n) => n + 1), 140_000);
    // Une fois passées, les chauves-souris quittent la page (plus d'animation cachée).
    const gone = setTimeout(() => setFlock(false), 13_000);
    return () => {
      clearTimeout(first);
      clearTimeout(gone);
      clearInterval(t);
      root.classList.remove("decor-halloween");
    };
  }, [on]);

  if (!mounted || !on) return null;

  return createPortal(
    <>
      <div className="hw-back" aria-hidden>
        <Moon />
        <Graveyard />
        <div className="hw-fog" />
      </div>
      <div className="hw-front" aria-hidden>
        <Cobweb />
        {flock &&
          FLOCK.map((b, i) => (
            <Bat
              key={`f${i}`}
              className="hw-fly"
              style={{ "--d": `${b.d}s`, "--s": b.s, "--y": `${b.y}px`, "--t": `${b.t}s` } as React.CSSProperties}
            />
          ))}
        {strayOn && <Bat key={`s${straggler}`} className="hw-fly hw-straggler" style={{ "--d": "0s", "--s": 0.6, "--y": "40px", "--t": "11s" } as React.CSSProperties} />}
      </div>
    </>,
    document.body
  );
}

/* ---------------------------------------------------------------
   Phrase de l'accueil et lanterne du pied de page
   --------------------------------------------------------------- */

/** Nuits avant le 31 octobre de cette année (négatif après), heure de Paris. */
function nightsBeforeHalloween(now = new Date()) {
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const today = new Date(paris.getFullYear(), paris.getMonth(), paris.getDate());
  return Math.round((new Date(paris.getFullYear(), 9, 31).getTime() - today.getTime()) / 86400000);
}

export function HalloweenGreeting() {
  const decor = useSiteDecor();
  const [n, setN] = useState<number | null>(null);
  useEffect(() => setN(nightsBeforeHalloween()), []);
  if (!decor?.halloween || n === null) return null;
  const text =
    n === 0
      ? "C'est la nuit d'Halloween. Ne laisse pas ton dossier sans surveillance."
      : n > 0 && n <= 31
        ? `Halloween dans ${n} nuit${n > 1 ? "s" : ""}. Les dossiers commencent à grincer.`
        : n < 0 && n >= -3
          ? "Halloween est passé, mais quelques fantômes traînent encore dans les couloirs."
          : "Le S.I.D. a sorti ses citrouilles.";
  return <p className="hw-greeting mt-1 font-body text-sm italic">{text}</p>;
}

const LINES = [
  "Un bonbon ou un sort ?",
  "Bouh !",
  "Tu as entendu ce bruit dans les archives ?",
  "Les zénis, ça ne se mange pas. Les bonbons, si.",
  "Le dragon a peur du noir. Ne lui dis pas.",
  "Quelqu'un a laissé la porte de la crypte ouverte.",
];

export function HalloweenLantern() {
  const decor = useSiteDecor();
  const [msg, setMsg] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  if (!decor?.halloween) return null;
  return (
    <span className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label="Citrouille"
        onClick={() => {
          setMsg(LINES[Math.floor(Math.random() * LINES.length)]);
          setBurst((b) => b + 1);
          setTimeout(() => setMsg(null), 2600);
        }}
        className="hw-lantern"
      >
        <svg viewBox="0 0 32 30" aria-hidden>
          <path className="hw-stem" d="M15 6 C15 3 16 1.5 18.5 1 L19 2.6 C17.4 3.2 17 4.4 17 6 Z" />
          <path className="hw-pumpkin" d="M16 6 C10 5 3 8 3 17 C3 25 9 29 16 28.4 C23 29 29 25 29 17 C29 8 22 5 16 6 Z" />
          <path className="hw-rib" d="M16 6.5 C12 10 12 24 16 28 M16 6.5 C20 10 20 24 16 28 M9 7.6 C6 12 6.5 22 10.5 27 M23 7.6 C26 12 25.5 22 21.5 27" />
          <path className="hw-face" d="M9 14 L12.5 12 L13 15.5 Z M23 14 L19.5 12 L19 15.5 Z M8.5 19 Q16 25 23.5 19 L21 19.8 L20 21.6 L18 20.4 L16 22 L14 20.4 L12 21.6 L11 19.8 Z" />
        </svg>
      </button>
      {burst > 0 && (
        <span key={burst} className="hw-candies" aria-hidden>
          {["🍬", "🍭", "🍬", "🍫", "🍬"].map((c, i) => (
            <span key={i} style={{ "--x": `${(i - 2) * 15}px`, "--r": `${(i - 2) * 70}deg`, animationDelay: `${i * 40}ms` } as React.CSSProperties}>
              {c}
            </span>
          ))}
        </span>
      )}
      {msg && (
        <span role="status" className="hw-bubble">
          {msg}
        </span>
      )}
    </span>
  );
}
