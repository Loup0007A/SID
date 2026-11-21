"use client";

import "./seasonal-decor.css";
import "./holidays.css";
import "./election.css";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Élection du Dictateur (Lot 80, migration 0098) : une petite fête. Compte à
 * rebours, puis la proclamation (une fois pour chaque membre) et le portrait
 * du nouveau Dictateur. Pas de vote : le S.I.D. désigne l'élu (Modération).
 * Le serveur ne donne le nom qu'à l'heure de la proclamation.
 *
 * Lot 91 (migration 0111) : l'élu peut aussi prendre le pouvoir par la
 * force (mode « force », secret jusqu'à la proclamation). Même titre ;
 * tout passe au rouge sang : alarme, bande d'alerte, cérémonie de coup d'État.
 */

export type Winner = { id: string; nickname: string; avatar_url: string | null };
export type ElectionState = {
  on: boolean;
  now: string;
  starts_at: string | null;
  reveal_at: string | null;
  ends_at: string | null;
  revealed: boolean;
  /** Connu seulement après la proclamation : « election » ou « force ». */
  mode?: "election" | "force" | null;
  winner: Winner | null;
};

/** L'élu a pris le pouvoir par la force (et c'est proclamé). */
export const isForce = (s: ElectionState | null | undefined) => !!s?.revealed && s.mode === "force";

export const ELECTION_REPLAY_EVENT = "sid:election-replay";
const seenKey = (reveal: string) => `sid-election-seen-${new Date(reveal).getTime()}`;

let cache: { at: number; value: ElectionState | null; skew: number } | null = null;
let inflight: Promise<{ value: ElectionState | null; skew: number }> | null = null;
const listeners = new Set<() => void>();

async function fetchElection(force = false) {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await createClient().rpc("election_status");
    const value = error ? null : ((data as ElectionState | null) ?? null);
    const skew = value?.now ? new Date(value.now).getTime() - Date.now() : 0;
    cache = { at: Date.now(), value, skew };
    inflight = null;
    listeners.forEach((l) => l());
    return cache;
  })();
  return inflight;
}

/** État de l'élection, relu à l'heure de la proclamation. */
export function useElection() {
  const [snap, setSnap] = useState(cache);
  useEffect(() => {
    const on = () => setSnap(cache);
    listeners.add(on);
    void fetchElection().then(on);
    return () => {
      listeners.delete(on);
    };
  }, []);

  const s = snap?.value ?? null;
  const skew = snap?.skew ?? 0;
  // À l'heure dite, on redemande : le nom n'arrive qu'à ce moment-là.
  useEffect(() => {
    if (!s?.reveal_at || s.revealed) return;
    const ms = new Date(s.reveal_at).getTime() - (Date.now() + skew) + 800;
    if (ms > 2_147_000_000) return;
    const t = setTimeout(() => void fetchElection(true), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [s?.reveal_at, s?.revealed, skew]);

  return { state: s, skew };
}

function useNow(skew: number, every = 1000) {
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    setNow(Date.now() + skew);
    const id = setInterval(() => setNow(Date.now() + skew), every);
    return () => clearInterval(id);
  }, [skew, every]);
  return now;
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/* ---------------------------------------------------------------
   Dessins
   --------------------------------------------------------------- */

export function CrownArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden>
      <path d="M6 38 L10 10 L22 24 L32 4 L42 24 L54 10 L58 38 Z" fill="url(#el-gold)" stroke="#8a5a10" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="6" y="38" width="52" height="7" rx="2" fill="url(#el-gold)" stroke="#8a5a10" strokeWidth="1.5" />
      <circle cx="32" cy="27" r="3.4" fill="#c8324f" />
      <circle cx="18" cy="31" r="2.4" fill="#2f6fd0" />
      <circle cx="46" cy="31" r="2.4" fill="#2f6fd0" />
      <circle cx="10" cy="10" r="2.6" fill="#ffe9a8" />
      <circle cx="32" cy="4" r="2.6" fill="#ffe9a8" />
      <circle cx="54" cy="10" r="2.6" fill="#ffe9a8" />
      <defs>
        <linearGradient id="el-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.55" stopColor="#e9b545" />
          <stop offset="1" stopColor="#b5832a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Confetti({ count, className = "" }: { count: number; className?: string }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (k: number) => {
          const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        return {
          i,
          style: {
            left: `${(r(1) * 100).toFixed(1)}%`,
            animationDelay: `${(-r(2) * 12).toFixed(2)}s`,
            animationDuration: `${(8 + r(3) * 8).toFixed(2)}s`,
            background: ["#f0c27a", "#c8324f", "#f6eedb", "#7a1430", "#ffd86b"][i % 5],
            ["--sway" as string]: `${((r(4) - 0.5) * 140).toFixed(0)}px`,
            ["--spin" as string]: `${Math.round(360 + r(5) * 720)}deg`,
            width: `${(5 + r(6) * 5).toFixed(1)}px`,
            height: `${(8 + r(7) * 6).toFixed(1)}px`,
          } as CSSProperties,
        };
      }),
    [count],
  );
  return (
    <div className={`el-confetti ${className}`} aria-hidden>
      {bits.map((b) => (
        <i key={b.i} style={b.style} />
      ))}
    </div>
  );
}

