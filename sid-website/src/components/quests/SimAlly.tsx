"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/session";
import { SidIcon } from "@/components/icons/SidIcon";
import { RecruitCardView, RecruitDialog } from "@/components/quests/QuestPower";
import { RANK_LABEL, type AllyStatus, type DexEntry, type GachaSettings } from "@/lib/gacha";
import "@/components/quests/recrutement.css";

/**
 * Allié d'une simulation (Lot 86, migration 0104) : on le recrute avec le
 * même système de chances que les renforts de quête, on l'équipe, et il
 * protège le membre un nombre de fois par jour qui dépend de son rang.
 */

type Kind = "donjons" | "intelligence" | "techniques";

const COPY: Record<Kind, { label: string; noun: string; effect: string }> = {
  donjons: {
    label: "Compagnons",
    noun: "compagnon",
    effect: "Quand tu perds un membre, il peut te protéger de la blessure. Il rejoint aussi les raids de boss que tu rejoins.",
  },
  intelligence: {
    label: "Sages",
    noun: "sage",
    effect: "Après un échec, il peut l'annuler : il ne compte pas dans la limite du jour.",
  },
  techniques: {
    label: "Artisans",
    noun: "artisan",
    effect: "Après un échec, il peut l'annuler : il ne compte pas dans la limite du jour.",
  },
};

export function SimAlly({ kind, reloadKey = 0 }: { kind: Kind; reloadKey?: number }) {
  const supabase = useMemo(() => createClient(), []);
  const copy = COPY[kind];
  const [status, setStatus] = useState<AllyStatus | null>(null);
  const [owned, setOwned] = useState<DexEntry[]>([]);
  const [settings, setSettings] = useState<GachaSettings | null>(null);
  const [balance, setBalance] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [recruiting, setRecruiting] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = await currentUserId();
    const [st, dex, cfg, w] = await Promise.all([
      supabase.rpc("sim_ally_status", { p_kind: kind }),
      supabase.rpc("dex_list", { p_kind: kind }),
      supabase.rpc("gacha_settings"),
      userId ? supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (st.error || dex.error || cfg.error) return setUnavailable(true);
    setUnavailable(false);
    setStatus(st.data as AllyStatus);
    setOwned(((dex.data ?? []) as DexEntry[]).filter((c) => !c.fused));
    setSettings(cfg.data as GachaSettings);
    setBalance(Number((w.data as { balance?: number } | null)?.balance ?? 0));
  }, [supabase, kind]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  async function equip(id: string | null) {
    setError(null);
    const { error: e } = await supabase.rpc("sim_ally_equip", { p_kind: kind, p_entry: id });
    if (e) return setError(e.message);
    setChanging(false);
    setRecruiting(false);
    await load();
  }

  if (unavailable || !settings) return null;
  const ally = status?.ally ?? null;

  return (
    <section className="glass-card space-y-3 p-4" aria-label={`Allié : ${copy.label}`}>
      <div>
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-paper/65">
          <SidIcon name="dice" /> {copy.label}
        </h2>
        <p className="mt-1 font-body text-sm text-paper/70">{copy.effect}</p>
      </div>

      {ally ? (
        <div className="flex flex-wrap items-start gap-4">
          <RecruitCardView card={ally} size="sm" />
          <div className="space-y-1 font-mono text-xs text-paper/75">
            <p>
              {RANK_LABEL[ally.rank]}
              {ally.level ? ` · éveil ${ally.level}/5` : ""} · {status?.chance} % de réussite
            </p>
            <p>
              Protections aujourd&apos;hui : <strong className="text-paper">{status?.left}</strong> / {status?.charges}
            </p>
          </div>
        </div>
      ) : (
        <p className="font-body text-sm text-paper/60">Aucun {copy.noun} équipé.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <button type="button" className="qp-recruit" onClick={() => setRecruiting(true)}>
          <SidIcon name="dice" /> Recruter un {copy.noun}
        </button>
        {owned.length > 0 && (
          <button type="button" className="rd-ghost" onClick={() => setChanging((v) => !v)}>
            {ally ? "Changer" : "Équiper"} ({owned.length})
          </button>
        )}
        {ally && (
          <button type="button" className="rd-ghost" onClick={() => equip(null)}>
            Retirer
          </button>
        )}
      </div>

      {changing && (
        <div className="flex flex-wrap gap-3">
          {owned.map((c) => (
            <div key={c.id} className="space-y-1">
              <RecruitCardView card={c} size="sm" selected={c.equipped} onClick={() => equip(c.id)} />
              <p className="font-mono text-[10px] text-paper/60">
                {c.ally_chance} % · {c.ally_charges}/jour
              </p>
            </div>
          ))}
        </div>
      )}
      {error && <p className="font-mono text-xs text-red-light">{error}</p>}

      {recruiting && (
        <RecruitDialog
          sim={{ kind, label: copy.label }}
          settings={settings}
          balance={balance}
          cards={[]}
          onEquip={(id) => equip(id)}
          onClose={() => setRecruiting(false)}
          onChange={() => void load()}
        />
      )}
    </section>
  );
}
