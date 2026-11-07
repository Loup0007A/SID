"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDeepLink } from "@/lib/deeplink";
import { SidIcon } from "@/components/icons/SidIcon";
import { px, when, z } from "@/lib/econ";
import { inputClass, labelClass } from "@/lib/ui";
import "@/components/admin/reforme.css";

/**
 * Réforme monétaire (Lot 70, migration 0087) : tous les montants du S.I.D.
 * multipliés par un même facteur, avec des exceptions. Rien n'est appliqué
 * avant la vérification d'un admin « Économie ».
 */

type ExKind = "quete" | "objet" | "membre" | "entreprise";
type Ex = { kind: ExKind; id: string; label: string };
type Cat = {
  key: string;
  label: string;
  kind: "solde" | "prix";
  on: boolean;
  n: number;
  before?: number;
  after?: number;
  note?: string | null;
  examples?: { label: string; before: number; after: number }[] | null;
};
type Preview = { factor: number; categories: Cat[]; index_now: number | null; index_after: number | null; members: number };
type Status = "draft" | "pending" | "applied" | "rejected" | "cancelled";
type Reform = {
  id: string;
  number: number;
  factor: number;
  motive: string;
  round_prices: boolean;
  scopes: Record<string, boolean>;
  exceptions: Ex[];
  status: Status;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  applied_at: string | null;
  price_factor: number | null;
  index_before: number | null;
  index_after: number | null;
  report: Preview | null;
  author: string | null;
  reviewer: string | null;
  mine: boolean;
  can_edit: boolean;
  can_review: boolean;
};

const CAT_KEYS = ["portefeuilles", "epargne", "dettes", "entreprises", "salaires", "objets", "autres", "encheres", "quetes", "population", "caisse", "en_cours", "reglages"];
const ALL_ON: Record<string, boolean> = Object.fromEntries(CAT_KEYS.map((k) => [k, true]));

const EX_KINDS: { kind: ExKind; label: string; icon: "scroll" | "cart" | "profile" | "office" }[] = [
  { kind: "quete", label: "Une quête", icon: "scroll" },
  { kind: "objet", label: "Un objet", icon: "cart" },
  { kind: "membre", label: "Un membre", icon: "profile" },
  { kind: "entreprise", label: "Une entreprise", icon: "office" },
];
const EX_HELP: Record<ExKind, string> = {
  quete: "sa récompense ne change pas",
  objet: "son prix (et ses enchères) ne changent pas",
  membre: "son portefeuille, son épargne, sa dette et son salaire ne changent pas",
  entreprise: "sa trésorerie, sa dette, son action et ses salaires ne changent pas",
};

const STATUS: Record<Status, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "border-white/30 text-paper/75" },
  pending: { label: "À vérifier", className: "border-yellow-400/70 text-yellow-300" },
  applied: { label: "Appliquée", className: "border-green-400/60 text-green-300" },
  rejected: { label: "Refusée", className: "border-red/70 text-red-light" },
  cancelled: { label: "Annulée", className: "border-white/20 text-paper/50" },
};

/** 0,8 → « −20 % » ; 1,25 → « +25 % ». */
function pctOf(f: number) {
  const v = Math.round(Math.abs(f - 1) * 1000) / 10;
  return `${f < 1 ? "−" : "+"}${v.toLocaleString("fr-FR")} %`;
}
const fx = (f: number) => Number(f).toLocaleString("fr-FR", { maximumFractionDigits: 4 });