function Portrait({ w, size = 96 }: { w: Winner; size?: number }) {
  return (
    <span className="el-portrait" style={{ width: size, height: size, marginTop: Math.round(size * 0.3) }}>
      <CrownArt className="el-portrait-crown" />
      {w.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={w.avatar_url} alt="" className="el-portrait-img" />
      ) : (
        <span className="el-portrait-initials">{w.nickname.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------
   Décor (toutes les pages)
   --------------------------------------------------------------- */

export function ElectionDecor() {
  const [mounted, setMounted] = useState(false);
  const { state } = useElection();
  const force = isForce(state);
  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add("decor-election");
    return () => document.documentElement.classList.remove("decor-election");
  }, []);
  // Par la force : thème rouge sang (fonds.css) et alarme sur les bords.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("election-force", force);
    if (force) {
      root.dataset.electionMode = "force";
      root.dataset.theme = "election_force";
    } else {
      delete root.dataset.electionMode;
      if (root.dataset.theme === "election_force") root.dataset.theme = "election";
    }
    return () => {
      root.classList.remove("election-force");
      delete root.dataset.electionMode;
    };
  }, [force]);
  if (!mounted) return null;
  return createPortal(
    <div className="hd-front" aria-hidden>
      {force ? <div className="el-alarm" /> : <Confetti count={22} className="el-confetti-soft" />}
    </div>,
    document.body,
  );
}

const TAPE = "ALERTE · COUP D'ÉTAT · LE CONSEIL EST DISSOUS · COUVRE-FEU EN VIGUEUR · ";

/** Bande d'alerte, à la place des fanions, quand le pouvoir est pris par la force. */
function AlertTape() {
  return (
    <div className="el-tape" aria-hidden>
      <div className="el-tape-track">
        {[0, 1, 2, 3].map((i) => (
          <span key={i}>{TAPE}</span>
        ))}
      </div>
    </div>
  );
}

