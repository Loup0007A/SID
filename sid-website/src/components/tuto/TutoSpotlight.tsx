"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CHAPTERS, TOUR, resolveText } from "@/lib/tuto/content";
import { SidIcon } from "@/components/icons/SidIcon";
import { useTuto } from "./TutoProvider";
import { Rich } from "./Rich";

/**
 * La visite guidée : la page s'assombrit, l'élément montré reste éclairé et
 * entouré au feutre rouge (comme sur un dossier annoté), et une fiche de
 * papier explique. La fiche suit l'élément s'il bouge (chargement, défilement).
 */

type Box = { x: number; y: number; w: number; h: number };

const PAD = 10;
const MOBILE = 640;

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Un trait de feutre qui fait le tour de la boîte, un peu plus d'un tour, jamais parfait. */
function markerPath(b: Box, wobble: number[], start: number) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rx = b.w / 2 + PAD + 4;
  const ry = b.h / 2 + PAD + 4;
  const turns = 1.12;
  const N = 72;
  let d = "";
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = start + t * turns * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Super-ellipse : un rectangle aux coins ronds, dessiné à main levée.
    const ex = Math.sign(c) * Math.pow(Math.abs(c), 0.42);
    const ey = Math.sign(s) * Math.pow(Math.abs(s), 0.42);
    const k = wobble[i % wobble.length] * (1 + t * 0.9);
    const grow = 1 + t * 0.035;
    d += `${i ? "L" : "M"}${(cx + ex * (rx + k) * grow).toFixed(1)} ${(cy + ey * (ry + k) * grow).toFixed(1)}`;
  }
  return d;
}

