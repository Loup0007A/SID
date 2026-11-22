"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import { inputClass, labelClass } from "@/lib/ui";

/**
 * Banque isolée (Lot 101, migration 0129) : argent mis à l'abri, hors de
 * l'économie du S.I.D. Dépôts depuis l'épargne, retraits vers l'épargne
 * après confirmation, décision du directeur, 48 h d'attente et plafond sur
 * 7 jours. Rien n'apparaît sans accès (sauf pour le directeur).
 */

type Statut = "a_confirmer" | "demande" | "accepte" | "verse" | "refuse" | "annule" | "expire";
type Retrait = { id: string; montant: number; statut: Statut; cree_le: string; confirme_le: string | null; decide_le: string | null; note: string | null; versable_le: string | null; verse_le: string | null };
type Mouvement = { kind: string; montant: number; solde_apres: number | null; at: string; details: { montant?: number; motif?: string; reforme?: number } };
type Compte =
  | { acces: false; directeur: boolean }
  | { acces: true; directeur: boolean; solde: number; epargne: number; plafond: number; utilise_7j: number; retirable: number; retraits: Retrait[]; mouvements: Mouvement[] };

const z = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} z`;
const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUT: Record<Statut, { label: string; className: string }> = {
  a_confirmer: { label: "À confirmer", className: "text-yellow-300" },
  demande: { label: "Chez le directeur", className: "text-yellow-300" },
  accepte: { label: "Accepté, en attente 48 h", className: "text-blue-light" },
  verse: { label: "Versé sur l'épargne", className: "text-green-300" },
  refuse: { label: "Refusé", className: "text-red-light" },
  annule: { label: "Annulé", className: "text-paper/60" },
  expire: { label: "Expiré", className: "text-paper/60" },
};

const MOUVEMENT: Record<string, string> = {
  acces_donne: "Accès ouvert",
  depot: "Dépôt depuis l'épargne",
  retrait_mis_de_cote: "Retrait demandé (mis de côté)",
  retrait_rendu: "Retrait rendu au solde",
  retrait_verse: "Retrait versé sur l'épargne",
  acces_retire_detruit: "Accès retiré : solde détruit",
  acces_retire_renvoye: "Accès retiré : solde renvoyé sur l'épargne",
  reforme: "Réforme monétaire",
  plafond: "Plafond modifié",
};

const ETAPES = [
  "Tu demandes un montant.",
  "Tu le confirmes en le retapant (dans les 15 minutes). La somme est alors mise de côté.",
  "Le directeur accepte ou refuse.",
  "48 heures d'attente : le directeur peut encore bloquer.",
  "L'argent arrive sur ton épargne.",
];

export function BanqueIsolee({ onChanged }: { onChanged?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [c, setC] = useState<Compte | null>(null);
  const [depot, setDepot] = useState("");
  const [retrait, setRetrait] = useState("");
  const [attente, setAttente] = useState<{ id: string; montant: number } | null>(null);
  const [retape, setRetape] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc("banque_isolee_mon_compte");
    if (!error && data) setC(data as Compte);
  }, [supabase]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function agir<T>(fn: () => PromiseLike<{ data: T; error: { message: string } | null }>, ok: string | ((d: T) => string)) {
    setBusy(true);
    setMsg(null);
    const { data, error } = await fn();
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return null;
    }
    setMsg({ ok: true, text: typeof ok === "string" ? ok : ok(data) });
    await charger();
    onChanged?.();
    return { data };
  }

  if (!c) return null;
  if (!c.acces) {
    if (!c.directeur) return null;
    return (
      <Link href="/dashboard/admin/banque-isolee" id="banque-isolee" className="glass-card flex items-center justify-between gap-3 p-4 transition hover:-translate-y-0.5">
        <span className="flex items-center gap-3">
          <SidIcon name="padlock" size={26} />
          <span>
            <span className="block font-display uppercase">Banque isolée</span>
            <span className="block font-body text-sm text-paper/75">Tu la diriges : accès, plafonds et retraits.</span>
          </span>
        </span>
        <span className="font-mono text-xs uppercase text-blue">Diriger</span>
      </Link>
    );
  }

  const enCours = c.retraits.filter((r) => ["a_confirmer", "demande", "accepte"].includes(r.statut));
  const passes = c.retraits.filter((r) => !["a_confirmer", "demande", "accepte"].includes(r.statut)).slice(0, 8);
  const montantRetrait = Number(retrait.replace(",", "."));

  return (
    <section id="banque-isolee" className="glass-card scroll-mt-24 space-y-5 border border-white/15 p-6" aria-labelledby="banque-isolee-titre">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="banque-isolee-titre" className="font-display text-lg uppercase">
          <SidIcon name="padlock" /> Banque isolée
        </h2>
        {c.directeur && (
          <Link href="/dashboard/admin/banque-isolee" className="font-mono text-xs uppercase text-blue hover:underline">
            Diriger
          </Link>
        )}
      </div>
      <p className="font-body text-sm text-paper/80">
        Hors de l&apos;économie du S.I.D. : cet argent ne rapporte pas d&apos;intérêts, n&apos;est ni taxé ni saisi, et ne bouge pas avec le marché. Il vient de
        ton épargne et y retourne seulement après plusieurs vérifications.
      </p>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-xs uppercase text-paper/70">Solde</dt>
          <dd className="font-display text-3xl text-blue-light">{z(c.solde)}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase text-paper/70">Retirable cette semaine</dt>
          <dd className="font-display text-xl">{z(c.retirable)}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase text-paper/70">Plafond sur 7 jours</dt>
          <dd className="font-body text-sm text-paper/85">
            {z(c.utilise_7j)} engagés sur {z(c.plafond)}
          </dd>
        </div>
      </dl>

      {msg && (
        <p role="status" className={`font-mono text-sm ${msg.ok ? "text-green-300" : "text-red-light"}`}>
          {msg.text}
        </p>
      )}

      <form
        className="flex flex-wrap gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const m = Number(depot.replace(",", "."));
          if (await agir(() => supabase.rpc("banque_isolee_deposer", { p_montant: m }), `${z(m)} mis à l'abri.`)) setDepot("");
        }}
      >
        <label className="min-w-[12rem] flex-1 space-y-1">
          <span className={labelClass}>Déposer depuis l&apos;épargne ({z(c.epargne)} disponibles)</span>
          <input type="number" min={0} step="0.01" inputMode="decimal" className={inputClass} value={depot} onChange={(e) => setDepot(e.target.value)} />
        </label>
        <button type="submit" disabled={busy || !(Number(depot.replace(",", ".")) > 0)} className="self-end rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
          Déposer
        </button>
      </form>

      {!attente ? (
        <form
          className="flex flex-wrap gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const d = await agir(
              () => supabase.rpc("banque_isolee_retrait_demander", { p_montant: montantRetrait }),
              "Confirme maintenant en retapant le montant.",
            );
            if (d) {
              const x = d.data as { id: string; montant: number };
              setAttente({ id: x.id, montant: Number(x.montant) });
              setRetape("");
            }
          }}
        >
          <label className="min-w-[12rem] flex-1 space-y-1">
            <span className={labelClass}>Demander un retrait vers l&apos;épargne</span>
            <input type="number" min={0} step="0.01" inputMode="decimal" className={inputClass} value={retrait} onChange={(e) => setRetrait(e.target.value)} />
          </label>
          <button type="submit" disabled={busy || !(montantRetrait > 0)} className="self-end rounded-lg border border-blue px-4 py-2 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40">
            Demander
          </button>
        </form>
      ) : (
        <form
          className="space-y-3 rounded-xl border border-yellow-400/50 bg-yellow-400/5 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await agir(
              () => supabase.rpc("banque_isolee_retrait_confirmer", { p_id: attente.id, p_montant_retape: Number(retape.replace(",", ".")) }),
              "Demande confirmée : la somme est mise de côté et le directeur est prévenu.",
            );
            if (ok) {
              setAttente(null);
              setRetrait("");
            }
          }}
        >
          <p className="font-body text-sm">
            Tu demandes <strong>{z(attente.montant)}</strong>. Pour confirmer, retape le montant (valable 15 minutes).
          </p>
          <label className="block max-w-xs space-y-1">
            <span className={labelClass}>Montant retapé</span>
            <input type="number" min={0} step="0.01" inputMode="decimal" autoComplete="off" className={inputClass} value={retape} onChange={(e) => setRetape(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !retape} className="rounded-lg bg-yellow-300 px-4 py-2 font-mono text-xs uppercase text-ink hover:brightness-110 disabled:opacity-40">
              Confirmer la demande
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await agir(() => supabase.rpc("banque_isolee_retrait_annuler", { p_id: attente.id }), "Demande abandonnée.");
                setAttente(null);
              }}
              className="rounded-lg px-3 py-2 font-mono text-xs uppercase text-paper/75 hover:text-paper"
            >
              Abandonner
            </button>
          </div>
        </form>
      )}

      <details className="font-body text-sm text-paper/80">
        <summary className="cursor-pointer font-mono text-xs uppercase text-paper/75">Comment se passe un retrait</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {ETAPES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </details>

      {enCours.filter((r) => r.statut !== "a_confirmer").length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-paper/75">Retraits en cours</h3>
          <ul className="space-y-2">
            {enCours
              .filter((r) => r.statut !== "a_confirmer")
              .map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <span className="font-body text-sm">
                    <strong>{z(r.montant)}</strong> <span className={STATUT[r.statut].className}>· {STATUT[r.statut].label}</span>
                    {r.statut === "accepte" && r.versable_le && <span className="text-paper/75"> · versé vers le {quand(r.versable_le)}</span>}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => agir(() => supabase.rpc("banque_isolee_retrait_annuler", { p_id: r.id }), "Retrait annulé : la somme revient dans ton solde.")}
                    className="font-mono text-xs uppercase text-paper/75 hover:text-red-light"
                  >
                    Annuler
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {(passes.length > 0 || c.mouvements.length > 0) && (
        <details>
          <summary className="cursor-pointer font-mono text-xs uppercase text-paper/75">Historique</summary>
          <ul className="mt-2 divide-y divide-white/10">
            {passes.map((r) => (
              <li key={r.id} className="py-1.5 font-body text-sm">
                Retrait de {z(r.montant)} · <span className={STATUT[r.statut].className}>{STATUT[r.statut].label}</span>
                <span className="font-mono text-[11px] text-paper/70"> · {quand(r.verse_le ?? r.decide_le ?? r.cree_le)}</span>
                {r.note && <span className="block text-paper/75">« {r.note} »</span>}
              </li>
            ))}
            {c.mouvements
              .filter((m) => !m.kind.startsWith("retrait"))
              .map((m, i) => (
                <li key={`${m.at}-${i}`} className="py-1.5 font-body text-sm">
                  {MOUVEMENT[m.kind] ?? m.kind}
                  {m.montant !== 0 && ` · ${m.montant > 0 ? "+" : "−"}${z(Math.abs(m.montant))}`}
                  {m.kind === "reforme" && m.details.reforme && ` (n° ${m.details.reforme})`}
                  <span className="font-mono text-[11px] text-paper/70"> · {quand(m.at)}</span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}
