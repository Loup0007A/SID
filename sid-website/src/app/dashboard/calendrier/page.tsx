"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";
import { EVENTS, type EventKey } from "@/lib/events";

/**
 * Calendrier (Lot 97, migration 0123) : ce qui tombe dans le mois, calculé
 * en base par calendrier() — échéances des quêtes, fins d'enchères,
 * clôtures de sondages, anniversaires, impôts du membre, événements du jeu.
 * Chaque date peut partir dans l'agenda du membre (fichier .ics, fabriqué
 * dans le navigateur : rien n'est envoyé ailleurs).
 */

type Kind = "quete" | "enchere" | "sondage" | "anniversaire" | "impot" | "evenement";
type Item = { kind: Kind; id: string; titre: string; debut: string; fin?: string; jour?: boolean; detail?: string; lien?: string; image?: string | null; moi?: boolean };

const KINDS: Record<Kind, { label: string; emoji: string; color: string }> = {
  quete: { label: "Quêtes", emoji: "📜", color: "#c7d8ff" },
  enchere: { label: "Enchères", emoji: "🔨", color: "#f2d27a" },
  sondage: { label: "Sondages", emoji: "🗳️", color: "#d6c6f5" },
  anniversaire: { label: "Anniversaires", emoji: "🎂", color: "#ffc6d9" },
  impot: { label: "Mes impôts", emoji: "🧾", color: "#f3c08a" },
  evenement: { label: "Événements", emoji: "🎉", color: "#bdf0cc" },
};
const JOURS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Jour local (AAAA-MM-JJ) d'un élément : date seule, ou heure convertie. */
const jourDe = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : iso(new Date(s)));
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function titreDe(it: Item) {
  if (it.kind === "evenement") {
    const e = EVENTS[it.titre as EventKey];
    return e ? `${e.emoji} ${e.name}` : it.titre;
  }
  if (it.kind === "anniversaire") return `${KINDS.anniversaire.emoji} ${it.titre}`;
  return `${KINDS[it.kind].emoji} ${it.titre}`;
}

/** Jours couverts par un élément, dans le mois affiché. */
function joursCouverts(it: Item): string[] {
  const d0 = jourDe(it.debut);
  if (!it.fin) return [d0];
  const out: string[] = [];
  for (let d = new Date(`${d0}T12:00:00`); iso(d) <= it.fin && out.length < 62; d = addDays(d, 1)) out.push(iso(d));
  return out;
}