export default function ReformePage() {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<Reform[] | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [open, setOpen] = useState<string | "new" | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [missing, setMissing] = useState(false);

  const say = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 6000);
  };

  const load = useCallback(async () => {
    const [l, e] = await Promise.all([supabase.rpc("reforms_list"), supabase.from("economy_daily").select("price_index").order("day", { ascending: false }).limit(1).maybeSingle()]);
    if (l.error) {
      if (l.error.message.includes("reforms_list")) setMissing(true);
      return setList([]);
    }
    setList((l.data ?? []) as Reform[]);
    if (e.data) setIndex(Number(e.data.price_index));
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useDeepLink("reforme", !!list, (id) => setOpen(id));

  if (missing) return <p className="glass-card max-w-2xl p-6 font-body text-sm text-paper/70">La réforme monétaire demande la migration 0087.</p>;

  const current = open && open !== "new" ? list?.find((r) => r.id === open) ?? null : null;
  const zeni = index ? 10000 / index : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="glass-card grid gap-5 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-paper/55">Administration · économie</p>
          <h1 className="font-display text-3xl uppercase tracking-wide text-red">Réforme monétaire</h1>
          <p className="mt-1 max-w-2xl font-body text-sm text-paper/75">
            Quand les prix ont trop monté, une réforme multiplie <b className="text-paper">tous les montants</b> du S.I.D. par un même facteur : soldes, prix,
            salaires, trésoreries, récompenses… Le pouvoir d&apos;achat de chacun ne change pas, le cours du zéni remonte. Un autre admin doit la vérifier avant
            qu&apos;elle s&apos;applique.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SidIcon name="zeni" size={52} />
          <div>
            <p className={labelClass}>Cours du zéni</p>
            <p className="ref-big text-paper">{zeni ? px(zeni) : "—"}</p>
            <p className="font-mono text-[11px] text-paper/55">indice des prix {index ? px(index) : "—"} · 100 au départ</p>
          </div>
        </div>
      </header>

      {open === "new" || (current && current.can_edit && (current.status === "draft" || current.status === "rejected")) ? (
        <Editor
          key={current?.id ?? "new"}
          reform={current}
          index={index}
          say={say}
          onClose={() => setOpen(null)}
          onSaved={async (id) => {
            await load();
            setOpen(id);
          }}
        />
      ) : current ? (
        <Detail
          key={`${current.id}-${current.updated_at}-${current.status}`}
          r={current}
          say={say}
          onClose={() => setOpen(null)}
          onChanged={async (id) => {
            await load();
            if (id) setOpen(id);
          }}
          onEdit={() => setOpen(current.id)}
        />
      ) : (
        <button type="button" onClick={() => setOpen("new")} className="glass-card flex w-full items-center justify-between gap-4 p-5 text-left transition hover:-translate-y-0.5">
          <span>
            <span className="block font-display text-xl uppercase text-[#f0c27a]">Préparer une réforme</span>
            <span className="block font-body text-sm text-paper/65">Choisir l&apos;ampleur, ce qui change, les exceptions. Rien n&apos;est appliqué avant la vérification.</span>
          </span>
          <span className="font-mono text-xs uppercase text-blue">Commencer →</span>
        </button>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-lg uppercase">Réformes</h2>
        {list === null ? (
          <p className="font-body text-sm text-paper/60">Chargement…</p>
        ) : list.length === 0 ? (
          <p className="font-body text-sm text-paper/60">Aucune réforme pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpen(r.id)}
                  className={`glass-card flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left transition hover:border-[#f0c27a]/50 ${open === r.id ? "ring-1 ring-[#f0c27a]/60" : ""}`}
                >
                  <span className="font-mono text-[11px] text-paper/50">N° {r.number}</span>
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${STATUS[r.status].className}`}>{STATUS[r.status].label}</span>
                  <span className={`font-display text-xl ${r.factor < 1 ? "text-red-light" : "text-blue-light"}`}>{pctOf(r.factor)}</span>
                  <span className="min-w-0 flex-1 truncate font-body text-sm text-paper/80">{r.motive}</span>
                  <span className="font-mono text-[11px] text-paper/50">
                    {r.author ?? "—"} · {when(r.applied_at ?? r.submitted_at ?? r.created_at)}
                  </span>
                  {r.can_review && <span className="font-mono text-[11px] uppercase text-yellow-300">à toi de vérifier</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast && (
        <div role="status" className={`fixed bottom-24 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 font-body text-sm shadow-xl backdrop-blur ${toast.ok ? "border-blue/50 bg-ink/90 text-paper" : "border-red/60 bg-ink/90 text-red-light"}`}>
          <SidIcon name={toast.ok ? "check" : "warning"} size={16} /> {toast.text}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Éditeur
function Editor({ reform, index, say, onClose, onSaved }: { reform: Reform | null; index: number | null; say: (ok: boolean, t: string) => void; onClose: () => void; onSaved: (id: string) => Promise<void> }) {
  const supabase = useMemo(() => createClient(), []);
  const f0 = reform?.factor ?? 0.8;
  const [down, setDown] = useState(f0 < 1);
  const [pct, setPct] = useState(String(Math.round(Math.abs(f0 - 1) * 1000) / 10));
  const [scopes, setScopes] = useState<Record<string, boolean>>({ ...ALL_ON, ...(reform?.scopes ?? {}) });
  const [ex, setEx] = useState<Ex[]>(reform?.exceptions ?? []);
  const [motive, setMotive] = useState(reform?.motive ?? "");
  const [round, setRound] = useState(reform?.round_prices ?? true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const p = Math.max(0, Number(pct.replace(",", ".")) || 0);
  const factor = down ? 1 - p / 100 : 1 + p / 100;
  const valid = p > 0 && factor >= 0.05 && factor <= 20;

  // Aperçu recalculé à chaque réglage (après une courte pause).
  const seq = useRef(0);
  useEffect(() => {
    if (!valid) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("reform_preview", { p_factor: factor, p_scopes: scopes, p_exceptions: ex, p_round: round });
      if (n !== seq.current) return;
      if (error) say(false, error.message);
      else setPreview(data as Preview);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factor, scopes, ex, round, valid, supabase]);

  const backTo100 = index && Math.abs(index - 100) > 0.5 ? 100 / index : null;
  const onCount = CAT_KEYS.filter((k) => scopes[k]).length;

  async function save(submit: boolean) {
    setBusy(true);
    const { data, error } = await supabase.rpc("reform_save", {
      p_id: reform?.id ?? null,
      p_factor: Math.round(factor * 1e6) / 1e6,
      p_motive: motive,
      p_round: round,
      p_scopes: scopes,
      p_exceptions: ex.map(({ kind, id }) => ({ kind, id })),
    });
    if (error) {
      setBusy(false);
      return say(false, error.message);
    }
    const id = data as string;
    if (submit) {
      const s = await supabase.rpc("reform_submit", { p_id: id });
      setBusy(false);
      if (s.error) return say(false, s.error.message);
      say(true, "Réforme envoyée : les autres admins « Économie » sont prévenus. Rien ne change avant leur validation.");
    } else {
      setBusy(false);
      say(true, "Brouillon enregistré.");
    }
    await onSaved(id);
  }

  return (
    <section className="glass-card space-y-2 p-6" aria-label="Préparer une réforme">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl uppercase text-[#f0c27a]">{reform ? `Réforme n° ${reform.number}` : "Nouvelle réforme"}</h2>
        <button type="button" onClick={onClose} className="font-mono text-xs uppercase text-paper/60 hover:text-paper">
          Fermer
        </button>
      </div>
      {reform?.status === "rejected" && reform.review_note && (
        <p className="mb-4 rounded-lg border border-red/50 bg-red/10 px-4 py-2 font-body text-sm text-red-light">
          Refusée par {reform.reviewer ?? "un admin"} : « {reform.review_note} ». Corrige puis renvoie-la.
        </p>
      )}

      {/* 1 ------------------------------------------------------------ */}
      <div className="ref-step" data-n="1">
        <h3 className="font-display text-lg uppercase">De combien ?</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-white/15 p-0.5" role="group" aria-label="Sens">
            {[
              [true, "Baisser les montants"],
              [false, "Les augmenter"],
            ].map(([v, l]) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={down === v}
                onClick={() => setDown(v as boolean)}
                className={`rounded-md px-3 py-1.5 font-mono text-xs uppercase ${down === v ? "bg-[#f0c27a] text-ink" : "text-paper/65 hover:text-paper"}`}
              >
                {l as string}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="sr-only">Pourcentage</span>
            <input type="number" min={0.1} max={down ? 95 : 1900} step="any" inputMode="decimal" className={`${inputClass} !w-24 text-right`} value={pct} onChange={(e) => setPct(e.target.value)} />
            <span className="font-display text-xl">%</span>
          </label>
          {backTo100 && (
            <button
              type="button"
              onClick={() => {
                setDown(backTo100 < 1);
                setPct(String(Math.round(Math.abs(backTo100 - 1) * 1000) / 10));
              }}
              className="rounded-full border border-[#f0c27a]/60 px-3 py-1 font-mono text-[11px] uppercase text-[#f0c27a] hover:bg-[#f0c27a]/10"
            >
              Ramener le zéni à 100 ({pctOf(backTo100)})
            </button>
          )}
        </div>
        <input
          type="range"
          className="ref-range mt-3"
          min={1}
          max={down ? 90 : 200}
          step={0.5}
          value={Math.min(p, down ? 90 : 200)}
          onChange={(e) => setPct(e.target.value)}
          aria-label="Ampleur de la réforme"
        />
        {valid ? (
          <p className="mt-2 font-body text-[15px] text-paper/85">
            Tout est multiplié par <b className="text-paper">{fx(factor)}</b> : un objet à <b>1 000 z</b> passe à <b>{z(1000 * factor, 0)}</b>, un solde de{" "}
            <b>5 000 z</b> passe à <b>{z(5000 * factor, 0)}</b>.
            {index && scopes.objets && (
              <span className="text-paper/65">
                {" "}
                Cours du zéni : {px(10000 / index)} → <b className="text-[#f0c27a]">{px(10000 / (index * factor))}</b> environ.
              </span>
            )}
          </p>
        ) : (
          <p className="mt-2 font-mono text-xs text-red">Entre 0,1 % et 95 % de baisse, ou jusqu&apos;à ×20.</p>
        )}
      </div>

      {/* 2 ------------------------------------------------------------ */}
      <div className="ref-step" data-n="2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg uppercase">Qu&apos;est-ce qui change ?</h3>
          <span className="font-mono text-[11px] text-paper/55">
            {onCount} / {CAT_KEYS.length} · touche une carte pour l&apos;inclure ou l&apos;exclure
          </span>
        </div>
        <CatGrid cats={preview?.categories ?? null} scopes={scopes} onToggle={(k) => setScopes((s) => ({ ...s, [k]: !s[k] }))} />
      </div>

      {/* 3 ------------------------------------------------------------ */}
      <div className="ref-step" data-n="3">
        <h3 className="font-display text-lg uppercase">Sauf…</h3>
        <p className="mt-1 font-body text-sm text-paper/65">
          Des cas précis qui ne bougent pas. Pour garder <i>toutes</i> les quêtes (ou tous les objets) telles quelles, désactive plutôt leur carte ci-dessus.
        </p>
        <ExceptionPicker ex={ex} onAdd={(e) => setEx((l) => (l.some((x) => x.kind === e.kind && x.id === e.id) ? l : [...l, e]))} onRemove={(e) => setEx((l) => l.filter((x) => !(x.kind === e.kind && x.id === e.id)))} />
      </div>

      {/* 4 ------------------------------------------------------------ */}
      <div className="ref-step" data-n="4">
        <h3 className="font-display text-lg uppercase">Pourquoi ?</h3>
        <textarea
          rows={2}
          maxLength={500}
          className={`${inputClass} mt-2`}
          value={motive}
          onChange={(e) => setMotive(e.target.value)}
          placeholder="Ex. : les prix ont monté de 25 % depuis septembre. Lu par tous les membres."
        />
        <label className="mt-2 flex items-center gap-2 font-body text-sm text-paper/80">
          <input type="checkbox" checked={round} onChange={(e) => setRound(e.target.checked)} className="h-4 w-4 accent-[#f0c27a]" />
          Arrondir les prix (objets, quêtes, enchères) au zéni : 99,99 z × 0,8 donne 80 z plutôt que 79,99 z.
        </label>
      </div>

      <div className="ref-bar mt-6">
        <span className={`font-display text-2xl ${factor < 1 ? "text-red-light" : "text-blue-light"}`}>{valid ? pctOf(factor) : "—"}</span>
        <span className="font-mono text-[11px] text-paper/65">
          {onCount} catégorie{onCount > 1 ? "s" : ""} · {ex.length} exception{ex.length > 1 ? "s" : ""}
          {preview ? ` · ${preview.members} membres prévenus` : ""}
        </span>
        <span className="ml-auto flex gap-2">
          <button type="button" disabled={busy || !valid || motive.trim().length < 3} onClick={() => save(false)} className="rounded-lg border border-white/25 px-3 py-2 font-mono text-xs uppercase text-paper hover:bg-white/10 disabled:opacity-40">
            Enregistrer
          </button>
          <button type="button" disabled={busy || !valid || motive.trim().length < 3} onClick={() => save(true)} className="rounded-lg bg-[#f0c27a] px-4 py-2 font-display text-sm uppercase tracking-wide text-ink hover:brightness-110 disabled:opacity-40">
            Envoyer pour vérification
          </button>
        </span>
      </div>
    </section>
  );
}

function CatGrid({ cats, scopes, onToggle, readOnly }: { cats: Cat[] | null; scopes: Record<string, boolean>; onToggle?: (k: string) => void; readOnly?: boolean }) {
  if (!cats) return <p className="mt-3 font-body text-sm text-paper/60">Calcul de l&apos;aperçu…</p>;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {cats.map((c) => {
        const on = scopes[c.key] ?? true;
        const body = (
          <>
            <div className="flex items-start justify-between gap-2">
              <span className="font-display uppercase leading-tight text-paper">{c.label}</span>
              {!readOnly && <span className={`ref-switch ${on ? "is-on" : ""}`} aria-hidden />}
            </div>
            <span className="font-mono text-[11px] text-paper/55">
              {c.n.toLocaleString("fr-FR")} {c.kind === "solde" ? "montant" : "prix"}
              {c.n > 1 ? "s" : ""}
            </span>
            {c.before != null && c.after != null && !(c.examples && c.examples.length > 0) && c.before !== 0 && (
              <span className="font-mono text-xs text-paper/80">
                {z(c.before, 0)} {on && <>→ <b className={c.after < c.before ? "text-red-light" : "text-blue-light"}>{z(c.after, 0)}</b></>}
              </span>
            )}
            {c.examples && c.examples.length > 0 && (
              <span className="space-y-0.5">
                {c.examples.slice(0, 3).map((e) => (
                  <span key={e.label} className="flex justify-between gap-2 font-mono text-[11px] text-paper/70">
                    <span className="truncate">{e.label}</span>
                    <span className="shrink-0">
                      {px(e.before)} {on && <>→ <b className="text-paper">{px(e.after)}</b></>}
                    </span>
                  </span>
                ))}
              </span>
            )}
            {c.note && <span className="font-body text-[11px] text-paper/55">{c.note}</span>}
            {!on && <span className="font-mono text-[10px] uppercase text-paper/50">inchangé</span>}
          </>
        );
        return readOnly ? (
          <div key={c.key} className={`ref-cat ${on ? "is-on" : "is-off"}`}>
            {body}
          </div>
        ) : (
          <button key={c.key} type="button" aria-pressed={on} onClick={() => onToggle?.(c.key)} className={`ref-cat ${on ? "is-on" : "is-off"}`}>
            {body}
          </button>
        );
      })}
    </div>
  );
}

function ExceptionPicker({ ex, onAdd, onRemove }: { ex: Ex[]; onAdd: (e: Ex) => void; onRemove: (e: Ex) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [kind, setKind] = useState<ExKind>("quete");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; label: string; sub: string }[]>([]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("reform_search", { p_kind: kind, p_query: q });
      if (alive) setResults((data ?? []) as { id: string; label: string; sub: string }[]);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [supabase, kind, q]);

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist">
        {EX_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="tab"
            aria-selected={kind === k.kind}
            onClick={() => setKind(k.kind)}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase ${kind === k.kind ? "border-[#f0c27a] text-[#f0c27a]" : "border-white/15 text-paper/60 hover:text-paper"}`}
          >
            <SidIcon name={k.icon} size={13} /> {k.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par nom…" aria-label="Rechercher une exception" />
          <p className="font-body text-[11px] text-paper/55">Choisie, {EX_HELP[kind]}.</p>
          <ul className="max-h-56 overflow-y-auto rounded-lg border border-white/10">
            {results.length === 0 ? (
              <li className="px-3 py-2 font-body text-sm text-paper/50">Rien trouvé.</li>
            ) : (
              results.map((r) => {
                const taken = ex.some((e) => e.kind === kind && e.id === r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={taken}
                      onClick={() => onAdd({ kind, id: r.id, label: r.label })}
                      className="flex w-full items-center justify-between gap-2 border-b border-white/5 px-3 py-2 text-left font-body text-sm hover:bg-white/5 disabled:opacity-40"
                    >
                      <span className="truncate">{r.label}</span>
                      <span className="shrink-0 font-mono text-[11px] text-paper/50">{taken ? "ajoutée" : r.sub}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        <div>
          <p className={labelClass}>Exceptions ({ex.length})</p>
          {ex.length === 0 ? (
            <p className="mt-1 font-body text-sm text-paper/50">Aucune : tout ce qui est coché change.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {ex.map((e) => (
                <span key={`${e.kind}-${e.id}`} className="ref-chip">
                  <SidIcon name={EX_KINDS.find((k) => k.kind === e.kind)!.icon} size={13} />
                  {e.label}
                  <button type="button" onClick={() => onRemove(e)} aria-label={`Retirer ${e.label}`}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Vérification, résultat
function Detail({ r, say, onClose, onChanged, onEdit }: { r: Reform; say: (ok: boolean, t: string) => void; onClose: () => void; onChanged: (id?: string) => Promise<void>; onEdit: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [preview, setPreview] = useState<Preview | null>(r.status === "applied" ? r.report : null);
  const [checks, setChecks] = useState([false, false, false]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (r.status === "applied" || r.status === "cancelled") return;
    supabase.rpc("reform_preview", { p_factor: r.factor, p_scopes: r.scopes, p_exceptions: r.exceptions.map(({ kind, id }) => ({ kind, id })), p_round: r.round_prices }).then(({ data, error }) => {
      if (error) say(false, error.message);
      else setPreview(data as Preview);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id, r.updated_at]);

  async function review(approve: boolean) {
    if (approve && !confirm(`Appliquer la réforme n° ${r.number} (${pctOf(r.factor)}) maintenant ? Tous les montants concernés changent d'un coup.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("reform_review", { p_id: r.id, p_approve: approve, p_note: note || null, p_version: r.updated_at });
    setBusy(false);
    if (error) return say(false, error.message);
    say(true, approve ? `Réforme n° ${r.number} appliquée. Les membres sont prévenus.` : "Réforme refusée : son auteur est prévenu.");
    await onChanged(r.id);
  }

  const scopes = { ...ALL_ON, ...r.scopes };
  const cats = preview?.categories ?? null;
  const allChecked = checks.every(Boolean);

  return (
    <section className="glass-card space-y-5 p-6" aria-label={`Réforme n° ${r.number}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/55">
            Réforme n° {r.number} · préparée par {r.author ?? "—"} le {when(r.created_at)}
          </p>
          <p className={`ref-big mt-1 ${r.factor < 1 ? "text-red-light" : "text-blue-light"}`}>
            {pctOf(r.factor)} <span className="font-mono text-base text-paper/60">× {fx(r.factor)}</span>
          </p>
          <p className="mt-2 max-w-2xl font-body text-[15px] text-paper/85">« {r.motive} »</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase ${STATUS[r.status].className}`}>{STATUS[r.status].label}</span>
          <button type="button" onClick={onClose} className="font-mono text-xs uppercase text-paper/60 hover:text-paper">
            Fermer
          </button>
        </div>
      </div>

      {r.status === "pending" && (
        <p className="rounded-lg border border-yellow-400/50 bg-yellow-400/5 px-4 py-2 font-body text-sm text-yellow-200">
          <SidIcon name="hourglass" size={15} /> Rien n&apos;est appliqué tant qu&apos;un admin « Économie » n&apos;a pas vérifié et validé.
          {r.mine && !r.can_review && " Un autre admin doit le faire : il a été prévenu."}
        </p>
      )}
      {r.status === "applied" && (
        <p className="rounded-lg border border-green-400/40 bg-green-400/5 px-4 py-2 font-body text-sm text-green-200">
          Appliquée le {when(r.applied_at!)}, vérifiée par {r.reviewer ?? "—"}
          {r.index_before != null && r.index_after != null && ` · indice des prix ${px(r.index_before)} → ${px(r.index_after)}`}
          {r.review_note && ` · « ${r.review_note} »`}
        </p>
      )}

      <div>
        <h3 className="font-display uppercase">{r.status === "applied" ? "Ce qui a changé" : "Ce qui changera (calculé maintenant)"}</h3>
        <CatGrid cats={cats} scopes={scopes} readOnly />
      </div>

      <div>
        <h3 className="font-display uppercase">Exceptions</h3>
        {r.exceptions.length === 0 ? (
          <p className="font-body text-sm text-paper/60">Aucune.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {r.exceptions.map((e) => (
              <span key={`${e.kind}-${e.id}`} className="ref-chip pr-3">
                <SidIcon name={EX_KINDS.find((k) => k.kind === e.kind)!.icon} size={13} /> {e.label}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 font-body text-xs text-paper/55">Prix arrondis au zéni : {r.round_prices ? "oui" : "non"}.</p>
      </div>

      {r.can_review && (
        <div className="space-y-3 rounded-xl border border-[#f0c27a]/40 bg-[#f0c27a]/5 p-4">
          <p className="font-display uppercase text-[#f0c27a]">Vérifier</p>
          {[
            `L'ampleur est la bonne : ${pctOf(r.factor)}, soit × ${fx(r.factor)}.`,
            "Les catégories cochées et les exceptions sont les bonnes.",
            "J'ai relu les montants avant / après ci-dessus.",
          ].map((t, i) => (
            <label key={i} className="flex items-start gap-2 font-body text-sm text-paper/85">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#f0c27a]" checked={checks[i]} onChange={(e) => setChecks((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} />
              {t}
            </label>
          ))}
          <textarea rows={2} maxLength={500} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (obligatoire pour refuser)" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !allChecked || !preview} onClick={() => review(true)} className="rounded-lg bg-[#f0c27a] px-4 py-2 font-display text-sm uppercase tracking-wide text-ink hover:brightness-110 disabled:opacity-40">
              Valider et appliquer
            </button>
            <button type="button" disabled={busy || note.trim().length === 0} onClick={() => review(false)} className="rounded-lg border border-red/70 px-4 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40">
              Refuser
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {r.can_edit && (
          <button
            type="button"
            onClick={async () => {
              if (r.status === "pending") {
                // La modifier la renvoie en brouillon : il faudra la renvoyer pour vérification.
                const { error } = await supabase.rpc("reform_save", {
                  p_id: r.id,
                  p_factor: r.factor,
                  p_motive: r.motive,
                  p_round: r.round_prices,
                  p_scopes: r.scopes,
                  p_exceptions: r.exceptions.map(({ kind, id }) => ({ kind, id })),
                });
                if (error) return say(false, error.message);
                await onChanged(r.id);
              }
              onEdit();
            }}
            className="rounded-lg border border-white/25 px-3 py-2 font-mono text-xs uppercase text-paper hover:bg-white/10"
          >
            Modifier
          </button>
        )}
        {r.can_edit && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Annuler cette réforme ?")) return;
              const { error } = await supabase.rpc("reform_cancel", { p_id: r.id });
              if (error) return say(false, error.message);
              say(true, "Réforme annulée.");
              await onChanged();
            }}
            className="rounded-lg px-3 py-2 font-mono text-xs uppercase text-paper/60 hover:text-red-light"
          >
            Annuler la réforme
          </button>
        )}
        {r.status === "applied" && (
          <button
            type="button"
            onClick={async () => {
              const { data, error } = await supabase.rpc("reform_inverse", { p_id: r.id });
              if (error) return say(false, error.message);
              say(true, "Réforme inverse préparée en brouillon : à vérifier avant de l'envoyer.");
              await onChanged(data as string);
            }}
            className="rounded-lg border border-white/25 px-3 py-2 font-mono text-xs uppercase text-paper hover:bg-white/10"
          >
            Préparer la réforme inverse ({pctOf(1 / r.factor)})
          </button>
        )}
        <Link href="/dashboard/economie" className="ml-auto self-center font-mono text-xs uppercase text-blue hover:underline">
          Banque centrale →
        </Link>
      </div>
    </section>
  );
}
