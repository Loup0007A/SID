"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/session";
import { RecruitCardView } from "@/components/quests/QuestPower";
import { DEX_KINDS, RANK_LABEL, GACHA_RANKS, type DexEntry, type DexKind } from "@/lib/gacha";
import "@/components/quests/recrutement.css";

/**
 * Dex (Lot 86, migration 0104) : toutes les cartes tirées. Un renfort de
 * quête se réutilise sur une autre quête à puissance globale, contre de
 * l'argent et avec un risque d'échec (la carte récupère ensuite quelques
 * heures). Un allié de simulation s'équipe depuis la page de sa simulation.
 */

type QuestLite = { id: string; title: string };

const money = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} zénis`;
const pct = (p: number) => `${(Number(p) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const hhmm = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

function DexInner() {
  const supabase = useMemo(() => createClient(), []);
  const search = useSearchParams();
  const [kind, setKind] = useState<DexKind>("renfort");
  const [entries, setEntries] = useState<DexEntry[] | null>(null);
  const [quests, setQuests] = useState<QuestLite[]>([]);
  const [questId, setQuestId] = useState(search.get("quete") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("dex_list");
    if (e) return setError(/dex_list/.test(e.message) ? "Le dex arrive avec la migration 0104." : e.message);
    setEntries((data ?? []) as DexEntry[]);
    const uid = await currentUserId();
    if (!uid) return;
    const { data: parts } = await supabase.from("quest_participants").select("quest_id").eq("user_id", uid).neq("status", "rejected");
    const ids = (parts ?? []).map((p: { quest_id: string }) => p.quest_id);
    if (!ids.length) return setQuests([]);
    const { data: qs } = await supabase.from("quests").select("id, title").in("id", ids).eq("global_power", true).in("status", ["open", "in_progress"]);
    const list = (qs ?? []) as QuestLite[];
    setQuests(list);
    setQuestId((cur) => (cur && list.some((q) => q.id === cur) ? cur : list[0]?.id ?? ""));
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reuse(e: DexEntry) {
    setBusy(e.id);
    setMsg(null);
    const { data, error: err } = await supabase.rpc("dex_reuse", { p_entry: e.id, p_quest: questId });
    setBusy(null);
    if (err) return setMsg({ ok: false, text: err.message });
    const r = data as { ok: boolean; cost: number; choose?: boolean };
    setMsg(
      r.ok
        ? { ok: true, text: `${e.name} rejoint la quête (${money(r.cost)}).${r.choose ? " Tu as plus de trois renforts : choisis lesquels garder depuis la quête." : ""}` }
        : { ok: false, text: `Échec : ${e.name} n'a pas répondu (${money(r.cost)} perdus). La carte récupère quelques heures.` },
    );
    await load();
  }

  const list = (entries ?? []).filter((e) => e.kind === kind);
  const count = (k: DexKind) => (entries ?? []).filter((e) => e.kind === k).length;
  const ranksSeen = new Set(list.map((e) => e.rank));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl uppercase tracking-wide text-red">Dex</h1>
        <p className="font-body text-paper/70">
          Chaque carte tirée y est enregistrée, même si tu ne l&apos;as pas gardée. Un renfort se réutilise sur une autre quête, contre de l&apos;argent et avec un risque d&apos;échec.
        </p>
      </header>

      <div role="tablist" aria-label="Type de carte" className="flex flex-wrap gap-2">
        {DEX_KINDS.map((k) => (
          <button
            key={k.key}
            role="tab"
            aria-selected={kind === k.key}
            onClick={() => setKind(k.key)}
            className={clsx(
              "rounded-lg border px-3 py-1.5 font-mono text-xs uppercase",
              kind === k.key ? "border-red text-paper" : "border-white/15 text-paper/60 hover:text-paper",
            )}
          >
            {k.label} {entries && <span className="text-paper/50">· {count(k.key)}</span>}
          </button>
        ))}
      </div>

      {error && <p className="font-mono text-xs text-red-light">{error}</p>}
      {entries && (
        <p className="font-mono text-xs text-paper/60">
          Rangs découverts : {GACHA_RANKS.filter((r) => ranksSeen.has(r)).map((r) => RANK_LABEL[r].replace("Rang ", "")).join(" · ") || "aucun"} sur {GACHA_RANKS.length}
        </p>
      )}

      {kind === "renfort" && entries && (
        <div className="glass-card space-y-2 p-4">
          {quests.length === 0 ? (
            <p className="font-body text-sm text-paper/70">
              Aucune quête à puissance globale en cours où tu participes : prends-en une pour y réutiliser tes cartes.
            </p>
          ) : (
            <label className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase text-paper/70">
              Réutiliser sur
              <select
                value={questId}
                onChange={(e) => setQuestId(e.target.value)}
                className="rounded-lg border border-white/15 bg-ink px-2 py-1.5 text-sm normal-case text-paper"
              >
                {quests.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {msg && <p className={clsx("font-mono text-xs", msg.ok ? "text-blue-light" : "text-red-light")}>{msg.text}</p>}
        </div>
      )}

      {entries && list.length === 0 && <p className="glass-card px-4 py-3 font-body text-sm text-paper/60">Aucune carte pour le moment.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((e) => {
          const waiting = e.reuse_ready_at && new Date(e.reuse_ready_at).getTime() > Date.now();
          return (
            <article key={e.id} className="glass-card flex flex-col items-start gap-3 p-4">
              <RecruitCardView card={e} size="md" />
              <p className="font-mono text-[11px] text-paper/60">
                Tirée {e.draws} fois · dernière le {new Date(e.last_at).toLocaleDateString("fr-FR")}
              </p>
              {e.kind === "renfort" ? (
                <div className="w-full space-y-2">
                  <p className="font-mono text-xs text-paper/75">
                    Réutilisation : <strong className="text-paper">{money(e.reuse_cost)}</strong> · {pct(e.reuse_fail)} d&apos;échec
                  </p>
                  <button
                    type="button"
                    className="qp-recruit w-full"
                    disabled={!questId || !!waiting || busy === e.id}
                    onClick={() => reuse(e)}
                  >
                    {waiting ? `Disponible ${hhmm(e.reuse_ready_at!)}` : busy === e.id ? "…" : "Utiliser sur la quête"}
                  </button>
                </div>
              ) : (
                <p className="font-mono text-xs text-paper/75">
                  Protège {e.ally_charges} fois par jour, {e.ally_chance} % de réussite{e.equipped ? " · équipé" : ""}.
                </p>
              )}
            </article>
          );
        })}
      </div>
      {kind !== "renfort" && (
        <p className="font-body text-sm text-paper/60">Pour équiper un allié, ouvre la page de sa simulation.</p>
      )}
    </div>
  );
}

export default function DexPage() {
  return (
    <Suspense fallback={null}>
      <DexInner />
    </Suspense>
  );
}
