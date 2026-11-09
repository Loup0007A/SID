"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { LineChart } from "@/components/LineChart";
import { SidIcon } from "@/components/icons/SidIcon";
import { inputClass, labelClass } from "@/lib/ui";
import { WEALTH_CLASS_LABELS, WEALTH_CLASS_COLOR, MOOD_LABELS, type SimAgentRow, type SimWealthClass, type SimMood } from "@/types/simulation";

/**
 * Population simulée (Lot 73, migration 0091) : vue d'ensemble, habitants,
 * pilotage (pause, comportements, événements, prime, arrivées).
 */

type Daily = {
  day: string;
  population: number;
  money: number;
  median: number | null;
  gini: number | null;
  top10_share: number | null;
  salaries: number;
  spent_items: number;
  spent_shares: number;
  purchases: number;
  share_orders: number;
  births: number;
  couples: number;
  spend_mult: number;
  share_mult: number;
};
type Shock = {
  id: string;
  kind: string;
  label: string;
  starts_on: string;
  ends_on: string;
  spend_mult: number;
  share_mult: number;
  mood_bias: SimMood | null;
  cancelled_at: string | null;
  author: string | null;
  active: boolean;
};
type Overview = {
  settings: { paused: boolean; paused_at: string | null; spend: number; shares: number; cap: number; last_day: string | null };
  today: { spend: number; shares: number; mood: SimMood | null };
  series: Daily[];
  classes: { class: SimWealthClass; n: number; money: number; avg: number; salary: number }[];
  moods: Partial<Record<SimMood, number>>;
  ages: { band: number; m: number; f: number }[];
  market: { holdings_value: number; market_cap: number; open_orders: number; volume_7: number; volume_pop_7: number };
  shocks: Shock[];
  events: { day: string; kind: string; amount: number | null; detail: string | null; name: string | null; partner: string | null }[];
};
type Detail = SimAgentRow & {
  created_on_day: string;
  partner: { id: string; name: string } | null;
  parents: { id: string; name: string }[];
  children: { id: string; name: string }[];
  holdings: { name: string; qty: number; value: number }[];
  events: { day: string; kind: string; amount: number | null; detail: string | null }[];
  spent_30: number;
  earned_30: number;
};

const z = (n: number | null | undefined, d = 0) => `${Number(n ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: d })} z`;
const fmtDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fx = (n: number) => `× ${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`;
const MOOD_COLOR: Record<SimMood, string> = { radin: "#B97575", neutre: "#9aa0b4", depensier: "#f0c27a", genereux: "#5fdc8a", inspire: "#8FB3D9" };
const EVENT_LABEL: Record<string, string> = {
  child: "Naissance",
  couple: "Couple",
  arrival: "Arrivée",
  purchase_item: "Achat",
  buy_shares: "Ordre de bourse",
  bonus: "Prime",
};
const PRESETS: { kind: string; label: string; text: string }[] = [
  { kind: "fete", label: "Fête", text: "Dépenses en hausse, humeur dépensière." },
  { kind: "crise", label: "Crise", text: "Dépenses et bourse en forte baisse, humeur radine." },
  { kind: "euphorie", label: "Euphorie boursière", text: "Bien plus d'achats d'actions, humeur inspirée." },
  { kind: "morosite", label: "Morosité", text: "Un peu moins de tout." },
  { kind: "libre", label: "Réglage libre", text: "Tes propres multiplicateurs." },
];

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass-card space-y-0.5 p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">{label}</p>
      <p className="font-display text-2xl text-blue-light">{value}</p>
      {hint && <p className="font-mono text-[10px] text-paper/50">{hint}</p>}
    </div>
  );
}

