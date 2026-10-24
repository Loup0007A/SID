"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mentalQuestion } from "@/lib/mentalCalc";
import type { ActiveTroll } from "@/lib/titles";
import { HAUNT_CREATURES, readOptions } from "@/lib/trollOptions";
import { SidIcon, Glyph } from "@/components/icons/SidIcon";

/* ---------------------------------------------------------------
   Calcul forcé (Éclair Vivant) : 3 calculs du niveau 50 par page.
   --------------------------------------------------------------- */
export function CalcGate({ troll }: { troll: ActiveTroll }) {
  const o = readOptions("calcul", troll.params, troll.level);
  const NEED = o.count;
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [q, setQ] = useState(() => mentalQuestion(o.level));
  const [deadline, setDeadline] = useState(() => Date.now() + q.seconds * 1000);
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [done]);

  function next(fail?: string) {
    const nq = mentalQuestion(o.level);
    setQ(nq);
    setDeadline(Date.now() + nq.seconds * 1000);
    setValue("");
    setMsg(fail ?? null);
    setTimeout(() => input.current?.focus(), 30);
  }

  useEffect(() => {
    if (!done && now > deadline) {
      if (o.reset) setStreak(0);
      next(`Trop lent ! ${q.q} = ${q.r}.${o.reset ? " On recommence." : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  if (done) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(value.replace(/\s/g, "").replace(",", "."));
    if (!value.trim() || Number.isNaN(v)) return;
    if (v === q.r) {
      const s = streak + 1;
      setStreak(s);
      if (s >= NEED) setDone(true);
      else next();
    } else {
      if (o.reset) setStreak(0);
      next(`Faux : ${q.q} = ${q.r}.${o.reset ? " On recommence." : " Encore un essai."}`);
    }
  }

  const pct = Math.max(0, Math.min(100, ((deadline - now) / (q.seconds * 1000)) * 100));

  return (
    <div data-troll-ui className="troll-gate fixed inset-0 z-[9200] flex items-center justify-center bg-[#0d0f16]/95 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#ffe95c]/40 bg-black/40 p-6 text-center shadow-[0_0_60px_-10px_#ff8a00]">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#ffe95c]"><SidIcon name="bolt" /> Contrôle de vivacité</p>
        <p className="font-body text-sm text-paper/80">
          {troll.actor} exige {NEED} {NEED > 1 ? "calculs mentaux justes" : "calcul mental juste"}
          {o.reset && NEED > 1 ? " d'affilée" : ""} (niveau {o.level}) avant de te laisser voir cette page.
        </p>
        <div className="flex justify-center gap-2">
          {Array.from({ length: NEED }, (_, i) => (
            <span key={i} className={`h-2.5 w-10 rounded-full ${i < streak ? "bg-[#ffe95c]" : "bg-white/15"}`} />
          ))}
        </div>
        <p className="font-display text-5xl tracking-wide text-paper">{q.q}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-gradient-to-r from-[#ffe95c] to-[#ff8a00]" style={{ width: `${pct}%` }} />
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="Résultat"
            className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-center font-mono text-xl text-paper outline-none focus:border-[#ffe95c]"
          />
          <button className="rounded-lg bg-[#ffe95c] px-4 font-display uppercase text-ink">OK</button>
        </form>
        {msg && <p className="font-mono text-xs text-red">{msg}</p>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Hantise (Fantôme 404) : fausse page 404 et fantôme à attraper.
   --------------------------------------------------------------- */
export function Haunt404({ troll }: { troll: ActiveTroll }) {
  const level = Math.max(1, troll.level || 1);
  const o = readOptions("hantise", troll.params, level);
  const [haunted, setHaunted] = useState(() => Math.random() < o.chance / 100);
  const need = o.catches;
  const creature = HAUNT_CREATURES[o.creature];
  const [caught, setCaught] = useState(0);
  const [pos, setPos] = useState({ x: 50, y: 60 });
  const [boo, setBoo] = useState(false);

  useEffect(() => {
    if (!haunted) return;
    const t = setInterval(() => setPos({ x: 8 + Math.random() * 84, y: 18 + Math.random() * 70 }), Math.max(450, 1100 - level * 120));
    return () => clearInterval(t);
  }, [haunted, level]);

  if (!haunted) return null;

  function catchIt(e: React.PointerEvent) {
    e.preventDefault();
    setBoo(true);
    setTimeout(() => setBoo(false), 200);
    setPos({ x: 8 + Math.random() * 84, y: 18 + Math.random() * 70 });
    setCaught((c) => {
      if (c + 1 >= need) setTimeout(() => setHaunted(false), 250);
      return c + 1;
    });
  }

  return (
    <div data-troll-ui className="troll-haunt fixed inset-0 z-[9200] overflow-hidden bg-ink">
      <div className="flex h-full items-center justify-center px-4">
        <div className="glass-card max-w-md space-y-3 p-8 text-center">
          <p className="troll-glitch-text font-mono text-xs uppercase tracking-[0.3em] text-red">Erreur 404</p>
          <h1 className="font-display text-3xl uppercase tracking-wide">Dossier introuvable</h1>
          <p className="font-body text-paper/70">{o.message || `Cette page n'existe pas, ou a été dévorée par un${o.creature === "chauvesouris" || o.creature === "citrouille" ? "e" : ""} ${creature.label.toLowerCase()}.`}</p>
          <p className="font-mono text-xs text-paper/50">
            Attrape <Glyph e={creature.emoji} /> de {troll.actor} pour la récupérer : {caught} / {need}
          </p>
        </div>
      </div>
      <button
        onPointerDown={catchIt}
        className={`troll-ghost absolute text-5xl ${boo ? "scale-125" : ""}`}
        style={{ left: `${pos.x}%`, top: `${pos.y}%`, transitionDuration: `${Math.max(250, 700 - level * 80)}ms` }}
        aria-label={creature.label}
      >
        <Glyph e={creature.emoji} size="1em" />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------
   Avenant obligatoire (Lecteur des Petites Lignes).
   --------------------------------------------------------------- */
const CLAUSES = (actor: string, me: string) => [
  `Le soussigné, ${me}, reconnaît que ${actor} a toujours raison, y compris quand il a tort.`,
  "Toute lecture en diagonale du présent avenant entraîne sa relecture intégrale.",
  `Le soussigné s'engage à appeler ${actor} « Maître » pendant une durée indéterminée, renouvelable tacitement.`,
  "Les zénis du soussigné restent les siens, sauf mention contraire écrite en très petits caractères ci-dessous.",
  "Le soussigné renonce à tout recours contre les pigeons voyageurs, les dragons et les huissiers.",
  "Le présent avenant s'applique rétroactivement à hier, et par anticipation à demain.",
  "Toute tentative de fermer cet onglet sera considérée comme une acceptation enthousiaste.",
  `En cas de litige, le tribunal compétent est la chambre à coucher de ${actor}.`,
  "Le soussigné certifie avoir lu la clause 9 avant la clause 8.",
  "La case à cocher ci-dessous est timide. Le soussigné s'engage à la traiter avec douceur.",
  "Le présent avenant est valable sur toutes les pages, toutes les dimensions et tous les donjons.",
  "Fait au S.I.D., en un seul exemplaire, que personne ne gardera.",
];

export function ContractGate({ troll, nickname }: { troll: ActiveTroll; nickname: string }) {
  const o = readOptions("avenant", troll.params, troll.level);
  const [open, setOpen] = useState(true);
  const [signed, setSigned] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [dodges, setDodges] = useState(0);
  const [boxPos, setBoxPos] = useState({ x: 0, y: 0 });
  const num = useMemo(() => Math.floor(1000 + Math.random() * 9000), []);
  const clauses = useMemo(() => [...o.clauses.map((c) => `Clause particulière de ${troll.actor} : ${c}`), ...CLAUSES(troll.actor, nickname)], [troll.actor, nickname, o.clauses]);
  const formula = `Lu et approuvé, ${troll.actor} a toujours raison`;
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
  const signOk = !o.signature || norm(signed) === norm(formula);

  if (!open) return null;

  function dodge() {
    if (checked || dodges >= o.dodges) return false;
    setDodges((d) => d + 1);
    setBoxPos({ x: (Math.random() - 0.5) * 220, y: (Math.random() - 0.5) * 40 });
    return true;
  }

  return (
    <div data-troll-ui className="troll-gate fixed inset-0 z-[9200] flex items-center justify-center bg-black/85 p-4">
      <div className="troll-contract w-full max-w-lg space-y-3 rounded-lg p-6 text-paper-text shadow-2xl">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-paper-text/60">Avenant n° {num} aux conditions d&apos;utilisation</p>
        <h2 className="text-center font-display text-2xl uppercase tracking-wide">À lire et signer</h2>
        <div
          className="h-56 space-y-2 overflow-y-auto rounded border border-paper-text/20 bg-white/40 p-3 font-body text-sm leading-relaxed"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 6) setScrolled(true);
          }}
        >
          <p className="italic">Présenté par Maître {troll.actor}, Lecteur des Petites Lignes.</p>
          {clauses.map((c, i) => (
            <p key={i}>
              <strong>Article {i + 1}.</strong> {c}
            </p>
          ))}
          <p className="text-[9px] leading-tight opacity-70">
            Les présentes ont été rédigées en toute mauvaise foi. Aucune donnée n&apos;est réellement engagée. Ce contrat
            disparaîtra à la fin de la farce, dans quelques minutes.
          </p>
        </div>
        {!scrolled && <p className="text-center font-mono text-[11px] text-paper-text/60">Lis jusqu&apos;en bas pour pouvoir signer.</p>}
        <div className="flex min-h-[3.5rem] items-center justify-center">
          <label
            className="flex cursor-pointer items-center gap-2 font-mono text-sm transition-transform duration-200"
            style={{ transform: `translate(${boxPos.x}px, ${boxPos.y}px)` }}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse" && scrolled) dodge();
            }}
          >
            <input
              type="checkbox"
              disabled={!scrolled}
              checked={checked}
              onChange={(e) => {
                if (e.target.checked && dodge()) return;
                setChecked(e.target.checked);
              }}
              className="h-4 w-4 accent-[#7a1d14]"
            />
            J&apos;accepte sans réserve
          </label>
        </div>
        {o.signature && (
          <label className="block space-y-1 font-mono text-[11px]">
            <span>Recopie à la main : « {formula} »</span>
            <input
              value={signed}
              onChange={(e) => setSigned(e.target.value)}
              onPaste={(e) => e.preventDefault()}
              autoComplete="off"
              className="w-full rounded border border-paper-text/30 bg-white/60 px-2 py-1.5 font-body text-sm italic text-paper-text outline-none focus:border-[#7a1d14]"
            />
          </label>
        )}
        <button
          disabled={!checked || !signOk}
          onClick={() => setOpen(false)}
          className="w-full rounded-lg bg-[#7a1d14] py-2 font-display uppercase tracking-wide text-paper disabled:opacity-30"
        >
          <SidIcon name="pen" /> Signer
        </button>
      </div>
    </div>
  );
}
