"use client";

import { useEffect, useState } from "react";
import { MiniJeu } from "./MiniJeu";
import { JEUX } from "./jeux";
import { buttonPrimary, buttonSecondary } from "@/lib/ui";

/**
 * Salle d'essai : les mini-jeux se jouent hors classement, sans score
 * enregistré.
 * - Admins : sans limite et sans passer par le serveur.
 * - Membres (entraînement, migration 0137) : `demarrer` demande la partie au
 *   serveur, qui compte les essais (3 par jeu, puis les essais d'objets).
 */
type JeuEssai = { jeu: string; nom: string; consigne: string };

export function SalleEssai({
  jeux,
  titre = "Salle d'essai",
  intro,
  etiquettes,
  demarrer,
  bas,
}: {
  jeux: JeuEssai[];
  titre?: string;
  intro?: React.ReactNode;
  /** texte ajouté au bouton de chaque jeu (ex. « 2 essais ») */
  etiquettes?: Record<string, string>;
  /** renvoie la graine de la partie, ou un message d'erreur */
  demarrer?: (jeu: string) => Promise<{ graine: number } | { erreur: string }>;
  bas?: React.ReactNode;
}) {
  const [choix, setChoix] = useState<JeuEssai | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [graine, setGraine] = useState(1);
  const [enCours, setEnCours] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [records, setRecords] = useState<Record<string, number>>({});

  async function lancer(j: JeuEssai) {
    setChoix(j);
    setScore(null);
    setErreur(null);
    if (demarrer) {
      const r = await demarrer(j.jeu);
      if ("erreur" in r) {
        setErreur(r.erreur);
        setEnCours(false);
        return;
      }
      setGraine(r.graine);
    } else setGraine(Math.floor(Math.random() * 2_000_000_000) + 1);
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
      <h2 className="font-display text-lg uppercase">{titre}</h2>
      <p className="font-body text-sm text-paper/85">
        {intro ?? (
          <>
            Joue à n&apos;importe quel mini-jeu, même dans une case pas encore ouverte. Rien n&apos;est envoyé au serveur : pas d&apos;essai consommé, pas
            de score enregistré, aucun effet sur le classement.
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {jeux
          .filter((j) => JEUX[j.jeu])
          .map((j) => (
            <button key={j.jeu} type="button" className={buttonSecondary} onClick={() => lancer(j)}>
              {j.nom}
              {etiquettes?.[j.jeu] && <span className="ml-2 font-mono text-[11px] normal-case">{etiquettes[j.jeu]}</span>}
              {records[j.jeu] !== undefined && <span className="ml-2 font-mono text-[11px] normal-case">({records[j.jeu].toLocaleString("fr-FR")})</span>}
            </button>
          ))}
      </div>
      {bas}

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
                <p className="font-mono text-xs text-paper/80">{demarrer ? "Entraînement, hors classement" : "Essai, hors classement"}</p>
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
                {erreur && (
                  <p role="alert" className="font-body text-sm text-red-light">
                    {erreur}
                  </p>
                )}
                {score !== null && (
                  <p role="status" className="rounded-xl border border-white/15 bg-white/[0.06] p-3 font-body text-sm text-paper">
                    <span className="block font-display text-2xl">{score.toLocaleString("fr-FR")}</span>
                    Score d&apos;entraînement, non enregistré.
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
