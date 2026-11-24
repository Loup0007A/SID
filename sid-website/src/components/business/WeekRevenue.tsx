"use client";

/**
 * Santé d'une entreprise (Lot 102, migration 0131) : frais de fonctionnement
 * de la semaine, nombre de semaines que la trésorerie couvre, et, en cas de
 * cessation de paiements, le redressement judiciaire en cours (7 jours pour
 * revenir au-dessus de zéro, sinon liquidation). Remplace la jauge des
 * ventes de la semaine (0082).
 */

export type BusinessWeek = {
  business_id: string;
  name: string;
  founder: string | null;
  treasury: number;
  debt?: number;
  costs?: number;
  next_charge_at?: string;
  weeks_covered?: number | null;
  procedure?: "redressement" | null;
  procedure_started_at?: string | null;
  procedure_until?: string | null;
  pending_withdrawals: number;
  // Ancien format (0082), encore renvoyé.
  period_start: string;
  period_end: string;
  revenue: number;
  minimum: number;
  mode?: "fixe" | "auto" | "off";
};

const z = (n: number) => `${Math.round(Number(n)).toLocaleString("fr-FR")} z`;
const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function reste(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "échéance passée, vérification en cours";
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `encore ${h} h`;
  const d = Math.floor(h / 24);
  return `encore ${d} jour${d > 1 ? "s" : ""}`;
}

export function WeekRevenue({ w, compact = false }: { w: BusinessWeek; compact?: boolean }) {
  const t = Number(w.treasury);
  const costs = Number(w.costs ?? 0);

  if (w.procedure && w.procedure_until) {
    return (
      <div role="alert" className={`space-y-1.5 ${compact ? "" : "rounded-xl border border-red/60 bg-red/10 p-3"}`}>
        <p className="font-display text-sm uppercase text-red-light">Redressement judiciaire</p>
        <p className="font-body text-sm text-paper/90">
          Trésorerie : <strong className={t < 0 ? "text-red-light" : "text-paper"}>{z(t)}</strong>. Elle doit revenir à zéro ou plus avant le{" "}
          <strong>{quand(w.procedure_until)}</strong> ({reste(w.procedure_until)}), sinon l&apos;entreprise est liquidée.
        </p>
        {!compact && (
          <p className="font-body text-xs text-paper/75">
            Les ventes continuent et le fondateur peut faire un apport (plus bas). La procédure est levée dès que la trésorerie couvre une semaine de
            frais ({z(costs)}). D&apos;ici là : cotation suspendue, ni retrait, ni dividende, ni emprunt, ni fermeture. En cas de liquidation,
            l&apos;actif paie l&apos;État, puis la banque, puis les actionnaires, et le fondateur ne peut plus créer d&apos;entreprise pendant 30 jours.
          </p>
        )}
      </div>
    );
  }

  if (!(costs > 0) || !w.next_charge_at) {
    return (
      <p className={`font-body text-sm text-paper/75 ${compact ? "" : "rounded-xl border border-white/10 bg-white/[0.03] p-3"}`}>
        Pas de frais de fonctionnement en ce moment.
      </p>
    );
  }

  const semaines = Number(w.weeks_covered ?? 0);
  const danger = t < costs;
  const prudence = !danger && semaines < 3;
  return (
    <div className={`space-y-1.5 ${compact ? "" : "rounded-xl border p-3"} ${!compact && danger ? "border-red/60 bg-red/10" : !compact ? "border-white/10 bg-white/[0.03]" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-body text-sm text-paper/85">
          Frais de fonctionnement : <strong className="text-paper">{z(costs)}</strong> par semaine
        </p>
        <p className={`font-mono text-[11px] ${danger ? "text-red-light" : "text-paper/70"}`}>prochains le {new Date(w.next_charge_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={Math.min(semaines, 4)} aria-label="Semaines de frais couvertes par la trésorerie">
        <div className={`h-full rounded-full ${danger ? "bg-red" : prudence ? "bg-yellow-400/80" : "bg-green-400/80"}`} style={{ width: `${Math.max(2, Math.min(semaines, 4) * 25)}%` }} />
      </div>
      <p className={`font-body text-xs ${danger ? "text-red-light" : "text-paper/75"}`}>
        {danger
          ? `La trésorerie (${z(t)}) ne couvre pas les prochains frais. Sous zéro, l'entreprise entre en redressement judiciaire : 7 jours pour se renflouer.`
          : `La trésorerie couvre ${semaines >= 52 ? "plus d'un an" : `${semaines} semaine${semaines > 1 ? "s" : ""}`} de frais.`}
        {!compact && !danger && " Le montant suit l'argent en circulation dans le S.I.D. et se recalcule chaque semaine."}
      </p>
    </div>
  );
}
