"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { WithdrawalQueue } from "@/components/bank/Withdrawals";
import { type BusinessWeek } from "@/components/business/WeekRevenue";
import { createClient } from "@/lib/supabase/client";
import type { TaxPoolStatus } from "@/types/business";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";
import { CentralBankAdmin, DisputesShortcut, ExpenseQueue, TaxesAdmin } from "@/components/admin/EconomyAdmin";
import { EconomyMembers } from "@/components/admin/EconomyMembers";
import { WheelAdmin } from "@/components/admin/WheelAdmin";
import { InactivityAdmin } from "@/components/admin/InactivityAdmin";
import { GachaAdmin } from "@/components/admin/GachaAdmin";

/**
 * Administration → Économie, en onglets (Lot 74). Tous les panneaux sont
 * montés dès l'ouverture : les compteurs « à traiter » sont connus tout de
 * suite et le changement d'onglet est instantané.
 */

type Tab = "traiter" | "banque" | "impots" | "membres" | "entreprises" | "roue" | "recrutement" | "absences";
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: "traiter", label: "À traiter", icon: "check" },
  { key: "banque", label: "Banque centrale", icon: "zeni" },
  { key: "impots", label: "Impôts et amendes", icon: "receipt" },
  { key: "membres", label: "Membres", icon: "people" },
  { key: "entreprises", label: "Entreprises", icon: "office" },
  { key: "roue", label: "Roue du jour", icon: "wheel" },
  { key: "recrutement", label: "Recrutement", icon: "dice" },
  { key: "absences", label: "Absences", icon: "hourglass" },
];
/** Ancres des notifications et anciens liens → onglet. */
const ANCHOR: Record<string, Tab> = { retraits: "traiter", frais: "traiter", litiges: "traiter", impots: "impots", amendes: "impots", caisse: "impots" };

function tabFromHash(): { tab: Tab | null; anchor: string | null } {
  const h = window.location.hash.slice(1);
  if (!h) return { tab: null, anchor: null };
  if (TABS.some((t) => t.key === h)) return { tab: h as Tab, anchor: null };
  return { tab: ANCHOR[h] ?? null, anchor: ANCHOR[h] ? h : null };
}

export default function EconomyAdminPage() {
  const [tab, setTab] = useState<Tab>("traiter");
  const [counts, setCounts] = useState<{ retraits?: number; frais?: number; litiges?: number }>({});

  useEffect(() => {
    const apply = () => {
      const { tab: t, anchor } = tabFromHash();
      if (!t) return;
      setTab(t);
      if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  // Sur mobile, la barre d'onglets défile : garder l'onglet actif visible.
  useEffect(() => {
    const center = () => {
      const el = document.getElementById(`tab-${tab}`);
      const bar = el?.parentElement;
      if (el && bar) bar.scrollLeft = el.offsetLeft - bar.clientWidth / 2 + el.clientWidth / 2;
    };
    center();
    // Les largeurs changent une fois les polices chargées et les compteurs affichés.
    document.fonts?.ready.then(center);
  }, [tab, counts]);

  function go(t: Tab) {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  }

  const todo = (counts.retraits ?? 0) + (counts.frais ?? 0) + (counts.litiges ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Économie du S.I.D.</h1>
        <p className="font-mono text-xs text-paper/60">
          {todo === 0
            ? "Rien à traiter."
            : [
                counts.retraits ? `${counts.retraits} retrait${counts.retraits > 1 ? "s" : ""}` : null,
                counts.frais ? `${counts.frais} frais` : null,
                counts.litiges ? `${counts.litiges} litige${counts.litiges > 1 ? "s" : ""}` : null,
              ]
                .filter(Boolean)
                .join(" · ") + " en attente"}
        </p>
      </div>

      <div role="tablist" aria-label="Sections de l'économie" className="scroll-fade relative -mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => go(t.key)}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 font-mono text-xs uppercase",
              tab === t.key ? "border-red text-paper" : "border-transparent text-paper/55 hover:text-paper"
            )}
          >
            <SidIcon name={t.icon} size={14} />
            {t.label}
            {t.key === "traiter" && todo > 0 && <span className="rounded-full bg-yellow-400/20 px-1.5 font-mono text-[10px] text-yellow-300">{todo}</span>}
          </button>
        ))}
      </div>

      <Panel id="traiter" tab={tab}>
        <WithdrawalQueue onCount={(n) => setCounts((c) => ({ ...c, retraits: n }))} />
        <ExpenseQueue onCount={(n) => setCounts((c) => ({ ...c, frais: n }))} />
        <div id="litiges" className="scroll-mt-24">
          <DisputesShortcut onCount={(n) => setCounts((c) => ({ ...c, litiges: n }))} />
        </div>
      </Panel>

      <Panel id="banque" tab={tab}>
        <CentralBankAdmin />
      </Panel>

      <Panel id="impots" tab={tab}>
        <TaxPool />
        <TaxesAdmin />
      </Panel>

      <Panel id="membres" tab={tab}>
        <EconomyMembers />
      </Panel>

      <Panel id="entreprises" tab={tab}>
        <BusinessWeeks />
      </Panel>

      <Panel id="roue" tab={tab}>
        {tab === "roue" && <WheelAdmin />}
      </Panel>

      <Panel id="recrutement" tab={tab}>
        {tab === "recrutement" && <GachaAdmin />}
      </Panel>

      <Panel id="absences" tab={tab}>
        {tab === "absences" && <InactivityAdmin />}
      </Panel>
    </div>
  );
}

