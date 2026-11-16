"use client";

/**
 * Texte qui « bugue » (Lot 81, lieu inconnu) : reflets rouge et cyan, et par
 * à-coups des glyphes façon Matrix à la place des lettres. Le vrai texte
 * reste en place (lecteurs d'écran, mise en page), le brouillage passe
 * par-dessus.
 *
 * Écrit sans JSX : la couche JSX du site (src/brand/glitch.ts) enveloppe les
 * pseudos brouillés dans GlitchName, qui ne doit pas s'envelopper lui-même.
 * Fichier identique dans les trois sites ; styles .gl dans globals.css.
 */

import { createElement, useEffect, useState, useSyncExternalStore } from "react";
import { isGlitchedNow, subscribeGlitch, wasGlitchedAtLoad } from "@/lib/glitch";

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ01#%&@$▓░▒";
const scramble = (text: string) =>
  [...text].map((c) => (c !== " " && Math.random() < 0.45 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : c)).join("");

// Une seule horloge pour tous les textes brouillés de la page : leurs mises à
// jour d'un même tic sont rendues ensemble.
type Tick = (now: number) => void;
const ticks = new Set<Tick>();
let timer: ReturnType<typeof setInterval> | null = null;
function onTick(fn: Tick) {
  ticks.add(fn);
  timer ??= setInterval(() => {
    if (document.hidden) return;
    const now = performance.now();
    ticks.forEach((t) => t(now));
  }, 80);
  return () => {
    ticks.delete(fn);
    if (!ticks.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeMotion(fn: () => void) {
  const mq = window.matchMedia?.(REDUCE);
  mq?.addEventListener?.("change", fn);
  return () => mq?.removeEventListener?.("change", fn);
}
const reducedMotion = () => !!window.matchMedia?.(REDUCE).matches;

/** Texte brouillé en permanence. tone « matrix » : vert, en chasse fixe. */
export function GlitchText({ text = "Lieu inconnu", tone = "name", className = "" }: { text?: string; tone?: "name" | "matrix"; className?: string }) {
  const still = useSyncExternalStore(subscribeMotion, reducedMotion, () => false);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (still) return setShown(null);
    let next = performance.now() + 300 + Math.random() * 2400;
    let left = 0;
    return onTick((now) => {
      if (left > 0) {
        left -= 1;
        if (left > 0) return setShown(scramble(text));
        setShown(null);
        next = now + 1400 + Math.random() * 3200;
      } else if (now >= next) {
        left = 3 + Math.floor(Math.random() * 4);
        setShown(scramble(text));
      }
    });
  }, [text, still]);

  return createElement(
    "span",
    { className: `gl gl-${tone}${className ? ` ${className}` : ""}`, "data-text": shown ?? text, "data-burst": shown === null ? undefined : "" },
    createElement("span", { className: "gl-real" }, text),
    shown === null ? null : createElement("span", { className: "gl-fx", "aria-hidden": true }, shown),
  );
}

function useGlitched(name: string) {
  return useSyncExternalStore(
    subscribeGlitch,
    () => isGlitchedNow(name),
    () => wasGlitchedAtLoad(name),
  );
}

/** Pseudo d'un membre : brouillé tant qu'il est en lieu inconnu. */
export function GlitchName({ name }: { name: string }) {
  return useGlitched(name) ? createElement(GlitchText, { text: name }) : name;
}

/** « Lieu inconnu » sous le nom d'un membre brouillé (fiches de profil). */
export function GlitchWhere({ name, className = "" }: { name: string; className?: string }) {
  if (!useGlitched(name)) return null;
  return createElement(
    "span",
    { className: `gl-where ${className}`.trim() },
    createElement("span", { className: "gl-where-label" }, "Position : "),
    createElement(GlitchText, { tone: "matrix" }),
  );
}
