"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { ShopItem, PermissionKey, Wallet } from "@/types/database";

const inputClass = "w-full border border-paper-dark bg-paper px-3 py-2 font-body text-ink outline-none focus:border-blue";
const labelClass = "font-mono text-xs uppercase tracking-wide text-paper-text/80";

export default function ShopPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "0", stock: "", visibility: "members" as "public" | "members" });

  async function refresh() {
    const { data } = await supabase.from("shop_items").select("*").eq("is_active", true).order("created_at", { ascending: false });
    setItems(data ?? []);
  }

  useEffect(() => {
    (async () => {
      const { profile, permissions } = await loadCurrentUser();
      setPermissions(permissions);
      setUserId(profile?.id ?? null);
      await refresh();
      if (profile) {
        const { data: w } = await supabase.from("wallets").select("*").eq("user_id", profile.id).single();
        setWallet(w);
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
    await supabase.from("shop_items").insert({
      name: form.name,
      description: form.description,
      price: Number(form.price) || 0,
      stock: form.stock ? Number(form.stock) : null,
      visibility: form.visibility,
      created_by: userId,
    });
    setShowForm(false);
    setForm({ name: "", description: "", price: "0", stock: "", visibility: "members" });
    refresh();
  }

  const canManage = can(permissions, "manage_shop");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-red">Comptoir de la S.I.D.</h1>
          {wallet && <p className="font-mono text-sm text-blue">Solde : {wallet.balance.toLocaleString("fr-FR")} Cr.</p>}
        </div>
        {canManage && (
          <button onClick={() => setShowForm((s) => !s)} className="bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light">
            {showForm ? "Annuler" : "Nouvel objet"}
          </button>
        )}
      </div>

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="dossier-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
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
          <button type="submit" className="sm:col-span-2 bg-blue py-2 font-display uppercase text-paper hover:bg-blue-light">
            Ajouter au comptoir
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="dossier-card flex flex-col gap-2 p-4">
            <h3 className="font-display text-lg uppercase">{item.name}</h3>
            {item.description && <p className="font-body text-sm text-paper-text/80">{item.description}</p>}
            <div className="mt-auto flex items-center justify-between border-t border-paper-dark pt-2 font-mono text-sm">
              <span className="font-semibold text-blue">{item.price.toLocaleString("fr-FR")} Cr.</span>
              <span className="text-paper-text/60">{item.stock === null ? "Illimité" : `${item.stock} en stock`}</span>
            </div>
            <button
              onClick={() => handleBuy(item.id)}
              disabled={item.stock === 0}
              className="border border-red py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
            >
              Acheter
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
