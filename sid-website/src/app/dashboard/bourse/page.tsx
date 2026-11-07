"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/session";
import { useDeepLink } from "@/lib/deeplink";
import { SidIcon } from "@/components/icons/SidIcon";
import { Candles } from "@/components/market/Candles";
import { Spark } from "@/components/market/Spark";
import { arrow, change, pct, px, time, tone, when, z, zk } from "@/lib/econ";
import { inputClass, labelClass } from "@/lib/ui";
import type { BookLevel, MarketDetail, MarketOrder, MarketRow, OrderResult } from "@/types/economy";
import "@/components/market/bourse.css";

type IndexPoint = { at: string; value: number; cap: number };

function valuation(r: MarketRow) {
  const ratio = r.price / Math.max(r.fair_value, 0.0001);
  if (ratio > 1.15) return { label: "Au-dessus des fondamentaux", className: "border-red/70 text-red" };
  if (ratio < 0.87) return { label: "Sous les fondamentaux", className: "border-blue/70 text-blue-light" };
  return { label: "Proche des fondamentaux", className: "border-white/25 text-paper/70" };
}

/** Exécution estimée d'un ordre au marché sur les niveaux affichés du carnet. */
function walk(levels: BookLevel[], qty: number) {
  let left = qty;
  let cost = 0;
  for (const l of levels) {
    if (left <= 0) break;
    const take = Math.min(left, Number(l.qty));
    cost += take * Number(l.price);
    left -= take;
  }
  const filled = qty - left;
  return { filled, avg: filled > 0 ? cost / filled : null, cost };
}

