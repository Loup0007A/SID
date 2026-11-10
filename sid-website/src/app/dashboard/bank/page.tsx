"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/session";
import type { Wallet, BankAccount } from "@/types/database";
import Link from "next/link";
import type { MyShareholding } from "@/types/business";
import { WalletHistory } from "@/components/bank/WalletHistory";
import { Taxes } from "@/components/bank/Taxes";
import { pct, px, z } from "@/lib/econ";
import { MyWithdrawals } from "@/components/bank/Withdrawals";
import { inputClass, labelClass } from "@/lib/ui";
import { SidIcon } from "@/components/icons/SidIcon";
import { Absences } from "@/components/bank/Absences";

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
  const [withdrawVersion, setWithdrawVersion] = useState(0);

  const [myShares, setMyShares] = useState<MyShareholding[]>([]);
  const [rates, setRates] = useState<{ savings: number | null; loan: number | null } | null>(null);

  async function refresh() {
    const {
      data: { user },
    } = await currentUser();
    if (!user) return;

    // Tout part en même temps (un seul aller-retour).
    const [{ data: w }, { data: b }, { data: shares }, { data: eco }] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).single(),
      supabase.from("bank_accounts").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("get_my_shareholdings"),
      supabase.from("economy_daily").select("savings_rate_daily, loan_rate_daily").order("day", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setWallet(w);
    setBankAccount(b);
    setMyShares((shares ?? []) as MyShareholding[]);
    if (eco) setRates({ savings: eco.savings_rate_daily, loan: eco.loan_rate_daily });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `action` accepte le type "thenable" renvoyé par `supabase.rpc(...)`
  // (PromiseLike), pas une vraie `Promise`.
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
  const portfolioValue = myShares.reduce((sum, s) => sum + s.quantity * s.share_price, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Banque du S.I.D.</h1>


      <div className="glass-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-xs uppercase text-paper/60">Portefeuille</p>
          <p className={`font-display text-3xl ${isInDebt ? "text-red" : "text-blue"}`}>
            {(wallet?.balance ?? 0).toLocaleString("fr-FR")} z
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase text-paper/60">Épargne en banque</p>
          <p className="font-display text-3xl text-blue-light">{(bankAccount?.balance ?? 0).toLocaleString("fr-FR")} z</p>
        </div>
        {(wallet?.debt_principal ?? 0) > 0 && (
          <div className="sm:col-span-2">
            <p className="font-mono text-xs uppercase text-paper/60">Emprunt en cours</p>
            <p className="font-display text-xl text-red">{wallet!.debt_principal.toLocaleString("fr-FR")} z</p>
          </div>
        )}
      </div>

      {isInDebt && (
        <p className="glass-card border border-red/50 p-4 font-body text-sm text-red">
          <SidIcon name="warning" /> Ton solde est négatif — les intérêts d&apos;emprunt impayés t&apos;empêchent d&apos;acheter quoi que ce
          soit en boutique tant qu&apos;il n&apos;est pas remonté à 0 ou plus. Rembourse ton emprunt ou attends tes
          prochains revenus (salaire, quêtes…) pour te refaire.
        </p>
      )}

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      <Absences />

      {wallet && <WalletHistory userId={wallet.user_id} balance={Number(wallet.balance)} />}

      <div data-tuto="banque-epargne" className="glass-card space-y-4 p-6">
        <h2 className="font-display text-lg uppercase">Épargne</h2>
        <p className="font-body text-sm text-paper/70">
          L&apos;argent déposé rapporte des intérêts chaque jour, tant que tu ne redéposes pas (un nouveau dépôt
          relance le décompte). Un retrait doit être validé par un admin : la somme est mise de côté en attendant.
        </p>
        {rates?.savings != null && (
          <p className="font-mono text-xs text-blue-light">
            Taux du jour : {pct(rates.savings, 3)} par jour, fixé par la <Link href="/dashboard/economie" className="underline">banque centrale</Link>.
          </p>
        )}
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
            <label className={labelClass}>Demander un retrait</label>
            <input type="number" min={0} className={inputClass} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
          </div>
          <button
            onClick={() =>
              run(
                () => supabase.rpc("withdraw_from_bank", { p_amount: Number(withdrawAmount) || 0 }),
                "Demande envoyée : l'argent arrivera dans ton portefeuille quand un admin l'aura validée.",
                () => {
                  setWithdrawAmount("");
                  setWithdrawVersion((v) => v + 1);
                }
              )
            }
            disabled={busy || !withdrawAmount}
            className="self-end rounded-lg border border-blue px-4 py-2 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40"
          >
            Demander
          </button>
        </div>
        <MyWithdrawals kind="bank" version={withdrawVersion} onChanged={refresh} />
      </div>

      <div data-tuto="banque-emprunt" className="glass-card space-y-4 p-6">
        <h2 className="font-display text-lg uppercase">Emprunt</h2>
        <p className="font-body text-sm text-paper/70">
          Emprunter crédite immédiatement ton portefeuille. Des intérêts sont ensuite prélevés chaque jour sur le
          montant emprunté — s&apos;ils font passer ton solde en négatif, tu ne pourras plus acheter en boutique
          jusqu&apos;à ce qu&apos;il remonte à 0 ou plus.
        </p>
        {rates?.loan != null && <p className="font-mono text-xs text-red-light">Taux du jour : {pct(rates.loan, 3)} par jour.</p>}
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

      <div id="impots" data-tuto="banque-impots" className="glass-card scroll-mt-24 space-y-4 p-6">
        <h2 className="font-display text-lg uppercase">Impôts et amendes</h2>
        <Taxes savings={Number(bankAccount?.balance ?? 0)} onPaid={refresh} />
      </div>

      <div data-tuto="banque-bourse" className="glass-card space-y-3 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg uppercase">Mes actions</h2>
          <Link href="/dashboard/bourse" className="font-mono text-xs uppercase text-blue hover:underline">
            Ouvrir la bourse →
          </Link>
        </div>
        {myShares.length === 0 ? (
          <p className="font-body text-sm text-paper/60">Aucune action. Les entreprises du S.I.D. se négocient à la bourse, par ordres d&apos;achat et de vente.</p>
        ) : (
          <>
            <p className="font-mono text-xs uppercase text-paper/60">Valeur au dernier cours ≈ {z(portfolioValue, 0)}</p>
            <ul className="space-y-1">
              {myShares.map((s) => (
                <li key={s.business_id}>
                  <Link href={`/dashboard/bourse?valeur=${s.business_id}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 font-body text-sm hover:bg-white/10">
                    <span className="font-display uppercase text-blue-light">{s.business_name}</span>
                    <span className="font-mono text-xs text-paper/80">
                      {s.quantity} × {px(s.share_price)} z = {z(s.quantity * s.share_price, 0)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
