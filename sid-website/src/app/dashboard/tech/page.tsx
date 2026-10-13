"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";

interface TechNode {
  key: string;
  label: string;
  description: string;
  emoji: string;
  branch: string;
  max_level: number;
  cost_base: number;
  cost_step: number;
  effect_pct: number;
  requires_key: string | null;
  requires_level: number;
  sort: number;
}

const cost = (n: TechNode, level: number) => n.cost_base + n.cost_step * level;

/**
 * Arbre technologique : les points gagnés dans les simulations (1 par
 * réussite) s'échangent contre des améliorations permanentes. Les règles
 * (coûts, prérequis, effets) sont en base : tables tech_nodes / member_tech,
 * fonction buy_tech (migration 0054).
 */
export default function TechTreePage() {
  const supabase = createClient();
  const [nodes, setNodes] = useState<TechNode[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [points, setPoints] = useState<number | null>(null);
  const [rank, setRank] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const [{ data: n }, { data: mine }, { data: ov }, { data: prof }] = await Promise.all([
      supabase.from("tech_nodes").select("*").order("sort"),
      supabase.from("member_tech").select("node, level").eq("user_id", auth.user.id),
      supabase.rpc("get_simulation_overview"),
      supabase.from("profiles").select("member_rank").eq("id", auth.user.id).maybeSingle(),
    ]);
    setNodes((n ?? []) as TechNode[]);
    setLevels(Object.fromEntries(((mine ?? []) as { node: string; level: number }[]).map((m) => [m.node, m.level])));
    setPoints(Number((ov as { tech_points?: number } | null)?.tech_points ?? 0));
    setRank(prof?.member_rank ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function buy(n: TechNode) {
    setBuying(n.key);
    setMessage(null);
    const { data, error } = await supabase.rpc("buy_tech", { p_node: n.key });
    setBuying(null);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    const r = data as { level: number; rank?: string };
    setMessage({
      ok: true,
      text: n.key === "rank" ? `Promotion obtenue : te voilà rang ${r.rank} !` : `${n.label} passe au niveau ${r.level}.`,
    });
    await refresh();
  }

  const branches = Array.from(new Set(nodes.map((n) => n.branch)));
  const byKey = Object.fromEntries(nodes.map((n) => [n.key, n]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-red">Arbre technologique</h1>
          <p className="max-w-2xl font-body text-sm text-paper/70">
            Chaque simulation réussie te donne un point. Dépense-les ici pour des améliorations permanentes. Tes
            facteurs de puissance ne baissent pas quand tu dépenses.
          </p>
        </div>
        <div className="glass-card px-5 py-3 text-right">
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">Points disponibles</p>
          <p className="font-display text-3xl text-blue">{points ?? "…"}</p>
          {rank && <p className="font-mono text-[10px] uppercase text-paper/50">Rang actuel : {rank}</p>}
        </div>
      </div>

      {message && (
        <p
          className={clsx(
            "rounded-lg border px-3 py-2 font-body text-sm",
            message.ok ? "border-blue/50 bg-blue/10 text-blue-light" : "border-red/50 bg-red/10 text-red-light"
          )}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {branches.map((branch) => (
          <section key={branch} className="space-y-0">
            <h2 className="mb-3 text-center font-mono text-xs uppercase tracking-[0.25em] text-paper/50">{branch}</h2>
            {nodes
              .filter((n) => n.branch === branch)
              .map((n, i) => {
                const level = levels[n.key] ?? 0;
                const maxed = level >= n.max_level;
                const req = n.requires_key ? byKey[n.requires_key] : null;
                const locked = !!req && (levels[req.key] ?? 0) < n.requires_level;
                const price = cost(n, level);
                const affordable = points !== null && points >= price;
                const rankMaxed = n.key === "rank" && rank === "S";
                return (
                  <div key={n.key} className="flex flex-col items-center">
                    {i > 0 && <div className={clsx("h-6 w-0.5", locked ? "bg-white/15" : "bg-blue/60")} aria-hidden />}
                    <div
                      className={clsx(
                        "glass-card w-full space-y-2 p-4 transition",
                        locked && "opacity-50",
                        maxed && "border-blue/60"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl" aria-hidden>
                          {n.emoji}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display uppercase tracking-wide">{n.label}</p>
                          <p className="font-body text-xs text-paper/70">{n.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-1" aria-label={`Niveau ${level} sur ${n.max_level}`}>
                        {Array.from({ length: n.max_level }, (_, k) => (
                          <span key={k} className={clsx("h-2 flex-1 rounded-full", k < level ? "bg-blue" : "bg-white/10")} />
                        ))}
                      </div>
                      {n.effect_pct > 0 && level > 0 && (
                        <p className="font-mono text-[11px] text-blue-light">
                          Effet actuel : {n.key === "tax" || n.key === "vat" ? "−" : "+"}
                          {level * n.effect_pct} %
                        </p>
                      )}
                      {locked && req && (
                        <p className="font-mono text-[11px] text-paper/60">
                          🔒 Nécessite « {req.label} » niveau {n.requires_level}
                        </p>
                      )}
                      {maxed || rankMaxed ? (
                        <p className="rounded-lg border border-blue/40 py-1.5 text-center font-mono text-xs uppercase text-blue-light">
                          {rankMaxed ? "Rang maximal" : "Niveau maximal"}
                        </p>
                      ) : (
                        <button
                          onClick={() => buy(n)}
                          disabled={locked || !affordable || buying !== null}
                          className="w-full rounded-lg bg-red py-1.5 font-mono text-xs uppercase text-ink hover:bg-red-light disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {buying === n.key ? "…" : `Améliorer — ${price} pts`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </section>
        ))}
      </div>
      {nodes.length === 0 && (
        <p className="glass-card p-4 font-body text-sm text-paper/60">
          L&apos;arbre n&apos;est pas encore disponible (migration 0054 à appliquer).
        </p>
      )}
    </div>
  );
}
