"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { ShopItem, PermissionKey, Wallet } from "@/types/database";
import type { ShopItemStats } from "@/types/stats";
import type { Business } from "@/types/business";
import { inputClass, labelClass } from "@/lib/ui";
import { LineChart } from "@/components/LineChart";

function effectivePrice(item: ShopItem) {
  const promoActive = item.sale_price != null && (!item.sale_ends_at || new Date(item.sale_ends_at) > new Date());
  return promoActive ? item.sale_price! : item.price;
}

export default function ShopPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [myItems, setMyItems] = useState<ShopItem[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showMine, setShowMine] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "0", stock: "", visibility: "members" as "public" | "members", businessId: "" });
  const [myBusinesses, setMyBusinesses] = useState<Business[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<ShopItem>>>({});

  // Statistiques par objet
  const [openStatsId, setOpenStatsId] = useState<string | null>(null);
  const [stats, setStats] = useState<ShopItemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  async function refresh() {
    // Les objets en rupture de stock (0, mais pas "illimité" = null) sont
    // masqués de la vitrine publique.
    const { data } = await supabase
      .from("shop_items")
      .select("*")
      .eq("is_active", true)
      .or("stock.is.null,stock.gt.0")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }

  async function refreshMine() {
    const { data } = await supabase.rpc("list_my_shop_items");
    setMyItems((data ?? []) as ShopItem[]);
  }

  useEffect(() => {
    (async () => {
      const { profile, permissions } = await loadCurrentUser();
      setPermissions(permissions);
      setUserId(profile?.id ?? null);
      await refresh();
      if (profile) {
        await refreshMine();
        const { data: w } = await supabase.from("wallets").select("*").eq("user_id", profile.id).single();
        setWallet(w);
        const { data: biz } = await supabase.rpc("list_my_businesses");
        setMyBusinesses((biz ?? []) as Business[]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBuy(itemId: string) {
    setMessage(null);
    const { error } = await supabase.rpc("purchase_item", { p_item_id: itemId, p_quantity: 1 });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Achat confirmé !");
    refresh();
    if (userId) {
      const { data: w } = await supabase.from("wallets").select("*").eq("user_id", userId).single();
      setWallet(w);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const { data: item, error } = await supabase
      .from("shop_items")
      .insert({
        name: form.name,
        description: form.description,
        price: Number(form.price) || 0,
        stock: form.stock ? Number(form.stock) : null,
        visibility: form.visibility,
        business_id: form.businessId || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      setMessage(`Échec de la création : ${error.message}`);
      return;
    }

    if (item && imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${item.id}/image.${ext}`;
      const { error: uploadError } = await supabase.storage.from("shop-items").upload(path, imageFile, { upsert: true });
      if (uploadError) {
        setMessage(`Objet créé, mais l'image n'a pas pu être envoyée : ${uploadError.message}`);
      } else {
        const { data: pub } = supabase.storage.from("shop-items").getPublicUrl(path);
        await supabase.from("shop_items").update({ image_url: pub.publicUrl }).eq("id", item.id);
      }
    }

    setShowForm(false);
    setForm({ name: "", description: "", price: "0", stock: "", visibility: "members", businessId: "" });
    setImageFile(null);
    refresh();
    refreshMine();
  }

  async function deleteItem(id: string) {
    if (!confirm("Retirer définitivement cet objet de la boutique ?")) return;
    // Désactivation plutôt que suppression physique : un objet déjà acheté
    // par quelqu'un ne peut pas être supprimé sans casser son historique
    // d'achat, donc on le retire juste de la vente.
    const { error } = await supabase.from("shop_items").update({ is_active: false }).eq("id", id);
    if (error) {
      setMessage(`Impossible de retirer l'objet : ${error.message}`);
      return;
    }
    refresh();
    refreshMine();
  }

  function updateEdit(id: string, patch: Partial<ShopItem>) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  }

  async function toggleActive(item: ShopItem) {
    const { error } = await supabase.from("shop_items").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) {
      setMessage(`Impossible de changer le statut de vente : ${error.message}`);
      return;
    }
    refresh();
    refreshMine();
  }

  async function saveListing(item: ShopItem) {
    const patch = edits[item.id];
    if (!patch) return;
    const cleanPatch: Record<string, unknown> = {};
    if (patch.price !== undefined) cleanPatch.price = Number(patch.price) || 0;
    if (patch.sale_price !== undefined) cleanPatch.sale_price = patch.sale_price === null ? null : Number(patch.sale_price) || null;
    if (patch.sale_ends_at !== undefined) cleanPatch.sale_ends_at = patch.sale_ends_at || null;

    const { error } = await supabase.from("shop_items").update(cleanPatch).eq("id", item.id);
    if (error) {
      setMessage(`Échec de l'enregistrement : ${error.message}`);
      return;
    }
    setMessage("Fiche de vente mise à jour.");
    refresh();
    refreshMine();
  }

  async function toggleStats(itemId: string) {
    if (openStatsId === itemId) {
      setOpenStatsId(null);
      setStats(null);
      return;
    }
    setOpenStatsId(itemId);
    setStatsLoading(true);
    setStats(null);
    const { data, error } = await supabase.rpc("get_shop_item_stats", { p_item_id: itemId });
    setStatsLoading(false);
    if (error) {
      setMessage(`Impossible de charger les statistiques : ${error.message}`);
      return;
    }
    setStats(data as ShopItemStats);
  }

  const canManage = can(permissions, "manage_shop");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-red">Comptoir du S.I.D.</h1>
          {wallet && <p className="font-mono text-sm text-blue">Solde : {wallet.balance.toLocaleString("fr-FR")} Cr.</p>}
        </div>
        <div className="flex gap-2">
          {myItems.length > 0 && (
            <button onClick={() => setShowMine((s) => !s)} className="rounded-lg border border-blue px-4 py-2 font-display text-sm uppercase text-blue hover:bg-blue hover:text-ink">
              {showMine ? "Vitrine" : "Mes objets en vente"}
            </button>
          )}
          {canManage && (
            <button onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light">
              {showForm ? "Annuler" : "Nouvel objet"}
            </button>
          )}
        </div>
      </div>

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="glass-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Nom</label>
            <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Description</label>
            <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Prix</label>
            <input type="number" min={0} className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Stock (vide = illimité)</label>
            <input type="number" min={0} className={inputClass} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Visibilité</label>
            <select className={inputClass} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as "public" | "members" })}>
              <option value="members">Membres</option>
              <option value="public">Publique</option>
            </select>
          </div>
          {myBusinesses.length > 0 && (
            <div className="space-y-1 sm:col-span-2">
              <label className={labelClass}>Rattacher à une entreprise (optionnel)</label>
              <select className={inputClass} value={form.businessId} onChange={(e) => setForm({ ...form, businessId: e.target.value })}>
                <option value="">— Vente personnelle —</option>
                {myBusinesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <p className="font-mono text-[10px] text-paper/50">Si rattaché, le produit des ventes ira dans la trésorerie de l&apos;entreprise plutôt que ton portefeuille.</p>
            </div>
          )}
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="w-full font-body text-sm text-paper/80"
            />
          </div>
          <button type="submit" className="rounded-lg sm:col-span-2 bg-blue py-2 font-display uppercase text-ink hover:bg-blue-light">
            Ajouter au comptoir
          </button>
        </form>
      )}

      {showMine ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {myItems.map((item) => {
            const edit = edits[item.id] ?? {};
            return (
              <div key={item.id} className="glass-card flex flex-col gap-2 overflow-hidden p-4">
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.name} className="-mx-4 -mt-4 h-36 w-[calc(100%+2rem)] object-cover" />
                )}
                <h3 className="font-display text-lg uppercase">{item.name}</h3>
                <span className={`font-mono text-[10px] uppercase ${item.is_active ? "text-blue-light" : "text-red"}`}>
                  {item.is_active ? "En vente" : "Retiré de la vente"}
                </span>

                <div className="space-y-1">
                  <label className={labelClass}>Prix</label>
                  <input
                    type="number" min={0} className={inputClass}
                    defaultValue={item.price}
                    onChange={(e) => updateEdit(item.id, { price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Prix promo (vide = aucune promo)</label>
                  <input
                    type="number" min={0} className={inputClass}
                    defaultValue={item.sale_price ?? ""}
                    onChange={(e) => updateEdit(item.id, { sale_price: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Fin de la promo (vide = sans limite)</label>
                  <input
                    type="datetime-local" className={inputClass}
                    defaultValue={item.sale_ends_at ? item.sale_ends_at.slice(0, 16) : ""}
                    onChange={(e) => updateEdit(item.id, { sale_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => saveListing(item)}
                    disabled={!edits[item.id]}
                    className="rounded-lg flex-1 border border-blue py-1 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40"
                  >
                    Enregistrer
                  </button>
                  <button
                    onClick={() => toggleActive(item)}
                    className="rounded-lg flex-1 border border-red py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink"
                  >
                    {item.is_active ? "Retirer de la vente" : "Remettre en vente"}
                  </button>
                </div>

                <button
                  onClick={() => toggleStats(item.id)}
                  className="rounded-lg w-full border border-paper/30 py-1 font-mono text-xs uppercase text-paper hover:bg-paper hover:text-ink"
                >
                  {openStatsId === item.id ? "Masquer les statistiques" : "📊 Statistiques de vente"}
                </button>

                {openStatsId === item.id && (
                  <div className="glass-card space-y-3 p-3">
                    {statsLoading ? (
                      <p className="font-body text-xs text-paper/60">Chargement…</p>
                    ) : stats ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="font-display text-lg text-blue-light">{stats.quantity_sold}</p>
                            <p className="font-mono text-[9px] uppercase text-paper/50">Vendus</p>
                          </div>
                          <div>
                            <p className="font-display text-lg text-blue-light">{stats.revenue.toLocaleString("fr-FR")}</p>
                            <p className="font-mono text-[9px] uppercase text-paper/50">Cr. générés</p>
                          </div>
                          <div>
                            <p className="font-display text-lg text-blue-light">{stats.unique_buyers}</p>
                            <p className="font-mono text-[9px] uppercase text-paper/50">Acheteurs</p>
                          </div>
                        </div>

                        {stats.weekly_sales.length === 0 ? (
                          <p className="text-center font-body text-xs text-paper/50">Pas encore de ventes.</p>
                        ) : (
                          <div>
                            <p className="mb-1 font-mono text-[9px] uppercase text-paper/50">Ventes (8 dernières semaines)</p>
                            <LineChart
                              labels={stats.weekly_sales.map((w) => `${w.week_start.slice(8, 10)}/${w.week_start.slice(5, 7)}`)}
                              series={[{ name: "Vendus", color: "#8FB3D9", values: stats.weekly_sales.map((w) => w.quantity) }]}
                              zeroBased
                              height={170}
                              formatValue={(n) => `${n} vendu(s)`}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="font-body text-xs text-red">Impossible de charger les statistiques.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {myItems.length === 0 && <p className="font-body text-paper/60">Tu n&apos;as encore créé aucun objet.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const price = effectivePrice(item);
            const onPromo = price !== item.price;
            return (
              <div key={item.id} className="glass-card flex flex-col gap-2 overflow-hidden p-4">
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.name} className="-mx-4 -mt-4 h-36 w-[calc(100%+2rem)] object-cover" />
                )}
                <h3 className="font-display text-lg uppercase">{item.name}</h3>
                {item.description && <p className="font-body text-sm text-paper/80">{item.description}</p>}
                <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-2 font-mono text-sm">
                  <span className="font-semibold text-blue">
                    {price.toLocaleString("fr-FR")} Cr.
                    {onPromo && <span className="ml-2 text-paper/50 line-through">{item.price.toLocaleString("fr-FR")} Cr.</span>}
                  </span>
                  <span className="text-paper/60">{item.stock === null ? "Illimité" : `${item.stock} en stock`}</span>
                </div>
                <button
                  onClick={() => handleBuy(item.id)}
                  disabled={item.stock === 0}
                  className="rounded-lg border border-red py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
                >
                  Acheter
                </button>
                {canManage && (
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="rounded-lg border border-red/50 py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink"
                  >
                    Retirer de la vente
                  </button>
                )}
              </div>
            );
          })}
          {items.length === 0 && <p className="font-body text-paper/60">Aucun objet en vente pour le moment.</p>}
        </div>
      )}
    </div>
  );
}
