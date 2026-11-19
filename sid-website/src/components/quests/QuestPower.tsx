"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import type { Quest } from "@/types/database";
import { SidIcon } from "@/components/icons/SidIcon";
import { formatStat } from "@/lib/questRequirements";
import {
  GACHA_RANKS,
  luckMax,
  RANK_LABEL,
  formatOdds,
  gachaCost,
  gachaOdds,
  type GachaRank,
  type GachaSettings,
  type RecruitCard,
} from "@/lib/gacha";
import "./recrutement.css";

/**
 * Quête à puissance globale (Lot 85) : la puissance réunie par les
 * participants et leurs renforts, et le recrutement.
 */

type StatKey = "intelligence" | "strength" | "technique" | "power";
type Stats = Record<StatKey, number>;
type Member = Stats & { user_id: string; nickname: string; cards: RecruitCard[] };
type PowerData = {
  global: boolean;
  total: Stats;
  required: Stats;
  met: boolean;
  members: Member[];
  settings: GachaSettings;
  balance: number;
};

const STATS: { key: StatKey; label: string; short: string }[] = [
  { key: "intelligence", label: "Intelligence", short: "Int." },
  { key: "strength", label: "Puissance", short: "Pui." },
  { key: "technique", label: "Technique", short: "Tech." },
  { key: "power", label: "Puissance globale", short: "Glob." },
];

