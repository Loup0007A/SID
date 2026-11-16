"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ActiveTroll } from "@/lib/titles";
import { DECREE_SEALS, readOptions, type DecreeSeal } from "@/lib/trollOptions";
import { SidIcon } from "@/components/icons/SidIcon";
import "./election-effects.css";

/**
 * Décret du Dictateur (Lot 80, titre « Dictateur ») : un parchemin se
 * déroule sur le site de la cible, avec le texte du décret et le sceau du
 * Dictateur. Il faut le contresigner pour le refermer ; un nouveau décret
 * tombe toutes les trois minutes tant que la farce dure.
 */

const DECREES = [
  "Il est décrété que {cible} saluera chaque page qu'il ouvrira.",
  "Article 1 : {cible} a toujours tort. Article 2 : en cas de doute, voir l'article 1.",
  "Le lundi est supprimé pour {cible}. Il est remplacé par un second lundi.",
  "{cible} est nommé Ministre des Confettis, sans salaire ni pouvoir.",
  "Tout sourire de {cible} est désormais soumis à l'impôt.",
  "{cible} applaudira à chaque annonce officielle, même celle-ci.",
];

/** Sceau de cire avec une couronne. */
export function DecreeSealArt({ seal = "or", className = "" }: { seal?: DecreeSeal; className?: string }) {
  const c = DECREE_SEALS[seal];
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        d="M32 3c5 0 6 4 10 5s8-1 10 3 0 7 2 10 6 5 5 9-5 5-5 9 3 7 0 10-7 1-10 3-5 6-12 6-7-4-11-6-9 1-11-3 1-7-1-10-6-4-5-9 4-5 4-9-3-7 0-10 7 0 10-3 4-5 9-5z"
        fill={c.wax}
        stroke={c.rim}
        strokeWidth="1.5"
      />
      <circle cx="32" cy="32" r="18" fill="none" stroke={c.rim} strokeWidth="1.2" opacity="0.55" />
      <path d="M20 38 L22 25 L28 31 L32 21 L36 31 L42 25 L44 38 Z" fill={c.rim} opacity="0.75" />
      <rect x="20" y="39" width="24" height="3.5" rx="1" fill={c.rim} opacity="0.75" />
    </svg>
  );
}

/** Confettis qui tombent (positions et couleurs stables). */
export function ConfettiRain({ count = 36, className = "" }: { count?: number; className?: string }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (k: number) => {
          const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        return {
          i,
          style: {
            left: `${(r(1) * 100).toFixed(1)}%`,
            animationDelay: `${(-r(2) * 9).toFixed(2)}s`,
            animationDuration: `${(6 + r(3) * 6).toFixed(2)}s`,
            background: ["#f0c27a", "#c8324f", "#f6eedb", "#7a1430", "#ffd86b"][i % 5],
            ["--sway" as string]: `${((r(4) - 0.5) * 120).toFixed(0)}px`,
            ["--spin" as string]: `${Math.round(360 + r(5) * 720)}deg`,
            width: `${(5 + r(6) * 5).toFixed(1)}px`,
            height: `${(8 + r(7) * 6).toFixed(1)}px`,
          } as CSSProperties,
        };
      }),
    [count],
  );
  return (
    <div className={`decree-confetti ${className}`} aria-hidden>
      {bits.map((b) => (
        <i key={b.i} style={b.style} />
      ))}
    </div>
  );
}

export function Decree({ troll, nickname }: { troll: ActiveTroll; nickname: string }) {
  const o = readOptions("decret", troll.params, troll.level);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"drums" | "open" | "signed">("drums");

  const text = useMemo(() => {
    const raw = o.decree || DECREES[(troll.id + round) % DECREES.length];
    return raw.replaceAll("{cible}", nickname || "Le destinataire");
  }, [o.decree, troll.id, round, nickname]);

  // Roulement de tambours, puis le parchemin.
  useEffect(() => {
    if (phase !== "drums") return;
    const t = setTimeout(() => setPhase("open"), 1800);
    return () => clearTimeout(t);
  }, [phase]);

  // Signé : un nouveau décret trois minutes plus tard.
  useEffect(() => {
    if (phase !== "signed") return;
    const t = setTimeout(() => {
      setRound((r) => r + 1);
      setPhase("drums");
    }, 180_000);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      {o.confetti && <ConfettiRain count={phase === "signed" ? 18 : 40} />}
      {phase === "drums" && (
        <div className="decree-drums" role="status">
          <span className="decree-drum" aria-hidden>
            <SidIcon name="crown" />
          </span>
          Roulement de tambours…
        </div>
      )}
      {phase === "open" && (
        <div className="decree-wrap" role="dialog" aria-label="Décret du Dictateur">
          <div className="decree-scroll">
            <div className="decree-roll decree-roll-top" aria-hidden />
            <div className="decree-paper">
              <p className="decree-kicker">Par ordre du Dictateur {troll.actor}</p>
              <p className="decree-title">Décret</p>
              <p className="decree-text">{`«\u00a0${text}\u00a0»`}</p>
              <DecreeSealArt seal={o.seal} className="decree-seal" />
              <button type="button" className="decree-sign" onClick={() => setPhase("signed")}>
                Contresigner
              </button>
            </div>
            <div className="decree-roll decree-roll-bottom" aria-hidden />
          </div>
        </div>
      )}
    </div>
  );
}
