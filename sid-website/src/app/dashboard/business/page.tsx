"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/types/business";
import { inputClass, labelClass } from "@/lib/ui";

export default function BusinessPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [myBusinesses, setMyBusinesses] = useState<Business[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({ name: "", description: "", shareCount: "1000", initialPrice: "10" });
  const [amounts, setAmounts] = useState<Record<string, { deposit: string; withdraw: string; borrow: string; repay: string }>>({});

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase.rpc("list_businesses");
    setMyBusinesses(((data ?? []) as Business[]).filter((b) => b.founder_id === user.id));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function amountFor(businessId: string) {
    return amounts[businessId] ?? { deposit: "", withdraw: "", borrow: "", repay: "" };
  }

  function setAmount(businessId: string, field: "deposit" | "withdraw" | "borrow" | "repay", value: string) {
    setAmounts((a) => ({ ...a, [businessId]: { ...amountFor(businessId), [field]: value } }));
  }

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, successMsg: string, clear?: () => void) {
    setBusy(true);
    setMessage(null);
    const { error } = await action();
    setBusy(false);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage(successMsg);
    clear?.();
    await refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await run(
      () =>
        supabase.rpc("create_business", {
          p_name: form.name,
          p_description: form.description || null,
          p_share_count: Number(form.shareCount) || 1000,
          p_initial_price: Number(form.initialPrice) || 10,
        }),
      "Entreprise créée !",
      () => {
        setForm({ name: "", description: "", shareCount: "1000", initialPrice: "10" });
        setShowCreate(false);
      }
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Entreprise</h1>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light"
        >
          {showCreate ? "Annuler" : "Créer une entreprise"}
        </button>
      </div>

      <p className="font-body text-sm text-paper/70">
        Pour investir dans une entreprise (acheter/vendre des actions), rends-toi sur la page{" "}
        <a href="/dashboard/bank" className="text-blue underline">Banque</a> → section Bourse. Cette page-ci sert à
        gérer la trésorerie et les prêts de tes propres entreprises.
      </p>

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      {showCreate && (
        <form onSubmit={handleCreate} className="glass-card space-y-4 p-6">
          <div className="space-y-1">
            <label className={labelClass}>Nom de l&apos;entreprise</label>
            <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Description</label>
            <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className={labelClass}>Nombre d&apos;actions émises</label>
              <input type="number" min={1} className={inputClass} value={form.shareCount} onChange={(e) => setForm({ ...form, shareCount: e.target.value })} />
            </div>
            <div className="flex-1 space-y-1">
              <label className={labelClass}>Prix de départ par action</label>
              <input type="number" min={0.01} step="0.01" className={inputClass} value={form.initialPrice} onChange={(e) => setForm({ ...form, initialPrice: e.target.value })} />
            </div>
          </div>
          <button disabled={busy} className="rounded-lg w-full bg-blue py-2 font-display uppercase text-ink hover:bg-blue-light disabled:opacity-40">
            Créer
          </button>
        </form>
      )}

      {myBusinesses.length === 0 ? (
        <p className="glass-card p-6 text-center font-body text-paper/60">
          Tu n&apos;as encore créé aucune entreprise.
        </p>
      ) : (
        <div className="space-y-4">
          {myBusinesses.map((b) => {
            const amt = amountFor(b.id);
            return (
              <div key={b.id} className="glass-card space-y-4 p-6">
                <div>
                  <h2 className="font-display text-lg uppercase text-blue-light">{b.name}</h2>
                  {b.description && <p className="font-body text-sm text-paper/70">{b.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-paper/50">Trésorerie</p>
                    <p className="font-display text-xl text-blue">{b.treasury_balance.toLocaleString("fr-FR")} Cr.</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-paper/50">Cours de l&apos;action</p>
                    <p className="font-display text-xl text-blue-light">{b.share_price.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Cr.</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-paper/50">Valeur estimée</p>
                    <p className="font-display text-xl text-paper">{(b.share_price * b.share_count).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} Cr.</p>
                  </div>
                  {b.debt_principal > 0 && (
                    <div>
                      <p className="font-mono text-[10px] uppercase text-paper/50">Dette</p>
                      <p className="font-display text-xl text-red">{b.debt_principal.toLocaleString("fr-FR")} Cr.</p>
                    </div>
                  )}
                  <div>
                    <p className="font-mono text-[10px] uppercase text-paper/50">Actions détenues par le public</p>
                    <p className="font-display text-xl text-paper">{b.share_count - b.shares_in_treasury} / {b.share_count}</p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="mb-2 font-mono text-xs uppercase text-paper/60">Fonds propres</p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="number" min={0} placeholder="Montant"
                      className={`${inputClass} w-32`}
                      value={amt.deposit}
                      onChange={(e) => setAmount(b.id, "deposit", e.target.value)}
                    />
                    <button
                      onClick={() =>
                        run(
                          () => supabase.rpc("deposit_business_funds", { p_business_id: b.id, p_amount: Number(amt.deposit) || 0 }),
                          "Apport effectué.",
                          () => setAmount(b.id, "deposit", "")
                        )
                      }
                      disabled={busy || !amt.deposit}
                      className="rounded-lg bg-blue px-3 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
                    >
                      Apporter (depuis mon portefeuille)
                    </button>
                    <input
                      type="number" min={0} placeholder="Montant"
                      className={`${inputClass} w-32`}
                      value={amt.withdraw}
                      onChange={(e) => setAmount(b.id, "withdraw", e.target.value)}
                    />
                    <button
                      onClick={() =>
                        run(
                          () => supabase.rpc("withdraw_business_funds", { p_business_id: b.id, p_amount: Number(amt.withdraw) || 0 }),
                          "Retrait effectué.",
                          () => setAmount(b.id, "withdraw", "")
                        )
                      }
                      disabled={busy || !amt.withdraw}
                      className="rounded-lg border border-blue px-3 py-2 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40"
                    >
                      Retirer (vers mon portefeuille)
                    </button>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="mb-2 font-mono text-xs uppercase text-paper/60">Emprunt d&apos;entreprise</p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="number" min={0} placeholder="Montant"
                      className={`${inputClass} w-32`}
                      value={amt.borrow}
                      onChange={(e) => setAmount(b.id, "borrow", e.target.value)}
                    />
                    <button
                      onClick={() =>
                        run(
                          () => supabase.rpc("business_borrow", { p_business_id: b.id, p_amount: Number(amt.borrow) || 0 }),
                          "Emprunt accordé.",
                          () => setAmount(b.id, "borrow", "")
                        )
                      }
                      disabled={busy || !amt.borrow}
                      className="rounded-lg bg-red px-3 py-2 font-mono text-xs uppercase text-ink hover:bg-red-light disabled:opacity-40"
                    >
                      Emprunter
                    </button>
                    {b.debt_principal > 0 && (
                      <>
                        <input
                          type="number" min={0} placeholder="Montant"
                          className={`${inputClass} w-32`}
                          value={amt.repay}
                          onChange={(e) => setAmount(b.id, "repay", e.target.value)}
                        />
                        <button
                          onClick={() =>
                            run(
                              () => supabase.rpc("business_repay", { p_business_id: b.id, p_amount: Number(amt.repay) || 0 }),
                              "Remboursement effectué.",
                              () => setAmount(b.id, "repay", "")
                            )
                          }
                          disabled={busy || !amt.repay}
                          className="rounded-lg border border-red px-3 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
                        >
                          Rembourser
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
