"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Wallet } from "@/types/database";

const inputClass = "w-full border border-paper-dark bg-paper px-3 py-2 font-body text-ink outline-none focus:border-olive text-sm";

export default function EconomyAdminPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<Profile[]>([]);
  const [wallets, setWallets] = useState<Map<string, Wallet>>(new Map());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function refresh() {
    const [{ data: m }, { data: w }] = await Promise.all([
      supabase.from("profiles").select("*").eq("status", "active").order("nickname"),
      supabase.from("wallets").select("*"),
    ]);
    setMembers(m ?? []);
    setWallets(new Map((w ?? []).map((x) => [x.user_id, x])));
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function adjust(userId: string) {
    const amount = Number(amounts[userId]);
    if (!amount) return;
    await supabase.rpc("adjust_wallet", { p_user_id: userId, p_amount: amount, p_reason: reasons[userId] ?? "Ajustement manuel" });
    setAmounts((a) => ({ ...a, [userId]: "" }));
    setReasons((r) => ({ ...r, [userId]: "" }));
    refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-brass">Économie de la S.I.D.</h1>

      <div className="space-y-3">
        {members.map((m) => (
          <div key={m.id} className="dossier-card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[10rem]">
              <p className="font-display uppercase">{m.nickname}</p>
              <p className="font-mono text-xs text-olive">{(wallets.get(m.id)?.balance ?? 0).toLocaleString("fr-FR")} Cr.</p>
            </div>
            <input
              type="number"
              placeholder="Montant (+/-)"
              className={`${inputClass} w-32`}
              value={amounts[m.id] ?? ""}
              onChange={(e) => setAmounts((a) => ({ ...a, [m.id]: e.target.value }))}
            />
            <input
              placeholder="Raison"
              className={`${inputClass} flex-1`}
              value={reasons[m.id] ?? ""}
              onChange={(e) => setReasons((r) => ({ ...r, [m.id]: e.target.value }))}
            />
            <button onClick={() => adjust(m.id)} className="bg-brass px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-brass-light">
              Appliquer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
