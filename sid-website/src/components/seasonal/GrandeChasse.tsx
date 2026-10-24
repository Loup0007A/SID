"use client";

import "./grande-chasse.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSiteDecor } from "@/components/seasonal/siteDecor";
import { Brasombre, Fang, HuntHorn, Pennant } from "@/components/seasonal/chasseArt";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * « La Grande Chasse » (Lot 46) : semaine des chasseurs autour du 11 mars.
 * Décor de crépuscule sur la vallée, campement et feu de camp, Brasombre (la
 * wyverne des cendres) perchée au loin puis qui survole la page, fanions de
 * chasse, cor au pied de page, tableau de chasse sur l'accueil.
 *
 * Ce module (et son CSS) n'est téléchargé que pendant l'événement : voir
 * Seasonal.tsx.
 */

/** Demande à Brasombre de repasser (le cor du pied de page, parfois). */
export const GC_CALL_EVENT = "sid:gc-call";
/** Émis par la chasse quand elle est réussie (le tableau se met à jour). */
export const GC_HUNT_DONE_EVENT = "sid:hunt-done";

// Pseudo-hasard stable (même rendu à chaque affichage).
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function useOn() {
  return !!useSiteDecor()?.grande_chasse;
}

/** La nuit à Paris (21 h – 6 h) : le campement passe au clair de lune. */
function parisNight() {
  try {
    const h = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).format(new Date()));
    return h >= 21 || h < 6;
  } catch {
    return false;
  }
}
function useNight(on: boolean) {
  const [night, setNight] = useState(false);
  useEffect(() => {
    if (!on) return setNight(false);
    setNight(parisNight());
    const t = setInterval(() => setNight(parisNight()), 5 * 60_000);
    return () => clearInterval(t);
  }, [on]);
  return night;
}

/* ---------------------------------------------------------------
   Décor de fond + survol
   --------------------------------------------------------------- */

