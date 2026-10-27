"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";

type RepEvent = { delta: number; reason: string; at: string };
type MyRep = {
  reputation: number;
  position: number;
  members: number;
  events: RepEvent[];
};

/** Ma renommée : total, place au classement, et d'où elle vient (Lot 54). */
export function ReputationCard() {
  const supabase = createClient();
  const [rep, setRep] = useState<MyRep | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    supabase
      .rpc("get_my_reputation")
      .then(({ data }) => data && setRep(data as MyRep));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rep) return null;
  const events = all ? rep.events : rep.events.slice(0, 5);

  return (
    <div className="glass-card space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/60">
            Renommée
          </p>
          <p className="font-display text-4xl leading-none text-blue">
            {rep.reputation.toLocaleString("fr-FR")}
            <span className="ml-1 text-base text-paper/65">pts</span>
          </p>
        </div>
        <Link
          href="/dashboard/leaderboard"
          scroll={false}
          className="text-right font-mono text-xs uppercase text-blue-light hover:underline"
        >
          {rep.position}
          <sup>{rep.position === 1 ? "er" : "e"}</sup> sur {rep.members} au
          classement →
        </Link>
      </div>
      {rep.events.length >= 2 && (
        <RepCurve reputation={rep.reputation} events={rep.events} />
      )}
      <p className="font-body text-sm text-paper/70">
        Elle se gagne en réussissant des quêtes et se perd en les échouant.
        Réussir au-dessus de ton niveau rapporte plus ; échouer une quête facile
        pour toi coûte plus. Chaque quête affiche ce que tu risques.
      </p>
      {rep.events.length === 0 ? (
        <p className="font-mono text-xs text-paper/65">
          Aucun mouvement pour l&apos;instant : prends une mission pour
          commencer.
        </p>
      ) : (
        <ul className="divide-y divide-white/10">
          {events.map((e, i) => (
            <li key={i} className="flex items-center gap-3 py-2">
              <span
                className={`w-14 shrink-0 text-right font-display text-lg ${e.delta > 0 ? "text-blue-light" : "text-red"}`}
                aria-label={`${e.delta > 0 ? "gain" : "perte"} de ${Math.abs(e.delta)}`}
              >
                {e.delta > 0 ? "+" : ""}
                {e.delta}
              </span>
              <span className="min-w-0 flex-1 truncate font-body text-sm text-paper/85">
                <SidIcon name={e.delta > 0 ? "medal" : "warning"} size={13} />{" "}
                {e.reason}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-paper/65">
                {new Date(e.at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rep.events.length > 5 && (
        <button
          onClick={() => setAll((a) => !a)}
          className="font-mono text-xs uppercase text-blue hover:underline"
        >
          {all ? "Moins" : `Tout l'historique (${rep.events.length})`}
        </button>
      )}
    </div>
  );
}

/**
 * Courbe de renommée (Lot 59) : la renommée après chacun des derniers
 * mouvements, recalculée à rebours depuis le total actuel.
 */
function RepCurve({
  reputation,
  events,
}: {
  reputation: number;
  events: RepEvent[];
}) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const chrono = [...events].reverse();
  const start = reputation - chrono.reduce((a, e) => a + e.delta, 0);
  const values = [start];
  for (const e of chrono) values.push(values[values.length - 1] + e.delta);

  const W = 320;
  const H = 70;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => 4 + (i / (values.length - 1)) * (W - 8);
  const y = (v: number) => 8 + (1 - (v - min) / span) * (H - 16);
  const line = values
    .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const diff = reputation - start;
  const h = hover ?? values.length - 1;
  const ev = h > 0 ? chrono[h - 1] : null;

  return (
    <figure className="rep-curve">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-[70px] w-full"
          role="img"
          aria-label={`Évolution de la renommée sur les ${events.length} derniers mouvements : de ${start} à ${reputation} points (${diff >= 0 ? "+" : ""}${diff}).`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = (
              e.currentTarget as SVGSVGElement
            ).getBoundingClientRect();
            setHover(
              Math.round(
                ((e.clientX - r.left) / r.width) * (values.length - 1),
              ),
            );
          }}
        >
          <defs>
            <linearGradient id={`rg-${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#8fb3d9" stopOpacity="0.45" />
              <stop offset="1" stopColor="#8fb3d9" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#rg-${gid})`} />
          <path
            d={line}
            fill="none"
            stroke="#8fb3d9"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          <line
            x1={x(h)}
            x2={x(h)}
            y1="0"
            y2={H}
            stroke="rgb(237 230 211 / 0.25)"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="rep-curve-dot"
          style={{
            left: `${(x(h) / W) * 100}%`,
            top: `${(y(values[h]) / H) * 100}%`,
          }}
          aria-hidden
        />
      </div>
      <figcaption className="flex items-center justify-between gap-2 font-mono text-[11px] text-paper/70">
        <span className="truncate">
          {ev ? (
            <>
              <span className={ev.delta > 0 ? "text-blue-light" : "text-red"}>
                {ev.delta > 0 ? "+" : ""}
                {ev.delta}
              </span>{" "}
              · {ev.reason}
            </>
          ) : (
            "Point de départ"
          )}
        </span>
        <span className="shrink-0">
          {values[h].toLocaleString("fr-FR")} pts
        </span>
      </figcaption>
    </figure>
  );
}
