"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import { ShopFrame } from "@/components/shop/ShopFrame";
import "./wishlist.css";

/**
 * Liste de souhaits et cadeaux (Lot 66). Règles : supabase/migrations/0081.
 * La liste d'un membre est visible des autres : c'est ce qui permet de lui
 * offrir un objet qu'il veut vraiment.
 */

export type Member = { id: string; nickname: string; avatar_url?: string | null };

type WishItem = {
  item_id: string;
  name: string;
  image_url: string | null;
  effect: string | null;
  price: number;
  unit_price: number;
  stock: number | null;
  available: boolean;
  added_at: string;
};

const z = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} z`;

/** Cœur « ajouter à mes souhaits ». */
export function WishButton({ on, onClick, name, className = "" }: { on: boolean; onClick: () => void; name: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={on}
      aria-label={on ? `Retirer « ${name} » de mes souhaits` : `Ajouter « ${name} » à mes souhaits`}
      title={on ? "Dans tes souhaits" : "Ajouter à mes souhaits"}
      className={`wish-btn ${on ? "is-on" : ""} ${className}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.4 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.6 0 5.5 3.7 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
      </svg>
    </button>
  );
}

/** Choix du destinataire et du mot, dans la fiche d'un objet. */
export function GiftPanel({
  item,
  qty,
  total,
  short,
  members,
  userId,
  initialTo,
  onCancel,
  onGift,
}: {
  item: { id: string; name: string };
  qty: number;
  total: number;
  short: boolean;
  members: Member[] | null;
  userId: string | null;
  initialTo: string | null;
  onCancel: () => void;
  onGift: (to: Member, message: string) => Promise<boolean>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [to, setTo] = useState(initialTo ?? "");
  const [message, setMessage] = useState("");
  const [wanters, setWanters] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc("wishlist_wanters", { p_item: item.id }).then(({ data }) => {
      setWanters(((data ?? []) as Member[]).map((m) => m.id));
    });
  }, [supabase, item.id]);

  const others = (members ?? []).filter((m) => m.id !== userId);
  const wanting = others.filter((m) => wanters.includes(m.id));
  const rest = others.filter((m) => !wanters.includes(m.id));
  const target = others.find((m) => m.id === to) ?? null;

  return (
    <form
      className="gift-panel space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!target) return;
        setBusy(true);
        await onGift(target, message.trim());
        setBusy(false);
      }}
    >
      <p className="font-display text-lg uppercase tracking-wide">
        <SidIcon name="gift" size={18} /> Offrir
      </p>
      <label className="block space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wide text-paper/70">À qui ?</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} className="field-dark" required>
          <option value="">{members ? "Choisir un membre…" : "Chargement…"}</option>
          {wanting.length > 0 && (
            <optgroup label="Le souhaitent">
              {wanting.map((m) => (
                <option key={m.id} value={m.id}>
                  ♥ {m.nickname}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label={wanting.length ? "Les autres membres" : "Membres"}>
            {rest.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nickname}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wide text-paper/70">Un mot (facultatif)</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 300))} rows={2} className="field-dark" placeholder="Joyeux anniversaire !" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || !target || short} className="shop-buy flex-1 !py-2.5">
          {busy ? "Envoi…" : short ? "Pas assez de zénis" : `Offrir${qty > 1 ? ` ${qty} ×` : ""} · ${z(total)}`}
        </button>
        <button type="button" onClick={onCancel} className="font-mono text-[11px] uppercase text-paper/60 hover:text-paper">
          Annuler
        </button>
      </div>
      {target && <p className="font-mono text-[10px] text-paper/55">{target.nickname} le recevra dans « Mes achats ».</p>}
    </form>
  );
}

/** Onglet « Souhaits » : ma liste, ou celle d'un autre membre (pour lui offrir). */
export function WishlistTab({
  userId,
  members,
  loadMembers,
  wished,
  onToggle,
  onOpen,
}: {
  userId: string | null;
  members: Member[] | null;
  loadMembers: () => void;
  wished: Set<string>;
  onToggle: (item: { id: string; name: string }) => Promise<void> | void;
  onOpen: (itemId: string, giftTo?: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<string>("moi");
  const [list, setList] = useState<WishItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ma liste se recharge quand j'ajoute ou retire un souhait.
  const mineKey = view === "moi" ? Array.from(wished).sort().join(",") : "";
  useEffect(() => {
    let alive = true;
    setList(null);
    supabase.rpc("wishlist_list", { p_user: view === "moi" ? null : view }).then(({ data, error }) => {
      if (!alive) return;
      if (error) setError(error.message.includes("wishlist_list") ? "Liste de souhaits indisponible : la migration 0081 doit être lancée." : error.message);
      setList((data ?? []) as WishItem[]);
    });
    return () => {
      alive = false;
    };
  }, [supabase, view, mineKey]);

  const mine = view === "moi";
  const who = members?.find((m) => m.id === view);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-mono text-xs uppercase text-paper/70">
          Liste de
          <select value={view} onChange={(e) => setView(e.target.value)} className="shop-sort" aria-label="Liste de souhaits de">
            <option value="moi">moi</option>
            {(members ?? [])
              .filter((m) => m.id !== userId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname}
                </option>
              ))}
          </select>
        </label>
        {mine && <p className="font-body text-xs text-paper/60">Visible par les autres membres. Tu es prévenu quand un objet revient en stock ou passe aux enchères.</p>}
      </div>

      {error && <p className="rounded-lg bg-red/10 px-3 py-2 font-mono text-xs text-red">{error}</p>}

      {list === null ? (
        <p className="font-mono text-xs text-paper/60">Chargement…</p>
      ) : list.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-2 px-6 py-10 text-center">
          <SidIcon name="heart" size={36} />
          <p className="font-display text-lg uppercase">{mine ? "Aucun souhait" : `${who?.nickname ?? "Ce membre"} n'a aucun souhait`}</p>
          {mine && <p className="max-w-sm font-body text-sm text-paper/60">Le cœur sur un objet de la vitrine l&apos;ajoute ici.</p>}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((w) => (
            <li key={w.item_id} className={`wish-row ${w.available ? "" : "is-out"}`}>
              <ShopFrame src={w.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl" pad="p-1" zoom={false} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display uppercase tracking-wide">{w.name}</p>
                <p className="font-mono text-[11px] text-paper/65">
                  {z(w.unit_price)}
                  {w.unit_price < w.price && <span className="ml-1 text-red-light line-through opacity-70">{z(w.price)}</span>}
                  {" · "}
                  {w.available ? (w.stock === null ? "en vitrine" : `${w.stock} en stock`) : "épuisé"}
                </p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {w.available && (
                    <button type="button" onClick={() => onOpen(w.item_id, mine ? undefined : view)} className="font-mono text-[11px] uppercase text-blue hover:underline">
                      {mine ? "Voir" : "Offrir"}
                    </button>
                  )}
                  {mine ? (
                    <button type="button" onClick={() => onToggle({ id: w.item_id, name: w.name })} className="font-mono text-[11px] uppercase text-paper/60 hover:text-red">
                      Retirer
                    </button>
                  ) : (
                    !wished.has(w.item_id) && (
                      <button type="button" onClick={() => onToggle({ id: w.item_id, name: w.name })} className="font-mono text-[11px] uppercase text-paper/60 hover:text-paper">
                        ♥ Moi aussi
                      </button>
                    )
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
