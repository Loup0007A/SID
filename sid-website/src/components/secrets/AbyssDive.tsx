"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { announceTitlesChanged } from "@/lib/titles";

const LINE = 24; // pixels par « ligne »
const GOAL = 100_000; // lignes
const CHUNK = 24_000; // pixels ajoutés quand on approche du fond

const MARKS: [number, string][] = [
  [500, "Il n'y a rien en bas."],
  [2_000, "Vraiment rien."],
  [5_000, "…"],
  [10_000, "Dix mille lignes. Tu es sûr de toi ?"],
  [20_000, "Il fait de plus en plus sombre."],
  [35_000, "Tu entends quelque chose ?"],
  [50_000, "La moitié du vide."],
  [65_000, "Des yeux s'allument dans le noir."],
  [80_000, "Les poissons-lanternes te regardent passer."],
  [90_000, "Le fond n'est plus très loin."],
  [99_000, "Encore un effort."],
];

/**
 * Tout en bas d'une page, en insistant, le vide commence. Cent mille
 * lignes plus bas, l'abysse décide (une chance sur deux, une fois par jour).
 */
export function AbyssDive() {
  const supabase = createClient();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [height, setHeight] = useState(0);
  const [depth, setDepth] = useState(0);
  const [verdict, setVerdict] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const startRef = useRef(0);
  const claimed = useRef(false);

  // Remise à zéro quand on change de page.
  useEffect(() => {
    setActive(false);
    setHeight(0);
    setDepth(0);
    setVerdict(null);
    claimed.current = false;
  }, [pathname]);

  // Insister tout en bas (molette, flèches, doigt) ouvre le vide.
  useEffect(() => {
    if (active) return;
    let pushes: number[] = [];
    let touchY = 0;
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const push = () => {
      if (!atBottom()) return;
      const now = Date.now();
      pushes = [...pushes.filter((t) => now - t < 4000), now];
      if (pushes.length >= 14) open();
    };
    const open = async () => {
      setActive(true);
      setHeight(CHUNK);
      startRef.current = window.scrollY;
      const { data } = await supabase.rpc("abyss_start");
      tokenRef.current = (data as string | null) ?? null;
    };
    const onWheel = (e: WheelEvent) => e.deltaY > 0 && push();
    const onKey = (e: KeyboardEvent) => ["ArrowDown", "PageDown", "End", " "].includes(e.key) && push();
    const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0]?.clientY ?? 0);
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      if (touchY - y > 30) {
        touchY = y;
        push();
      }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [active, supabase]);

  // La descente : on mesure, on prolonge le vide, on réclame au fond.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(async () => {
        const lines = Math.max(0, Math.floor((window.scrollY - startRef.current) / LINE));
        setDepth((d) => Math.max(d, lines));
        const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
        if (remaining < 4000 && lines < GOAL + 50) setHeight((h) => h + CHUNK);
        if (lines >= GOAL && !claimed.current && tokenRef.current) {
          claimed.current = true;
          const { data } = await supabase.rpc("abyss_claim", { p_token: tokenRef.current });
          const r = (data as { result?: string; next_at?: string } | null) ?? {};
          if (r.result === "won") {
            setVerdict("L'abysse t'a choisi.");
            announceTitlesChanged();
          } else if (r.result === "lost") setVerdict("Le vide t'a recraché. Reviens demain.");
          else if (r.result === "wait") setVerdict("L'abysse dort. Reviens plus tard.");
          else if (r.result === "already") setVerdict("Tu connais déjà le fond.");
          else if (r.result === "too_fast") {
            claimed.current = false;
            setVerdict("Trop vite. Le fond se mérite.");
          } else setVerdict("Le fond est silencieux.");
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [active, supabase]);

  if (!active) return null;

  return (
    <div className="abyss-void relative" style={{ height }} aria-hidden>
      {MARKS.filter(([l]) => l * LINE < height).map(([l, text]) => (
        <p key={l} className="absolute inset-x-0 text-center font-mono text-[11px] text-paper/25" style={{ top: l * LINE }}>
          {text}
        </p>
      ))}
      <div className="pointer-events-none fixed right-2 top-1/2 z-[30] -translate-y-1/2 font-mono text-[10px] text-paper/30 [writing-mode:vertical-rl]">
        −{depth.toLocaleString("fr-FR")} lignes
      </div>
      {verdict && (
        <div className="pointer-events-none fixed inset-x-0 top-1/3 z-[30] text-center">
          <p className="abyss-verdict inline-block rounded-lg bg-black/60 px-5 py-3 font-display text-2xl uppercase tracking-wide text-[#2ee6d0]">{verdict}</p>
        </div>
      )}
    </div>
  );
}
