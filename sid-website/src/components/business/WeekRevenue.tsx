"use client";

/**
 * Chiffre d'affaires de la semaine en cours (Lot 67, migration 0082) :
 * sous le minimum à la fin de la semaine, l'entreprise fait faillite.
 */

export type BusinessWeek = {
  business_id: string;
  name: string;
  founder: string | null;
  treasury: number;
  period_start: string;
  period_end: string;
  revenue: number;
  minimum: number;
  pending_withdrawals: number;
};

const z = (n: number) => `${Math.round(Number(n)).toLocaleString("fr-FR")} z`;

function left(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "semaine terminée, vérification en cours";
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `encore ${h} h`;
  const d = Math.floor(h / 24);
  return `encore ${d} jour${d > 1 ? "s" : ""}`;
}

export function WeekRevenue({ w, compact = false }: { w: BusinessWeek; compact?: boolean }) {
  const ratio = w.minimum > 0 ? Math.min(1, Number(w.revenue) / Number(w.minimum)) : 1;
  const done = Number(w.revenue) >= Number(w.minimum);
  const hoursLeft = (new Date(w.period_end).getTime() - Date.now()) / 3_600_000;
  const danger = !done && hoursLeft <= 48;
  const end = new Date(w.period_end).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`space-y-1.5 ${compact ? "" : "rounded-xl border p-3"} ${!compact && danger ? "border-red/60 bg-red/10" : !compact ? "border-white/10 bg-white/[0.03]" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-body text-sm text-paper/80">
          Ventes de la semaine : <strong className={done ? "text-green-300" : danger ? "text-red-light" : "text-paper"}>{z(w.revenue)}</strong> sur {z(w.minimum)}
        </p>
        <p className={`font-mono text-[11px] ${danger ? "text-red-light" : "text-paper/60"}`}>{done ? "objectif atteint" : left(w.period_end)}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={Number(w.minimum)} aria-valuenow={Number(w.revenue)} aria-label="Ventes de la semaine">
        <div className={`h-full rounded-full ${done ? "bg-green-400/80" : danger ? "bg-red" : "bg-blue"}`} style={{ width: `${Math.max(2, ratio * 100)}%` }} />
      </div>
      {!compact && !done && (
        <p className="font-body text-xs text-paper/60">
          Sans {z(w.minimum)} de ventes d&apos;ici {end}, l&apos;entreprise fait faillite : sa trésorerie rembourse sa dette, puis le reste est
          réparti entre ses actionnaires. Tes propres achats ne comptent pas.
        </p>
      )}
    </div>
  );
}
