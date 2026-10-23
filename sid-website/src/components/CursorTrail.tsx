"use client";

import { useEffect, useRef, useState } from "react";
import { useSiteDecor } from "@/components/seasonal/siteDecor";
import type { EventKey } from "@/lib/events";
import { CURSOR_EVENT, CURSOR_KEY, readCursorMode, type CursorMode } from "@/lib/cursorPrefs";

/**
 * Traînée du curseur et petit éclat au clic, seulement avec une souris
 * (pas sur écran tactile). Un seul <canvas> fixe, dessiné uniquement quand il
 * y a quelque chose à montrer : à l'arrêt, plus rien ne tourne.
 *
 * Réglable dans Réglages → Curseur (complet, clic seulement, désactivé) ;
 * coupé si le système demande moins d'animations.
 */

type Shape = "dot" | "star" | "heart" | "flake" | "note";
type Palette = { colors: string[]; shape: Shape; glow: number };

const BASE: Palette = { colors: ["#8FB3D9", "#BBD3EA", "#D99A9A", "#EDE6D3"], shape: "dot", glow: 8 };
const PALETTES: Partial<Record<EventKey, Palette>> = {
  halloween: { colors: ["#ff9a3c", "#ffb35c", "#a46bff", "#7a3cff"], shape: "dot", glow: 10 },
  noel: { colors: ["#ffffff", "#dff1ff", "#bfe3ff"], shape: "flake", glow: 6 },
  saint_valentin: { colors: ["#ff7aa8", "#ffc2d6", "#ff4f8b"], shape: "heart", glow: 8 },
  poisson_avril: { colors: ["#7fd8ff", "#ffb08a", "#ffe28a"], shape: "dot", glow: 6 },
  paques: { colors: ["#ffe08a", "#ffb3c7", "#b8e0ff", "#c7f0b8"], shape: "dot", glow: 6 },
  premier_mai: { colors: ["#fbfff6", "#d8ffe0", "#8fe0a4"], shape: "dot", glow: 7 },
  fete_musique: { colors: ["#c9a6ff", "#ff9c6e", "#6ec8ff", "#ffe14d"], shape: "note", glow: 8 },
  quatorze_juillet: { colors: ["#5b8bff", "#f4f6ff", "#ff4d5a"], shape: "star", glow: 9 },
  armistice: { colors: ["#6f95ff", "#9db7e8", "#c9d6f2"], shape: "dot", glow: 5 },
};
// Si plusieurs fêtes sont affichées en même temps, la première de cette liste gagne.
const PRIORITY: EventKey[] = ["armistice", "quatorze_juillet", "fete_musique", "premier_mai", "paques", "poisson_avril", "saint_valentin", "noel", "halloween"];

type P = { x: number; y: number; vx: number; vy: number; born: number; life: number; size: number; color: string; spin: number };
type Ring = { x: number; y: number; born: number; color: string };

const MAX = 140;

