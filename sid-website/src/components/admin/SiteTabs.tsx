"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { NAV_ENTRIES, NAV_GROUPS, canHideTab } from "@/lib/navigation";
import { BRAND, brandFromConfig, setBrand } from "@/lib/brand";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Modération → Rubriques du site (Lot 77, migration 0094) : quelles pages du
 * site principal sont présentes. Une rubrique masquée disparaît des menus, de
 * l'accueil, de la recherche et des épingles ; sa page affiche « Rubrique
 * fermée » aux membres. L'équipe la voit encore, avec un bandeau.
 */

// Ce qui disparaît aussi ailleurs quand la rubrique est masquée.
const ALSO: Record<string, string> = {
  titles: "plus de fenêtre « titre débloqué »",
  roue: "plus d'ouverture automatique sur l'accueil",
  polls: "plus de sondage mis en avant sur l'accueil",
  quests: "plus de missions en cours sur l'accueil",
  map: "plus de lien vers la Cartographie dans la recherche",
};

export function SiteTabs() {
  const supabase = useMemo(() => createClient(), []);
  const [saved, setSaved] = useState<string[] | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    supabase.rpc("public_config").then(({ data, error }) => {
      if (error) return setMissing(true);
      const b = brandFromConfig(data as Record<string, unknown>);
      setSaved(b.hiddenTabs);
      setHidden(new Set(b.hiddenTabs));
    });
  }, [supabase]);

  if (missing) {
    return (
      <p className="font-body text-sm text-paper/60">
        Lance la migration <code className="font-mono text-xs">0094_configuration_site.sql</code>.
      </p>
    );
  }
  if (!saved) return <p className="font-body text-sm text-paper/60">Chargement…</p>;

  const dirty = saved.length !== hidden.size || saved.some((k) => !hidden.has(k));
  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  async function save() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("site_tabs_set", { p_hidden: [...hidden] });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    const list = (data ?? []) as string[];
    setSaved(list);
    setBrand({ ...BRAND, hiddenTabs: list });
    // Le serveur garde la configuration 5 minutes : on la lui fait relire.
    fetch("/api/config/revalidate", { method: "POST" }).catch(() => undefined);
    setMsg({ ok: true, text: list.length ? `${list.length} rubrique${list.length > 1 ? "s" : ""} masquée${list.length > 1 ? "s" : ""}.` : "Toutes les rubriques sont présentes." });
  }

  return (
    <div className="space-y-4">
      {NAV_GROUPS.filter((g) => g.key !== "admin").map((g) => {
        const entries = NAV_ENTRIES.filter((e) => e.group === g.key && canHideTab(e));
        if (!entries.length) return null;
        return (
          <div key={g.key} className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-wide text-paper/55">{g.label}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {entries.map((e) => {
                const off = hidden.has(e.key);
                return (
                  <li key={e.key}>
                    <label
                      className={clsx(
                        "glass-card flex cursor-pointer items-start gap-3 p-3 transition",
                        off ? "border-red/40 opacity-70" : "hover:border-white/25",
                      )}
                    >
                      <input type="checkbox" checked={!off} onChange={() => toggle(e.key)} className="mt-1 h-4 w-4 shrink-0 accent-[#5fdc8a]" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-display uppercase text-paper">
                          <SidIcon name={e.icon} size={15} /> {e.label}
                          <span className={clsx("ml-auto shrink-0 font-mono text-[10px]", off ? "text-red-light" : "text-green-300")}>{off ? "masquée" : "présente"}</span>
                        </span>
                        <span className="block font-body text-xs text-paper/55">{e.description}</span>
                        {ALSO[e.key] && off && <span className="block font-mono text-[10px] text-[#f0c27a]">Aussi : {ALSO[e.key]}.</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={save}
          className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {dirty && (
          <button type="button" onClick={() => setHidden(new Set(saved))} className="font-mono text-xs uppercase text-paper/55 hover:text-paper">
            Annuler
          </button>
        )}
        {msg && <span className={clsx("font-mono text-xs", msg.ok ? "text-green-300" : "text-red")}>{msg.text}</span>}
      </div>
      <p className="font-body text-xs text-paper/50">
        Le dossier, les notifications, les réglages, « Mes données » et l&apos;administration restent toujours présents. Masquer une rubrique ne bloque
        pas ses actions côté serveur : pour cela, utilise « Suspendre une section » juste en dessous.
      </p>
    </div>
  );
}
