"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";

/**
 * Journal du compte (Lot 98, migration 0125) : connexions et appareil
 * utilisé, sessions fermées, réglages, export, actions de l'équipe sur le
 * compte, événements du mot de passe. Un an au plus ; lisible par le membre
 * seul. Un appareil jamais vu sur le compte est marqué, et a déjà fait
 * l'objet d'une notification.
 */
type Ligne = { at: string; kind: string; label: string; details?: { par?: string; ip?: string; appareil?: string } };
type Filtre = "tout" | "connexions" | "reglages" | "equipe";

const FILTRES: { v: Filtre; label: string; kinds: string[] | null }[] = [
  { v: "tout", label: "Tout", kinds: null },
  { v: "connexions", label: "Connexions", kinds: ["connexion", "appareil_nouveau", "appareil_ferme", "compte"] },
  { v: "reglages", label: "Réglages et données", kinds: ["reglage", "export", "suppression"] },
  { v: "equipe", label: "Équipe", kinds: ["equipe"] },
];

const ICONE: Record<string, string> = {
  connexion: "🔑",
  appareil_nouveau: "⚠️",
  appareil_ferme: "🚪",
  compte: "🔐",
  reglage: "⚙️",
  export: "📦",
  suppression: "🗑️",
  equipe: "🛡️",
};

const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const PAGE = 40;

export function AccountJournal() {
  const supabase = useMemo(() => createClient(), []);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [n, setN] = useState(PAGE);

  useEffect(() => {
    supabase.rpc("journal_mon_compte").then(({ data, error }) => {
      if (error) {
        setLignes([]);
        setErreur(/journal_mon_compte|PGRST202/.test(`${error.message} ${error.code}`) ? "Le journal arrive avec la migration 0125." : `Échec : ${error.message}`);
        return;
      }
      setLignes((data ?? []) as Ligne[]);
    });
  }, [supabase]);

  const kinds = FILTRES.find((f) => f.v === filtre)?.kinds;
  const visibles = (lignes ?? []).filter((l) => !kinds || kinds.includes(l.kind));
  const parJour = useMemo(() => {
    const m = new Map<string, Ligne[]>();
    for (const l of visibles.slice(0, n)) {
      const k = jour(l.at);
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return [...m.entries()];
  }, [visibles, n]);

  return (
    <section id="journal" className="glass-card scroll-mt-24 space-y-3 p-6" aria-labelledby="journal-titre">
      <h2 id="journal-titre" className="font-display text-lg uppercase">
        Journal du compte
      </h2>
      <p className="font-body text-sm text-paper/80">
        Ce qui s&apos;est passé sur ton compte depuis un an : connexions, réglages, export, actions de l&apos;équipe. Toi seul
        le vois. Une connexion depuis un appareil inconnu t&apos;envoie aussi une notification.
      </p>

      <div role="group" aria-label="Filtrer le journal" className="flex flex-wrap gap-1.5">
        {FILTRES.map((f) => (
          <button
            key={f.v}
            aria-pressed={filtre === f.v}
            onClick={() => {
              setFiltre(f.v);
              setN(PAGE);
            }}
            className={clsx(
              "rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase",
              filtre === f.v ? "border-encre bg-encre text-creme" : "border-white/25 text-paper/85 hover:bg-white/10",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erreur && <p className="rounded-lg bg-red/10 px-3 py-2 font-mono text-xs text-red">{erreur}</p>}
      {lignes === null ? (
        <p className="font-body text-sm text-paper/70">Chargement…</p>
      ) : visibles.length === 0 && !erreur ? (
        <p className="font-body text-sm text-paper/70">Rien pour l&apos;instant.</p>
      ) : (
        <div className="space-y-4">
          {parJour.map(([j, ls]) => (
            <div key={j}>
              <h3 className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/75">{j}</h3>
              <ul className="divide-y divide-white/10">
                {ls.map((l, i) => (
                  <li key={`${l.at}-${i}`} className={clsx("flex items-start gap-3 py-2", l.kind === "appareil_nouveau" && "journal-alerte")}>
                    <span aria-hidden className="w-6 shrink-0 text-center">
                      {ICONE[l.kind] ?? "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-semibold">{l.label}</p>
                      <p className="font-mono text-[11px] text-paper/75">
                        {heure(l.at)}
                        {l.details?.par === "equipe" && " · par l'équipe"}
                        {l.details?.ip && ` · adresse ${l.details.ip}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {visibles.length > n && (
            <button onClick={() => setN(n + PAGE)} className="rounded-lg border border-white/20 px-3 py-2 font-mono text-xs uppercase hover:bg-white/10">
              Voir plus ({visibles.length - n})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