function Panel({ id, tab, children }: { id: Tab; tab: Tab; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={tab !== id} className="space-y-8">
      {children}
    </div>
  );
}

const pctShare = (x: number) => `${Math.round(x * 100)} %`;

function TaxPool() {
  const supabase = useMemo(() => createClient(), []);
  const [t, setT] = useState<TaxPoolStatus | null>(null);
  useEffect(() => {
    supabase.rpc("get_tax_pool_status").then(({ data }) => data && setT(data as TaxPoolStatus));
  }, [supabase]);
  if (!t) return null;
  return (
    <section id="caisse" className="scroll-mt-24 space-y-3">
      <h2 className="font-display text-lg uppercase text-paper">Caisse commune et TVA</h2>
      <div className="glass-card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <div>
          <p className="font-mono text-[10px] uppercase text-paper/65">Caisse actuelle</p>
          <p className="font-display text-xl text-blue-light">{Number(t.balance).toLocaleString("fr-FR")} z</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-paper/65">TVA</p>
          <p className="font-display text-xl text-paper">{(t.vat_rate * 100).toFixed(0)} %</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-paper/65">Impôt sur la fortune</p>
          <p className="font-display text-xl text-paper">{(t.weekly_wealth_tax_rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % / sem.</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-paper/65">Prochaine redistribution</p>
          <p className="font-mono text-xs text-paper/70">{new Date(t.next_distribution_at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      </div>
      <p className="font-body text-xs text-paper/60">
        Y entrent : TVA, impôts payés ou saisis, amendes, frais de dossier et frais de bourse. Répartie chaque semaine, à parts égales :{" "}
        {pctShare(t.admin_share ?? 0.8)} aux fondateurs (grade Fondateur), {pctShare(t.business_share ?? 0.2)} aux entreprises ouvertes (
        <code className="font-mono">tax_admin_share</code>, <code className="font-mono">tax_business_share</code>). Ce qui n&apos;est pas versé reste dans la
        caisse. Les taux suivent la banque centrale tant que l&apos;adaptation automatique est active.
      </p>
      {t.founders && (
        <p className="wrap-any font-body text-xs text-paper/70">
          {t.founders.length ? (
            <>
              Part des fondateurs ({t.founders.length}) : {t.founders.join(", ")}. Ils touchent aussi la part admin des frais de courtage.
            </>
          ) : (
            <span className="text-gold">Aucun fondateur actif : la part des fondateurs reste dans la caisse.</span>
          )}
        </p>
      )}
    </section>
  );
}

/** Ventes de la semaine de chaque entreprise ouverte (Lot 67), les plus en retard d'abord. */
type CostsStatus = { rate: number; money_supply: number; members: number; average: number; costs: number; in_procedure: number };

/** Frais de fonctionnement des entreprises (Lot 102, migration 0131). */
function CostsSettings({ onChange }: { onChange: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [st, setSt] = useState<CostsStatus | null>(null);
  const [missing, setMissing] = useState(false);
  const [pct, setPct] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const zz = (n: number) => `${Math.round(Number(n)).toLocaleString("fr-FR")} z`;
  const take = (d: CostsStatus) => {
    setSt(d);
    setPct(String(Math.round(Number(d.rate) * 10000) / 100));
  };
  useEffect(() => {
    supabase.rpc("business_costs_status").then(({ data, error }) => (error ? setMissing(true) : take(data as CostsStatus)));
  }, [supabase]);

  if (missing) {
    return (
      <p className="font-body text-sm text-paper/65">
        Frais de fonctionnement : lance la migration <code className="font-mono text-xs">0131_faillite_cessation_paiements.sql</code>.
      </p>
    );
  }
  if (!st) return null;
  const n = Number(pct.replace(",", "."));
  const valid = Number.isFinite(n) && n >= 0 && n <= 50;
  const dirty = valid && Math.abs(n / 100 - Number(st.rate)) > 1e-9;
  const apercu = valid ? (n > 0 ? Math.max(10, Math.round((n / 100) * st.average)) : 0) : null;

  return (
    <div className="glass-card space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-paper/70">Frais de fonctionnement par semaine</p>
          <p className="font-display text-xl text-paper">{st.costs > 0 ? zz(st.costs) : "Aucun"}</p>
        </div>
        {st.in_procedure > 0 && (
          <p className="font-mono text-xs text-red-light">
            {st.in_procedure} entreprise{st.in_procedure > 1 ? "s" : ""} en redressement
          </p>
        )}
      </div>
      <p className="font-body text-sm text-paper/80">
        Le même montant pour chaque entreprise : {Math.round(Number(st.rate) * 10000) / 100} % de la fortune moyenne d&apos;un membre (masse monétaire{" "}
        {zz(st.money_supply)} ÷ {st.members} membres actifs = {zz(st.average)}), 10 z au moins. Il suit l&apos;argent en circulation et part chez les
        fournisseurs (la population simulée). Une trésorerie sous zéro ouvre un redressement judiciaire de 7 jours, puis la liquidation.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-body text-sm text-paper/80">
          Taux
          <input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={pct}
            onChange={(e) => {
              setPct(e.target.value);
              setMsg(null);
            }}
            className="w-24 rounded-lg border border-paper-dark bg-ink-soft px-3 py-1.5 font-mono text-sm text-paper outline-none focus:border-blue"
          />
          %
        </label>
        {apercu != null && dirty && <span className="font-mono text-xs text-paper/75">soit {apercu > 0 ? zz(apercu) : "aucun frais"} par semaine</span>}
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            const { data, error } = await supabase.rpc("business_costs_set", { p_rate: n / 100 });
            setBusy(false);
            if (error) return setMsg({ ok: false, text: error.message });
            take(data as CostsStatus);
            setMsg({ ok: true, text: "Taux enregistré." });
            onChange();
          }}
          className="rounded-lg bg-blue px-4 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
        >
          Appliquer
        </button>
        {msg && <span className={clsx("font-mono text-xs", msg.ok ? "text-green-300" : "text-red")}>{msg.text}</span>}
      </div>
    </div>
  );
}

function BusinessWeeks() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<BusinessWeek[] | null>(null);
  const load = useCallback(() => {
    supabase.rpc("business_weeks", { p_all: true }).then(({ data, error }) => setRows(error ? [] : ((data ?? []) as BusinessWeek[])));
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);
  if (!rows) return <p className="font-body text-sm text-paper/70">Chargement…</p>;
  const zz = (n: number) => `${Math.round(Number(n)).toLocaleString("fr-FR")} z`;
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg uppercase text-paper">Santé des entreprises</h2>
      <CostsSettings onChange={load} />
      {rows.length === 0 && <p className="glass-card p-4 font-body text-sm text-paper/70">Aucune entreprise ouverte.</p>}
      {rows.length > 0 && <p className="font-body text-sm text-paper/75">Les redressements d&apos;abord, puis les trésoreries les plus basses.</p>}
      {rows.length > 0 && (
        <div className="glass-card overflow-x-auto p-2">
          <table className="w-full border-collapse font-mono text-xs sm:min-w-[640px]">
            <thead>
              <tr className="border-b border-white/10 text-left uppercase text-paper/70">
                <th className="p-2 font-normal">Entreprise</th>
                <th className="p-2 text-right font-normal">Trésorerie</th>
                <th className="p-2 font-normal">Couverture</th>
                <th className="hidden p-2 font-normal sm:table-cell">Échéance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const proc = !!w.procedure && !!w.procedure_until;
                const sem = Number(w.weeks_covered ?? 0);
                const danger = proc || Number(w.treasury) < Number(w.costs ?? 0);
                return (
                  <tr key={w.business_id} className={clsx("border-b border-white/5", proc && "bg-red/10")}>
                    <td className="p-2">
                      <span className="font-display text-sm uppercase text-paper">{w.name}</span>
                      <span className="block text-[11px] text-paper/70">{w.founder ?? "—"}</span>
                      {proc && <span className="block text-[11px] uppercase text-red-light">redressement judiciaire</span>}
                    </td>
                    <td className={clsx("p-2 text-right", Number(w.treasury) < 0 ? "text-red-light" : "text-paper/85")}>
                      {zz(w.treasury)}
                      {Number(w.debt ?? 0) > 0 && <span className="block text-[11px] text-paper/70">dette {zz(Number(w.debt))}</span>}
                      {Number(w.pending_withdrawals) > 0 && <span className="block text-[11px] text-gold">{zz(w.pending_withdrawals)} en retrait</span>}
                    </td>
                    <td className={clsx("p-2", danger ? "text-red-light" : sem < 3 ? "text-yellow-300" : "text-paper/85")}>
                      {Number(w.costs ?? 0) > 0 ? (proc ? "—" : `${sem >= 52 ? "52+" : sem} sem.`) : "sans frais"}
                    </td>
                    <td className={clsx("hidden p-2 sm:table-cell", proc ? "text-red-light" : "text-paper/75")}>
                      {proc
                        ? `liquidation le ${new Date(w.procedure_until!).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : w.next_charge_at
                          ? `frais le ${new Date(w.next_charge_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
