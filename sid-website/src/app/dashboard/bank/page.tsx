"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Wallet, BankAccount } from "@/types/database";
import type { BusinessSharePricePoint, MarketEntry, MarketSettings, MyShareholding, SellResult } from "@/types/business";
import { LineChart } from "@/components/LineChart";
import { MaintenanceNotice } from "@/components/MaintenanceNotice";
import { inputClass, labelClass } from "@/lib/ui";

const cr = (n: number, digits = 2) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: digits })} Cr.`;

function valuation(entry: MarketEntry): { label: string; className: string } {
  const ratio = entry.share_price / Math.max(entry.fair_value, 0.0001);
  if (ratio > 1.15) return { label: "Surévaluée", className: "border-red text-red" };
  if (ratio < 0.87) return { label: "Sous-évaluée", className: "border-blue text-blue-light" };
  return { label: "Cours cohérent", className: "border-white/30 text-paper/70" };
}

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
  const [market, setMarket] = useState<MarketEntry[]>([]);
  const [settings, setSettings] = useState<MarketSettings>({
    liquidity_factor: 2,
    fee_rate: 0.002,
    admin_fee_per_share: 0.5,
    min_holding_minutes: 30,
    tick_minutes: 60,
  });
  const [myShares, setMyShares] = useState<MyShareholding[]>([]);
  const [sellable, setSellable] = useState<Record<string, number>>({});
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

    const { data: overview } = await supabase.rpc("list_market_overview");
    setMarket((overview ?? []) as MarketEntry[]);

    const { data: s } = await supabase.rpc("get_market_settings");
    if (s) setSettings(s as MarketSettings);

    const { data: shares } = await supabase.rpc("get_my_shareholdings");
    setMyShares((shares ?? []) as MyShareholding[]);

    if (shares && (shares as MyShareholding[]).length > 0) {
      const pairs = await Promise.all(
        (shares as MyShareholding[]).map(async (s) => {
          const { data: n } = await supabase.rpc("get_my_sellable_shares", { p_business_id: s.business_id });
          return [s.business_id, (n as number) ?? 0] as const;
        })
      );
      setSellable(Object.fromEntries(pairs));
    } else {
      setSellable({});
    }
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
    if (openChartId) await loadHistory(openChartId);
  }

  const isInDebt = (wallet?.balance ?? 0) < 0;

  async function loadHistory(businessId: string) {
    const { data } = await supabase.rpc("get_business_price_history", { p_business_id: businessId });
    setPriceHistory((data ?? []) as BusinessSharePricePoint[]);
  }

  async function toggleChart(businessId: string) {
    if (openChartId === businessId) {
      setOpenChartId(null);
      return;
    }
    setOpenChartId(businessId);
    setPriceHistory([]);
    await loadHistory(businessId);
  }

  function myHolding(businessId: string) {
    return myShares.find((s) => s.business_id === businessId)?.quantity ?? 0;
  }

  // Estimation côté client, même formule que buy/sell_business_shares
  function estimate(entry: MarketEntry, qty: number, side: "buy" | "sell") {
    const impact = Math.min(0.5, (qty / entry.share_count) * settings.liquidity_factor);
    const exec = entry.share_price * (side === "buy" ? 1 + impact / 2 : 1 - impact / 2);
    const total = exec * qty;
    const fee = total * settings.fee_rate;
    const adminFee = side === "buy" ? settings.admin_fee_per_share * qty : 0;
    return { impact, total, fee, adminFee, net: side === "buy" ? total + fee + adminFee : total - fee };
  }

  const portfolioValue = myShares.reduce((sum, s) => sum + s.quantity * s.share_price, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Banque du S.I.D.</h1>

      <MaintenanceNotice sectionKey="bank" />

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
          Le cours évolue toutes les {settings.tick_minutes} min autour de la <strong>valeur intrinsèque</strong> de
          l&apos;entreprise (fonds propres, bénéfices récents, dividendes) — un peu comme un cours qui suit le
          « PIB » de l&apos;entreprise — avec de la volatilité et parfois des actualités qui font sursauter le cours.
          Chaque achat coûte {(settings.fee_rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % de
          frais (caisse commune) + {settings.admin_fee_per_share.toLocaleString("fr-FR")} Cr. par action reversés
          directement à l&apos;administration. Une action achetée doit être détenue au moins{" "}
          <strong>{settings.min_holding_minutes} min</strong> avant de pouvoir être revendue (anti-spéculation) —
          une entreprise peut toujours racheter au moins une action grâce au filet de liquidité de la caisse commune.
        </p>

        {myShares.length > 0 && (
          <div className="space-y-1 rounded-lg border border-white/10 p-3">
            <p className="font-mono text-xs uppercase text-paper/60">
              Mes actions — valeur du portefeuille ≈ {cr(portfolioValue, 0)}
            </p>
            {myShares.map((s) => (
              <p key={s.business_id} className="font-body text-sm">
                {s.business_name} : {s.quantity} action(s) — ≈ {cr(s.quantity * s.share_price)}
              </p>
            ))}
          </div>
        )}

        {market.length === 0 ? (
          <p className="font-body text-sm text-paper/60">Aucune entreprise cotée pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {market.map((b) => {
              const marketCap = b.share_price * b.share_count;
              const held = myHolding(b.id);
              const canSell = sellable[b.id] ?? 0;
              const qtyStr = tradeQty[b.id] ?? "";
              const qty = Math.floor(Number(qtyStr) || 0);
              const buyEst = qty > 0 ? estimate(b, qty, "buy") : null;
              const sellEst = qty > 0 ? estimate(b, qty, "sell") : null;
              const val = valuation(b);
              const up = b.change_24h_pct >= 0;
              return (
                <div key={b.id} className="rounded-lg border border-white/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-display uppercase text-blue-light">{b.name}</p>
                      {b.description && <p className="font-body text-xs text-paper/60">{b.description}</p>}
                      <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${val.className}`}>
                        {val.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-blue">{cr(b.share_price)} / action</p>
                      <p className={`font-mono text-xs ${up ? "text-blue-light" : "text-red"}`}>
                        {up ? "▲" : "▼"} {Math.abs(b.change_24h_pct).toLocaleString("fr-FR")} % (24 h)
                      </p>
                      <p className="font-mono text-[10px] text-paper/50">Capitalisation : {cr(marketCap, 0)}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/10 pt-3 font-mono text-[11px] sm:grid-cols-4">
                    <div>
                      <p className="uppercase text-paper/50">Valeur intrinsèque</p>
                      <p className="text-paper">{cr(b.fair_value)}</p>
                    </div>
                    <div>
                      <p className="uppercase text-paper/50">Bénéfice (7 j)</p>
                      <p className={b.profit_7d >= 0 ? "text-blue-light" : "text-red"}>{cr(b.profit_7d, 0)}</p>
                    </div>
                    <div>
                      <p className="uppercase text-paper/50">Dividendes (30 j)</p>
                      <p className="text-paper">{cr(b.dividends_30d, 0)}</p>
                    </div>
                    <div>
                      <p className="uppercase text-paper/50">Fonds propres</p>
                      <p className={b.equity >= 0 ? "text-paper" : "text-red"}>{cr(b.equity, 0)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleChart(b.id)}
                    className="mt-3 font-mono text-[10px] uppercase text-blue-light underline"
                  >
                    {openChartId === b.id ? "Masquer le graphique" : "📈 Voir le graphique du cours"}
                  </button>

                  {openChartId === b.id && (
                    <div className="mt-2">
                      {priceHistory.length < 2 ? (
                        <p className="font-body text-xs text-paper/50">Pas encore assez d&apos;historique.</p>
                      ) : (
                        <LineChart
                          labels={priceHistory.map((p) =>
                            new Date(p.recorded_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                          )}
                          series={[{ name: "Cours", color: "#8FB3D9", values: priceHistory.map((p) => Number(p.price)) }]}
                          refLine={{ value: b.fair_value, label: `valeur intrinsèque ${b.fair_value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}` }}
                          formatValue={(n) => cr(n)}
                          formatAxis={(n) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                          height={240}
                        />
                      )}
                    </div>
                  )}

                  <p className="mt-2 font-mono text-[10px] text-paper/50">
                    {b.shares_in_treasury} action(s) disponible(s) à l&apos;achat sur {b.share_count}
                    {held > 0 && ` · tu en détiens ${held}`}
                    {held > 0 && canSell < held && ` (dont ${canSell} revendable(s) tout de suite)`}
                  </p>

                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <label className={labelClass}>Quantité</label>
                      <input
                        type="number"
                        min={1}
                        className={`${inputClass} w-24`}
                        value={qtyStr}
                        onChange={(e) => setTradeQty((t) => ({ ...t, [b.id]: e.target.value }))}
                      />
                    </div>
                    <button
                      onClick={() =>
                        run(
                          () => supabase.rpc("buy_business_shares", { p_business_id: b.id, p_quantity: qty }),
                          "Actions achetées.",
                          () => setTradeQty((t) => ({ ...t, [b.id]: "" }))
                        )
                      }
                      disabled={busy || qty < 1}
                      className="rounded-lg bg-blue px-3 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
                    >
                      Acheter
                    </button>
                    {held > 0 && (
                      <button
                        onClick={async () => {
                          setBusy(true);
                          setMessage(null);
                          const { data, error } = await supabase.rpc("sell_business_shares", { p_business_id: b.id, p_quantity: qty });
                          setBusy(false);
                          if (error) {
                            setMessage(`Échec : ${error.message}`);
                            return;
                          }
                          const r = data as SellResult;
                          setMessage(
                            r.partial
                              ? `Vente partielle : ${r.sold} / ${r.requested} action(s) vendue(s) (trésorerie de l'entreprise limitée) pour ${r.net_received.toLocaleString("fr-FR")} Cr. nets.`
                              : `${r.sold} action(s) vendue(s) pour ${r.net_received.toLocaleString("fr-FR")} Cr. nets.`
                          );
                          setTradeQty((t) => ({ ...t, [b.id]: "" }));
                          await refresh();
                          if (openChartId) await loadHistory(openChartId);
                        }}
                        disabled={busy || qty < 1 || qty > canSell}
                        title={qty > canSell ? `Seulement ${canSell} action(s) revendable(s) pour l'instant (délai de détention)` : undefined}
                        className="rounded-lg border border-red px-3 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Vendre
                      </button>
                    )}
                  </div>

                  {buyEst && sellEst && (
                    <p className="mt-2 font-mono text-[10px] text-paper/60">
                      Achat estimé : {cr(buyEst.net)} (dont {cr(buyEst.fee)} de frais + {cr(buyEst.adminFee)} reversés à
                      l&apos;administration) — impact sur le cours ≈ +
                      {(buyEst.impact * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                      {held > 0 && ` · Vente estimée : ${cr(sellEst.net)} nets`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
