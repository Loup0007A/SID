"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { inputClass, labelClass } from "@/lib/ui";
import { KIND_LABEL, RARITY, pct, segmentText, type WheelKind, type WheelRarity } from "@/types/wheel";

/**
 * Administration → Économie → Roue du jour (Lot 76, migration 0093).
 * Chaque gain a un poids au 1er jour de série et un poids à la série
 * maximale ; la chance d'un gain = son poids ÷ la somme des poids.
 */

type AdminPrize = {
  id: string;
  label: string;
  kind: WheelKind;
  amount: number;
  item_id: string | null;
  title_id: string | null;
  rarity: WheelRarity;
  weight_start: number;
  weight_max: number;
  min_streak: number;
  is_active: boolean;
  sort: number;
  p1: number | null;
  p7: number | null;
  pcap: number | null;
  won_30: number;
};
type AdminData = {
  enabled: boolean;
  cap: number;
  prizes: AdminPrize[];
  items: { id: string; name: string; stock: number | null }[];
  titles: { id: string; name: string }[];
  stats: {
    spins_today: number;
    spins_30: number;
    zeni_30: number;
    by_rarity_30: Partial<Record<WheelRarity, number>>;
    top_streaks: { nickname: string; streak: number }[];
    recent: { nickname: string; label: string; rarity: WheelRarity; streak: number; at: string }[];
  };
};
type Draft = Omit<AdminPrize, "p1" | "p7" | "pcap" | "won_30" | "id"> & { id: string | null };

const RARITIES: WheelRarity[] = ["commun", "rare", "epique", "legendaire"];
const KINDS: WheelKind[] = ["zeni", "renommee", "objet", "titre", "rien"];
const z = (n: number) => `${Math.round(Number(n)).toLocaleString("fr-FR")} z`;
const field = `${inputClass} !py-1.5 text-sm`;

