"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { NAV_ENTRIES, NAV_GROUPS, canHideTab } from "@/lib/navigation";
import { BRAND, brandFromConfig, setBrand } from "@/lib/brand";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Modération → Sites et rubriques (Lot 77, migration 0094) : quelles pages du
 * site principal sont présentes. Une rubrique masquée disparaît des menus, de
 * l'accueil, de la recherche et des épingles ; sa page affiche « Rubrique
 * fermée » aux membres. L'équipe la voit encore, avec un bandeau.
 *
 * Lot 78 (migration 0095) : la Cartographie et le Wiki s'ouvrent ou se
 * ferment d'ici aussi.
 */

type Sites = { map: boolean; wiki: boolean };

const SITES: { key: keyof Sites; label: string; description: string; icon: "map" | "book" }[] = [
  { key: "map", label: "Cartographie", description: "Le monde, les villes, les routes, les montures", icon: "map" },
  { key: "wiki", label: "Wiki", description: "Les fiches : lieux, armes, monstres, objets, skills", icon: "book" },
];

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
  const [savedSites, setSavedSites] = useState<Sites | null>(null);
  const [sites, setSites] = useState<Sites>({ map: true, wiki: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    supabase.rpc("public_config").then(({ data, error }) => {
      if (error) return setMissing(true);
      const b = brandFromConfig(data as Record<string, unknown>);
      setSaved(b.hiddenTabs);
      setHidden(new Set(b.hiddenTabs));
      setSavedSites(b.sites);
      setSites(b.sites);
    });
  }, [supabase]);

  if (missing) {
    return (
      <p className="font-body text-sm text-paper/60">
        Lance la migration <code className="font-mono text-xs">0094_configuration_site.sql</code>.
      </p>
    );
  }
  if (!saved || !savedSites) return <p className="font-body text-sm text-paper/60">Chargement…</p>;

  const tabsDirty = saved.length !== hidden.size || saved.some((k) => !hidden.has(k));
  const sitesDirty = sites.map !== savedSites.map || sites.wiki !== savedSites.wiki;
  const dirty = tabsDirty || sitesDirty;
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
    let list = saved!;
    if (tabsDirty) {
      const { data, error } = await supabase.rpc("site_tabs_set", { p_hidden: [...hidden] });
      if (error) {
        setBusy(false);
        return setMsg({ ok: false, text: error.message });
      }
      list = (data ?? []) as string[];
      setSaved(list);
    }
    if (sitesDirty) {
      const { error } = await supabase.rpc("sites_set", { p_map: sites.map, p_wiki: sites.wiki });
      if (error) {
        setBusy(false);
        return setMsg({ ok: false, text: /sites_set/.test(error.message) ? "Lance la migration 0095_sites_simulations.sql." : error.message });
      }
      setSavedSites(sites);
    }
    setBusy(false);
    setBrand({ ...BRAND, hiddenTabs: list, sites });
    // Le serveur garde la configuration 5 minutes : on la lui fait relire.
    fetch("/api/config/revalidate", { method: "POST" }).catch(() => undefined);
    const closed = SITES.filter((x) => !sites[x.key]).map((x) => x.label);
    setMsg({
      ok: true,
      text: [
        list.length ? `${list.length} rubrique${list.length > 1 ? "s" : ""} masquée${list.length > 1 ? "s" : ""}` : "Toutes les rubriques sont présentes",
        closed.length ? `fermé : ${closed.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" · ") + ".",
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-paper/55">Sites</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SITES.map((x) => {
            const off = !sites[x.key];
            return (
              <li key={x.key}>
                <label
                  className={clsx(
                    "glass-card flex cursor-pointer items-start gap-3 p-3 transition",
                    off ? "border-red/40 opacity-70" : "hover:border-white/25",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={!off}
                    onChange={() => setSites((v) => ({ ...v, [x.key]: !v[x.key] }))}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#5fdc8a]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-display uppercase text-paper">
                      <SidIcon name={x.icon} size={15} /> {x.label}
                      <span className={clsx("ml-auto shrink-0 font-mono text-[10px]", off ? "text-red-light" : "text-green-300")}>{off ? "fermé" : "ouvert"}</span>
                    </span>
                    <span className="block font-body text-xs text-paper/55">{x.description}</span>
                    {off && (
                      <span className="block font-mono text-[10px] text-[#f0c27a]">
                        Les membres y voient « Site fermé », l&apos;équipe y entre encore. Plus de lien depuis le Dossier Central.
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
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
          <button
            type="button"
            onClick={() => {
              setHidden(new Set(saved));
              setSites(savedSites);
            }}
            className="font-mono text-xs uppercase text-paper/55 hover:text-paper"
          >
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