export function TutoSpotlight() {
  const tuto = useTuto()!;
  const pathname = usePathname();
  const { tour, numbers, me } = tuto;
  const step = TOUR[tour!.index];
  const chapter = CHAPTERS.find((c) => c.n === step.chapter)!;
  const scope = useMemo(() => (tour!.chapterOnly != null ? TOUR.filter((s) => s.chapter === tour!.chapterOnly) : TOUR), [tour]);
  const pos = scope.findIndex((s) => s.id === step.id);
  const isFirst = pos === 0;
  const isLast = pos === scope.length - 1;

  const [status, setStatus] = useState<"searching" | "found" | "missing" | "none">(step.target ? "searching" : "none");
  const elRef = useRef<Element | null>(null);
  const holeRef = useRef<SVGRectElement>(null);
  const markRef = useRef<SVGPathElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cur = useRef<Box | null>(null);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const h = () => setMobile(window.innerWidth < MOBILE);
    h();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // 1) Trouver l'élément (la page vient peut-être de changer), puis l'amener à l'écran.
  useEffect(() => {
    elRef.current = null;
    if (!step.target) {
      setStatus("none");
      return;
    }
    setStatus("searching");
    if (pathname !== step.route) return;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      const el = Array.from(document.querySelectorAll(`[data-tuto="${step.target}"]`)).find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (el) {
        clearInterval(id);
        elRef.current = el;
        const r = el.getBoundingClientRect();
        const small = window.innerWidth < MOBILE;
        const room = small ? window.innerHeight * 0.48 : window.innerHeight - 160;
        const top = r.height < room ? (small ? 84 : (window.innerHeight - r.height) / 2) : small ? 76 : 96;
        window.scrollTo({ top: Math.max(0, window.scrollY + r.top - top), behavior: "smooth" });
        setStatus("found");
      } else if (tries > 30) {
        clearInterval(id);
        setStatus("missing");
      }
    }, 120);
    return () => clearInterval(id);
  }, [step.id, step.target, step.route, pathname]);

  // 2) Suivre l'élément à chaque image : le trou, le trait de feutre et la fiche.
  const wobble = useMemo(() => {
    const r = seeded(hash(step.id));
    return Array.from({ length: 9 }, () => (r() - 0.5) * 6);
  }, [step.id]);
  const startAngle = useMemo(() => -2.2 + seeded(hash(step.id + "a"))() * 0.8, [step.id]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const el = elRef.current;
      let target: Box;
      if (el && status === "found") {
        const r = el.getBoundingClientRect();
        target = { x: r.left, y: r.top, w: r.width, h: r.height };
      } else {
        target = { x: vw / 2, y: vh / 2, w: 0, h: 0 };
      }
      const c = cur.current ?? target;
      const k = cur.current ? 0.24 : 1;
      const next = { x: c.x + (target.x - c.x) * k, y: c.y + (target.y - c.y) * k, w: c.w + (target.w - c.w) * k, h: c.h + (target.h - c.h) * k };
      cur.current = next;

      const lit = next.w > 16 && next.h > 16;
      const hole = holeRef.current;
      if (hole) {
        hole.setAttribute("x", String(next.x - PAD));
        hole.setAttribute("y", String(next.y - PAD));
        hole.setAttribute("width", String(lit ? next.w + PAD * 2 : 0));
        hole.setAttribute("height", String(lit ? next.h + PAD * 2 : 0));
      }
      if (markRef.current) markRef.current.setAttribute("d", lit ? markerPath(next, wobble, startAngle) : "");

      // La fiche : en dessous, au-dessus, à côté… ou posée en bas sur téléphone.
      const card = cardRef.current;
      if (card) {
        const bw = card.offsetWidth;
        const bh = card.offsetHeight;
        let x: number;
        let y: number;
        if (vw < MOBILE) {
          x = 12;
          y = vh - bh - 12;
        } else if (!lit) {
          x = (vw - bw) / 2;
          y = (vh - bh) / 2;
        } else {
          const below = vh - (next.y + next.h + PAD + 18);
          const above = next.y - PAD - 18;
          const right = vw - (next.x + next.w + PAD + 18);
          const left = next.x - PAD - 18;
          if (below >= bh) {
            x = next.x + next.w / 2 - bw / 2;
            y = next.y + next.h + PAD + 18;
          } else if (above >= bh) {
            x = next.x + next.w / 2 - bw / 2;
            y = next.y - PAD - 18 - bh;
          } else if (right >= bw) {
            x = next.x + next.w + PAD + 18;
            y = next.y + next.h / 2 - bh / 2;
          } else if (left >= bw) {
            x = next.x - PAD - 18 - bw;
            y = next.y + next.h / 2 - bh / 2;
          } else {
            x = vw - bw - 20;
            y = vh - bh - 20;
          }
          x = Math.min(Math.max(12, x), vw - bw - 12);
          y = Math.min(Math.max(12, y), vh - bh - 12);
        }
        card.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
        card.style.opacity = "1";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, wobble, startAngle, mobile]);

  // 3) Clavier : flèches, Entrée, Échap.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (isLast) tuto.stopTour(true);
        else tuto.goTo(TOUR.indexOf(scope[pos + 1]));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (!isFirst) tuto.goTo(TOUR.indexOf(scope[pos - 1]));
      } else if (e.key === "Escape") {
        tuto.stopTour(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tuto, isFirst, isLast, pos, scope]);

  const text = resolveText(status === "missing" && step.missing ? step.missing : step.body, numbers, me.nickname);
  const chapterOnly = tour!.chapterOnly != null;

  return (
    <div className="tuto-root fixed inset-0 z-[8000]" role="dialog" aria-modal="true" aria-label={`Visite guidée : ${step.title}`}>
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tuto-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect ref={holeRef} rx="14" ry="14" fill="black" />
          </mask>
          <filter id="tuto-felt" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="rgba(13, 15, 23, 0.74)" mask="url(#tuto-mask)" className="tuto-dim" />
        <path
          key={step.id + status}
          ref={markRef}
          className="tuto-marker"
          pathLength={1}
          fill="none"
          stroke="#e06a62"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#tuto-felt)"
        />
      </svg>

      <div ref={cardRef} className="tuto-card-wrap absolute left-0 top-0" style={{ opacity: 0, width: mobile ? "calc(100vw - 24px)" : 384 }}>
        <article key={step.id} className="tuto-card">
          <span className="tuto-clip" aria-hidden />
          <header className="flex items-start justify-between gap-3">
            <span className="tuto-stamp">
              <SidIcon name={chapter.icon} size={12} /> {chapterOnly ? chapter.title : `Ch. ${chapter.n} · ${chapter.title}`}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-paper-text/55">
              {pos + 1} / {scope.length}
            </span>
          </header>

          <h2 className="mt-3 flex items-center gap-2.5 font-display text-xl uppercase leading-tight tracking-wide text-paper-text">
            <span className="tuto-icon">
              <SidIcon name={step.icon} size={18} />
            </span>
            {step.title}
          </h2>

          <Rich text={text} className="mt-2 space-y-2 font-body text-[15px] leading-relaxed text-paper-text/90" />

          {!chapterOnly && (
            <div className="mt-4 flex gap-1" aria-hidden>
              {CHAPTERS.map((c) => (
                <span key={c.n} className={`tuto-rail ${c.n < step.chapter ? "is-done" : c.n === step.chapter ? "is-now" : ""}`}>
                  {c.n === step.chapter && (
                    <span
                      className="tuto-rail-fill"
                      style={{
                        width: `${((TOUR.filter((s) => s.chapter === c.n).findIndex((s) => s.id === step.id) + 1) / TOUR.filter((s) => s.chapter === c.n).length) * 100}%`,
                      }}
                    />
                  )}
                </span>
              ))}
            </div>
          )}

          <footer className="mt-4 flex items-center gap-2">
            <button onClick={() => tuto.stopTour(false)} className="mr-auto font-mono text-[11px] uppercase tracking-wide text-paper-text/55 hover:text-red-dark">
              {chapterOnly ? "Fermer" : "Quitter"}
            </button>
            {!isFirst && (
              <button onClick={() => tuto.goTo(TOUR.indexOf(scope[pos - 1]))} className="tuto-btn-ghost" aria-label="Étape précédente">
                ←
              </button>
            )}
            <button
              onClick={() => (isLast ? tuto.stopTour(!chapterOnly) : tuto.goTo(TOUR.indexOf(scope[pos + 1])))}
              className="tuto-btn"
              autoFocus
            >
              {isLast ? (chapterOnly ? "Compris" : "Terminer") : isFirst && !chapterOnly ? "C'est parti" : "Suivant"} {!isLast && "→"}
            </button>
          </footer>
        </article>
      </div>
    </div>
  );
}
