"use client";

import "./hunt-effects.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { BEASTS, readOptions } from "@/lib/trollOptions";
import type { ActiveTroll } from "@/lib/titles";
import { Brasombre, ClawMarks } from "@/components/seasonal/chasseArt";

/* ---------------------------------------------------------------
   Assaut de Brasombre (Grand Veneur) : l'ombre de la wyverne passe,
   elle se pose en bas de l'écran, rugit (la page tremble) et laboure
   l'écran de ses griffes. Si le lanceur l'a permis, la cible la chasse
   à coups de clics ; sinon elle repart d'elle-même.
   --------------------------------------------------------------- */

// Délai entre deux assauts selon la fureur (s).
const GAP: Record<number, [number, number]> = { 1: [55, 80], 2: [32, 50], 3: [18, 28] };
const MAX_CLAWS = 9;

type Stage = "idle" | "shadow" | "land" | "roar" | "stay" | "hit" | "leave";
type Claw = { id: number; x: number; y: number; size: number; tilt: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function Assaut({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("assaut", troll.params, troll.level);
  const beast = BEASTS[o.beast] ?? BEASTS.braise;
  const need = o.fury * 2 + 1; // 3, 5 ou 7 coups pour la chasser
  const [stage, setStage] = useState<Stage>("idle");
  const [wave, setWave] = useState(0);
  const [side, setSide] = useState<"l" | "r">("r");
  const [left, setLeft] = useState(need);
  const [claws, setClaws] = useState<Claw[]>([]);
  const [pops, setPops] = useState<{ id: number; x: number }[]>([]);
  const stageRef = useRef<Stage>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(1);
  const reduce = useRef(false);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const go = useCallback((s: Stage) => {
    stageRef.current = s;
    setStage(s);
  }, []);

  const quake = useCallback(() => {
    if (reduce.current) return;
    const html = document.documentElement;
    html.classList.add("troll-quake");
    later(() => html.classList.remove("troll-quake"), 900);
  }, [later]);

  const slash = useCallback(
    (n: number) => {
      for (let i = 0; i < n; i++) {
        later(() => {
          const id = seq.current++;
          const size = rand(150, 300) * Math.min(1, Math.max(0.55, window.innerWidth / 900));
          setClaws((cs) => [...cs.slice(-(MAX_CLAWS - 1)), { id, x: rand(4, 82), y: rand(8, 62), size, tilt: rand(-35, 35) }]);
          later(() => setClaws((cs) => cs.filter((c) => c.id !== id)), 9000);
        }, i * 260);
      }
    },
    [later]
  );

  const leave = useCallback(() => {
    go("leave");
    later(() => go("idle"), 1400);
  }, [go, later]);

  // Un assaut : ombre, atterrissage, rugissement, griffes.
  const assault = useCallback(() => {
    if (stageRef.current !== "idle") return;
    setSide(Math.random() < 0.5 ? "l" : "r");
    setLeft(need);
    setWave((w) => w + 1);
    go("shadow");
    later(() => go("land"), 2300);
    later(() => {
      go("roar");
      quake();
      slash(o.fury + 1);
    }, 3200);
    later(() => {
      go("stay");
      if (!o.repel) later(() => stageRef.current === "stay" && leave(), 5000);
      else later(() => (stageRef.current === "stay" || stageRef.current === "hit") && leave(), 25_000);
    }, 4600);
  }, [need, go, later, quake, slash, o.fury, o.repel, leave]);

  useEffect(() => {
    reduce.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setTimeout>;
    const [a, b] = GAP[o.fury] ?? GAP[2];
    const loop = (ms: number) => {
      timer = setTimeout(() => {
        if (!document.hidden) assault();
        loop(rand(a, b) * 1000);
      }, ms);
    };
    loop(rand(1500, 4000));
    const all = timers.current;
    return () => {
      clearTimeout(timer);
      all.forEach(clearTimeout);
      document.documentElement.classList.remove("troll-quake");
    };
  }, [o.fury, assault]);

  function hit(e: React.MouseEvent) {
    if (!o.repel || (stageRef.current !== "stay" && stageRef.current !== "hit")) return;
    e.stopPropagation();
    const id = seq.current++;
    setPops((p) => [...p.slice(-4), { id, x: rand(30, 70) }]);
    later(() => setPops((p) => p.filter((x) => x.id !== id)), 800);
    const n = left - 1;
    setLeft(n);
    if (n <= 0) return leave();
    go("hit");
    later(() => stageRef.current === "hit" && go("stay"), 260);
  }

  const shown = stage === "land" || stage === "roar" || stage === "stay" || stage === "hit" || stage === "leave";
  const variant = o.beast === "braise" ? "" : `is-${o.beast}`;
  return (
    <div data-troll-ui className="ha-root" style={{ "--claw-glow": beast.glow, "--ha-glow": beast.glow } as React.CSSProperties}>
      <div className="ha-tint" aria-hidden />
      {claws.map((c) => (
        <ClawMarks key={c.id} className="ha-claw" style={{ left: `${c.x}vw`, top: `${c.y}vh`, width: c.size, height: c.size, transform: `rotate(${c.tilt}deg)` }} />
      ))}

      {stage === "shadow" && (
        <div key={`s${wave}`} className={`ha-pass ${side === "l" ? "is-ltr" : ""}`} aria-hidden>
          <div className="ha-pass-shadow" />
          <div className="ha-pass-beast">
            <Brasombre pose="fly" className={variant} />
          </div>
        </div>
      )}

      {shown && (
        <div key={`b${wave}`} className={`ha-beast is-${side} is-${stage} ${o.repel ? "is-repel" : ""}`} onClick={hit} role={o.repel ? "button" : undefined} aria-label={o.repel ? `Chasser Brasombre (encore ${left} coup${left > 1 ? "s" : ""})` : undefined}>
          <div className="ha-beast-art">
            <Brasombre pose={stage === "leave" ? "fly" : "perch"} className={variant} />
          </div>
          {stage === "roar" && <span className="ha-roar">RRRAAOOH !</span>}
          {o.message && (stage === "roar" || stage === "stay" || stage === "hit") && <span className="ha-msg">{o.message}</span>}
          {o.repel && (stage === "stay" || stage === "hit") && (
            <span className="ha-count">
              Chasse-la ! <b>{left}</b>
            </span>
          )}
          {pops.map((p) => (
            <span key={p.id} className="ha-pop" style={{ left: `${p.x}%` }}>
              Ouste !
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
