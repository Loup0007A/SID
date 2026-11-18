"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";

/**
 * Onglets d'une page d'administration (même rendu que Économie). L'onglet
 * actif suit l'ancre de l'adresse (#sanctions…), la barre défile sur mobile
 * et garde l'onglet actif visible. Tous les panneaux restent montés : le
 * changement d'onglet est instantané.
 */

export type AdminTab = { key: string; label: string; icon: IconName; badge?: number };

export function useAdminTab(tabs: AdminTab[], fallback: string) {
  const [tab, setTab] = useState(fallback);

  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.slice(1);
      if (tabs.some((t) => t.key === h)) setTab(h);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.map((t) => t.key).join()]);

  function go(key: string) {
    setTab(key);
    history.replaceState(null, "", `#${key}`);
  }
  return [tab, go] as const;
}

export function AdminTabBar({ tabs, tab, onChange, label }: { tabs: AdminTab[]; tab: string; onChange: (key: string) => void; label: string }) {
  useEffect(() => {
    const center = () => {
      const el = document.getElementById(`tab-${tab}`);
      const bar = el?.parentElement;
      if (el && bar) bar.scrollLeft = el.offsetLeft - bar.clientWidth / 2 + el.clientWidth / 2;
    };
    center();
    document.fonts?.ready.then(center);
  }, [tab]);

  return (
    <div
      role="tablist"
      aria-label={label}
      className="scroll-fade relative -mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          id={`tab-${t.key}`}
          aria-selected={tab === t.key}
          aria-controls={`panel-${t.key}`}
          onClick={() => onChange(t.key)}
          className={clsx(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 font-mono text-xs uppercase",
            tab === t.key ? "border-red text-paper" : "border-transparent text-paper/55 hover:text-paper"
          )}
        >
          <SidIcon name={t.icon} size={14} />
          {t.label}
          {!!t.badge && <span className="rounded-full bg-yellow-400/20 px-1.5 font-mono text-[10px] text-yellow-300">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function AdminPanel({ id, tab, children }: { id: string; tab: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={tab !== id} className="space-y-8">
      {children}
    </div>
  );
}
