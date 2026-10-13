import clsx from "clsx";
import { STAT_LABELS, type StatKey } from "@/lib/simulationSites";

const STAT_ORDER: StatKey[] = ["intelligence", "strength", "technique"];

const BAR_COLOR: Record<StatKey, string> = {
  intelligence: "bg-blue",
  strength: "bg-red",
  technique: "bg-blue-light",
};

export function formatPower(value: number): string {
  return Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Puissance globale (moyenne, 100 max) et ses trois facteurs.
 * `highlight` met en avant le facteur entraîné par une simulation.
 */
export function MemberStatBars({
  stats,
  power,
  highlight,
}: {
  stats: Record<StatKey, number>;
  power: number;
  highlight?: StatKey;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">Puissance globale</p>
        <p className="font-display text-2xl text-blue">
          {formatPower(power)}
          <span className="font-mono text-xs text-paper/50"> / 100</span>
        </p>
      </div>
      {STAT_ORDER.map((key) => {
        const value = Math.max(0, Math.min(100, Number(stats[key]) || 0));
        return (
          <div key={key} className={clsx("space-y-1", highlight && highlight !== key && "opacity-60")}>
            <div className="flex justify-between font-mono text-xs">
              <span className={clsx("uppercase tracking-wide", highlight === key && "text-blue-light")}>{STAT_LABELS[key]}</span>
              <span className="text-paper/70">{value} / 100</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={STAT_LABELS[key]}>
              <div className={clsx("h-full rounded-full transition-all", BAR_COLOR[key])} style={{ width: `${value}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
