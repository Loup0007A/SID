"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass, labelClass } from "@/lib/ui";
import { GACHA_RANKS, RANK_LABEL, formatOdds, gachaCost, gachaOdds, type GachaSettings } from "@/lib/gacha";
import "@/components/quests/recrutement.css";

/**
 * Administration → Économie → Recrutement (Lot 85, migration 0102).
 * On règle la chance d'un rang E, celle d'un rang Divin et le prix ;
 * les rangs D à S suivent une suite géométrique entre les deux.
 */

type Draw = { rank: string | null; cost: number; created_at: string };

const money = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} zénis`;
const LUCKS = [1, 10, 100, 10000];

export function GachaAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState<GachaSettings | null>(null);
  const [e, setE] = useState("2");
  const [divin, setDivin] = useState("1000000");
  const [price, setPrice] = useState("1000");
  const [draws, setDraws] = useState<Draw[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 86400e3).toISOString();
      const [{ data, error }, { data: d }] = await Promise.all([
        supabase.rpc("gacha_settings"),
        supabase.from("quest_gacha_draws").select("rank, cost, created_at").gte("created_at", since).limit(5000),
      ]);
      if (error) return setMsg({ ok: false, text: /gacha_settings/.test(error.message) ? "Le recrutement arrive avec la migration 0102." : error.message });
      const s = data as GachaSettings;
      setLoaded(s);
      setE(String(Math.round(1 / Number(s.prob_e) * 1000) / 1000));
      setDivin(String(Math.round(1 / Number(s.prob_divin))));
      setPrice(String(Number(s.price)));
      setDraws((d ?? []) as Draw[]);
    })();
  }, [supabase]);

  const nE = Number(e.replace(",", "."));
  const nDiv = Number(divin.replace(/\s/g, "").replace(",", "."));
  const nPrice = Number(price.replace(/\s/g, "").replace(",", "."));
  const valid = nE > 1 && nDiv > nE && nPrice >= 0;
  const base = valid ? gachaOdds(1 / nE, 1 / nDiv, 1) : null;
  const overflow = !!base && base.E < 1 / nE - 1e-12;

  async function save() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("gacha_settings_set", { p_prob_e: 1 / nE, p_prob_divin: 1 / nDiv, p_price: nPrice });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setLoaded(data as GachaSettings);
    setMsg({ ok: true, text: "Réglages enregistrés." });
  }

  const byRank = useMemo(() => {
    const m = new Map<string, number>();
    draws.forEach((d) => m.set(d.rank ?? "fail", (m.get(d.rank ?? "fail") ?? 0) + 1));
    return m;
  }, [draws]);
  const spent = draws.reduce((s, d) => s + Number(d.cost), 0);

  return (
    <div className="space-y-6">
      <section className="glass-card space-y-4 p-4">
        <div>
          <h2 className="font-display text-lg uppercase tracking-wide">Recrutement de renforts</h2>
          <p className="font-body text-sm text-paper/70">
            Sur une quête à puissance globale, un participant paie pour tirer un personnage. Les rangs D à S se calculent tout seuls entre
            le rang E et le rang Divin. Le reste des chances donne un tirage raté, payé quand même. Le joueur choisit librement son bonus de chance : chaque rang de D à Divin devient autant de fois plus probable, et le prix suit (4,8 fois le prix pour ×5).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className={labelClass}>Rang E : 1 chance sur</span>
            <input className={inputClass} inputMode="decimal" value={e} onChange={(ev) => setE(ev.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Rang Divin : 1 chance sur</span>
            <input className={inputClass} inputMode="numeric" value={divin} onChange={(ev) => setDivin(ev.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Prix d&apos;un tirage (zénis)</span>
            <input className={inputClass} inputMode="decimal" value={price} onChange={(ev) => setPrice(ev.target.value)} />
          </label>
        </div>

        {!valid ? (
          <p className="font-mono text-xs text-red-light">Le rang E doit être plus fréquent que le rang Divin (E au-dessus de 1, Divin au-dessus de E).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="rd-odds min-w-[22rem]">
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  {LUCKS.map((k) => (
                    <th key={k} scope="col">
                      Chance ×{k.toLocaleString("fr-FR")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...GACHA_RANKS].reverse().map((r) => (
                  <tr key={r} className={`rank-${r}`}>
                    <td>
                      <span className="rd-dot" /> {RANK_LABEL[r]}
                    </td>
                    {LUCKS.map((k) => (
                      <td key={k}>{formatOdds(gachaOdds(1 / nE, 1 / nDiv, k)[r])}</td>
                    ))}
                  </tr>
                ))}
                <tr className="is-fail">
                  <td>Tirage raté</td>
                  {LUCKS.map((k) => (
                    <td key={k}>{formatOdds(gachaOdds(1 / nE, 1 / nDiv, k).fail)}</td>
                  ))}
                </tr>
                <tr>
                  <td>Prix</td>
                  {LUCKS.map((k) => (
                    <td key={k}>{money(gachaCost(nPrice, k, 1 / nDiv))}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {overflow && (
          <p className="font-mono text-xs text-red-light">Avec ces réglages, les chances dépassent 100 % : baisse la chance du rang E ou du rang Divin.</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!valid || overflow || busy || !loaded}
            className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            {busy ? "…" : "Enregistrer"}
          </button>
          {msg && <p className={`font-mono text-xs ${msg.ok ? "text-blue-light" : "text-red-light"}`}>{msg.text}</p>}
        </div>
      </section>

      <section className="glass-card space-y-3 p-4">
        <h3 className="font-display text-base uppercase tracking-wide">30 derniers jours</h3>
        {draws.length === 0 ? (
          <p className="font-body text-sm text-paper/60">Aucun tirage.</p>
        ) : (
          <>
            <p className="font-mono text-xs text-paper/70">
              {draws.length.toLocaleString("fr-FR")} tirage{draws.length > 1 ? "s" : ""} · {money(spent)} dépensés
            </p>
            <ul className="flex flex-wrap gap-2">
              {[...GACHA_RANKS].reverse().map((r) =>
                byRank.get(r) ? (
                  <li key={r} className={`qp-chip rank-${r}`}>
                    {RANK_LABEL[r]} : {byRank.get(r)}
                  </li>
                ) : null,
              )}
              {byRank.get("fail") ? <li className="qp-chip rank-E">Ratés : {byRank.get("fail")}</li> : null}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