const money = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} zénis`;

export function QuestPower({ quest, userId, joined, onChange }: { quest: Quest; userId: string | null; joined: boolean; onChange?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<PowerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [recruiting, setRecruiting] = useState(false);

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc("quest_power", { p_quest: quest.id });
    if (e) return setError(/quest_power/.test(e.message) ? "La puissance globale arrive avec la migration 0102." : e.message);
    setError(null);
    setData(d as PowerData);
  }, [supabase, quest.id]);

  useEffect(() => {
    load();
  }, [load, joined]);

  if (error) return <p className="qp-note">{error}</p>;
  if (!data) return <div className="qp qp-loading" aria-hidden />;

  const required = STATS.filter((s) => Number(data.required[s.key]) > 0);
  const mine = data.members.find((m) => m.user_id === userId);
  const myCards = mine?.cards ?? [];
  const pending = myCards.some((c) => !c.kept);
  const canRecruit = joined && !!mine && (quest.status === "open" || quest.status === "in_progress");

  return (
    <section className="qp" aria-label="Puissance réunie">
      <div className="qp-head">
        <p className="qp-title">
          <SidIcon name="people" /> Puissance réunie
        </p>
        <span className={`qp-badge ${data.met ? "is-met" : ""}`}>{data.met ? "Atteinte" : "À réunir"}</span>
      </div>

      {required.length === 0 ? (
        <p className="qp-note">Aucun prérequis : la puissance du groupe s&apos;affiche pour information.</p>
      ) : (
        <ul className="qp-gauges">
          {required.map((s) => {
            const have = Number(data.total[s.key]);
            const need = Number(data.required[s.key]);
            const pct = Math.min(100, (have / need) * 100);
            return (
              <li key={s.key}>
                <div className="qp-gauge-label">
                  <span>{s.label}</span>
                  <span className={have >= need ? "text-blue-light" : ""}>
                    {formatStat(have)} / {formatStat(need)}
                  </span>
                </div>
                <div className="qp-bar" role="progressbar" aria-label={s.label} aria-valuemin={0} aria-valuemax={need} aria-valuenow={have}>
                  <span style={{ width: `${pct}%` }} className={have >= need ? "is-met" : ""} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data.members.length > 0 && (
        <button type="button" className="qp-link" onClick={() => setShowMembers((v) => !v)} aria-expanded={showMembers}>
          {showMembers ? "Masquer" : "Voir"} qui apporte quoi ({data.members.length})
        </button>
      )}
      {showMembers && (
        <ul className="qp-members">
          {data.members.map((m) => {
            const kept = m.cards.filter((c) => c.kept);
            return (
              <li key={m.user_id}>
                <p className="qp-member-name">{m.nickname}</p>
                <p className="qp-member-stats">
                  {(required.length ? required : STATS).map((s) => `${s.short} ${formatStat(m[s.key])}`).join(" · ")}
                </p>
                {kept.length > 0 && (
                  <p className="qp-member-cards">
                    {kept.map((c) => (
                      <span key={c.id} className={`qp-chip rank-${c.rank}`}>
                        {c.rank} · {c.name}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {joined && myCards.length > 0 && (
        <div className="qp-mine">
          <p className="qp-sub">Tes renforts ({myCards.filter((c) => c.kept).length}/3)</p>
          <div className="qp-mine-row">
            {myCards
              .filter((c) => c.kept)
              .map((c) => (
                <RecruitCardView key={c.id} card={c} size="sm" />
              ))}
          </div>
        </div>
      )}

      {canRecruit ? (
        <button type="button" className="qp-recruit" onClick={() => setRecruiting(true)}>
          <SidIcon name="dice" /> {pending ? "Choisir les renforts à garder" : "Recruter un renfort"}
        </button>
      ) : (
        !joined && userId && <p className="qp-note">Prends la mission pour recruter des renforts.</p>
      )}
      {canRecruit && (
        <Link href={`/dashboard/dex?quete=${quest.id}`} className="qp-note underline">
          Réutiliser une carte de mon dex sur cette quête
        </Link>
      )}

      {recruiting && data && (
        <RecruitDialog
          quest={quest}
          settings={data.settings}
          balance={data.balance}
          cards={myCards}
          onClose={() => setRecruiting(false)}
          onChange={() => {
            load();
            onChange?.();
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function RecruitCardView({
  card,
  size = "md",
  selected,
  onClick,
}: {
  card: Pick<RecruitCard, "rank" | "name" | "intelligence" | "strength" | "technique" | "power"> & { level?: number };
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="rc-rank">{card.rank === "Divin" ? "✦" : card.rank}</span>
      <span className="rc-name">{card.name}</span>
      <span className="rc-label">{RANK_LABEL[card.rank]}</span>
      {!!card.level && (
        <span className="rc-level" title={`Éveil ${card.level} sur 5`} aria-label={`Éveil ${card.level} sur 5`}>
          {"★".repeat(card.level)}
          <span aria-hidden>{"☆".repeat(Math.max(0, 5 - card.level))}</span>
        </span>
      )}
      <span className="rc-stats">
        {STATS.slice(0, 3).map((s) => (
          <span key={s.key} className="rc-stat">
            <span>{s.short}</span>
            <span className="rc-bar">
              <span style={{ width: `${Math.min(100, (Number(card[s.key]) / (card.rank === "Divin" ? 200 : 100)) * 100)}%` }} />
            </span>
            <span className="rc-val">{formatStat(card[s.key])}</span>
          </span>
        ))}
      </span>
      <span className="rc-power">
        <span>Puissance globale</span> {formatStat(card.power)}
      </span>
    </>
  );
  const cls = `rc rc-${size} rank-${card.rank} ${selected ? "is-selected" : ""}`;
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-pressed={!!selected}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ------------------------------------------------------------------ */

type DrawOne = { rank: GachaRank | null; pity?: boolean; dex_new?: boolean; awakened?: boolean; level?: number; card?: RecruitCard };
type DrawResult = { cost: number; balance: number; choose?: boolean; pity_left?: number | null; results: DrawOne[] };

const RANK_ORDER: Record<string, number> = { E: 0, D: 1, C: 2, B: 3, A: 4, S: 5, Divin: 6 };

export function RecruitDialog({
  quest,
  sim,
  onEquip,
  settings,
  balance: initialBalance,
  cards,
  onClose,
  onChange,
}: {
  /** Quête à puissance globale (renfort), ou… */
  quest?: Quest;
  /** …simulation (allié) : le tirage entre dans le dex, sans limite de trois. */
  sim?: { kind: "donjons" | "intelligence" | "techniques"; label: string };
  onEquip?: (cardId: string) => void;
  settings: GachaSettings;
  balance: number;
  cards: RecruitCard[];
  onClose: () => void;
  onChange: () => void;
}) {
  const unitPrice = sim ? Number(settings.sim_price ?? settings.price) : settings.price;
  const supabase = useMemo(() => createClient(), []);
  const [luck, setLuckRaw] = useState(1);
  const [luckText, setLuckText] = useState("1");
  const maxLuck = luckMax(settings.prob_divin);
  const setLuck = (n: number) => {
    const v = Math.max(1, Math.min(maxLuck, Math.round(n * 100) / 100));
    setLuckRaw(v);
    setLuckText(String(v).replace(".", ","));
  };
  const [balance, setBalance] = useState(initialBalance);
  const [stage, setStage] = useState<"setup" | "rolling" | "result" | "choose">(cards.some((c) => !c.kept) ? "choose" : "setup");
  const [result, setResult] = useState<DrawResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pool, setPool] = useState<RecruitCard[]>(cards);
  const [picked, setPicked] = useState<Set<string>>(() => topThree(cards));
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<1 | 10>(1);
  const [pityLeft, setPityLeft] = useState<number | null>(null);
  const started = useRef(false);
  const pityPool = sim ? sim.kind : "renfort";
  const discount = Number(settings.multi_discount ?? 0);

  useEffect(() => {
    supabase.rpc("gacha_pity_left", { p_pool: pityPool }).then(({ data, error: e }) => !e && setPityLeft(data as number | null));
  }, [supabase, pityPool]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && stage !== "rolling" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose, stage]);

  const odds = gachaOdds(settings.prob_e, settings.prob_divin, luck);
  const base = gachaOdds(settings.prob_e, settings.prob_divin, 1);
  const unitCost = gachaCost(unitPrice, luck, settings.prob_divin);
  const cost = Math.round(unitCost * count * (count === 10 ? 1 - discount : 1) * 100) / 100;
  const presets = [1, 2, 5, 10, 100, 1000].filter((k) => k <= maxLuck);

  async function draw() {
    if (started.current) return;
    started.current = true;
    setError(null);
    setStage("rolling");
    const wait = new Promise((r) => setTimeout(r, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 1400));
    const [{ data, error: e }] = await Promise.all([
      sim
        ? supabase.rpc("sim_gacha_draw_n", { p_kind: sim.kind, p_luck: luck, p_count: count })
        : supabase.rpc("quest_gacha_draw_n", { p_quest: quest!.id, p_luck: luck, p_count: count }),
      wait,
    ]);
    started.current = false;
    if (e) {
      setStage("setup");
      return setError(/gacha_draw_n/.test(e.message) ? "Le tirage ×10 et la garantie arrivent avec la migration 0105." : e.message);
    }
    const r = data as DrawResult;
    setResult(r);
    setBalance(Number(r.balance));
    if (r.pity_left !== undefined) setPityLeft(r.pity_left);
    const got = r.results.flatMap((x) => (x.card ? [x.card] : []));
    if (got.length && !sim) {
      const next = [...pool, ...got];
      setPool(next);
      if (r.choose) setPicked(topThree(next));
    }
    setStage("result");
    onChange();
  }

  async function keep() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("quest_cards_keep", { p_quest: quest!.id, p_keep: Array.from(picked) });
    setBusy(false);
    if (e) return setError(e.message);
    setPool((p) => p.filter((c) => picked.has(c.id)).map((c) => ({ ...c, kept: true })));
    setResult(null);
    setStage("setup");
    onChange();
  }

  function toggle(id: string) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < 3) n.add(id);
      return n;
    });
  }

  return createPortal(
    <div className="rd-overlay" onMouseDown={() => stage !== "rolling" && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="rd-titre" className="rd-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="rd-top">
          <div className="min-w-0">
            <p className="rd-kicker">Recrutement · {sim ? sim.label : quest?.title}</p>
            <h2 id="rd-titre" className="rd-title">
              {stage === "choose" ? "Garde trois renforts" : sim ? "Recruter un allié" : "Recruter un renfort"}
            </h2>
          </div>
          {stage !== "rolling" && (
            <button type="button" onClick={onClose} className="rd-close" aria-label="Fermer">
              ✕
            </button>
          )}
        </div>

        {stage === "setup" && (
          <>
            <div className="rd-luck">
              <div className="rd-luck-label">
                <label htmlFor="rd-luck">Bonus de chance</label>
                <span className="rd-luck-field">
                  ×
                  <input
                    id="rd-luck"
                    inputMode="decimal"
                    value={luckText}
                    onChange={(e) => {
                      setLuckText(e.target.value);
                      const n = Number(e.target.value.replace(/\s/g, "").replace(",", "."));
                      if (Number.isFinite(n) && n >= 1) setLuckRaw(Math.min(maxLuck, Math.round(n * 100) / 100));
                    }}
                    onBlur={() => setLuck(luck)}
                  />
                </span>
              </div>
              <input
                type="range"
                aria-label="Bonus de chance (échelle logarithmique)"
                min={0}
                max={Math.log10(maxLuck)}
                step={0.01}
                value={Math.log10(luck)}
                onChange={(e) => setLuck(niceLuck(Math.pow(10, Number(e.target.value))))}
              />
              <div className="rd-presets">
                {presets.map((k) => (
                  <button key={k} type="button" className={luck === k ? "is-on" : ""} onClick={() => setLuck(k)}>
                    ×{k.toLocaleString("fr-FR")}
                  </button>
                ))}
              </div>
              <p className="rd-luck-hint">
                Chaque rang de D à Divin devient {luck.toLocaleString("fr-FR")} fois plus probable. À ×{maxLuck.toLocaleString("fr-FR")}, le rang Divin est assuré.
              </p>
            </div>

            <table className="rd-odds">
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col">Chance</th>
                </tr>
              </thead>
              <tbody>
                {[...GACHA_RANKS].reverse().map((r) => (
                  <tr key={r} className={`rank-${r}`}>
                    <td>
                      <span className="rd-dot" /> {RANK_LABEL[r]}
                    </td>
                    <td className={odds[r] > base[r] + 1e-12 ? "is-up" : odds[r] < base[r] - 1e-12 ? "is-down" : ""}>{formatOdds(odds[r])}</td>
                  </tr>
                ))}
                <tr className="is-fail">
                  <td>Personne ne répond</td>
                  <td className={odds.fail < base.fail - 1e-12 ? "is-up" : ""}>{formatOdds(odds.fail)}</td>
                </tr>
              </tbody>
            </table>

            <div className="rd-count" role="group" aria-label="Nombre de tirages">
              <button type="button" className={count === 1 ? "is-on" : ""} aria-pressed={count === 1} onClick={() => setCount(1)}>
                1 tirage
              </button>
              <button type="button" className={count === 10 ? "is-on" : ""} aria-pressed={count === 10} onClick={() => setCount(10)}>
                10 tirages{discount > 0 ? ` · −${Math.round(discount * 100)} %` : ""}
              </button>
            </div>

            <div className="rd-pay">
              <p>
                {count === 10 ? "Prix des 10 tirages" : "Prix du tirage"} <strong>{money(cost)}</strong>
                {luck > 1 && <span className="rd-ratio"> · {(unitCost / (unitPrice || 1)).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}× le prix par tirage</span>}
              </p>
              <p className="rd-balance">Ton solde : {money(balance)}</p>
              {pityLeft != null && (
                <p className="rd-balance">
                  Garantie : rang A ou mieux {pityLeft <= 1 ? "au prochain tirage" : `dans ${pityLeft} tirages au plus`}
                </p>
              )}
            </div>
            <p className="rd-small">
              {sim
                ? "Payé même si personne ne répond. L'allié entre dans ton dex ; équipe-le pour qu'il te protège."
                : "Payé même si personne ne répond. Trois renforts au plus sur cette quête : au-delà, tu choisis lesquels garder. Chaque carte tirée entre dans ton dex."}
            </p>
            {error && <p className="rd-error">{error}</p>}
            <button type="button" className="rd-go" onClick={draw} disabled={balance < cost}>
              {balance < cost ? "Solde insuffisant" : `${count === 10 ? "Recruter ×10" : "Recruter"} · ${money(cost)}`}
            </button>
          </>
        )}

        {stage === "rolling" && (
          <div className="rd-rolling" aria-live="polite">
            <div className="rd-deck" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="rd-caption">L&apos;appel est lancé…</p>
          </div>
        )}

        {stage === "result" && result && (
          <div className="rd-result" aria-live="polite">
            {result.results.length === 1 ? <SingleResult one={result.results[0]} sim={!!sim} /> : <MultiResult results={result.results} onPick={sim && onEquip ? onEquip : undefined} />}
            <p className="rd-small">
              {money(result.cost)} payés · solde {money(balance)}
            </p>
            {error && <p className="rd-error">{error}</p>}
            <div className="rd-actions">
              {sim && onEquip && result.results.length === 1 && result.results[0].card && (
                <button type="button" className="rd-go" onClick={() => onEquip(result.results[0].card!.id)}>
                  Équiper cet allié
                </button>
              )}
              {result.choose ? (
                <button type="button" className="rd-go" onClick={() => setStage("choose")}>
                  Choisir les trois à garder
                </button>
              ) : (
                <button
                  type="button"
                  className={sim && onEquip && result.results.length === 1 && result.results[0].card ? "rd-ghost" : "rd-go"}
                  onClick={() => setStage("setup")}
                >
                  Recruter encore
                </button>
              )}
              <button type="button" className="rd-ghost" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        )}

        {stage === "choose" && (
          <div className="rd-choose">
            <p className="rd-small">
              Tu as {pool.length} renforts : garde-en trois au plus. Les autres seront renvoyés, sans remboursement.
            </p>
            <div className="rd-choose-grid">
              {pool.map((c) => (
                <RecruitCardView key={c.id} card={c} size="md" selected={picked.has(c.id)} onClick={() => toggle(c.id)} />
              ))}
            </div>
            {error && <p className="rd-error">{error}</p>}
            <button type="button" className="rd-go" onClick={keep} disabled={busy || picked.size === 0}>
              {busy ? "…" : `Garder ${picked.size === 1 ? "ce renfort" : `ces ${picked.size} renforts`}`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function DrawBadges({ one }: { one: DrawOne }) {
  if (!one.card) return null;
  return (
    <>
      {one.dex_new && <span className="rd-badge is-new">Nouveau</span>}
      {one.awakened && <span className="rd-badge is-awake">Éveil {one.level}</span>}
      {one.pity && <span className="rd-badge is-pity">Garantie</span>}
    </>
  );
}

function SingleResult({ one, sim }: { one: DrawOne; sim: boolean }) {
  if (!one.card)
    return (
      <>
        <div className="rd-empty" aria-hidden>
          ?
        </div>
        <p className="rd-caption">Personne n&apos;a répondu à l&apos;appel.</p>
      </>
    );
  return (
    <>
      <div className={`rd-reveal rank-${one.card.rank}`}>
        <RecruitCardView card={{ ...one.card, level: one.level ?? one.card.level }} size="lg" />
      </div>
      <p className="rd-caption">
        {one.card.name} répond à l&apos;appel · {RANK_LABEL[one.card.rank]}
      </p>
      <p className="rd-badges">
        <DrawBadges one={one} />
      </p>
      {one.awakened && <p className="rd-small">Déjà dans ton dex : la carte s&apos;éveille (+5 % par niveau).</p>}
      {sim && one.card.ally_chance != null && (
        <p className="rd-small">
          Protège jusqu&apos;à {one.card.ally_charges} fois par jour, avec {one.card.ally_chance} % de réussite.
        </p>
      )}
    </>
  );
}

function MultiResult({ results, onPick }: { results: DrawOne[]; onPick?: (cardId: string) => void }) {
  const got = results.filter((r) => r.card).sort((a, b) => RANK_ORDER[b.rank!] - RANK_ORDER[a.rank!] || Number(b.card!.power) - Number(a.card!.power));
  const fails = results.length - got.length;
  const best = got[0];
  return (
    <>
      <p className="rd-caption">
        {got.length} sur {results.length} ont répondu
        {best ? ` · meilleur : ${RANK_LABEL[best.rank!]}` : ""}
      </p>
      <div className="rd-multi">
        {got.map((r, i) => (
          <div key={r.card!.id} className={`rd-multi-item rank-${r.rank}`} style={{ animationDelay: `${i * 70}ms` }}>
            <RecruitCardView card={{ ...r.card!, level: r.level ?? r.card!.level }} size="sm" onClick={onPick ? () => onPick(r.card!.id) : undefined} />
            <span className="rd-badges">
              <DrawBadges one={r} />
            </span>
          </div>
        ))}
        {Array.from({ length: fails }).map((_, i) => (
          <div key={`f${i}`} className="rd-multi-item is-fail" aria-label="Personne n'a répondu">
            <span className="rd-multi-empty">?</span>
          </div>
        ))}
      </div>
      {onPick && got.length > 0 && <p className="rd-small">Touche une carte pour équiper cet allié.</p>}
    </>
  );
}

/** Arrondi lisible pour le curseur : 1,25 · 3,4 · 47 · 1 200 · 35 000. */
function niceLuck(n: number): number {
  if (n < 10) return Math.round(n * 4) / 4;
  const p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}

function topThree(cards: RecruitCard[]): Set<string> {
  return new Set([...cards].sort((a, b) => Number(b.power) - Number(a.power)).slice(0, 3).map((c) => c.id));
}
