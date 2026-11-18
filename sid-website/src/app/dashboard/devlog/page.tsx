"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser } from "@/lib/permissions";
import { inputClass, labelClass } from "@/lib/ui";
import { Rich } from "@/components/tuto/Rich";

/**
 * Devlog (Lot 86) : les nouveautés du site. Lu par tous les membres ;
 * le fondateur ajoute, modifie et supprime les entrées (migration 0103).
 */

type Tag = "nouveau" | "amelioration" | "correctif" | "economie" | "admin";
type Entry = { id: string; title: string; body: string; tag: Tag; published_at: string };

const TAGS: Record<Tag, { label: string; color: string }> = {
  nouveau: { label: "Nouveauté", color: "#8fb3d9" },
  amelioration: { label: "Amélioration", color: "#8fc9a0" },
  correctif: { label: "Correctif", color: "#f0b46e" },
  economie: { label: "Économie", color: "#f0c27a" },
  admin: { label: "Administration", color: "#b49be0" },
};
const NEW_DAYS = 7;

const dayOf = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const inputDate = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

type Draft = { id: string | null; title: string; body: string; tag: Tag; date: string };
const emptyDraft = (): Draft => ({ id: null, title: "", body: "", tag: "nouveau", date: inputDate(new Date().toISOString()) });

export default function DevlogPage() {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [founder, setFounder] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<Tag | "all">("all");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from("devlog_entries").select("id, title, body, tag, published_at").order("published_at", { ascending: false }).limit(300);
    if (e) return setError(/devlog_entries/.test(e.message) ? "Le devlog arrive avec la migration 0103." : e.message);
    setError(null);
    setEntries((data ?? []) as Entry[]);
  }, [supabase]);

  useEffect(() => {
    load();
    loadCurrentUser().then((u) => setFounder(!!u.profile?.is_founder));
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    const { error: er } = await supabase.rpc("devlog_save", {
      p_id: draft.id,
      p_title: draft.title,
      p_body: draft.body,
      p_tag: draft.tag,
      p_published_at: new Date(`${draft.date}T12:00:00`).toISOString(),
    });
    setBusy(false);
    if (er) return setError(er.message);
    setDraft(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette entrée ?")) return;
    const { error: er } = await supabase.rpc("devlog_delete", { p_id: id });
    if (er) return setError(er.message);
    await load();
  }

  const shown = (entries ?? []).filter((e) => filter === "all" || e.tag === filter);
  const months = new Map<string, Entry[]>();
  shown.forEach((e) => {
    const k = new Date(e.published_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    months.set(k, [...(months.get(k) ?? []), e]);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-red">Devlog</h1>
          <p className="font-body text-sm text-paper/65">Ce qui change sur le site, du plus récent au plus ancien.</p>
        </div>
        {founder && !draft && (
          <button onClick={() => setDraft(emptyDraft())} className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light">
            Nouvelle entrée
          </button>
        )}
      </div>

      {error && <p className="font-mono text-sm text-red">{error}</p>}

      {draft && (
        <form onSubmit={save} className="glass-card space-y-3 p-4">
          <label className="block space-y-1">
            <span className={labelClass}>Titre</span>
            <input required maxLength={160} className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="block space-y-1">
            <span className={labelClass}>Texte (ligne vide = nouveau paragraphe, **gras**)</span>
            <textarea rows={6} className={inputClass} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className={labelClass}>Type</span>
              <select className={inputClass} value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value as Tag })}>
                {(Object.keys(TAGS) as Tag[]).map((t) => (
                  <option key={t} value={t}>
                    {TAGS[t].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>Date</span>
              <input type="date" required className={inputClass} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-50">
              {draft.id ? "Enregistrer" : "Publier"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-white/20 px-4 py-2 font-mono text-xs uppercase text-paper/80 hover:bg-white/10">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div role="group" aria-label="Filtrer par type" className="flex flex-wrap gap-1.5">
        {(["all", ...Object.keys(TAGS)] as (Tag | "all")[]).map((t) => (
          <button
            key={t}
            aria-pressed={filter === t}
            onClick={() => setFilter(t)}
            className={clsx(
              "rounded-full border px-3 py-1 font-mono text-[11px] uppercase",
              filter === t ? "border-blue bg-blue text-ink" : "border-white/15 text-paper/70 hover:bg-white/10"
            )}
          >
            {t === "all" ? "Tout" : TAGS[t].label}
          </button>
        ))}
      </div>

      {entries === null && !error && <p className="font-body text-sm text-paper/60">Chargement…</p>}
      {entries && shown.length === 0 && <p className="glass-card p-4 font-body text-sm text-paper/60">Aucune entrée.</p>}

      {[...months.entries()].map(([month, list]) => (
        <section key={month} className="space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-paper/60">{month}</h2>
          <ol className="space-y-3 border-l border-white/10 pl-4">
            {list.map((e) => {
              const fresh = Date.now() - new Date(e.published_at).getTime() < NEW_DAYS * 86400e3;
              const tag = TAGS[e.tag] ?? TAGS.nouveau;
              return (
                <li key={e.id} className="glass-card relative space-y-2 p-4">
                  <span className="absolute -left-[1.4rem] top-5 h-2.5 w-2.5 rounded-full" style={{ background: tag.color }} aria-hidden />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase text-ink" style={{ background: tag.color }}>
                      {tag.label}
                    </span>
                    {fresh && <span className="rounded-full bg-red/20 px-2 py-0.5 font-mono text-[10px] uppercase text-red">Nouveau</span>}
                    <time dateTime={e.published_at} className="font-mono text-xs text-paper/55">
                      {dayOf(e.published_at)}
                    </time>
                  </div>
                  <h3 className="font-display text-lg uppercase leading-tight text-paper">{e.title}</h3>
                  {e.body && <Rich text={e.body} className="space-y-2" pClassName="font-body text-sm leading-relaxed text-paper/80" />}
                  {founder && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setDraft({ id: e.id, title: e.title, body: e.body, tag: e.tag, date: inputDate(e.published_at) });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-lg border border-white/20 px-3 py-1 font-mono text-xs uppercase text-paper/80 hover:bg-white/10"
                      >
                        Modifier
                      </button>
                      <button onClick={() => remove(e.id)} className="rounded-lg border border-red/60 px-3 py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink">
                        Supprimer
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
