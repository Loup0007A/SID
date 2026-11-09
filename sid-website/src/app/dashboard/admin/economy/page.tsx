"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { WithdrawalQueue } from "@/components/bank/Withdrawals";
import { type BusinessWeek } from "@/components/business/WeekRevenue";
import { createClient } from "@/lib/supabase/client";
import type { TaxPoolStatus } from "@/types/business";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";
import { CentralBankAdmin, DisputesShortcut, ExpenseQueue, TaxesAdmin } from "@/components/admin/EconomyAdmin";
import { EconomyMembers } from "@/components/admin/EconomyMembers";

/**
 * Administration → Économie, en onglets (Lot 74). Tous les panneaux sont
 * montés dès l'ouverture : les compteurs « à traiter » sont connus tout de
 * suite et le changement d'onglet est instantané.
 */

type Tab = "traiter" | "banque" | "impots" | "membres" | "entreprises";
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: "traiter", label: "À traiter", icon: "check" },
  { key: "banque", label: "Banque centrale", icon: "zeni" },
  { key: "impots", label: "Impôts et amendes", icon: "receipt" },
  { key: "membres", label: "Membres", icon: "people" },
  { key: "entreprises", label: "Entreprises", icon: "office" },
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

      <div role="tablist" aria-label="Sections de l'économie" className="relative -mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        Y entrent : TVA, impôts payés ou saisis, amendes, frais de dossier et frais de bourse. Répartie chaque semaine : 80 % aux admins, 20 % aux entreprises, à
        parts égales (<code className="font-mono">tax_admin_share</code>, <code className="font-mono">tax_business_share</code>). Les taux suivent la banque centrale
        tant que l&apos;adaptation automatique est active.
      </p>
    </section>
  );
}

/** Ventes de la semaine de chaque entreprise ouverte (Lot 67), les plus en retard d'abord. */
function BusinessWeeks() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<BusinessWeek[] | null>(null);
  useEffect(() => {
    supabase.rpc("business_weeks", { p_all: true }).then(({ data, error }) => setRows(error ? [] : ((data ?? []) as BusinessWeek[])));
  }, [supabase]);
  if (!rows) return <p className="font-body text-sm text-paper/60">Chargement…</p>;
  if (rows.length === 0) return <p className="glass-card p-4 font-body text-sm text-paper/60">Aucune entreprise ouverte.</p>;
  const ratio = (w: BusinessWeek) => (Number(w.minimum) > 0 ? Number(w.revenue) / Number(w.minimum) : 1);
  const sorted = [...rows].sort((a, b) => ratio(a) - ratio(b));
  const zz = (n: number) => `${Math.round(Number(n)).toLocaleString("fr-FR")} z`;
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg uppercase text-paper">Ventes de la semaine</h2>
      <p className="font-body text-sm text-paper/65">
        Sous {zz(rows[0].minimum)} de ventes à la fin de sa semaine, une entreprise fait faillite (<code className="font-mono text-xs">business_min_weekly_revenue</code>, 0
        pour désactiver). Les plus en retard d&apos;abord.
      </p>
      <div className="glass-card overflow-x-auto p-2">
        <table className="w-full border-collapse font-mono text-xs sm:min-w-[640px]">
          <thead>
            <tr className="border-b border-white/10 text-left uppercase text-paper/60">
              <th className="p-2 font-normal">Entreprise</th>
              <th className="p-2 font-normal">Ventes / minimum</th>
              <th className="hidden p-2 font-normal sm:table-cell">Fin de semaine</th>
              <th className="p-2 text-right font-normal">Trésorerie</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((w) => {
              const done = Number(w.revenue) >= Number(w.minimum);
              const hours = (new Date(w.period_end).getTime() - Date.now()) / 3_600_000;
              const danger = !done && hours <= 48;
              return (
                <tr key={w.business_id} className="border-b border-white/5">
                  <td className="p-2">
                    <span className="font-display text-sm uppercase text-paper">{w.name}</span>
                    <span className="block text-[11px] text-paper/50">{w.founder ?? "—"}</span>
                  </td>
                  <td className="w-[38%] p-2">
                    <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                      <span className={done ? "text-green-300" : danger ? "text-red-light" : "text-paper"}>{zz(w.revenue)}</span>
                      <span className="text-paper/50">/ {zz(w.minimum)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={clsx("h-full rounded-full", done ? "bg-green-400/80" : danger ? "bg-red" : "bg-blue")} style={{ width: `${Math.max(2, Math.min(1, ratio(w)) * 100)}%` }} />
                    </div>
                  </td>
                  <td className={clsx("hidden p-2 sm:table-cell", danger ? "text-red-light" : "text-paper/70")}>
                    {new Date(w.period_end).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {done && <span className="block text-[11px] text-green-300">objectif atteint</span>}
                  </td>
                  <td className="p-2 text-right text-paper/80">
                    {zz(w.treasury)}
                    {Number(w.pending_withdrawals) > 0 && <span className="block text-[11px] text-[#f0c27a]">{zz(w.pending_withdrawals)} en retrait</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