function Campfire() {
  return (
    <div className="gc-camp" aria-hidden>
      <svg viewBox="0 0 360 120" className="gc-camp-svg">
        {/* Tentes */}
        <path className="gc-tent gc-tent-far" d="M210 112 L246 52 L282 112 Z" />
        <path className="gc-tent-door gc-tent-far-door" d="M240 112 L246 84 L252 112 Z" />
        <path className="gc-tent" d="M20 114 L66 40 L112 114 Z" />
        <path className="gc-tent-light" d="M58 114 L66 72 L74 114 Z" />
        <path className="gc-tent-pole" d="M66 40 L66 32 M246 52 L246 46" />
        {/* Râtelier : lance et arc */}
        <path className="gc-rack" d="M300 114 L300 70 M330 114 L330 70 M296 80 L334 80 M296 98 L334 98" />
        <path className="gc-spear" d="M308 114 L322 40 M322 40 L318 50 L326 50 Z" />
        <path className="gc-bow" d="M338 46 C350 66 350 92 338 112 M338 46 L338 112" />
        {/* Mât et fanion */}
        <path className="gc-pole" d="M150 114 L150 30" />
        <path className="gc-flag" d="M150 32 L186 38 L176 46 L188 54 L150 56 Z" />
        {/* Feu */}
        <path className="gc-log" d="M146 114 L190 102 M150 102 L192 114" />
        <g className="gc-fire">
          <path className="gc-flame gc-flame-a" d="M170 110 C158 96 164 84 170 74 C172 86 182 90 180 104 C179 108 175 111 170 110 Z" />
          <path className="gc-flame gc-flame-b" d="M168 110 C162 102 164 94 168 88 C170 96 176 98 175 106 C174 109 171 111 168 110 Z" />
          <path className="gc-flame gc-flame-c" d="M176 110 C172 104 174 98 178 94 C179 100 183 102 182 107 C181 109 179 110 176 110 Z" />
        </g>
        <ellipse className="gc-fire-glow" cx="170" cy="108" rx="70" ry="18" />
        {/* Marmite */}
        <path className="gc-pot-stand" d="M150 112 L170 66 L190 112" />
        <path className="gc-pot" d="M160 86 L180 86 C182 96 178 102 170 102 C162 102 158 96 160 86 Z" />
      </svg>
      <div className="gc-sparks">
        {Array.from({ length: 10 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${46 + rnd(i, 1) * 10}%`,
              animationDelay: `${(-rnd(i, 2) * 3).toFixed(2)}s`,
              animationDuration: `${(2 + rnd(i, 3) * 2).toFixed(2)}s`,
              ["--dx" as string]: `${((rnd(i, 4) - 0.5) * 60).toFixed(0)}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ChasseBack() {
  const ash = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: `${(rnd(i, 1) * 100).toFixed(1)}%`,
        size: 2 + rnd(i, 2) * 3,
        dur: 9 + rnd(i, 3) * 10,
        delay: -rnd(i, 4) * 18,
        dx: (rnd(i, 5) - 0.5) * 120,
        warm: rnd(i, 6) > 0.35,
      })),
    []
  );
  return (
    <>
      <div className="gc-sky" />
      <div className="gc-stars">
        {Array.from({ length: 26 }, (_, i) => (
          <i key={i} style={{ left: `${(rnd(i, 7) * 100).toFixed(1)}%`, top: `${(rnd(i, 8) * 38).toFixed(1)}%`, animationDelay: `${(-rnd(i, 9) * 4).toFixed(2)}s` }} />
        ))}
      </div>
      <div className="gc-stars gc-stars-night">
        {Array.from({ length: 40 }, (_, i) => (
          <i key={i} style={{ left: `${(rnd(i + 50, 7) * 100).toFixed(1)}%`, top: `${(rnd(i + 50, 8) * 55).toFixed(1)}%`, animationDelay: `${(-rnd(i + 50, 9) * 4).toFixed(2)}s` }} />
        ))}
      </div>
      <div className="gc-sun" />
      <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" className="gc-land" aria-hidden>
        <path className="gc-mount-far" d="M0 190 L90 150 L160 172 L260 108 L330 150 L420 128 L520 160 L600 120 L700 150 L780 96 L860 140 L960 118 L1050 150 L1120 126 L1200 146 L1200 300 L0 300 Z" />
        {/* Volcan */}
        <path className="gc-volcano" d="M760 230 L880 112 L906 104 L930 112 L1040 230 Z" />
        <path className="gc-crater" d="M884 112 C892 104 920 104 928 112 C920 116 892 116 884 112 Z" />
        <path className="gc-lava" d="M904 114 C900 136 910 150 902 176 C912 158 916 140 912 116 Z" />
        <path className="gc-mount-mid" d="M0 228 L120 186 L210 214 L300 170 L400 204 L520 176 L620 214 L720 190 L800 222 L900 198 L1000 226 L1120 196 L1200 214 L1200 300 L0 300 Z" />
        {/* Éperon où se tient Brasombre */}
        <path className="gc-cliff" d="M1010 300 L1030 214 L1062 196 L1100 192 L1124 204 L1140 300 Z" />
        <g className="gc-perched" transform="translate(1004 116)">
          <Brasombre pose="perch" width={132} height={88} />
        </g>
        <path className="gc-mount-near" d="M0 262 C120 246 240 268 380 254 C520 240 640 266 780 252 C900 240 1020 262 1200 248 L1200 300 L0 300 Z" />
        {Array.from({ length: 60 }, (_, i) => {
          const x = i * 20 + rnd(i, 1) * 12;
          const h = 8 + rnd(i, 2) * 14;
          return <path key={i} className="gc-grass" d={`M${x} 300 L${x + 2} ${300 - h} L${x + 4} 300 Z M${x + 6} 300 L${x + 9} ${300 - h * 0.7} L${x + 10} 300 Z`} />;
        })}
      </svg>
      <div className="gc-smoke" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <Campfire />
      <div className="gc-ash" aria-hidden>
        {ash.map((a, i) => (
          <i
            key={i}
            className={a.warm ? "is-warm" : ""}
            style={{ left: a.left, width: a.size, height: a.size, animationDuration: `${a.dur.toFixed(1)}s`, animationDelay: `${a.delay.toFixed(1)}s`, ["--dx" as string]: `${a.dx.toFixed(0)}px` }}
          />
        ))}
      </div>
    </>
  );
}

export function ChasseDecor() {
  const on = useOn();
  const night = useNight(on);
  const [mounted, setMounted] = useState(false);
  const [fly, setFly] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("gc-nuit", on && night);
    return () => root.classList.remove("gc-nuit");
  }, [on, night]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.classList.add("decor-grande_chasse");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!reduce) {
      try {
        if (!sessionStorage.getItem("sid-gc-fly")) {
          sessionStorage.setItem("sid-gc-fly", "1");
          t = setTimeout(() => setFly(Date.now()), 1600);
        }
      } catch {
        t = setTimeout(() => setFly(Date.now()), 1600);
      }
    }
    const call = () => !reduce && setFly(Date.now());
    window.addEventListener(GC_CALL_EVENT, call);
    return () => {
      clearTimeout(t);
      window.removeEventListener(GC_CALL_EVENT, call);
      root.classList.remove("decor-grande_chasse", "gc-rumble");
    };
  }, [on]);

  // Le passage : la page tremble un instant quand Brasombre passe au-dessus.
  useEffect(() => {
    if (!fly) return;
    const root = document.documentElement;
    const a = setTimeout(() => root.classList.add("gc-rumble"), 3000);
    const b = setTimeout(() => root.classList.remove("gc-rumble"), 3700);
    const c = setTimeout(() => setFly(0), 7600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      clearTimeout(c);
      root.classList.remove("gc-rumble");
    };
  }, [fly]);

  if (!mounted || !on) return null;
  return createPortal(
    <>
      <div className="gc-back" aria-hidden>
        <ChasseBack />
      </div>
      <div className="gc-front" aria-hidden>
        {fly > 0 && (
          <div key={fly}>
            <div className="gc-shadow" />
            <div className="gc-flyover">
              <Brasombre pose="fly" />
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

/* ---------------------------------------------------------------
   Guirlande de fanions sous la barre du haut
   --------------------------------------------------------------- */

export function ChasseGarland() {
  const on = useOn();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
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

  const small = width < 640;
  const swag = small ? 130 : 180;
  const n = Math.ceil(width / swag);
  const sag = small ? 8 : 12;
  const per = small ? 4 : 6;
  let wire = "M0 1";
  const items: { x: number; y: number; r: number; i: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * swag;
    wire += ` Q${x0 + swag / 2} ${1 + sag * 2} ${x0 + swag} 1`;
    for (let k = 1; k <= per; k++) {
      const t = k / (per + 1);
      const slope = (4 * sag * (1 - 2 * t)) / swag;
      items.push({ x: x0 + swag * t, y: 1 + 4 * sag * t * (1 - t), r: (Math.atan(slope) * 180) / Math.PI, i: i * per + k });
    }
  }
  return (
    <div ref={box} className="nl-garland-box" aria-hidden>
      <svg className="nl-garland gc-garland" width={width} height={sag * 2 + 30} viewBox={`0 0 ${width} ${sag * 2 + 30}`}>
        <path d={wire} className="gc-rope" />
        {items.map((it) => (
          <g key={it.i} transform={`translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${it.r.toFixed(1)})`} className="gc-g-item" style={{ animationDelay: `${((it.i * 0.37) % 2.6).toFixed(2)}s` }}>
            {it.i % 3 === 2 ? <Fang /> : <Pennant variant={Math.floor(it.i / 3)} />}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------
   Phrase d'accueil
   --------------------------------------------------------------- */

const NIGHT_GREETINGS = [
  "La nuit est tombée sur le campement. Lève les yeux : ce soir, le ciel bouge.",
  "Le feu baisse, les étoiles montent. Il paraît qu'elles tombent, certaines nuits de chasse.",
  "Nuit de veille au campement. Garde un œil sur le ciel, chasseur.",
];

const GREETINGS = [
  "La Grande Chasse est ouverte ! Des traces fraîches griffent les pages du S.I.D.…",
  "Brasombre rôde autour des archives. Affûtez vos lames, chasseurs.",
  "Semaine de la Grande Chasse : suivez les pistes, et bonne traque !",
  "Le feu de camp est allumé. Ce soir, on chasse la wyverne des cendres.",
];

function parisDay() {
  const p = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return { month: p.getMonth() + 1, day: p.getDate() };
}

export function ChasseGreeting() {
  const on = useOn();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!on) return setText(null);
    const { month, day } = parisDay();
    const pool = parisNight() ? NIGHT_GREETINGS : GREETINGS;
    setText(month === 3 && day === 11 && !parisNight() ? "Grand jour de chasse : le cor sonne pour l'anniversaire de la Grande Chasse !" : pool[Math.floor(Math.random() * pool.length)]);
  }, [on]);
  if (!on || !text) return null;
  return <p className="gc-greeting mt-1 font-body text-sm italic">{text}</p>;
}

/* ---------------------------------------------------------------
   Cor de chasse du pied de page
   --------------------------------------------------------------- */

const HORN_LINES = [
  "Le cor résonne dans la vallée… quelque chose lui répond.",
  "Trois sonneries courtes : la chasse est ouverte !",
  "Au loin, Brasombre relève la tête.",
  "Les braises du camp crépitent. Bonne chasse !",
  "Un chasseur ne rentre jamais bredouille. Enfin, presque jamais.",
];

export function ChasseFooter() {
  const on = useOn();
  const [msg, setMsg] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  if (!on) return null;
  return (
    <span className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label="Sonner du cor de chasse"
        onClick={() => {
          const answer = Math.random() < 0.3;
          setMsg(answer ? "Le cor résonne… et Brasombre répond ! Regarde en l'air." : HORN_LINES[Math.floor(Math.random() * HORN_LINES.length)]);
          setBurst((b) => b + 1);
          if (answer) window.dispatchEvent(new Event(GC_CALL_EVENT));
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setMsg(null), 3200);
        }}
        className={`gc-horn ${burst ? "is-open" : ""}`}
      >
        <HuntHorn />
      </button>
      {burst > 0 && (
        <span key={burst} className="gc-horn-wave" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      )}
      {msg && (
        <span role="status" className="hd-bubble gc-bubble">
          {msg}
        </span>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------
   Tableau de chasse (accueil du Dossier Central)
   --------------------------------------------------------------- */

type Board = { today: number; week: number; hunters: number; mine: number; mine_today: boolean; top: { nickname: string; days: number; hunts: number }[] };

const TIPS = [
  "Les traces se cachent dans les recoins des pages : bords, bas de l'écran…",
  "Une piste mène à la suivante. Change de page pour la retrouver.",
  "Les points faibles brillent : vise-les vite, ils ne restent pas.",
  "Quand Brasombre recule en grondant, prépare-toi à esquiver.",
  "Une chasse par jour suffit. Reviens demain pour la suivante.",
];

function useCountdown() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const { month, day } = parisDay();
    if (month !== 3 || day > 15 || day < 9) return setLabel(null);
    const left = 15 - day;
    setLabel(left === 0 ? "dernier jour" : `encore ${left + 1} jours`);
  }, []);
  return label;
}

export function ChasseBoard() {
  const on = useOn();
  const [board, setBoard] = useState<Board | null>(null);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const countdown = useCountdown();

  useEffect(() => {
    if (!on) return;
    const supabase = createClient();
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.rpc("grande_chasse_board");
      if (alive && !error && data) setBoard(data as Board);
    };
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener(GC_HUNT_DONE_EVENT, load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener(GC_HUNT_DONE_EVENT, load);
    };
  }, [on]);

  if (!on) return null;
  const mine = Math.min(board?.mine ?? 0, 3);
  return (
    <section className="gc-board" aria-label="Tableau de chasse">
      <header className="gc-board-head">
        <span className="gc-board-title"><SidIcon name="bow" /> Tableau de chasse</span>
        <span className="gc-board-sub">La Grande Chasse · du 9 au 15 mars{countdown ? ` · ${countdown}` : ""}</span>
      </header>
      <div className="gc-board-grid">
        <div className="gc-note">
          <p className="gc-note-title">Tes trophées</p>
          <div className="gc-trophies" aria-label={`${mine} jour${mine > 1 ? "s" : ""} de chasse réussi${mine > 1 ? "s" : ""} sur 3`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`gc-trophy ${i < mine ? "is-won" : ""}`}>
                <svg viewBox="0 0 40 40" aria-hidden>
                  <circle cx="20" cy="20" r="17" className="gc-trophy-ring" />
                  <path className="gc-trophy-mark" d="M13 11 L16 29 M20 9 L20 30 M27 11 L24 29" />
                </svg>
              </span>
            ))}
          </div>
          <p className="gc-note-text">
            {mine >= 3
              ? "Trois chasses réussies : la vallée te salue, Grand Veneur."
              : board?.mine_today
                ? "Chasse du jour réussie. Reviens demain pour la suivante."
                : "Des traces t'attendent quelque part sur le site…"}
          </p>
        </div>
        <div className="gc-note">
          <p className="gc-note-title">Au S.I.D. cette semaine</p>
          <ul className="gc-stats">
            <li>
              <strong>{board?.today ?? "…"}</strong> chasse{(board?.today ?? 0) > 1 ? "s" : ""} réussie{(board?.today ?? 0) > 1 ? "s" : ""} aujourd&apos;hui
            </li>
            <li>
              <strong>{board?.week ?? "…"}</strong> depuis l&apos;ouverture
            </li>
            <li>
              <strong>{board?.hunters ?? "…"}</strong> chasseur{(board?.hunters ?? 0) > 1 ? "s" : ""} en piste
            </li>
          </ul>
        </div>
        <div className="gc-note">
          <p className="gc-note-title">Meilleurs chasseurs</p>
          {board && board.top.length > 0 ? (
            <ol className="gc-top">
              {board.top.map((t, i) => (
                <li key={t.nickname + i}>
                  <span className="gc-rank">{i < 3 ? <SidIcon name={(["podium1", "podium2", "podium3"] as const)[i]} /> : `${i + 1}.`}</span>
                  <span className="gc-name">{t.nickname}</span>
                  <span className="gc-score">
                    {t.days} j · {t.hunts} chasse{t.hunts > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="gc-note-text">Personne n&apos;a encore ramené de trophée. Sois le premier !</p>
          )}
        </div>
      </div>
      <footer className="gc-board-foot">
        <span><SidIcon name="bulb" /> {tip}</span>
        <Link href="/dashboard/titles" scroll={false} className="gc-board-link">
          Les titres de la saison →
        </Link>
      </footer>
    </section>
  );
}
