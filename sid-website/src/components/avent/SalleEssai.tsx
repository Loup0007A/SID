"use client";

import { useEffect, useState } from "react";
import { MiniJeu } from "./MiniJeu";
import { JEUX } from "./jeux";
import { buttonPrimary, buttonSecondary } from "@/lib/ui";

/**
 * Salle d'essai (admins) : chaque mini-jeu se lance ici sans passer par le
 * serveur. Pas d'essai consommé, pas de score enregistré, aucun effet sur
 * le classement.
 */
export function SalleEssai({ jeux }: { jeux: { jeu: string; nom: string; consigne: string }[] }) {
  const [choix, setChoix] = useState<{ jeu: string; nom: string; consigne: string } | null>(null);
  const [graine, setGraine] = useState(1);
  const [enCours, setEnCours] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [records, setRecords] = useState<Record<string, number>>({});

  function lancer(j: { jeu: string; nom: string; consigne: string }) {
    setChoix(j);
    setScore(null);
    setGraine(Math.floor(Math.random() * 2_000_000_000) + 1);
    setEnCours(true);
  }

  useEffect(() => {
    if (!choix || enCours) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setChoix(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [choix, enCours]);

  return (
    <section className="glass-card space-y-3 p-5">
      <h2 className="font-display text-lg uppercase">Salle d&apos;essai</h2>
      <p className="font-body text-sm text-paper/85">
        Joue à n&apos;importe quel mini-jeu, même dans une case pas encore ouverte. Rien n&apos;est envoyé au serveur : pas d&apos;essai consommé, pas de
        score enregistré, aucun effet sur le classement.
      </p>
      <div className="flex flex-wrap gap-2">
        {jeux
          .filter((j) => JEUX[j.jeu])
          .map((j) => (
            <button key={j.jeu} type="button" className={buttonSecondary} onClick={() => lancer(j)}>
              {j.nom}
              {records[j.jeu] !== undefined && <span className="ml-2 font-mono text-[11px] normal-case">({records[j.jeu].toLocaleString("fr-FR")})</span>}
            </button>
          ))}
      </div>

      {choix && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={enCours ? undefined : () => setChoix(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="essai-titre"
            onClick={(e) => e.stopPropagation()}
            className="glass-panel max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-5"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-paper/80">Essai, hors classement</p>
                <h2 id="essai-titre" className="font-display text-xl uppercase text-paper">
                  {choix.nom}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEnCours(false);
                  setChoix(null);
                }}
                className="rounded-lg px-2 py-1 font-mono text-xs uppercase text-paper/85 hover:text-paper"
              >
                {enCours ? "Arrêter" : "Fermer"}
              </button>
            </div>
            {enCours ? (
              <MiniJeu
                key={graine}
                jeu={choix.jeu}
                graine={graine}
                onFin={(s) => {
                  setScore(s);
                  setEnCours(false);
                  setRecords((r) => ({ ...r, [choix.jeu]: Math.max(r[choix.jeu] ?? 0, s) }));
                }}
              />
            ) : (
              <div className="space-y-4">
                <p className="font-body text-sm text-paper/90">{choix.consigne}</p>
                {score !== null && (
                  <p role="status" className="rounded-xl border border-white/15 bg-white/[0.06] p-3 font-body text-sm text-paper">
                    <span className="block font-display text-2xl">{score.toLocaleString("fr-FR")}</span>
                    Score d&apos;essai, non enregistré.
                  </p>
                )}
                <button type="button" className={`${buttonPrimary} w-full py-3 text-lg`} onClick={() => lancer(choix)}>
                  {score === null ? "Jouer" : "Rejouer"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
