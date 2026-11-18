"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { inputClass, labelClass } from "@/lib/ui";

/**
 * Modération → Base de données (fondateur, Lot 86). Constructeur de
 * requêtes en lecture seule et recherche d'un texte dans toute la base.
 * Tout est vérifié côté base (migration 0103) : tables et colonnes
 * dans le catalogue, valeurs passées comme littéraux, aucune écriture.
 */

type Col = { name: string; type: string };
type TableInfo = { table: string; view: boolean; rows: number; columns: Col[] };
type Filter = { column: string; op: string; value: string };
type QueryResult = { count: number; rows: Record<string, unknown>[]; sql: string };
type Hit = { table: string; column: string; count: number };

const OPS: { v: string; label: string; noValue?: boolean }[] = [
  { v: "eq", label: "est égal à" },
  { v: "ne", label: "est différent de" },
  { v: "contains", label: "contient" },
  { v: "starts", label: "commence par" },
  { v: "ends", label: "finit par" },
  { v: "gt", label: "supérieur à" },
  { v: "gte", label: "supérieur ou égal à" },
  { v: "lt", label: "inférieur à" },
  { v: "lte", label: "inférieur ou égal à" },
  { v: "in", label: "parmi (séparés par des virgules)" },
  { v: "is_null", label: "est vide", noValue: true },
  { v: "not_null", label: "n'est pas vide", noValue: true },
];
const PAGE = 50;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function csvOf(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(cell(r[c]))).join(","))].join("\n");
}

