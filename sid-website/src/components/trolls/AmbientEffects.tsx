"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NETWORK_NODES, type ActiveTroll } from "@/lib/titles";
import { ABYSS_SPEEDS, BAILIFF_DEFAULT_ITEMS, BAILIFF_TONES, PARTY_THEMES, makeRewriter, readOptions } from "@/lib/trollOptions";
import { SidIcon, Glyph } from "@/components/icons/SidIcon";

const APP_ID = "sid-app";
const app = () => document.getElementById(APP_ID);
const inTrollUi = (el: EventTarget | null) => el instanceof Element && !!el.closest("[data-troll-ui]");

/* ---------------------------------------------------------------
   Réseau détraqué (Architecte) : les liens internes sont rebranchés.
   --------------------------------------------------------------- */
export function LinkScramble({ troll }: { troll: ActiveTroll }) {
  const router = useRouter();
  useEffect(() => {
    const params = troll.params as { map?: Record<string, string>; logic?: string; every?: number };
    const map = params.map ?? {};
    const logic = params.logic ?? "fixe";
    const every = Math.max(10, Number(params.every) || 30) * 1000;
    const start = new Date(troll.created_at).getTime();
    const froms = Object.keys(map);
    const tos = froms.map((f) => map[f]);

    function destination(href: string): string | null {
      const path = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
      if (logic === "aleatoire") {
        const choices = NETWORK_NODES.map((n) => n.href).filter((h) => h !== path && h !== window.location.pathname);
        return choices[Math.floor(Math.random() * choices.length)];
      }
      const period = Math.floor((Date.now() - start) / every);
      if (logic === "rotation" && froms.length > 1) {
        const i = froms.indexOf(path);
        return i >= 0 ? tos[(i + period) % tos.length] : null;
      }
      if (logic === "echange" && period % 2 === 1) {
        const i = tos.indexOf(path);
        return i >= 0 ? froms[i] : null;
      }
      return map[path] ?? null;
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || inTrollUi(e.target)) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/dashboard")) return;
      const dest = destination(url.pathname);
      if (!dest || dest === url.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      router.push(dest);
    }
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [troll, router]);
  return null;
}

/* ---------------------------------------------------------------
   Fête forcée (Grand Mécène).
   --------------------------------------------------------------- */
function burst(layer: HTMLElement, x: number, y: number, n: number, colors: readonly string[]) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
    p.className = "troll-confetto";
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--tx", `${Math.cos(a) * d}px`);
    p.style.setProperty("--ty", `${Math.sin(a) * d - 40}px`);
    p.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    layer.appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }
}

const cursorUrl = (emoji: string) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><text y='26' font-size='26'>${emoji}</text></svg>") 4 4`;

