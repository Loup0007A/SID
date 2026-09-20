"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Wallet, BankAccount } from "@/types/database";
import type { Business, BusinessSharePricePoint, MyShareholding } from "@/types/business";
import { inputClass, labelClass } from "@/lib/ui";

export default function BankPage() {
  const supabase = createClient();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");

  // Bourse
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [myShares, setMyShares] = useState<MyShareholding[]>([]);
  const [openChartId, setOpenChartId] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<BusinessSharePricePoint[]>([]);
  const [tradeQty, setTradeQty] = useState<Record<string, string>>({});

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: w } = await supabase.from("wallets").select("*").eq("user_id", user.id).single();
    setWallet(w);

    const { data: b } = await supabase.from("bank_accounts").select("*").eq("user_id", user.id).maybeSingle();
    setBankAccount(b);

    const { data: biz } = await supabase.rpc("list_businesses");
    setBusinesses((biz ?? []) as Business[]);

    const { data: shares } = await supabase.rpc("get_my_shareholdings");
    setMyShares((shares ?? []) as MyShareholding[]);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `action` accepte le type "thenable" renvoyé par `supabase.rpc(...)`
  // (PromiseLike), pas une vraie `Promise` : ce n'est reconnu comme telle
  // qu'une fois `await`/`.then()` appliqué, donc `.catch()`/`Promise<...>`
  // strict échouent à la compilation même si `await` fonctionne très bien
  // à l'exécution.
  async function run(
    action: () => PromiseLike<{ error: { message: string } | null }>,
    successMsg: string,
    clear: () => void
  ) {
    setBusy(true);
    setMessage(null);
    const { error } = await action();
    setBusy(false);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage(successMsg);
    clear();
    await refresh();
  }

  const isInDebt = (wallet?.balance ?? 0) < 0;

  async function toggleChart(businessId: string) {
    if (openChartId === businessId) {
      setOpenChartId(null);
      return;
    }
    setOpenChartId(businessId);
    const { data } = await supabase.rpc("get_business_price_history", { p_business_id: businessId });
    setPriceHistory((data ?? []) as BusinessSharePricePoint[]);
  }

  function myHolding(businessId: string) {
    return myShares.find((s) => s.business_id === businessId)?.quantity ?? 0;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Banque de la S.I.D.</h1>

      <div className="glass-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-xs uppercase text-paper/60">Portefeuille</p>
          <p className={`font-display text-3xl ${isInDebt ? "text-red" : "text-blue"}`}>
            {(wallet?.balance ?? 0).toLocaleString("fr-FR")} Cr.
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase text-paper/60">Épargne en banque</p>
          <p className="font-display text-3xl text-blue-light">{(bankAccount?.balance ?? 0).toLocaleString("fr-FR")} Cr.</p>
        </div>
        {(wallet?.debt_principal ?? 0) > 0 && (
          <div className="sm:col-span-2">
            <p className="font-mono text-xs uppercase text-paper/60">Emprunt en cours</p>
            <p className="font-display text-xl text-red">{wallet!.debt_principal.toLocaleString("fr-FR")} Cr.</p>
          </div>
        )}
      </div>

      {isInDebt && (
        <p className="glass-card border border-red/50 p-4 font-body text-sm text-red">
          ⚠️ Ton solde est négatif — les intérêts d&apos;emprunt impayés t&apos;empêchent d&apos;acheter quoi que ce
          soit en boutique tant qu&apos;il n&apos;est pas remonté à 0 ou plus. Rembourse ton emprunt ou attends tes
          prochains revenus (salaire, quêtes…) pour te refaire.
        </p>
      )}

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      <div className="glass-card space-y-4 p-6">
        <h2 className="font-display text-lg uppercase">Épargne</h2>
        <p className="font-body text-sm text-paper/70">
          L&apos;argent déposé rapporte des intérêts chaque jour, tant que tu ne redéposes pas (un nouveau dépôt
          relance le décompte).
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 space-y-1">
            <label className={labelClass}>Déposer</label>
            <input type="number" min={0} className={inputClass} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
          </div>
          <button
            onClick={() =>
              run(
                () => supabase.rpc("deposit_to_bank", { p_amount: Number(depositAmount) || 0 }),
                "Dépôt effectué.",
                () => setDepositAmount("")
              )
            }
            disabled={busy || !depositAmount}
            className="self-end rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            Déposer
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 space-y-1">
            <label className={labelClass}>Retirer</label>
            <input type="number" min={0} className={inputClass} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
          </div>
          <button
            onClick={() =>
              run(
                () => supabase.rpc("withdraw_from_bank", { p_amount: Number(withdrawAmount) || 0 }),
                "Retrait effectué.",
                () => setWithdrawAmount("")
              )
            }
            disabled={busy || !withdrawAmount}
            className="self-end rounded-lg border border-blue px-4 py-2 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40"
          >
            Retirer
          </button>
        </div>
      </div>

      <div className="glass-card space-y-4 p-6">
        <h2 className="font-display text-lg uppercase">Emprunt</h2>
        <p className="font-body text-sm text-paper/70">
          Emprunter crédite immédiatement ton portefeuille. Des intérêts sont ensuite prélevés chaque jour sur le
          montant emprunté — s&apos;ils font passer ton solde en négatif, tu ne pourras plus acheter en boutique
          jusqu&apos;à ce qu&apos;il remonte à 0 ou plus.
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 space-y-1">
            <label className={labelClass}>Emprunter</label>
            <input type="number" min={0} className={inputClass} value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} />
          </div>
          <button
            onClick={() =>
              run(
                () => supabase.rpc("borrow_money", { p_amount: Number(borrowAmount) || 0 }),
                "Emprunt accordé.",
                () => setBorrowAmount("")
              )
            }
            disabled={busy || !borrowAmount}
            className="self-end rounded-lg bg-red px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-red-light disabled:opacity-40"
          >
            Emprunter
          </button>
        </div>
        {(wallet?.debt_principal ?? 0) > 0 && (
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 space-y-1">
              <label className={labelClass}>Rembourser</label>
              <input type="number" min={0} className={inputClass} value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} />
            </div>
            <button
              onClick={() =>
                run(
                  () => supabase.rpc("repay_loan", { p_amount: Number(repayAmount) || 0 }),
                  "Remboursement effectué.",
                  () => setRepayAmount("")
                )
              }
              disabled={busy || !repayAmount}
              className="self-end rounded-lg border border-red px-4 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
            >
              Rembourser
            </button>
          </div>
        )}
      </div>

      <div className="glass-card space-y-4 p-6">
        <h2 className="font-display text-lg uppercase">Bourse</h2>
        <p className="font-body text-sm text-paper/70">
          Achète/vends des actions d&apos;entreprise directement contre leur trésorerie : chaque échange fait
          légèrement bouger le cours. La "valeur estimée" est le cours actuel × le nombre total d&apos;actions.
        </p>

        {myShares.length > 0 && (
          <div className="space-y-1 rounded-lg border border-white/10 p-3">
            <p className="font-mono text-xs uppercase text-paper/60">Mes actions</p>
            {myShares.map((s) => (
              <p key={s.business_id} className="font-body text-sm">
                {s.business_name} : {s.quantity} action(s) — ≈{" "}
                {(s.quantity * s.share_price).toLocaleString("fr-FR")} Cr.
              </p>
            ))}
          </div>
        )}

        {businesses.length === 0 ? (
          <p className="font-body text-sm text-paper/60">Aucune entreprise cotée pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {businesses.map((b) => {
              const marketCap = b.share_price * b.share_count;
              const held = myHolding(b.id);
              const qty = tradeQty[b.id] ?? "";
              return (
                <div key={b.id} className="rounded-lg border border-white/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-display uppercase text-blue-light">{b.name}</p>
                      {b.description && <p className="font-body text-xs text-paper/60">{b.description}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-blue">{b.share_price.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Cr./action</p>
                      <p className="font-mono text-[10px] text-paper/50">Valeur estimée : {marketCap.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} Cr.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleChart(b.id)}
                    className="mt-2 font-mono text-[10px] uppercase text-blue-light underline"
                  >
                    {openChartId === b.id ? "Masquer le graphique" : "📈 Voir le graphique du cours"}
                  </button>

                  {openChartId === b.id && (
                    <div className="mt-2">
                      {priceHistory.length < 2 ? (
                        <p className="font-body text-xs text-paper/50">Pas encore assez d&apos;historique.</p>
                      ) : (
                        <div className="flex h-20 items-end gap-0.5">
                          {priceHistory.map((p, i) => {
                            const max = Math.max(...priceHistory.map((x) => x.price));
                            const min = Math.min(...priceHistory.map((x) => x.price));
                            const range = Math.max(0.01, max - min);
                            return (
                              <div
                                key={p.id}
                                className="flex-1 bg-blue"
                                style={{ height: `${((p.price - min) / range) * 100}%`, minHeight: 2 }}
                                title={`${p.price.toLocaleString("fr-FR")} Cr. — ${new Date(p.recorded_at).toLocaleString("fr-FR")}`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-2 font-mono text-[10px] text-paper/50">
                    {b.shares_in_treasury} action(s) disponible(s) à l&apos;achat sur {b.share_count}
                    {held > 0 && ` · tu en détiens ${held}`}
                  </p>

                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <label className={labelClass}>Quantité</label>
                      <input
                        type="number" min={1} className={`${inputClass} w-24`}
                        value={qty}
                        onChange={(e) => setTradeQty((t) => ({ ...t, [b.id]: e.target.value }))}
                      />
                    </div>
                    <button
                      onClick={() =>
                        run(
                          () => supabase.rpc("buy_business_shares", { p_business_id: b.id, p_quantity: Number(qty) || 0 }),
                          "Actions achetées.",
                          () => setTradeQty((t) => ({ ...t, [b.id]: "" }))
                        )
                      }
                      disabled={busy || !qty}
                      className="rounded-lg bg-blue px-3 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
                    >
                      Acheter
                    </button>
                    {held > 0 && (
                      <button
                        onClick={() =>
                          run(
                            () => supabase.rpc("sell_business_shares", { p_business_id: b.id, p_quantity: Number(qty) || 0 }),
                            "Actions vendues.",
                            () => setTradeQty((t) => ({ ...t, [b.id]: "" }))
                          )
                        }
                        disabled={busy || !qty}
                        className="rounded-lg border border-red px-3 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
                      >
                        Vendre
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
