"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DragonSvg } from "@/components/titles/TitleVisuals";
import type { ActiveTroll } from "@/lib/titles";

const DURATION = 22; // secondes de combat
const DRAGON_HP = 12;
const HEARTS = 3;

type Phase = "intro" | "fight" | "result";
type Spot = { id: number; x: number; y: number; born: number };

/** Le dragon provoque en duel : combattre (viser les écailles, parer le souffle) ou fuir. */
export function DragonDuel({ troll, onDone }: { troll: ActiveTroll; onDone: () => void }) {
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>("intro");
  const [hp, setHp] = useState(DRAGON_HP);
  const [hearts, setHearts] = useState(HEARTS);
  const [left, setLeft] = useState(DURATION);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [breath, setBreath] = useState<null | { until: number; parried: boolean }>(null);
  const [result, setResult] = useState<"victoire" | "defaite" | null>(null);
  const [hitFx, setHitFx] = useState(0);
  const idRef = useRef(0);
  const sentRef = useRef(false);

  const send = useCallback(
    async (r: "victoire" | "defaite" | "fuite") => {
      if (sentRef.current) return;
      sentRef.current = true;
      await supabase.rpc("answer_troll", { p_id: troll.id, p_result: r });
    },
    [supabase, troll.id]
  );

  const finish = useCallback(
    (r: "victoire" | "defaite") => {
      setResult(r);
      setPhase("result");
      setSpots([]);
      setBreath(null);
      send(r);
    },
    [send]
  );

  // Combat : chrono, apparition des écailles, souffles.
  useEffect(() => {
    if (phase !== "fight") return;
    const start = Date.now();
    const tick = setInterval(() => {
      const t = DURATION - Math.floor((Date.now() - start) / 1000);
      setLeft(Math.max(0, t));
      if (t <= 0) finish("defaite");
    }, 250);
    const spawn = setInterval(() => {
      const now = Date.now();
      setSpots((s) => [
        ...s.filter((x) => now - x.born < 950),
        { id: ++idRef.current, x: 22 + Math.random() * 56, y: 22 + Math.random() * 46, born: now },
      ]);
    }, 620);
    let breathTimer: ReturnType<typeof setTimeout>;
    const nextBreath = () => {
      breathTimer = setTimeout(() => {
        setBreath({ until: Date.now() + 1300, parried: false });
        nextBreath();
      }, 2600 + Math.random() * 1800);
    };
    nextBreath();
    return () => {
      clearInterval(tick);
      clearInterval(spawn);
      clearTimeout(breathTimer);
    };
  }, [phase, finish]);

  // Souffle non paré à temps : un cœur en moins.
  useEffect(() => {
    if (!breath || breath.parried) return;
    const t = setTimeout(() => {
      setBreath(null);
      setHearts((h) => {
        const n = h - 1;
        if (n <= 0) finish("defaite");
        return n;
      });
    }, Math.max(0, breath.until - Date.now()));
    return () => clearTimeout(t);
  }, [breath, finish]);

  const parry = useCallback(() => {
    setBreath((b) => (b && !b.parried ? { ...b, parried: true } : b));
    setTimeout(() => setBreath((b) => (b?.parried ? null : b)), 350);
  }, []);

  useEffect(() => {
    if (phase !== "fight") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        parry();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, parry]);

  function hit(id: number) {
    setSpots((s) => s.filter((x) => x.id !== id));
    setHitFx((n) => n + 1);
    setHp((h) => {
      const n = h - 1;
      if (n <= 0) finish("victoire");
      return n;
    });
  }

  async function flee() {
    await send("fuite");
    onDone();
  }

  return (
    <div data-troll-ui className="dragon-duel fixed inset-0 z-[9300] flex flex-col items-center justify-center overflow-hidden p-4 text-paper">
      <div className="dragon-duel-sky absolute inset-0" />
      {phase === "intro" && <div className="dragon-duel-flyby absolute"><DragonSvg breathing /></div>}

      {phase === "intro" && (
        <div className="relative z-10 max-w-lg space-y-4 text-center">
          <p className="dragon-roar font-display text-5xl uppercase tracking-wider text-[#ffb15c] sm:text-6xl">ROOOAAAR</p>
          <p className="font-display text-2xl uppercase tracking-wide">
            {troll.actor} s&apos;est transformé en dragon !
          </p>
          <p className="font-body text-paper/85">
            {troll.everyone ? "Il provoque tout le S.I.D. en duel. Qui osera l'affronter ?" : "Il te provoque en duel. Combats-le… ou fuis."}
          </p>
          <p className="font-mono text-xs text-paper/60">
            Frappe les écailles qui brillent. Quand il prend son souffle, pare avec le bouclier (ou Espace).
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button onClick={() => setPhase("fight")} className="rounded-lg bg-gradient-to-r from-[#ff7a2f] to-[#b3121b] px-6 py-3 font-display text-lg uppercase tracking-wide text-ink shadow-lg shadow-red-900/50">
              ⚔️ Combattre
            </button>
            <button onClick={flee} className="rounded-lg border border-white/30 bg-black/40 px-6 py-3 font-display text-lg uppercase tracking-wide text-paper/80 hover:bg-white/10">
              🏃 Fuir
            </button>
          </div>
        </div>
      )}

      {phase === "fight" && (
        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-3">
          <div className="flex w-full items-center justify-between gap-3 font-mono text-sm">
            <span>{"❤️".repeat(Math.max(0, hearts))}{"🖤".repeat(Math.max(0, HEARTS - hearts))}</span>
            <span className="text-paper/70">{left} s</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-[#ff7a2f]/50 bg-black/50">
            <div className="h-full bg-gradient-to-r from-[#ffcf6b] via-[#ff6a1f] to-[#b3121b] transition-all" style={{ width: `${(hp / DRAGON_HP) * 100}%` }} />
          </div>
          <div className={`dragon-arena relative aspect-[3/2] w-full ${hitFx % 2 ? "dragon-hit-a" : "dragon-hit-b"}`}>
            <div className="dragon-arena-beast absolute inset-x-[8%] top-[4%]">
              <DragonSvg breathing={!!breath} />
            </div>
            {spots.map((s) => (
              <button
                key={s.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  hit(s.id);
                }}
                className="dragon-spot absolute"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                aria-label="Écaille"
              />
            ))}
            {breath && !breath.parried && <div className="dragon-breath-warning absolute inset-x-0 bottom-3 text-center font-display text-2xl uppercase text-[#ffd34d]">🔥 Souffle !</div>}
          </div>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              parry();
            }}
            className={`rounded-full border-2 px-8 py-3 font-display text-lg uppercase tracking-wide transition ${breath && !breath.parried ? "dragon-shield-ready border-[#ffd34d] bg-[#ffd34d] text-ink" : "border-white/30 bg-black/40 text-paper/70"}`}
          >
            🛡️ Bouclier
          </button>
        </div>
      )}

      {phase === "result" && (
        <div className="relative z-10 max-w-md space-y-4 text-center">
          <div className="text-7xl">{result === "victoire" ? "🗡️" : "🔥"}</div>
          <p className="font-display text-4xl uppercase tracking-wide text-[#ffb15c]">{result === "victoire" ? "Dragon terrassé !" : "Carbonisé…"}</p>
          <p className="font-body text-paper/85">
            {result === "victoire" ? `${troll.actor} retourne à sa forme humaine, la queue entre les jambes.` : `${troll.actor} règne sur les cendres. Ce sera pour la revanche.`}
          </p>
          <button onClick={onDone} className="rounded-lg border border-white/30 bg-black/40 px-6 py-2 font-display uppercase tracking-wide hover:bg-white/10">
            Continuer
          </button>
        </div>
      )}
    </div>
  );
}
