"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import { buttonOutline, buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/lib/ui";
import { AVANTAGES, jourCourt, rangs, recompenseTexte, z, type AventAvantage, type AventRecompense } from "@/types/avent";

/**
 * Administration du calendrier de l'avent (Lot 103, migration 0134),
 * réservée aux admins Économie : dates, essais, jeu de chaque case,
 * récompenses par rang, distribution après la clôture.
 */

type Admin = {
  config: {
    actif: boolean;
    debut: string;
    fin: string;
    essais_par_jour: number;
    bonus_jour: number;
    distribue_at: string | null;
  };
  edition: number;
  clos: boolean;
  jeux: { jeu: string; nom: string; consigne: string; min_secondes: number; score_max: number }[];
  cases: { jour: number; jeu: string | null; ouvre_le: string; joueurs: number; parties: number; rejetees: number; meilleur: number | null }[];
  recompenses: AventRecompense[];
  classement: { rang: number; nickname: string; points: number; cases: number; recompense: AventRecompense | null }[];
  rejets: { nickname: string; jour: number; score: number | null; motif: string; at: string }[];
  gains: { rang: number; nickname: string; points: number; zenis: number; renommee: number; avantage: AventAvantage | null; avantage_valeur: number | null; avantage_jusqu: string | null }[];
};

type Brouillon = { id: string | null; rang_min: string; rang_max: string; zenis: string; renommee: string; avantage: "" | AventAvantage; avantage_valeur: string; avantage_heures: string };
const VIDE: Brouillon = { id: null, rang_min: "", rang_max: "", zenis: "", renommee: "", avantage: "", avantage_valeur: "25", avantage_heures: "48" };