export default function BoursePage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<MarketRow[] | null>(null);
  const [index, setIndex] = useState<IndexPoint[]>([]);
  const [myOrders, setMyOrders] = useState<MarketOrder[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarketDetail | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});
  const prev = useRef<Record<string, number>>({});

  const say = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 6000);
  };

  const loadBoard = useCallback(async () => {
    const { data: { user } } = await currentUser();
    const [o, i, m, w] = await Promise.all([
      supabase.rpc("market_overview"),
      supabase.rpc("market_index_series", { p_days: 30 }),
      supabase.rpc("market_my_orders"),
      user ? supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle() : null,
    ]);
    if (o.error) {
      setRows([]);
      if (o.error.message.includes("market_overview")) say(false, "La bourse à carnet d'ordres demande la migration 0085.");
      return;
    }
    const list = (o.data ?? []) as MarketRow[];
    // Clignotement des cours qui ont bougé depuis le dernier passage.
    const f: Record<string, "up" | "down"> = {};
    for (const r of list) {
      const before = prev.current[r.id];
      if (before != null && before !== Number(r.price)) f[r.id] = Number(r.price) > before ? "up" : "down";
      prev.current[r.id] = Number(r.price);
    }
    setFlash(f);
    setRows(list);
    setIndex(((i.data ?? []) as IndexPoint[]).map((p) => ({ ...p, value: Number(p.value), cap: Number(p.cap) })));
    // market_my_orders ne renvoie que les ordres ouverts.
    setMyOrders(((m.data ?? []) as MarketOrder[]).map((o) => ({ ...o, status: o.status ?? "open" })));
    if (w?.data) setBalance(Number(w.data.balance));
    setSel((s) => s ?? list[0]?.id ?? null);
  }, [supabase]);

  const loadDetail = useCallback(
    async (id: string | null) => {
      if (!id) return setDetail(null);
      const { data } = await supabase.rpc("market_detail", { p_business: id });
      setDetail((data ?? null) as MarketDetail | null);
    },
    [supabase]
  );

  useEffect(() => {
    loadBoard();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") loadBoard();
    }, 30_000);
    return () => clearInterval(t);
  }, [loadBoard]);

  useEffect(() => {
    loadDetail(sel);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") loadDetail(sel);
    }, 30_000);
    return () => clearInterval(t);
  }, [sel, loadDetail]);

  useDeepLink("valeur", !!rows, (id) => {
    if (rows?.some((r) => r.id === id)) setSel(id);
  });

  const row = rows?.find((r) => r.id === sel) ?? null;
  const idxNow = index.at(-1)?.value ?? null;
  const idxDayAgo = useMemo(() => {
    const cut = Date.now() - 86_400_000;
    const before = index.filter((p) => new Date(p.at).getTime() <= cut);
    return before.at(-1)?.value ?? index[0]?.value ?? null;
  }, [index]);
  const totalCap = rows?.reduce((s, r) => s + Number(r.cap), 0) ?? 0;
  const dayValue = rows?.reduce((s, r) => s + Number(r.value), 0) ?? 0;
  const myValue = rows?.reduce((s, r) => s + r.my_qty * Number(r.price), 0) ?? 0;

  async function refreshAll() {
    await Promise.all([loadBoard(), loadDetail(sel)]);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* ---------------------------------------------------------------- En-tête */}
      <header className="glass-card grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-paper/55">Salle des marchés</p>
          <h1 className="font-display text-3xl uppercase tracking-wide text-red">Bourse du S.I.D.</h1>
          <p className="mt-1 max-w-xl font-body text-sm text-paper/70">
            Les cours se font entre investisseurs : un échange a lieu quand un acheteur et un vendeur s&apos;entendent sur un prix.
            La population tient le marché et l&apos;entreprise place les actions qu&apos;elle n&apos;a pas encore vendues.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <p className={labelClass}>Indice SID</p>
            <p className="bourse-num font-display text-4xl text-paper">{idxNow == null ? "—" : px(idxNow)}</p>
            <p className={`bourse-num font-mono text-xs ${tone(change(idxNow, idxDayAgo))}`}>
              {arrow(change(idxNow, idxDayAgo))} {pct(change(idxNow, idxDayAgo), 2, true)} sur 24 h
            </p>
          </div>
          <Spark values={index.map((p) => p.value)} width={150} height={48} />
          <div className="space-y-0.5 font-mono text-[11px] text-paper/65">
            <p>Capitalisation <b className="bourse-num text-paper">{zk(totalCap)}</b></p>
            <p>Échangé aujourd&apos;hui <b className="bourse-num text-paper">{zk(dayValue)}</b></p>
            {myValue > 0 && <p>Mes actions <b className="bourse-num text-blue-light">{z(myValue, 0)}</b></p>}
          </div>
        </div>
      </header>

      {rows && rows.length > 0 && <Tape rows={rows} onPick={setSel} />}

      {rows === null ? (
        <p className="glass-card p-6 font-body text-sm text-paper/60">Chargement de la cote…</p>
      ) : rows.length === 0 ? (
        <p className="glass-card p-6 font-body text-sm text-paper/60">Aucune entreprise cotée pour le moment.</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          {/* ------------------------------------------------------------ La cote */}
          <section className="glass-card self-start p-3" aria-label="La cote">
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <h2 className="font-display text-lg uppercase">La cote</h2>
              <span className="font-mono text-[10px] uppercase text-paper/50">var. du jour</span>
            </div>
            <ul className="space-y-1">
              {rows.map((r) => {
                const c = change(Number(r.price), Number(r.ref));
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSel(r.id)} aria-pressed={sel === r.id} className={`bourse-row ${sel === r.id ? "is-on" : ""} ${flash[r.id] ? `bourse-flash-${flash[r.id]}` : ""}`}>
                      <span className="min-w-0">
                        <span className="block truncate font-display uppercase text-blue-light">{r.name}</span>
                        <span className="block truncate font-mono text-[10px] text-paper/50">
                          cap. {zk(r.cap)}
                          {r.my_qty > 0 && <span className="text-[#f0c27a]"> · {r.my_qty} à moi</span>}
                          {r.halted_until && <span className="text-[#f0c27a]"> · suspendue</span>}
                        </span>
                      </span>
                      <Spark values={r.spark.map(Number)} width={64} height={22} />
                      <span className="text-right">
                        <span className="bourse-num block font-mono text-sm text-paper">{px(r.price)}</span>
                        <span className={`bourse-num block font-mono text-[11px] ${tone(c)}`}>{pct(c, 1, true)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ------------------------------------------------------------ Une valeur */}
          {row && (
            <ValuePanel
              key={row.id}
              row={row}
              detail={detail}
              balance={balance}
              say={say}
              onDone={refreshAll}
            />
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- Mes ordres */}
      {myOrders.length > 0 && (
        <section className="glass-card space-y-2 p-5">
          <h2 className="font-display text-lg uppercase">Mes ordres ouverts</h2>
          <ul className="divide-y divide-white/5">
            {myOrders.map((o) => (
              <OrderLine key={o.id} o={o} name={o.name} onCancel={async () => {
                const { error } = await supabase.rpc("market_cancel", { p_order: o.id });
                if (error) say(false, error.message);
                else say(true, "Ordre annulé.");
                await refreshAll();
              }} onOpen={() => o.business_id && setSel(o.business_id)} />
            ))}
          </ul>
        </section>
      )}

      <HowItWorks fees={detail?.fees} />

      {toast && (
        <div role="status" className={`fixed bottom-5 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 font-body text-sm shadow-xl backdrop-blur ${toast.ok ? "border-blue/50 bg-ink/90 text-paper" : "border-red/60 bg-ink/90 text-red-light"}`}>
          <SidIcon name={toast.ok ? "check" : "warning"} size={16} /> {toast.text}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Bandeau
function Tape({ rows, onPick }: { rows: MarketRow[]; onPick: (id: string) => void }) {
  const items = (copy: string) =>
    rows.map((r) => {
      const c = change(Number(r.price), Number(r.ref));
      return (
        <button key={`${r.id}-${copy}`} type="button" onClick={() => onPick(r.id)} className="bourse-num flex shrink-0 items-baseline gap-2 font-mono text-xs" tabIndex={-1}>
          <span className="font-display uppercase tracking-wide text-paper/85">{r.name}</span>
          <span className="text-paper">{px(r.price)}</span>
          <span className={tone(c)}>
            {arrow(c)} {pct(c, 1)}
          </span>
        </button>
      );
    });
  return (
    <div className="bourse-tape rounded-lg" aria-hidden>
      <div className="bourse-tape-track">
        {items("a")}
        {items("b")}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Panneau d'une valeur
function ValuePanel({ row, detail, balance, say, onDone }: { row: MarketRow; detail: MarketDetail | null; balance: number | null; say: (ok: boolean, t: string) => void; onDone: () => Promise<void> }) {
  const supabase = useMemo(() => createClient(), []);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [mode, setMode] = useState<"limit" | "market">("limit");
  const [qty, setQty] = useState("");
  const [limit, setLimit] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const c = change(Number(row.price), Number(row.ref));
  const val = valuation(row);
  const halted = row.halted_until && new Date(row.halted_until).getTime() > Date.now();
  const fees = detail?.fees ?? { rate: 0.002, admin_per_share: 0.5, min_hold: 30, band: 0.2 };
  const hold = detail?.holding ?? { qty: row.my_qty, locked: row.my_locked, sellable: 0 };
  const free = Math.max(0, hold.sellable - hold.locked);
  const q = Math.max(0, Math.floor(Number(qty) || 0));
  const L = Number(limit.replace(",", ".")) || 0;
  const bestBid = detail?.bids[0]?.price ?? row.bid;
  const bestAsk = detail?.asks[0]?.price ?? row.ask;

  // Estimation : au marché, sur le carnet affiché ; à cours limité, au pire au prix limite.
  const est = useMemo(() => {
    if (q < 1) return null;
    if (mode === "market") {
      const w = walk(side === "buy" ? detail?.asks ?? [] : detail?.bids ?? [], q);
      if (!w.avg) return { filled: 0, gross: 0, fee: 0, admin: 0, net: 0 };
      const gross = w.filled * w.avg;
      const fee = gross * fees.rate;
      const admin = side === "buy" ? w.filled * fees.admin_per_share : 0;
      return { filled: w.filled, gross, fee, admin, net: side === "buy" ? gross + fee + admin : gross - fee };
    }
    if (L <= 0) return null;
    const gross = q * L;
    const fee = gross * fees.rate;
    const admin = side === "buy" ? q * fees.admin_per_share : 0;
    return { filled: q, gross, fee, admin, net: side === "buy" ? gross + fee + admin : gross - fee };
  }, [q, L, mode, side, detail, fees]);

  const crosses = mode === "limit" && L > 0 && ((side === "buy" && bestAsk != null && L >= Number(bestAsk)) || (side === "sell" && bestBid != null && L <= Number(bestBid)));
  const tooFar = mode === "limit" && L > 0 && (L > Number(row.price) * 2 || L < Number(row.price) * 0.5);
  const cantAfford = side === "buy" && est != null && balance != null && est.net > balance;
  const cantSell = side === "sell" && q > free;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q < 1) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("market_order", {
      p_business: row.id,
      p_side: side,
      p_quantity: q,
      p_limit: mode === "market" ? null : L,
      p_days: days,
    });
    setBusy(false);
    if (error) return say(false, error.message);
    const r = data as OrderResult;
    const verb = side === "buy" ? "achetée" : "vendue";
    if (r.halted) say(false, `Cotation suspendue : l'échange aurait dépassé ±${Math.round(fees.band * 100)} % sur la journée.`);
    else if (r.filled === r.requested) say(true, `${r.filled} action(s) ${verb}(s) à ${px(r.avg_price)} z en moyenne.`);
    else if (r.filled > 0) say(true, `${r.filled} / ${r.requested} ${verb}(s) à ${px(r.avg_price)} z.${r.status === "open" ? ` Le reste attend à ${px(r.limit)} z.` : " Le reste n'a pas trouvé de contrepartie."}`);
    else if (r.status === "open") say(true, `Ordre posé à ${px(r.limit)} z : il s'exécutera si quelqu'un accepte ce prix.`);
    else say(false, "Aucune contrepartie au marché pour l'instant : pose un ordre à cours limité.");
    setQty("");
    await onDone();
  }

  return (
    <section className="glass-card min-w-0 space-y-5 p-5" aria-label={`Valeur : ${row.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl uppercase tracking-wide text-blue-light">{row.name}</h2>
          {row.description && <p className="line-clamp-2 max-w-lg font-body text-sm text-paper/65">{row.description}</p>}
          <span className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase ${val.className}`}>{val.label}</span>
        </div>
        <div className="text-right">
          <p className="bourse-num font-display text-4xl text-paper">{px(row.price)} <span className="text-lg text-paper/60">z</span></p>
          <p className={`bourse-num font-mono text-sm ${tone(c)}`}>
            {arrow(c)} {pct(c, 2, true)} <span className="text-paper/50">· clôture veille {px(row.ref)}</span>
          </p>
          <p className="bourse-num font-mono text-[11px] text-paper/55">
            Séance : {row.open != null ? `ouv. ${px(row.open)} · haut ${px(row.high)} · bas ${px(row.low)}` : "pas encore d'échange"} · vol. {row.volume.toLocaleString("fr-FR")}
          </p>
        </div>
      </div>

      {halted && (
        <p className="bourse-halt rounded-lg px-4 py-2 font-body text-sm text-[#f0c27a]">
          <SidIcon name="warning" size={15} /> Cotation suspendue jusqu&apos;à {time(row.halted_until!)} : le cours a bougé de plus de {Math.round(fees.band * 100)} % dans la journée.
        </p>
      )}

      <Candles candles={detail?.candles ?? []} refLine={{ value: Number(row.fair_value), label: `fondamentaux ${px(row.fair_value)}` }} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-white/10 py-3 font-mono text-[11px] sm:grid-cols-4">
        {[
          ["Valeur des fondamentaux", px(row.fair_value), "text-paper"],
          ["Bénéfice 7 j", z(row.profit_7d, 0), Number(row.profit_7d) >= 0 ? "text-blue-light" : "text-red"],
          ["Dividendes 30 j", z(row.dividends_30d, 0), "text-paper"],
          ["Fonds propres", z(row.equity, 0), Number(row.equity) >= 0 ? "text-paper" : "text-red"],
          ["Capitalisation", z(row.cap, 0), "text-paper"],
          ["Actions", row.share_count.toLocaleString("fr-FR"), "text-paper"],
          ["Non placées", row.shares_in_treasury.toLocaleString("fr-FR"), "text-paper"],
          ["Sur 7 j", pct(change(Number(row.price), row.week_ago), 1, true), tone(change(Number(row.price), row.week_ago))],
        ].map(([k, v, cls]) => (
          <div key={k}>
            <dt className="uppercase text-paper/55">{k}</dt>
            <dd className={`bourse-num ${cls}`}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---------------------------------------------------------- Carnet */}
        <div className="space-y-3">
          <h3 className="font-display uppercase">Carnet d&apos;ordres</h3>
          <Book
            bids={detail?.bids ?? []}
            asks={detail?.asks ?? []}
            onPick={(p, s) => {
              setMode("limit");
              setLimit(String(Number(p)));
              setSide(s);
            }}
          />
          <h3 className="pt-2 font-display uppercase">Derniers échanges</h3>
          {detail && detail.trades.length > 0 ? (
            <ul className="max-h-52 space-y-0.5 overflow-y-auto pr-1 font-mono text-[11px]">
              {detail.trades.map((t, i) => (
                <li key={`${t.at}-${i}`} className={`bourse-num grid grid-cols-[3.2rem_1fr_auto] gap-2 rounded px-1.5 py-0.5 ${t.mine ? "bg-[#f0c27a]/10" : ""}`}>
                  <span className="text-paper/50">{time(t.at)}</span>
                  <span className={t.side === "sell" ? "text-red" : "text-blue-light"}>{px(t.price)}</span>
                  <span className="text-paper/70">{t.qty}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-xs text-paper/55">Aucun échange récent.</p>
          )}
        </div>

        {/* ---------------------------------------------------------- Ordre */}
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/10 bg-black/10 p-4">
          <div className="bourse-side" role="group" aria-label="Sens de l'ordre">
            <button type="button" className={side === "buy" ? "is-buy" : ""} onClick={() => setSide("buy")} aria-pressed={side === "buy"}>Acheter</button>
            <button type="button" className={side === "sell" ? "is-sell" : ""} onClick={() => setSide("sell")} aria-pressed={side === "sell"}>Vendre</button>
          </div>
          <div className="flex gap-2" role="group" aria-label="Type d'ordre">
            <button type="button" className={`bourse-chip ${mode === "limit" ? "is-on" : ""}`} onClick={() => setMode("limit")} aria-pressed={mode === "limit"}>À cours limité</button>
            <button type="button" className={`bourse-chip ${mode === "market" ? "is-on" : ""}`} onClick={() => setMode("market")} aria-pressed={mode === "market"}>Au marché</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={labelClass}>Quantité</span>
              <input type="number" min={1} step={1} inputMode="numeric" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            {mode === "limit" ? (
              <label className="space-y-1">
                <span className={labelClass}>Prix limite (z)</span>
                <input type="number" min={0} step="any" inputMode="decimal" className={inputClass} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={px(row.price)} />
              </label>
            ) : (
              <div className="space-y-1">
                <span className={labelClass}>Meilleur prix</span>
                <p className="bourse-num rounded-lg border border-white/10 px-3 py-2 font-mono text-sm text-paper">
                  {side === "buy" ? (bestAsk != null ? px(bestAsk) : "aucun vendeur") : bestBid != null ? px(bestBid) : "aucun acheteur"}
                </p>
              </div>
            )}
          </div>
          {mode === "limit" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={labelClass}>Valable</span>
              {[1, 7, 30].map((d) => (
                <button key={d} type="button" className={`bourse-chip ${days === d ? "is-on" : ""}`} onClick={() => setDays(d)} aria-pressed={days === d}>
                  {d} j
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1 font-mono text-[11px] text-paper/65">
            {side === "sell" ? (
              <p>
                Tu détiens <b className="text-paper">{hold.qty}</b> action(s), <b className="text-paper">{free}</b> vendable(s)
                {hold.locked > 0 && ` (${hold.locked} déjà en vente)`}
                {hold.qty > hold.sellable && ` · détention minimale ${fees.min_hold} min`}
              </p>
            ) : (
              balance != null && <p>Portefeuille : <b className="text-paper">{z(balance)}</b></p>
            )}
            {est && (
              <p>
                {side === "buy" ? "Coût" : "Produit"}
                {mode === "limit" ? " au plus" : " estimé"} : <b className="bourse-num text-paper">{z(est.net)}</b>
                <span className="text-paper/50"> (frais {z(est.fee)}{est.admin > 0 ? ` + ${z(est.admin)} administration` : ""})</span>
                {mode === "market" && est.filled < q && <span className="text-[#f0c27a]"> · le carnet n&apos;affiche que {est.filled} action(s)</span>}
              </p>
            )}
            {crosses && <p className="text-[#f0c27a]">Ce prix croise le carnet : exécution immédiate, au prix des ordres en face.</p>}
            {tooFar && <p className="text-red">Prix refusé : entre la moitié et le double du cours.</p>}
            {cantAfford && <p className="text-red">Solde insuffisant pour cette quantité.</p>}
            {cantSell && <p className="text-red">Pas assez d&apos;actions vendables.</p>}
          </div>

          <button
            type="submit"
            disabled={busy || q < 1 || (mode === "limit" && L <= 0) || tooFar || cantSell || !!halted}
            className={`w-full rounded-lg py-2.5 font-display uppercase tracking-wide text-ink transition disabled:cursor-not-allowed disabled:opacity-40 ${side === "buy" ? "bg-blue hover:bg-blue-light" : "bg-red hover:bg-red-light"}`}
          >
            {busy ? "Envoi…" : `${side === "buy" ? "Acheter" : "Vendre"}${q > 0 ? ` ${q}` : ""}${mode === "market" ? " au marché" : L > 0 ? ` à ${px(L)} z` : ""}`}
          </button>
        </form>
      </div>

      {detail && detail.my_orders.length > 0 && (
        <div className="space-y-1">
          <h3 className="font-display uppercase">Mes ordres sur {row.name}</h3>
          <ul className="divide-y divide-white/5">
            {detail.my_orders.map((o) => (
              <OrderLine
                key={o.id}
                o={o}
                onCancel={async () => {
                  const { error } = await supabase.rpc("market_cancel", { p_order: o.id });
                  if (error) say(false, error.message);
                  else say(true, "Ordre annulé.");
                  await onDone();
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Book({ bids, asks, onPick }: { bids: BookLevel[]; asks: BookLevel[]; onPick: (price: number, side: "buy" | "sell") => void }) {
  const max = Math.max(1, ...bids.map((l) => Number(l.qty)), ...asks.map((l) => Number(l.qty)));
  const spread = bids[0] && asks[0] ? Number(asks[0].price) - Number(bids[0].price) : null;
  const mid = bids[0] && asks[0] ? (Number(asks[0].price) + Number(bids[0].price)) / 2 : null;
  const side = (levels: BookLevel[], kind: "bid" | "ask") => (
    <div>
      <p className="mb-1 grid grid-cols-[1fr_auto] px-2 font-mono text-[10px] uppercase text-paper/50">
        <span>{kind === "bid" ? "Achat" : "Vente"}</span>
        <span>Qté</span>
      </p>
      {levels.length === 0 ? (
        <p className="px-2 font-body text-xs text-paper/50">Personne</p>
      ) : (
        levels.map((l) => (
          <button
            key={l.price}
            type="button"
            onClick={() => onPick(Number(l.price), kind === "bid" ? "sell" : "buy")}
            title={kind === "bid" ? "Vendre à ce prix" : "Acheter à ce prix"}
            className={`bourse-level bourse-num w-full is-${kind} ${l.mine ? "is-mine" : ""}`}
            style={{ "--depth": `${(Number(l.qty) / max) * 100}%` } as React.CSSProperties}
          >
            <span className={`text-left ${kind === "bid" ? "text-blue-light" : "text-red"}`}>{px(l.price)}</span>
            <span className="text-paper/80">{Number(l.qty).toLocaleString("fr-FR")}</span>
          </button>
        ))
      )}
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="bourse-book">
        {side(bids, "bid")}
        {side(asks, "ask")}
      </div>
      {spread != null && mid != null && (
        <p className="bourse-num px-2 font-mono text-[10px] text-paper/55">
          Écart {px(spread)} z ({pct(spread / mid, 2)}) · touche un prix pour le reprendre
        </p>
      )}
    </div>
  );
}

function OrderLine({ o, name, onCancel, onOpen }: { o: MarketOrder; name?: string; onCancel: () => Promise<void>; onOpen?: () => void }) {
  const [busy, setBusy] = useState(false);
  const done = o.quantity - o.remaining;
  const label: Record<MarketOrder["status"], string> = { open: "Ouvert", filled: "Exécuté", cancelled: "Annulé", expired: "Échu" };
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 font-mono text-xs">
      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${o.side === "buy" ? "border-blue/60 text-blue-light" : "border-red/60 text-red"}`}>{o.side === "buy" ? "Achat" : "Vente"}</span>
      {name && (
        <button type="button" onClick={onOpen} className="font-display uppercase text-paper hover:text-blue-light">
          {name}
        </button>
      )}
      <span className="bourse-num text-paper">
        {o.remaining} / {o.quantity} à {px(o.limit)} z
      </span>
      {done > 0 && <span className="text-paper/55">{done} exécutée(s)</span>}
      <span className="text-paper/50">{o.status === "open" ? (o.expires_at ? `jusqu'au ${when(o.expires_at)}` : "") : label[o.status]}</span>
      {o.note && o.status !== "open" && <span className="text-paper/45">{o.note}</span>}
      {o.status === "open" && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onCancel();
            setBusy(false);
          }}
          className="ml-auto uppercase text-paper/60 hover:text-red-light disabled:opacity-40"
        >
          Annuler
        </button>
      )}
    </li>
  );
}

function HowItWorks({ fees }: { fees?: MarketDetail["fees"] }) {
  const f = fees ?? { rate: 0.002, admin_per_share: 0.5, min_hold: 30, band: 0.2 };
  return (
    <details className="glass-card group p-5">
      <summary className="cursor-pointer list-none font-display uppercase text-paper/85">
        <SidIcon name="info" size={16} /> Comment se forment les cours
      </summary>
      <div className="mt-3 grid gap-4 font-body text-sm text-paper/75 md:grid-cols-2">
        <p>
          <b className="text-paper">Ordre à cours limité</b> : tu fixes le prix maximum (achat) ou minimum (vente). S&apos;il croise un ordre en face, il
          s&apos;exécute tout de suite au prix de cet ordre ; sinon il attend dans le carnet jusqu&apos;à son échéance. <b className="text-paper">Au marché</b> :
          exécuté immédiatement sur les meilleurs prix disponibles (5 % de marge au plus), le reste est abandonné.
        </p>
        <p>
          Le cours est le prix du dernier échange. Toutes les heures, la population affiche ses prix d&apos;achat et de vente autour de sa propre estimation
          (cours, fondamentaux, actualités) et passe des ordres. Plus l&apos;entreprise est petite, plus l&apos;écart entre achat et vente est large.
        </p>
        <p>
          Frais : {pct(f.rate, 1)} de chaque côté (caisse commune) et {z(f.admin_per_share)} par action achetée (administration). Une action achetée se revend
          après {f.min_hold} min.
        </p>
        <p>
          Coupe-circuit : un échange à plus de {Math.round(f.band * 100)} % de la clôture de la veille suspend la cotation une heure. L&apos;indice SID suit la
          capitalisation de toutes les valeurs (base 1 000). Voir aussi la <Link href="/dashboard/economie" className="text-blue underline">banque centrale</Link>.
        </p>
      </div>
    </details>
  );
}
