"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Wallet, BankAccount } from "@/types/database";
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

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: w } = await supabase.from("wallets").select("*").eq("user_id", user.id).single();
    setWallet(w);

    const { data: b } = await supabase.from("bank_accounts").select("*").eq("user_id", user.id).maybeSingle();
    setBankAccount(b);
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
    </div>
  );
}
