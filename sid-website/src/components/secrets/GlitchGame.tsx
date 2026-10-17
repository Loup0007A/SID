"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { announceTitlesChanged } from "@/lib/titles";

type Glyph = { id: number; ch: string; x: number; y: number; vx: number; vy: number };
type Phase = "idle" | "crack" | "play" | "won" | "lost";

const NOISE = "1235678989#@%&$?!".split("");
const TIME = 25;

/**
 * Sur une page introuvable, très rarement, le 404 se brise : il faut le
 * recoller en attrapant les chiffres 4-0-4 dans l'ordre parmi les débris.
 */
export function GlitchGame() {
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);
  const [progress, setProgress] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [left, setLeft] = useState(TIME);
  const [tries, setTries] = useState(3);
  const [msg, setMsg] = useState<string | null>(null);
  const idRef = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  const target = "404".repeat(level);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc("roll_glitch");
      const r = data as { result?: string; token?: string; level?: number } | null;
      if (r?.result === "game" && r.token) {
        setToken(r.token);
        setLevel(r.level ?? 1);
        setPhase("crack");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spawn = useCallback(
    (ch?: string): Glyph => {
      const speed = 0.25 + level * 0.12;
      return {
        id: ++idRef.current,
        ch: ch ?? (Math.random() < 0.45 ? (Math.random() < 0.5 ? "4" : "0") : NOISE[Math.floor(Math.random() * NOISE.length)]),
        x: 5 + Math.random() * 90,
        y: 8 + Math.random() * 84,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: (Math.random() - 0.5) * speed * 2,
      };
    },
    [level]
  );

  function start() {
    const n = 12 + level * 4;
    setGlyphs([spawn("4"), spawn("4"), spawn("0"), spawn("0"), ...Array.from({ length: n }, () => spawn())]);
    setProgress(0);
    setMistakes(0);
    setLeft(TIME);
    setMsg(null);
    setPhase("play");
  }

  // Mouvement et chrono.
  useEffect(() => {
    if (phase !== "play") return;
    const t0 = Date.now();
    const move = setInterval(() => {
      setGlyphs((gs) =>
        gs.map((g) => {
          let { x, y, vx, vy } = g;
          x += vx;
          y += vy;
          if (x < 2 || x > 96) vx = -vx;
          if (y < 4 || y > 94) vy = -vy;
          return { ...g, x: Math.min(96, Math.max(2, x)), y: Math.min(94, Math.max(4, y)), vx, vy };
        })
      );
      const l = TIME - Math.floor((Date.now() - t0) / 1000);
      setLeft(l);
      if (l <= 0) lose("Le temps est écoulé.");
    }, 40);
    return () => clearInterval(move);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function lose(text: string) {
    setPhase("lost");
    setTries((t) => t - 1);
    setMsg(text);
  }

  async function win() {
    setPhase("won");
    if (!token) return;
    const { data } = await supabase.rpc("claim_glitch", { p_token: token });
    const r = data as { result?: string; level?: number } | null;
    if (r?.result === "granted") setMsg("Le fantôme t'a reconnu. Un titre t'attend.");
    else if (r?.result === "upgraded") setMsg(`Le fantôme grandit : niveau ${r.level}.`);
    else setMsg("Le glitch s'est refermé.");
    announceTitlesChanged();
  }

  function pick(g: Glyph) {
    if (phase !== "play") return;
    const need = target[progress];
    if (g.ch === need) {
      const p = progress + 1;
      setProgress(p);
      setGlyphs((gs) => [...gs.filter((x) => x.id !== g.id), spawn(need === "4" ? "4" : "0")]);
      if (p >= target.length) win();
    } else {
      const m = mistakes + 1;
      setMistakes(m);
      box.current?.classList.remove("glitch-miss");
      void box.current?.offsetWidth;
      box.current?.classList.add("glitch-miss");
      if (m >= 3) lose("Trois erreurs : le glitch se referme.");
    }
  }

  if (phase === "idle") return null;

  return (
    <div className="glitch-game fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#07070c]/95 p-4 text-paper">
      {phase === "crack" && (
        <div className="space-y-4 text-center">
          <p className="glitch-title font-display text-7xl tracking-widest" data-text="404">404</p>
          <p className="font-body text-paper/80">Quelque chose bouge derrière la page…</p>
          <p className="font-mono text-xs text-paper/60">Attrape les chiffres 4 · 0 · 4 dans l&apos;ordre parmi les débris. Trois erreurs et le glitch se referme.</p>
          <button onClick={start} className="rounded-lg bg-gradient-to-r from-[#ff4df4] to-[#36e6ff] px-6 py-2 font-display uppercase tracking-wide text-ink">
            Recoller le 404
          </button>
        </div>
      )}

      {phase === "play" && (
        <>
          <div className="flex w-full max-w-2xl items-center justify-between font-mono text-sm">
            <span className="tracking-[0.3em]">
              {target.split("").map((c, i) => (
                <span key={i} className={i < progress ? "text-[#36e6ff]" : i === progress ? "text-paper underline" : "text-paper/30"}>
                  {c}
                </span>
              ))}
            </span>
            <span className="text-red">{"✕".repeat(mistakes)}</span>
            <span className="text-paper/60">{left} s</span>
          </div>
          <div ref={box} className="glitch-arena relative h-[60vh] w-full max-w-2xl overflow-hidden rounded-xl border border-[#ff4df4]/30">
            {glyphs.map((g) => (
              <button
                key={g.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(g);
                }}
                className="glitch-glyph absolute font-display text-3xl"
                style={{ left: `${g.x}%`, top: `${g.y}%` }}
              >
                {g.ch}
              </button>
            ))}
          </div>
        </>
      )}

      {(phase === "won" || phase === "lost") && (
        <div className="space-y-3 text-center">
          <p className="glitch-title font-display text-6xl" data-text={phase === "won" ? "OK" : "404"}>
            {phase === "won" ? "OK" : "404"}
          </p>
          {msg && <p className="font-body text-paper/85">{msg}</p>}
          {phase === "lost" && tries > 0 && (
            <button onClick={start} className="rounded-lg border border-white/30 px-5 py-2 font-display uppercase tracking-wide hover:bg-white/10">
              Réessayer ({tries})
            </button>
          )}
          <div>
            <button onClick={() => setPhase("idle")} className="font-mono text-xs uppercase text-paper/60 underline">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
