"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidIcon } from "@/components/icons/SidIcon";
import { STEPS, TOUR, resolveText, tipForPath, zenis } from "@/lib/tuto/content";
import { useTuto } from "./TutoProvider";

// ---------------------------------------------------------------- Bouton « ? »
export function TutoHelpButton() {
  const tuto = useTuto();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open]);

  if (!tuto) return null;
  const { data } = tuto;
  const tip = tipForPath(pathname);
  const resumeAt = data && !data.tour_done && data.tour_step > 0 ? data.tour_step : 0;
  const unseen = data && !data.tour_done && !data.briefing_seen;

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-body text-sm text-paper hover:bg-white/10";

  return (
    <div ref={ref} className="relative">
      <button
        data-tuto="aide"
        onClick={() => setOpen((o) => !o)}
        aria-label="Aide et visite guidée"
        aria-expanded={open}
        title="Aide et visite guidée"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 font-display text-base text-paper/80 hover:border-blue hover:text-blue"
      >
        ?
        {unseen && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red shadow-[0_0_0_3px_rgba(38,42,56,0.9)]" />}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/15 bg-[#2a2e3d] p-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75)]" role="menu">
          <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-paper/65">Aide</p>
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              tuto.startTour(resumeAt ? TOUR[resumeAt]?.id : undefined);
            }}
          >
            <SidIcon name="compass" />
            <span className="flex-1">{resumeAt ? `Reprendre la visite (${resumeAt + 1}/${TOUR.length})` : data?.tour_done ? "Refaire la visite guidée" : "Visite guidée"}</span>
          </button>
          {resumeAt > 0 && (
            <button role="menuitem" className={item} onClick={() => (setOpen(false), tuto.startTour())}>
              <SidIcon name="hourglass" /> <span className="flex-1">Recommencer la visite au début</span>
            </button>
          )}
          {tip && (
            <button role="menuitem" className={item} onClick={() => (setOpen(false), tuto.showTip(tip.key))}>
              <SidIcon name="bulb" /> <span className="flex-1">Astuce de cette page</span>
            </button>
          )}
          <Link role="menuitem" href="/dashboard/guide" scroll={false} className={item} onClick={() => setOpen(false)}>
            <SidIcon name="book" />
            <span className="flex-1">Guide du S.I.D.</span>
            {data && (
              <span className="font-mono text-[10px] text-paper/65">
                {data.steps_done}/{STEPS.length}
              </span>
            )}
          </Link>
          <button role="menuitem" className={item} onClick={() => (setOpen(false), tuto.openBriefing())}>
            <SidIcon name="idcard" /> <span className="flex-1">Revoir mon dossier d&apos;intégration</span>
          </button>
          <div className="my-1 border-t border-white/10" />
          <button
            role="menuitemcheckbox"
            aria-checked={!data?.tips_disabled}
            className={item}
            onClick={() => tuto.setTipsDisabled(!data?.tips_disabled)}
          >
            <SidIcon name="bulb" />
            <span className="flex-1 text-sm">Astuces en haut des pages</span>
            <span className={`tuto-switch ${data?.tips_disabled ? "" : "is-on"}`} aria-hidden>
              <span />
            </span>
          </button>
          {!data?.tips_disabled && (
            <button role="menuitem" className={`${item} text-paper/60`} onClick={() => (setOpen(false), tuto.resetTips())}>
              <span className="w-[1.15em]" /> <span className="flex-1 text-xs">Revoir les astuces déjà lues</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Astuce de page
export function TutoPageTip() {
  const tuto = useTuto();
  const pathname = usePathname();
  const tip = tipForPath(pathname);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => setLeaving(false), [pathname]);

  if (!tuto || !tip || !tuto.data || tuto.tour || tuto.briefingOpen) return null;
  const forced = tuto.forcedTip === tip.key;
  if (!forced && (tuto.data.tips_disabled || tuto.data.tips_seen.includes(tip.key))) return null;
  // Les tout nouveaux agents ont d'abord droit à la visite : pas d'astuce par-dessus.
  if (!forced && tuto.data.is_new && !tuto.data.briefing_seen) return null;

  const close = () => {
    setLeaving(true);
    setTimeout(() => tuto.markTip(tip.key), 220);
  };

  return (
    <aside className={`tuto-tip mb-6 ${leaving ? "is-leaving" : ""}`} aria-label={`Astuce : ${tip.title}`}>
      <span className="tuto-tip-tape" aria-hidden />
      <div className="flex items-start gap-3">
        <span className="tuto-icon mt-0.5 shrink-0">
          <SidIcon name={tip.icon} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-text/55">{forced ? "Astuce" : "Première visite"}</p>
          <p className="font-display text-lg uppercase leading-tight tracking-wide text-paper-text">{tip.title}</p>
          <ul className="mt-2 space-y-1">
            {tip.points.map((p, i) => (
              <li key={i} className="flex gap-2 font-body text-[14px] leading-snug text-paper-text/90">
                <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rotate-45 bg-red-dark" aria-hidden />
                <span>{resolveText(p, tuto.numbers, tuto.me.nickname)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={close} className="tuto-btn !py-1.5 !text-xs">
              Compris
            </button>
            {tip.tourFrom && (
              <button
                onClick={() => {
                  tuto.markTip(tip.key);
                  tuto.startTour(tip.tourFrom, true);
                }}
                className="tuto-btn-ghost !py-1.5 !text-xs"
              >
                Me montrer
              </button>
            )}
            {!tuto.data.tips_disabled && (
              <button
                onClick={() => {
                  setLeaving(true);
                  setTimeout(() => tuto.setTipsDisabled(true), 220);
                }}
                className="ml-auto self-center font-mono text-[10px] uppercase tracking-wide text-paper-text/55 underline-offset-2 hover:text-red-dark hover:underline"
                title="Tu pourras les rallumer depuis le bouton ? en haut"
              >
                Ne plus afficher les astuces
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- Invitation (accueil)
export function TutoInvite() {
  const tuto = useTuto();
  if (!tuto?.data || tuto.tour || tuto.briefingOpen) return null;
  const d = tuto.data;
  if (d.briefing_seen || d.tour_done || d.is_new) return null;

  return (
    <aside className="tuto-tip tuto-invite" aria-label="Visite guidée">
      <span className="tuto-tip-tape" aria-hidden />
      <div className="flex flex-wrap items-center gap-4">
        <span className="tuto-icon shrink-0">
          <SidIcon name="compass" size={20} />
        </span>
        <div className="min-w-0 flex-1 basis-[15rem]">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-red-dark">Nouveau</p>
          <p className="font-display text-lg uppercase leading-tight tracking-wide text-paper-text">La visite guidée du S.I.D.</p>
          <p className="font-body text-sm text-paper-text/80">
            Cinq minutes pour (re)découvrir chaque recoin du Dossier Central
            {!d.reward_claimed && d.reward > 0 ? <>, et une prime d&apos;intégration de <strong>{zenis(d.reward)}</strong> à la clé</> : null}.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => tuto.openBriefing()} className="tuto-btn !py-1.5 !text-xs">
            Ouvrir mon dossier
          </button>
          <button onClick={() => tuto.dismissInvite()} className="tuto-btn-ghost !py-1.5 !text-xs" aria-label="Plus tard">
            Plus tard
          </button>
        </div>
      </div>
    </aside>
  );
}
