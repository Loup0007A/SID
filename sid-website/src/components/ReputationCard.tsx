"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";

type RepEvent = { delta: number; reason: string; at: string };
type MyRep = { reputation: number; position: number; members: number; events: RepEvent[] };

/** Ma renommée : total, place au classement, et d'où elle vient (Lot 54). */
export function ReputationCard() {
  const supabase = createClient();
  const [rep, setRep] = useState<MyRep | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    supabase.rpc("get_my_reputation").then(({ data }) => data && setRep(data as MyRep));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rep) return null;
  const events = all ? rep.events : rep.events.slice(0, 5);

  return (
    <div className="glass-card space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/60">Renommée</p>
          <p className="font-display text-4xl leading-none text-blue">
            {rep.reputation.toLocaleString("fr-FR")}
            <span className="ml-1 text-base text-paper/50">pts</span>
          </p>
        </div>
        <Link href="/dashboard/leaderboard" scroll={false} className="text-right font-mono text-xs uppercase text-blue-light hover:underline">
          {rep.position}
          <sup>{rep.position === 1 ? "er" : "e"}</sup> sur {rep.members} au classement →
        </Link>
      </div>
      <p className="font-body text-sm text-paper/70">
        Elle se gagne en réussissant des quêtes et se perd en les échouant. Réussir au-dessus de ton niveau rapporte plus ; échouer une
        quête facile pour toi coûte plus. Chaque quête affiche ce que tu risques.
      </p>
      {rep.events.length === 0 ? (
        <p className="font-mono text-xs text-paper/50">Aucun mouvement pour l&apos;instant : prends une mission pour commencer.</p>
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
                <SidIcon name={e.delta > 0 ? "medal" : "warning"} size={13} /> {e.reason}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-paper/45">
                {new Date(e.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rep.events.length > 5 && (
        <button onClick={() => setAll((a) => !a)} className="font-mono text-xs uppercase text-blue hover:underline">
          {all ? "Moins" : `Tout l'historique (${rep.events.length})`}
        </button>
      )}
    </div>
  );
}
