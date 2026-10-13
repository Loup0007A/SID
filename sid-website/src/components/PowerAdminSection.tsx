"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/lib/ui";
import type { LeaderboardEntry } from "@/types/database";
import { SKILLS, STAT_LABELS, type SkillKey } from "@/lib/simulationSites";
import { formatPower } from "@/components/MemberStatBars";

type Draft = Partial<Record<SkillKey, string>>;
type SkillRow = { user_id: string; skill: SkillKey; points: number };

/**
 * Section admin : régler directement le niveau d'un membre dans chaque
 * compétence (0 à 100). Les facteurs en découlent :
 *   Intelligence = moyenne de Potions, Énigmes et Problème
 *   Puissance = Donjons · Technique = Techniques
 * et la puissance globale est la moyenne des trois facteurs.
 *
 * Le nouveau niveau est aussi recopié dans la progression des sites
 * (niveaux débloqués), que le membre retrouve à sa prochaine ouverture
 * depuis le S.I.D. Côté base, set_member_levels() exige manage_users ou
 * manage_economy, et chaque changement est inscrit au journal d'audit.
 */
export function PowerAdminSection() {
  const supabase = createClient();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [levels, setLevels] = useState<Record<string, Partial<Record<SkillKey, number>>>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function refresh() {
    const [{ data, error }, { data: skills }] = await Promise.all([
      supabase.rpc("list_leaderboard"),
      supabase.from("member_skills").select("user_id, skill, points"),
    ]);
    if (error) {
      setMessage(`Impossible de charger les niveaux : ${error.message}`);
      return;
    }
    const list = ((data ?? []) as LeaderboardEntry[]).sort(
      (a, b) => Number(b.power_score) - Number(a.power_score) || a.nickname.localeCompare(b.nickname)
    );
    const byUser: Record<string, Partial<Record<SkillKey, number>>> = {};
    for (const r of (skills ?? []) as SkillRow[]) {
      byUser[r.user_id] = { ...byUser[r.user_id], [r.skill]: r.points };
    }
    setRows(list);
    setLevels(byUser);
    setDrafts({});
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = (userId: string, skill: SkillKey) => levels[userId]?.[skill] ?? 0;
  const valueOf = (userId: string, skill: SkillKey) => drafts[userId]?.[skill] ?? String(current(userId, skill));

  function changed(userId: string): Partial<Record<SkillKey, string>> {
    const d = drafts[userId] ?? {};
    return Object.fromEntries(
      Object.entries(d).filter(([k, v]) => v !== String(current(userId, k as SkillKey)))
    ) as Partial<Record<SkillKey, string>>;
  }

  async function save(m: LeaderboardEntry) {
    const diff = changed(m.user_id);
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(diff)) {
      const n = Number(v);
      if (v === "" || !Number.isInteger(n) || n < 0 || n > 100) {
        setMessage("Chaque niveau doit être un nombre entier entre 0 et 100.");
        return;
      }
      payload[k] = n;
    }
    if (Object.keys(payload).length === 0) return;
    setSavingId(m.user_id);
    setMessage(null);
    const { error } = await supabase.rpc("set_member_levels", { p_user_id: m.user_id, p_levels: payload });
    setSavingId(null);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage(`Niveaux de ${m.nickname} enregistrés.`);
    await refresh();
  }

  const groups: { label: string; skills: SkillKey[] }[] = [
    { label: STAT_LABELS.intelligence, skills: ["potions", "enigmes", "probleme"] },
    { label: STAT_LABELS.strength, skills: ["mondes-vivants"] },
    { label: STAT_LABELS.technique, skills: ["techniques"] },
  ];
  const skillLabel = (k: SkillKey) => SKILLS.find((s) => s.key === k)?.label ?? k;
  const visible = rows.filter((m) => m.nickname.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg uppercase text-paper">Niveaux & puissance</h2>
      <p className="font-body text-sm text-paper/60">
        Règle directement le niveau d&apos;un membre dans chaque compétence (0 à 100). L&apos;intelligence est la moyenne
        de Potions, Énigmes et Problème ; la puissance globale, la moyenne des trois facteurs. Le niveau est aussi
        débloqué dans les sites des simulations, à leur prochaine ouverture depuis le S.I.D. Chaque changement est
        inscrit au journal d&apos;audit.
      </p>
      <input
        className={`${inputClass} max-w-xs`}
        placeholder="Rechercher un membre…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {message && <p className="font-mono text-sm text-red">{message}</p>}
      {visible.map((m) => {
        const dirty = Object.keys(changed(m.user_id)).length > 0;
        return (
          <div key={m.user_id} className="glass-card space-y-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display uppercase">{m.nickname}</p>
              <p className="font-mono text-xs text-blue">
                Puissance globale {formatPower(Number(m.power_score))} · Int. {formatPower(Number(m.intelligence ?? 0))} · Pui.{" "}
                {formatPower(Number(m.strength ?? 0))} · Tech. {formatPower(Number(m.technique ?? 0))}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              {groups.map((g) => (
                <fieldset key={g.label} className="space-y-1">
                  <legend className="font-mono text-[10px] uppercase tracking-wide text-blue-light">{g.label}</legend>
                  <div className="flex gap-2">
                    {g.skills.map((k) => (
                      <label key={k} className="space-y-1">
                        <span className="block font-mono text-[10px] uppercase tracking-wide text-paper/60">{skillLabel(k)}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          className={`${inputClass} w-20`}
                          value={valueOf(m.user_id, k)}
                          onChange={(e) =>
                            setDrafts((all) => ({ ...all, [m.user_id]: { ...all[m.user_id], [k]: e.target.value } }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && dirty && save(m)}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <button
                onClick={() => save(m)}
                disabled={savingId === m.user_id || !dirty}
                className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
              >
                {savingId === m.user_id ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
