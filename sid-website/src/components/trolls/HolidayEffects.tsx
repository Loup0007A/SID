"use client";

import { useEffect, useRef, useState } from "react";
import { readOptions, FANFARE_TEMPOS, LOVE_COLORS } from "@/lib/trollOptions";
import type { ActiveTroll } from "@/lib/titles";
import { Bells, Bleuet, Dove, Egg, PaperFish, Patrouille } from "@/components/seasonal/drawings";

/**
 * Farces des titres de fête (Lot 44). Tout est posé dans des calques fixes ;
 * seules les choses qu'on doit attraper captent les clics.
 */

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Petite file d'objets éphémères (apparaît, vit, disparaît). */
function useEphemeral<T extends { id: number }>() {
  const [items, setItems] = useState<T[]>([]);
  const next = useRef(1);
  const add = (make: (id: number) => T, max = 40) => setItems((xs) => (xs.length >= max ? xs : [...xs, make(next.current++)]));
  const remove = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id));
  return { items, add, remove, setItems, next };
}

/* ---------------------------------------------------------------
   Coup de foudre (Cupidon Masqué)
   --------------------------------------------------------------- */
type Heart = { id: number; x: number; y?: number; size: number; color: string; t: number; burst?: { dx: number; dy: number } };

export function LoveStorm({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("coup_de_foudre", troll.params, troll.level);
  const palette = LOVE_COLORS[o.color].colors;
  const hearts = useEphemeral<Heart>();
  const [banner, setBanner] = useState(0);

  useEffect(() => {
    const rise = setInterval(() => hearts.add((id) => ({ id, x: rand(2, 96), size: rand(14, 34), color: pickOne(palette), t: rand(5, 9) }), 30), 650);
    const onDown = (e: PointerEvent) => {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rand(-0.3, 0.3);
        hearts.add((id) => ({ id, x: e.clientX, y: e.clientY, size: rand(12, 22), color: pickOne(palette), t: 1.1, burst: { dx: Math.cos(a) * rand(40, 90), dy: Math.sin(a) * rand(40, 90) - 30 } }), 60);
      }
    };
    window.addEventListener("pointerdown", onDown, { passive: true, capture: true });
    const name = o.name ? setInterval(() => setBanner((b) => b + 1), 25_000) : undefined;
    if (o.name) setTimeout(() => setBanner(1), 2500);
    return () => {
      clearInterval(rise);
      clearInterval(name);
      window.removeEventListener("pointerdown", onDown, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.color, o.name]);

  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      {hearts.items.map((h) => (
        <span
          key={h.id}
          className={h.burst ? "troll-heart-burst" : "troll-heart-rise"}
          style={
            {
              left: h.burst ? h.x : `${h.x}%`,
              top: h.burst ? h.y : undefined,
              fontSize: h.size,
              color: h.color,
              animationDuration: `${h.t}s`,
              "--dx": `${h.burst?.dx ?? rand(-60, 60)}px`,
              "--dy": `${h.burst?.dy ?? 0}px`,
            } as React.CSSProperties
          }
          onAnimationEnd={() => hearts.remove(h.id)}
        >
          ♥
        </span>
      ))}
      {banner > 0 && (
        <div key={banner} className="troll-love-banner" style={{ color: palette[0] }}>
          <span>♥</span> {troll.actor} <span>♥</span>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Poisson d'avril (Farceur d'Avril)
   --------------------------------------------------------------- */
const FISH_COLORS = ["#ff9a76", "#7fd8ff", "#ffd86b", "#c9a6ff", "#8ef0b8", "#ff8ab4"];
type Stuck = { id: number; x: number; y: number; r: number; color: string; peeling: boolean };
const FAKES = [
  "Ton compte vient d'être promu Fondateur du S.I.D.",
  "Tu as reçu 50 000 000 zénis de la Banque.",
  "Le dragon t'a choisi comme héritier.",
  "Ta quête « Sauver le S.I.D. » a été validée : +1 000 000 z.",
  "Les administrateurs t'ont nommé chef pour la journée.",
];

export function AprilFools({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("poisson", troll.params, troll.level);
  const fish = useEphemeral<Stuck>();
  const [fake, setFake] = useState<{ id: number; text: string; revealed: boolean } | null>(null);

  useEffect(() => {
    const make = (id: number): Stuck => ({ id, x: rand(4, 88), y: rand(10, 82), r: rand(-25, 25), color: pickOne(FISH_COLORS), peeling: false });
    fish.setItems(Array.from({ length: o.count }, () => make(fish.next.current++)));
    const refill = setInterval(() => {
      fish.setItems((xs) => {
        const live = xs.filter((x) => !x.peeling);
        return live.length < o.count ? [...xs, make(fish.next.current++)] : xs;
      });
    }, 20_000);
    let t: ReturnType<typeof setTimeout>;
    const fakeLoop = () => {
      const id = Date.now();
      setFake({ id, text: pickOne(FAKES), revealed: false });
      setTimeout(() => setFake((f) => (f && f.id === id ? { ...f, revealed: true } : f)), 2600);
      setTimeout(() => setFake((f) => (f && f.id === id ? null : f)), 5200);
      t = setTimeout(fakeLoop, rand(40_000, 70_000));
    };
    if (o.fake) t = setTimeout(fakeLoop, 6000);
    return () => {
      clearInterval(refill);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.count, o.fake]);

  function peel(id: number) {
    fish.setItems((xs) => xs.map((x) => (x.id === id ? { ...x, peeling: true } : x)));
    setTimeout(() => fish.remove(id), 900);
  }

  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      {fish.items.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-label="Décoller le poisson"
          onClick={() => peel(f.id)}
          className={`troll-stuck-fish pointer-events-auto ${f.peeling ? "is-peeling" : ""}`}
          style={{ left: `${f.x}%`, top: `${f.y}%`, "--r": `${f.r}deg` } as React.CSSProperties}
        >
          <i className="troll-tape" />
          <PaperFish color={f.color} />
        </button>
      ))}
      {fake && (
        <div className={`troll-fake-notif ${fake.revealed ? "is-revealed" : ""}`}>
          {fake.revealed ? (
            <>
              <strong>🐟 Poisson d&apos;avril !</strong> <span>signé {troll.actor}</span>
            </>
          ) : (
            <>
              <strong>🔔 Nouvelle notification</strong> <span>{fake.text}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Cloches de Pâques (Chasseur d'Œufs)
   --------------------------------------------------------------- */
type ChocoEgg = { id: number; x: number; hue: number; bottom: number; landed: boolean; eaten: boolean };

export function EasterBells({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("cloches", troll.params, troll.level);
  const eggs = useEphemeral<ChocoEgg>();
  const [flight, setFlight] = useState(0);
  const cols = useRef(new Map<number, number>());

  useEffect(() => {
    const every = [20, 12, 7][o.amount - 1] ?? 12;
    const drop = () => {
      setFlight((f) => f + 1);
      const n = 2 + o.amount;
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          const col = Math.floor(rand(1, 24));
          const h = cols.current.get(col) ?? 0;
          if (h > 7) return;
          cols.current.set(col, h + 1);
          eggs.add((id) => ({ id, x: col * 4, hue: Math.floor(rand(0, 6)), bottom: 4 + h * 20, landed: false, eaten: false }), 80);
        }, 1500 + i * rand(250, 700));
      }
    };
    const first = setTimeout(drop, 1200);
    const loop = setInterval(drop, every * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.amount]);

  function eat(e: ChocoEgg) {
    eggs.setItems((xs) => xs.map((x) => (x.id === e.id ? { ...x, eaten: true } : x)));
    const col = Math.round(e.x / 4);
    cols.current.set(col, Math.max(0, (cols.current.get(col) ?? 1) - 1));
    setTimeout(() => eggs.remove(e.id), 400);
  }

  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      {flight > 0 && (
        <div key={flight} className="troll-bells-fly">
          <Bells />
        </div>
      )}
      {eggs.items.map((e) => (
        <button
          key={e.id}
          type="button"
          aria-label="Croquer l'œuf"
          onClick={() => eat(e)}
          onAnimationEnd={() => eggs.setItems((xs) => xs.map((x) => (x.id === e.id ? { ...x, landed: true } : x)))}
          className={`troll-choco-egg pointer-events-auto ${e.landed ? "is-landed" : ""} ${e.eaten ? "is-eaten" : ""}`}
          style={{ left: `${e.x}%`, "--b": `${e.bottom}px` } as React.CSSProperties}
        >
          <Egg hue={e.hue} />
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Grève générale (Meneur du 1er Mai)
   --------------------------------------------------------------- */
type Picket = { id: number; el: Element; rect: DOMRect; until: number };
const SLOGANS = ["Plus de zénis !", "Non aux quêtes du lundi !", "Le dragon avec nous !", "Repos pour les boutons !", "On veut des pauses café !", "Grève illimitée (10 min)"];

export function GeneralStrike({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("greve", troll.params, troll.level);
  const [pickets, setPickets] = useState<Picket[]>([]);
  const [march, setMarch] = useState(0);
  const next = useRef(1);

  useEffect(() => {
    const every = [14, 9, 5][o.every - 1] ?? 9;
    const strike = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cands = [...document.querySelectorAll("a[href], button, [role=button], input[type=submit]")].filter((el) => {
        if (el.closest("[data-troll-ui]")) return false;
        const r = el.getBoundingClientRect();
        return r.width >= 28 && r.height >= 18 && r.top >= 0 && r.left >= 0 && r.bottom <= vh && r.right <= vw;
      });
      if (!cands.length) return;
      const el = pickOne(cands);
      setPickets((ps) => (ps.length >= 3 || ps.some((p) => p.el === el) ? ps : [...ps, { id: next.current++, el, rect: el.getBoundingClientRect(), until: Date.now() + rand(6000, 9000) }]));
    };
    const first = setTimeout(strike, 1500);
    const loop = setInterval(strike, every * 1000);
    const clean = setInterval(() => setPickets((ps) => ps.filter((p) => p.until > Date.now() && p.el.isConnected)), 500);
    let raf = 0;
    const follow = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPickets((ps) => ps.map((p) => ({ ...p, rect: p.el.getBoundingClientRect() }))));
    };
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    const m = o.placards ? setInterval(() => setMarch((x) => x + 1), 32_000) : undefined;
    if (o.placards) setTimeout(() => setMarch(1), 4000);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
      clearInterval(clean);
      clearInterval(m);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
  }, [o.every, o.placards]);

  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      {pickets.map((p) => (
        <div
          key={p.id}
          className="troll-picket pointer-events-auto"
          style={{ left: p.rect.left - 3, top: p.rect.top - 3, width: p.rect.width + 6, height: p.rect.height + 6 }}
          onClick={(e) => e.stopPropagation()}
          title="Ce bouton est en grève."
        >
          <span>EN GRÈVE ✊</span>
        </div>
      ))}
      {march > 0 && (
        <div key={march} className="troll-march">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="troll-placard" style={{ animationDelay: `${i * 0.18}s` }}>
              <span>{SLOGANS[(march + i) % SLOGANS.length]}</span>
              <i />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Fanfare (Maestro)
   --------------------------------------------------------------- */
type FloatNote = { id: number; x: number; y?: number; g: string; t: number; color: string; dx: number };
const NOTE_GLYPHS = ["♪", "♫", "♬", "♩"];
const NOTE_COLORS = ["#c9a6ff", "#ff9c6e", "#6ec8ff", "#ffe14d"];

export function Fanfare({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("fanfare", troll.params, troll.level);
  const beat = FANFARE_TEMPOS[o.tempo].ms;
  const notes = useEphemeral<FloatNote>();

  useEffect(() => {
    const root = document.documentElement;
    if (o.bounce) root.classList.add("troll-fanfare");
    root.style.setProperty("--beat", `${beat}ms`);
    const rise = setInterval(() => notes.add((id) => ({ id, x: rand(2, 96), g: pickOne(NOTE_GLYPHS), t: rand(5, 8), color: pickOne(NOTE_COLORS), dx: rand(-60, 60) }), 25), beat * 1.6);
    const onDown = (e: PointerEvent) => {
      for (let i = 0; i < 5; i++) notes.add((id) => ({ id, x: e.clientX, y: e.clientY, g: pickOne(NOTE_GLYPHS), t: 1.2, color: pickOne(NOTE_COLORS), dx: rand(-70, 70) }), 50);
    };
    window.addEventListener("pointerdown", onDown, { passive: true, capture: true });
    return () => {
      root.classList.remove("troll-fanfare");
      root.style.removeProperty("--beat");
      clearInterval(rise);
      window.removeEventListener("pointerdown", onDown, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.bounce, beat]);

  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      {notes.items.map((n) => (
        <span
          key={n.id}
          className={n.y != null ? "troll-note-burst" : "troll-note-rise"}
          style={{ left: n.y != null ? n.x : `${n.x}%`, top: n.y, color: n.color, animationDuration: `${n.t}s`, "--dx": `${n.dx}px` } as React.CSSProperties}
          onAnimationEnd={() => notes.remove(n.id)}
        >
          {n.g}
        </span>
      ))}
      <div className="troll-baton" aria-hidden>
        🎼
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Feu d'artifice (Artificier)
   --------------------------------------------------------------- */
type Burst = { id: number; x: number; y: number; color: string; size: number; n: number };
const FW_COLORS = ["#6ea8ff", "#ff5a5a", "#ffffff", "#ffd76a", "#ff7ad9", "#7dffb0"];

export function Fireworks({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("artifice", troll.params, troll.level);
  const bursts = useEphemeral<Burst>();
  const [jets, setJets] = useState(0);

  useEffect(() => {
    const every = [3000, 1800, 1000][o.intensity - 1] ?? 1800;
    const fire = () => {
      const k = o.intensity >= 3 && Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < k; i++) bursts.add((id) => ({ id, x: rand(8, 92), y: rand(10, 60), color: pickOne(FW_COLORS), size: rand(60, 130), n: 16 }), 12);
    };
    fire();
    const loop = setInterval(fire, every);
    const pat = o.patrouille ? setInterval(() => setJets((j) => j + 1), 35_000) : undefined;
    if (o.patrouille) setTimeout(() => setJets(1), 5000);
    return () => {
      clearInterval(loop);
      clearInterval(pat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.intensity, o.patrouille]);

  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      {bursts.items.map((b) => (
        <span key={b.id} className="troll-fw" style={{ left: `${b.x}%`, top: `${b.y}%`, "--c": b.color, "--r": `${b.size}px` } as React.CSSProperties}>
          <b className="troll-fw-rocket" />
          {Array.from({ length: b.n }, (_, i) => (
            <i key={i} style={{ "--a": `${(i * 360) / b.n}deg` } as React.CSSProperties} onAnimationEnd={i === 0 ? () => bursts.remove(b.id) : undefined} />
          ))}
        </span>
      ))}
      {jets > 0 && (
        <div key={jets} className="troll-patrouille">
          <Patrouille />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Trêve (Veilleur du Souvenir)
   --------------------------------------------------------------- */
export function Truce({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("treve", troll.params, troll.level);
  const [banner, setBanner] = useState(true);
  const [dove, setDove] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setBanner(false), 9000);
    const d = setInterval(() => setDove((x) => x + 1), 40_000);
    return () => {
      clearTimeout(t);
      clearInterval(d);
    };
  }, []);
  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      <div className="troll-truce-field">
        {Array.from({ length: 16 }, (_, i) => (
          <Bleuet key={i} style={{ left: `${(i * 6.4 + (i % 3)).toFixed(1)}%`, bottom: `${(i % 4) * 7}px`, width: `${18 + (i % 5) * 4}px`, animationDelay: `${i * 0.25}s` }} />
        ))}
      </div>
      <div key={dove} className="troll-truce-dove">
        <Dove />
      </div>
      {banner && (
        <div className="troll-truce-banner">
          <p>🕊️ {troll.actor} t&apos;offre une trêve</p>
          {o.message && <p className="troll-truce-msg">« {o.message} »</p>}
          <p className="troll-truce-note">Pendant ce temps, personne ne peut te viser d&apos;une autre farce.</p>
        </div>
      )}
    </div>
  );
}
