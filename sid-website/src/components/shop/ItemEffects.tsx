"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShopItemEffect } from "@/types/database";
import { SidIcon } from "@/components/icons/SidIcon";
import { BRAND } from "@/lib/brand";
import { SHOP_EFFECTS } from "@/lib/shopEffects";

/**
 * « Tes objets à effet » (Lot 84), en tête de « Mes achats » : chaque
 * exemplaire acheté, offert ou gagné dans une boîte s'utilise ici, une fois.
 */

type Owned = { effect: ShopItemEffect; power: number; quantity: number };

export function ItemEffectsPanel({ say, refreshKey }: { say: (ok: boolean, text: string) => void; refreshKey: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<Owned[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mapLink, setMapLink] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_consumables");
    if (!error) return setList(((data ?? []) as Owned[]).filter((o) => SHOP_EFFECTS[o.effect]));
    // Avant la migration 0101 : seulement la réinitialisation des délais.
    const { data: old } = await supabase.from("member_consumables").select("effect, quantity").gt("quantity", 0);
    setList(((old ?? []) as Owned[]).map((o) => ({ ...o, power: 0 })).filter((o) => SHOP_EFFECTS[o.effect]));
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function use(o: Owned) {
    const key = `${o.effect}:${o.power}`;
    setBusy(key);
    const { data, error } = await supabase.rpc("use_item_effect", { p_effect: o.effect, p_power: o.power });
    setBusy(null);
    if (error) return say(false, /use_item_effect/.test(error.message) ? "Objets à effet indisponibles : la migration 0101 doit être lancée." : error.message);
    say(true, (data as { message: string }).message);
    if (o.effect === "envers_key") setMapLink(true);
    load();
  }

  if (!list || list.length === 0) return null;
  return (
    <section className="glass-card space-y-3 p-4" aria-labelledby="effets-titre">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="effets-titre" className="font-display text-lg uppercase tracking-wide">
          Tes objets à effet
        </h2>
        <p className="font-mono text-[10px] uppercase text-paper/60">Chaque exemplaire s&apos;utilise une fois</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((o) => {
          const info = SHOP_EFFECTS[o.effect];
          const key = `${o.effect}:${o.power}`;
          return (
            <li key={key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <SidIcon name={info.icon} size={30} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm uppercase tracking-wide">
                  {info.label}
                  {info.value && <span className="ml-1 text-blue-light">{info.value.unit(o.power)}</span>}
                  <span className="ml-2 font-mono text-xs normal-case text-paper/60">× {o.quantity}</span>
                </p>
                <p className="font-body text-xs leading-snug text-paper/70">{info.describe(o.power)}</p>
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => use(o)}
                className="shrink-0 rounded-lg bg-blue px-3 py-1.5 font-mono text-[11px] uppercase text-ink hover:bg-blue-light disabled:opacity-50"
              >
                {busy === key ? "…" : "Utiliser"}
              </button>
            </li>
          );
        })}
      </ul>
      {mapLink && (
        <a href={`${BRAND.urls.map}/carte?envers=1`} className="inline-block font-mono text-xs uppercase text-blue hover:underline">
          Aller dans L&apos;Envers →
        </a>
      )}
    </section>
  );
}
