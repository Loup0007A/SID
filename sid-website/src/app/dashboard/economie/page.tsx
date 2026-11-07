"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LineChart } from "@/components/LineChart";
import { Spark } from "@/components/market/Spark";
import { SidIcon } from "@/components/icons/SidIcon";
import { arrow, change, day, pct, px, tone, z, zk } from "@/lib/econ";
import type { EconomyOverview } from "@/types/economy";
import "@/components/market/bourse.css";

const MONEY = [
  { key: "money_wallets", label: "Portefeuilles", color: "#8FB3D9" },
  { key: "money_bank", label: "Épargne", color: "#BBD3EA" },
  { key: "money_treasuries", label: "Trésoreries", color: "#f0c27a" },
  { key: "money_population", label: "Population", color: "#b9a6e8" },
  { key: "money_pool", label: "Caisse commune", color: "#D99A9A" },
] as const;

export default function EconomiePage() {
  const supabase = useMemo(() => createClient(), []);
  const [eco, setEco] = useState<EconomyOverview | null>(null);
  const [index, setIndex] = useState<{ at: string; value: number }[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const [e, i] = await Promise.all([supabase.rpc("economy_overview", { p_days: 90 }), supabase.rpc("market_index_series", { p_days: 30 })]);
      if (e.error) return setMissing(true);
      setEco(e.data as EconomyOverview);
      setIndex(((i.data ?? []) as { at: string; value: number }[]).map((p) => ({ ...p, value: Number(p.value) })));
    })();
  }, [supabase]);

  if (missing) return <p className="glass-card max-w-2xl p-6 font-body text-sm text-paper/70">La banque centrale demande la migration 0084.</p>;
  if (!eco) return <p className="glass-card max-w-2xl p-6 font-body text-sm text-paper/60">Chargement des relevés…</p>;

  const t = eco.today;
  if (!t) return <p className="glass-card max-w-2xl p-6 font-body text-sm text-paper/70">Premier relevé pas encore fait : il a lieu une fois par jour.</p>;

  const series = eco.series;
  // Les premiers jours n'ont pas encore d'inflation mesurée : ils ne sont pas tracés.
  const measured = series.filter((p) => p.inflation != null);
  const lost = 1 - Number(t.zeni_value) / 100;
  const infl = t.inflation_30d == null ? null : Number(t.inflation_30d);
  const target = Number(eco.target_30d);
  const policy = t.policy_rate_weekly == null ? null : Number(t.policy_rate_weekly);
  const supply = Number(t.money_supply);
  const parts = MONEY.map((m) => ({ ...m, value: Number(t[m.key]) })).filter((m) => m.value > 0);
  const weekly = (d: number | null) => (d == null ? null : Math.pow(1 + Number(d), 7) - 1);
  const stance =
    infl == null ? "Pas assez d'historique : la banque centrale vise la cible en attendant." : infl > target * 1.5 ? "Les prix montent trop vite : les taux remontent pour freiner la dépense." : infl < target * 0.5 ? "Les prix stagnent : les taux baissent pour relancer l'activité." : "Inflation proche de la cible : taux stables.";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="glass-card grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-paper/55">Relevé du {day(t.day)}</p>
          <h1 className="font-display text-3xl uppercase tracking-wide text-red">Banque centrale</h1>
          <p className="mt-1 max-w-xl font-body text-sm text-paper/70">
            Le cours du zéni se mesure chaque jour sur les prix vraiment payés dans la boutique, aux enchères et par la population. Taux, impôts, seuils et
            plafonds suivent ce relevé{eco.auto ? "" : " — adaptation automatique suspendue par l'administration"}.
          </p>
          <p className="mt-3 font-body text-sm text-paper/85">
            <SidIcon name="info" size={15} /> {stance}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SidIcon name="zeni" size={64} />
          <div>
            <p className="font-mono text-xs uppercase text-paper/60">Cours du zéni</p>
            <p className="bourse-num font-display text-5xl text-paper">{px(t.zeni_value)}</p>
            <p className={`bourse-num font-mono text-xs ${tone(-lost)}`}>
              {lost > 0 ? `${pct(lost, 1)} de pouvoir d'achat perdu` : lost < 0 ? `${pct(-lost, 1)} de pouvoir d'achat gagné` : "Inchangé"} depuis le départ (100)
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: "Indice des prix", v: px(t.price_index), s: `${t.observations} achats relevés, ${t.items_priced} objets`, cls: "text-paper" },
          { k: "Inflation 30 j", v: pct(infl, 2, true), s: `cible ${pct(target, 1)}`, cls: infl == null ? "text-paper/60" : infl > target * 1.5 ? "text-red" : infl < 0 ? "text-blue-light" : "text-paper" },
          { k: "Taux directeur", v: pct(policy, 2), s: "par semaine", cls: "text-paper" },
          { k: "Masse monétaire", v: zk(supply), s: t.money_growth_30d == null ? "" : `${pct(Number(t.money_growth_30d), 1, true)} sur 30 j`, cls: "text-paper" },
          { k: "Épargne", v: pct(t.savings_rate_daily, 3), s: `par jour · ${pct(weekly(t.savings_rate_daily), 2)} par semaine`, cls: "text-blue-light" },
          { k: "Emprunt", v: pct(t.loan_rate_daily, 3), s: `par jour · ${pct(weekly(t.loan_rate_daily), 2)} par semaine`, cls: "text-red-light" },
          { k: "Dépenses 7 j", v: zk(t.spending_7d), s: "boutique, enchères, population", cls: "text-paper" },
          { k: "Dettes", v: zk(Number(t.debt_members) + Number(t.debt_businesses)), s: `membres ${zk(t.debt_members)} · entreprises ${zk(t.debt_businesses)}`, cls: "text-paper" },
        ].map((c) => (
          <div key={c.k} className="glass-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-wide text-paper/55">{c.k}</p>
            <p className={`bourse-num font-display text-2xl ${c.cls}`}>{c.v}</p>
            <p className="font-mono text-[10px] text-paper/50">{c.s}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass-card space-y-2 p-5">
          <h2 className="font-display text-lg uppercase">Prix et cours du zéni</h2>
          {series.length < 2 ? (
            <p className="font-body text-sm text-paper/60">Un point par jour : la courbe apparaît dès le deuxième relevé.</p>
          ) : (
            <LineChart
              labels={series.map((p) => day(p.day))}
              series={[
                { name: "Indice des prix", color: "#D99A9A", values: series.map((p) => Number(p.index)) },
                { name: "Cours du zéni", color: "#f0c27a", values: series.map((p) => Number(p.zeni)) },
              ]}
              refLine={{ value: 100, label: "départ" }}
              formatValue={(n) => px(n)}
              height={220}
            />
          )}
        </section>
        <section className="glass-card space-y-2 p-5">
          <h2 className="font-display text-lg uppercase">Inflation et taux directeur</h2>
          {measured.length < 2 ? (
            <p className="font-body text-sm text-paper/60">L&apos;inflation se calcule sur 30 jours : la courbe se remplit au fil des relevés.</p>
          ) : (
            <LineChart
              labels={measured.map((p) => day(p.day))}
              series={[
                { name: "Inflation 30 j (%)", color: "#D99A9A", values: measured.map((p) => Number(p.inflation) * 100) },
                { name: "Taux directeur hebdo (%)", color: "#8FB3D9", values: measured.map((p) => Number(p.policy ?? 0) * 100) },
              ]}
              refLine={{ value: target * 100, label: "cible" }}
              formatValue={(n) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`}
              height={220}
            />
          )}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="glass-card space-y-3 p-5">
          <h2 className="font-display text-lg uppercase">Où est l&apos;argent</h2>
          <div className="flex h-4 overflow-hidden rounded-full bg-white/5" role="img" aria-label="Répartition de la masse monétaire">
            {parts.map((m) => (
              <span key={m.key} style={{ width: `${(m.value / Math.max(supply, 1)) * 100}%`, background: m.color }} title={`${m.label} : ${z(m.value, 0)}`} />
            ))}
          </div>
          <ul className="space-y-1.5">
            {parts.map((m) => (
              <li key={m.key} className="grid grid-cols-[0.75rem_1fr_auto_3.5rem] items-center gap-2 font-body text-sm">
                <span className="h-3 w-3 rounded-sm" style={{ background: m.color }} />
                <span className="text-paper/85">{m.label}</span>
                <span className="bourse-num font-mono text-xs text-paper">{z(m.value, 0)}</span>
                <span className="bourse-num text-right font-mono text-[11px] text-paper/55">{pct(m.value / Math.max(supply, 1), 0)}</span>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/bourse" className="mt-2 flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5">
            <span className="font-display uppercase text-paper/85">Indice SID</span>
            <span className="flex items-center gap-3">
              <Spark values={index.map((p) => p.value)} width={90} height={26} />
              <span className="bourse-num font-mono text-sm text-paper">{index.length ? px(index.at(-1)!.value) : "—"}</span>
            </span>
          </Link>
        </section>

        <section className="glass-card space-y-3 p-5">
          <h2 className="font-display text-lg uppercase">Le panier</h2>
          <p className="font-body text-xs text-paper/60">Objets les plus achetés sur 14 jours : prix moyen payé, comparé au prix de référence de chaque objet.</p>
          {eco.basket.length === 0 ? (
            <p className="font-body text-sm text-paper/60">Aucun achat relevé ces 14 derniers jours.</p>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-paper/50">
                  <th className="pb-1 font-normal">Objet</th>
                  <th className="pb-1 text-right font-normal">Prix payé</th>
                  <th className="pb-1 text-right font-normal">Écart</th>
                  <th className="pb-1 text-right font-normal">Dépensé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {eco.basket.map((b) => {
                  const c = change(Number(b.price), b.ref == null ? null : Number(b.ref));
                  return (
                    <tr key={b.name}>
                      <td className="max-w-[12rem] truncate py-1.5 font-body text-sm text-paper/90">{b.name}</td>
                      <td className="bourse-num py-1.5 text-right text-paper">{z(b.price)}</td>
                      <td className={`bourse-num py-1.5 text-right ${tone(c == null ? null : -c)}`}>{c == null ? "—" : `${arrow(c)} ${pct(c, 1)}`}</td>
                      <td className="bourse-num py-1.5 text-right text-paper/70">{zk(b.spend)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="glass-card space-y-3 p-5">
        <h2 className="font-display text-lg uppercase">Ce qui suit le cours</h2>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Impôt sur la fortune", `${pct(t.wealth_tax_rate, 2)} par semaine`],
            ["Abattement", z(t.wealth_allowance, 0)],
            ["Impôt sur les sociétés", `${pct(t.corporate_tax_rate, 1)} du bénéfice`],
            ["TVA", pct(eco.vat_rate, 0)],
            ["Chiffre d'affaires minimum", `${z(t.bankruptcy_threshold, 0)} par semaine`],
            ["Plafond d'emprunt", `${z(t.max_debt, 0)} (membre) · ${z(t.max_business_debt, 0)} (entreprise)`],
          ].map(([k, v]) => (
            <p key={k} className="flex justify-between gap-3 border-b border-white/5 py-1 font-body text-sm">
              <span className="text-paper/70">{k}</span>
              <span className="bourse-num font-mono text-xs text-paper">{v}</span>
            </p>
          ))}
        </div>
        <p className="font-body text-xs text-paper/55">
          Les salaires et récompenses fixés par l&apos;administration ne bougent pas ; les salaires de la population suivent les prix.
        </p>
      </section>

      <details className="glass-card p-5">
        <summary className="cursor-pointer list-none font-display uppercase text-paper/85">
          <SidIcon name="info" size={16} /> Comment c&apos;est calculé
        </summary>
        <div className="mt-3 grid gap-4 font-body text-sm text-paper/75 md:grid-cols-2">
          <p>
            <b className="text-paper">Indice des prix</b> : pour chaque objet acheté sur 14 jours, le prix moyen payé est comparé à son prix de référence ; la
            moyenne (géométrique) de ces écarts est pondérée par ce qu&apos;on a dépensé sur chaque objet. Un objet nouveau entre au niveau du jour, il ne fait
            donc pas sauter l&apos;indice. Le relevé est lissé : avec peu d&apos;achats, il bouge peu.
          </p>
          <p>
            <b className="text-paper">Cours du zéni</b> = 10 000 ÷ indice. À 100, un zéni achète autant qu&apos;au départ ; à 95, il achète 5 % de moins.
          </p>
          <p>
            <b className="text-paper">Taux directeur</b> (règle de Taylor) : un taux neutre de 0,5 % par semaine, plus 1,5 point par point d&apos;inflation
            au-dessus de la cible. La pression mesurée mêle les prix (70 %) et la croissance de la masse monétaire (30 %), l&apos;inverse quand peu d&apos;achats
            sont relevés. L&apos;épargne rapporte le taux directeur ; l&apos;emprunt coûte 1 point de plus par semaine.
          </p>
          <p>
            <b className="text-paper">Impôts</b> : leurs taux montent quand la pression dépasse la cible (pour retirer de l&apos;argent du circuit) et baissent
            dans le cas inverse. Les montants en zénis (abattement, seuils, plafonds) sont multipliés par l&apos;indice ÷ 100.
          </p>
        </div>
      </details>
    </div>
  );
}
