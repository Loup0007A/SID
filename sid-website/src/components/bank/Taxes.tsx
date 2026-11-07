"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import { day, dueIn, pct, z } from "@/lib/econ";
import type { MyTaxes, TaxBill } from "@/types/economy";

/**
 * Avis d'impôt et amendes à payer à la main (Lot 69, migrations 0084 et 0086).
 * `businessId` : avis d'une entreprise (payés sur sa trésorerie). Sans : avis
 * personnels (portefeuille ou épargne).
 */

const KIND: Record<TaxBill["kind"], string> = {
  fortune: "Impôt sur la fortune",
  societe: "Impôt sur les sociétés",
  amende: "Amende",
};

const STATUS: Record<TaxBill["status"], { label: string; className: string }> = {
  due: { label: "À payer", className: "border-yellow-400/70 text-yellow-300" },
  paid: { label: "Payé", className: "border-green-400/60 text-green-300" },
  seized: { label: "Saisi", className: "border-red/70 text-red-light" },
  cancelled: { label: "Annulé", className: "border-white/25 text-paper/60" },
};

function detail(b: TaxBill) {
  if (b.kind === "amende") return b.reason ?? "";
  const period = `semaine du ${day(b.period_start)}`;
  if (b.kind === "fortune") return `${period} · ${z(b.base, 0)} − ${z(b.allowance, 0)} d'abattement, à ${pct(b.rate, 1)}`;
  return `${period} · bénéfice ${z(b.base, 0)}, à ${pct(b.rate, 0)}`;
}

export function Taxes({ businessId, onPaid, savings }: { businessId?: string; onPaid?: () => void; savings?: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<MyTaxes | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_taxes");
    if (error) {
      setMissing(error.message.includes("my_taxes"));
      return;
    }
    setData(data as MyTaxes);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (missing) return <p className="font-body text-sm text-paper/60">Les avis d&apos;impôt demandent la migration 0084.</p>;
  if (!data) return null;

  const bills = data.bills.filter((b) => (businessId ? b.business_id === businessId : b.business_id === null));
  const due = bills.filter((b) => b.status === "due");
  const past = bills.filter((b) => b.status !== "due");
  const r = data.rates;

  async function pay(b: TaxBill, source: "portefeuille" | "epargne") {
    setBusy(b.id + source);
    setMsg(null);
    const { error } = await supabase.rpc("tax_pay", { p_bill: b.id, p_source: source });
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `${KIND[b.kind]} réglé : ${z(b.amount)}.` });
    await load();
    onPaid?.();
  }

  return (
    <div className="space-y-3">
      {!businessId && data.surcharge_pct > 0 && (
        <div className="rounded-lg border border-red/50 bg-red/10 px-4 py-3 font-body text-sm text-red-light">
          <p>
            <SidIcon name="warning" size={15} /> Majoration en cours : <b>+{data.surcharge_pct} %</b> sur tes prochains impôts ({data.faults.length} faute
            {data.faults.length > 1 ? "s" : ""}).
          </p>
          <p className="mt-1 font-mono text-[11px] text-red-light/80">
            {data.faults.map((f) => `jusqu'au ${day(f.expires_at)}`).join(" · ")}
          </p>
        </div>
      )}

      {due.length === 0 ? (
        <p className="font-body text-sm text-paper/60">Rien à payer.</p>
      ) : (
        <ul className="space-y-2">
          {due.map((b) => {
            const late = new Date(b.due_at).getTime() - Date.now() < 48 * 3_600_000;
            return (
              <li key={b.id} className={`rounded-xl border p-4 ${late ? "border-yellow-400/60 bg-yellow-400/5" : "border-white/10 bg-white/5"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display uppercase text-paper">
                    {KIND[b.kind]}
                    {b.surcharge_pct > 0 && <span className="ml-2 font-mono text-[11px] text-red-light">majoré de {b.surcharge_pct} %</span>}
                  </p>
                  <p className="font-display text-2xl text-paper">{z(b.amount)}</p>
                </div>
                <p className="font-body text-sm text-paper/65">{detail(b)}</p>
                <p className={`mt-1 font-mono text-[11px] ${late ? "text-yellow-300" : "text-paper/55"}`}>
                  À payer avant le {day(b.due_at)} ({dueIn(b.due_at)}). Ensuite : saisie avec {r.penalite} % de majoration.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.business_id ? (
                    <button type="button" disabled={!!busy} onClick={() => pay(b, "portefeuille")} className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
                      Payer depuis la trésorerie
                    </button>
                  ) : (
                    <>
                      <button type="button" disabled={!!busy} onClick={() => pay(b, "portefeuille")} className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
                        Payer (portefeuille)
                      </button>
                      <button
                        type="button"
                        disabled={!!busy || (savings != null && savings < b.amount)}
                        onClick={() => pay(b, "epargne")}
                        className="rounded-lg border border-blue px-3 py-1.5 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40"
                      >
                        Payer sur l&apos;épargne
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {msg && <p className={`font-mono text-xs ${msg.ok ? "text-green-300" : "text-red"}`}>{msg.text}</p>}

      {past.length > 0 && (
        <div>
          <ul className="space-y-1">
            {(showAll ? past : past.slice(0, 4)).map((b) => {
              const st = STATUS[b.status];
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-white/5 px-3 py-1.5 font-body text-sm">
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${st.className}`}>{st.label}</span>
                  <span className="text-paper">{KIND[b.kind]}</span>
                  <span className="font-mono text-xs text-paper/80">{z(b.amount + (b.penalty || 0))}</span>
                  <span className="truncate text-xs text-paper/55">{b.kind === "amende" ? b.reason : `semaine du ${day(b.period_start)}`}</span>
                  {b.paid_from && b.paid_from !== "saisie" && <span className="ml-auto font-mono text-[10px] uppercase text-paper/45">{b.paid_from}</span>}
                </li>
              );
            })}
          </ul>
          {past.length > 4 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 font-mono text-[11px] uppercase text-blue hover:underline">
              {showAll ? "Moins" : `Historique complet (${past.length})`}
            </button>
          )}
        </div>
      )}

      <p className="font-body text-xs text-paper/55">
        {businessId
          ? `Chaque semaine, ${pct(r.societes, 0)} du bénéfice (ventes − salaires, intérêts, frais et litiges). `
          : `Chaque semaine, ${pct(r.fortune, 1)} de ton portefeuille + épargne au-delà de ${z(r.abattement, 0)}. `}
        Avis à payer sous {r.jours} jours. Un avis impayé est saisi avec {r.penalite} % de plus, même si le solde passe en négatif, et compte comme une faute :
        +{r.majoration_par_faute} % sur tous tes impôts pendant 2 mois (+{r.majoration_max} % au plus).
      </p>
    </div>
  );
}
