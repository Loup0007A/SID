"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { when, z } from "@/lib/econ";
import type { ExpenseRequest } from "@/types/economy";

/**
 * Frais d'entreprise (Lot 69, migration 0086) : achats de la boutique payés
 * par la trésorerie après validation d'un admin.
 */

export const EXPENSE_STATUS: Record<ExpenseRequest["status"], { label: string; className: string }> = {
  pending: { label: "En attente", className: "border-yellow-400/70 text-yellow-300" },
  approved: { label: "Validée", className: "border-green-400/60 text-green-300" },
  rejected: { label: "Refusée", className: "border-red/70 text-red-light" },
  cancelled: { label: "Annulée", className: "border-white/25 text-paper/60" },
};

export function ExpenseLine({ e, showBusiness, action }: { e: ExpenseRequest; showBusiness?: boolean; action?: React.ReactNode }) {
  const st = EXPENSE_STATUS[e.status];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/5 px-3 py-2 font-body text-sm">
      <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${st.className}`}>{st.label}</span>
      <span className="text-paper">
        {e.item_name}
        {e.quantity > 1 && ` × ${e.quantity}`}
      </span>
      <span className="font-mono text-xs text-paper/80">{z(e.paid ?? e.reserved)}</span>
      {showBusiness && <span className="text-xs text-paper/60">pour {e.business_name}</span>}
      {!showBusiness && e.requester && <span className="text-xs text-paper/60">demandé par {e.requester}</span>}
      <span className="text-xs text-paper/50">{when(e.created_at)}</span>
      <span className="w-full text-xs text-paper/65">« {e.motive} »{e.note && <span className="text-paper/50"> · réponse : {e.note}</span>}</span>
      {action && <span className="ml-auto">{action}</span>}
    </li>
  );
}

/** Demandes d'une entreprise (fondateur) ou les miennes (`businessId` absent). */
export function Expenses({ businessId, version = 0, onChanged }: { businessId?: string; version?: number; onChanged?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ExpenseRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("expenses_list", businessId ? { p_scope: "business", p_business: businessId } : { p_scope: "mine" });
    setRows(error ? [] : ((data ?? []) as ExpenseRequest[]));
  }, [supabase, businessId]);

  useEffect(() => {
    load();
  }, [load, version]);

  if (!rows) return null;
  if (rows.length === 0) {
    return businessId ? (
      <p className="font-body text-xs text-paper/60">
        Aucune demande. Depuis la <Link href="/dashboard/shop" className="text-blue underline">boutique</Link>, la fiche d&apos;un objet propose « Faire payer
        par l&apos;entreprise » au fondateur et aux employés.
      </p>
    ) : null;
  }
  return (
    <ul className="space-y-1.5">
      {rows.slice(0, 8).map((e) => (
        <ExpenseLine
          key={e.id}
          e={e}
          showBusiness={!businessId}
          action={
            e.status === "pending" && e.self ? (
              <button
                type="button"
                disabled={busy === e.id}
                onClick={async () => {
                  setBusy(e.id);
                  await supabase.rpc("expense_cancel", { p_id: e.id });
                  setBusy(null);
                  await load();
                  onChanged?.();
                }}
                className="font-mono text-[11px] uppercase text-paper/60 hover:text-red-light"
              >
                Annuler
              </button>
            ) : undefined
          }
        />
      ))}
    </ul>
  );
}
