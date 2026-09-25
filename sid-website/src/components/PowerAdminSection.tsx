"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/lib/ui";

type Row = { id: string; nickname: string; power_score: number };

/**
 * Section admin : définir le score de puissance de chaque membre.
 * Côté base, set_power_score() exige manage_users ou manage_economy et
 * journalise chaque changement (table power_score_log).
 */
export function PowerAdminSection() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function refresh() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nickname, power_score")
      .eq("status", "active")
      .order("power_score", { ascending: false });
    if (error) {
      setMessage(`Impossible de charger les scores : ${error.message}`);
      return;
    }
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(id: string) {
    const raw = inputs[id];
    if (raw === undefined || raw === "") return;
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value) || value < 0) {
      setMessage("Le score doit être un nombre positif ou nul.");
      return;
    }
    setSavingId(id);
    setMessage(null);
    const { error } = await supabase.rpc("set_power_score", { p_user_id: id, p_score: value });
    setSavingId(null);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setInputs((i) => ({ ...i, [id]: "" }));
    await refresh();
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg uppercase text-paper">Puissance</h2>
      <p className="font-body text-sm text-paper/60">
        Score affiché dans l&apos;onglet « Puissance » du classement. Chaque modification est journalisée.
      </p>
      {message && <p className="font-mono text-sm text-red">{message}</p>}
      {rows.map((m) => (
        <div key={m.id} className="glass-card flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-[10rem]">
            <p className="font-display uppercase">{m.nickname}</p>
            <p className="font-mono text-xs text-blue">{m.power_score.toLocaleString("fr-FR")} pts</p>
          </div>
          <input
            type="number"
            min={0}
            placeholder="Nouveau score"
            className={`${inputClass} w-36`}
            value={inputs[m.id] ?? ""}
            onChange={(e) => setInputs((i) => ({ ...i, [m.id]: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && save(m.id)}
          />
          <button
            onClick={() => save(m.id)}
            disabled={savingId === m.id || !inputs[m.id]}
            className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            {savingId === m.id ? "…" : "Définir"}
          </button>
        </div>
      ))}
    </section>
  );
}
