"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import type { Quest } from "@/types/database";
import { SidIcon } from "@/components/icons/SidIcon";
import { DifficultyBadge } from "@/components/DifficultyBadge";

/**
 * Quêtes RP (Lot 62) : le rapport de mission que chaque participant rédige,
 * sa lecture par le commanditaire, et les Chroniques du S.I.D. (missions
 * accomplies, racontées par ceux qui les ont menées).
 */

const MIN = 20;
const MAX = 4000;
const ERRORS: Record<string, string> = {
  too_short: `Le rapport doit faire au moins ${MIN} caractères.`,
  too_long: `Le rapport ne peut pas dépasser ${MAX} caractères.`,
  rejected: "Ta participation a été rejetée : plus de rapport possible.",
  not_participant: "Tu ne participes pas à cette mission.",
};

const when = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/** Bouton « Rédiger mon rapport » et sa fenêtre. */
export function ReportButton({ quest, report, onSaved }: { quest: Quest; report: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`quest-report-btn ${report ? "is-done" : ""}`}>
        <SidIcon name={report ? "check" : "quill"} /> {report ? "Rapport rendu · le relire" : "Rédiger mon rapport de mission"}
      </button>
      {open && <ReportDialog quest={quest} initial={report ?? ""} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  );
}

function ReportDialog({ quest, initial, onClose, onSaved }: { quest: Quest; initial: string; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  async function save() {
    setBusy(true);
    setErr(null);
    const { data, error } = await createClient().rpc("submit_quest_report", { p_quest_id: quest.id, p_text: text });
    setBusy(false);
    const code = (data as { error?: string } | null)?.error;
    if (error || code) return setErr(code ? ERRORS[code] ?? "Envoi impossible." : error!.message);
    onSaved();
    onClose();
  }

  const len = text.trim().length;
  return createPortal(
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="rapport-titre" className="quest-report-sheet w-full max-w-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#8f2d1c]">Rapport de mission · confidentiel</p>
        <h2 id="rapport-titre" className="font-display text-2xl uppercase tracking-wide text-[#2b2f28]">
          {quest.title}
        </h2>
        {quest.giver && <p className="font-body text-sm italic text-[#5b4a33]">À l&apos;attention de : {quest.giver}</p>}
        {!!quest.objectives?.length && (
          <ul className="mt-2 space-y-0.5 font-body text-sm text-[#4a3b26]">
            {quest.objectives.map((o, i) => (
              <li key={i}>☐ {o}</li>
            ))}
          </ul>
        )}
        <label htmlFor="rapport-texte" className="mt-4 block font-mono text-[11px] uppercase tracking-wide text-[#6b5a3e]">
          Ce qui s&apos;est passé (raconté par ton personnage)
        </label>
        <textarea
          id="rapport-texte"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          maxLength={MAX}
          autoFocus
          placeholder="Nous avons quitté la ville à l'aube. Sur la route des dunes…"
          className="quest-report-text mt-1 w-full"
        />
        <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[11px] text-[#6b5a3e]">
          <span>{len < MIN ? `Encore ${MIN - len} caractères au moins` : `${len} / ${MAX}`}</span>
          {err && <span className="text-[#8f2d1c]">{err}</span>}
        </div>
        <p className="mt-2 font-body text-xs text-[#6b5a3e]">
          Le commanditaire le lit avant de valider. Une fois la mission validée, il rejoint les Chroniques du S.I.D.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#6b5a3e]/40 px-4 py-2 font-mono text-xs uppercase text-[#4a3b26]">
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || len < MIN}
            className="rounded-lg bg-[#8f2d1c] px-4 py-2 font-display text-sm uppercase text-[#f4ead2] disabled:opacity-40"
          >
            {busy ? "Envoi…" : initial ? "Mettre à jour" : "Remettre le rapport"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type Report = { user_id: string; nickname: string; status: string; report: string | null; report_at: string | null };

/** Les rapports reçus, dans le panneau des participants (commanditaire). */
export function QuestReports({ questId, version }: { questId: string; version: number }) {
  const [rows, setRows] = useState<Report[] | null>(null);
  useEffect(() => {
    createClient()
      .rpc("list_quest_reports", { p_quest_id: questId })
      .then(({ data }) => setRows(((data ?? []) as Report[]).filter((r) => r.report)));
  }, [questId, version]);
  if (!rows) return null;
  if (rows.length === 0) return <p className="font-body text-xs text-paper/65">Aucun rapport rendu pour l&apos;instant.</p>;
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/70">Rapports reçus</p>
      {rows.map((r) => (
        <details key={r.user_id} className="quest-report-read">
          <summary>
            <SidIcon name="quill" /> {r.nickname}
            <span className="ml-auto opacity-70">{r.report_at ? when(r.report_at) : ""}</span>
          </summary>
          <p>{r.report}</p>
        </details>
      ))}
    </div>
  );
}

type Chronicle = {
  id: string;
  title: string;
  giver: string | null;
  difficulty: Quest["difficulty"];
  place: string | null;
  at: string;
  reports: { nickname: string; report: string; at: string }[];
};

/** Les Chroniques du S.I.D. : la mémoire des missions accomplies. */
export function Chronicles() {
  const [list, setList] = useState<Chronicle[] | null>(null);
  useEffect(() => {
    createClient()
      .rpc("list_chronicles", { p_limit: 12 })
      .then(({ data, error }) => setList(error ? [] : ((data ?? []) as Chronicle[])));
  }, []);
  if (!list || list.length === 0) return null;
  return (
    <section aria-labelledby="chroniques" className="space-y-4">
      <div>
        <h2 id="chroniques" className="font-display text-2xl uppercase tracking-wide text-red">
          <SidIcon name="book" /> Chroniques du S.I.D.
        </h2>
        <p className="font-body text-sm text-paper/70">Les missions accomplies, racontées par ceux qui les ont menées.</p>
      </div>
      <ol className="chronicles">
        {list.map((c) => (
          <li key={c.id} className="chronicle">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="chronicle-date">{when(c.at)}</span>
              <h3 className="font-display text-lg uppercase tracking-wide">{c.title}</h3>
              <DifficultyBadge difficulty={c.difficulty} />
            </div>
            <p className="font-body text-xs text-paper/70">
              {c.giver ? <>Pour {c.giver}</> : "Mission du S.I.D."}
              {c.place ? <> · {c.place}</> : null} · {c.reports.map((r) => r.nickname).join(", ")}
            </p>
            {c.reports.map((r, i) => (
              <blockquote key={i} className="chronicle-quote">
                <p>{r.report}</p>
                <footer>— {r.nickname}</footer>
              </blockquote>
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}
