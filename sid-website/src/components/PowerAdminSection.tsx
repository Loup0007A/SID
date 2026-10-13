"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/lib/ui";
import type { LeaderboardEntry } from "@/types/database";
import { STAT_LABELS, type StatKey } from "@/lib/simulationSites";
import { formatPower } from "@/components/MemberStatBars";

const STATS: StatKey[] = ["intelligence", "strength", "technique"];

type Draft = Record<StatKey, string>;

/**
 * Section admin : corriger les trois facteurs de puissance d'un membre
 * (Intelligence, Puissance, Technique, 0 à 100). La puissance globale en
 * est la moyenne, recalculée automatiquement. Côté base, set_member_stats()
 * exige manage_users ou manage_economy, et chaque correction apparaît dans
 * le journal d'audit.
 */
export function PowerAdminSection() {
  const supabase = createClient();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function refresh() {
    const { data, error } = await supabase.rpc("list_leaderboard");
    if (error) {
      setMessage(`Impossible de charger les facteurs : ${error.message}`);
      return;
    }
    const list = ((data ?? []) as LeaderboardEntry[]).sort(
      (a, b) => Number(b.power_score) - Number(a.power_score) || a.nickname.localeCompare(b.nickname)
    );
    setRows(list);
    setDrafts({});
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function draftFor(m: LeaderboardEntry): Draft {
    return (
      drafts[m.user_id] ?? {
        intelligence: String(m.intelligence ?? 0),
        strength: String(m.strength ?? 0),
        technique: String(m.technique ?? 0),
      }
    );
  }

  async function save(m: LeaderboardEntry) {
    const d = draftFor(m);
    const values = STATS.map((k) => Math.round(Number(d[k])));
    if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
      setMessage("Chaque facteur doit être un nombre entre 0 et 100.");
      return;
    }
    setSavingId(m.user_id);
    setMessage(null);
    const { error } = await supabase.rpc("set_member_stats", {
      p_user_id: m.user_id,
      p_intelligence: values[0],
      p_strength: values[1],
      p_technique: values[2],
    });
    setSavingId(null);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    await refresh();
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg uppercase text-paper">Puissance</h2>
      <p className="font-body text-sm text-paper/60">
        La puissance globale est la moyenne de trois facteurs (100 max), que les membres font progresser dans les
        simulations. Tu peux les corriger ici ; chaque correction est inscrite au journal d&apos;audit.
      </p>
      {message && <p className="font-mono text-sm text-red">{message}</p>}
      {rows.map((m) => {
        const d = draftFor(m);
        const dirty =
          d.intelligence !== String(m.intelligence ?? 0) ||
          d.strength !== String(m.strength ?? 0) ||
          d.technique !== String(m.technique ?? 0);
        return (
          <div key={m.user_id} className="glass-card flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[10rem] flex-1">
              <p className="font-display uppercase">{m.nickname}</p>
              <p className="font-mono text-xs text-blue">Puissance globale : {formatPower(Number(m.power_score))} / 100</p>
            </div>
            {STATS.map((k) => (
              <label key={k} className="space-y-1">
                <span className="block font-mono text-[10px] uppercase tracking-wide text-paper/60">{STAT_LABELS[k]}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`${inputClass} w-24`}
                  value={d[k]}
                  onChange={(e) => setDrafts((all) => ({ ...all, [m.user_id]: { ...d, [k]: e.target.value } }))}
                  onKeyDown={(e) => e.key === "Enter" && dirty && save(m)}
                />
              </label>
            ))}
            <button
              onClick={() => save(m)}
              disabled={savingId === m.user_id || !dirty}
              className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
            >
              {savingId === m.user_id ? "…" : "Enregistrer"}
            </button>
          </div>
        );
      })}
    </section>
  );
}