// --- Agenda (.ics, RFC 5545) ---
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
/** Lignes de plus de 75 octets repliées (RFC 5545 § 3.1) : 60 caractères, accents compris. */
const plier = (l: string) => (l.length <= 60 ? l : (l.match(/.{1,60}/gu) ?? [l]).join("\r\n "));
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function vevent(it: Item) {
  const url = it.lien ? `${BRAND.urls.site.replace(/\/$/, "")}${it.lien}` : null;
  const lines = ["BEGIN:VEVENT", `UID:${it.kind}-${it.id}@${new URL(BRAND.urls.site).hostname}`, `DTSTAMP:${utc(new Date())}`];
  if (it.jour) {
    const d0 = jourDe(it.debut);
    const d1 = iso(addDays(new Date(`${it.fin ?? d0}T12:00:00`), 1));
    lines.push(`DTSTART;VALUE=DATE:${d0.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${d1.replace(/-/g, "")}`);
    if (it.kind === "anniversaire") lines.push("RRULE:FREQ=YEARLY");
  } else {
    const d = new Date(it.debut);
    lines.push(`DTSTART:${utc(d)}`, `DTEND:${utc(new Date(d.getTime() + 30 * 60000))}`);
  }
  lines.push(`SUMMARY:${esc(`${titreDe(it).replace(/^\S+\s/, "")}${it.kind === "anniversaire" ? " (anniversaire)" : ""} — ${BRAND.name}`)}`);
  const desc = [it.detail, url].filter(Boolean).join("\n");
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  if (url) lines.push(`URL:${url}`);
  lines.push("END:VEVENT");
  return lines;
}
function telecharger(items: Item[], nom: string) {
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${BRAND.name}//Calendrier//FR`, "CALSCALE:GREGORIAN", ...items.flatMap(vevent).map(plier), "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nom}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CalendrierPage() {
  const supabase = useMemo(() => createClient(), []);
  const [mois, setMois] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [off, setOff] = useState<Set<Kind>>(new Set());
  const [choisi, setChoisi] = useState<string | null>(null);
  const aujourdhui = iso(new Date());

  // Grille : du lundi avant le 1er au dimanche après le dernier jour.
  const grille = useMemo(() => {
    const debut = addDays(mois, -((mois.getDay() + 6) % 7));
    const dernier = new Date(mois.getFullYear(), mois.getMonth() + 1, 0);
    const fin = addDays(dernier, 6 - ((dernier.getDay() + 6) % 7));
    const jours: Date[] = [];
    for (let d = debut; d <= fin; d = addDays(d, 1)) jours.push(d);
    return { debut, fin, jours };
  }, [mois]);

  useEffect(() => {
    let vivant = true;
    setItems(null);
    supabase.rpc("calendrier", { p_debut: iso(grille.debut), p_fin: iso(grille.fin) }).then(({ data, error: e }) => {
      if (!vivant) return;
      if (e) return setError(/calendrier|PGRST202/.test(`${e.message} ${e.code}`) ? "Le calendrier arrive avec la migration 0123." : e.message);
      setError(null);
      setItems(((data ?? []) as Item[]).sort((a, b) => jourDe(a.debut).localeCompare(jourDe(b.debut)) || a.debut.localeCompare(b.debut)));
    });
    return () => {
      vivant = false;
    };
  }, [supabase, grille]);

  const visibles = useMemo(() => (items ?? []).filter((it) => !off.has(it.kind)), [items, off]);
  const parJour = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of visibles) for (const d of joursCouverts(it)) m.set(d, [...(m.get(d) ?? []), it]);
    return m;
  }, [visibles]);
  const moisIso = iso(mois).slice(0, 7);
  // Liste : les jours du mois affiché qui ont quelque chose (un événement sur plusieurs jours : son premier jour du mois).
  const liste = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of visibles) {
      const jours = joursCouverts(it).filter((d) => d.startsWith(moisIso));
      if (!jours.length) continue;
      m.set(jours[0], [...(m.get(jours[0]) ?? []), it]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibles, moisIso]);

  const titreMois = mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const changer = (n: number) => {
    setChoisi(null);
    setMois(new Date(mois.getFullYear(), mois.getMonth() + n, 1));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">{BRAND.name}</p>
          <h1 className="font-display text-3xl uppercase tracking-wide">Calendrier</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => changer(-1)} className="rounded-lg border border-white/20 px-3 py-2 font-mono text-xs uppercase hover:bg-white/10" aria-label="Mois précédent">
            ←
          </button>
          <h2 className="min-w-[10rem] text-center font-display text-lg uppercase" aria-live="polite">
            {titreMois}
          </h2>
          <button onClick={() => changer(1)} className="rounded-lg border border-white/20 px-3 py-2 font-mono text-xs uppercase hover:bg-white/10" aria-label="Mois suivant">
            →
          </button>
          <button
            onClick={() => {
              const n = new Date();
              setChoisi(null);
              setMois(new Date(n.getFullYear(), n.getMonth(), 1));
            }}
            className="rounded-lg border border-white/20 px-3 py-2 font-mono text-xs uppercase hover:bg-white/10"
          >
            Aujourd&apos;hui
          </button>
        </div>
      </header>

      <div role="group" aria-label="Afficher" className="flex flex-wrap gap-1.5">
        {(Object.keys(KINDS) as Kind[]).map((k) => (
          <button
            key={k}
            aria-pressed={!off.has(k)}
            onClick={() => setOff((s) => {
              const n = new Set(s);
              if (n.has(k)) n.delete(k);
              else n.add(k);
              return n;
            })}
            className={clsx("cal-filtre rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase", off.has(k) ? "border-white/25 text-paper/80 line-through" : "border-transparent text-encre")}
            style={off.has(k) ? undefined : { background: KINDS[k].color }}
          >
            <span aria-hidden>{KINDS[k].emoji}</span> {KINDS[k].label}
          </button>
        ))}
      </div>

      {error && <p className="glass-card p-4 font-body text-sm text-red">{error}</p>}

      <div className="cal-grille glass-card overflow-hidden p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1" aria-hidden>
          {JOURS.map((j) => (
            <div key={j} className="py-1 text-center font-mono text-[11px] uppercase text-paper/80">
              {j}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grille.jours.map((d) => {
            const k = iso(d);
            const its = parJour.get(k) ?? [];
            const horsMois = d.getMonth() !== mois.getMonth();
            return (
              <button
                key={k}
                onClick={() => {
                  setChoisi(k);
                  document.getElementById(`cal-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                disabled={!its.length}
                aria-label={`${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} : ${its.length ? `${its.length} élément${its.length > 1 ? "s" : ""}` : "rien"}`}
                className={clsx(
                  "cal-jour flex min-h-[3.25rem] flex-col items-stretch gap-0.5 rounded-lg p-1 text-left sm:min-h-[5.5rem]",
                  horsMois && "opacity-55",
                  k === aujourdhui && "is-today",
                  choisi === k && "is-choisi",
                  its.length > 0 && "hover:bg-white/10",
                )}
              >
                <span className="font-mono text-xs">{d.getDate()}</span>
                <span className="hidden flex-col gap-0.5 sm:flex">
                  {its.slice(0, 3).map((it) => (
                    <span key={`${it.kind}-${it.id}`} className="truncate rounded px-1 font-body text-[11px] text-encre" style={{ background: KINDS[it.kind].color }}>
                      {titreDe(it)}
                    </span>
                  ))}
                  {its.length > 3 && <span className="font-mono text-[10px] text-paper/80">+{its.length - 3}</span>}
                </span>
                <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                  {its.slice(0, 4).map((it) => (
                    <span key={`${it.kind}-${it.id}`} className="h-2 w-2 rounded-full" style={{ background: KINDS[it.kind].color }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl uppercase">Ce mois-ci</h2>
        {liste.length > 0 && (
          <button
            onClick={() => telecharger(liste.flatMap(([, l]) => l), `${BRAND.name.replace(/\W+/g, "")}-${moisIso}`)}
            className="rounded-lg border border-white/20 px-3 py-2 font-mono text-xs uppercase hover:bg-white/10"
          >
            Tout ajouter à mon agenda
          </button>
        )}
      </div>

      {items === null && !error && <p className="font-body text-sm text-paper/80">Chargement…</p>}
      {items && liste.length === 0 && <p className="glass-card p-5 font-body text-sm text-paper/80">Rien de prévu ce mois-ci{off.size ? " (avec ces filtres)" : ""}.</p>}

      <div className="space-y-4">
        {liste.map(([d, its]) => (
          <section key={d} id={`cal-${d}`} className={clsx("scroll-mt-24 space-y-2", choisi === d && "cal-section-choisie")}>
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-paper/80">
              {new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              {d === aujourdhui && " · aujourd'hui"}
            </h3>
            <ul className="space-y-2">
              {its.map((it) => (
                <li key={`${it.kind}-${it.id}`} className="glass-card flex flex-wrap items-center gap-3 p-3" style={{ boxShadow: `inset 4px 0 0 ${KINDS[it.kind].color}` }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-body font-semibold">
                      {it.lien ? (
                        <Link href={it.lien} className="underline-offset-2 hover:underline">
                          {titreDe(it)}
                        </Link>
                      ) : (
                        titreDe(it)
                      )}
                      {it.moi && it.kind !== "impot" && it.kind !== "anniversaire" && (
                        <span className="ml-2 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase text-encre" style={{ background: "#f2d27a" }}>
                          {it.kind === "sondage" ? "À voter" : "Te concerne"}
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[11px] text-paper/80">
                      {it.jour
                        ? it.fin && it.fin !== jourDe(it.debut)
                          ? `Du ${new Date(`${jourDe(it.debut)}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au ${new Date(`${it.fin}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
                          : "Toute la journée"
                        : `${it.kind === "quete" ? "Échéance" : it.kind === "enchere" ? "Fin" : it.kind === "sondage" ? "Clôture" : "À payer avant"} ${new Date(it.debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                      {it.detail && it.kind !== "anniversaire" ? ` · ${it.detail}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => telecharger([it], `${it.kind}-${jourDe(it.debut)}`)}
                    className="rounded-lg border border-white/20 px-3 py-2 font-mono text-[11px] uppercase hover:bg-white/10"
                  >
                    Ajouter à mon agenda
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
