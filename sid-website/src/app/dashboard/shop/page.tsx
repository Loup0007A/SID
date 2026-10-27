"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/session";
import { loadCurrentUser, can } from "@/lib/permissions";
import { SHOP_EFFECT_LABELS, type ShopItem, type ShopItemEffect, type PermissionKey, type Wallet } from "@/types/database";
import type { ShopItemStats } from "@/types/stats";
import type { Business } from "@/types/business";
import { inputClass, labelClass } from "@/lib/ui";
import { LineChart } from "@/components/LineChart";
import { SidIcon } from "@/components/icons/SidIcon";
import { ShopFrame } from "@/components/shop/ShopFrame";

/**
 * Le Comptoir du S.I.D. (refonte du Lot 56) : vitrine avec recherche,
 * filtres et tri, fiche détaillée (quantité, total, bourse après achat),
 * mes achats, mes objets en vente, et création avec aperçu en direct.
 */

type Tab = "vitrine" | "achats" | "ventes" | "nouveau";
type Filter = "tout" | "promo" | "effet" | "rares";
type Sort = "recent" | "prix-asc" | "prix-desc" | "nom";
type Purchase = { id: string; quantity: number; total_price: number; created_at: string; shop_items: { name: string; image_url: string | null; effect: ShopItemEffect | null } | null };

