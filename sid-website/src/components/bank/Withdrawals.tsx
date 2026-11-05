"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Retraits validés par l'administration (Lot 67, migration 0082) : la somme
 * est mise de côté à la demande, versée à la validation, remise à sa place
 * en cas de refus ou d'annulation.
 */

export type Withdrawal = {
  id: string;
  user_id: string;
  nickname: string | null;
  kind: "bank" | "business";
  business_id: string | null;
  business_name: string | null;
  amount: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  note: string | null;
  wallet: number | null;
  self: boolean;
};

export const WITHDRAWAL_STATUS: Record<Withdrawal["status"], { label: string; className: string }> = {
  pending: { label: "En attente", className: "border-yellow-400/70 text-yellow-300" },
  approved: { label: "Validé", className: "border-green-400/60 text-green-300" },
  rejected: { label: "Refusé", className: "border-red/70 text-red-light" },
  cancelled: { label: "Annulé", className: "border-white/25 text-paper/60" },
};

export const z = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} z`;
export const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Mes demandes de retrait (épargne, ou une entreprise). `version` : recharger après une demande. */
export function MyWithdrawals({ kind, businessId, version = 0, onChanged }: { kind: "bank" | "business"; businessId?: string; version?: number; onChanged?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Withdrawal[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("withdrawals_list", { p_scope: "mine" });
    if (error) return setRows([]);
    setRows(((data ?? []) as Withdrawal[]).filter((w) => w.kind === kind && (!businessId || w.business_id === businessId)));
  }, [supabase, kind, businessId]);

  useEffect(() => {
    load();
  }, [load, version]);

  if (!rows || rows.length === 0) return null;
  return (
    <ul className="space-y-1.5" aria-label="Mes demandes de retrait">
      {rows.slice(0, 6).map((w) => {
        const st = WITHDRAWAL_STATUS[w.status];
        return (
          <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/5 px-3 py-2 font-body text-sm">
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${st.className}`}>{st.label}</span>
            <span className="font-display text-base text-paper">{z(w.amount)}</span>
            <span className="text-paper/60">demandé le {when(w.created_at)}</span>
            {w.note && <span className="w-full text-xs text-paper/60">Motif : {w.note}</span>}
            {w.status === "pending" && (
              <button
                type="button"
                disabled={busy === w.id}
                onClick={async () => {
                  setBusy(w.id);
                  await supabase.rpc("withdrawal_cancel", { p_id: w.id });
                  setBusy(null);
                  await load();
                  onChanged?.();
                }}
                className="ml-auto font-mono text-[11px] uppercase text-paper/60 hover:text-red-light"
              >
                Annuler
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** File des retraits à valider (admins « Économie »). */
export function WithdrawalQueue() {
  const supabase = useMemo(() => createClient(), []);
  const [pending, setPending] = useState<Withdrawal[] | null>(null);
  const [recent, setRecent] = useState<Withdrawal[] | null>(null);
  const [showRecent, setShowRecent] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("withdrawals_list", { p_scope: "pending" });
    if (error) {
      setMessage(error.message.includes("withdrawals_list") ? "Disponible après la migration 0082." : error.message);
      setPending([]);
      return;
    }
    setPending((data ?? []) as Withdrawal[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(w: Withdrawal, approve: boolean) {
    setBusy(w.id);
    setMessage(null);
    const { error } = await supabase.rpc("withdrawal_decide", { p_id: w.id, p_approve: approve, p_note: notes[w.id] || null });
    setBusy(null);
    if (error) return setMessage(`Échec : ${error.message}`);
    setMessage(`${w.nickname ?? "Membre"} : retrait de ${z(w.amount)} ${approve ? "validé" : "refusé"}.`);
    await load();
    if (showRecent) loadRecent();
  }

  async function loadRecent() {
    const { data } = await supabase.rpc("withdrawals_list", { p_scope: "recent" });
    setRecent((data ?? []) as Withdrawal[]);
  }

  const total = (pending ?? []).reduce((s, w) => s + Number(w.amount), 0);

  return (
    <section id="retraits" className="scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg uppercase text-paper">Retraits à valider</h2>
        {pending && pending.length > 0 && (
          <p className="font-mono text-xs text-paper/65">
            {pending.length} demande{pending.length > 1 ? "s" : ""} · {z(total)}
          </p>
        )}
      </div>
      {message && <p className="font-mono text-xs text-blue-light">{message}</p>}
      {pending === null ? (
        <p className="font-body text-sm text-paper/60">Chargement…</p>
      ) : pending.length === 0 ? (
        <p className="glass-card p-4 font-body text-sm text-paper/60">Aucun retrait en attente.</p>
      ) : (
        <ul className="space-y-2">
          {pending.map((w) => (
            <li key={w.id} className="glass-card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[12rem] flex-1">
                <p className="font-body">
                  <strong>{w.nickname ?? "Membre supprimé"}</strong>{" "}
                  <span className="text-paper/70">{w.kind === "bank" ? "retire de son épargne" : `retire de la trésorerie de ${w.business_name ?? "son entreprise"}`}</span>
                </p>
                <p className="font-mono text-[11px] text-paper/60">
                  demandé le {when(w.created_at)}
                  {w.wallet != null && ` · portefeuille actuel ${z(w.wallet)}`}
                  {w.self && " · ta propre demande"}
                </p>
              </div>
              <p className="font-display text-2xl text-blue-light">{z(w.amount)}</p>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <input
                  value={notes[w.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value.slice(0, 300) }))}
                  placeholder="Motif (facultatif)"
                  aria-label={`Motif pour la demande de ${w.nickname ?? "ce membre"}`}
                  className="field-dark !w-44 !py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={busy === w.id}
                  onClick={() => decide(w, true)}
                  className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
                >
                  <SidIcon name="check" size={13} /> Valider
                </button>
                <button
                  type="button"
                  disabled={busy === w.id}
                  onClick={() => decide(w, false)}
                  className="rounded-lg border border-red/60 px-3 py-1.5 font-mono text-xs uppercase text-red-light hover:bg-red/10 disabled:opacity-40"
                >
                  Refuser
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => {
          setShowRecent((s) => !s);
          if (!recent) loadRecent();
        }}
        className="font-mono text-[11px] uppercase text-paper/60 hover:text-paper"
      >
        {showRecent ? "Masquer les 30 derniers jours" : "Voir les retraits traités (30 jours)"}
      </button>
      {showRecent && recent && (
        <ul className="space-y-1">
          {recent.length === 0 && <li className="font-body text-sm text-paper/55">Aucun.</li>}
          {recent.map((w) => {
            const st = WITHDRAWAL_STATUS[w.status];
            return (
              <li key={w.id} className="flex flex-wrap items-center gap-x-3 font-body text-sm text-paper/80">
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${st.className}`}>{st.label}</span>
                <span>{w.nickname ?? "—"}</span>
                <span className="font-mono text-xs">{z(w.amount)}</span>
                <span className="text-paper/55">{w.kind === "bank" ? "épargne" : w.business_name ?? "entreprise"}</span>
                <span className="text-xs text-paper/50">
                  {w.decided_at ? when(w.decided_at) : ""}
                  {w.decided_by ? ` par ${w.decided_by}` : ""}
                  {w.note ? ` · ${w.note}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
