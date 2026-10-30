"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { ChatKind, ChatMessage } from "@/types/database";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Messagerie RP (Lot 62). Cinq façons de parler :
 *  - parler (bulle habituelle) ;
 *  - action  « /me dégaine son sabre »  → « ✦ Bob dégaine son sabre » ;
 *  - hors-RP « ((je reviens)) » ou « /hrp … » → discret, entre parenthèses ;
 *  - narration « /narr … » (maîtres du jeu) → encadré de récit ;
 *  - dés « /des 2d6+1 » → lancer tiré par le serveur, impossible à truquer.
 */

export type RpMode = Exclude<ChatKind, "roll">;
export type RpParsed = { kind: RpMode; content: string } | { roll: string } | { error: string };

export const RP_MODES: { key: RpMode; label: string; hint: string; placeholder: string }[] = [
  { key: "say", label: "Parler", hint: "Ce que dit ton personnage", placeholder: "Ton personnage dit…" },
  { key: "action", label: "Action", hint: "Ce que fait ton personnage (/me)", placeholder: "…dégaine son sabre (ton nom est ajouté devant)" },
  { key: "hrp", label: "Hors-RP", hint: "Toi, pas ton personnage (( ))", placeholder: "Message hors-RP…" },
  { key: "narration", label: "Narration", hint: "La voix du récit (maîtres du jeu)", placeholder: "Le récit : la pluie redouble sur les toits…" },
];

/** Lit les raccourcis tapés ; sinon, le mode choisi. */
export function parseRp(text: string, mode: RpMode, canNarrate: boolean): RpParsed {
  const t = text.trim();
  const cmd = t.match(/^\/(me|action|hrp|narr|narration|des|dés|roll|r)\b\s*([\s\S]*)$/i);
  if (cmd) {
    const name = cmd[1].toLowerCase();
    const rest = cmd[2].trim();
    if (["des", "dés", "roll", "r"].includes(name)) return { roll: rest || "1d20" };
    if (!rest) return { error: "Il manque le texte après la commande." };
    if (name === "me" || name === "action") return { kind: "action", content: rest };
    if (name === "hrp") return { kind: "hrp", content: rest };
    if (!canNarrate) return { error: "La narration est réservée aux maîtres du jeu." };
    return { kind: "narration", content: rest };
  }
  const hrp = t.match(/^\(\(([\s\S]*)\)\)$/);
  if (hrp && hrp[1].trim()) return { kind: "hrp", content: hrp[1].trim() };
  if (mode === "narration" && !canNarrate) return { kind: "say", content: t };
  return { kind: mode, content: t };
}

export const ROLL_ERRORS: Record<string, string> = {
  invalid: "Lancer non compris : essaie « 1d20 », « 2d6+1 » ou « d100 ».",
  limits: "Entre 1 et 20 dés, de 2 à 1000 faces.",
  forbidden: "Tu ne fais pas partie de cette conversation.",
  muted: "Tu ne peux pas écrire pour le moment.",
  disabled: "La messagerie est suspendue.",
};

const DICE = ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20", "1d100", "2d6"];

/** Choix du mode + dés, au-dessus du champ de saisie. */
export function RpBar({ mode, onMode, canNarrate, onRoll }: { mode: RpMode; onMode: (m: RpMode) => void; canNarrate: boolean; onRoll: (expr: string) => void }) {
  const [dice, setDice] = useState(false);
  const [custom, setCustom] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dice) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setDice(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDice(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [dice]);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Façon de parler">
      {RP_MODES.filter((m) => m.key !== "narration" || canNarrate).map((m) => (
        <button
          key={m.key}
          type="button"
          aria-pressed={mode === m.key}
          title={m.hint}
          onClick={() => onMode(m.key)}
          className={clsx("rp-mode", `rp-mode-${m.key}`, mode === m.key && "is-on")}
        >
          {m.key === "say" ? "« »" : m.key === "action" ? "✦" : m.key === "hrp" ? "(( ))" : <SidIcon name="quill" />} {m.label}
        </button>
      ))}
      <div ref={ref} className="relative">
        <button type="button" aria-expanded={dice} onClick={() => setDice((d) => !d)} className="rp-mode rp-mode-dice" title="Lancer des dés (/des 2d6+1)">
          <SidIcon name="dice" /> Dés
        </button>
        {dice && (
          <div className="rp-dice-menu" role="menu">
            <div className="grid grid-cols-4 gap-1">
              {DICE.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDice(false);
                    onRoll(d);
                  }}
                  className="rp-die"
                >
                  {d.replace(/^1/, "")}
                </button>
              ))}
            </div>
            <form
              className="mt-2 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!custom.trim()) return;
                setDice(false);
                onRoll(custom.trim());
                setCustom("");
              }}
            >
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                aria-label="Lancer personnalisé"
                placeholder="3d8+2"
                className="w-full rounded border border-white/20 bg-black/20 px-2 py-1 font-mono text-xs text-paper outline-none focus:border-blue"
              />
              <button className="rounded bg-blue px-2 font-mono text-xs text-ink">Lancer</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/** Affichage des messages non « parler » (action, hors-RP, narration, dés). */
export function RpMessage({ m, name, mine, onDelete }: { m: ChatMessage; name: string; mine: boolean; onDelete?: () => void }) {
  const time = new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const del = mine && onDelete && (
    <button onClick={onDelete} className="rp-del" aria-label="Supprimer ce message">
      ✕
    </button>
  );

  if (m.kind === "action")
    return (
      <div className="rp-action group">
        <span aria-hidden>✦</span> <strong>{name}</strong> {m.content}
        {del}
      </div>
    );

  if (m.kind === "hrp")
    return (
      <div className={clsx("rp-hrp group", mine && "ml-auto")}>
        <span className="rp-hrp-tag">HRP</span> {name} : {m.content}
        {del}
      </div>
    );

  if (m.kind === "narration")
    return (
      <figure className="rp-narration group">
        <figcaption>
          <SidIcon name="quill" /> Le récit <span className="opacity-70">· par {name}</span>
        </figcaption>
        <p>{m.content}</p>
        {del}
      </figure>
    );

  if (m.kind === "roll" && m.meta) {
    const { rolls, faces, mod, total, expr } = m.meta;
    const single = rolls.length === 1 && faces === 20;
    const crit = single && rolls[0] === 20 ? "success" : single && rolls[0] === 1 ? "fail" : null;
    return (
      <div className={clsx("rp-roll group", crit && `is-${crit}`, mine && "ml-auto")} aria-label={`${name} lance ${expr} : ${total}`}>
        <div className="rp-roll-head">
          <SidIcon name="dice" /> <strong>{name}</strong> lance <code>{expr}</code>
          <span className="ml-auto font-mono text-[10px] opacity-60">{time}</span>
        </div>
        <div className="rp-roll-body">
          <span className="flex flex-wrap gap-1">
            {rolls.map((r, i) => (
              <span key={i} className={clsx("rp-roll-die", r === faces && "is-max", r === 1 && "is-min")} style={{ animationDelay: `${i * 60}ms` }}>
                {r}
              </span>
            ))}
            {mod !== 0 && <span className="rp-roll-mod">{mod > 0 ? `+${mod}` : mod}</span>}
          </span>
          <span className="rp-roll-total">{total}</span>
        </div>
        {crit && <p className="rp-roll-crit">{crit === "success" ? "Réussite critique !" : "Échec critique…"}</p>}
        {del}
      </div>
    );
  }
  return null;
}