const z = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} z`;

function promoOf(item: ShopItem) {
  const active = item.sale_price != null && item.sale_price < item.price && (!item.sale_ends_at || new Date(item.sale_ends_at) > new Date());
  return active ? { price: item.sale_price!, pct: Math.round((1 - item.sale_price! / item.price) * 100), until: item.sale_ends_at } : null;
}
const priceOf = (item: ShopItem) => promoOf(item)?.price ?? item.price;

export default function ShopPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("vitrine");
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [myItems, setMyItems] = useState<ShopItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [sellers, setSellers] = useState<Record<string, string>>({});
  const [businesses, setBusinesses] = useState<Record<string, string>>({});
  const [myBusinesses, setMyBusinesses] = useState<Business[]>([]);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("tout");
  const [sort, setSort] = useState<Sort>("recent");
  const [open, setOpen] = useState<ShopItem | null>(null);

  const canManage = can(permissions, "manage_shop");

  function say(ok: boolean, text: string) {
    setToast({ ok, text });
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 4500);
  }

  async function refresh() {
    // Les objets épuisés (0, pas « illimité ») ne sont pas en vitrine.
    const { data } = await supabase
      .from("shop_items")
      .select("*")
      .eq("is_active", true)
      .is("hidden_at", null)
      .or("stock.is.null,stock.gt.0")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as ShopItem[];
    setItems(list);
    const sellerIds = Array.from(new Set(list.map((i) => i.created_by).filter(Boolean))) as string[];
    const bizIds = Array.from(new Set(list.map((i) => i.business_id).filter(Boolean))) as string[];
    const [p, b] = await Promise.all([
      sellerIds.length ? supabase.from("profiles").select("id, nickname").in("id", sellerIds) : null,
      bizIds.length ? supabase.from("businesses").select("id, name").in("id", bizIds) : null,
    ]);
    setSellers(Object.fromEntries(((p?.data ?? []) as { id: string; nickname: string }[]).map((r) => [r.id, r.nickname])));
    setBusinesses(Object.fromEntries(((b?.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name])));
  }

  async function refreshMine() {
    const { data } = await supabase.rpc("list_my_shop_items");
    setMyItems(((data ?? []) as ShopItem[]).filter((i) => !i.hidden_at));
  }

  async function refreshPurchases(uid = userId) {
    if (!uid) return;
    const { data } = await supabase
      .from("purchases")
      .select("id, quantity, total_price, created_at, shop_items(name, image_url, effect)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(60);
    setPurchases((data ?? []) as unknown as Purchase[]);
  }

  async function refreshWallet(uid = userId) {
    if (!uid) return;
    const { data } = await supabase.from("wallets").select("*").eq("user_id", uid).single();
    setWallet(data);
  }

  useEffect(() => {
    (async () => {
      const uid = await currentUserId();
      const [{ profile, permissions }, , , , biz] = await Promise.all([
        loadCurrentUser(),
        refresh(),
        uid ? refreshMine() : null,
        uid ? refreshWallet(uid) : null,
        uid ? supabase.rpc("list_my_businesses") : null,
      ]);
      setPermissions(permissions);
      setUserId(profile?.id ?? null);
      setMyBusinesses((biz?.data ?? []) as Business[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "achats" && purchases === null) refreshPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  const sellerLabel = (item: ShopItem) => {
    const biz = item.business_id ? businesses[item.business_id] : null;
    const who = item.created_by ? sellers[item.created_by] : null;
    if (biz) return `${biz}${who ? ` · ${who}` : ""}`;
    return who ?? "le S.I.D.";
  };

  const shown = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    let list = items.filter((i) => !q || i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q));
    if (filter === "promo") list = list.filter((i) => promoOf(i));
    if (filter === "effet") list = list.filter((i) => i.effect);
    if (filter === "rares") list = list.filter((i) => i.stock !== null && i.stock <= 5);
    const by = {
      recent: (a: ShopItem, b: ShopItem) => +new Date(b.created_at) - +new Date(a.created_at),
      "prix-asc": (a: ShopItem, b: ShopItem) => priceOf(a) - priceOf(b),
      "prix-desc": (a: ShopItem, b: ShopItem) => priceOf(b) - priceOf(a),
      nom: (a: ShopItem, b: ShopItem) => a.name.localeCompare(b.name, "fr"),
    }[sort];
    return [...list].sort(by);
  }, [items, query, filter, sort]);

  const counts = useMemo(
    () => ({
      tout: items?.length ?? 0,
      promo: items?.filter((i) => promoOf(i)).length ?? 0,
      effet: items?.filter((i) => i.effect).length ?? 0,
      rares: items?.filter((i) => i.stock !== null && i.stock <= 5).length ?? 0,
    }),
    [items]
  );

  async function buy(item: ShopItem, qty: number) {
    const { error } = await supabase.rpc("purchase_item", { p_item_id: item.id, p_quantity: qty });
    if (error) {
      say(false, error.message);
      return false;
    }
    say(true, `Acheté : ${qty > 1 ? `${qty} × ` : ""}${item.name}, ${z(priceOf(item) * qty)}.`);
    setOpen(null);
    setPurchases(null);
    await Promise.all([refresh(), refreshWallet()]);
    return true;
  }

  async function hideItem(item: ShopItem) {
    if (!confirm(`Supprimer « ${item.name} » ? Il disparaîtra de la vitrine et de ta liste (les achats déjà faits restent).`)) return;
    const { error } = await supabase.from("shop_items").update({ is_active: false, hidden_at: new Date().toISOString() }).eq("id", item.id);
    if (error) return say(false, `Impossible de supprimer l'objet : ${error.message}`);
    say(true, `« ${item.name} » a été supprimé.`);
    setOpen(null);
    refresh();
    refreshMine();
  }

  async function withdraw(item: ShopItem) {
    if (!confirm(`Retirer « ${item.name} » de la vente ?`)) return;
    // Retrait plutôt que suppression : l'historique des achats reste intact.
    const { error } = await supabase.from("shop_items").update({ is_active: false }).eq("id", item.id);
    if (error) return say(false, `Impossible de retirer l'objet : ${error.message}`);
    say(true, `« ${item.name} » est retiré de la vente.`);
    setOpen(null);
    refresh();
    refreshMine();
  }

  const tabs: { key: Tab; label: string; icon: "store" | "receipt" | "tag" | "pen"; count?: number; show: boolean }[] = [
    { key: "vitrine", label: "Vitrine", icon: "store", count: items?.length, show: true },
    { key: "achats", label: "Mes achats", icon: "receipt", show: true },
    { key: "ventes", label: "Mes objets en vente", icon: "tag", count: myItems.length, show: myItems.length > 0 || canManage },
    { key: "nouveau", label: "Nouvel objet", icon: "pen", show: canManage },
  ];

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ En-tête */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">Économie</p>
          <h1 className="font-display text-3xl uppercase tracking-wide">Comptoir du S.I.D.</h1>
          <p className="mt-1 max-w-xl font-body text-sm text-paper/70">Ce que l&apos;état-major et ses marchands mettent en vente. Touche un objet pour le voir en grand.</p>
        </div>
        <Link href="/dashboard/bank" scroll={false} className="glass-card px-5 py-3 text-right transition hover:-translate-y-0.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">Ta bourse</p>
          <p className={`font-display text-2xl ${wallet && wallet.balance < 0 ? "text-red" : "text-blue"}`}>{wallet ? z(wallet.balance) : "…"}</p>
        </Link>
      </header>

      {wallet && wallet.balance < 0 && (
        <p className="rounded-lg border border-red/50 bg-red/10 px-4 py-2 font-body text-sm text-red-light">
          Ton solde est négatif : les achats sont bloqués jusqu&apos;à ce qu&apos;il remonte (Banque → rembourser ton emprunt).
        </p>
      )}

      <nav className="shop-tabs" aria-label="Rubriques du comptoir">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`shop-tab ${tab === t.key ? "is-on" : ""}`} aria-pressed={tab === t.key}>
              <SidIcon name={t.icon} size={15} /> {t.label}
              {t.count != null && t.count > 0 && <span className="shop-tab-count">{t.count}</span>}
            </button>
          ))}
      </nav>

      {/* ------------------------------------------------------------ Vitrine */}
      {tab === "vitrine" && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="shop-search">
              <SidIcon name="magnifier" size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un objet…" aria-label="Chercher un objet" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["tout", "Tout"],
                  ["promo", "En promo"],
                  ["effet", "Avec un effet"],
                  ["rares", "Dernières pièces"],
                ] as [Filter, string][]
              ).map(([k, l]) =>
                k === "tout" || counts[k] > 0 ? (
                  <button key={k} onClick={() => setFilter(k)} className={`shop-chip ${filter === k ? "is-on" : ""}`}>
                    {l} <span className="opacity-60">{counts[k]}</span>
                  </button>
                ) : null
              )}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="shop-sort ml-auto" aria-label="Trier">
              <option value="recent">Nouveautés</option>
              <option value="prix-asc">Prix croissant</option>
              <option value="prix-desc">Prix décroissant</option>
              <option value="nom">Nom</option>
            </select>
          </div>

          {items === null ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
              {[0, 1, 2].map((i) => (
                <div key={i} className="shop-card animate-pulse">
                  <div className="aspect-[4/3] bg-white/5" />
                  <div className="h-24" />
                </div>
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div data-tuto="boutique-vitrine" className="glass-card flex flex-col items-center gap-2 px-6 py-12 text-center">
              <SidIcon name="store" size={40} />
              <p className="font-display text-lg uppercase">{items.length === 0 ? "Le comptoir est vide" : "Rien ne correspond"}</p>
              <p className="max-w-sm font-body text-sm text-paper/60">
                {items.length === 0 ? "Aucun objet en vente pour le moment. Repasse bientôt." : "Essaie un autre mot, ou retire le filtre."}
              </p>
            </div>
          ) : (
            <div data-tuto="boutique-vitrine" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((item) => (
                <ShopCard key={item.id} item={item} seller={sellerLabel(item)} onOpen={() => setOpen(item)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------ Mes achats */}
      {tab === "achats" && (
        <section className="space-y-3">
          {purchases === null ? (
            <p className="font-body text-paper/60">Chargement…</p>
          ) : purchases.length === 0 ? (
            <div className="glass-card px-6 py-10 text-center">
              <p className="font-display text-lg uppercase">Aucun achat pour l&apos;instant</p>
              <button onClick={() => setTab("vitrine")} className="mt-2 font-mono text-xs uppercase text-blue hover:underline">
                Voir la vitrine →
              </button>
            </div>
          ) : (
            <>
              <p className="font-mono text-xs uppercase tracking-wide text-paper/60">
                {purchases.length} achat{purchases.length > 1 ? "s" : ""} · {z(purchases.reduce((s, p) => s + Number(p.total_price), 0))} dépensés
              </p>
              <ul className="glass-card divide-y divide-white/10 overflow-hidden">
                {purchases.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <ShopFrame src={p.shop_items?.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl" pad="p-1" zoom={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display uppercase tracking-wide">{p.shop_items?.name ?? "Objet retiré"}</p>
                      <p className="font-mono text-[11px] text-paper/55">
                        {new Date(p.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                        {p.shop_items?.effect && " · s'utilise depuis une simulation"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg text-blue">{z(Number(p.total_price))}</p>
                      {p.quantity > 1 && <p className="font-mono text-[10px] text-paper/50">× {p.quantity}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------ Mes objets en vente */}
      {tab === "ventes" && (
        <MyListings
          items={myItems}
          onChanged={() => {
            refresh();
            refreshMine();
          }}
          onDelete={hideItem}
          say={say}
          onCreate={canManage ? () => setTab("nouveau") : undefined}
        />
      )}

      {/* ------------------------------------------------------------ Nouvel objet */}
      {tab === "nouveau" && canManage && (
        <NewItemForm
          userId={userId}
          canEffect={can(permissions, "manage_economy")}
          businesses={myBusinesses}
          sellerName={userId ? sellers[userId] ?? "toi" : "toi"}
          say={say}
          onCreated={() => {
            refresh();
            refreshMine();
            setTab("ventes");
          }}
        />
      )}

      {open && (
        <ItemSheet
          item={open}
          seller={sellerLabel(open)}
          balance={wallet?.balance ?? null}
          mine={open.created_by === userId}
          canManage={canManage}
          onClose={() => setOpen(null)}
          onBuy={buy}
          onDelete={hideItem}
          onWithdraw={withdraw}
        />
      )}

      {toast && (
        <div role="status" className={`shop-toast ${toast.ok ? "" : "is-error"}`}>
          <SidIcon name={toast.ok ? "check" : "warning"} size={16} /> {toast.text}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Carte de vitrine
function Badges({ item }: { item: ShopItem }) {
  const promo = promoOf(item);
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-[2] flex flex-col items-start gap-1.5">
      {promo && <span className="shop-badge is-promo">−{promo.pct} %</span>}
      {item.effect && (
        <span className="shop-badge is-effect">
          <SidIcon name="hourglass" size={11} /> Effet
        </span>
      )}
    </div>
  );
}

function StockTag({ item }: { item: ShopItem }) {
  if (item.stock === null) return null;
  return <span className={`shop-badge absolute right-3 top-3 z-[2] ${item.stock <= 5 ? "is-rare" : ""}`}>{item.stock <= 5 ? `Plus que ${item.stock}` : `${item.stock} en stock`}</span>;
}

function PriceTag({ item, big = false }: { item: ShopItem; big?: boolean }) {
  const promo = promoOf(item);
  return (
    <div className="leading-none">
      <span className={`font-display ${big ? "text-4xl" : "text-2xl"} ${promo ? "text-red" : "text-blue"}`}>{z(promo?.price ?? item.price)}</span>
      {promo && (
        <span className="ml-2 font-mono text-xs text-paper/45 line-through" aria-label={`au lieu de ${z(item.price)}`}>
          {z(item.price)}
        </span>
      )}
      {promo?.until && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-red-light/80">
          jusqu&apos;au {new Date(promo.until).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
        </p>
      )}
    </div>
  );
}

function ShopCard({ item, seller, onOpen }: { item: ShopItem; seller: string; onOpen: () => void }) {
  return (
    <article className="shop-card group">
      <button onClick={onOpen} className="relative block w-full text-left" aria-label={`Voir ${item.name}`}>
        <ShopFrame src={item.image_url} alt={item.name} className="aspect-[4/3] w-full" />
        <Badges item={item} />
        <StockTag item={item} />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-display text-lg uppercase leading-tight tracking-wide">{item.name}</h3>
          <p className="font-mono text-[10px] uppercase tracking-wider text-paper/45">par {seller}</p>
        </div>
        {item.description && <p className="line-clamp-2 font-body text-sm text-paper/75">{item.description}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <PriceTag item={item} />
          <button onClick={onOpen} className="shop-buy">
            Acheter
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- Fiche détaillée
function ItemSheet({
  item,
  seller,
  balance,
  mine,
  canManage,
  onClose,
  onBuy,
  onDelete,
  onWithdraw,
}: {
  item: ShopItem;
  seller: string;
  balance: number | null;
  mine: boolean;
  canManage: boolean;
  onClose: () => void;
  onBuy: (item: ShopItem, qty: number) => Promise<boolean>;
  onDelete: (item: ShopItem) => void;
  onWithdraw: (item: ShopItem) => void;
}) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const max = item.stock ?? 99;
  const total = priceOf(item) * qty;
  const after = balance == null ? null : balance - total;
  const short = after != null && after < 0;

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.name}>
      <div className="shop-sheet relative grid w-full max-w-4xl overflow-hidden md:grid-cols-[1.1fr_1fr]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-[3] flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-paper hover:bg-black/60" aria-label="Fermer">
          ✕
        </button>
        <div className="relative">
          <ShopFrame src={item.image_url} alt={item.name} className="aspect-[4/3] w-full sm:aspect-square md:h-full md:aspect-auto md:min-h-[26rem]" pad="p-8" zoom={false} />
          <Badges item={item} />
        </div>
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-6 md:max-h-[85vh]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/50">par {seller}</p>
            <h2 className="font-display text-3xl uppercase leading-tight tracking-wide">{item.name}</h2>
          </div>
          {item.effect && (
            <p className="rounded-xl border border-blue/40 bg-blue/10 px-3 py-2 font-body text-sm text-blue-light">
              <SidIcon name="hourglass" /> <strong>{SHOP_EFFECT_LABELS[item.effect]}.</strong> Chaque exemplaire s&apos;utilise une fois, depuis la page d&apos;une simulation.
            </p>
          )}
          {item.description && <p className="whitespace-pre-line font-body text-[15px] leading-relaxed text-paper/85">{item.description}</p>}

          <div className="mt-auto space-y-4 border-t border-white/10 pt-4">
            <div className="flex items-end justify-between gap-3">
              <PriceTag item={item} big />
              <span className="font-mono text-xs text-paper/55">{item.stock === null ? "Stock illimité" : `${item.stock} en stock`}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase text-paper/60">Quantité</span>
              <div className="shop-qty">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Un de moins">
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={max}
                  value={qty}
                  onChange={(e) => setQty(Math.min(max, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
                  aria-label="Quantité"
                />
                <button onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Un de plus">
                  +
                </button>
              </div>
            </div>

            <dl className="space-y-1 rounded-xl bg-white/5 px-4 py-3 font-mono text-sm">
              <div className="flex justify-between">
                <dt className="text-paper/60">Total</dt>
                <dd className="text-paper">{z(total)}</dd>
              </div>
              {after != null && (
                <div className="flex justify-between">
                  <dt className="text-paper/60">Ta bourse après</dt>
                  <dd className={short ? "text-red" : "text-blue-light"}>{z(after)}</dd>
                </div>
              )}
            </dl>

            <button
              onClick={async () => {
                setBusy(true);
                await onBuy(item, qty);
                setBusy(false);
              }}
              disabled={busy || short || (balance != null && balance < 0) || item.stock === 0}
              className="shop-buy w-full !py-3 !text-base"
            >
              {busy ? "Achat…" : short ? "Pas assez de zénis" : `Acheter${qty > 1 ? ` ${qty} exemplaires` : ""} · ${z(total)}`}
            </button>

            {(mine || canManage) && (
              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                {mine && (
                  <button onClick={() => onDelete(item)} className="font-mono text-[11px] uppercase text-red/80 hover:text-red">
                    <SidIcon name="trash" /> Supprimer mon objet
                  </button>
                )}
                {canManage && !mine && (
                  <button onClick={() => onWithdraw(item)} className="font-mono text-[11px] uppercase text-red/80 hover:text-red">
                    Retirer de la vente
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Mes objets en vente
function MyListings({
  items,
  onChanged,
  onDelete,
  say,
  onCreate,
}: {
  items: ShopItem[];
  onChanged: () => void;
  onDelete: (item: ShopItem) => void;
  say: (ok: boolean, text: string) => void;
  onCreate?: () => void;
}) {
  const supabase = createClient();
  const [edits, setEdits] = useState<Record<string, Partial<ShopItem>>>({});
  const [openStats, setOpenStats] = useState<string | null>(null);
  const [stats, setStats] = useState<ShopItemStats | null>(null);

  const edit = (id: string, patch: Partial<ShopItem>) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  async function save(item: ShopItem) {
    const p = edits[item.id];
    if (!p) return;
    const clean: Record<string, unknown> = {};
    if (p.price !== undefined) clean.price = Number(p.price) || 0;
    if (p.sale_price !== undefined) clean.sale_price = p.sale_price === null ? null : Number(p.sale_price) || null;
    if (p.sale_ends_at !== undefined) clean.sale_ends_at = p.sale_ends_at || null;
    if (p.stock !== undefined) clean.stock = p.stock === null ? null : Math.max(0, Math.floor(Number(p.stock)));
    const { error } = await supabase.from("shop_items").update(clean).eq("id", item.id);
    if (error) return say(false, `Échec de l'enregistrement : ${error.message}`);
    setEdits((e) => ({ ...e, [item.id]: undefined as unknown as Partial<ShopItem> }));
    say(true, `« ${item.name} » mis à jour.`);
    onChanged();
  }

  async function toggle(item: ShopItem) {
    const { error } = await supabase.from("shop_items").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) return say(false, error.message);
    say(true, item.is_active ? `« ${item.name} » est retiré de la vente.` : `« ${item.name} » est de nouveau en vente.`);
    onChanged();
  }

  async function loadStats(id: string) {
    if (openStats === id) {
      setOpenStats(null);
      return;
    }
    setOpenStats(id);
    setStats(null);
    const { data, error } = await supabase.rpc("get_shop_item_stats", { p_item_id: id });
    if (error) say(false, `Statistiques indisponibles : ${error.message}`);
    else setStats(data as ShopItemStats);
  }

  if (items.length === 0) {
    return (
      <div className="glass-card px-6 py-10 text-center">
        <p className="font-display text-lg uppercase">Tu n&apos;as encore rien mis en vente</p>
        {onCreate && (
          <button onClick={onCreate} className="mt-2 font-mono text-xs uppercase text-blue hover:underline">
            Créer un objet →
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const e = edits[item.id];
        const promo = promoOf(item);
        return (
          <li key={item.id} className="glass-card overflow-hidden">
            <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
              <ShopFrame src={item.image_url} alt={item.name} className="aspect-[4/3] w-full shrink-0 rounded-xl md:w-40" pad="p-2" zoom={false} />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg uppercase tracking-wide">{item.name}</h3>
                  <span className={`shop-badge !static ${item.is_active ? "" : "is-off"}`}>{item.is_active ? "En vente" : "Retiré"}</span>
                  {promo && <span className="shop-badge is-promo !static">−{promo.pct} %</span>}
                  {item.stock === 0 && <span className="shop-badge is-rare !static">Épuisé</span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="space-y-1">
                    <span className={labelClass}>Prix</span>
                    <input type="number" min={0} className={inputClass} defaultValue={item.price} onChange={(ev) => edit(item.id, { price: Number(ev.target.value) })} />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>Prix promo</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="aucune"
                      className={inputClass}
                      defaultValue={item.sale_price ?? ""}
                      onChange={(ev) => edit(item.id, { sale_price: ev.target.value === "" ? null : Number(ev.target.value) })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>Fin de la promo</span>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      defaultValue={item.sale_ends_at ? item.sale_ends_at.slice(0, 16) : ""}
                      onChange={(ev) => edit(item.id, { sale_ends_at: ev.target.value ? new Date(ev.target.value).toISOString() : null })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>Stock</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="illimité"
                      className={inputClass}
                      defaultValue={item.stock ?? ""}
                      onChange={(ev) => edit(item.id, { stock: ev.target.value === "" ? null : Number(ev.target.value) })}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => save(item)} disabled={!e} className="rounded-lg bg-blue px-4 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
                    Enregistrer
                  </button>
                  <button onClick={() => toggle(item)} className="rounded-lg border border-white/20 px-4 py-1.5 font-mono text-xs uppercase text-paper/85 hover:border-blue hover:text-blue">
                    {item.is_active ? "Retirer de la vente" : "Remettre en vente"}
                  </button>
                  <button onClick={() => loadStats(item.id)} className="rounded-lg border border-white/20 px-4 py-1.5 font-mono text-xs uppercase text-paper/85 hover:border-blue hover:text-blue">
                    <SidIcon name="chart" /> {openStats === item.id ? "Masquer les ventes" : "Ventes"}
                  </button>
                  <button onClick={() => onDelete(item)} className="ml-auto rounded-lg px-3 py-1.5 font-mono text-xs uppercase text-red/80 hover:text-red">
                    <SidIcon name="trash" /> Supprimer
                  </button>
                </div>
              </div>
            </div>
            {openStats === item.id && (
              <div className="border-t border-white/10 bg-black/10 p-4">
                {!stats ? (
                  <p className="font-body text-sm text-paper/60">Chargement…</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
                    <div className="grid grid-cols-3 gap-2 text-center md:grid-cols-1 md:text-left">
                      {[
                        [stats.quantity_sold, "vendus"],
                        [stats.revenue.toLocaleString("fr-FR") + " z", "rapportés"],
                        [stats.unique_buyers, "acheteurs"],
                      ].map(([v, l]) => (
                        <div key={String(l)}>
                          <p className="font-display text-2xl text-blue-light">{v}</p>
                          <p className="font-mono text-[10px] uppercase text-paper/50">{l}</p>
                        </div>
                      ))}
                    </div>
                    {stats.weekly_sales.length === 0 ? (
                      <p className="self-center font-body text-sm text-paper/50">Pas encore de ventes.</p>
                    ) : (
                      <LineChart
                        labels={stats.weekly_sales.map((w) => `${w.week_start.slice(8, 10)}/${w.week_start.slice(5, 7)}`)}
                        series={[{ name: "Vendus", color: "#8FB3D9", values: stats.weekly_sales.map((w) => w.quantity) }]}
                        zeroBased
                        height={160}
                        formatValue={(n) => `${n} vendu(s)`}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- Nouvel objet
function NewItemForm({
  userId,
  canEffect,
  businesses,
  sellerName,
  say,
  onCreated,
}: {
  userId: string | null;
  canEffect: boolean;
  businesses: Business[];
  sellerName: string;
  say: (ok: boolean, text: string) => void;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({ name: "", description: "", price: "", stock: "", visibility: "members" as "public" | "members", businessId: "", effect: "" as "" | ShopItemEffect });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: item, error } = await supabase
      .from("shop_items")
      .insert({
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price) || 0,
        stock: form.stock ? Number(form.stock) : null,
        visibility: form.visibility,
        business_id: form.businessId || null,
        effect: form.effect || null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) {
      setBusy(false);
      return say(false, `Échec de la création : ${error.message}`);
    }
    if (item && file) {
      const ext = file.name.split(".").pop();
      const path = `${item.id}/image.${ext}`;
      const { error: up } = await supabase.storage.from("shop-items").upload(path, file, { upsert: true });
      if (up) say(false, `Objet créé, mais l'image n'a pas pu être envoyée : ${up.message}`);
      else {
        const { data: pub } = supabase.storage.from("shop-items").getPublicUrl(path);
        await supabase.from("shop_items").update({ image_url: pub.publicUrl }).eq("id", item.id);
      }
    }
    setBusy(false);
    say(true, `« ${form.name.trim()} » est en vente.`);
    onCreated();
  }

  const sample = {
    id: "apercu",
    name: form.name || "Nom de l'objet",
    description: form.description || "La description apparaîtra ici.",
    price: Number(form.price) || 0,
    stock: form.stock ? Number(form.stock) : null,
    image_url: preview,
    effect: form.effect || null,
    sale_price: null,
    sale_ends_at: null,
    created_at: new Date().toISOString(),
  } as unknown as ShopItem;

  return (
    <form onSubmit={create} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="glass-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className={labelClass}>Nom</span>
          <input required maxLength={80} className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className={labelClass}>Description</span>
          <textarea rows={4} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Prix (z)</span>
          <input required type="number" min={0} className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Stock (vide = illimité)</span>
          <input type="number" min={0} className={inputClass} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Visible par</span>
          <select className={inputClass} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as "public" | "members" })}>
            <option value="members">Les membres</option>
            <option value="public">Tout le monde</option>
          </select>
        </label>
        {businesses.length > 0 && (
          <label className="space-y-1">
            <span className={labelClass}>Vendu par</span>
            <select className={inputClass} value={form.businessId} onChange={(e) => setForm({ ...form, businessId: e.target.value })}>
              <option value="">Moi (mon portefeuille)</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (sa trésorerie)
                </option>
              ))}
            </select>
          </label>
        )}
        {canEffect && (
          <label className="space-y-1 sm:col-span-2">
            <span className={labelClass}>Effet (réservé aux admins)</span>
            <select className={inputClass} value={form.effect} onChange={(e) => setForm({ ...form, effect: e.target.value as "" | ShopItemEffect })}>
              <option value="">Aucun (objet simple)</option>
              {(Object.keys(SHOP_EFFECT_LABELS) as ShopItemEffect[]).map((k) => (
                <option key={k} value={k}>
                  {SHOP_EFFECT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="space-y-1 sm:col-span-2">
          <span className={labelClass}>Image</span>
          <label
            className={`shop-drop ${drag ? "is-drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f && f.type.startsWith("image/")) setFile(f);
            }}
          >
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <SidIcon name="camera" size={22} />
            <span className="font-body text-sm">{file ? file.name : "Glisse une image ici, ou touche pour en choisir une"}</span>
            <span className="font-mono text-[10px] uppercase text-paper/45">N&apos;importe quel format : l&apos;objet sera montré en entier</span>
          </label>
        </div>
        <button type="submit" disabled={busy} className="rounded-lg bg-red py-2.5 font-display uppercase tracking-wide text-ink hover:bg-red-light disabled:opacity-50 sm:col-span-2">
          {busy ? "Mise en vente…" : "Mettre en vente"}
        </button>
      </div>
      <div className="space-y-2 self-start lg:sticky lg:top-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/50">Aperçu en vitrine</p>
        <div className="pointer-events-none">
          <ShopCard item={sample} seller={businesses.find((b) => b.id === form.businessId)?.name ?? sellerName} onOpen={() => undefined} />
        </div>
      </div>
    </form>
  );
}
