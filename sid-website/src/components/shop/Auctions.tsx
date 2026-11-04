"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShopItem } from "@/types/database";
import { SidIcon } from "@/components/icons/SidIcon";
import { ShopFrame } from "@/components/shop/ShopFrame";
import "./auctions.css";

/**
 * Salle des ventes (Lot 65) : enchères à durée limitée, dans un onglet de la
 * boutique. L'offre en tête est bloquée sur la bourse de l'enchérisseur et lui
 * est rendue dès qu'il est dépassé ; une offre dans les 2 dernières minutes
 * prolonge la vente. Règles complètes : supabase/migrations/0080.
 */

export type Auction = {
  id: string;
  item_id: string;
  item_name: string;
  item_image: string | null;
  item_description: string | null;
  source: "stock" | "resale";
  quantity: number;
  note: string | null;
  seller_id: string;
  seller_name: string | null;
  business_name: string | null;
  start_price: number;
  buy_now_price: number | null;
  current_price: number | null;
  min_next: number;
  top_bidder_id: string | null;
  top_bidder_name: string | null;
  bid_count: number;
  my_best: number | null;
  ends_at: string;
  status: "open" | "sold" | "unsold" | "cancelled";
  settled_at: string | null;
  created_at: string;
};

type Scope = "open" | "mine" | "ended";
type Bid = { bidder_name: string; is_me: boolean; amount: number; created_at: string };
type Candidate = { purchase_id: string; item_id: string; item_name: string; item_image: string | null; quantity: number; total_price: number; created_at: string };
export type AuctionPreset = { source: "resale" | "stock"; ref: string } | null;

const z = (n: number | null | undefined) => `${Number(n ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} z`;
const DURATIONS: [number, string][] = [
  [1, "1 heure"],
  [3, "3 heures"],
  [6, "6 heures"],
  [12, "12 heures"],
  [24, "1 jour"],
  [48, "2 jours"],
  [72, "3 jours"],
  [168, "7 jours"],
];

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

function timeLeft(endsAt: string, now: number) {
  const s = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  if (s === 0) return { text: "Clôture…", urgent: true, over: true };
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const text = d ? `${d} j ${h} h` : h ? `${h} h ${String(m).padStart(2, "0")}` : m ? `${m} min ${String(sec).padStart(2, "0")}` : `${sec} s`;
  return { text, urgent: s < 300, over: false };
}

const sellerOf = (a: Auction) => (a.business_name ? `${a.business_name} · ${a.seller_name ?? "?"}` : a.seller_name ?? "Agent");

