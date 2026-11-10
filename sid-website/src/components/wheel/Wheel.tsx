"use client";

import "./wheel.css";
import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { RARITY, pct, prizeText, segmentText, type WheelPrize, type WheelResult, type WheelStatus } from "@/types/wheel";

/**
 * La roue du jour (Lot 76) : chaque part est proportionnelle à la chance du
 * gain pour la série du membre. Le tirage se fait côté serveur (wheel_spin) ;
 * la roue s'arrête ensuite sur la part gagnée.
 */

const C = 100;
const R = 88;

type Seg = { p: WheelPrize; a0: number; a1: number; i: number };

function segments(prizes: WheelPrize[]): Seg[] {
  const total = prizes.reduce((s, p) => s + Number(p.probability), 0) || 1;
  let a = 0;
  return prizes.map((p, i) => {
    const sweep = (Number(p.probability) / total) * 360;
    const seg = { p, a0: a, a1: a + sweep, i };
    a += sweep;
    return seg;
  });
}

const pt = (deg: number, r: number) => {
  const t = (deg * Math.PI) / 180;
  return [C + r * Math.sin(t), C - r * Math.cos(t)] as const;
};

function slicePath(a0: number, a1: number) {
  if (a1 - a0 >= 359.99) return `M${C} ${C - R}A${R} ${R} 0 1 1 ${C - 0.01} ${C - R}Z`;
  const [x0, y0] = pt(a0, R);
  const [x1, y1] = pt(a1, R);
  return `M${C} ${C}L${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
}

const short = (s: string) => (s.length > 13 ? `${s.slice(0, 12)}…` : s);

/** Angle (dans le repère de la roue) où doit s'arrêter le pointeur pour ce gain. */
function targetAngle(segs: Seg[], id: string | null) {
  const s = segs.find((x) => x.p.id === id);
  if (!s) return Math.random() * 360;
  const span = s.a1 - s.a0;
  return s.a0 + span / 2 + (Math.random() - 0.5) * span * 0.6;
}

export function WheelDisc({
  prizes,
  rotation,
  still,
  spinning,
  won,
  onHub,
  hubLabel,
  hubDisabled,
}: {
  prizes: WheelPrize[];
  rotation: number;
  still: boolean;
  spinning: boolean;
  won: string | null;
  onHub?: () => void;
  hubLabel: string;
  hubDisabled: boolean;
}) {
  const segs = useMemo(() => segments(prizes), [prizes]);
  return (
    <div className={clsx("wheel-stage", spinning && "is-spinning", won && !spinning && "is-won")}>
      <svg viewBox="-6 -6 212 212" role="img" aria-label="Roue du jour">
        <defs>
          <radialGradient id="wheel-shade" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
          </radialGradient>
          <filter id="wheel-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        {/* Jante */}
        <circle cx={C} cy={C} r={99} fill="#1b1628" stroke="#f0c27a" strokeOpacity="0.55" strokeWidth="1.5" />
        <g>
          {Array.from({ length: 24 }, (_, i) => {
            const [x, y] = pt(i * 15, 94);
            return <circle key={i} className="wheel-bulb" cx={x} cy={y} r={2.1} />;
          })}
        </g>

        <g className={clsx("wheel-disc", still && "is-still")} style={{ transform: `rotate(${rotation}deg)` }}>
          {segs.map((s) => {
            const r = RARITY[s.p.rarity];
            const sweep = s.a1 - s.a0;
            const mid = (s.a0 + s.a1) / 2;
            const isWon = won === s.p.id && !spinning;
            return (
              <g key={s.p.id}>
                <path
                  d={slicePath(s.a0, s.a1)}
                  fill={s.p.kind === "rien" ? "#22202e" : s.i % 2 ? r.alt : r.fill}
                  stroke="#14111f"
                  strokeWidth="0.8"
                />
                {(s.p.rarity === "legendaire" || s.p.rarity === "epique") && sweep < 300 && (
                  <path d={slicePath(s.a0, s.a1)} fill="none" stroke={r.ring} strokeWidth="1.2" strokeOpacity="0.9" />
                )}
                {isWon && <path d={slicePath(s.a0, s.a1)} fill="#fff" opacity="0.18" />}
                {sweep >= 13 && (
                  <g transform={`rotate(${mid} ${C} ${C})`}>
                    <text
                      x={C}
                      y={C - R * 0.56}
                      // Moitié gauche : texte retourné pour rester lisible.
                      transform={`rotate(${mid > 180 ? 90 : -90} ${C} ${C - R * 0.56})`}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={sweep >= 24 ? 8.2 : 7}
                      fontFamily="var(--font-display), sans-serif"
                      letterSpacing="0.02em"
                      fill={s.p.kind === "rien" ? "rgba(230,236,248,0.55)" : r.text}
                    >
                      {short(segmentText(s.p))}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          <circle cx={C} cy={C} r={R} fill="url(#wheel-shade)" pointerEvents="none" />
        </g>

        {/* Moyeu : bouton « Tourner » */}
        <g
          className="wheel-hub"
          role="button"
          tabIndex={hubDisabled ? -1 : 0}
          aria-disabled={hubDisabled}
          aria-label={hubLabel}
          onClick={() => !hubDisabled && onHub?.()}
          onKeyDown={(e) => {
            if (!hubDisabled && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onHub?.();
            }
          }}
        >
          <circle cx={C} cy={C} r={19} fill="#262a38" stroke="#f0c27a" strokeWidth="2" />
          <circle cx={C} cy={C} r={14.5} fill={hubDisabled ? "#3a3f52" : "#ff4f5e"} />
          <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize="7" fontFamily="var(--font-display), sans-serif" fill="#fff" letterSpacing="0.05em">
            {hubLabel.length > 8 ? "" : hubLabel.toUpperCase()}
          </text>
        </g>

        {/* Pointeur fixe */}
        <g className="wheel-pointer">
          <path d="M91 -3h18l-9 17z" fill="#ff4f5e" stroke="#14111f" strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx={C} cy={1} r={2.2} fill="#fff" opacity="0.8" />
        </g>
        {won && !spinning && <circle cx={C} cy={C} r={99} fill="none" stroke="#ffe27a" strokeWidth="2" filter="url(#wheel-glow)" opacity="0.7" />}
      </svg>
    </div>
  );
}

export function StreakMeter({ streak, cap }: { streak: number; cap: number }) {
  const week = Math.min(7, streak);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-lg uppercase text-paper">
          Série : {streak} jour{streak > 1 ? "s" : ""}
        </p>
        <p className="font-mono text-[11px] text-paper/55">{streak >= cap ? "chances maximales" : `maximum à ${cap} jours`}</p>
      </div>
      <div className="wheel-streak" aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className={i < week ? "is-on" : ""} />
        ))}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progression de la série" aria-valuemin={1} aria-valuemax={cap} aria-valuenow={Math.min(streak, cap)}>
        <div className="h-full rounded-full bg-[#f0c27a]" style={{ width: `${(Math.min(streak, cap) / cap) * 100}%` }} />
      </div>
    </div>
  );
}

export function ResultCard({ r }: { r: WheelResult }) {
  const rar = RARITY[r.rarity];
  const nothing = r.kind === "rien";
  return (
    <div
      className={clsx("wheel-result rounded-xl border p-4 text-center", `is-${r.rarity}`)}
      style={{ borderColor: nothing ? "rgba(255,255,255,0.15)" : rar.ring, background: nothing ? "rgba(255,255,255,0.03)" : `${rar.fill}26` }}
      role="status"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: nothing ? "rgba(237,230,211,0.6)" : rar.ring }}>
        {nothing ? "Pas de chance" : rar.label}
      </p>
      <p className="font-display text-2xl uppercase text-paper">{nothing ? "Rien cette fois" : prizeText(r)}</p>
      <p className="font-body text-xs text-paper/60">
        {nothing
          ? "Reviens demain : ta série continue."
          : r.kind === "objet"
            ? "L'objet t'attend dans tes achats, livré comme un achat normal."
            : r.kind === "titre"
              ? "Le titre est dans ta collection."
              : "Déjà sur ton compte."}
        {r.probability != null && ` · ${pct(r.probability)} de chances`}
      </p>
    </div>
  );
}

/** La roue, son bouton et le résultat. */
export function WheelPanel({ status, onSpun }: { status: WheelStatus; onSpun?: (r: WheelResult) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const segs = useMemo(() => segments(status.prizes), [status.prizes]);
  // Déjà joué : la part gagnée sous le pointeur, sans animation.
  const [rotation, setRotation] = useState(() => (status.today ? -targetAngle(segs, status.today.prize_id) : 0));
  const [still, setStill] = useState(true);
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">(status.today ? "done" : "idle");
  const [result, setResult] = useState<WheelResult | null>(status.today);
  const [err, setErr] = useState<string | null>(null);
  const busy = useRef(false);

  const can = status.enabled && status.active && phase === "idle" && status.prizes.length > 0;

  async function spin() {
    if (!can || busy.current) return;
    busy.current = true;
    setErr(null);
    const { data, error } = await supabase.rpc("wheel_spin");
    if (error) {
      busy.current = false;
      setErr(error.message);
      return;
    }
    const r = data as WheelResult;
    const target = targetAngle(segs, r.prize_id);
    const base = rotation - (((rotation % 360) + 360) % 360);
    const turns = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 6;
    setStill(false);
    setPhase("spinning");
    setRotation(base + 360 * turns + ((360 - target) % 360));
    const ms = turns === 1 ? 850 : 5300;
    setTimeout(() => {
      setPhase("done");
      setResult(r);
      busy.current = false;
      onSpun?.(r);
    }, ms);
  }

  return (
    <div className="space-y-4">
      <WheelDisc
        prizes={status.prizes}
        rotation={rotation}
        still={still}
        spinning={phase === "spinning"}
        won={phase === "done" ? (result?.prize_id ?? null) : null}
        onHub={spin}
        hubLabel={phase === "idle" ? "Tourner" : phase === "spinning" ? "…" : "Demain"}
        hubDisabled={!can}
      />
      {phase === "idle" && (
        <button
          type="button"
          onClick={spin}
          disabled={!can}
          className="mx-auto block w-full max-w-xs rounded-xl bg-red px-6 py-3 font-display text-lg uppercase tracking-wide text-ink shadow-lg shadow-red/20 transition hover:bg-red-light disabled:opacity-40"
        >
          Tourner la roue
        </button>
      )}
      {phase === "spinning" && <p className="text-center font-mono text-xs uppercase tracking-widest text-paper/60">La roue tourne…</p>}
      {phase === "done" && result && <ResultCard r={result} />}
      {err && <p className="text-center font-mono text-xs text-red">{err}</p>}
      {!status.enabled && <p className="text-center font-body text-sm text-paper/60">La roue est fermée pour le moment.</p>}
      {status.enabled && !status.active && <p className="text-center font-body text-sm text-paper/60">La roue est réservée aux membres actifs.</p>}
    </div>
  );
}