const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
function versChamp(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const field = `${inputClass} !py-1.5 text-sm`;

export default function AventAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState<Admin | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [cfg, setCfg] = useState({ actif: true, debut: "", fin: "", essais: "3", bonus: "100" });
  const [b, setB] = useState<Brouillon>(VIDE);
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc("avent_admin");
    if (error) {
      setRefus(error.message);
      return;
    }
    const a = data as Admin;
    setD(a);
    setCfg({ actif: a.config.actif, debut: a.config.debut, fin: versChamp(a.config.fin), essais: String(a.config.essais_par_jour), bonus: String(a.config.bonus_jour) });
  }, [supabase]);
  useEffect(() => {
    charger();
  }, [charger]);

  async function appel(fn: string, args: Record<string, unknown>, ok: string) {
    setOccupe(true);
    setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setOccupe(false);
    if (error) {
      setMsg({ ok: false, t: error.message });
      return false;
    }
    setMsg({ ok: true, t: ok });
    await charger();
    return true;
  }

  if (refus) return <p className="glass-card max-w-xl p-6 font-body text-sm text-paper/85">{refus}</p>;
  if (!d) return <p className="font-body text-paper/80">Chargement…</p>;

  const peutDistribuer = d.clos && !d.config.distribue_at;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl uppercase tracking-wide text-red">
            <SidIcon name="gift" /> Calendrier de l&apos;avent {d.edition}
          </h1>
          <p className="mt-1 font-body text-sm text-paper/85">
            Une case par jour à partir de la date d&apos;ouverture. Points d&apos;une case : 1 000 × score ÷ meilleur score de la case, plus le bonus si
            elle est jouée le jour où elle s&apos;ouvre. Les récompenses se distribuent une fois le calendrier clos.
          </p>
        </div>
        <Link href="/dashboard/avent" className={buttonOutline}>
          Voir le calendrier
        </Link>
      </header>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`glass-card p-3 font-body text-sm ${msg.ok ? "text-paper" : "text-red-light"}`}>
          {msg.t}
        </p>
      )}

      <section className="glass-card space-y-4 p-5">
        <h2 className="font-display text-lg uppercase">Réglages</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className={labelClass}>Case 1 ouverte le</span>
            <input type="date" className={field} value={cfg.debut} onChange={(e) => setCfg({ ...cfg, debut: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Clôture du classement</span>
            <input type="datetime-local" className={field} value={cfg.fin} onChange={(e) => setCfg({ ...cfg, fin: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Essais par case et par jour</span>
            <input type="number" min={1} max={20} className={field} value={cfg.essais} onChange={(e) => setCfg({ ...cfg, essais: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Bonus du jour (points)</span>
            <input type="number" min={0} max={1000} className={field} value={cfg.bonus} onChange={(e) => setCfg({ ...cfg, bonus: e.target.value })} />
          </label>
        </div>
        <label className="flex items-center gap-2 font-body text-sm text-paper">
          <input type="checkbox" checked={cfg.actif} onChange={(e) => setCfg({ ...cfg, actif: e.target.checked })} />
          Calendrier ouvert (décoché : personne ne peut jouer)
        </label>
        <button
          type="button"
          disabled={occupe}
          className={buttonSecondary}
          onClick={() =>
            appel(
              "avent_config_set",
              { p: { actif: cfg.actif, debut: cfg.debut, fin: new Date(cfg.fin).toISOString(), essais_par_jour: Number(cfg.essais), bonus_jour: Number(cfg.bonus) } },
              "Réglages enregistrés.",
            )
          }
        >
          Enregistrer les réglages
        </button>
      </section>

      <section className="glass-card space-y-3 p-5">
        <h2 className="font-display text-lg uppercase">Cases</h2>
        <p className="font-body text-sm text-paper/85">Un jeu peut servir pour plusieurs cases. Sans jeu, la case affiche « Bientôt ».</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] font-body text-sm">
            <thead>
              <tr className="border-b border-white/15 text-left font-mono text-[11px] uppercase text-paper/80">
                <th className="py-1 pr-2">Case</th>
                <th className="py-1 pr-2">Ouvre le</th>
                <th className="py-1 pr-2">Jeu</th>
                <th className="py-1 pr-2 text-right">Joueurs</th>
                <th className="py-1 pr-2 text-right">Parties</th>
                <th className="py-1 pr-2 text-right">Rejetées</th>
                <th className="py-1 text-right">Record</th>
              </tr>
            </thead>
            <tbody>
              {d.cases.map((c) => (
                <tr key={c.jour} className="border-b border-white/5">
                  <td className="py-1 pr-2 font-mono">{c.jour}</td>
                  <td className="py-1 pr-2">{jourCourt(c.ouvre_le)}</td>
                  <td className="py-1 pr-2">
                    <select
                      aria-label={`Jeu de la case ${c.jour}`}
                      className={field}
                      value={c.jeu ?? ""}
                      disabled={occupe}
                      onChange={(e) => appel("avent_case_set", { p_jour: c.jour, p_jeu: e.target.value }, `Case ${c.jour} enregistrée.`)}
                    >
                      <option value="">Aucun (bientôt)</option>
                      {d.jeux.map((j) => (
                        <option key={j.jeu} value={j.jeu}>
                          {j.nom}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2 text-right font-mono">{c.joueurs}</td>
                  <td className="py-1 pr-2 text-right font-mono">{c.parties}</td>
                  <td className="py-1 pr-2 text-right font-mono">{c.rejetees}</td>
                  <td className="py-1 text-right font-mono">{c.meilleur?.toLocaleString("fr-FR") ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-card space-y-4 p-5">
        <h2 className="font-display text-lg uppercase">Récompenses</h2>
        {d.recompenses.length === 0 ? (
          <p className="font-body text-sm text-paper/85">Aucune récompense pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {d.recompenses.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 font-body text-sm">
                <span>
                  <b>{rangs(r)}</b> : {recompenseTexte(r)}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="font-mono text-xs uppercase underline"
                    onClick={() =>
                      setB({
                        id: r.id,
                        rang_min: String(r.rang_min),
                        rang_max: String(r.rang_max),
                        zenis: String(Math.round(Number(r.zenis))),
                        renommee: String(r.renommee),
                        avantage: r.avantage ?? "",
                        avantage_valeur: String(r.avantage_valeur ?? 25),
                        avantage_heures: String(r.avantage_heures ?? 48),
                      })
                    }
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="font-mono text-xs uppercase text-red-light underline"
                    disabled={occupe}
                    onClick={() => window.confirm(`Supprimer la récompense des ${rangs(r)} ?`) && appel("avent_recompense_delete", { p_id: r.id }, "Récompense supprimée.")}
                  >
                    Supprimer
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form
          className="space-y-3 rounded-xl border border-white/15 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await appel(
              "avent_recompense_save",
              {
                p: {
                  id: b.id,
                  rang_min: Number(b.rang_min),
                  rang_max: Number(b.rang_max || b.rang_min),
                  zenis: Number(b.zenis || 0),
                  renommee: Number(b.renommee || 0),
                  avantage: b.avantage || null,
                  avantage_valeur: b.avantage === "renommee_bonus" ? Number(b.avantage_valeur) : null,
                  avantage_heures: b.avantage ? Number(b.avantage_heures) : null,
                },
              },
              b.id ? "Récompense modifiée." : "Récompense ajoutée.",
            );
            if (ok) setB(VIDE);
          }}
        >
          <p className="font-display text-sm uppercase">{b.id ? "Modifier la récompense" : "Nouvelle récompense"}</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="space-y-1">
              <span className={labelClass}>Du rang</span>
              <input required type="number" min={1} max={1000} className={field} value={b.rang_min} onChange={(e) => setB({ ...b, rang_min: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Au rang</span>
              <input type="number" min={1} max={1000} placeholder={b.rang_min || "même"} className={field} value={b.rang_max} onChange={(e) => setB({ ...b, rang_max: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Zénis</span>
              <input type="number" min={0} className={field} value={b.zenis} onChange={(e) => setB({ ...b, zenis: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Renommée</span>
              <input type="number" min={0} max={100000} className={field} value={b.renommee} onChange={(e) => setB({ ...b, renommee: e.target.value })} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className={labelClass}>Avantage temporaire</span>
              <select className={field} value={b.avantage} onChange={(e) => setB({ ...b, avantage: e.target.value as Brouillon["avantage"] })}>
                <option value="">Aucun</option>
                {(Object.keys(AVANTAGES) as AventAvantage[]).map((k) => (
                  <option key={k} value={k}>
                    {AVANTAGES[k].nom}
                  </option>
                ))}
              </select>
            </label>
            {b.avantage === "renommee_bonus" && (
              <label className="space-y-1">
                <span className={labelClass}>Majoration (%)</span>
                <input type="number" min={5} max={200} className={field} value={b.avantage_valeur} onChange={(e) => setB({ ...b, avantage_valeur: e.target.value })} />
              </label>
            )}
            {b.avantage && (
              <label className="space-y-1">
                <span className={labelClass}>Durée (heures)</span>
                <input type="number" min={1} max={2160} className={field} value={b.avantage_heures} onChange={(e) => setB({ ...b, avantage_heures: e.target.value })} />
              </label>
            )}
          </div>
          {b.avantage && <p className="font-body text-xs text-paper/85">{AVANTAGES[b.avantage].nom} : {AVANTAGES[b.avantage].detail}, à partir de la distribution.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={occupe} className={buttonSecondary}>
              {b.id ? "Enregistrer" : "Ajouter"}
            </button>
            {b.id && (
              <button type="button" className={buttonOutline} onClick={() => setB(VIDE)}>
                Annuler
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="glass-card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg uppercase">Classement et distribution</h2>
          <button
            type="button"
            className={buttonPrimary}
            disabled={!peutDistribuer || occupe}
            onClick={() =>
              window.confirm("Distribuer les récompenses maintenant ? Les zénis, la renommée et les avantages sont versés tout de suite, une seule fois.") &&
              appel("avent_distribuer", {}, "Récompenses distribuées.")
            }
          >
            Distribuer les récompenses
          </button>
        </div>
        <p className="font-body text-sm text-paper/85">
          {d.config.distribue_at
            ? `Distribuées le ${quand(d.config.distribue_at)}.`
            : d.clos
              ? "Le calendrier est clos : la distribution est possible."
              : `Clôture le ${quand(d.config.fin)}. La distribution sera possible ensuite.`}
        </p>

        {d.gains.length > 0 ? (
          <Tableau
            lignes={d.gains.map((g) => ({
              rang: g.rang,
              nom: g.nickname,
              points: g.points,
              texte: [Number(g.zenis) > 0 ? z(g.zenis) : null, g.renommee > 0 ? `+${g.renommee} renommée` : null, g.avantage ? AVANTAGES[g.avantage].nom : null]
                .filter(Boolean)
                .join(", "),
            }))}
          />
        ) : d.classement.length === 0 ? (
          <p className="font-body text-sm text-paper/85">Personne n&apos;est encore classé.</p>
        ) : (
          <Tableau lignes={d.classement.map((l) => ({ rang: l.rang, nom: l.nickname, points: l.points, texte: recompenseTexte(l.recompense) || "–" }))} />
        )}
      </section>

      {d.rejets.length > 0 && (
        <section className="glass-card space-y-2 p-5">
          <h2 className="font-display text-lg uppercase">Parties rejetées</h2>
          <p className="font-body text-sm text-paper/85">Scores refusés par le contrôle (durée ou score impossible). Ils ne comptent pas.</p>
          <ul className="space-y-1 font-body text-sm">
            {d.rejets.map((r, i) => (
              <li key={i}>
                <b>{r.nickname}</b>, case {r.jour}, score {r.score ?? "?"} : {r.motif} <span className="font-mono text-xs text-paper/80">({quand(r.at)})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tableau({ lignes }: { lignes: { rang: number; nom: string; points: number; texte: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] font-body text-sm">
        <thead>
          <tr className="border-b border-white/15 text-left font-mono text-[11px] uppercase text-paper/80">
            <th className="py-1 pr-2">Rang</th>
            <th className="py-1 pr-2">Membre</th>
            <th className="py-1 pr-2 text-right">Points</th>
            <th className="py-1">Récompense</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.rang} className="border-b border-white/5">
              <td className="py-1 pr-2 font-mono">{l.rang}</td>
              <td className="break-words py-1 pr-2">{l.nom}</td>
              <td className="py-1 pr-2 text-right font-mono">{l.points.toLocaleString("fr-FR")}</td>
              <td className="py-1">{l.texte}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
