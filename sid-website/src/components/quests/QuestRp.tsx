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
const PART_MAX = 2000;
const SUMMARY_MAX = 4000;
const ERRORS: Record<string, string> = {
  too_short: `Le rapport doit faire au moins ${MIN} caractères en tout.`,
  too_long: `Le bilan ne peut pas dépasser ${SUMMARY_MAX} caractères.`,
  part_too_long: `Une partie ne peut pas dépasser ${PART_MAX} caractères.`,
  rejected: "Ta participation a été rejetée : plus de rapport possible.",
  not_participant: "Tu ne participes pas à cette mission.",
};

const when = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/** Ma participation : rapport, missions cochées (Lot 68), parties du rapport. */
export type MyReport = {
  report: string | null;
  status: string;
  objectives_done?: boolean[] | null;
  report_parts?: string[] | null;
  report_summary?: string | null;
};

/**
 * Le rapport, mission par mission puis le bilan. Sans parties (rapport
 * d'avant le Lot 68, ou quête sans mission) : le texte d'un bloc.
 */
export function ReportBody({
  objectives,
  parts,
  summary,
  done,
  fallback,
  className = "",
}: {
  objectives?: string[] | null;
  parts?: string[] | null;
  summary?: string | null;
  done?: boolean[] | null;
  fallback: string | null;
  className?: string;
}) {
  const hasParts = !!objectives?.length && !!parts?.some((p) => p?.trim());
  if (!hasParts && !summary) return <p className={className}>{fallback}</p>;
  return (
    <div className={`report-body ${className}`}>
      {hasParts &&
        objectives!.map((o, i) => {
          const text = parts?.[i]?.trim();
          const ok = done ? !!done[i] : null;
          if (!text && ok === null) return null;
          return (
            <section key={i} className="report-part">
              <h4>
                {ok !== null && <span className={`report-tick ${ok ? "is-done" : ""}`} aria-label={ok ? "mission faite" : "mission non cochée"}>{ok ? "✓" : ""}</span>}
                {o}
              </h4>
              {text ? <p>{text}</p> : <p className="is-empty">Pas raconté.</p>}
            </section>
          );
        })}
      {summary && (
        <section className="report-part">
          {hasParts && <h4>Bilan</h4>}
          <p>{summary}</p>
        </section>
      )}
    </div>
  );
}

/** Bouton « Rédiger mon rapport » et sa fenêtre. */
export function ReportButton({ quest, mine, onSaved }: { quest: Quest; mine: MyReport | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const report = mine?.report ?? null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`quest-report-btn ${report ? "is-done" : ""}`}>
        <SidIcon name={report ? "check" : "quill"} /> {report ? "Rapport rendu · le relire" : "Rédiger mon rapport de mission"}
      </button>
      {open && <ReportDialog quest={quest} mine={mine} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  );
}

