"use client";

import { useEffect, useRef, useState } from "react";
import { readOptions } from "@/lib/trollOptions";
import type { ActiveTroll } from "@/lib/titles";

/* ---------------------------------------------------------------
   Dessins partagés (effets et aperçus du panneau d'options)
   --------------------------------------------------------------- */

const WING = "M32 17 C27 9 17 6 5 10 C9 12 10.5 15 9.5 19.5 C13 16.5 16.5 17.5 18.5 21.5 C20.5 17.5 24 17.5 27 20.5 C28.5 18.5 30 17.8 32 18.6 Z";

export function BatShape({ className = "", style, folded = false }: { className?: string; style?: React.CSSProperties; folded?: boolean }) {
  return (
    <svg viewBox="0 0 64 32" className={`ev-bat-shape ${folded ? "is-folded" : ""} ${className}`} style={style} aria-hidden>
      <g className="ev-bat-wing ev-bat-wing-l">
        <path d={WING} />
      </g>
      <g className="ev-bat-wing ev-bat-wing-r">
        <path d={WING} transform="translate(64 0) scale(-1 1)" />
      </g>
      <ellipse cx="32" cy="18" rx="3.6" ry="5.6" />
      <path d="M29.6 13.4 L30.4 9.2 L31.6 12.6 Z M34.4 13.4 L33.6 9.2 L32.4 12.6 Z" />
      <circle cx="30.9" cy="15.6" r="0.6" className="ev-bat-eye" />
      <circle cx="33.1" cy="15.6" r="0.6" className="ev-bat-eye" />
    </svg>
  );
}

/** Couches de neige (le nombre et la vitesse dépendent de l'intensité). */
export function SnowLayers({ intensity, className = "" }: { intensity: number; className?: string }) {
  return (
    <div className={`troll-snow troll-snow-i${intensity} ${className}`} aria-hidden>
      <div className="troll-snow-layer troll-snow-a" />
      <div className="troll-snow-layer troll-snow-b" />
      {intensity >= 2 && <div className="troll-snow-layer troll-snow-c" />}
    </div>
  );
}

/* ---------------------------------------------------------------
   Nuée (Maître des Chauves-Souris) : nuées qui traversent l'écran,
   chauves-souris accrochées en haut de la page qu'il faut chasser.
   --------------------------------------------------------------- */

const SWARM = [
  { every: 24, size: 8 },
  { every: 16, size: 14 },
  { every: 10, size: 22 },
];

type Hanger = { id: number; x: number; y: number; leaving: boolean };

export function BatSwarm({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("nuee", troll.params, troll.level);
  const spec = SWARM[o.density - 1] ?? SWARM[1];
  const [wave, setWave] = useState(0);
  const [hangers, setHangers] = useState<Hanger[]>([]);
  const next = useRef(1);

  // Une nuée toutes les N secondes.
  useEffect(() => {
    setWave(1);
    const t = setInterval(() => setWave((w) => w + 1), spec.every * 1000);
    return () => clearInterval(t);
  }, [spec.every]);

  // Les chauves-souris accrochées : une chassée revient s'accrocher un peu plus tard.
  useEffect(() => {
    const spawn = (): Hanger => ({ id: next.current++, x: 6 + Math.random() * 86, y: 2 + Math.random() * 16, leaving: false });
    setHangers(Array.from({ length: o.hanging }, spawn));
    if (!o.hanging) return;
    const t = setInterval(() => {
      setHangers((hs) => {
        const staying = hs.filter((h) => !h.leaving);
        return staying.length < o.hanging ? [...staying, spawn()] : staying;
      });
    }, 25_000);
    return () => clearInterval(t);
  }, [o.hanging]);

  function shoo(id: number) {
    setHangers((hs) => hs.map((h) => (h.id === id ? { ...h, leaving: true } : h)));
    setTimeout(() => setHangers((hs) => hs.filter((h) => h.id !== id)), 1200);
  }

  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      {wave > 0 &&
        Array.from({ length: spec.size }, (_, i) => (
          <BatShape
            key={`${wave}-${i}`}
            className="troll-bat-fly"
            style={
              {
                top: `${8 + ((i * 37 + wave * 13) % 70)}%`,
                "--d": `${(i % 7) * 0.18}s`,
                "--s": 0.55 + ((i * 7) % 5) * 0.12,
                "--y": `${((i * 29) % 60) - 30}px`,
                "--t": `${4.5 + (i % 4) * 0.6}s`,
              } as React.CSSProperties
            }
          />
        ))}
      {hangers.map((h) => (
        <button
          key={h.id}
          type="button"
          aria-label="Chasser la chauve-souris"
          onClick={() => shoo(h.id)}
          className={`troll-bat-hang pointer-events-auto ${h.leaving ? "is-leaving" : ""}`}
          style={{ left: `${h.x}%`, top: `${h.y}vh` }}
        >
          <BatShape folded={!h.leaving} />
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Blizzard (Lutin Clandestin) : tempête de neige, givre qui envahit
   l'écran ; frotter (souris, doigt) le fait fondre.
   --------------------------------------------------------------- */

export function Blizzard({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("blizzard", troll.params, troll.level);
  const frost = useRef(0);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!o.frost) return;
    const grow = [0.005, 0.008, 0.0134][o.intensity - 1] ?? 0.008; // plein givre en ~60, 45, 30 s
    const max = [0.75, 0.9, 1][o.intensity - 1] ?? 0.9;
    let last: { x: number; y: number } | null = null;
    const paint = () => el.current?.style.setProperty("--frost", frost.current.toFixed(3));
    const rub = (x: number, y: number) => {
      if (last) frost.current = Math.max(0, frost.current - Math.hypot(x - last.x, y - last.y) / 2600);
      last = { x, y };
    };
    const onMove = (e: PointerEvent) => rub(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => e.touches[0] && rub(e.touches[0].clientX, e.touches[0].clientY);
    const tick = setInterval(() => {
      frost.current = Math.min(max, frost.current + grow);
      paint();
    }, 400);
    const fast = setInterval(paint, 120);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      clearInterval(tick);
      clearInterval(fast);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [o.frost, o.intensity]);

  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      <SnowLayers intensity={o.intensity} />
      {o.frost && <div ref={el} className="troll-frost" style={{ "--frost": 0 } as React.CSSProperties} />}
    </div>
  );
}
