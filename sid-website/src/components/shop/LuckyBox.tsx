"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShopItem, ShopItemEffect } from "@/types/database";
import type { Business } from "@/types/business";
import { inputClass, labelClass } from "@/lib/ui";
import { SidIcon } from "@/components/icons/SidIcon";
import { ShopFrame } from "@/components/shop/ShopFrame";
import { SHOP_EFFECTS, effectSummary } from "@/lib/shopEffects";
import "./luckybox.css";

/**
 * Boîtes chanceuses (Lot 84). Le vendeur y range ses propres objets, avec un
 * nombre d'exemplaires pour chacun ; l'acheteur tombe sur un exemplaire au
 * hasard parmi ceux qui restent. Le public ne voit que le nombre de
 * personnes qui l'ont ouverte ; le vendeur voit le contenu restant.
 * Base : shop_box_save, shop_box_open, shop_box_details (migration 0101).
 */

const z = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} z`;
export const isBox = (i: Pick<ShopItem, "kind"> | null | undefined) => i?.kind === "box";
export const openersLabel = (n: number) => (n > 0 ? `${n} personne${n > 1 ? "s l'ont ouverte" : " l'a ouverte"}` : "Personne ne l'a encore ouverte");

type Won = { id: string; name: string; description: string | null; image_url: string | null; effect: ShopItemEffect | null; effect_value: number | null };
type Details = {
  id: string;
  buyers: number;
  opened: number;
  left: number;
  contents: { item_id: string; name: string; image_url: string | null; effect: ShopItemEffect | null; stock: number | null; total: number; left: number; won: number }[];
  draws: { at: string; who: string | null; item: string | null }[];
};

/* ------------------------------------------------------------------ Dessin */

/** Boîte dessinée (vitrine sans photo, ouverture). */
export function LuckyBoxArt({ className = "", open = false }: { className?: string; open?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={`lb-art ${open ? "is-open" : ""} ${className}`} aria-hidden>
      <ellipse cx="60" cy="108" rx="38" ry="6" fill="#000" opacity=".25" />
      <g className="lb-body">
        <rect x="22" y="52" width="76" height="52" rx="6" fill="#ede6d3" stroke="#231c33" strokeWidth="3" />
        <rect x="22" y="52" width="76" height="12" fill="#cfc4a8" opacity=".55" />
        <rect x="53" y="52" width="14" height="52" fill="#d99a9a" stroke="#231c33" strokeWidth="3" />
        <text x="38" y="92" fontFamily="var(--font-display), sans-serif" fontSize="22" fill="#262a38" opacity=".75">?</text>
        <text x="74" y="92" fontFamily="var(--font-display), sans-serif" fontSize="22" fill="#262a38" opacity=".75">?</text>
      </g>
      <g className="lb-lid">
        <rect x="16" y="38" width="88" height="17" rx="5" fill="#f6eedb" stroke="#231c33" strokeWidth="3" />
        <rect x="53" y="38" width="14" height="17" fill="#d99a9a" stroke="#231c33" strokeWidth="3" />
        <path d="M60 38c-6-14-24-16-24-6 0 7 12 7 24 6zM60 38c6-14 24-16 24-6 0 7-12 7-24 6z" fill="#d99a9a" stroke="#231c33" strokeWidth="3" strokeLinejoin="round" />
        <path d="M30 42h20" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
      </g>
    </svg>
  );
}

/* --------------------------------------------------------------- Ouverture */

export function BoxReveal({
  box,
  onClose,
  onOpened,
  onSeeInventory,
  balance,
}: {
  box: ShopItem;
  onClose: () => void;
  onOpened: () => void;
  onSeeInventory: () => void;
  balance: number | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<"shake" | "reveal" | "error">("shake");
  const [won, setWon] = useState<Won | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const price = box.sale_price != null && box.sale_price < box.price && (!box.sale_ends_at || new Date(box.sale_ends_at) > new Date()) ? box.sale_price : box.price;
  const closeRef = useRef<HTMLButtonElement>(null);
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;
  // Chaque tour n'ouvre qu'une boîte, même si l'effet est rejoué.
  const started = useRef(-1);

  const open = useCallback(async () => {
    setPhase("shake");
    setWon(null);
    setError(null);
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const [res] = await Promise.all([supabase.rpc("shop_box_open", { p_box: box.id }), new Promise((r) => setTimeout(r, still ? 200 : 1500))]);
    if (res.error) {
      setError(/shop_box_open/.test(res.error.message) ? "Boîtes indisponibles : la migration 0101 doit être lancée." : res.error.message);
      setPhase("error");
      return;
    }
    setWon((res.data as { item: Won }).item);
    setPhase("reveal");
    onOpenedRef.current();
  }, [supabase, box.id]);

  useEffect(() => {
    if (started.current === round) return;
    started.current = round;
    open();
  }, [open, round]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && phase !== "shake" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, phase]);

  useEffect(() => {
    if (phase !== "shake") closeRef.current?.focus();
  }, [phase]);

  const canAgain = balance == null || balance >= price;
  return (
    <div className="lb-overlay" role="dialog" aria-modal="true" aria-label={`Ouverture : ${box.name}`}>
      <div className="lb-stage">
        {phase === "shake" && (
          <div className="lb-shaking" role="status">
            <LuckyBoxArt className="lb-art-xl is-shaking" />
            <p className="lb-caption">Ouverture de « {box.name} »…</p>
          </div>
        )}
        {phase === "error" && (
          <div className="lb-result">
            <LuckyBoxArt className="lb-art-md" />
            <p className="lb-error">{error}</p>
            <button ref={closeRef} type="button" onClick={onClose} className="lb-btn">
              Fermer
            </button>
          </div>
        )}
        {phase === "reveal" && won && (
          <div className="lb-result">
            <div className="lb-burst" aria-hidden>
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} style={{ ["--a" as string]: `${i * (360 / 14)}deg`, ["--d" as string]: `${(i % 3) * 0.06}s` }} />
              ))}
            </div>
            <p className="lb-kicker">Tu as obtenu</p>
            <div className="lb-prize">
              <ShopFrame src={won.image_url} alt={won.name} className="lb-prize-img" pad="p-3" zoom={false} />
              <p className="lb-prize-name">{won.name}</p>
              {won.effect && (
                <p className="lb-prize-effect">
                  <SidIcon name={SHOP_EFFECTS[won.effect].icon} size={14} /> {SHOP_EFFECTS[won.effect].label} · {effectSummary(won.effect, won.effect_value)}
                </p>
              )}
              {won.description && <p className="lb-prize-desc">{won.description}</p>}
            </div>
            <p className="lb-note">Rangé dans « Mes achats ».</p>
            <div className="lb-actions">
              {canAgain && (
                <button type="button" onClick={() => setRound((r) => r + 1)} className="lb-btn is-main">
                  En ouvrir une autre · {z(price)}
                </button>
              )}
              <button type="button" onClick={onSeeInventory} className="lb-btn">
                Mes achats
              </button>
              <button ref={closeRef} type="button" onClick={onClose} className="lb-btn is-ghost">
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Confection */

type Draft = { name: string; description: string; price: string; visibility: "members" | "public"; businessId: string };

export function BoxEditor({
  box,
  myItems,
  businesses,
  say,
  onSaved,
  onCancel,
  renderPreview,
}: {
  box: ShopItem | null;
  myItems: ShopItem[];
  businesses: Business[];
  say: (ok: boolean, text: string) => void;
  onSaved: (id: string) => void;
  onCancel?: () => void;
  renderPreview?: (sample: ShopItem) => React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<Draft>({
    name: box?.name ?? "",
    description: box?.description ?? "",
    price: box ? String(box.price) : "",
    visibility: box?.visibility ?? "members",
    businessId: box?.business_id ?? "",
  });
  const [lines, setLines] = useState<Record<string, number>>({});
  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(!box);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const sayRef = useRef(say);
  sayRef.current = say;

  // Modification : exemplaires restants de chaque objet (chargés une fois).
  const boxId = box?.id ?? null;
  useEffect(() => {
    if (!boxId) return;
    supabase.rpc("shop_box_details", { p_box: boxId }).then(({ data, error }) => {
      if (error) sayRef.current(false, error.message);
      const d = data as Details | null;
      const left = Object.fromEntries((d?.contents ?? []).filter((c) => c.left > 0).map((c) => [c.item_id, c.left]));
      setLines(left);
      setPlaced(left);
      setLoaded(true);
    });
  }, [boxId, supabase]);

  // Une boîte ne contient que les objets de son vendeur, vendus au même nom.
  const business = box ? box.business_id : form.businessId || null;
  const candidates = useMemo(
    () => myItems.filter((i) => i.kind !== "box" && !i.hidden_at && (i.business_id ?? null) === (business ?? null)).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [myItems, business],
  );
  const maxOf = (i: ShopItem) => (i.stock == null ? 10000 : i.stock + (placed[i.id] ?? 0));
  const total = candidates.reduce((s, i) => s + (lines[i.id] ?? 0), 0);
  const kinds = candidates.filter((i) => (lines[i.id] ?? 0) > 0).length;
  const set = (id: string, n: number, max: number) => setLines((l) => ({ ...l, [id]: Math.max(0, Math.min(max, Math.floor(n) || 0)) }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!box && total < 1) return say(false, "Mets au moins un exemplaire dans la boîte.");
    setBusy(true);
    const { data, error } = await supabase.rpc("shop_box_save", {
      p_box: box?.id ?? null,
      p_name: form.name.trim(),
      p_description: form.description.trim(),
      p_price: Number(form.price) || 0,
      p_visibility: form.visibility,
      p_business: box ? box.business_id : form.businessId || null,
      p_contents: candidates.filter((i) => (lines[i.id] ?? 0) > 0).map((i) => ({ item_id: i.id, quantity: lines[i.id] })),
    });
    if (error) {
      setBusy(false);
      return say(false, /shop_box_save/.test(error.message) ? "Boîtes indisponibles : la migration 0101 doit être lancée." : error.message);
    }
    const id = data as string;
    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${id}/image.${ext}`;
      const { error: up } = await supabase.storage.from("shop-items").upload(path, file, { upsert: true });
      if (up) say(false, `Boîte enregistrée, mais l'image n'a pas pu être envoyée : ${up.message}`);
      else {
        const { data: pub } = supabase.storage.from("shop-items").getPublicUrl(path);
        await supabase.from("shop_items").update({ image_url: `${pub.publicUrl}?v=${Date.now()}` }).eq("id", id);
      }
    }
    setBusy(false);
    say(true, box ? `« ${form.name.trim()} » mise à jour.` : `« ${form.name.trim()} » est en vente.`);
    onSaved(id);
  }

  const sample = {
    ...(box ?? {}),
    id: box?.id ?? "apercu",
    name: form.name || "Nom de la boîte",
    description: form.description || "Ce que l'acheteur peut espérer, sans dire ce qu'il reste.",
    price: Number(form.price) || 0,
    stock: null,
    image_url: preview ?? box?.image_url ?? null,
    effect: null,
    kind: "box",
    box_buyers: box?.box_buyers ?? 0,
    sale_price: box?.sale_price ?? null,
    sale_ends_at: box?.sale_ends_at ?? null,
    created_at: box?.created_at ?? new Date().toISOString(),
  } as ShopItem;

  return (
    <form onSubmit={save} className={renderPreview ? "grid gap-6 lg:grid-cols-[1fr_22rem]" : "space-y-4"}>
      <div className="glass-card space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className={labelClass}>Nom de la boîte</span>
            <input required maxLength={80} className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className={labelClass}>Description</span>
            <textarea rows={3} maxLength={2000} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ce que l'acheteur peut espérer y trouver." />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Prix d&apos;une ouverture (z)</span>
            <input required type="number" min={0} className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Visible par</span>
            <select className={inputClass} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as Draft["visibility"] })}>
              <option value="members">Les membres</option>
              <option value="public">Tout le monde</option>
            </select>
          </label>
          {!box && businesses.length > 0 && (
            <label className="space-y-1 sm:col-span-2">
              <span className={labelClass}>Vendue par</span>
              <select
                className={inputClass}
                value={form.businessId}
                onChange={(e) => {
                  setForm({ ...form, businessId: e.target.value });
                  setLines({});
                }}
              >
                <option value="">Moi (mon portefeuille)</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (sa trésorerie)
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1 sm:col-span-2">
            <span className={labelClass}>Image (facultatif)</span>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full font-body text-sm text-paper/80 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:font-mono file:text-xs file:uppercase file:text-paper" />
          </label>
        </div>

        <fieldset className="space-y-3">
          <legend className={labelClass}>Contenu</legend>
          <p className="font-body text-xs text-paper/65">
            Tes objets{business ? " vendus au nom de cette entreprise" : " vendus à ton nom"}, et combien d&apos;exemplaires de chacun. Les exemplaires mis
            dedans sortent du stock de l&apos;objet et y reviennent si tu les retires. Un objet retiré de la vente peut aller en boîte : il ne s&apos;obtient
            alors que comme ça.
          </p>
          {!loaded ? (
            <p className="font-body text-sm text-paper/60">Chargement du contenu…</p>
          ) : candidates.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 font-body text-sm text-paper/75">
              Aucun objet à mettre dedans. Crée d&apos;abord tes objets (onglet « Objet ») ; tu peux les retirer de la vente pour les réserver à la boîte.
            </p>
          ) : (
            <ul className="lb-pick">
              {candidates.map((i) => {
                const n = lines[i.id] ?? 0;
                const max = maxOf(i);
                return (
                  <li key={i.id} className={n > 0 ? "is-in" : ""}>
                    <ShopFrame src={i.image_url} alt="" className="h-11 w-11 shrink-0 rounded-lg" pad="p-0.5" zoom={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm uppercase tracking-wide">{i.name}</p>
                      <p className="font-mono text-[10px] uppercase text-paper/60">
                        {i.stock == null ? "stock illimité" : `${i.stock} en stock`}
                        {!i.is_active && " · hors vente"}
                        {i.effect && ` · ${SHOP_EFFECTS[i.effect].label}`}
                      </p>
                    </div>
                    <div className="shop-qty !h-9" aria-label={`Exemplaires de ${i.name}`}>
                      <button type="button" onClick={() => set(i.id, n - 1, max)} disabled={n <= 0} aria-label="Un de moins">
                        −
                      </button>
                      <input type="number" min={0} max={max} value={n} onChange={(e) => set(i.id, Number(e.target.value), max)} aria-label={`Exemplaires de ${i.name}`} />
                      <button type="button" onClick={() => set(i.id, n + 1, max)} disabled={n >= max} aria-label="Un de plus">
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="font-mono text-xs text-paper/70">
            {total} exemplaire{total > 1 ? "s" : ""} · {kinds} objet{kinds > 1 ? "s" : ""} différent{kinds > 1 ? "s" : ""}
            {total > 0 && " · chaque exemplaire a la même chance de sortir"}
          </p>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !loaded} className="rounded-lg bg-red px-5 py-2.5 font-display uppercase tracking-wide text-ink hover:bg-red-light disabled:opacity-50">
            {busy ? "Enregistrement…" : box ? "Enregistrer la boîte" : "Mettre la boîte en vente"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-lg border border-white/20 px-4 py-2.5 font-mono text-xs uppercase text-paper/85 hover:border-blue hover:text-blue">
              Annuler
            </button>
          )}
        </div>
      </div>
      {renderPreview && (
        <div className="space-y-2 self-start lg:sticky lg:top-24">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/65">Aperçu en vitrine</p>
          <div className="pointer-events-none">{renderPreview(sample)}</div>
        </div>
      )}
    </form>
  );
}

/* ------------------------------------------------------- Vue du vendeur */

export function BoxSellerPanel({ box, refreshKey }: { box: ShopItem; refreshKey: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState<Details | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showDraws, setShowDraws] = useState(false);

  useEffect(() => {
    supabase.rpc("shop_box_details", { p_box: box.id }).then(({ data, error }) => {
      if (error) setErr(error.message);
      else setD(data as Details);
    });
  }, [supabase, box.id, refreshKey]);

  if (err) return <p className="font-mono text-xs text-red">{err}</p>;
  if (!d) return <p className="font-body text-sm text-paper/60">Chargement du contenu…</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-paper/75">
        <span>
          <strong className="font-display text-base text-blue-light">{d.buyers}</strong> personne{d.buyers > 1 ? "s" : ""}
        </span>
        <span>
          <strong className="font-display text-base text-blue-light">{d.opened}</strong> ouverture{d.opened > 1 ? "s" : ""}
        </span>
        <span>
          <strong className={`font-display text-base ${d.left > 0 ? "text-blue-light" : "text-red"}`}>{d.left}</strong> exemplaire{d.left > 1 ? "s" : ""} restant
          {d.left > 1 ? "s" : ""}
          {d.left === 0 && " · boîte vide, plus en vitrine"}
        </span>
      </div>
      <table className="lb-table">
        <thead>
          <tr>
            <th scope="col">Objet</th>
            <th scope="col">Restants</th>
            <th scope="col">Sortis</th>
            <th scope="col">Chance</th>
          </tr>
        </thead>
        <tbody>
          {d.contents.map((c) => (
            <tr key={c.item_id} className={c.left === 0 ? "is-empty" : ""}>
              <td>
                {c.name}
                {c.effect && <span className="ml-1 text-blue-light">· {SHOP_EFFECTS[c.effect].label}</span>}
              </td>
              <td>
                {c.left} / {c.total}
              </td>
              <td>{c.won}</td>
              <td>{d.left > 0 ? `${Math.round((c.left / d.left) * 1000) / 10} %` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {d.draws.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowDraws((v) => !v)} className="font-mono text-[11px] uppercase text-paper/70 hover:text-blue" aria-expanded={showDraws}>
            {showDraws ? "Masquer les derniers tirages" : `Derniers tirages (${d.draws.length})`}
          </button>
          {showDraws && (
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-paper/75">
              {d.draws.map((r, k) => (
                <li key={k}>
                  {new Date(r.at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {r.who ?? "?"} →{" "}
                  <span className="text-paper">{r.item ?? "objet supprimé"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
