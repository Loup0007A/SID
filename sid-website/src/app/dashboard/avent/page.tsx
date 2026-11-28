"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { MiniJeu } from "@/components/avent/MiniJeu";
import { SalleEssai } from "@/components/avent/SalleEssai";
import { buttonPrimary } from "@/lib/ui";
import { AVANTAGES, jourCourt, rangs, recompenseTexte, z, type AventCase, type AventEtat, type AventLigne } from "@/types/avent";

/** Calendrier de l'avent (Lot 103, migration 0134). */

type Partie = { partie: string; jeu: string; graine: number; essais_restants: number };
type Resultat = { ok: boolean; motif?: string; score?: number; record?: boolean; meilleur?: number; bonus?: boolean; rang?: number | null; points?: number };
type Podium = { rang: number; nickname: string; score: number; moi: boolean };
type Entrainement = {
  gratuits: number;
  credits: number;
  jeux: { jeu: string; nom: string; consigne: string; premiere_case: number; utilises: number; restants: number }[];
};
type Avantage = { kind: "bouclier" | "roue_double" | "renommee_bonus"; valeur: number | null; jusqu: string; source: string };

const quand = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function AventPage() {
  const supabase = useMemo(() => createClient(), []);
  const [etat, setEtat] = useState<AventEtat | null>(null);
  const [absent, setAbsent] = useState(false);
  const [classement, setClassement] = useState<AventLigne[]>([]);
  const [avantages, setAvantages] = useState<Avantage[]>([]);
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [entr, setEntr] = useState<Entrainement | null>(null);

  const chargerEntrainement = useCallback(async () => {
    const { data, error } = await supabase.rpc("avent_entrainement_etat");
    if (!error) setEntr(data as Entrainement);
  }, [supabase]);
  useEffect(() => {
    chargerEntrainement();
  }, [chargerEntrainement]);

  const charger = useCallback(async () => {
    const [e, c, a] = await Promise.all([supabase.rpc("avent_etat"), supabase.rpc("avent_classement", { p_limite: 50 }), supabase.rpc("mes_avantages")]);
    if (e.error) {
      setAbsent(true);
      return;
    }
    setEtat(e.data as AventEtat);
    setClassement((c.data as AventLigne[]) ?? []);
    setAvantages((a.data as Avantage[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    charger();
    const n = Number(new URLSearchParams(window.location.search).get("case"));
    if (n >= 1 && n <= 24) setOuverte(n);
  }, [charger]);

  if (absent) return <p className="glass-card max-w-xl p-6 font-body text-sm text-paper/80">Le calendrier de l&apos;avent arrive bientôt.</p>;
  if (!etat) return <p className="font-body text-paper/80">Chargement du calendrier…</p>;

  const caseOuverte = etat.cases.find((c) => c.jour === ouverte) ?? null;
  const moi = classement.find((l) => l.rang === etat.mon_rang);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-1">
          <h1 className="font-display text-2xl uppercase tracking-wide text-red">Calendrier de l&apos;avent {etat.edition}</h1>
          <p className="font-body text-sm text-paper/85">
            Une case par jour jusqu&apos;au 24 décembre, chacune avec son mini-jeu. Ton meilleur score de chaque case rapporte jusqu&apos;à 1 000 points
            (le meilleur joueur de la case a 1 000){etat.bonus_jour > 0 ? `, plus ${etat.bonus_jour} si tu la joues le jour où elle s'ouvre` : ""}.{" "}
            {etat.essais_par_jour} essai{etat.essais_par_jour > 1 ? "s" : ""} par case et par jour.
          </p>
        </div>
        <div className="glass-card flex items-baseline gap-3 px-4 py-2">
          <span className="font-display text-3xl text-paper">{etat.mon_rang ? (etat.mon_rang === 1 ? "1er" : `${etat.mon_rang}e`) : "–"}</span>
          <span className="font-body text-sm text-paper/85">
            {etat.mes_points.toLocaleString("fr-FR")} points
            <br />
            sur {etat.classes} classé{etat.classes > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {!etat.actif && <p className="glass-card p-4 font-body text-sm text-paper/85">Le calendrier est en pause pour le moment.</p>}
      {etat.clos && (
        <p className="glass-card p-4 font-body text-sm text-paper/85">
          Le calendrier est clos depuis le {quand(etat.fin)} : le classement est figé.{" "}
          {etat.distribue ? "Les récompenses ont été distribuées." : "Les récompenses seront distribuées par l'administration."}
        </p>
      )}
      {etat.bac_a_sable && (
        <p className="glass-card p-4 font-body text-sm text-paper/85">Compte en bac à sable : tu peux jouer, mais tu n&apos;entres pas au classement.</p>
      )}
      {etat.mon_gain && (
        <p className="glass-card p-4 font-body text-sm text-paper">
          Tu as fini {etat.mon_gain.rang === 1 ? "1er" : `${etat.mon_gain.rang}e`} avec {etat.mon_gain.points} points. Ta récompense :{" "}
          {[
            Number(etat.mon_gain.zenis) > 0 ? z(etat.mon_gain.zenis) : null,
            etat.mon_gain.renommee > 0 ? `+${etat.mon_gain.renommee} renommée` : null,
            etat.mon_gain.avantage ? AVANTAGES[etat.mon_gain.avantage].nom.toLowerCase() : null,
          ]
            .filter(Boolean)
            .join(", ")}
          .
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Les 24 cases" className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {etat.cases.map((c) => (
            <Porte key={c.jour} c={c} aujourdhui={etat.aujourdhui} onOuvrir={() => setOuverte(c.jour)} />
          ))}
        </section>

        <aside className="min-w-0 space-y-6">
          {avantages.length > 0 && (
            <section className="glass-card space-y-2 p-4">
              <h2 className="font-display text-lg uppercase">Tes avantages</h2>
              <ul className="space-y-1 font-body text-sm text-paper/90">
                {avantages.map((a, i) => (
                  <li key={i}>
                    <b className="text-paper">{a.kind === "renommee_bonus" ? `Renommée +${a.valeur} %` : AVANTAGES[a.kind].nom}</b> jusqu&apos;au {quand(a.jusqu)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="glass-card space-y-3 p-4">
            <h2 className="font-display text-lg uppercase">Classement</h2>
            {classement.length === 0 ? (
              <p className="font-body text-sm text-paper/85">Personne n&apos;a encore joué. La première case s&apos;ouvre le {jourCourt(etat.debut)}</p>
            ) : (
              <ol className="space-y-1">
                {classement
                  .filter((l) => l.rang <= 10 || l.rang === etat.mon_rang)
                  .map((l) => (
                    <li
                      key={l.user_id}
                      className={clsx(
                        "grid grid-cols-[2.2rem_minmax(0,1fr)_auto] items-baseline gap-x-2 rounded-lg px-2 py-1 font-body text-sm",
                        l.rang === etat.mon_rang ? "bg-accent/20 text-paper" : "text-paper/90",
                      )}
                    >
                      <span className="font-mono text-xs">{l.rang === 1 ? "1er" : `${l.rang}e`}</span>
                      <span className="min-w-0 break-words">
                        {l.nickname}
                        {l.recompense && <span className="block text-xs text-paper/80">{recompenseTexte(l.recompense)}</span>}
                      </span>
                      <span className="font-mono text-xs">{l.points.toLocaleString("fr-FR")}</span>
                    </li>
                  ))}
              </ol>
            )}
            {moi && moi.rang > 10 && <p className="font-body text-xs text-paper/80">Tu es {moi.rang}e.</p>}
          </section>

          <section className="glass-card space-y-2 p-4">
            <h2 className="font-display text-lg uppercase">Récompenses</h2>
            {etat.recompenses.length === 0 ? (
              <p className="font-body text-sm text-paper/85">Les récompenses seront annoncées par l&apos;administration.</p>
            ) : (
              <ul className="space-y-2 font-body text-sm text-paper/90">
                {etat.recompenses.map((r) => (
                  <li key={r.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2">
                    <b className="text-paper">{rangs(r)}</b>
                    <span>
                      {recompenseTexte(r)}
                      {r.avantage && <span className="block text-xs text-paper/80">{AVANTAGES[r.avantage].detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="font-body text-xs text-paper/80">Distribuées après la clôture, le {quand(etat.fin)}.</p>
          </section>
        </aside>
      </div>

      {entr && entr.jeux.length > 0 && etat.actif && (
        <SalleEssai
          titre="Entraînement"
          intro={
            <>
              Essaie chaque jeu du calendrier, même avant l&apos;ouverture de sa case : {entr.gratuits} essai{entr.gratuits > 1 ? "s" : ""} par jeu,
              hors classement, sans toucher à tes essais du jour.
            </>
          }
          jeux={entr.jeux}
          etiquettes={Object.fromEntries(
            entr.jeux.map((j) => [j.jeu, j.restants > 0 ? `${j.restants} essai${j.restants > 1 ? "s" : ""}` : entr.credits > 0 ? "essai d'objet" : "épuisé"]),
          )}
          demarrer={async (jeu) => {
            const { data, error } = await supabase.rpc("avent_entrainement_commencer", { p_jeu: jeu });
            chargerEntrainement();
            if (error) return { erreur: error.message };
            return { graine: (data as { graine: number }).graine };
          }}
          bas={
            <p className="font-body text-xs text-paper/85">
              {entr.credits > 0
                ? `Tu as aussi ${entr.credits} essai${entr.credits > 1 ? "s" : ""} d'entraînement en réserve, valables sur tous les jeux.`
                : "Plus d'essais ? Les objets « Essais d'entraînement » de la "}
              {entr.credits === 0 && (
                <>
                  <Link href="/dashboard/shop" className="underline">
                    boutique
                  </Link>{" "}
                  en ajoutent, à utiliser depuis Mes achats.
                </>
              )}
            </p>
          }
        />
      )}

      {caseOuverte && <Fenetre c={caseOuverte} etat={etat} onFermer={() => setOuverte(null)} onChange={charger} />}
    </div>
  );
}

function Porte({ c, aujourdhui, onOuvrir }: { c: AventCase; aujourdhui: string; onOuvrir: () => void }) {
  const avenir = c.ouvre_le > aujourdhui;
  const duJour = c.ouvre_le === aujourdhui;
  const sansJeu = !c.jeu;
  const jouee = c.mon_score !== null;
  const cliquable = !avenir && !sansJeu;
  return (
    <button
      type="button"
      onClick={onOuvrir}
      disabled={!cliquable}
      aria-label={`Case ${c.jour}${avenir ? `, s'ouvre le ${jourCourt(c.ouvre_le)}` : sansJeu ? ", bientôt" : c.nom ? `, ${c.nom}` : ""}`}
      className={clsx(
        "porte-avent relative flex aspect-square flex-col justify-between p-2.5 text-left sm:aspect-[4/5]",
        duJour && cliquable && "porte-avent--jour",
        jouee && "porte-avent--jouee",
        !cliquable && "porte-avent--fermee",
      )}
    >
      <span className="font-display text-4xl leading-none sm:text-5xl">{c.jour}</span>
      <span className="font-body text-[11px] leading-tight">
        {avenir ? (
          jourCourt(c.ouvre_le)
        ) : sansJeu ? (
          "Bientôt"
        ) : jouee ? (
          <>
            <b>{c.mes_points} pts</b>
            <br />
            {c.nom}
          </>
        ) : (
          <>
            {duJour && <b>Aujourd&apos;hui · </b>}
            {c.nom}
          </>
        )}
      </span>
    </button>
  );
}

function Fenetre({ c, etat, onFermer, onChange }: { c: AventCase; etat: AventEtat; onFermer: () => void; onChange: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [partie, setPartie] = useState<Partie | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [podium, setPodium] = useState<Podium[]>([]);
  const [envoi, setEnvoi] = useState(false);

  const chargerPodium = useCallback(async () => {
    const { data } = await supabase.rpc("avent_case_scores", { p_jour: c.jour });
    setPodium((data as Podium[]) ?? []);
  }, [supabase, c.jour]);
  useEffect(() => {
    chargerPodium();
  }, [chargerPodium]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !partie) onFermer();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [partie, onFermer]);

  async function jouer() {
    setErreur(null);
    setResultat(null);
    const { data, error } = await supabase.rpc("avent_commencer", { p_jour: c.jour });
    if (error) {
      setErreur(error.message);
      return;
    }
    setPartie(data as Partie);
  }

  async function terminer(score: number) {
    if (!partie) return;
    setEnvoi(true);
    const { data, error } = await supabase.rpc("avent_terminer", { p_partie: partie.partie, p_score: score });
    setEnvoi(false);
    setPartie(null);
    if (error) setErreur(error.message);
    else setResultat({ ...(data as Resultat), score });
    onChange();
    chargerPodium();
  }

  function abandonner() {
    if (partie && !window.confirm("Abandonner la partie ? L'essai est compté.")) return;
    setPartie(null);
    onChange();
  }

  const peutJouer = c.ouverte && c.essais_restants > 0 && !etat.clos && etat.actif;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={partie ? undefined : onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avent-case-titre"
        onClick={(e) => e.stopPropagation()}
        className="glass-panel max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-paper/80">Case {c.jour}</p>
            <h2 id="avent-case-titre" className="font-display text-xl uppercase text-paper">
              {c.nom}
            </h2>
          </div>
          <button type="button" onClick={partie ? abandonner : onFermer} className="rounded-lg px-2 py-1 font-mono text-xs uppercase text-paper/85 hover:text-paper">
            {partie ? "Abandonner" : "Fermer"}
          </button>
        </div>

        {partie ? (
          envoi ? (
            <p className="py-10 text-center font-body text-sm text-paper/85">Enregistrement du score…</p>
          ) : (
            <MiniJeu jeu={partie.jeu} graine={partie.graine} onFin={terminer} />
          )
        ) : (
          <div className="space-y-4">
            <p className="font-body text-sm text-paper/90">{c.consigne}</p>

            {resultat &&
              (resultat.ok ? (
                <div role="status" className="rounded-xl border border-white/15 bg-white/[0.06] p-3 font-body text-sm text-paper">
                  <p className="font-display text-2xl">{resultat.score?.toLocaleString("fr-FR")}</p>
                  <p>
                    {resultat.record ? "Nouveau record pour toi sur cette case." : `Ton record reste ${resultat.meilleur?.toLocaleString("fr-FR")}.`}
                    {resultat.bonus && etat.bonus_jour > 0 ? ` Bonus du jour : +${etat.bonus_jour}.` : ""}
                  </p>
                  {resultat.rang && (
                    <p className="text-paper/85">
                      Classement : {resultat.rang === 1 ? "1er" : `${resultat.rang}e`} avec {resultat.points?.toLocaleString("fr-FR")} points.
                    </p>
                  )}
                </div>
              ) : (
                <p role="alert" className="rounded-xl border border-red/50 bg-red/10 p-3 font-body text-sm text-paper">
                  Partie non comptée : {resultat.motif}.
                </p>
              ))}
            {erreur && (
              <p role="alert" className="font-body text-sm text-red-light">
                {erreur}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2 text-center">
              <Chiffre titre="Ton record" valeur={c.mon_score ?? "–"} />
              <Chiffre titre="Tes points" valeur={c.mes_points ?? "–"} />
              <Chiffre titre="Essais du jour" valeur={`${c.essais_restants}/${etat.essais_par_jour}`} />
            </div>

            <button
              type="button"
              onClick={jouer}
              disabled={!peutJouer}
              className={`${buttonPrimary} w-full py-3 text-lg`}
            >
              {resultat ? "Rejouer" : "Jouer"}
            </button>
            {!peutJouer && (
              <p className="font-body text-xs text-paper/85">
                {etat.clos ? "Le calendrier est clos." : c.essais_restants <= 0 ? "Plus d'essai aujourd'hui pour cette case : reviens demain." : "Cette case n'est pas ouverte."}
              </p>
            )}

            <div>
              <h3 className="mb-1 font-display text-sm uppercase text-paper">Meilleurs scores</h3>
              {podium.length === 0 ? (
                <p className="font-body text-xs text-paper/85">Personne n&apos;a encore joué cette case.</p>
              ) : (
                <ol className="space-y-0.5 font-body text-sm">
                  {podium.map((p) => (
                    <li key={p.rang} className={clsx("flex justify-between gap-2 rounded px-1.5", p.moi ? "bg-accent/20 text-paper" : "text-paper/90")}>
                      <span className="min-w-0 break-words">
                        <span className="font-mono text-xs">{p.rang}.</span> {p.nickname}
                      </span>
                      <span className="font-mono text-xs">{p.score.toLocaleString("fr-FR")}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Chiffre({ titre, valeur }: { titre: string; valeur: number | string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.05] px-2 py-2">
      <p className="font-display text-xl text-paper">{typeof valeur === "number" ? valeur.toLocaleString("fr-FR") : valeur}</p>
      <p className="font-mono text-[10px] text-paper/80">{titre}</p>
    </div>
  );
}