export function PartyMode({ troll, nickname }: { troll: ActiveTroll; nickname: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const o = readOptions("fete", troll.params, troll.level);
  const theme = PARTY_THEMES[o.theme];
  useEffect(() => {
    const big = Math.min(5, troll.level || 1);
    const root = document.documentElement;
    root.classList.add("troll-party-cursor");
    root.style.setProperty("--troll-cursor", cursorUrl(o.cursor));
    const onClick = (e: MouseEvent) => layer.current && burst(layer.current, e.clientX, e.clientY, 6 + o.density * 6 + big * 2, theme.colors);
    window.addEventListener("click", onClick, true);
    const rain = setInterval(() => {
      if (!layer.current) return;
      for (let i = 0; i < 2 + o.density * 2; i++) burst(layer.current, Math.random() * window.innerWidth, -10, 6, theme.colors);
    }, 13000 - o.density * 3000);
    return () => {
      root.classList.remove("troll-party-cursor");
      root.style.removeProperty("--troll-cursor");
      window.removeEventListener("click", onClick, true);
      clearInterval(rain);
    };
  }, [troll.level, o.cursor, o.density, theme]);
  const text = o.message || (troll.everyone ? `${troll.actor} offre une fête à tout le S.I.D. !` : theme.banner(nickname));
  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9100] overflow-hidden" ref={layer}>
      <div
        className="troll-party-banner absolute inset-x-0 top-0 py-1.5 text-center font-display text-sm uppercase tracking-wider text-ink"
        style={{ backgroundImage: `linear-gradient(90deg, ${[...theme.colors, theme.colors[0]].join(", ")})` }}
      >
        <Glyph e={theme.emoji} /> {text}
        {!troll.everyone && <span className="normal-case"> — offert par {troll.actor}</span>} <Glyph e={theme.emoji} />
      </div>
      {Array.from({ length: o.density + 1 }, (_, i) => (
        <div key={i} className="troll-balloon" style={{ left: `${10 + ((i * 67) % 80)}%`, animationDelay: `${-i * 3.5}s` }}>
          <Glyph e={theme.floaters[i % theme.floaters.length]} size="1em" />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Appel des abysses (Abyssal) : défilement inversé, la page coule.
   --------------------------------------------------------------- */
const DEEP = ["🐟", "🐠", "🦑", "🐙", "🪼", "🐡"];

export function AbyssEffect({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("abysses", troll.params, troll.level);
  useEffect(() => {
    document.documentElement.classList.add("troll-abyss");
    const sp = ABYSS_SPEEDS[o.speed];
    const sinkPerMs = sp.px / sp.ms;
    // Tout passe par une seule boucle d'animation : la page coule en continu
    // (pas par à-coups), et sur téléphone le doigt inversé garde de l'élan.
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let touching = false;
    let pauseUntil = 0;
    let vel = 0; // px/ms, élan après un geste inversé
    let lastY = 0;
    let lastT = 0;
    const frame = (t: number) => {
      const dt = Math.min(64, t - last);
      last = t;
      if (!touching && vel !== 0) {
        acc += vel * dt;
        vel *= Math.pow(0.94, dt / 16);
        if (Math.abs(vel) < 0.01) vel = 0;
      }
      if (!touching && vel === 0 && t > pauseUntil) acc += sinkPerMs * dt;
      const step = Math.trunc(acc);
      if (step) {
        window.scrollBy(0, step);
        acc -= step;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onWheel = (e: WheelEvent) => {
      if (inTrollUi(e.target)) return;
      e.preventDefault();
      window.scrollBy({ top: -e.deltaY, left: 0 });
      pauseUntil = performance.now() + 250;
    };
    const onTouchStart = (e: TouchEvent) => {
      touching = true;
      vel = 0;
      lastY = e.touches[0]?.clientY ?? 0;
      lastT = performance.now();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!o.invert || inTrollUi(e.target)) return;
      const y = e.touches[0]?.clientY;
      if (y == null) return;
      e.preventDefault();
      const now = performance.now();
      const dy = y - lastY; // doigt vers le bas = la page descend (inversé)
      acc += dy;
      const v = dy / Math.max(1, now - lastT);
      vel = vel * 0.6 + v * 0.4;
      lastY = y;
      lastT = now;
    };
    const onTouchEnd = () => {
      touching = false;
      // Sans inversion, on laisse finir l'élan natif avant de recouler.
      pauseUntil = performance.now() + (o.invert ? 300 : 1200);
      if (!o.invert) vel = 0;
    };
    if (o.invert) window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.documentElement.classList.remove("troll-abyss");
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [o.invert, o.speed]);
  return (
    <div data-troll-ui className={`troll-abyss-water troll-abyss-d${o.darkness} pointer-events-none fixed inset-0 z-[9050] overflow-hidden`}>
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className="troll-abyss-bubble" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-i * 0.9}s`, animationDuration: `${6 + (i % 5)}s` }} />
      ))}
      {o.creatures &&
        Array.from({ length: 5 }, (_, i) => (
          <span
            key={`f${i}`}
            className="troll-abyss-fish"
            style={{ top: `${15 + ((i * 29) % 70)}%`, animationDelay: `${-i * 4.3}s`, animationDuration: `${16 + (i % 3) * 5}s`, animationDirection: i % 2 ? "reverse" : "normal" }}
          >
            <Glyph e={DEEP[i % DEEP.length]} size="1em" />
          </span>
        ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Huissier (Magnat) : avis de saisie, puis tampons « SAISI ».
   --------------------------------------------------------------- */
export function Bailiff({ troll, nickname }: { troll: ActiveTroll; nickname: string }) {
  const [letter, setLetter] = useState(true);
  const o = readOptions("huissier", troll.params, troll.level);
  const tone = BAILIFF_TONES[o.tone];
  useEffect(() => {
    if (letter) return;
    const touched: { el: HTMLElement; pos: string }[] = [];
    const stamp = () => {
      const cards = Array.from(app()?.querySelectorAll<HTMLElement>(".glass-card, .quest-card, .dossier-card") ?? []).filter(
        (c) => !c.querySelector(":scope > [data-troll-stamp]") && c.offsetParent !== null
      );
      if (!cards.length) return;
      const c = cards[Math.floor(Math.random() * cards.length)];
      if (getComputedStyle(c).position === "static") {
        touched.push({ el: c, pos: c.style.position });
        c.style.position = "relative";
      }
      const s = document.createElement("span");
      s.dataset.trollStamp = "1";
      s.className = "troll-saisi";
      s.textContent = o.word;
      s.style.setProperty("--rot", `${Math.round(Math.random() * 30 - 15)}deg`);
      c.appendChild(s);
    };
    stamp();
    const t = setInterval(stamp, o.every * 1000);
    return () => {
      clearInterval(t);
      document.querySelectorAll("[data-troll-stamp]").forEach((n) => n.remove());
      touched.forEach(({ el, pos }) => (el.style.position = pos));
    };
  }, [letter, o.word, o.every]);

  if (!letter) return null;
  const items = o.items || BAILIFF_DEFAULT_ITEMS;
  return (
    <div data-troll-ui className="troll-gate fixed inset-0 z-[9200] flex items-center justify-center bg-black/80 p-4">
      <div className="troll-contract w-full max-w-md space-y-3 rounded-lg p-6 text-paper-text shadow-2xl">
        <p className="text-right font-mono text-[10px] uppercase text-paper-text/60">Réf. SAISIE/{new Date().getFullYear()}/{troll.id}</p>
        <h2 className="text-center font-display text-3xl uppercase tracking-wide text-[#7a1d14]">{tone.title}</h2>
        <BailiffText tone={o.tone} actor={troll.actor} nickname={nickname} items={items} word={o.word} />
        <p className="font-mono text-[9px] leading-tight text-paper-text/60">
          (Rien n&apos;est réellement saisi : c&apos;est une farce de quelques minutes.)
        </p>
        <button onClick={() => setLetter(false)} className="w-full rounded-lg bg-[#7a1d14] py-2 font-display uppercase tracking-wide text-paper">
          {tone.button}
        </button>
      </div>
    </div>
  );
}

/** Corps de l'avis de saisie, selon le ton choisi (aussi utilisé en aperçu). */
export function BailiffText({ tone, actor, nickname, items, word }: { tone: string; actor: string; nickname: string; items: string; word: string }) {
  if (tone === "menacant")
    return (
      <>
        <p className="font-body text-sm leading-relaxed">
          <strong>{nickname}</strong>, ceci est votre <strong>dernier</strong> avertissement. Maître <strong>{actor}</strong> a
          constaté votre insolvabilité morale. Sont saisis sur-le-champ : <strong>{items}</strong>.
        </p>
        <p className="font-body text-sm leading-relaxed">Chaque page visitée recevra le tampon « {word} ». Nous savons où vous cliquez.</p>
      </>
    );
  if (tone === "ridicule")
    return (
      <>
        <p className="font-body text-sm leading-relaxed">
          Oyez, oyez ! Par décret de Sa Seigneurie <strong>{actor}</strong>, grand huissier des chaussettes orphelines, il est
          procédé à la saisie de : <strong>{items}</strong>, appartenant à <strong>{nickname}</strong>.
        </p>
        <p className="font-body text-sm leading-relaxed">Le tampon « {word} » a été spécialement acheté pour l&apos;occasion. Il est très content.</p>
      </>
    );
  return (
    <>
      <p className="font-body text-sm leading-relaxed">
        Par ordre de Maître <strong>{actor}</strong>, huissier de justice auprès du S.I.D., il est procédé ce jour à la saisie
        conservatoire des biens suivants de <strong>{nickname}</strong> : {items}.
      </p>
      <p className="font-body text-sm leading-relaxed">Les scellés « {word} » seront apposés sous vos yeux. Toute résistance est inutile.</p>
    </>
  );
}

/* ---------------------------------------------------------------
   Monde à l'envers (Arpenteur) : site en miroir, retournements.
   --------------------------------------------------------------- */
export function MirrorEffect({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("miroir", troll.params, troll.level);
  useEffect(() => {
    const el = app();
    if (!el) return;
    const base = `troll-mirror-${o.mode}`;
    el.classList.add(base);
    let flipOff: ReturnType<typeof setTimeout>;
    const flip = setInterval(() => {
      el.classList.add("troll-flip");
      flipOff = setTimeout(() => el.classList.remove("troll-flip"), 4000);
    }, o.every * 1000);
    return () => {
      clearInterval(flip);
      clearTimeout(flipOff);
      el.classList.remove(base, "troll-flip");
    };
  }, [o.mode, o.every]);
  return null;
}

/* ---------------------------------------------------------------
   Réécriture (Scribe) : les mots du site changent.
   --------------------------------------------------------------- */
export function RewriteEffect({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("reecriture", troll.params, troll.level);
  const key = JSON.stringify(o);
  useEffect(() => {
    const root = app();
    if (!root) return;
    const rewrite = makeRewriter(o.theme, o.custom);
    const originals = new Map<Text, { orig: string; mine: string }>();
    const skip = (n: Node) => {
      const p = n.parentElement;
      return !p || !!p.closest("script, style, textarea, input, [contenteditable], [data-troll-ui]");
    };
    const processNode = (node: Node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let t: Node | null = node.nodeType === Node.TEXT_NODE ? node : walker.nextNode();
      while (t) {
        const tn = t as Text;
        if (!skip(tn) && tn.data.trim()) {
          const known = originals.get(tn);
          if (!known || known.mine !== tn.data) {
            const orig = tn.data;
            const next = rewrite(orig);
            if (next !== orig) {
              originals.set(tn, { orig, mine: next });
              tn.data = next;
            }
          }
        }
        t = node.nodeType === Node.TEXT_NODE ? null : walker.nextNode();
      }
    };
    processNode(root);
    let pending: Node[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") pending.push(m.target);
        m.addedNodes.forEach((n) => pending.push(n));
      }
      if (!timer)
        timer = setTimeout(() => {
          const list = pending;
          pending = [];
          timer = null;
          list.forEach((n) => n.isConnected && processNode(n));
        }, 120);
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      obs.disconnect();
      if (timer) clearTimeout(timer);
      originals.forEach((v, tn) => {
        if (tn.isConnected && tn.data === v.mine) tn.data = v.orig;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/* ---------------------------------------------------------------
   Rationnement (Métronome) : un clic toutes les 8 secondes.
   --------------------------------------------------------------- */
export function Rationing({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("rationnement", troll.params, troll.level);
  const [hint, setHint] = useState<{ x: number; y: number; s: number } | null>(null);
  useEffect(() => {
    const gap = o.interval * 1000;
    let last = 0;
    let hideT: ReturnType<typeof setTimeout>;
    const block = (e: Event, x: number, y: number) => {
      const now = Date.now();
      if (now - last < gap) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setHint({ x, y, s: Math.ceil((gap - (now - last)) / 1000) });
        clearTimeout(hideT);
        hideT = setTimeout(() => setHint(null), 900);
        return;
      }
      last = now;
    };
    const onClick = (e: MouseEvent) => {
      if (inTrollUi(e.target)) return;
      block(e, e.clientX, e.clientY);
    };
    // Option « clavier aussi » : une touche (lettre, Entrée…) compte comme un clic.
    const onKey = (e: KeyboardEvent) => {
      if (inTrollUi(e.target) || e.repeat || ["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)) return;
      const r = (e.target instanceof Element ? e.target : document.body).getBoundingClientRect();
      block(e, Math.min(r.left + 20, window.innerWidth - 160), Math.max(r.top + 10, 40));
    };
    window.addEventListener("click", onClick, true);
    if (o.keys) window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
      clearTimeout(hideT);
    };
  }, [o.interval, o.keys]);
  if (!hint) return null;
  return (
    <div data-troll-ui className="troll-ration-hint pointer-events-none fixed z-[9400] rounded-full bg-[#5b2fc9] px-3 py-1 font-mono text-xs text-white shadow-lg" style={{ left: hint.x + 12, top: hint.y - 30 }}>
      <SidIcon name="notes" /> Tic… tac… encore {hint.s} s
    </div>
  );
}
