"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NETWORK_NODES, type ActiveTroll } from "@/lib/titles";

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
const PARTY_COLORS = ["#ffe08a", "#ff6b8a", "#62d8ff", "#9dffbf", "#d2a0ff", "#ff9d3b"];

function burst(layer: HTMLElement, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
    p.className = "troll-confetto";
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = PARTY_COLORS[i % PARTY_COLORS.length];
    p.style.setProperty("--tx", `${Math.cos(a) * d}px`);
    p.style.setProperty("--ty", `${Math.sin(a) * d - 40}px`);
    p.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    layer.appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }
}

export function PartyMode({ troll, nickname }: { troll: ActiveTroll; nickname: string }) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const big = Math.min(5, troll.level || 1);
    document.documentElement.classList.add("troll-party-cursor");
    const onClick = (e: MouseEvent) => layer.current && burst(layer.current, e.clientX, e.clientY, 14 + big * 4);
    window.addEventListener("click", onClick, true);
    const rain = setInterval(() => {
      if (!layer.current) return;
      for (let i = 0; i < 6; i++) burst(layer.current, Math.random() * window.innerWidth, -10, 6);
    }, 9000);
    return () => {
      document.documentElement.classList.remove("troll-party-cursor");
      window.removeEventListener("click", onClick, true);
      clearInterval(rain);
    };
  }, [troll.level]);
  return (
    <div data-troll-ui className="pointer-events-none fixed inset-0 z-[9100] overflow-hidden" ref={layer}>
      <div className="troll-party-banner absolute inset-x-0 top-0 py-1.5 text-center font-display text-sm uppercase tracking-wider text-ink">
        🎉 {troll.everyone ? `${troll.actor} offre une fête à tout le S.I.D. !` : `Joyeux non-anniversaire, ${nickname} ! — offert par ${troll.actor}`} 🎉
      </div>
      <div className="troll-balloon" style={{ left: "12%", animationDelay: "-2s" }}>🎈</div>
      <div className="troll-balloon" style={{ left: "78%", animationDelay: "-7s" }}>🎈</div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Appel des abysses (Abyssal) : défilement inversé, la page coule.
   --------------------------------------------------------------- */
export function AbyssEffect() {
  useEffect(() => {
    document.documentElement.classList.add("troll-abyss");
    const onWheel = (e: WheelEvent) => {
      if (inTrollUi(e.target)) return;
      e.preventDefault();
      window.scrollBy({ top: -e.deltaY, left: 0 });
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    const sink = setInterval(() => window.scrollBy(0, 1), 60);
    return () => {
      document.documentElement.classList.remove("troll-abyss");
      window.removeEventListener("wheel", onWheel);
      clearInterval(sink);
    };
  }, []);
  return (
    <div data-troll-ui className="troll-abyss-water pointer-events-none fixed inset-0 z-[9050] overflow-hidden">
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className="troll-abyss-bubble" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-i * 0.9}s`, animationDuration: `${6 + (i % 5)}s` }} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Huissier (Magnat) : avis de saisie, puis tampons « SAISI ».
   --------------------------------------------------------------- */
export function Bailiff({ troll, nickname }: { troll: ActiveTroll; nickname: string }) {
  const [letter, setLetter] = useState(true);
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
      s.textContent = "SAISI";
      s.style.setProperty("--rot", `${Math.round(Math.random() * 30 - 15)}deg`);
      c.appendChild(s);
    };
    stamp();
    const t = setInterval(stamp, 2500);
    return () => {
      clearInterval(t);
      document.querySelectorAll("[data-troll-stamp]").forEach((n) => n.remove());
      touched.forEach(({ el, pos }) => (el.style.position = pos));
    };
  }, [letter]);

  if (!letter) return null;
  return (
    <div data-troll-ui className="troll-gate fixed inset-0 z-[9200] flex items-center justify-center bg-black/80 p-4">
      <div className="troll-contract w-full max-w-md space-y-3 rounded-lg p-6 text-paper-text shadow-2xl">
        <p className="text-right font-mono text-[10px] uppercase text-paper-text/60">Réf. SAISIE/{new Date().getFullYear()}/{troll.id}</p>
        <h2 className="text-center font-display text-3xl uppercase tracking-wide text-[#7a1d14]">Avis de saisie</h2>
        <p className="font-body text-sm leading-relaxed">
          Par ordre de Maître <strong>{troll.actor}</strong>, Magnat Insatiable et huissier de justice auprès du S.I.D., il
          est procédé ce jour à la saisie conservatoire de l&apos;ensemble des biens de <strong>{nickname}</strong> :
          dossier, zénis, objets, quêtes, dignité.
        </p>
        <p className="font-body text-sm leading-relaxed">Les scellés seront apposés sous vos yeux. Toute résistance est inutile.</p>
        <p className="font-mono text-[9px] leading-tight text-paper-text/60">
          (Rien n&apos;est réellement saisi : c&apos;est une farce de quelques minutes.)
        </p>
        <button onClick={() => setLetter(false)} className="w-full rounded-lg bg-[#7a1d14] py-2 font-display uppercase tracking-wide text-paper">
          Je proteste… mais j&apos;obtempère
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Monde à l'envers (Arpenteur) : site en miroir, retournements.
   --------------------------------------------------------------- */
export function MirrorEffect() {
  useEffect(() => {
    const el = app();
    if (!el) return;
    el.classList.add("troll-mirror");
    let flipOff: ReturnType<typeof setTimeout>;
    const flip = setInterval(() => {
      el.classList.add("troll-flip");
      flipOff = setTimeout(() => el.classList.remove("troll-flip"), 4000);
    }, 70000);
    return () => {
      clearInterval(flip);
      clearTimeout(flipOff);
      el.classList.remove("troll-mirror", "troll-flip");
    };
  }, []);
  return null;
}

/* ---------------------------------------------------------------
   Réécriture (Scribe) : les mots du site changent.
   --------------------------------------------------------------- */
const WORDS: [string, string][] = [
  ["quêtes", "patates"], ["quête", "patate"], ["zénis", "cailloux"], ["zéni", "caillou"],
  ["missions", "siestes"], ["mission", "sieste"], ["membres", "pingouins"], ["membre", "pingouin"],
  ["dossiers", "doudous"], ["dossier", "doudou"], ["boutique", "brocante"], ["banque", "tirelire"],
  ["classement", "concours de grimaces"], ["puissance", "mollesse"], ["messagerie", "pigeonnier"],
  ["messages", "pigeons"], ["message", "pigeon"], ["carte", "nappe"], ["entreprises", "stands de limonade"],
  ["entreprise", "stand de limonade"], ["simulations", "siestes éveillées"], ["simulation", "sieste éveillée"],
  ["notifications", "ragots"], ["notification", "ragot"], ["accueil", "vestibule"], ["profil", "portrait"],
  ["titres", "sobriquets"], ["titre", "sobriquet"], ["administration", "grande chambellerie"], ["admin", "grand chambellan"],
  ["argent", "monnaie de singe"], ["solde", "tas de cailloux"], ["recrutement", "casting"],
  ["organigramme", "arbre généalogique"], ["trombinoscope", "album de famille"], ["intelligence", "jugeote"],
  ["technique", "bricolage"], ["réglages", "caprices"], ["données", "secrets"], ["envoyer", "chuchoter"],
  ["valider", "bénir"], ["acheter", "troquer"], ["enregistrer", "graver"], ["déconnexion", "évasion"],
];
const WORD_RE = new RegExp(`(^|[^\\p{L}])(${WORDS.map((w) => w[0]).join("|")})(?=[^\\p{L}]|$)`, "giu");
const WORD_MAP = new Map(WORDS);

function rewrite(text: string): string {
  return text
    .replace(/S\.I\.D\.?/g, "S.O.S.")
    .replace(WORD_RE, (_m, pre: string, w: string) => {
      const rep = WORD_MAP.get(w.toLowerCase()) ?? w;
      const out = w === w.toUpperCase() ? rep.toUpperCase() : w[0] === w[0].toUpperCase() ? rep[0].toUpperCase() + rep.slice(1) : rep;
      return pre + out;
    });
}

export function RewriteEffect() {
  useEffect(() => {
    const root = app();
    if (!root) return;
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
  }, []);
  return null;
}

/* ---------------------------------------------------------------
   Rationnement (Métronome) : un clic toutes les 8 secondes.
   --------------------------------------------------------------- */
export function Rationing() {
  const [hint, setHint] = useState<{ x: number; y: number; s: number } | null>(null);
  useEffect(() => {
    let last = 0;
    let hideT: ReturnType<typeof setTimeout>;
    const onClick = (e: MouseEvent) => {
      if (inTrollUi(e.target)) return;
      const now = Date.now();
      if (now - last < 8000) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setHint({ x: e.clientX, y: e.clientY, s: Math.ceil((8000 - (now - last)) / 1000) });
        clearTimeout(hideT);
        hideT = setTimeout(() => setHint(null), 900);
        return;
      }
      last = now;
    };
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      clearTimeout(hideT);
    };
  }, []);
  if (!hint) return null;
  return (
    <div data-troll-ui className="troll-ration-hint pointer-events-none fixed z-[9400] rounded-full bg-[#5b2fc9] px-3 py-1 font-mono text-xs text-white shadow-lg" style={{ left: hint.x + 12, top: hint.y - 30 }}>
      🎵 Tic… tac… encore {hint.s} s
    </div>
  );
}