/** Chances estimées (sans tenir compte des stocks ni des titres déjà obtenus). */
function estimate(prizes: { id: string | null; weight_start: number; weight_max: number; min_streak: number; is_active: boolean }[], cap: number, streak: number) {
  const t = Math.min(Math.max((streak - 1) / Math.max(cap - 1, 1), 0), 1);
  const w = prizes.map((p) => (p.is_active && streak >= p.min_streak ? Math.max(0, Number(p.weight_start) + (Number(p.weight_max) - Number(p.weight_start)) * t) : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (sum > 0 ? x / sum : 0));
}

export function WheelAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState<AdminData | null>(null);
  const [missing, setMissing] = useState(false);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [cap, setCap] = useState("30");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Le formulaire est sous la liste : on l'amène à l'écran (indispensable sur téléphone).
  useEffect(() => {
    if (edit) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [edit?.id, !!edit]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("wheel_admin");
    if (error) return setMissing(true);
    setD(data as AdminData);
    setCap(String((data as AdminData).cap));
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  async function call(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message }), false;
    setMsg({ ok: true, text: ok });
    await load();
    return true;
  }

  if (missing) return <p className="font-body text-sm text-paper/65">Lance la migration <code className="font-mono text-xs">0093_roue_absences.sql</code>.</p>;
  if (!d) return <p className="font-body text-sm text-paper/60">Chargement…</p>;

  const s = d.stats;
  // Aperçu en direct pendant l'édition : la liste avec le brouillon à la place du gain modifié.
  const preview = edit
    ? (() => {
        const list = [...d.prizes.filter((p) => p.id !== edit.id).map((p) => ({ ...p, id: p.id as string | null })), { ...edit }];
        const c = Number(cap) || d.cap;
        const i = list.length - 1;
        return [estimate(list, c, 1)[i], estimate(list, c, 7)[i], estimate(list, c, c)[i]];
      })()
    : null;

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Tours aujourd'hui", String(s.spins_today)],
          ["Tours (30 j)", String(s.spins_30)],
          ["Zénis distribués (30 j)", z(s.zeni_30)],
          ["Rares et mieux (30 j)", String((s.by_rarity_30.rare ?? 0) + (s.by_rarity_30.epique ?? 0) + (s.by_rarity_30.legendaire ?? 0))],
        ].map(([k, v]) => (
          <div key={k} className="glass-card p-4">
            <p className="font-mono text-[10px] uppercase text-paper/60">{k}</p>
            <p className="font-display text-xl text-paper">{v}</p>
          </div>
        ))}
      </div>

      <div className="glass-card flex flex-wrap items-end gap-4 p-4">
        <label className="flex items-center gap-2 font-body text-sm">
          <input
            type="checkbox"
            checked={d.enabled}
            disabled={busy}
            onChange={(e) => call("wheel_settings_save", { p_enabled: e.target.checked, p_cap: null }, e.target.checked ? "Roue ouverte." : "Roue fermée.")}
            className="h-4 w-4 accent-[#f0c27a]"
          />
          Roue ouverte
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Série maximale (jours)</span>
          <div className="flex gap-2">
            <input type="number" min={2} max={365} className={`${field} !w-24`} value={cap} onChange={(e) => setCap(e.target.value)} />
            <button
              type="button"
              disabled={busy || Number(cap) === d.cap}
              onClick={() => call("wheel_settings_save", { p_enabled: null, p_cap: Number(cap) }, "Série maximale enregistrée.")}
              className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
            >
              OK
            </button>
          </div>
        </label>
        <p className="min-w-0 flex-1 basis-64 font-body text-xs text-paper/60">
          Chance d&apos;un gain = son poids ÷ la somme des poids. Le poids passe en ligne droite de « 1er jour » à « {d.cap} jours ». Pour qu&apos;un gain rare
          sorte plus souvent avec la série, donne-lui un poids à {d.cap} jours plus grand qu&apos;au 1er jour.
        </p>
      </div>

      {msg && <p className={clsx("font-mono text-xs", msg.ok ? "text-green-300" : "text-red")}>{msg.text}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg uppercase text-paper">Gains</h2>
          <button
            type="button"
            onClick={() =>
              setEdit({ id: null, label: "", kind: "zeni", amount: 100, item_id: null, title_id: null, rarity: "commun", weight_start: 10, weight_max: 10, min_streak: 1, is_active: true, sort: d.prizes.length + 1 })
            }
            className="rounded-lg bg-red px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-red-light"
          >
            + Nouveau gain
          </button>
        </div>

        <div className="hidden grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_6rem_4rem_5.5rem] gap-x-3 px-3 font-mono text-[10px] uppercase text-paper/50 lg:grid">
          <span>Gain</span>
          <span className="text-right">Poids J1 → J{d.cap}</span>
          <span className="text-right">Chance J1</span>
          <span className="text-right">Chance J7</span>
          <span className="text-right">Chance J{d.cap}</span>
          <span className="text-right">30 j</span>
          <span />
        </div>
        <ul className="space-y-2">
          {d.prizes.map((p) => {
            const r = RARITY[p.rarity];
            return (
              <li
                key={p.id}
                className={clsx(
                  "glass-card grid grid-cols-2 items-center gap-x-3 gap-y-1 p-3 lg:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_6rem_4rem_5.5rem]",
                  !p.is_active && "opacity-50",
                )}
              >
                <span className="col-span-2 flex min-w-0 items-center gap-2 lg:col-span-1">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.kind === "rien" ? "#22202e" : r.fill, boxShadow: `0 0 0 1.5px ${r.ring}` }} />
                  <span className="min-w-0">
                    <span className="block truncate font-body text-sm text-paper">{segmentText(p)}</span>
                    <span className="block font-mono text-[10px] uppercase text-paper/50">
                      {r.label} · {KIND_LABEL[p.kind]}
                      {p.kind === "objet" && ` · ${d.items.find((i) => i.id === p.item_id)?.name ?? "objet retiré"}`}
                      {p.kind === "titre" && ` · ${d.titles.find((t) => t.id === p.title_id)?.name ?? "?"}`}
                      {p.min_streak > 1 && ` · dès ${p.min_streak} j`}
                      {!p.is_active && " · désactivé"}
                    </span>
                  </span>
                </span>
                <span className="font-mono text-xs text-paper/70 lg:text-right">
                  <span className="text-paper/45 lg:hidden">poids </span>
                  {Number(p.weight_start).toLocaleString("fr-FR")} → {Number(p.weight_max).toLocaleString("fr-FR")}
                </span>
                {[p.p1, p.p7, p.pcap].map((v, i) => (
                  <span key={i} className={clsx("text-right font-mono text-xs", i === 0 ? "text-paper/70" : "hidden text-paper/70 sm:block", i === 2 && "text-[#f0c27a]")}>
                    <span className="text-paper/45 lg:hidden">{i === 0 ? "J1 " : i === 1 ? "J7 " : `J${d.cap} `}</span>
                    {pct(v)}
                  </span>
                ))}
                <span className="hidden text-right font-mono text-xs text-paper/55 lg:block">{p.won_30}</span>
                <span className="col-span-2 flex justify-end gap-3 lg:col-span-1">
                  <button
                    type="button"
                    onClick={() => setEdit({ id: p.id, label: p.label, kind: p.kind, amount: Number(p.amount), item_id: p.item_id, title_id: p.title_id, rarity: p.rarity, weight_start: Number(p.weight_start), weight_max: Number(p.weight_max), min_streak: p.min_streak, is_active: p.is_active, sort: p.sort })}
                    className="font-mono text-[11px] uppercase text-blue hover:underline"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => confirm(`Supprimer « ${p.label} » de la roue ?`) && call("wheel_prize_delete", { p_id: p.id }, "Gain supprimé.")}
                    className="font-mono text-[11px] uppercase text-paper/50 hover:text-red-light"
                  >
                    Suppr.
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="font-body text-xs text-paper/50">Les chances affichées tiennent compte des objets épuisés ; un titre déjà obtenu sort de la roue pour ce membre seulement.</p>
      </div>

      {edit && (
        <form
          ref={formRef}
          className="glass-card scroll-mt-24 space-y-4 border-[#f0c27a]/40 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await call("wheel_prize_save", { p: edit }, edit.id ? "Gain modifié." : "Gain ajouté.");
            if (ok) setEdit(null);
          }}
        >
          <h3 className="font-display text-lg uppercase text-paper">{edit.id ? "Modifier le gain" : "Nouveau gain"}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {edit.kind !== "zeni" && edit.kind !== "renommee" && (
              <label className="space-y-1">
                <span className={labelClass}>Nom affiché sur la roue</span>
                <input
                  className={field}
                  maxLength={40}
                  value={edit.label}
                  onChange={(e) => setEdit({ ...edit, label: e.target.value })}
                  placeholder={edit.kind === "objet" ? "Nom de l'objet" : edit.kind === "titre" ? "Nom du titre" : "Rien"}
                />
              </label>
            )}
            <label className="space-y-1">
              <span className={labelClass}>Type</span>
              <select className={field} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as WheelKind })}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            {(edit.kind === "zeni" || edit.kind === "renommee") && (
              <label className="space-y-1">
                <span className={labelClass}>{edit.kind === "zeni" ? "Montant (z)" : "Points de renommée"}</span>
                <input type="number" min={1} step={edit.kind === "zeni" ? "any" : 1} className={field} value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: Number(e.target.value) })} />
              </label>
            )}
            {edit.kind === "objet" && (
              <label className="space-y-1">
                <span className={labelClass}>Objet de la boutique</span>
                <select className={field} required value={edit.item_id ?? ""} onChange={(e) => setEdit({ ...edit, item_id: e.target.value || null })}>
                  <option value="">Choisir…</option>
                  {d.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                      {i.stock != null ? ` (stock ${i.stock})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {edit.kind === "titre" && (
              <label className="space-y-1">
                <span className={labelClass}>Titre</span>
                <select className={field} required value={edit.title_id ?? ""} onChange={(e) => setEdit({ ...edit, title_id: e.target.value || null })}>
                  <option value="">Choisir…</option>
                  {d.titles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <fieldset className="space-y-1">
              <legend className={labelClass}>Rareté (couleur sur la roue)</legend>
              <div className="flex flex-wrap gap-1">
                {RARITIES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={edit.rarity === r}
                    onClick={() => setEdit({ ...edit, rarity: r })}
                    className={clsx("rounded-md border px-2 py-1 font-mono text-[11px] uppercase", edit.rarity === r ? "text-ink" : "text-paper/70")}
                    style={{ borderColor: RARITY[r].ring, background: edit.rarity === r ? RARITY[r].ring : "transparent" }}
                  >
                    {RARITY[r].label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className={labelClass}>Poids au 1er jour</span>
              <input type="number" min={0} step="any" className={field} value={edit.weight_start} onChange={(e) => setEdit({ ...edit, weight_start: Number(e.target.value) })} />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Poids à {cap} jours de série</span>
              <input type="number" min={0} step="any" className={field} value={edit.weight_max} onChange={(e) => setEdit({ ...edit, weight_max: Number(e.target.value) })} />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Disponible dès (jours de série)</span>
              <input type="number" min={1} max={365} className={field} value={edit.min_streak} onChange={(e) => setEdit({ ...edit, min_streak: Number(e.target.value) })} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 font-body text-sm">
              <input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} className="h-4 w-4 accent-[#f0c27a]" />
              Actif
            </label>
          </div>
          {preview && (
            <p className="font-mono text-xs text-paper/70">
              Chance estimée : <b className="text-paper">{pct(preview[0])}</b> au 1er jour · <b className="text-paper">{pct(preview[1])}</b> à 7 jours ·{" "}
              <b className="text-[#f0c27a]">{pct(preview[2])}</b> à {cap} jours
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button disabled={busy} className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
              Enregistrer
            </button>
            <button type="button" onClick={() => setEdit(null)} className="rounded-lg border border-white/15 px-4 py-2 font-mono text-xs uppercase text-paper/70 hover:bg-white/10">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card space-y-2 p-4">
          <h3 className="font-display uppercase text-paper">Derniers tours</h3>
          {s.recent.length === 0 ? (
            <p className="font-body text-sm text-paper/55">Personne n&apos;a encore tourné la roue.</p>
          ) : (
            <ul className="space-y-1">
              {s.recent.map((r, i) => (
                <li key={i} className="flex items-baseline gap-2 font-body text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <b className="font-display uppercase text-paper">{r.nickname}</b> <span style={{ color: RARITY[r.rarity].ring }}>{r.label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-paper/45">
                    série {r.streak} · {new Date(r.at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="glass-card space-y-2 p-4">
          <h3 className="font-display uppercase text-paper">Plus longues séries en cours</h3>
          {s.top_streaks.length === 0 ? (
            <p className="font-body text-sm text-paper/55">Aucune série en cours.</p>
          ) : (
            <ol className="space-y-1">
              {s.top_streaks.map((t, i) => (
                <li key={i} className="flex justify-between font-body text-sm">
                  <span className="font-display uppercase text-paper">
                    {i + 1}. {t.nickname}
                  </span>
                  <span className="font-mono text-xs text-[#f0c27a]">{t.streak} j</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </section>
  );
}