export default function SimulationPage() {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"apercu" | "habitants" | "pilotage">("apercu");
  const [ov, setOv] = useState<Overview | null>(null);
  const [agents, setAgents] = useState<SimAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const say = (ok: boolean, text: string) => setMsg({ ok, text });

  const refresh = useCallback(async () => {
    const [o, p] = await Promise.all([supabase.rpc("get_population_overview", { p_days: 30 }), supabase.rpc("list_population")]);
    if (o.error) setMissing(o.error.message.includes("get_population_overview"));
    else setOv(o.data as Overview);
    setAgents((p.data ?? []) as SimAgentRow[]);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
      // Rattrape les jours écoulés depuis la dernière visite (sauf pause).
      const { data: n } = await supabase.rpc("process_population_simulation");
      if (typeof n === "number" && n > 0) {
        say(true, `Simulation avancée de ${n} jour${n > 1 ? "s" : ""}.`);
        await refresh();
      }
    })();
  }, [supabase, refresh]);

  async function call(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) return say(false, error.message);
    say(true, ok);
    await refresh();
  }

  if (loading) return <p className="font-body text-paper/60">Chargement de la simulation…</p>;
  if (missing) return <p className="glass-card max-w-2xl p-6 font-body text-sm text-paper/70">La nouvelle page Simulation demande la migration 0091.</p>;

  if (agents.length === 0) {
    return (
      <div className="glass-card mx-auto max-w-xl space-y-3 p-6 text-center">
        <h1 className="font-display text-2xl uppercase text-red">Population simulée</h1>
        <p className="font-body text-paper/70">Aucune population pour l&apos;instant.</p>
        <button
          onClick={() => call("seed_population", { p_count: 100 }, "Population initialisée (100 habitants).")}
          disabled={busy}
          className="rounded-lg bg-red px-5 py-2 font-display text-sm uppercase text-ink hover:bg-red-light disabled:opacity-40"
        >
          Initialiser la population (100 habitants)
        </button>
      </div>
    );
  }

  const s = ov?.settings;
  const last = ov?.series.at(-1) ?? null;
  const week = (ov?.series ?? []).slice(-7);
  const spent7 = week.reduce((a, d) => a + Number(d.spent_items) + Number(d.spent_shares), 0);
  const marketShare = ov && ov.market.market_cap > 0 ? ov.market.holdings_value / ov.market.market_cap : null;
  const volShare = ov && ov.market.volume_7 > 0 ? ov.market.volume_pop_7 / ov.market.volume_7 : null;
  const activeShocks = (ov?.shocks ?? []).filter((k) => k.active);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-red">Population simulée</h1>
          <p className="max-w-2xl font-body text-sm text-paper/70">
            Des habitants fictifs touchent un salaire selon leur classe, achètent en boutique, passent des ordres en bourse, se mettent en couple et ont des
            enfants. Ils font vivre l&apos;économie même sans joueurs connectés.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={clsx("rounded-full border px-3 py-1 font-mono text-[11px] uppercase", s?.paused ? "border-yellow-400/70 text-yellow-300" : "border-green-400/60 text-green-300")}>
            {s?.paused ? "En pause" : "En marche"}
          </span>
          {s?.last_day && <span className="font-mono text-[11px] text-paper/55">dernier jour simulé : {new Date(s.last_day).toLocaleDateString("fr-FR")}</span>}
          <button
            disabled={busy || s?.paused}
            onClick={async () => {
              setBusy(true);
              const { data, error } = await supabase.rpc("process_population_simulation");
              setBusy(false);
              if (error) return say(false, error.message);
              say(true, typeof data === "number" && data > 0 ? `Simulation avancée de ${data} jour${data > 1 ? "s" : ""}.` : "Déjà à jour.");
              await refresh();
            }}
            className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            Faire avancer
          </button>
          <button
            disabled={busy}
            onClick={() => call("sim_set_settings", { p_paused: !s?.paused }, s?.paused ? "Simulation relancée." : "Simulation en pause.")}
            className="rounded-lg border border-white/25 px-3 py-1.5 font-mono text-xs uppercase text-paper hover:bg-white/10 disabled:opacity-40"
          >
            {s?.paused ? "Reprendre" : "Mettre en pause"}
          </button>
        </div>
      </header>

      {msg && <p className={clsx("font-mono text-xs", msg.ok ? "text-green-300" : "text-red")}>{msg.text}</p>}

      {activeShocks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeShocks.map((k) => (
            <span key={k.id} className="rounded-full border border-[#f0c27a]/60 bg-[#f0c27a]/10 px-3 py-1 font-mono text-[11px] text-[#f0c27a]">
              {k.label} jusqu&apos;au {fmtDay(k.ends_on)} · dépenses {fx(k.spend_mult)} · bourse {fx(k.share_mult)}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-white/10" role="tablist">
        {(
          [
            ["apercu", "Vue d'ensemble"],
            ["habitants", `Habitants (${agents.length})`],
            ["pilotage", "Pilotage"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={clsx("-mb-px border-b-2 px-3 py-2 font-mono text-xs uppercase", tab === k ? "border-red text-paper" : "border-transparent text-paper/55 hover:text-paper")}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "apercu" && ov && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label="Habitants" value={String(agents.length)} hint={`${s?.cap ?? "—"} au plus (naissances)`} />
            <Tile label="Argent détenu" value={z(last?.money ?? agents.reduce((a, b) => a + Number(b.balance), 0))} />
            <Tile label="Solde médian" value={z(last?.median)} />
            <Tile label="Inégalités" value={last?.gini != null ? `${Math.round(Number(last.gini) * 100)} %` : "—"} hint={last?.top10_share != null ? `les 10 % les plus riches : ${Math.round(Number(last.top10_share) * 100)} % de l'argent` : "coefficient de Gini"} />
            <Tile label="Dépenses (7 j)" value={z(spent7)} hint="objets et actions" />
            <Tile label="Part de la bourse" value={marketShare != null ? `${Math.round(marketShare * 100)} %` : "—"} hint={volShare != null ? `${Math.round(volShare * 100)} % des échanges (7 j) · ${ov.market.open_orders} ordres ouverts` : undefined} />
          </div>

          {ov.series.length >= 2 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="glass-card space-y-3 p-5">
                <h2 className="font-display text-lg uppercase">
                  <SidIcon name="chart" /> Ce qui entre et ce qui sort, par jour
                </h2>
                <LineChart
                  labels={ov.series.map((d) => fmtDay(d.day))}
                  series={[
                    { name: "Salaires reçus", color: "#5fdc8a", values: ov.series.map((d) => Number(d.salaries)) },
                    { name: "Achats d'objets", color: "#8FB3D9", values: ov.series.map((d) => Number(d.spent_items)) },
                    { name: "Ordres de bourse", color: "#f0c27a", values: ov.series.map((d) => Number(d.spent_shares)) },
                  ]}
                  zeroBased
                  fill={false}
                  height={220}
                  formatValue={(n) => z(n)}
                />
              </section>
              <section className="glass-card space-y-3 p-5">
                <h2 className="font-display text-lg uppercase">
                  <SidIcon name="coins" /> Argent détenu et inégalités
                </h2>
                <LineChart
                  labels={ov.series.map((d) => fmtDay(d.day))}
                  series={[{ name: "Argent détenu", color: "#8FB3D9", values: ov.series.map((d) => Number(d.money)) }]}
                  height={150}
                  formatValue={(n) => z(n)}
                />
                <LineChart
                  labels={ov.series.map((d) => fmtDay(d.day))}
                  series={[
                    { name: "Gini (%)", color: "#D99A9A", values: ov.series.map((d) => Math.round(Number(d.gini ?? 0) * 1000) / 10) },
                    { name: "Part des 10 % les plus riches (%)", color: "#f0c27a", values: ov.series.map((d) => Math.round(Number(d.top10_share ?? 0) * 1000) / 10) },
                  ]}
                  height={150}
                  fill={false}
                  formatValue={(n) => `${n.toLocaleString("fr-FR")} %`}
                />
              </section>
            </div>
          ) : (
            <p className="glass-card p-5 font-body text-sm text-paper/60">Les courbes apparaissent après deux jours simulés.</p>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="glass-card space-y-3 p-5">
              <h2 className="font-display text-lg uppercase">Classes</h2>
              <ul className="space-y-2">
                {ov.classes.map((c) => {
                  const total = ov.classes.reduce((a, b) => a + Number(b.money), 0) || 1;
                  return (
                    <li key={c.class} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 font-body text-sm">
                        <span style={{ color: WEALTH_CLASS_COLOR[c.class] }}>
                          {WEALTH_CLASS_LABELS[c.class]} <span className="font-mono text-[11px] text-paper/50">· {c.n}</span>
                        </span>
                        <span className="font-mono text-[11px] text-paper/65">
                          moy. {z(c.avg)} · salaire {z(c.salary)}/sem.
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full" style={{ width: `${(Number(c.money) / total) * 100}%`, background: WEALTH_CLASS_COLOR[c.class] }} />
                      </div>
                      <p className="text-right font-mono text-[10px] text-paper/45">{Math.round((Number(c.money) / total) * 100)} % de l&apos;argent</p>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="glass-card space-y-3 p-5">
              <h2 className="font-display text-lg uppercase">Humeurs du jour</h2>
              {(Object.keys(MOOD_LABELS) as SimMood[]).map((m) => {
                const n = ov.moods[m] ?? 0;
                return (
                  <div key={m} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-2 font-body text-sm">
                    <span className="text-paper/80">{MOOD_LABELS[m]}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-white/5">
                      <span className="block h-full rounded-full" style={{ width: `${(n / Math.max(1, agents.length)) * 100}%`, background: MOOD_COLOR[m] }} />
                    </span>
                    <span className="text-right font-mono text-xs text-paper/65">{n}</span>
                  </div>
                );
              })}
              <p className="font-body text-xs text-paper/55">
                Un dépensier achète plus et plus cher, un radin se retient, un inspiré tente la bourse. L&apos;humeur se garde souvent d&apos;un jour à
                l&apos;autre.
              </p>
            </section>

            <section className="glass-card space-y-3 p-5">
              <h2 className="font-display text-lg uppercase">Pyramide des âges</h2>
              <div className="space-y-1">
                {[...ov.ages].reverse().map((a) => {
                  const max = Math.max(1, ...ov.ages.map((x) => Math.max(x.m, x.f)));
                  return (
                    <div key={a.band} className="grid grid-cols-[1fr_3.2rem_1fr] items-center gap-1.5 font-mono text-[10px]">
                      <span className="flex justify-end">
                        <span className="h-3 rounded-l bg-[#8FB3D9]/70" style={{ width: `${(a.m / max) * 100}%` }} title={`${a.m} hommes`} />
                      </span>
                      <span className="text-center text-paper/60">{a.band >= 80 ? "80+" : `${a.band}–${a.band + 9}`}</span>
                      <span>
                        <span className="block h-3 rounded-r bg-[#D99A9A]/70" style={{ width: `${(a.f / max) * 100}%` }} title={`${a.f} femmes`} />
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="flex justify-between font-mono text-[10px] text-paper/55">
                <span>Hommes</span>
                <span>Femmes</span>
              </p>
            </section>
          </div>

          <section className="glass-card space-y-3 p-5">
            <h2 className="font-display text-lg uppercase">Dernières nouvelles</h2>
            {ov.events.length === 0 ? (
              <p className="font-body text-sm text-paper/55">Rien de notable pour l&apos;instant.</p>
            ) : (
              <ul className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                {ov.events.map((e, i) => (
                  <li key={i} className="flex items-baseline gap-2 border-b border-white/5 py-1 font-body text-sm">
                    <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] uppercase text-paper/50">
                      {fmtDay(e.day)} · {e.kind === "buy_shares" ? "Bourse" : EVENT_LABEL[e.kind] ?? e.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-paper/85" title={e.detail ?? undefined}>
                      {e.kind === "child"
                        ? `${e.name ?? "—"}, ${(e.detail ?? "").replace(/^Enfant de ([AEIOUYÉÈÊ])/, "enfant d'$1").replace(/^Enfant/, "enfant")}`
                        : e.kind === "couple"
                          ? `${e.name ?? "—"}${e.partner ? ` et ${e.partner}` : ""}`
                          : e.kind === "arrival"
                            ? e.name
                            : `${e.name ?? "—"}${e.detail ? ` · ${e.detail}` : ""}`}
                    </span>
                    {e.amount != null && <span className="shrink-0 font-mono text-[11px] text-paper/60">{z(e.amount)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "habitants" && <Residents agents={agents} onOpen={setOpen} />}

      {tab === "pilotage" && ov && <Controls ov={ov} busy={busy} call={call} />}

      {open && <AgentDrawer id={open} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </div>
  );
}

// ------------------------------------------------------------------ Habitants
type SortKey = "name" | "age" | "wealth_class" | "weekly_salary" | "balance" | "mood";
const CLASS_ORDER: Record<SimWealthClass, number> = { pauvre: 1, moyen: 2, aise: 3, riche: 4 };

function Residents({ agents, onOpen }: { agents: SimAgentRow[]; onOpen: (id: string) => void }) {
  const [cls, setCls] = useState<SimWealthClass | "all">("all");
  const [mood, setMood] = useState<SimMood | "all">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "balance", dir: -1 });
  const [page, setPage] = useState(0);
  const PER = 25;

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = agents.filter(
      (a) => (cls === "all" || a.wealth_class === cls) && (mood === "all" || a.mood === mood) && (!s || `${a.first_name} ${a.last_name}`.toLowerCase().includes(s))
    );
    const val = (a: SimAgentRow) =>
      sort.key === "name" ? `${a.last_name} ${a.first_name}` : sort.key === "wealth_class" ? CLASS_ORDER[a.wealth_class] : sort.key === "mood" ? a.mood : Number(a[sort.key]);
    return out.sort((x, y) => (val(x) < val(y) ? -1 : val(x) > val(y) ? 1 : 0) * sort.dir);
  }, [agents, cls, mood, q, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const shown = rows.slice(page * PER, page * PER + PER);
  const head = (key: SortKey, label: string) => (
    <th className="p-2 font-normal uppercase">
      <button
        onClick={() => {
          setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }));
          setPage(0);
        }}
        className={clsx("uppercase hover:text-paper", sort.key === key && "text-paper")}
      >
        {label}
        {sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pauvre", "moyen", "aise", "riche"] as const).map((c) => (
          <button
            key={c}
            onClick={() => {
              setCls(c);
              setPage(0);
            }}
            className={clsx("rounded-lg border px-3 py-1.5 font-mono text-xs uppercase", cls === c ? "border-blue bg-blue text-ink" : "border-blue/40 text-blue hover:bg-blue hover:text-ink")}
          >
            {c === "all" ? "Tous" : WEALTH_CLASS_LABELS[c]}
          </button>
        ))}
        <select
          value={mood}
          onChange={(e) => {
            setMood(e.target.value as SimMood | "all");
            setPage(0);
          }}
          className="rounded-lg border border-paper-dark bg-ink-soft px-2 py-1.5 font-mono text-xs text-paper"
          aria-label="Humeur"
        >
          <option value="all">Toutes les humeurs</option>
          {(Object.keys(MOOD_LABELS) as SimMood[]).map((m) => (
            <option key={m} value={m}>
              {MOOD_LABELS[m]}
            </option>
          ))}
        </select>
        <input
          placeholder="Rechercher un nom…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          className="ml-auto rounded-lg border border-paper-dark bg-ink-soft px-3 py-1.5 font-mono text-xs text-paper outline-none focus:border-blue"
        />
      </div>

      <div className="glass-card overflow-x-auto p-2">
        <table className="w-full min-w-[680px] border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-white/10 text-left text-paper/60">
              {head("name", "Nom")}
              {head("age", "Âge")}
              {head("wealth_class", "Classe")}
              {head("weekly_salary", "Salaire/sem.")}
              {head("balance", "Solde")}
              {head("mood", "Humeur")}
              <th className="p-2 font-normal uppercase">Couple</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.id} onClick={() => onOpen(a.id)} className="cursor-pointer border-b border-white/5 hover:bg-white/5">
                <td className="p-2 font-body text-sm text-paper">
                  {a.first_name} {a.last_name}
                  {a.is_child_of_sim && (
                    <span className="ml-1 text-paper/55" title="Né dans la simulation">
                      <SidIcon name="baby" size={13} />
                    </span>
                  )}
                  <span className="ml-1 text-paper/40">{a.sex === "F" ? "♀" : "♂"}</span>
                </td>
                <td className="p-2">{a.age}</td>
                <td className="p-2" style={{ color: WEALTH_CLASS_COLOR[a.wealth_class] }}>
                  {WEALTH_CLASS_LABELS[a.wealth_class]}
                </td>
                <td className="p-2">{z(a.weekly_salary)}</td>
                <td className={clsx("p-2", a.balance < 0 ? "text-red" : "text-blue-light")}>{z(a.balance)}</td>
                <td className="p-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: MOOD_COLOR[a.mood] }} />
                    {MOOD_LABELS[a.mood]}
                  </span>
                </td>
                <td className="p-2 text-paper/60">{a.partner_name ?? "—"}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-paper/60">
                  Aucun habitant ne correspond.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 font-mono text-xs text-paper/70">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border border-white/15 px-2 py-1 disabled:opacity-30">
            ←
          </button>
          <span>
            {page + 1} / {pages} · {rows.length} habitants
          </span>
          <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded border border-white/15 px-2 py-1 disabled:opacity-30">
            →
          </button>
        </div>
      )}
    </div>
  );
}

function AgentDrawer({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (id: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => {
    setD(null);
    supabase.rpc("sim_agent_detail", { p_id: id }).then(({ data }) => setD((data ?? null) as Detail | null));
  }, [supabase, id]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const Link = ({ p }: { p: { id: string; name: string } }) => (
    <button onClick={() => onOpen(p.id)} className="text-blue underline-offset-2 hover:underline">
      {p.name}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Fiche de l'habitant">
      <aside className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-ink p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-right font-mono text-xs uppercase text-paper/60 hover:text-paper">
          Fermer
        </button>
        {!d ? (
          <p className="font-body text-sm text-paper/60">Chargement…</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-2xl uppercase text-paper">
                {d.first_name} {d.last_name}
              </h2>
              <p className="font-mono text-xs text-paper/60">
                {d.sex === "F" ? "Femme" : "Homme"}, {d.age} ans · <span style={{ color: WEALTH_CLASS_COLOR[d.wealth_class] }}>{WEALTH_CLASS_LABELS[d.wealth_class]}</span> · {d.sex === "F" ? "arrivée" : "arrivé"} le{" "}
                {new Date(d.created_on_day).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Solde" value={z(d.balance)} />
              <Tile label="Salaire" value={`${z(d.weekly_salary)}/sem.`} />
              <Tile label="Dépensé (30 j)" value={z(d.spent_30)} />
              <Tile label="Reçu (30 j)" value={z(d.earned_30)} />
            </div>
            <div className="space-y-2">
              {[
                ["Chance", d.luck],
                ["Ambition", d.ambition],
              ].map(([k, v]) => (
                <div key={k as string} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-2 font-mono text-xs">
                  <span className="text-paper/65">{k}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-white/5">
                    <span className="block h-full rounded-full bg-[#f0c27a]/80" style={{ width: `${v}%` }} />
                  </span>
                  <span className="text-right text-paper/70">{v}</span>
                </div>
              ))}
              <p className="font-mono text-xs text-paper/65">
                Humeur : <span style={{ color: MOOD_COLOR[d.mood] }}>{MOOD_LABELS[d.mood]}</span> · {d.can_have_children ? "peut avoir des enfants" : "pas d'enfant possible"}
              </p>
            </div>
            <div className="space-y-1 font-body text-sm">
              <p className={labelClass}>Famille</p>
              <p className="text-paper/80">Partenaire : {d.partner ? <Link p={d.partner} /> : "—"}</p>
              {d.parents.length > 0 && (
                <p className="text-paper/80">
                  Parents :{" "}
                  {d.parents.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ", "}
                      <Link p={p} />
                    </span>
                  ))}
                </p>
              )}
              {d.children.length > 0 && (
                <p className="text-paper/80">
                  Enfants :{" "}
                  {d.children.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ", "}
                      <Link p={p} />
                    </span>
                  ))}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className={labelClass}>Actions détenues</p>
              {d.holdings.length === 0 ? (
                <p className="font-body text-sm text-paper/55">Aucune.</p>
              ) : (
                d.holdings.map((h) => (
                  <p key={h.name} className="flex justify-between font-body text-sm">
                    <span className="text-paper/85">{h.name}</span>
                    <span className="font-mono text-xs text-paper/65">
                      {h.qty} · {z(h.value)}
                    </span>
                  </p>
                ))
              )}
            </div>
            <div className="space-y-1">
              <p className={labelClass}>Derniers faits</p>
              {d.events.length === 0 ? (
                <p className="font-body text-sm text-paper/55">Rien de notable.</p>
              ) : (
                <ul className="space-y-0.5">
                  {d.events.map((e, i) => (
                    <li key={i} className="flex gap-2 font-body text-sm">
                      <span className="w-12 shrink-0 font-mono text-[10px] text-paper/50">{fmtDay(e.day)}</span>
                      <span className="flex-1 text-paper/80">
                        {EVENT_LABEL[e.kind] ?? e.kind}
                        {e.detail && e.kind !== "couple" && e.kind !== "arrival" && ` · ${e.detail}`}
                      </span>
                      {e.amount != null && <span className="font-mono text-[11px] text-paper/60">{z(e.amount)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ Pilotage
function Controls({ ov, busy, call }: { ov: Overview; busy: boolean; call: (fn: string, args: Record<string, unknown>, ok: string) => Promise<void> }) {
  const [spend, setSpend] = useState(Number(ov.settings.spend));
  const [shares, setShares] = useState(Number(ov.settings.shares));
  const [cap, setCap] = useState(String(ov.settings.cap));
  const [kind, setKind] = useState("fete");
  const [days, setDays] = useState("3");
  const [intensity, setIntensity] = useState(1);
  const [freeSpend, setFreeSpend] = useState(1.5);
  const [freeShares, setFreeShares] = useState(1);
  const [label, setLabel] = useState("");
  const [bonus, setBonus] = useState("");
  const [bonusClass, setBonusClass] = useState<SimWealthClass | "">("");
  const [arrivals, setArrivals] = useState("10");
  const [arrClass, setArrClass] = useState<SimWealthClass | "">("");

  const slider = (v: number, set: (n: number) => void, min: number, max: number, step: number, aria: string) => (
    <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} className="w-full accent-[#f0c27a]" aria-label={aria} />
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="glass-card space-y-4 p-5">
        <h2 className="font-display text-lg uppercase">Comportement</h2>
        <div className="space-y-1">
          <div className="flex justify-between font-body text-sm">
            <span>Envie de dépenser</span>
            <span className="font-mono text-[#f0c27a]">{fx(spend)}</span>
          </div>
          {slider(spend, setSpend, 0.2, 3, 0.05, "Envie de dépenser")}
          <p className="font-body text-xs text-paper/55">Chance d&apos;acheter chaque jour. À × 1, environ un habitant sur trois achète.</p>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between font-body text-sm">
            <span>Appétit pour la bourse</span>
            <span className="font-mono text-[#f0c27a]">{fx(shares)}</span>
          </div>
          {slider(shares, setShares, 0.2, 3, 0.05, "Appétit pour la bourse")}
          <p className="font-body text-xs text-paper/55">Part des achats qui vont en actions, et montant engagé.</p>
        </div>
        <label className="block space-y-1">
          <span className={labelClass}>Habitants au plus (les naissances s&apos;arrêtent au-delà)</span>
          <input type="number" min={10} max={2000} className={inputClass} value={cap} onChange={(e) => setCap(e.target.value)} />
        </label>
        <p className="font-mono text-[11px] text-paper/55">
          Aujourd&apos;hui, avec les événements : dépenses {fx(ov.today.spend)} · bourse {fx(ov.today.shares)}
          {ov.today.mood && ` · humeur ${MOOD_LABELS[ov.today.mood].toLowerCase()}`}
        </p>
        <button
          disabled={busy}
          onClick={() => call("sim_set_settings", { p_spend: spend, p_shares: shares, p_cap: Number(cap) }, "Réglages enregistrés.")}
          className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
        >
          Enregistrer
        </button>
      </section>

      <section className="glass-card space-y-4 p-5">
        <h2 className="font-display text-lg uppercase">Événements</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRESETS.map((p) => (
            <button
              key={p.kind}
              type="button"
              aria-pressed={kind === p.kind}
              onClick={() => setKind(p.kind)}
              className={clsx("rounded-xl border p-3 text-left", kind === p.kind ? "border-[#f0c27a] bg-[#f0c27a]/10" : "border-white/10 hover:border-white/25")}
            >
              <span className="block font-display uppercase text-paper">{p.label}</span>
              <span className="block font-body text-xs text-paper/60">{p.text}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={labelClass}>Durée (jours)</span>
            <input type="number" min={1} max={60} className={inputClass} value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
          {kind === "libre" ? (
            <label className="space-y-1">
              <span className={labelClass}>Nom</span>
              <input className={inputClass} maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. : Salon du commerce" />
            </label>
          ) : (
            <div className="space-y-1">
              <span className={labelClass}>Intensité {fx(intensity)}</span>
              {slider(intensity, setIntensity, 0.25, 2, 0.05, "Intensité")}
            </div>
          )}
        </div>
        {kind === "libre" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className={labelClass}>Dépenses {fx(freeSpend)}</span>
              {slider(freeSpend, setFreeSpend, 0.1, 5, 0.05, "Dépenses")}
            </div>
            <div className="space-y-1">
              <span className={labelClass}>Bourse {fx(freeShares)}</span>
              {slider(freeShares, setFreeShares, 0.1, 5, 0.05, "Bourse")}
            </div>
          </div>
        )}
        <button
          disabled={busy}
          onClick={() =>
            call(
              "sim_shock_start",
              { p_kind: kind, p_days: Number(days), p_intensity: intensity, p_spend: freeSpend, p_shares: freeShares, p_label: label || null },
              "Événement lancé : il compte dès le prochain jour simulé."
            )
          }
          className="rounded-lg bg-[#f0c27a] px-4 py-2 font-display text-sm uppercase text-ink hover:brightness-110 disabled:opacity-40"
        >
          Lancer
        </button>
        {ov.shocks.length > 0 && (
          <ul className="space-y-1 border-t border-white/10 pt-3">
            {ov.shocks.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-body text-sm">
                <span className={clsx("rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase", k.active ? "border-green-400/60 text-green-300" : "border-white/20 text-paper/50")}>
                  {k.active ? "en cours" : k.cancelled_at ? "arrêté" : new Date(k.starts_on) > new Date() ? "à venir" : "fini"}
                </span>
                <span className="text-paper">{k.label}</span>
                <span className="font-mono text-[11px] text-paper/55">
                  {fmtDay(k.starts_on)} → {fmtDay(k.ends_on)} · dépenses {fx(k.spend_mult)} · bourse {fx(k.share_mult)}
                </span>
                {k.active && (
                  <button onClick={() => call("sim_shock_end", { p_id: k.id }, "Événement arrêté.")} className="ml-auto font-mono text-[11px] uppercase text-paper/60 hover:text-red-light">
                    Arrêter
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-card space-y-3 p-5">
        <h2 className="font-display text-lg uppercase">Prime exceptionnelle</h2>
        <p className="font-body text-sm text-paper/65">Versée tout de suite à chaque habitant. C&apos;est de l&apos;argent créé : les prix peuvent monter.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="space-y-1">
            <span className={labelClass}>Montant par habitant</span>
            <input type="number" min={1} className={inputClass} value={bonus} onChange={(e) => setBonus(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Pour</span>
            <select className={inputClass} value={bonusClass} onChange={(e) => setBonusClass(e.target.value as SimWealthClass | "")}>
              <option value="">Tous</option>
              {(["pauvre", "moyen", "aise", "riche"] as SimWealthClass[]).map((c) => (
                <option key={c} value={c}>
                  {WEALTH_CLASS_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !Number(bonus)}
            onClick={() => {
              const n = bonusClass ? ov.classes.find((c) => c.class === bonusClass)?.n ?? 0 : ov.classes.reduce((a, c) => a + c.n, 0);
              if (!confirm(`Verser ${z(Number(bonus))} à ${n} habitants, soit ${z(Number(bonus) * n)} créés ?`)) return;
              void call("sim_bonus", { p_amount: Number(bonus), p_class: bonusClass || null }, "Prime versée.");
            }}
            className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            Verser
          </button>
        </div>
      </section>

      <section className="glass-card space-y-3 p-5">
        <h2 className="font-display text-lg uppercase">Nouveaux habitants</h2>
        <p className="font-body text-sm text-paper/65">Ils arrivent avec un salaire et une petite somme selon leur classe.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="space-y-1">
            <span className={labelClass}>Nombre</span>
            <input type="number" min={1} max={200} className={inputClass} value={arrivals} onChange={(e) => setArrivals(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Classe</span>
            <select className={inputClass} value={arrClass} onChange={(e) => setArrClass(e.target.value as SimWealthClass | "")}>
              <option value="">Au hasard</option>
              {(["pauvre", "moyen", "aise", "riche"] as SimWealthClass[]).map((c) => (
                <option key={c} value={c}>
                  {WEALTH_CLASS_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !Number(arrivals)}
            onClick={() => call("sim_add_agents", { p_count: Number(arrivals), p_class: arrClass || null }, `${arrivals} habitant(s) arrivé(s).`)}
            className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            Accueillir
          </button>
        </div>
      </section>
    </div>
  );
}
