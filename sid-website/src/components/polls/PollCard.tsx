"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import "./polls.css";

/** Sondages de l'administration (Lot 65). Règles : supabase/migrations/0080. */

export type PollOption = { id: string; label: string; votes: number | null; names: string[] | null };
export type Poll = {
  id: string;
  question: string;
  details: string | null;
  multiple: boolean;
  anonymous: boolean;
  show_results: "always" | "after_vote" | "after_close";
  closes_at: string | null;
  closed_at: string | null;
  is_open: boolean;
  created_at: string;
  /** Lot 66 : publication programmée (visible des admins seulement avant l'heure). */
  publish_at?: string | null;
  scheduled?: boolean;
  notify?: boolean;
  author: string | null;
  voted: boolean;
  results_visible: boolean;
  voters: number;
  my_votes: string[];
  options: PollOption[];
};

function until(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "clos";
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return "clôture dans moins d'une heure";
  if (h < 48) return `clôture dans ${h} h`;
  return `clôture dans ${Math.round(h / 24)} j`;
}

export function PollCard({
  poll,
  admin = false,
  compact = false,
  highlight = false,
  onChanged,
}: {
  poll: Poll;
  admin?: boolean;
  compact?: boolean;
  highlight?: boolean;
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [sel, setSel] = useState<string[]>(poll.my_votes);
  const [editing, setEditing] = useState(!poll.voted);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSel(poll.my_votes);
    setEditing(!poll.voted);
  }, [poll.voted, poll.my_votes]);

  const scheduled = !!poll.scheduled;
  const choosing = poll.is_open && editing;
  const total = poll.voters || 0;
  const best = Math.max(0, ...poll.options.map((o) => o.votes ?? 0));

  function toggle(id: string) {
    setErr(null);
    setSel((s) => (poll.multiple ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));
  }

  async function vote(ids: string[]) {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("poll_vote", { p_poll: poll.id, p_options: ids });
    setBusy(false);
    if (error) return setErr(error.message);
    setEditing(ids.length === 0);
    onChanged();
  }

  async function admin_(fn: "poll_close" | "poll_delete" | "poll_publish_now") {
    if (fn === "poll_delete" && !confirm("Supprimer ce sondage et tous ses votes ?")) return;
    setBusy(true);
    const { error } = await supabase.rpc(fn, { p_poll: poll.id });
    setBusy(false);
    if (error) return setErr(error.message);
    onChanged();
  }

  const meta = [
    poll.author ? `par ${poll.author}` : null,
    `${total} votant${total > 1 ? "s" : ""}`,
    scheduled && poll.publish_at
      ? `publié le ${new Date(poll.publish_at).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}${poll.notify === false ? " sans notification" : ""}`
      : poll.is_open
        ? poll.closes_at
          ? until(poll.closes_at)
          : null
        : `clos le ${new Date(poll.closed_at ?? poll.closes_at ?? poll.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}`,
  ].filter(Boolean);

  return (
    <article id={`sondage-${poll.id}`} className={`poll-card ${poll.is_open || scheduled ? "" : "is-closed"} ${scheduled ? "is-scheduled" : ""} ${highlight ? "is-highlight" : ""}`}>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`poll-tag ${poll.is_open ? "is-open" : scheduled ? "is-scheduled" : ""}`}>{scheduled ? "Programmé" : poll.is_open ? "Ouvert" : "Clos"}</span>
          {poll.multiple && <span className="poll-tag">Plusieurs choix</span>}
          <span className="poll-tag">{poll.anonymous ? "Anonyme" : "Vote public"}</span>
        </div>
        <h2 className={`font-display uppercase leading-tight tracking-wide ${compact ? "text-lg" : "text-xl"}`}>{poll.question}</h2>
        {poll.details && !compact && <p className="whitespace-pre-line font-body text-sm text-paper/75">{poll.details}</p>}
        <p className="font-mono text-[10px] uppercase tracking-wider text-paper/55">{meta.join(" · ")}</p>
      </header>

      {scheduled ? (
        <ul className="space-y-1">
          {poll.options.map((o) => (
            <li key={o.id} className="font-body text-sm text-paper/75">
              · {o.label}
            </li>
          ))}
        </ul>
      ) : choosing ? (
        <div className="space-y-2" role={poll.multiple ? "group" : "radiogroup"} aria-label={poll.question}>
          {poll.options.map((o) => {
            const on = sel.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role={poll.multiple ? "checkbox" : "radio"}
                aria-checked={on}
                onClick={() => toggle(o.id)}
                className={`poll-choice ${on ? "is-on" : ""}`}
              >
                <span className={`poll-mark ${poll.multiple ? "is-square" : ""}`} aria-hidden>
                  {on && <SidIcon name="check" size={12} />}
                </span>
                <span className="flex-1 text-left">{o.label}</span>
              </button>
            );
          })}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" onClick={() => vote(sel)} disabled={busy || sel.length === 0} className="shop-buy">
              {busy ? "…" : poll.voted ? "Changer mon vote" : "Voter"}
            </button>
            {poll.voted && (
              <button type="button" onClick={() => setEditing(false)} className="font-mono text-[11px] uppercase text-paper/60 hover:text-paper">
                Annuler
              </button>
            )}
          </div>
        </div>
      ) : poll.results_visible ? (
        <ul className="space-y-2">
          {poll.options.map((o) => {
            const n = o.votes ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            const mine = poll.my_votes.includes(o.id);
            const top = !poll.is_open && n > 0 && n === best;
            return (
              <li key={o.id}>
                <div className={`poll-bar ${mine ? "is-mine" : ""} ${top ? "is-top" : ""}`}>
                  <span className="poll-fill" style={{ width: `${pct}%` }} aria-hidden />
                  <span className="relative flex-1 truncate">
                    {mine && <SidIcon name="check" size={12} />} {o.label}
                  </span>
                  <span className="relative font-mono text-xs">
                    {pct} % <span className="text-paper/55">({n})</span>
                  </span>
                </div>
                {o.names && o.names.length > 0 && !compact && <p className="mt-0.5 pl-1 font-body text-[11px] text-paper/55">{o.names.join(", ")}</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-1">
            {poll.options.map((o) => (
              <li key={o.id} className={`font-body text-sm ${poll.my_votes.includes(o.id) ? "text-paper" : "text-paper/55"}`}>
                {poll.my_votes.includes(o.id) ? <SidIcon name="check" size={12} /> : "·"} {o.label}
              </li>
            ))}
          </ul>
          <p className="font-mono text-[11px] text-paper/60">Résultats à la clôture.</p>
        </div>
      )}

      {(poll.is_open && poll.voted && !editing) || admin ? (
        <footer className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-2">
          {poll.is_open && poll.voted && !editing && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="font-mono text-[11px] uppercase text-blue hover:underline">
                Modifier mon vote
              </button>
              <button type="button" onClick={() => vote([])} disabled={busy} className="font-mono text-[11px] uppercase text-paper/55 hover:text-paper">
                Retirer mon vote
              </button>
            </>
          )}
          {admin && (
            <span className="ml-auto flex gap-3">
              {scheduled && (
                <button type="button" onClick={() => admin_("poll_publish_now")} disabled={busy} className="font-mono text-[11px] uppercase text-blue hover:underline">
                  Publier maintenant
                </button>
              )}
              {poll.is_open && (
                <button type="button" onClick={() => admin_("poll_close")} disabled={busy} className="font-mono text-[11px] uppercase text-paper/70 hover:text-paper">
                  Clore
                </button>
              )}
              <button type="button" onClick={() => admin_("poll_delete")} disabled={busy} className="font-mono text-[11px] uppercase text-red/80 hover:text-red">
                Supprimer
              </button>
            </span>
          )}
        </footer>
      ) : null}

      {err && (
        <p role="alert" className="font-body text-sm text-red">
          {err}
        </p>
      )}
    </article>
  );
}