export function CursorTrail() {
  const decor = useSiteDecor();
  const [mode, setMode] = useState<CursorMode>("off");
  const [able, setAble] = useState(false);
  const palRef = useRef<Palette>(BASE);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Souris seulement, et pas si le système demande moins d'animations.
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAble(fine.matches && !calm.matches);
    update();
    setMode(readCursorMode());
    const onMode = (e: Event) => setMode((e as CustomEvent<CursorMode>).detail ?? readCursorMode());
    const onStorage = (e: StorageEvent) => e.key === CURSOR_KEY && setMode(readCursorMode());
    fine.addEventListener?.("change", update);
    calm.addEventListener?.("change", update);
    window.addEventListener(CURSOR_EVENT, onMode);
    window.addEventListener("storage", onStorage);
    return () => {
      fine.removeEventListener?.("change", update);
      calm.removeEventListener?.("change", update);
      window.removeEventListener(CURSOR_EVENT, onMode);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const k = PRIORITY.find((e) => decor?.[e]);
    palRef.current = (k && PALETTES[k]) || BASE;
  }, [decor]);

  const on = able && mode !== "off";

  useEffect(() => {
    if (!on) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const heart = new Path2D("M0 3.2 C-2.6 1.2 -4 -0.4 -4 -1.8 C-4 -3 -3.1 -3.8 -2 -3.8 C-1.2 -3.8 -0.4 -3.3 0 -2.6 C0.4 -3.3 1.2 -3.8 2 -3.8 C3.1 -3.8 4 -3 4 -1.8 C4 -0.4 2.6 1.2 0 3.2 Z");
    const star = new Path2D("M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z");

    // Chaque forme × couleur est dessinée une seule fois (avec sa lueur) dans
    // une petite image ; ensuite on ne fait que la recopier : pas de flou à
    // recalculer à chaque image.
    const SPR = 40;
    const sprites = new Map<string, HTMLCanvasElement>();
    const sprite = (shape: Shape, color: string, glow: number) => {
      const key = shape + color;
      let c = sprites.get(key);
      if (c) return c;
      c = document.createElement("canvas");
      c.width = c.height = SPR;
      const g = c.getContext("2d")!;
      g.translate(SPR / 2, SPR / 2);
      if (shape === "dot") {
        const r = g.createRadialGradient(0, 0, 0, 0, 0, SPR / 2);
        r.addColorStop(0, "#ffffff");
        r.addColorStop(0.18, color);
        r.addColorStop(0.42, color + "55");
        r.addColorStop(1, color + "00");
        g.fillStyle = r;
        g.fillRect(-SPR / 2, -SPR / 2, SPR, SPR);
      } else {
        g.shadowColor = color;
        g.shadowBlur = glow;
        g.fillStyle = color;
        g.strokeStyle = color;
        g.scale(2.6, 2.6);
        if (shape === "heart") g.fill(heart);
        else if (shape === "star") g.fill(star);
        else if (shape === "note") {
          g.font = "9px serif";
          g.textAlign = "center";
          g.fillText("♪", 0, 3.5);
        } else {
          g.lineWidth = 0.9;
          g.lineCap = "round";
          g.beginPath();
          for (let j = 0; j < 3; j++) {
            const ang = (j * Math.PI) / 3;
            g.moveTo(Math.cos(ang) * -4, Math.sin(ang) * -4);
            g.lineTo(Math.cos(ang) * 4, Math.sin(ang) * 4);
          }
          g.stroke();
        }
      }
      sprites.set(key, c);
      return c;
    };

    const parts: P[] = [];
    const rings: Ring[] = [];
    let raf = 0;
    let lastX = -1;
    let lastY = -1;
    let carry = 0;
    let n = 0;
    const trail = mode === "full";

    const pick = () => {
      const c = palRef.current.colors;
      return c[n++ % c.length];
    };

    const add = (p: P) => {
      if (parts.length >= MAX) parts.shift();
      parts.push(p);
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    // Zone salie à l'image précédente : on n'efface que celle-là.
    let dirty: [number, number, number, number] | null = null;

    function frame(now: number) {
      raf = 0;
      if (dirty) ctx!.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1]);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      const pal = palRef.current;
      ctx!.globalCompositeOperation = "lighter";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        const t = (now - p.born) / p.life;
        if (t >= 1) {
          parts.splice(i, 1);
          continue;
        }
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.vx *= 0.94;
        p.vy = p.vy * 0.94 + (pal.shape === "flake" ? 1.2 : 0.4);
        const dot = pal.shape === "dot";
        const d = dot ? p.size * (1 - t * 0.6) * 5 : p.size * (1 - t * 0.3) * 4.2;
        ctx!.globalAlpha = (1 - t) * 0.9;
        const img = sprite(pal.shape, p.color, pal.glow);
        if (dot) ctx!.drawImage(img, p.x - d / 2, p.y - d / 2, d, d);
        else {
          const a = p.spin * t * 3;
          const cs = Math.cos(a) * dpr;
          const sn = Math.sin(a) * dpr;
          ctx!.setTransform(cs, sn, -sn, cs, p.x * dpr, p.y * dpr);
          ctx!.drawImage(img, -d / 2, -d / 2, d, d);
          ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        const h = d * 0.75;
        if (p.x - h < x0) x0 = p.x - h;
        if (p.y - h < y0) y0 = p.y - h;
        if (p.x + h > x1) x1 = p.x + h;
        if (p.y + h > y1) y1 = p.y + h;
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        const t = (now - r.born) / 460;
        if (t >= 1) {
          rings.splice(i, 1);
          continue;
        }
        const rad = 4 + t * 26;
        ctx!.globalAlpha = (1 - t) * 0.8;
        ctx!.strokeStyle = r.color;
        ctx!.lineWidth = 2 * (1 - t) + 0.5;
        ctx!.beginPath();
        ctx!.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx!.stroke();
        if (r.x - rad - 4 < x0) x0 = r.x - rad - 4;
        if (r.y - rad - 4 < y0) y0 = r.y - rad - 4;
        if (r.x + rad + 4 > x1) x1 = r.x + rad + 4;
        if (r.y + rad + 4 > y1) y1 = r.y + rad + 4;
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
      dirty = x1 > x0 ? [Math.floor(x0) - 2, Math.floor(y0) - 2, Math.ceil(x1) + 2, Math.ceil(y1) + 2] : null;
      // Une dernière image pour effacer ce qui restait, puis plus rien ne tourne.
      if (parts.length || rings.length || dirty) raf = requestAnimationFrame(frame);
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const x = e.clientX;
      const y = e.clientY;
      if (lastX < 0) {
        lastX = x;
        lastY = y;
        return;
      }
      const dx = x - lastX;
      const dy = y - lastY;
      const dist = Math.hypot(dx, dy);
      lastX = x;
      lastY = y;
      if (!trail || dist < 1) return;
      carry += dist;
      const step = palRef.current.shape === "dot" ? 9 : 16;
      let made = 0;
      const now = performance.now();
      while (carry >= step && made < 3) {
        carry -= step;
        made++;
        const f = made / 3;
        add({
          x: x - dx * f + (Math.random() - 0.5) * 3,
          y: y - dy * f + (Math.random() - 0.5) * 3,
          vx: (Math.random() - 0.5) * 30 - dx * 0.6,
          vy: (Math.random() - 0.5) * 30 - dy * 0.6,
          born: now,
          life: 420 + Math.random() * 300,
          size: palRef.current.shape === "dot" ? 1.6 + Math.random() * 1.8 : 3 + Math.random() * 2.5,
          color: pick(),
          spin: (Math.random() - 0.5) * 2,
        });
      }
      if (carry > step * 3) carry = 0;
      if (made) kick();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const now = performance.now();
      const pal = palRef.current;
      rings.push({ x: e.clientX, y: e.clientY, born: now, color: pal.colors[0] });
      const count = pal.shape === "dot" ? 12 : 9;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const sp = 110 + Math.random() * 90;
        add({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          born: now,
          life: 380 + Math.random() * 220,
          size: pal.shape === "dot" ? 1.8 + Math.random() * 1.4 : 3.2 + Math.random() * 2,
          color: pick(),
          spin: (Math.random() - 0.5) * 3,
        });
      }
      kick();
    };

    const onLeave = () => {
      lastX = -1;
      carry = 0;
    };

    let resizeT: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(resize, 150);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeT);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      ctx.clearRect(0, 0, w, h);
    };
  }, [on, mode]);

  if (!on) return null;
  return <canvas ref={canvasRef} className="cursor-trail" aria-hidden />;
}
