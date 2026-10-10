"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LineChart } from "@/components/LineChart";
import {
  WEALTH_CLASS_LABELS,
  WEALTH_CLASS_COLOR,
  MOOD_LABELS,
  type SimAgentRow,
  type SimWealthClass,
  type PopulationStats,
  type PopulationActivityPoint,
} from "@/types/simulation";
import clsx from "clsx";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card space-y-1 p-4">
      <p className="font-mono text-xs uppercase tracking-wide text-paper/60">{label}</p>
      <p className="font-display text-2xl text-blue-light">{value}</p>
    </div>
  );
}

const CLASS_FILTERS: (SimWealthClass | "all")[] = ["all", "pauvre", "moyen", "aise", "riche"];

export default function SimulationPage() {
  const supabase = createClient();
  const [agents, setAgents] = useState<SimAgentRow[]>([]);
  const [stats, setStats] = useState<PopulationStats | null>(null);
  const [activity, setActivity] = useState<PopulationActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<SimWealthClass | "all">("all");
  const [search, setSearch] = useState("");

  async function refresh() {
    const [{ data: pop }, { data: st }, { data: act }] = await Promise.all([
      supabase.rpc("list_population"),
      supabase.rpc("get_population_stats"),
      supabase.rpc("get_population_activity", { p_days: 30 }),
    ]);
    setAgents((pop ?? []) as SimAgentRow[]);
    setStats((st as PopulationStats) ?? null);
    setActivity((act ?? []) as PopulationActivityPoint[]);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
      // Rattrape les jours écoulés depuis la dernière visite de cette page
      // (comme les salaires/le marché : aucun job planifié, juste "à la
      // consultation" — mais ici seulement sur cette page pour ne pas
      // alourdir chaque connexion de chaque membre).
      try {
        const { data: n } = await supabase.rpc("process_population_simulation");
        if (typeof n === "number" && n > 0) {
          setMessage(`Simulation avancée de ${n} jour${n > 1 ? "s" : ""}.`);
          await refresh();
        }
      } catch {
        // silencieux (population pas encore initialisée, ou permission)
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function seed() {
    setSeeding(true);
    setMessage(null);
    const { error } = await supabase.rpc("seed_population", { p_count: 100 });
    setSeeding(false);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage("Population initialisée (100 habitants).");
    await refresh();
  }

  async function advance() {
    setAdvancing(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("process_population_simulation");
    setAdvancing(false);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage(typeof data === "number" && data > 0 ? `Simulation avancée de ${data} jour${data > 1 ? "s" : ""}.` : "Déjà à jour.");
    await refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) => {
      if (classFilter !== "all" && a.wealth_class !== classFilter) return false;
      if (q && !`${a.first_name} ${a.last_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [agents, classFilter, search]);

  if (loading) return <p className="font-body text-paper/60">Chargement de la simulation…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Simulation de population</h1>
        {agents.length > 0 && (
          <button
            onClick={advance}
            disabled={advancing}
            className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            {advancing ? "…" : "Faire avancer la simulation"}
          </button>
        )}
      </div>

      <p className="font-body text-sm text-paper/70">
        100 habitants simulés (pas de vrais comptes) touchent un salaire selon leur classe sociale et dépensent pour
        de vrai dans la boutique et la bourse — ils font vivre l&apos;économie même sans joueurs connectés. Chaque
        jour simulé : nouveau salaire, nouvelle humeur, éventuellement un achat, une mise en couple ou une naissance
        (l&apos;enfant devient adulte immédiatement). Les habitants « riches » paient deux fois plus de taxes.
      </p>

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      {agents.length === 0 ? (
        <div className="glass-card space-y-3 p-6 text-center">
          <p className="font-body text-paper/70">Aucune population simulée pour l&apos;instant.</p>
          <button
            onClick={seed}
            disabled={seeding}
            className="rounded-lg bg-red px-5 py-2 font-display text-sm uppercase text-ink hover:bg-red-light disabled:opacity-40"
          >
            {seeding ? "Création…" : "Initialiser la population (100 habitants)"}
          </button>
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Population" value={stats.total} />
              <StatCard label="Âge moyen" value={`${stats.avg_age} ans`} />
              <StatCard label="Couples" value={stats.couples} />
              <StatCard label="Naissances" value={stats.children_born} />
              <StatCard label="Argent en circulation" value={`${Math.round(stats.total_balance).toLocaleString("fr-FR")} z`} />
              <StatCard label="Dernier jour traité" value={stats.last_processed_day ? new Date(stats.last_processed_day).toLocaleDateString("fr-FR") : "—"} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {CLASS_FILTERS.map((c) => (
              <button
                key={c}
                onClick={() => setClassFilter(c)}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 font-mono text-xs uppercase tracking-wide",
                  classFilter === c ? "border-blue bg-blue text-ink" : "border-blue/40 text-blue hover:bg-blue hover:text-ink"
                )}
              >
                {c === "all" ? "Tous" : WEALTH_CLASS_LABELS[c]}
                {c !== "all" && stats?.by_class[c] != null && <span className="ml-1 opacity-70">({stats.by_class[c]})</span>}
              </button>
            ))}
            <input
              placeholder="Rechercher un nom…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ml-auto rounded-lg border border-paper-dark bg-ink-soft px-3 py-1.5 font-mono text-xs text-paper outline-none focus:border-blue"
            />
          </div>

          <div className="glass-card overflow-x-auto p-2">
            <table className="w-full min-w-[720px] border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-paper/50">
                  <th className="p-2 font-normal uppercase">Nom</th>
                  <th className="p-2 font-normal uppercase">Âge</th>
                  <th className="p-2 font-normal uppercase">Sexe</th>
                  <th className="p-2 font-normal uppercase">Classe</th>
                  <th className="p-2 font-normal uppercase">Salaire/sem.</th>
                  <th className="p-2 font-normal uppercase">Solde</th>
                  <th className="p-2 font-normal uppercase">Humeur</th>
                  <th className="p-2 font-normal uppercase">Chance</th>
                  <th className="p-2 font-normal uppercase">Ambition</th>
                  <th className="p-2 font-normal uppercase">Enfant possible</th>
                  <th className="p-2 font-normal uppercase">Partenaire</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-white/5">
                    <td className="p-2">
                      {a.first_name} {a.last_name}
                      {a.is_child_of_sim && <span className="ml-1 text-paper/40">👶</span>}
                    </td>
                    <td className="p-2">{a.age}</td>
                    <td className="p-2">{a.sex}</td>
                    <td className="p-2">
                      <span style={{ color: WEALTH_CLASS_COLOR[a.wealth_class] }}>{WEALTH_CLASS_LABELS[a.wealth_class]}</span>
                    </td>
                    <td className="p-2">{a.weekly_salary.toLocaleString("fr-FR")} z</td>
                    <td className="p-2 text-blue-light">{Math.round(a.balance).toLocaleString("fr-FR")} z</td>
                    <td className="p-2">{MOOD_LABELS[a.mood]}</td>
                    <td className="p-2">{a.luck}</td>
                    <td className="p-2">{a.ambition}</td>
                    <td className="p-2">{a.can_have_children ? "Oui" : "Non"}</td>
                    <td className="p-2 text-paper/60">{a.partner_name ?? "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-4 text-center text-paper/50">
                      Aucun habitant ne correspond à ce filtre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="glass-card space-y-3 p-6">
            <h2 className="font-display text-lg uppercase">📈 Ce qu&apos;ils font (30 derniers jours)</h2>
            {activity.every((d) => d.items_bought === 0 && d.shares_bought === 0 && d.children === 0) ? (
              <p className="font-body text-sm text-paper/60">Pas encore assez d&apos;activité à afficher.</p>
            ) : (
              <LineChart
                labels={activity.map((d) => `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`)}
                series={[
                  { name: "Objets achetés", color: "#8FB3D9", values: activity.map((d) => d.items_bought) },
                  { name: "Achats d'actions", color: "#D99A9A", values: activity.map((d) => d.shares_bought) },
                  { name: "Naissances", color: "#E8C547", values: activity.map((d) => d.children) },
                ]}
                zeroBased
                fill={false}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