// ====================================================================== Onglet
export function AuctionsTab({
  userId,
  balance,
  staff,
  myItems,
  say,
  onWallet,
  preset,
  openId,
  onConsumed,
}: {
  userId: string | null;
  balance: number | null;
  staff: boolean;
  myItems: ShopItem[];
  say: (ok: boolean, text: string) => void;
  onWallet: () => void;
  preset: AuctionPreset;
  openId: string | null;
  onConsumed: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [scope, setScope] = useState<Scope>("open");
  const [list, setList] = useState<Auction[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [extra, setExtra] = useState<Auction | null>(null);
  const [creating, setCreating] = useState<AuctionPreset | "blank" | null>(null);
  const now = useNow(1000);
  const settling = useRef(0);
  const sayRef = useRef(say);
  sayRef.current = say;

  const load = useCallback(
    async (s: Scope = scope) => {
      await supabase.rpc("auctions_settle_due");
      const { data, error } = await supabase.rpc("auctions_list", { p_scope: s });
      if (error) {
        sayRef.current(false, error.message);
        setList([]);
        return;
      }
      setList((data ?? []) as Auction[]);
    },
    [supabase, scope]
  );

  useEffect(() => {
    setList(null);
    load(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // En direct : toute vente modifiée (offre, clôture) recharge la liste ;
  // sans Realtime, un rafraîchissement toutes les 20 s.
  useEffect(() => {
    let t: number | undefined;
    const bump = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => load(), 400);
    };
    const ch = supabase
      .channel(`auctions:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions" }, bump)
      .subscribe();
    const poll = window.setInterval(() => document.visibilityState === "visible" && load(), 20000);
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(poll);
      window.clearTimeout(t);
    };
  }, [supabase, load]);

  // Une vente arrive à son terme sous nos yeux : on la clôt.
  useEffect(() => {
    if (!list) return;
    const due = list.some((a) => a.status === "open" && new Date(a.ends_at).getTime() <= now);
    if (due && now - settling.current > 4000) {
      settling.current = now;
      load().then(onWallet);
    }
  }, [now, list, load, onWallet]);

  // Lien direct (notification, partage) et « Mettre aux enchères » depuis Mes achats.
  useEffect(() => {
    if (openId) {
      setSelected(openId);
      onConsumed();
    } else if (preset) {
      setCreating(preset);
      onConsumed();
    }
  }, [openId, preset, onConsumed]);

  // La vente ouverte peut ne pas être dans la liste affichée (autre onglet).
  useEffect(() => {
    if (!selected || list?.some((a) => a.id === selected)) {
      setExtra(null);
      return;
    }
    supabase.rpc("auctions_list", { p_scope: "open", p_id: selected }).then(({ data }) => setExtra(((data ?? []) as Auction[])[0] ?? null));
  }, [selected, list, supabase]);

  const current = list?.find((a) => a.id === selected) ?? (extra?.id === selected ? extra : null);
  const leading = list?.filter((a) => a.status === "open" && a.top_bidder_id === userId).length ?? 0;
  const blocked = list?.filter((a) => a.status === "open" && a.top_bidder_id === userId).reduce((s, a) => s + Number(a.current_price ?? 0), 0) ?? 0;

  return (
    <section className="space-y-5" aria-label="Salle des ventes">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ventes affichées">
          {(
            [
              ["open", "En cours"],
              ["mine", "Mes enchères"],
              ["ended", "Terminées"],
            ] as [Scope, string][]
          ).map(([k, l]) => (
            <button key={k} onClick={() => setScope(k)} className={`shop-chip ${scope === k ? "is-on" : ""}`} aria-pressed={scope === k}>
              {l}
            </button>
          ))}
        </div>
        {scope === "mine" && leading > 0 && (
          <span className="font-mono text-[11px] text-paper/70">
            En tête sur {leading} vente{leading > 1 ? "s" : ""} · {z(blocked)} bloqués
          </span>
        )}
        <button onClick={() => setCreating("blank")} className="shop-buy ml-auto">
          <SidIcon name="gavel" size={15} /> Mettre en vente
        </button>
      </div>

      {list === null ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="shop-card animate-pulse">
              <div className="aspect-[4/3] bg-white/5" />
              <div className="h-28" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-2 px-6 py-12 text-center">
          <SidIcon name="gavel" size={40} />
          <p className="font-display text-lg uppercase">
            {scope === "open" ? "Aucune vente en cours" : scope === "mine" ? "Tu n'as encore rien vendu ni enchéri" : "Aucune vente terminée"}
          </p>
          {scope !== "ended" && (
            <button onClick={() => setCreating("blank")} className="font-mono text-xs uppercase text-blue hover:underline">
              Mettre un objet en vente →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <AuctionCard key={a.id} a={a} userId={userId} now={now} onOpen={() => setSelected(a.id)} />
          ))}
        </div>
      )}

      {current && (
        <AuctionSheet
          a={current}
          userId={userId}
          balance={balance}
          staff={staff}
          now={now}
          onClose={() => setSelected(null)}
          say={say}
          onChanged={async () => {
            await load();
            onWallet();
          }}
        />
      )}

      {creating && (
        <CreateAuction
          preset={creating === "blank" ? null : creating}
          myItems={myItems}
          onClose={() => setCreating(null)}
          say={say}
          onCreated={async (id) => {
            setCreating(null);
            setScope("open");
            await load("open");
            setSelected(id);
          }}
        />
      )}
    </section>
  );
}

// ====================================================================== Carte
function StatusBadge({ a, userId }: { a: Auction; userId: string | null }) {
  const lead = a.top_bidder_id === userId;
  if (a.status === "sold") return <span className={`shop-badge ${lead ? "is-effect" : "is-dark"}`}>{lead ? "Remportée" : "Vendue"}</span>;
  if (a.status === "unsold") return <span className="shop-badge is-dark">Sans offre</span>;
  if (a.status === "cancelled") return <span className="shop-badge is-dark">Annulée</span>;
  if (a.seller_id === userId) return <span className="shop-badge">Ta vente</span>;
  if (lead) return <span className="shop-badge is-effect">Tu mènes</span>;
  if (a.my_best != null) return <span className="shop-badge is-promo">Dépassé</span>;
  return null;
}

function AuctionCard({ a, userId, now, onOpen }: { a: Auction; userId: string | null; now: number; onOpen: () => void }) {
  const left = timeLeft(a.ends_at, now);
  const open = a.status === "open";
  return (
    <article className="shop-card group">
      <button onClick={onOpen} className="relative block w-full text-left" aria-label={`Voir la vente : ${a.item_name}`}>
        <ShopFrame src={a.item_image} alt={a.item_name} className="aspect-[4/3] w-full" />
        <div className="pointer-events-none absolute left-3 top-3 z-[2] flex flex-col items-start gap-1.5">
          <StatusBadge a={a} userId={userId} />
          {a.source === "resale" && <span className="shop-badge is-dark">Revente</span>}
        </div>
        {open && (
          <span className={`auction-clock absolute right-3 top-3 z-[2] ${left.urgent ? "is-urgent" : ""}`}>
            <SidIcon name="hourglass" size={12} /> {left.text}
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h2 className="font-display text-lg uppercase leading-tight tracking-wide">
            {a.item_name}
            {a.quantity > 1 && <span className="ml-1 text-paper/60">× {a.quantity}</span>}
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-wider text-paper/65">par {sellerOf(a)}</p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div className="leading-tight">
            <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">
              {a.current_price == null ? "Mise à prix" : a.status === "sold" ? "Adjugé" : `${a.bid_count} offre${a.bid_count > 1 ? "s" : ""}`}
            </p>
            <p className="font-display text-2xl text-blue">{z(a.current_price ?? a.start_price)}</p>
            {a.buy_now_price != null && open && <p className="font-mono text-[10px] text-paper/60">Achat immédiat {z(a.buy_now_price)}</p>}
          </div>
          <button onClick={onOpen} className="shop-buy">
            {open ? (a.seller_id === userId || a.top_bidder_id === userId ? "Suivre" : "Enchérir") : "Voir"}
          </button>
        </div>
      </div>
    </article>
  );
}

// ====================================================================== Fiche
function AuctionSheet({
  a,
  userId,
  balance,
  staff,
  now,
  onClose,
  say,
  onChanged,
}: {
  a: Auction;
  userId: string | null;
  balance: number | null;
  staff: boolean;
  now: number;
  onClose: () => void;
  say: (ok: boolean, text: string) => void;
  onChanged: () => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [bids, setBids] = useState<Bid[] | null>(null);
  const [amount, setAmount] = useState<string>(String(a.min_next));
  const [busy, setBusy] = useState(false);
  const [confirmBuy, setConfirmBuy] = useState(false);
  const minRef = useRef(a.min_next);

  const open = a.status === "open" && new Date(a.ends_at).getTime() > now;
  const mine = a.seller_id === userId;
  const lead = a.top_bidder_id === userId;
  const left = timeLeft(a.ends_at, now);

  useEffect(() => {
    supabase.rpc("auction_bids_list", { p_auction: a.id }).then(({ data }) => setBids((data ?? []) as Bid[]));
  }, [supabase, a.id, a.bid_count]);

  // Quelqu'un a surenchéri : la proposition suit le nouveau minimum.
  useEffect(() => {
    if (Number(amount) <= minRef.current || Number(amount) < a.min_next) setAmount(String(a.min_next));
    minRef.current = a.min_next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.min_next]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const value = Math.floor(Number(amount) || 0);
  const due = lead ? value - Number(a.current_price ?? 0) : value;
  const short = balance != null && due > balance;
  const tooLow = value < a.min_next;

  async function bid(v: number, buyNow = false) {
    setBusy(true);
    const { data, error } = await supabase.rpc("auction_bid", { p_auction: a.id, p_amount: v });
    setBusy(false);
    setConfirmBuy(false);
    if (error) return say(false, error.message);
    const r = data as { amount: number; bought: boolean };
    say(true, r.bought || buyNow ? `Adjugé ! ${a.item_name} est à toi pour ${z(r.amount)}.` : `Offre de ${z(r.amount)} enregistrée : tu mènes.`);
    await onChanged();
  }

  async function cancel() {
    if (!confirm(a.bid_count > 0 ? "Annuler cette vente ? L'offre en tête sera remboursée." : "Retirer cette vente ?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("auction_cancel", { p_auction: a.id });
    setBusy(false);
    if (error) return say(false, error.message);
    say(true, "Vente annulée.");
    await onChanged();
  }

  const quick = [
    ["Minimum", a.min_next],
    ["+10 %", Math.ceil(Math.max(a.min_next, Number(a.current_price ?? a.start_price) * 1.1))],
    ["+25 %", Math.ceil(Math.max(a.min_next, Number(a.current_price ?? a.start_price) * 1.25))],
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Vente : ${a.item_name}`}>
      <div className="shop-sheet relative grid w-full max-w-4xl overflow-hidden md:grid-cols-[1fr_1.1fr]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-[3] flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-paper hover:bg-black/60" aria-label="Fermer">
          ✕
        </button>
        <div className="relative">
          <ShopFrame src={a.item_image} alt={a.item_name} className="aspect-[4/3] w-full sm:aspect-square md:h-full md:aspect-auto md:min-h-[26rem]" pad="p-8" zoom={false} />
          <div className="pointer-events-none absolute left-3 top-3 z-[2] flex flex-col items-start gap-1.5">
            <StatusBadge a={a} userId={userId} />
            {a.source === "resale" && <span className="shop-badge is-dark">Revente</span>}
          </div>
        </div>

        <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto p-6 md:max-h-[85vh]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/65">par {sellerOf(a)}</p>
            <h2 className="font-display text-3xl uppercase leading-tight tracking-wide">
              {a.item_name}
              {a.quantity > 1 && <span className="ml-2 text-xl text-paper/60">× {a.quantity}</span>}
            </h2>
          </div>

          {a.note && (
            <blockquote className="auction-note">
              <SidIcon name="quill" size={14} /> {a.note}
            </blockquote>
          )}
          {a.item_description && <p className="line-clamp-4 whitespace-pre-line font-body text-sm leading-relaxed text-paper/80">{a.item_description}</p>}

          <div className="auction-board">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">
                {a.current_price == null ? "Mise à prix" : a.status === "sold" ? "Adjugé à" : "Offre en tête"}
              </p>
              <p className="font-display text-4xl leading-none text-blue">{z(a.current_price ?? a.start_price)}</p>
              {a.top_bidder_name && (
                <p className="mt-1 font-mono text-[11px] text-paper/70">
                  {lead ? "Toi" : a.top_bidder_name} · {a.bid_count} offre{a.bid_count > 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">{a.status === "open" ? "Fin dans" : "Terminée"}</p>
              <p className={`font-display text-2xl leading-none ${left.urgent && a.status === "open" ? "text-red" : ""}`}>
                {a.status === "open" ? left.text : new Date(a.settled_at ?? a.ends_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              </p>
              {a.status === "open" && (
                <p className="mt-1 font-mono text-[10px] text-paper/60">
                  {new Date(a.ends_at).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>

          {open && !mine && (
            <div className="space-y-3">
              {lead ? (
                <p className="rounded-xl border border-blue/40 bg-blue/10 px-3 py-2 font-body text-sm text-blue-light">
                  <SidIcon name="check" /> Tu mènes avec {z(a.current_price)}, bloqués sur ta bourse.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {quick.map(([l, v]) => (
                      <button key={l} onClick={() => setAmount(String(v))} className={`shop-chip ${value === v ? "is-on" : ""}`}>
                        {l} · {z(v)}
                      </button>
                    ))}
                  </div>
                  <label className="auction-input">
                    <span className="sr-only">Ton offre</span>
                    <input type="number" inputMode="numeric" min={a.min_next} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <span>z</span>
                  </label>
                  <dl className="space-y-1 rounded-xl bg-white/5 px-4 py-3 font-mono text-sm">
                    <div className="flex justify-between">
                      <dt className="text-paper/60">Bloqué sur ta bourse</dt>
                      <dd className="text-paper">{z(Math.max(0, due))}</dd>
                    </div>
                    {balance != null && (
                      <div className="flex justify-between">
                        <dt className="text-paper/60">Ta bourse après</dt>
                        <dd className={short ? "text-red" : "text-blue-light"}>{z(balance - Math.max(0, due))}</dd>
                      </div>
                    )}
                  </dl>
                  <button onClick={() => bid(value)} disabled={busy || tooLow || short || (balance != null && balance < 0)} className="shop-buy w-full !py-3 !text-base">
                    {busy ? "…" : tooLow ? `Minimum ${z(a.min_next)}` : short ? "Pas assez de zénis" : `Enchérir · ${z(value)}`}
                  </button>
                </>
              )}
              {a.buy_now_price != null &&
                (confirmBuy ? (
                  <div className="flex gap-2">
                    <button onClick={() => bid(Number(a.buy_now_price), true)} disabled={busy} className="shop-buy flex-1 !bg-[#f0c27a]">
                      Confirmer · {z(a.buy_now_price)}
                    </button>
                    <button onClick={() => setConfirmBuy(false)} className="rounded-lg border border-white/20 px-3 font-mono text-xs uppercase">
                      Non
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmBuy(true)}
                    disabled={busy || (balance != null && balance < Number(a.buy_now_price) - (lead ? Number(a.current_price ?? 0) : 0))}
                    className="w-full rounded-lg border border-[#f0c27a]/60 px-4 py-2 font-display text-sm uppercase tracking-wide text-[#f0c27a] transition hover:bg-[#f0c27a]/10 disabled:opacity-40"
                  >
                    Achat immédiat · {z(a.buy_now_price)}
                  </button>
                ))}
            </div>
          )}

          {!open && a.status === "sold" && (
            <p className="rounded-xl bg-white/5 px-3 py-2 font-body text-sm">
              {lead ? "Remportée : l'objet est dans Mes achats." : mine ? `Vendue à ${a.top_bidder_name}.` : `Remportée par ${a.top_bidder_name}.`}
            </p>
          )}

          <div className="border-t border-white/10 pt-3">
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wide text-paper/60">Offres</h3>
            {bids === null ? (
              <p className="font-mono text-xs text-paper/50">…</p>
            ) : bids.length === 0 ? (
              <p className="font-body text-sm text-paper/60">Aucune offre pour l&apos;instant.</p>
            ) : (
              <ol className="auction-bids">
                {bids.map((b, i) => (
                  <li key={`${b.created_at}-${i}`} className={i === 0 ? "is-top" : ""}>
                    <span className="truncate">{b.is_me ? "Toi" : b.bidder_name}</span>
                    <span className="font-mono">{z(b.amount)}</span>
                    <time className="font-mono text-[10px] text-paper/50" dateTime={b.created_at}>
                      {new Date(b.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {a.status === "open" && (mine || staff) && (
            <div className="border-t border-white/10 pt-3">
              <button onClick={cancel} disabled={busy || (mine && !staff && a.bid_count > 0)} className="font-mono text-[11px] uppercase text-red/80 hover:text-red disabled:opacity-40">
                <SidIcon name="cross" /> {a.bid_count > 0 ? "Annuler la vente (rembourse l'offre)" : "Retirer la vente"}
              </button>
              {mine && !staff && a.bid_count > 0 && <p className="mt-1 font-body text-xs text-paper/55">Des offres sont posées : seule l&apos;administration peut annuler.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ====================================================================== Mise en vente
function PickOption({ on, onPick, img, title, sub }: { on: boolean; onPick: () => void; img: string | null; title: string; sub: string }) {
  return (
    <button type="button" onClick={onPick} aria-pressed={on} className={`auction-pick ${on ? "is-on" : ""}`}>
      <ShopFrame src={img} alt="" className="h-12 w-12 shrink-0 rounded-lg" pad="p-1" zoom={false} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate font-display uppercase tracking-wide">{title}</span>
        <span className="block font-mono text-[10px] text-paper/60">{sub}</span>
      </span>
      {on && <SidIcon name="check" size={16} />}
    </button>
  );
}

function CreateAuction({
  preset,
  myItems,
  onClose,
  say,
  onCreated,
}: {
  preset: AuctionPreset;
  myItems: ShopItem[];
  onClose: () => void;
  say: (ok: boolean, text: string) => void;
  onCreated: (id: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [pick, setPick] = useState<AuctionPreset>(preset);
  const [qty, setQty] = useState(1);
  const [start, setStart] = useState("");
  const [buyNow, setBuyNow] = useState("");
  const [hours, setHours] = useState(24);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const stockItems = myItems.filter((i) => !i.hidden_at && (i.stock === null || i.stock > 0));

  useEffect(() => {
    supabase.rpc("auction_resale_candidates").then(({ data }) => setCandidates((data ?? []) as Candidate[]));
  }, [supabase]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const chosenItem = pick?.source === "stock" ? stockItems.find((i) => i.id === pick.ref) : null;
  const chosenPurchase = pick?.source === "resale" ? candidates?.find((c) => c.purchase_id === pick.ref) : null;
  const maxQty = chosenItem ? Math.min(100, chosenItem.stock ?? 100) : 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pick) return say(false, "Choisis d'abord ce que tu mets en vente.");
    setBusy(true);
    const { data, error } = await supabase.rpc("auction_create", {
      p_source: pick.source,
      p_ref: pick.ref,
      p_quantity: pick.source === "stock" ? qty : 1,
      p_start_price: Number(start),
      p_buy_now: buyNow ? Number(buyNow) : null,
      p_hours: hours,
      p_note: note || null,
    });
    setBusy(false);
    if (error) return say(false, error.message);
    say(true, "Vente ouverte.");
    onCreated(data as string);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="auction-new">
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="shop-sheet flex max-h-[92vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="auction-new" className="font-display text-2xl uppercase tracking-wide">
            <SidIcon name="gavel" /> Mettre en vente
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 hover:bg-black/60" aria-label="Fermer">
            ✕
          </button>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 font-mono text-xs uppercase tracking-wide text-paper/70">Le lot</legend>
          {stockItems.length > 0 && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-wide text-paper/50">Tes objets en boutique</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {stockItems.map((i) => (
                  <PickOption
                    key={i.id}
                    on={pick?.source === "stock" && pick.ref === i.id}
                    onPick={() => {
                      setPick({ source: "stock", ref: i.id });
                      setQty(1);
                      if (!start) setStart(String(Math.max(1, Math.round(i.price * 0.5))));
                    }}
                    img={i.image_url}
                    title={i.name}
                    sub={i.stock === null ? "Stock illimité" : `${i.stock} en stock`}
                  />
                ))}
              </div>
            </>
          )}
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper/50">Revendre un de mes achats</p>
          {candidates === null ? (
            <p className="font-mono text-xs text-paper/50">…</p>
          ) : candidates.length === 0 ? (
            <p className="font-body text-sm text-paper/60">Rien à revendre (les objets à effet ne se revendent pas).</p>
          ) : (
            <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {candidates.map((c) => (
                <PickOption
                  key={c.purchase_id}
                  on={pick?.source === "resale" && pick.ref === c.purchase_id}
                  onPick={() => {
                    setPick({ source: "resale", ref: c.purchase_id });
                    if (!start) setStart(String(Math.max(1, Math.round(Number(c.total_price) * 0.6))));
                  }}
                  img={c.item_image}
                  title={`${c.item_name}${c.quantity > 1 ? ` × ${c.quantity}` : ""}`}
                  sub={`Payé ${z(c.total_price)} · ${new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`}
                />
              ))}
            </div>
          )}
        </fieldset>

        {(chosenItem || chosenPurchase) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {chosenItem && (
              <label className="space-y-1">
                <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Quantité du lot</span>
                <input type="number" min={1} max={maxQty} value={qty} onChange={(e) => setQty(Math.min(maxQty, Math.max(1, Math.floor(Number(e.target.value) || 1))))} className="field-dark" />
              </label>
            )}
            <label className="space-y-1">
              <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Mise à prix</span>
              <input type="number" min={1} required value={start} onChange={(e) => setStart(e.target.value)} className="field-dark" />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Achat immédiat (facultatif)</span>
              <input type="number" min={Number(start) + 1 || 2} value={buyNow} onChange={(e) => setBuyNow(e.target.value)} placeholder="Aucun" className="field-dark" />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Durée</span>
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="field-dark">
                {DURATIONS.map(([h, l]) => (
                  <option key={h} value={h}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Mot du vendeur (facultatif)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} placeholder="Provenance, état, histoire de l'objet…" className="field-dark" />
            </label>
          </div>
        )}

        <p className="font-body text-xs text-paper/60">
          TVA prélevée sur le prix final. Sans offre, {chosenItem ? "les exemplaires reviennent dans ton stock" : "l'objet reste à toi"}. Tu ne pourras plus retirer la vente une fois une offre posée.
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/20 px-4 py-2 font-mono text-xs uppercase hover:border-white/40">
            Annuler
          </button>
          <button type="submit" disabled={busy || !pick || !(Number(start) >= 1)} className="shop-buy">
            {busy ? "…" : "Ouvrir la vente"}
          </button>
        </div>
      </form>
    </div>
  );
}
