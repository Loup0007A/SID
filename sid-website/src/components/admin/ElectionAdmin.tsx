"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Modération → Affichage événementiel → Élection du Dictateur (Lot 80) :
 * l'élu (secret jusqu'à la proclamation), le début, la proclamation et la fin.
 */

type Admin = { winner: string | null; starts_at: string | null; reveal_at: string | null; ends_at: string | null; awarded: boolean; now: string };

/** ISO → valeur d'un champ datetime-local (heure de l'appareil). */
function toLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

/** Pseudo comparable : Unicode normalisé, sans invisibles ni espaces autour, en minuscules. */
const nickKey = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim()
    .toLowerCase();

export function ElectionAdmin({ onSaved }: { onSaved?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [cfg, setCfg] = useState<Admin | null>(null);
  const [missing, setMissing] = useState(false);
  const [members, setMembers] = useState<{ id: string; nickname: string }[]>([]);
  const [winner, setWinner] = useState("");
  const [starts, setStarts] = useState("");
  const [reveal, setReveal] = useState("");
  const [ends, setEnds] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function apply(a: Admin) {
    setCfg(a);
    setWinner(a.winner ?? "");
    setStarts(toLocal(a.starts_at));
    setReveal(toLocal(a.reveal_at));
    setEnds(toLocal(a.ends_at));
  }

  useEffect(() => {
    supabase.rpc("election_admin").then(({ data, error }) => {
      if (error) return setMissing(true);
      apply(data as Admin);
    });
    supabase
      .from("profiles")
      .select("id, nickname")
      .eq("status", "active")
      .order("nickname")
      .then(({ data }) => setMembers((data ?? []) as { id: string; nickname: string }[]));
  }, [supabase]);

  // Proposition : du jour même à 2 jours après une proclamation demain à 21 h.
  function suggest() {
    const r = new Date();
    r.setDate(r.getDate() + 1);
    r.setHours(21, 0, 0, 0);
    const s = new Date();
    s.setMinutes(0, 0, 0);
    const e = new Date(r);
    e.setDate(e.getDate() + 2);
    setStarts(toLocal(s.toISOString()));
    setReveal(toLocal(r.toISOString()));
    setEnds(toLocal(e.toISOString()));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    // L'élu choisi dans la liste part avec son identifiant : pas d'erreur
    // possible sur la casse, un espace en trop ou les accents.
    const typed = nickKey(winner);
    const picked = typed ? members.find((m) => nickKey(m.nickname) === typed) : undefined;
    const { data, error } = await supabase.rpc("election_set", {
      p_winner: picked?.id ?? winner.trim(),
      p_starts: fromLocal(starts),
      p_reveal: fromLocal(reveal),
      p_ends: fromLocal(ends),
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    apply(data as Admin);
    setMsg({ ok: true, text: "Enregistré." });
    onSaved?.();
  }

  if (missing) return <p className="font-mono text-xs text-red">Migration 0098 à lancer dans Supabase.</p>;
  if (!cfg) return <p className="font-body text-xs text-paper/60">Chargement…</p>;

  const revealed = !!cfg.reveal_at && new Date(cfg.reveal_at) <= new Date(cfg.now);
  const input = "w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 font-body text-sm text-paper outline-none focus:border-blue";
  return (
    <div className="basis-full space-y-3 rounded-xl border border-[#f0c27a]/30 bg-[#7a1430]/15 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="font-mono text-[11px] uppercase text-paper/60">Élu (secret jusqu&apos;à la proclamation)</span>
          <input list="election-names" value={winner} onChange={(e) => setWinner(e.target.value)} placeholder="Pseudo, ou vide pour choisir plus tard" className={input} />
          <datalist id="election-names">
            {members.map((m) => (
              <option key={m.id} value={m.nickname.trim()} />
            ))}
          </datalist>
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[11px] uppercase text-paper/60">Début (compte à rebours)</span>
          <input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className={input} style={{ colorScheme: "dark" }} />
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[11px] uppercase text-paper/60">Proclamation</span>
          <input type="datetime-local" value={reveal} onChange={(e) => setReveal(e.target.value)} className={input} style={{ colorScheme: "dark" }} />
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[11px] uppercase text-paper/60">Fin de l&apos;affichage</span>
          <input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} className={input} style={{ colorScheme: "dark" }} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !starts || !reveal || !ends}
          onClick={save}
          className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {!cfg.reveal_at && (
          <button type="button" onClick={suggest} className="font-mono text-xs uppercase text-paper/60 underline hover:text-paper">
            Proposer des dates
          </button>
        )}
        {msg && <span className={msg.ok ? "font-mono text-xs text-green-300" : "font-mono text-xs text-red"}>{msg.text}</span>}
      </div>
      <p className="font-body text-xs text-paper/60">
        {revealed
          ? cfg.winner
            ? cfg.awarded
              ? `Proclamé : ${cfg.winner} a reçu le titre « Dictateur », et tout le S.I.D. a été prévenu.`
              : `Proclamation passée : ${cfg.winner} recevra le titre à la prochaine visite d'un membre.`
            : "Proclamation passée sans élu : la page annonce que le Conseil délibère encore. Choisis l'élu pour la terminer."
          : "Avant la proclamation, les membres voient le compte à rebours ; personne ne voit le nom. À l'heure dite, la cérémonie s'ouvre une fois pour chacun et l'élu reçoit le titre « Dictateur » (aucun grade, aucun droit)."}{" "}
        Une nouvelle date de proclamation compte comme une nouvelle élection.
      </p>
    </div>
  );
}