/** Fanions pourpre et or sous la barre du haut. */
export function ElectionGarland() {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { state } = useElection();
  const force = isForce(state);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [force]);
  if (force) return <AlertTape />;
  if (!width) return <div ref={box} className="nl-garland-box" aria-hidden />;
  const small = width < 640;
  const swag = small ? 120 : 170;
  const sag = small ? 6 : 9;
  const per = small ? 6 : 9;
  const n = Math.ceil(width / swag);
  let wire = "M0 1";
  const flags: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * swag;
    wire += ` Q${x0 + swag / 2} ${1 + sag * 2} ${x0 + swag} 1`;
    for (let k = 1; k <= per; k++) {
      const t = k / (per + 1);
      flags.push({ x: x0 + swag * t, y: 1 + 4 * sag * t * (1 - t), r: (Math.atan((4 * sag * (1 - 2 * t)) / swag) * 180) / Math.PI });
    }
  }
  return (
    <div ref={box} className="nl-garland-box" aria-hidden>
      <svg className="nl-garland el-garland" width={width} height={sag * 2 + 24} viewBox={`0 0 ${width} ${sag * 2 + 24}`}>
        <path d={wire} className="el-wire" />
        {flags.map((f, i) => (
          <g key={i} transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.r.toFixed(1)})`}>
            <path d="M-7 1 L7 1 L0 15 Z" className={`el-flag el-flag-${i % 3}`} />
            {i % 3 === 1 && <path d="M-3 6 L-2 3 L0 5 L2 3 L3 6 Z" fill="#7a1430" />}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------
   Accueil : phrase, tableau ; pied de page
   --------------------------------------------------------------- */

export function ElectionGreeting() {
  const { state } = useElection();
  if (!state?.on) return null;
  let text = "Le S.I.D. s'apprête à proclamer son Dictateur.";
  if (state.revealed)
    text = state.winner
      ? isForce(state)
        ? `Coup d'État : ${state.winner.nickname} a pris le pouvoir par la force. Couvre-feu en vigueur.`
        : `Vive ${state.winner.nickname}, Dictateur du S.I.D. !`
      : "Le Conseil du S.I.D. délibère encore…";
  else if (state.reveal_at) text = `Le S.I.D. attend son nouveau Dictateur. Proclamation ${fmtDay(state.reveal_at)}.`;
  return <p className="el-greeting mt-1 font-body text-sm italic">{text}</p>;
}

export function ElectionBoard() {
  const { state, skew } = useElection();
  const now = useNow(skew);
  if (!state?.on) return null;

  if (state.revealed && state.winner && isForce(state)) {
    const w = state.winner;
    return (
      <section className="el-board is-force glass-card nuit" aria-label="Coup d'État">
        <div className="relative z-[1] flex flex-wrap items-center gap-5">
          <Portrait w={w} size={88} />
          <div className="min-w-0 flex-1">
            <p className="el-kicker">⚠ Coup d&apos;État</p>
            <p className="el-name wrap-any">{w.nickname}</p>
            <p className="font-body text-sm text-paper/80">
              A pris le pouvoir par la force {state.reveal_at ? fmtDay(state.reveal_at) : "cette nuit"}. Le Conseil est dissous. Dictateur du S.I.D.
            </p>
          </div>
          <button type="button" onClick={() => window.dispatchEvent(new Event(ELECTION_REPLAY_EVENT))} className="el-btn">
            Revoir la prise du pouvoir
          </button>
        </div>
      </section>
    );
  }

  if (state.revealed && state.winner) {
    const w = state.winner;
    return (
      <section className="el-board glass-card nuit" aria-label="Le nouveau Dictateur">
        <Confetti count={18} className="el-confetti-card" />
        <div className="relative z-[1] flex flex-wrap items-center gap-5">
          <Portrait w={w} size={88} />
          <div className="min-w-0 flex-1">
            <p className="el-kicker">Élection du Dictateur</p>
            <p className="el-name wrap-any">{w.nickname}</p>
            <p className="font-body text-sm text-paper/75">
              Dictateur du S.I.D. depuis {state.reveal_at ? fmtDay(state.reveal_at) : "ce soir"}. Vive le Dictateur !
            </p>
          </div>
          <button type="button" onClick={() => window.dispatchEvent(new Event(ELECTION_REPLAY_EVENT))} className="el-btn">
            Revoir la proclamation
          </button>
        </div>
      </section>
    );
  }

  if (state.revealed) {
    return (
      <section className="el-board glass-card nuit" aria-label="Élection du Dictateur">
        <p className="el-kicker">Élection du Dictateur</p>
        <p className="font-body text-paper/80">Le Conseil du S.I.D. délibère encore. Le nom tombera dans un instant.</p>
      </section>
    );
  }

  const t = state.reveal_at ? left(new Date(state.reveal_at).getTime() - now) : null;
  return (
    <section className="el-board glass-card nuit" aria-label="Élection du Dictateur">
      <div className="relative z-[1] flex flex-wrap items-center gap-5">
        <CrownArt className="el-board-crown" />
        <div className="min-w-0 flex-1">
          <p className="el-kicker">Élection du Dictateur</p>
          <p className="font-body text-sm text-paper/80">Pas de bulletin, pas d&apos;urne : le S.I.D. a déjà choisi. Il ne reste qu&apos;à l&apos;annoncer.</p>
          {state.reveal_at && <p className="mt-1 font-mono text-xs text-paper/60">Proclamation {fmtDay(state.reveal_at)}</p>}
        </div>
        {t && (
          <div className="el-count" role="timer" aria-label="Avant la proclamation">
            {t.d > 0 && (
              <span>
                <b>{t.d}</b>j
              </span>
            )}
            <span>
              <b>{String(t.h).padStart(2, "0")}</b>h
            </span>
            <span>
              <b>{String(t.m).padStart(2, "0")}</b>min
            </span>
            <span>
              <b>{String(t.s).padStart(2, "0")}</b>s
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

const FOOTER_LINES = [
  "Vive le Dictateur !",
  "Un seul candidat, aucune surprise.",
  "Le dépouillement s'est terminé avant le vote.",
  "Le S.I.D. a toujours raison.",
  "Applaudissements obligatoires.",
];

const FORCE_LINES = [
  "Toute résistance est inutile.",
  "Le Conseil n'a pas eu le temps de voter.",
  "Couvre-feu à 22 h. Pour tout le monde.",
  "Les urnes ont été confisquées.",
  "Le S.I.D. obéit.",
];

export function ElectionFooter() {
  const [msg, setMsg] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const { state } = useElection();
  const lines = isForce(state) ? FORCE_LINES : FOOTER_LINES;
  return (
    <span className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label="Couronne du Dictateur"
        onClick={() => {
          setMsg(lines[Math.floor(Math.random() * lines.length)]);
          setBurst((b) => b + 1);
          setTimeout(() => setMsg(null), 2800);
        }}
        className={`hd-footer el-footer ${burst ? "is-open" : ""}`}
      >
        <CrownArt />
      </button>
      {burst > 0 && (
        <span key={burst} className="nl-sparkles" aria-hidden>
          {["✦", "•", "✧", "•", "✦", "•"].map((c, i) => (
            <span key={i} style={{ ["--x" as string]: `${(i - 2.5) * 16}px`, ["--r" as string]: `${(i - 2.5) * 40}deg`, color: i % 2 ? "#c8324f" : "#f0c27a" } as CSSProperties}>
              {c}
            </span>
          ))}
        </span>
      )}
      {msg && (
        <span role="status" className="hd-bubble el-bubble">
          {msg}
        </span>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------
   Cérémonie de proclamation (une fois par membre et par élection)
   --------------------------------------------------------------- */

type Stage = "council" | "suspense" | "reveal";

export function ElectionCeremony() {
  const { state } = useElection();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("council");
  const [still, setStill] = useState(false);

  useEffect(() => setStill(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches), []);

  // Première visite après la proclamation : la cérémonie s'ouvre d'elle-même.
  useEffect(() => {
    if (!state?.on || !state.revealed || !state.winner || !state.reveal_at) return;
    try {
      if (localStorage.getItem(seenKey(state.reveal_at))) return;
      localStorage.setItem(seenKey(state.reveal_at), "1");
    } catch {
      /* stockage indisponible : on l'ouvre quand même */
    }
    setStage(still ? "reveal" : "council");
    setOpen(true);
  }, [state?.on, state?.revealed, state?.winner, state?.reveal_at, still]);

  // « Revoir la proclamation ».
  useEffect(() => {
    const replay = () => {
      setStage(still ? "reveal" : "council");
      setOpen(true);
    };
    window.addEventListener(ELECTION_REPLAY_EVENT, replay);
    return () => window.removeEventListener(ELECTION_REPLAY_EVENT, replay);
  }, [still]);

  useEffect(() => {
    if (!open || stage === "reveal") return;
    const t = setTimeout(() => setStage(stage === "council" ? "suspense" : "reveal"), stage === "council" ? 2400 : 2600);
    return () => clearTimeout(t);
  }, [open, stage]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const w = state?.winner;
  const force = isForce(state);
  if (!open || !w) return null;
  // Par la force : alarme, gyrophares rouges, bandes d'alerte ; pas de confettis.
  if (force)
    return createPortal(
      <div className="el-ceremony is-force" role="alertdialog" aria-modal="true" aria-label="Coup d'État">
        <AlertTape />
        <span className="el-beam el-beam-l is-strong" aria-hidden />
        <span className="el-beam el-beam-r is-strong" aria-hidden />
        <div className="el-stage">
          {stage === "council" && <p className="el-line el-line-alert">Alerte. Alerte.</p>}
          {stage === "suspense" && <p className="el-line">Le Conseil du S.I.D. vient d&apos;être renversé.</p>}
          {stage === "reveal" && (
            <div className="el-reveal">
              <Portrait w={w} size={132} />
              <p className="el-reveal-name wrap-any">{w.nickname}</p>
              <p className="el-reveal-force">a pris le pouvoir par la force</p>
              <p className="el-reveal-sub">Dictateur du S.I.D.</p>
              <button type="button" autoFocus onClick={() => setOpen(false)} className="el-btn el-btn-lg">
                <SidIcon name="crown" /> Se soumettre
              </button>
            </div>
          )}
        </div>
        <div className="el-tape-bottom">
          <AlertTape />
        </div>
        {stage !== "reveal" && (
          <button type="button" onClick={() => setStage("reveal")} className="el-skip">
            Passer
          </button>
        )}
      </div>,
      document.body,
    );
  return createPortal(
    <div className="el-ceremony" role="dialog" aria-modal="true" aria-label="Proclamation du Dictateur">
      <span className="el-beam el-beam-l is-strong" aria-hidden />
      <span className="el-beam el-beam-r is-strong" aria-hidden />
      {stage === "reveal" && !still && <Confetti count={70} className="el-confetti-burst" />}
      <div className="el-stage">
        {stage === "council" && <p className="el-line">Le Conseil du S.I.D. a délibéré.</p>}
        {stage === "suspense" && (
          <p className="el-line">
            Le nouveau Dictateur est<span className="el-dots" aria-hidden>…</span>
          </p>
        )}
        {stage === "reveal" && (
          <div className="el-reveal">
            <Portrait w={w} size={132} />
            <p className="el-reveal-name wrap-any">{w.nickname}</p>
            <p className="el-reveal-sub">Dictateur du S.I.D.</p>
            <button type="button" autoFocus onClick={() => setOpen(false)} className="el-btn el-btn-lg">
              <SidIcon name="crown" /> Vive le Dictateur !
            </button>
          </div>
        )}
      </div>
      {stage !== "reveal" && (
        <button type="button" onClick={() => setStage("reveal")} className="el-skip">
          Passer
        </button>
      )}
    </div>,
    document.body,
  );
}