export function DatabaseSearch() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<"query" | "search">("query");
  const [tables, setTables] = useState<TableInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Constructeur
  const [table, setTable] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [match, setMatch] = useState<"all" | "any">("all");
  const [order, setOrder] = useState("");
  const [desc, setDesc] = useState(false);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Recherche partout
  const [text, setText] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.rpc("founder_db_tables");
      if (e) return setLoadError(/founder_db_tables/.test(e.message) ? "Migration 0103 à lancer dans Supabase." : e.message);
      setTables((data ?? []) as TableInfo[]);
    })();
  }, [supabase]);

  const info = tables?.find((t) => t.table === table) ?? null;

  function pickTable(name: string) {
    setTable(name);
    setSelected([]);
    setFilters([]);
    setOrder("");
    setDesc(false);
    setOffset(0);
    setResult(null);
    setError(null);
  }

  const run = useCallback(
    async (opts?: { table?: string; filters?: Filter[]; offset?: number }) => {
      const t = opts?.table ?? table;
      if (!t) return;
      const f = opts?.filters ?? filters;
      const o = opts?.offset ?? offset;
      setBusy(true);
      setError(null);
      const { data, error: e } = await supabase.rpc("founder_db_query", {
        p_table: t,
        p_columns: opts?.table ? [] : selected,
        p_filters: f.filter((x) => x.column && (OPS.find((op) => op.v === x.op)?.noValue || x.value !== "")),
        p_match: match,
        p_order: opts?.table ? null : order || null,
        p_desc: desc,
        p_limit: PAGE,
        p_offset: o,
      });
      setBusy(false);
      if (e) {
        setResult(null);
        return setError(e.message);
      }
      setOffset(o);
      setResult(data as QueryResult);
    },
    [supabase, table, filters, offset, selected, match, order, desc]
  );

  function openHit(h: Hit) {
    const f = [{ column: h.column, op: "contains", value: text.trim() }];
    setMode("query");
    setTable(h.table);
    setSelected([]);
    setFilters(f);
    setOrder("");
    setOffset(0);
    run({ table: h.table, filters: f, offset: 0 });
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    setHits(null);
    const { data, error: er } = await supabase.rpc("founder_db_search", { p_text: text.trim() });
    setSearching(false);
    if (er) return setSearchError(er.message);
    setHits((data ?? []) as Hit[]);
  }

  function download() {
    if (!result) return;
    const blob = new Blob(["﻿" + csvOf(result.rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${table}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copySql() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.sql + ";");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  if (loadError) return <p className="font-mono text-sm text-red">{loadError}</p>;
  if (!tables) return <p className="font-body text-sm text-paper/60">Chargement…</p>;

  const visibleTables = tables.filter((t) => t.table.toLowerCase().includes(tableFilter.trim().toLowerCase()));
  const pages = result ? Math.max(1, Math.ceil(result.count / PAGE)) : 1;
  const cols = result && result.rows.length > 0 ? Object.keys(result.rows[0]) : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg uppercase text-paper">Base de données</h2>
        <p className="font-body text-sm text-paper/60">
          Réservé au fondateur. Lecture seule : rien ne peut être modifié ici. {tables.length} tables.
        </p>
      </div>

      <div role="radiogroup" aria-label="Mode" className="flex gap-2">
        {([
          ["query", "Construire une requête"],
          ["search", "Chercher un texte partout"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            role="radio"
            aria-checked={mode === k}
            onClick={() => setMode(k)}
            className={clsx(
              "rounded-lg px-3 py-1.5 font-mono text-xs uppercase",
              mode === k ? "bg-blue text-ink" : "border border-white/20 text-paper/70 hover:bg-white/10"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "search" && (
        <section className="space-y-3">
          <form onSubmit={search} className="glass-card flex flex-wrap items-end gap-3 p-4">
            <label className="min-w-[14rem] flex-1 space-y-1">
              <span className={labelClass}>Texte à chercher (majuscules ignorées)</span>
              <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} minLength={2} required />
            </label>
            <button disabled={searching} className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-50">
              {searching ? "Recherche…" : "Chercher"}
            </button>
          </form>
          {searchError && <p className="font-mono text-sm text-red">{searchError}</p>}
          {hits && (
            <div className="glass-card divide-y divide-white/10">
              {hits.length === 0 && <p className="p-4 font-body text-sm text-paper/60">Rien trouvé.</p>}
              {hits.map((h) => (
                <div key={`${h.table}.${h.column}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <p className="font-mono text-xs">
                    <span className="text-paper">{h.table}</span>
                    <span className="text-paper/55">.</span>
                    <span className="text-blue-light">{h.column}</span>
                    <span className="text-paper/60"> · {h.count.toLocaleString("fr-FR")} ligne{h.count > 1 ? "s" : ""}</span>
                  </p>
                  <button onClick={() => openHit(h)} className="rounded-lg border border-white/20 px-3 py-1 font-mono text-xs uppercase text-paper/80 hover:bg-white/10">
                    Voir les lignes
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {mode === "query" && (
        <section className="space-y-3">
          <div className="glass-card space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
              <label className="space-y-1">
                <span className={labelClass}>Table</span>
                <select className={inputClass} value={table} onChange={(e) => pickTable(e.target.value)}>
                  <option value="">Choisir…</option>
                  {visibleTables.map((t) => (
                    <option key={t.table} value={t.table}>
                      {t.table}
                      {t.view ? " (vue)" : ""} · ~{Number(t.rows).toLocaleString("fr-FR")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Filtrer la liste</span>
                <input className={inputClass} value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} placeholder="ex : quest" />
              </label>
            </div>

            {info && (
              <>
                <fieldset className="space-y-2">
                  <legend className={labelClass}>Colonnes (aucune cochée = toutes)</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {info.columns.map((c) => {
                      const on = selected.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          type="button"
                          aria-pressed={on}
                          title={c.type}
                          onClick={() => setSelected((s) => (on ? s.filter((x) => x !== c.name) : [...s, c.name]))}
                          className={clsx(
                            "rounded-full border px-2.5 py-1 font-mono text-[11px]",
                            on ? "border-blue bg-blue text-ink" : "border-white/15 text-paper/70 hover:bg-white/10"
                          )}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className={labelClass}>Conditions</legend>
                  {filters.length > 1 && (
                    <div className="flex items-center gap-2 font-mono text-xs text-paper/70">
                      Garder les lignes qui remplissent
                      <select className={clsx(inputClass, "!w-auto")} value={match} onChange={(e) => setMatch(e.target.value as "all" | "any")}>
                        <option value="all">toutes les conditions</option>
                        <option value="any">au moins une condition</option>
                      </select>
                    </div>
                  )}
                  {filters.map((f, i) => {
                    const noValue = OPS.find((o) => o.v === f.op)?.noValue;
                    const set = (patch: Partial<Filter>) => setFilters((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
                        <select aria-label="Colonne" className={inputClass} value={f.column} onChange={(e) => set({ column: e.target.value })}>
                          {info.columns.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name} ({c.type})
                            </option>
                          ))}
                        </select>
                        <select aria-label="Opérateur" className={inputClass} value={f.op} onChange={(e) => set({ op: e.target.value })}>
                          {OPS.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label="Valeur"
                          className={inputClass}
                          value={noValue ? "" : f.value}
                          disabled={noValue}
                          onChange={(e) => set({ value: e.target.value })}
                          placeholder={noValue ? "" : "valeur"}
                        />
                        <button
                          type="button"
                          aria-label="Retirer la condition"
                          onClick={() => setFilters((all) => all.filter((_, j) => j !== i))}
                          className="rounded-lg border border-white/20 px-3 font-mono text-xs text-paper/70 hover:bg-white/10"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setFilters((all) => [...all, { column: info.columns[0]?.name ?? "", op: "contains", value: "" }])}
                    className="rounded-lg border border-dashed border-white/25 px-3 py-1.5 font-mono text-xs uppercase text-paper/70 hover:bg-white/10"
                  >
                    + Ajouter une condition
                  </button>
                </fieldset>

                <div className="flex flex-wrap items-end gap-3">
                  <label className="space-y-1">
                    <span className={labelClass}>Trier par</span>
                    <select className={inputClass} value={order} onChange={(e) => setOrder(e.target.value)}>
                      <option value="">—</option>
                      {info.columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 pb-2 font-mono text-xs text-paper/80">
                    <input type="checkbox" className="accent-blue" checked={desc} onChange={(e) => setDesc(e.target.checked)} />
                    décroissant
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run({ offset: 0 })}
                    className="ml-auto rounded-lg bg-blue px-5 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-50"
                  >
                    {busy ? "…" : "Lancer"}
                  </button>
                </div>
              </>
            )}
          </div>

          {error && <p className="font-mono text-sm text-red">{error}</p>}

          {result && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-paper/70">
                <p>
                  {result.count.toLocaleString("fr-FR")} ligne{result.count > 1 ? "s" : ""}
                  {result.count > PAGE && ` · page ${Math.floor(offset / PAGE) + 1} / ${pages}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={copySql} className="rounded-lg border border-white/20 px-3 py-1 uppercase hover:bg-white/10">
                    {copied ? "Copié" : "Copier le SQL"}
                  </button>
                  <button onClick={download} disabled={result.rows.length === 0} className="rounded-lg border border-white/20 px-3 py-1 uppercase hover:bg-white/10 disabled:opacity-40">
                    CSV (cette page)
                  </button>
                </div>
              </div>
              <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] text-blue-light">{result.sql};</pre>

              {result.rows.length === 0 ? (
                <p className="glass-card p-4 font-body text-sm text-paper/60">Aucune ligne.</p>
              ) : (
                <div className="glass-card max-h-[32rem] overflow-auto">
                  <table className="w-full min-w-max border-collapse font-mono text-xs">
                    <thead className="sticky top-0 bg-[#262a38]">
                      <tr>
                        {cols.map((c) => (
                          <th key={c} scope="col" className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-left font-medium text-paper/60">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((r, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          {cols.map((c) => {
                            const v = cell(r[c]);
                            return (
                              <td key={c} title={v.length > 60 ? v : undefined} className={clsx("max-w-[22rem] truncate px-3 py-1.5", r[c] === null ? "text-paper/30" : "text-paper")}>
                                {r[c] === null ? "null" : v}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.count > PAGE && (
                <div className="flex items-center justify-between gap-2">
                  <button disabled={busy || offset === 0} onClick={() => run({ offset: Math.max(0, offset - PAGE) })} className="rounded-lg border border-white/20 px-3 py-1.5 font-mono text-xs uppercase text-paper/80 hover:bg-white/10 disabled:opacity-40">
                    Précédent
                  </button>
                  <button disabled={busy || offset + PAGE >= result.count} onClick={() => run({ offset: offset + PAGE })} className="rounded-lg border border-white/20 px-3 py-1.5 font-mono text-xs uppercase text-paper/80 hover:bg-white/10 disabled:opacity-40">
                    Suivant
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
