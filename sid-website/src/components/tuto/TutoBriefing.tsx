"use client";

import { useEffect, useMemo, useState } from "react";
import { SidIcon } from "@/components/icons/SidIcon";
import { zenis } from "@/lib/tuto/content";
import { useTuto } from "./TutoProvider";

/**
 * Le dossier d'intégration : une chemise kraft glisse sur la table, le
 * tampon « CONFIDENTIEL » tombe, la chemise s'ouvre sur la fiche de l'agent
 * (tapée à la machine), le tampon « ACTIF » valide le tout.
 * Un clic pendant l'animation la termine d'un coup.
 */

const LINE_DELAY = 2200; // ms : début de la frappe (après l'ouverture)
const CHAR_MS = 22;

export function TutoBriefing() {
  const tuto = useTuto()!;
  const { me, data } = tuto;
  const [fast, setFast] = useState(false);
  const [typed, setTyped] = useState(0);

  const today = useMemo(() => new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }), []);
  const lines = useMemo(
    () => [
      ["Nom de code", me.nickname],
      ["Rang", me.rank],
      ["Affectation", "Dossier Central · S.I.D."],
      ["Entrée en service", today],
    ],
    [me.nickname, me.rank, today]
  );
  const total = lines.reduce((s, [, v]) => s + v.length, 0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) setFast(true);
  }, []);

  useEffect(() => {
    if (fast) {
      setTyped(total);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const n = Math.max(0, Math.floor((now - t0 - LINE_DELAY) / CHAR_MS));
      setTyped(Math.min(total, n));
      if (n < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fast, total]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && tuto.closeBriefing(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tuto]);

  let left = typed;
  const done = typed >= total;
  const reward = data && !data.reward_claimed && data.reward > 0 ? data.reward : 0;

  return (
    <div
      className={`tuto-briefing fixed inset-0 z-[8100] flex items-center justify-center overflow-y-auto p-4 ${fast ? "is-fast" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Dossier d'intégration"
      onClick={() => !done && setFast(true)}
    >
      <div className="tuto-desk" aria-hidden />
      <div className="tuto-folder">
        <div className="tuto-folder-tab">S.I.D. · Dossier n° {String(hash(me.nickname)).slice(0, 6)}</div>
        <div className="tuto-folder-back" aria-hidden />
        <div className="tuto-sheet">
          <span className="tuto-sheet-holes" aria-hidden />
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="tuto-photo">
              <span className="tuto-photo-clip" aria-hidden />
              {me.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatarUrl} alt="" className="h-full w-full object-cover grayscale-[35%] sepia-[20%]" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-display text-5xl text-paper-text/70">
                  {me.nickname.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper-text/55">Fiche d&apos;agent · usage interne</p>
              <dl className="mt-2 space-y-1.5">
                {lines.map(([label, value]) => {
                  const shown = value.slice(0, Math.max(0, left));
                  const typing = left > 0 && left < value.length;
                  left -= value.length;
                  return (
                    <div key={label} className="flex flex-wrap items-baseline gap-x-2 border-b border-dashed border-paper-text/20 pb-1">
                      <dt className="w-40 shrink-0 font-mono text-[11px] uppercase tracking-wider text-paper-text/55">{label}</dt>
                      <dd className="min-w-0 font-mono text-[15px] text-paper-text">
                        {shown}
                        {typing && <span className="tuto-caret" />}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>

          <div className={`tuto-orders ${done ? "is-shown" : ""}`}>
            <p className="font-display text-lg uppercase tracking-wide text-paper-text">Ordre de mission</p>
            <p className="mt-1 font-body text-[15px] leading-relaxed text-paper-text/90">
              Bienvenue parmi nous, {me.nickname}. Avant ta première mission, l&apos;état-major te fait visiter les lieux : quêtes,
              carte, entraînement, argent, et ce qu&apos;on veut bien te dire des secrets du S.I.D. Compte cinq minutes.
              {reward > 0 && (
                <>
                  {" "}
                  À la clé : une <strong>prime d&apos;intégration de {zenis(reward)}</strong>.
                </>
              )}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={() => tuto.closeBriefing(true)} className="tuto-btn" autoFocus>
                <SidIcon name="compass" size={14} /> Commencer la visite
              </button>
              <button onClick={() => tuto.closeBriefing(false)} className="tuto-btn-ghost">
                Plus tard
              </button>
              <span className="font-mono text-[10px] uppercase text-paper-text/50">Le bouton ? en haut la relance quand tu veux.</span>
            </div>
          </div>

          <span className={`tuto-stamp-big tuto-stamp-active ${done ? "is-shown" : ""}`} aria-hidden>
            Agent actif
          </span>
        </div>
        <div className="tuto-folder-cover" aria-hidden>
          <span className="tuto-cover-title">S.I.D.</span>
          <small className="tuto-cover-sub">Système International Dictatorial</small>
          <span className="tuto-cover-lines" />
          <span className="tuto-stamp-big tuto-stamp-confidential">Confidentiel</span>
        </div>
      </div>
    </div>
  );
}

function hash(s: string) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 999983;
  return 100000 + h;
}
