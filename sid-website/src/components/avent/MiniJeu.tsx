"use client";

import { useEffect, useRef, useState } from "react";
import { JEUX } from "./jeux";
import { hasard, lirePalette, type Jeu } from "./jeux/moteur";

/**
 * Fait tourner un mini-jeu du calendrier de l'avent sur un canevas :
 * compte à rebours, boucle d'animation, doigt / souris / clavier, puis
 * onFin(score) une fois la partie terminée.
 */
export function MiniJeu({ jeu, graine, onFin }: { jeu: string; graine: number; onFin: (score: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const instance = useRef<Jeu | null>(null);
  const fin = useRef(onFin);
  useEffect(() => {
    fin.current = onFin;
  }, [onFin]);
  const [decompte, setDecompte] = useState(3);
  const [score, setScore] = useState(0);
  const def = JEUX[jeu];

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !def) return;
    const j = def.creer({ pal: lirePalette(cv), rng: hasard(graine) });
    instance.current = j;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = j.largeur * dpr;
    cv.height = j.hauteur * dpr;
    const g = cv.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    j.dessiner(g);

    let depart = 3;
    setDecompte(3);
    const tic = setInterval(() => {
      depart--;
      setDecompte(depart);
      if (depart <= 0) clearInterval(tic);
    }, 700);

    let raf = 0;
    let avant = performance.now();
    let apresFin = 0;
    let envoye = false;
    let dernierScore = -1;
    const boucle = (t: number) => {
      const dt = Math.min(0.05, (t - avant) / 1000);
      avant = t;
      if (depart <= 0 && !document.hidden) {
        j.maj(dt);
        if (j.fini) apresFin += dt;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      j.dessiner(g);
      if (j.score !== dernierScore) {
        dernierScore = j.score;
        setScore(j.score);
      }
      if (j.fini && apresFin > 0.9 && !envoye) {
        envoye = true;
        fin.current(Math.max(0, Math.round(j.score)));
        return;
      }
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);

    const TOUCHES = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"]);
    const clavier = (e: KeyboardEvent) => {
      if (depart > 0) return;
      const cible = e.target as HTMLElement | null;
      if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) return;
      if (TOUCHES.has(e.key)) e.preventDefault();
      j.saisie({ type: e.type === "keydown" ? "keydown" : "keyup", key: e.key });
    };
    window.addEventListener("keydown", clavier);
    window.addEventListener("keyup", clavier);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(tic);
      window.removeEventListener("keydown", clavier);
      window.removeEventListener("keyup", clavier);
    };
  }, [def, graine]);

  function pointeur(type: "down" | "move" | "up", e: React.PointerEvent<HTMLCanvasElement>) {
    const j = instance.current;
    const cv = canvas.current;
    if (!j || !cv || decompte > 0) return;
    if (type === "down") cv.setPointerCapture?.(e.pointerId);
    const r = cv.getBoundingClientRect();
    j.saisie({
      type,
      x: ((e.clientX - r.left) * j.largeur) / r.width,
      y: ((e.clientY - r.top) * j.hauteur) / r.height,
      id: e.pointerId,
      appui: e.pointerType !== "mouse" || e.buttons > 0 || type === "down",
    });
  }

  if (!def) return <p className="font-body text-sm text-paper/80">Ce jeu n&apos;existe pas encore sur ton site : recharge la page.</p>;
  return (
    <div className="space-y-2">
      <div className="relative mx-auto w-full" style={{ maxWidth: "min(100%, calc((100dvh - 190px) * 0.667), 460px)" }}>
        <canvas
          ref={canvas}
          aria-label={`Mini-jeu, score ${score}`}
          className="block h-auto w-full touch-none select-none rounded-[18px]"
          onPointerDown={(e) => pointeur("down", e)}
          onPointerMove={(e) => pointeur("move", e)}
          onPointerUp={(e) => pointeur("up", e)}
          onPointerCancel={(e) => pointeur("up", e)}
          onContextMenu={(e) => e.preventDefault()}
        />
        {decompte > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="font-display text-7xl text-creme [text-shadow:4px_4px_0_rgb(var(--encre))]">{decompte}</span>
          </div>
        )}
      </div>
      <p className="text-center font-body text-xs text-paper/80">{def.commandes}</p>
    </div>
  );
}
