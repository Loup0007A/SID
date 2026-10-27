"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { NavEntry } from "@/lib/navigation";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Mes raccourcis (Lot 60) : les pages qu'on ouvre tout le temps, épinglées en
 * haut de l'accueil (8 au plus, dans l'ordre choisi). Gardé sur l'appareil.
 */
const KEY = "sid-pins-v1";
const MAX = 8;

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function PinnedShortcuts({ entries }: { entries: NavEntry[] }) {
  const [pins, setPins] = useState<string[] | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => setPins(read()), []);

  function save(next: string[]) {
    setPins(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* stockage indisponible */
    }
  }

  if (pins === null || entries.length === 0) return null;
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const pinned = pins.map((k) => byKey.get(k)).filter(Boolean) as NavEntry[];

  return (
    <section aria-label="Mes raccourcis" className="pins">
      {pinned.length === 0 ? (
        <button type="button" onClick={() => setEditing(true)} className="pins-empty">
          <SidIcon name="pin" /> Épingle tes pages préférées ici
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {pinned.map((e) => (
            <Link key={e.key} href={e.href} scroll={false} className="pins-chip">
              <SidIcon name={e.icon} size={22} />
              <span>{e.label}</span>
            </Link>
          ))}
          <button type="button" onClick={() => setEditing(true)} className="pins-edit" aria-label="Modifier mes raccourcis">
            <SidIcon name="pen" />
          </button>
        </div>
      )}

      {editing &&
        createPortal(
          <PinEditor entries={entries} pins={pinned.map((e) => e.key)} onClose={() => setEditing(false)} onSave={save} />,
          document.body,
        )}
    </section>
  );
}

function PinEditor({ entries, pins, onClose, onSave }: { entries: NavEntry[]; pins: string[]; onClose: () => void; onSave: (p: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(pins);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length >= MAX ? s : [...s, k]));
  const move = (k: string, d: -1 | 1) =>
    setSel((s) => {
      const i = s.indexOf(k);
      const j = i + d;
      if (i < 0 || j < 0 || j >= s.length) return s;
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pins-title"
        className="glass-card flex max-h-[85vh] w-full max-w-xl flex-col gap-4 p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="pins-title" className="font-display text-xl uppercase tracking-wide">
            Mes raccourcis
          </h2>
          <p className="font-body text-sm text-paper/70">
            Touche une page pour l&apos;épingler en haut de l&apos;accueil ({sel.length}/{MAX}).
          </p>
        </div>

        {sel.length > 0 && (
          <ol className="flex flex-wrap gap-2" aria-label="Ordre des raccourcis">
            {sel.map((k, i) => {
              const e = entries.find((x) => x.key === k);
              if (!e) return null;
              return (
                <li key={k} className="pins-order">
                  <button type="button" onClick={() => move(k, -1)} disabled={i === 0} aria-label={`Avancer ${e.label}`}>
                    ‹
                  </button>
                  <span>{e.label}</span>
                  <button type="button" onClick={() => move(k, 1)} disabled={i === sel.length - 1} aria-label={`Reculer ${e.label}`}>
                    ›
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {entries.map((e) => {
            const on = sel.includes(e.key);
            return (
              <button
                key={e.key}
                type="button"
                aria-pressed={on}
                disabled={!on && sel.length >= MAX}
                onClick={() => toggle(e.key)}
                className={`pins-pick ${on ? "is-on" : ""}`}
              >
                <SidIcon name={e.icon} size={22} />
                <span className="truncate">{e.label}</span>
                {on && <SidIcon name="pin" size={14} className="ml-auto" />}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/20 px-4 py-2 font-mono text-xs uppercase hover:border-white/40">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(sel);
              onClose();
            }}
            className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink hover:bg-blue-light"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
