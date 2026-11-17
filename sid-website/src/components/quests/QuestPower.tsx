"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import type { Quest } from "@/types/database";
import { SidIcon } from "@/components/icons/SidIcon";
import { formatStat } from "@/lib/questRequirements";
import {
  GACHA_RANKS,
  LUCK_MAX,
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
  card: Pick<RecruitCard, "rank" | "name" | "intelligence" | "strength" | "technique" | "power">;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="rc-rank">{card.rank === "Divin" ? "✦" : card.rank}</span>
      <span className="rc-name">{card.name}</span>
      <span className="rc-label">{RANK_LABEL[card.rank]}</span>
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

type DrawResult = { rank: GachaRank | null; cost: number; balance: number; choose?: boolean; card?: RecruitCard };

function RecruitDialog({
  quest,
  settings,
  balance: initialBalance,
  cards,
  onClose,
  onChange,
}: {
  quest: Quest;
  settings: GachaSettings;
  balance: number;
  cards: RecruitCard[];
  onClose: () => void;
  onChange: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [luck, setLuck] = useState(1);
  const [balance, setBalance] = useState(initialBalance);
  const [stage, setStage] = useState<"setup" | "rolling" | "result" | "choose">(cards.some((c) => !c.kept) ? "choose" : "setup");
  const [result, setResult] = useState<DrawResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pool, setPool] = useState<RecruitCard[]>(cards);
  const [picked, setPicked] = useState<Set<string>>(() => topThree(cards));
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && stage !== "rolling" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose, stage]);

  const odds = gachaOdds(settings.prob_e, settings.prob_divin, luck);
  const base = gachaOdds(settings.prob_e, settings.prob_divin, 1);
  const cost = gachaCost(settings.price, luck);

  async function draw() {
    if (started.current) return;
    started.current = true;
    setError(null);
    setStage("rolling");
    const wait = new Promise((r) => setTimeout(r, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 1400));
    const [{ data, error: e }] = await Promise.all([supabase.rpc("quest_gacha_draw", { p_quest: quest.id, p_luck: luck }), wait]);
    started.current = false;
    if (e) {
      setStage("setup");
      return setError(/quest_gacha_draw/.test(e.message) ? "Le recrutement arrive avec la migration 0102." : e.message);
    }
    const r = data as DrawResult;
    setResult(r);
    setBalance(Number(r.balance));
    if (r.card) {
      const next = [...pool, r.card];
      setPool(next);
      if (r.choose) setPicked(topThree(next));
    }
    setStage("result");
    onChange();
  }

  async function keep() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("quest_cards_keep", { p_quest: quest.id, p_keep: Array.from(picked) });
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
            <p className="rd-kicker">Recrutement · {quest.title}</p>
            <h2 id="rd-titre" className="rd-title">
              {stage === "choose" ? "Garde trois renforts" : "Recruter un renfort"}
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
              <label htmlFor="rd-luck" className="rd-luck-label">
                <span>Bonus de chance</span>
                <strong>×{luck.toLocaleString("fr-FR")}</strong>
              </label>
              <input
                id="rd-luck"
                type="range"
                min={1}
                max={LUCK_MAX}
                step={0.5}
                value={luck}
                onChange={(e) => setLuck(Number(e.target.value))}
              />
              <p className="rd-luck-hint">Multiplie les chances des rangs D à Divin.</p>
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

            <div className="rd-pay">
              <p>
                Prix du tirage <strong>{money(cost)}</strong>
                {luck > 1 && <span className="rd-ratio"> · {(cost / settings.price).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}× le prix</span>}
              </p>
              <p className="rd-balance">Ton solde : {money(balance)}</p>
            </div>
            <p className="rd-small">Payé même si personne ne répond. Trois renforts au plus sur cette quête : au-delà, tu choisis lesquels garder.</p>
            {error && <p className="rd-error">{error}</p>}
            <button type="button" className="rd-go" onClick={draw} disabled={balance < cost}>
              {balance < cost ? "Solde insuffisant" : `Recruter · ${money(cost)}`}
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
            {result.card ? (
              <>
                <div className={`rd-reveal rank-${result.card.rank}`}>
                  <RecruitCardView card={result.card} size="lg" />
                </div>
                <p className="rd-caption">
                  {result.card.name} répond à l&apos;appel · {RANK_LABEL[result.card.rank]}
                </p>
              </>
            ) : (
              <>
                <div className="rd-empty" aria-hidden>
                  ?
                </div>
                <p className="rd-caption">Personne n&apos;a répondu à l&apos;appel.</p>
              </>
            )}
            <p className="rd-small">
              {money(result.cost)} payés · solde {money(balance)}
            </p>
            {error && <p className="rd-error">{error}</p>}
            <div className="rd-actions">
              {result.choose ? (
                <button type="button" className="rd-go" onClick={() => setStage("choose")}>
                  Choisir les trois à garder
                </button>
              ) : (
                <button type="button" className="rd-go" onClick={() => setStage("setup")}>
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

function topThree(cards: RecruitCard[]): Set<string> {
  return new Set([...cards].sort((a, b) => Number(b.power) - Number(a.power)).slice(0, 3).map((c) => c.id));
}
