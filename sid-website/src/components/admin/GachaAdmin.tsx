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
  // Alliés de simulation et réutilisation du dex (migration 0104).
  const [rx, setRx] = useState({ sim: "1000", emin: "5000", emax: "25000", dmin: "10000000", dmax: "50000000", fe: "2", fd: "25", cd: "2" });
  const [rxMsg, setRxMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rxBusy, setRxBusy] = useState(false);
  // Garantie, tirage ×10 et fusion (migration 0105).
  const [ex, setEx] = useState({ pity: "50", disc: "10", fusion: "5" });
  const [exMsg, setExMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [exBusy, setExBusy] = useState(false);
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
      if (s.pity_draws != null)
        setEx({ pity: String(s.pity_draws), disc: String(Math.round(Number(s.multi_discount ?? 0) * 1000) / 10), fusion: String(s.fusion_count ?? 5) });
      if (s.dex) {
        setRx({
          sim: String(Number(s.sim_price ?? s.price)),
          emin: String(s.dex.cost_e_min), emax: String(s.dex.cost_e_max),
          dmin: String(s.dex.cost_divin_min), dmax: String(s.dex.cost_divin_max),
          fe: String(Math.round(Number(s.dex.fail_e) * 1000) / 10), fd: String(Math.round(Number(s.dex.fail_divin) * 1000) / 10),
          cd: String(s.dex.cooldown_hours),
        });
      }
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

  async function saveRx() {
    const n = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));
    setRxBusy(true);
    setRxMsg(null);
    const { error } = await supabase.rpc("recruit_settings_set", {
      p_sim_price: n(rx.sim), p_cost_e_min: n(rx.emin), p_cost_e_max: n(rx.emax), p_cost_divin_min: n(rx.dmin), p_cost_divin_max: n(rx.dmax),
      p_fail_e: n(rx.fe) / 100, p_fail_divin: n(rx.fd) / 100, p_cooldown_hours: n(rx.cd),
    });
    setRxBusy(false);
    setRxMsg(error ? { ok: false, text: /recruit_settings_set/.test(error.message) ? "Réglages disponibles avec la migration 0104." : error.message } : { ok: true, text: "Réglages enregistrés." });
  }

  async function saveEx() {
    const n = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));
    setExBusy(true);
    setExMsg(null);
    const { error } = await supabase.rpc("gacha_extra_set", { p_pity_draws: Math.round(n(ex.pity)), p_multi_discount: n(ex.disc) / 100, p_fusion_count: Math.round(n(ex.fusion)) });
    setExBusy(false);
    setExMsg(error ? { ok: false, text: /gacha_extra_set/.test(error.message) ? "Réglages disponibles avec la migration 0105." : error.message } : { ok: true, text: "Réglages enregistrés." });
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
            le rang E et le rang Divin. Le reste des chances donne un tirage raté, payé quand même. L'argent des tirages va dans la cagnotte TVA. Le joueur choisit librement son bonus de chance : chaque rang de D à Divin devient autant de fois plus probable, et le prix suit (4,8 fois le prix pour ×5).
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

      <section className="glass-card space-y-4 p-4">
        <div>
          <h3 className="font-display text-base uppercase tracking-wide">Alliés de simulation et dex</h3>
          <p className="font-body text-sm text-paper/70">
            Les alliés (Compagnons, Sages, Artisans) se tirent comme les renforts, au prix ci-dessous pour ×1. Réutiliser un renfort du dex coûte entre un minimum et un maximum selon la
            qualité de la carte ; les rangs intermédiaires suivent une suite géométrique entre le rang E et le rang Divin, comme le risque d&apos;échec. Après un échec, la carte est bloquée.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["sim", "Tirage d'allié ×1 (zénis)"],
            ["emin", "Réutilisation rang E : minimum"],
            ["emax", "Réutilisation rang E : maximum"],
            ["dmin", "Réutilisation Divin : minimum"],
            ["dmax", "Réutilisation Divin : maximum"],
            ["fe", "Échec rang E (%)"],
            ["fd", "Échec rang Divin (%)"],
            ["cd", "Blocage après échec (heures)"],
          ] as const).map(([k, label]) => (
            <label key={k} className="space-y-1">
              <span className={labelClass}>{label}</span>
              <input className={inputClass} inputMode="decimal" value={rx[k]} onChange={(ev) => setRx((r) => ({ ...r, [k]: ev.target.value }))} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={saveRx} disabled={rxBusy} className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
            {rxBusy ? "…" : "Enregistrer"}
          </button>
          {rxMsg && <p className={`font-mono text-xs ${rxMsg.ok ? "text-blue-light" : "text-red-light"}`}>{rxMsg.text}</p>}
        </div>
      </section>

      <section className="glass-card space-y-4 p-4">
        <div>
          <h3 className="font-display text-base uppercase tracking-wide">Garantie, tirage ×10 et fusion</h3>
          <p className="font-body text-sm text-paper/70">
            Garantie : après ce nombre de tirages sans rang A ou mieux (compté à part pour les renforts et chaque simulation), le suivant donne au moins un rang A. 0 la désactive. La remise
            s&apos;applique au tirage ×10. La fusion transforme ce nombre de cartes du même rang en une carte du rang au-dessus.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["pity", "Garantie après (tirages)"],
            ["disc", "Remise du tirage ×10 (%)"],
            ["fusion", "Cartes par fusion"],
          ] as const).map(([k, label]) => (
            <label key={k} className="space-y-1">
              <span className={labelClass}>{label}</span>
              <input className={inputClass} inputMode="decimal" value={ex[k]} onChange={(ev) => setEx((r) => ({ ...r, [k]: ev.target.value }))} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={saveEx} disabled={exBusy} className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
            {exBusy ? "…" : "Enregistrer"}
          </button>
          {exMsg && <p className={`font-mono text-xs ${exMsg.ok ? "text-blue-light" : "text-red-light"}`}>{exMsg.text}</p>}
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