function ReportDialog({ quest, mine, onClose, onSaved }: { quest: Quest; mine: MyReport | null; onClose: () => void; onSaved: () => void }) {
  const objectives = quest.objectives ?? [];
  const done = mine?.objectives_done ?? [];
  // Un rapport écrit avant le Lot 68 (texte d'un bloc) devient le bilan.
  const [parts, setParts] = useState<string[]>(() => objectives.map((_, i) => mine?.report_parts?.[i] ?? ""));
  const [summary, setSummary] = useState(() => mine?.report_summary ?? (mine?.report && !mine?.report_parts?.length ? mine.report : ""));
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
    const { data, error } = await createClient().rpc("submit_quest_report_parts", { p_quest_id: quest.id, p_parts: parts, p_summary: summary });
    setBusy(false);
    const code = (data as { error?: string } | null)?.error;
    if (error) return setErr(error.message.includes("submit_quest_report_parts") ? "Le rapport en parties arrive avec la migration 0083." : error.message);
    if (code) return setErr(ERRORS[code] ?? "Envoi impossible.");
    onSaved();
    onClose();
  }

  const len = parts.reduce((n, p) => n + p.trim().length, 0) + summary.trim().length;
  const initial = !!mine?.report;
  return createPortal(
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="rapport-titre" className="quest-report-sheet w-full max-w-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#8f2d1c]">Rapport de mission · confidentiel</p>
        <h2 id="rapport-titre" className="font-display text-2xl uppercase tracking-wide text-[#2b2f28]">
          {quest.title}
        </h2>
        {quest.giver && <p className="font-body text-sm italic text-[#5b4a33]">À l&apos;attention de : {quest.giver}</p>}

        {objectives.map((o, i) => (
          <div key={i} className="mt-4">
            <label htmlFor={`rapport-partie-${i}`} className="flex items-start gap-2 font-body text-[15px] font-semibold text-[#2b2f28]">
              <span className={`report-tick ${done[i] ? "is-done" : ""}`} aria-hidden>
                {done[i] ? "✓" : ""}
              </span>
              <span>
                Mission {i + 1} : {o}
                {!done[i] && <span className="ml-1 font-normal italic text-[#6b5a3e]">(pas encore cochée)</span>}
              </span>
            </label>
            <textarea
              id={`rapport-partie-${i}`}
              value={parts[i]}
              onChange={(e) => setParts((p) => p.map((x, j) => (j === i ? e.target.value.slice(0, PART_MAX) : x)))}
              rows={3}
              autoFocus={i === 0}
              placeholder="Ce que ton personnage a fait pour cette mission…"
              className="quest-report-text mt-1 w-full !min-h-[5.5rem]"
            />
          </div>
        ))}

        <label htmlFor="rapport-texte" className="mt-4 block font-mono text-[11px] uppercase tracking-wide text-[#6b5a3e]">
          {objectives.length ? "Bilan (facultatif)" : "Ce qui s'est passé (raconté par ton personnage)"}
        </label>
        <textarea
          id="rapport-texte"
          value={summary}
          onChange={(e) => setSummary(e.target.value.slice(0, SUMMARY_MAX))}
          rows={objectives.length ? 3 : 9}
          autoFocus={!objectives.length}
          placeholder={objectives.length ? "Ce qu'il faut retenir de la mission…" : "Nous avons quitté la ville à l'aube. Sur la route des dunes…"}
          className={`quest-report-text mt-1 w-full ${objectives.length ? "!min-h-[5.5rem]" : ""}`}
        />
        <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[11px] text-[#6b5a3e]">
          <span>{len < MIN ? `Encore ${MIN - len} caractères au moins` : `${len} caractères`}</span>
          {err && <span className="text-[#8f2d1c]">{err}</span>}
        </div>
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

type Report = {
  user_id: string;
  nickname: string;
  status: string;
  report: string | null;
  report_at: string | null;
  parts?: string[] | null;
  summary?: string | null;
  done?: boolean[] | null;
};

/** Les rapports reçus, dans le panneau des participants (commanditaire). */
export function QuestReports({ questId, objectives, version }: { questId: string; objectives?: string[] | null; version: number }) {
  const [rows, setRows] = useState<Report[] | null>(null);
  useEffect(() => {
    createClient()
      .rpc("list_quest_reports", { p_quest_id: questId })
      .then(({ data }) => setRows((data ?? []) as Report[]));
  }, [questId, version]);
  if (!rows) return null;
  const n = objectives?.length ?? 0;
  const written = rows.filter((r) => r.report);
  const progress = n ? rows.filter((r) => r.status !== "rejected") : [];
  return (
    <div className="space-y-2">
      {progress.length > 0 && (
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/70">Missions cochées</p>
          {progress.map((r) => {
            const k = (r.done ?? []).slice(0, n).filter(Boolean).length;
            return (
              <p key={r.user_id} className="flex items-center gap-2 font-body text-xs text-paper/80">
                <span className="w-24 truncate">{r.nickname}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-green-400/70" style={{ width: `${(k / n) * 100}%` }} />
                </span>
                <span className="font-mono text-[11px]">
                  {k}/{n}
                </span>
              </p>
            );
          })}
        </div>
      )}
      {written.length === 0 ? (
        <p className="font-body text-xs text-paper/65">Aucun rapport rendu pour l&apos;instant.</p>
      ) : (
        <>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/70">Rapports reçus</p>
          {written.map((r) => (
            <details key={r.user_id} className="quest-report-read">
              <summary>
                <SidIcon name="quill" /> {r.nickname}
                <span className="ml-auto opacity-70">{r.report_at ? when(r.report_at) : ""}</span>
              </summary>
              <ReportBody objectives={objectives} parts={r.parts} summary={r.summary} done={r.done} fallback={r.report} />
            </details>
          ))}
        </>
      )}
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
  objectives?: string[] | null;
  reports: { nickname: string; report: string; at: string; parts?: string[] | null; summary?: string | null }[];
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
                <ReportBody objectives={c.objectives} parts={r.parts} summary={r.summary} fallback={r.report} />
                <footer>— {r.nickname}</footer>
              </blockquote>
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}
