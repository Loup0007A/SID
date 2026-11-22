"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import { inputClass, labelClass } from "@/lib/ui";

/**
 * Direction de la banque isolée (Lot 101, migration 0129). Réservée au
 * directeur, un fondateur désigné depuis l'éditeur SQL de Supabase.
 */

type Compte = { user_id: string; pseudo: string; solde: number; plafond: number | null; plafond_effectif: number; utilise_7j: number; accorde_le: string; gele: boolean };
type Retrait = { id: string; user_id: string; pseudo: string; montant: number; statut: "demande" | "accepte"; confirme_le: string; versable_le: string | null; note: string | null; solde: number };
type Direction = {
  plafond_defaut: number;
  total: number;
  comptes: Compte[];
  retraits: Retrait[];
  historique: { pseudo: string; kind: string; montant: number; at: string }[];
  membres: { id: string; pseudo: string }[];
};

const z = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} z`;
const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const nombre = (s: string) => Number(s.replace(",", "."));

const MOUVEMENT: Record<string, string> = {
  acces_donne: "accès ouvert",
  depot: "dépôt",
  retrait_mis_de_cote: "retrait demandé",
  retrait_rendu: "retrait rendu",
  retrait_verse: "retrait versé",
  acces_retire_detruit: "accès retiré, solde détruit",
  acces_retire_renvoye: "accès retiré, solde renvoyé",
  reforme: "réforme monétaire",
  plafond: "plafond modifié",
};

export default function BanqueIsoleePage() {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState<Direction | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [nouveau, setNouveau] = useState({ pseudo: "", plafond: "" });
  const [defaut, setDefaut] = useState("");

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc("banque_isolee_direction");
    if (error) {
      setRefus(/banque_isolee_direction|PGRST202/.test(`${error.message} ${error.code}`) ? "La banque isolée arrive avec la migration 0129." : error.message);
      return;
    }
    setRefus(null);
    setD(data as Direction);
    setDefaut(String((data as Direction).plafond_defaut));
  }, [supabase]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function agir(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await fn();
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: ok });
    if (!error) await charger();
    return !error;
  }

  if (refus) return <p className="glass-card max-w-2xl p-6 font-body text-sm text-paper/80">{refus}</p>;
  if (!d) return <p className="font-body text-sm text-paper/70">Chargement…</p>;

  const aDecider = d.retraits.filter((r) => r.statut === "demande");
  const enAttente = d.retraits.filter((r) => r.statut === "accepte");
  const choisi = d.membres.find((m) => m.pseudo.toLowerCase() === nouveau.pseudo.trim().toLowerCase());

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl uppercase tracking-wide text-red">
            <SidIcon name="padlock" /> Banque isolée
          </h1>
          <p className="mt-1 font-body text-sm text-paper/80">
            Hors de l&apos;économie du S.I.D. Tu es seul à décider : qui y a accès, combien chacun peut retirer sur 7 jours, et chaque retrait. Un retrait
            accepté n&apos;est versé sur l&apos;épargne qu&apos;après 48 h, pendant lesquelles tu peux encore le bloquer.
          </p>
        </div>
        <div className="text-right">
          <p className={labelClass}>Total isolé</p>
          <p className="font-display text-3xl text-blue-light">{z(d.total)}</p>
          <p className="font-mono text-[11px] text-paper/70">{d.comptes.length} compte(s)</p>
        </div>
      </header>

      {msg && (
        <p role="status" className={`glass-card px-4 py-3 font-mono text-sm ${msg.ok ? "text-green-300" : "text-red-light"}`}>
          {msg.text}
        </p>
      )}

      <section className="glass-card space-y-3 p-6" aria-labelledby="bi-decider">
        <h2 id="bi-decider" className="font-display text-lg uppercase">
          Retraits à décider {aDecider.length > 0 && <span className="text-yellow-300">({aDecider.length})</span>}
        </h2>
        {aDecider.length === 0 ? (
          <p className="font-body text-sm text-paper/75">Aucune demande.</p>
        ) : (
          <ul className="space-y-3">
            {aDecider.map((r) => (
              <li key={r.id} className="space-y-2 rounded-xl border border-yellow-400/40 bg-yellow-400/5 p-4">
                <p className="font-body">
                  <strong>{r.pseudo}</strong> demande <strong>{z(r.montant)}</strong>
                  <span className="font-mono text-[11px] text-paper/75"> · confirmé le {quand(r.confirme_le)} · il lui restera {z(r.solde)}</span>
                </p>
                <textarea
                  rows={2}
                  maxLength={500}
                  className={inputClass}
                  placeholder="Note (obligatoire pour refuser)"
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!confirm(`Accepter le retrait de ${z(r.montant)} pour ${r.pseudo} ? Il sera versé dans 48 h.`)) return;
                      void agir(() => supabase.rpc("banque_isolee_retrait_decider", { p_id: r.id, p_accepter: true, p_note: notes[r.id] || null }), "Retrait accepté : versement dans 48 h.");
                    }}
                    className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
                  >
                    Accepter
                  </button>
                  <button
                    type="button"
                    disabled={busy || !(notes[r.id] ?? "").trim()}
                    onClick={() => agir(() => supabase.rpc("banque_isolee_retrait_decider", { p_id: r.id, p_accepter: false, p_note: notes[r.id] }), "Retrait refusé : la somme reste dans la banque isolée.")}
                    className="rounded-lg border border-red/70 px-4 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
                  >
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {enAttente.length > 0 && (
        <section className="glass-card space-y-3 p-6" aria-labelledby="bi-attente">
          <h2 id="bi-attente" className="font-display text-lg uppercase">
            En attente de versement
          </h2>
          <ul className="space-y-3">
            {enAttente.map((r) => (
              <li key={r.id} className="flex flex-wrap items-end gap-3 rounded-lg bg-white/5 p-3">
                <p className="min-w-[14rem] flex-1 font-body text-sm">
                  <strong>{r.pseudo}</strong> · {z(r.montant)}
                  <span className="block font-mono text-[11px] text-paper/75">versé le {r.versable_le ? quand(r.versable_le) : "—"}</span>
                </p>
                <input
                  className={`${inputClass} min-w-[12rem] flex-1`}
                  placeholder="Motif du blocage"
                  maxLength={500}
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  aria-label={`Motif du blocage pour ${r.pseudo}`}
                />
                <button
                  type="button"
                  disabled={busy || !(notes[r.id] ?? "").trim()}
                  onClick={() => agir(() => supabase.rpc("banque_isolee_retrait_bloquer", { p_id: r.id, p_note: notes[r.id] }), "Retrait bloqué : la somme reste dans la banque isolée.")}
                  className="rounded-lg border border-red/70 px-3 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
                >
                  Bloquer
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="glass-card space-y-3 p-6" aria-labelledby="bi-comptes">
        <h2 id="bi-comptes" className="font-display text-lg uppercase">
          Comptes
        </h2>
        {d.comptes.length === 0 ? (
          <p className="font-body text-sm text-paper/75">Personne n&apos;a encore accès. Donne l&apos;accès à un membre ci-dessous.</p>
        ) : (
          <ul className="space-y-3">
            {d.comptes.map((c) => (
              <LigneCompte key={c.user_id} c={c} busy={busy} agir={agir} />
            ))}
          </ul>
        )}
      </section>

      <section className="glass-card space-y-4 p-6" aria-labelledby="bi-acces">
        <h2 id="bi-acces" className="font-display text-lg uppercase">
          Donner l&apos;accès
        </h2>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!choisi) return;
            const p = nouveau.plafond.trim() ? nombre(nouveau.plafond) : null;
            if (await agir(() => supabase.rpc("banque_isolee_donner_acces", { p_user: choisi.id, p_plafond: p }), `${choisi.pseudo} a maintenant accès à la banque isolée.`))
              setNouveau({ pseudo: "", plafond: "" });
          }}
        >
          <label className="min-w-[12rem] flex-1 space-y-1">
            <span className={labelClass}>Membre</span>
            <input list="bi-membres" className={inputClass} value={nouveau.pseudo} onChange={(e) => setNouveau((n) => ({ ...n, pseudo: e.target.value }))} placeholder="Pseudo" />
            <datalist id="bi-membres">
              {d.membres.map((m) => (
                <option key={m.id} value={m.pseudo} />
              ))}
            </datalist>
          </label>
          <label className="w-44 space-y-1">
            <span className={labelClass}>Plafond sur 7 jours</span>
            <input type="number" min={0} step="0.01" className={inputClass} value={nouveau.plafond} onChange={(e) => setNouveau((n) => ({ ...n, plafond: e.target.value }))} placeholder={`Par défaut : ${d.plafond_defaut}`} />
          </label>
          <button type="submit" disabled={busy || !choisi} className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
            Donner l&apos;accès
          </button>
        </form>

        <form
          className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void agir(() => supabase.rpc("banque_isolee_regler_plafond", { p_user: null, p_plafond: nombre(defaut) }), "Plafond par défaut enregistré.");
          }}
        >
          <label className="w-56 space-y-1">
            <span className={labelClass}>Plafond par défaut sur 7 jours</span>
            <input type="number" min={0} step="0.01" className={inputClass} value={defaut} onChange={(e) => setDefaut(e.target.value)} />
          </label>
          <button type="submit" disabled={busy || defaut === "" || nombre(defaut) === Number(d.plafond_defaut)} className="rounded-lg border border-white/25 px-4 py-2 font-mono text-xs uppercase hover:bg-white/10 disabled:opacity-40">
            Enregistrer
          </button>
          <p className="w-full font-body text-xs text-paper/75">S&apos;applique aux comptes sans plafond propre. 0 : aucun retrait possible.</p>
        </form>
      </section>

      {d.historique.length > 0 && (
        <details className="glass-card p-6">
          <summary className="cursor-pointer font-display uppercase">Historique</summary>
          <ul className="mt-3 divide-y divide-white/10">
            {d.historique.map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex flex-wrap justify-between gap-2 py-1.5 font-body text-sm">
                <span>
                  <strong>{h.pseudo}</strong> · {MOUVEMENT[h.kind] ?? h.kind}
                  {h.montant !== 0 && ` · ${h.montant > 0 ? "+" : "−"}${z(Math.abs(h.montant))}`}
                </span>
                <span className="font-mono text-[11px] text-paper/70">{quand(h.at)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="font-body text-xs text-paper/75">
        Pendant une réforme monétaire, tu valides la réforme et décides si la banque isolée est convertie :{" "}
        <Link href="/dashboard/admin/reforme" className="underline">
          réformes
        </Link>
        .
      </p>
    </div>
  );
}

function LigneCompte({ c, busy, agir }: { c: Compte; busy: boolean; agir: (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => Promise<boolean> }) {
  const supabase = useMemo(() => createClient(), []);
  const [plafond, setPlafond] = useState(c.plafond == null ? "" : String(c.plafond));
  const [retrait, setRetrait] = useState<null | { mode: "renvoyer" | "detruire"; pseudo: string }>(null);

  return (
    <li className="space-y-3 rounded-xl bg-white/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-body">
          <strong>{c.pseudo}</strong> {c.gele && <span className="font-mono text-[11px] uppercase text-red-light">gelé</span>}
          <span className="font-mono text-[11px] text-paper/75"> · depuis le {new Date(c.accorde_le).toLocaleDateString("fr-FR")}</span>
        </p>
        <p className="font-display text-xl text-blue-light">{z(c.solde)}</p>
      </div>
      <p className="font-body text-sm text-paper/80">
        Retraits sur 7 jours : {z(c.utilise_7j)} sur {z(c.plafond_effectif)} {c.plafond == null && <span className="text-paper/70">(plafond par défaut)</span>}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="w-44 space-y-1">
          <span className={labelClass}>Plafond propre</span>
          <input type="number" min={0} step="0.01" className={inputClass} value={plafond} onChange={(e) => setPlafond(e.target.value)} placeholder="Par défaut" />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            agir(
              () => supabase.rpc("banque_isolee_regler_plafond", { p_user: c.user_id, p_plafond: plafond.trim() ? nombre(plafond) : null }),
              plafond.trim() ? `Plafond de ${c.pseudo} enregistré.` : `${c.pseudo} revient au plafond par défaut.`,
            )
          }
          className="rounded-lg border border-white/25 px-3 py-2 font-mono text-xs uppercase hover:bg-white/10 disabled:opacity-40"
        >
          Enregistrer
        </button>
        {!retrait && (
          <button type="button" onClick={() => setRetrait({ mode: "renvoyer", pseudo: "" })} className="ml-auto rounded-lg px-3 py-2 font-mono text-xs uppercase text-paper/75 hover:text-red-light">
            Retirer l&apos;accès
          </button>
        )}
      </div>

      {retrait && (
        <form
          className="space-y-3 rounded-lg border border-red/50 bg-red/5 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await agir(
              () => supabase.rpc("banque_isolee_retirer_acces", { p_user: c.user_id, p_mode: retrait.mode, p_confirmation: retrait.pseudo }),
              retrait.mode === "detruire" ? `Accès retiré : ${z(c.solde)} détruits.` : `Accès retiré : ${z(c.solde)} renvoyés sur l'épargne de ${c.pseudo}.`,
            );
            if (ok) setRetrait(null);
          }}
        >
          <fieldset className="space-y-2">
            <legend className="font-body text-sm">Que devient le solde ({z(c.solde)}, plus les retraits en cours) ?</legend>
            {(
              [
                ["renvoyer", "Renvoyé sur son épargne"],
                ["detruire", "Détruit (définitif)"],
              ] as const
            ).map(([v, t]) => (
              <label key={v} className="flex items-center gap-2 font-body text-sm">
                <input type="radio" name={`mode-${c.user_id}`} checked={retrait.mode === v} onChange={() => setRetrait({ ...retrait, mode: v })} />
                {t}
              </label>
            ))}
          </fieldset>
          <label className="block max-w-xs space-y-1">
            <span className={labelClass}>Retape « {c.pseudo} » pour confirmer</span>
            <input className={inputClass} autoComplete="off" value={retrait.pseudo} onChange={(e) => setRetrait({ ...retrait, pseudo: e.target.value })} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || retrait.pseudo.trim().toLowerCase() !== c.pseudo.toLowerCase()}
              className="rounded-lg bg-red px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-red-light disabled:opacity-40"
            >
              {retrait.mode === "detruire" ? "Retirer et détruire" : "Retirer et renvoyer"}
            </button>
            <button type="button" onClick={() => setRetrait(null)} className="rounded-lg px-3 py-2 font-mono text-xs uppercase text-paper/75 hover:text-paper">
              Annuler
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
