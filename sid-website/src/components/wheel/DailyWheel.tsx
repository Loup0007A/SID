"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTuto } from "@/components/tuto/TutoProvider";
import { StreakMeter, WheelPanel } from "@/components/wheel/Wheel";
import type { WheelStatus } from "@/types/wheel";

/**
 * Accueil : la roue s'ouvre d'elle-même au premier passage de la journée
 * (pas pendant la visite guidée). « Plus tard » la referme jusqu'au
 * lendemain ; elle reste accessible depuis « À faire » et sa page.
 */

const key = () => `sid-wheel-later-${new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" })}`;

export function useWheelAvailable() {
  const supabase = useMemo(() => createClient(), []);
  const [st, setSt] = useState<WheelStatus | null>(null);
  const reload = useCallback(() => {
    supabase.rpc("wheel_status").then(({ data, error }) => !error && data && setSt(data as WheelStatus));
  }, [supabase]);
  useEffect(() => {
    reload();
  }, [reload]);
  return [st, reload] as const;
}

export function DailyWheel({ status, onSpun }: { status: WheelStatus | null; onSpun?: () => void }) {
  const tuto = useTuto();
  const [open, setOpen] = useState(false);
  const [spun, setSpun] = useState(false);
  const spunRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const busyTour = !!tuto?.tour || !!tuto?.briefingOpen;

  useEffect(() => {
    if (!status || !status.enabled || !status.active || !status.available || status.prizes.length === 0 || busyTour) return;
    try {
      if (localStorage.getItem(key())) return;
    } catch {
      /* stockage indisponible : on ouvre quand même */
    }
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [status, busyTour]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    try {
      localStorage.setItem(key(), "1");
    } catch {
      /* rien */
    }
    setOpen(false);
    if (spunRef.current) onSpun?.();
  }

  if (!open || !status) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-wheel-title"
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-h-[100dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="daily-wheel-title" className="font-display text-xl uppercase tracking-wide text-red">
              Roue du jour
            </h2>
            <p className="font-body text-xs text-paper/60">Un tour offert pour ta visite d&apos;aujourd&apos;hui.</p>
          </div>
          <button ref={closeRef} type="button" onClick={close} className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 font-mono text-xs uppercase text-paper/70 hover:bg-white/10">
            {spun ? "Fermer" : "Plus tard"}
          </button>
        </div>
        <div className="space-y-4">
          <StreakMeter streak={status.streak} cap={status.cap} />
          <WheelPanel
            status={status}
            onSpun={() => {
              spunRef.current = true;
              setSpun(true);
            }}
          />
          <p className="text-center">
            <Link href="/dashboard/roue" scroll={false} onClick={close} className="font-mono text-[11px] uppercase text-blue underline-offset-2 hover:underline">
              Voir les chances et l&apos;historique
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
