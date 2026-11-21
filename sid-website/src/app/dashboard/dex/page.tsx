"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/session";
import { RecruitCardView } from "@/components/quests/QuestPower";
import { AdminPanel, AdminTabBar, useAdminTab, type AdminTab } from "@/components/admin/AdminTabs";
import { DEX_KINDS, RANK_LABEL, GACHA_RANKS, type DexEntry, type DexKind, type GachaRank, type GachaSettings, type RecruitCard } from "@/lib/gacha";
import "@/components/quests/recrutement.css";
import { allyPowers, type AllyKind } from "@/lib/allyPowers";

/**
 * Dex (Lots 86 et 87, migrations 0104 et 0105).
 * - Cartes : réutiliser un renfort sur une quête, fusionner des cartes.
 * - Collection : personnages découverts par type et par rang.
 * - Historique : tirages, dépenses, garanties.
 * - Classement des collectionneurs.
 */

type QuestLite = { id: string; title: string };
type Collection = { total_per_rank: number; found: number; total: number; kinds: Record<DexKind, Record<GachaRank, number>> };
type History = {
  stats: { draws: number; spent: number; fails: number; pities: number; by_rank: Partial<Record<GachaRank, number>> };
  reuse: { count: number; ok: number; spent: number };
  pity_left: Record<DexKind, number | null>;
  draws: { created_at: string; kind: DexKind; rank: GachaRank | null; luck: number; cost: number; pity: boolean; quest: string | null }[];
  fusions: { created_at: string; kind: DexKind; from_rank: GachaRank; to_rank: GachaRank; name: string | null }[];
};
type Leader = { user_id: string; nickname: string; found: number; best: number; divins: number; levels: number; me: boolean };

const TABS: AdminTab[] = [
  { key: "cartes", label: "Cartes", icon: "dice" },
  { key: "collection", label: "Collection", icon: "book" },
  { key: "historique", label: "Historique", icon: "clock" },
  { key: "classement", label: "Classement", icon: "trophy" },
];

const money = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} zénis`;
const pct = (p: number) => `${(Number(p) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const hhmm = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const kindLabel = (k: DexKind) => DEX_KINDS.find((x) => x.key === k)?.label ?? k;
const shortRank = (r: GachaRank) => (r === "Divin" ? "Divin" : r);

function DexInner() {
  const supabase = useMemo(() => createClient(), []);
  const search = useSearchParams();
  const [tab, go] = useAdminTab(TABS, "cartes");
  const [kind, setKind] = useState<DexKind>("renfort");
  const [entries, setEntries] = useState<DexEntry[] | null>(null);
  const [settings, setSettings] = useState<GachaSettings | null>(null);
  const [quests, setQuests] = useState<QuestLite[]>([]);
  const [questId, setQuestId] = useState(search.get("quete") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fusing, setFusing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [fused, setFused] = useState<{ card: RecruitCard; dex_new: boolean; awakened: boolean } | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [leaders, setLeaders] = useState<Leader[] | null>(null);

  const load = useCallback(async () => {
    const [{ data, error: e }, cfg] = await Promise.all([supabase.rpc("dex_list"), supabase.rpc("gacha_settings")]);
    if (e) return setError(/dex_list/.test(e.message) ? "Le dex arrive avec la migration 0104." : e.message);
    setEntries((data ?? []) as DexEntry[]);
    if (!cfg.error) setSettings(cfg.data as GachaSettings);
    const uid = await currentUserId();
    if (!uid) return;
    const { data: parts } = await supabase.from("quest_participants").select("quest_id").eq("user_id", uid).neq("status", "rejected");
    const ids = (parts ?? []).map((p: { quest_id: string }) => p.quest_id);
    if (!ids.length) return setQuests([]);
    const { data: qs } = await supabase.from("quests").select("id, title").in("id", ids).eq("global_power", true).in("status", ["open", "in_progress"]);
    const list = (qs ?? []) as QuestLite[];
    setQuests(list);
    setQuestId((cur) => (cur && list.some((q) => q.id === cur) ? cur : list[0]?.id ?? ""));
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  // Les autres onglets se chargent à la première ouverture (migration 0105).
  useEffect(() => {
    if (tab === "collection" && !collection) supabase.rpc("dex_collection").then(({ data, error: e }) => !e && setCollection(data as Collection));
    if (tab === "historique" && !history) supabase.rpc("gacha_history", { p_limit: 60 }).then(({ data, error: e }) => !e && setHistory(data as History));
    if (tab === "classement" && !leaders) supabase.rpc("dex_leaderboard", { p_limit: 30 }).then(({ data, error: e }) => !e && setLeaders(data as Leader[]));
  }, [tab, supabase, collection, history, leaders]);

  function refreshSide() {
    setCollection(null);
    setHistory(null);
    setLeaders(null);
  }

  async function reuse(e: DexEntry) {
    setBusy(e.id);
    setMsg(null);
    const { data, error: err } = await supabase.rpc("dex_reuse", { p_entry: e.id, p_quest: questId });
    setBusy(null);
    if (err) return setMsg({ ok: false, text: err.message });
    const r = data as { ok: boolean; cost: number; choose?: boolean };
    setMsg(
      r.ok
        ? { ok: true, text: `${e.name} rejoint la quête (${money(r.cost)}).${r.choose ? " Tu as plus de trois renforts : choisis lesquels garder depuis la quête." : ""}` }
        : { ok: false, text: `Échec : ${e.name} n'a pas répondu (${money(r.cost)} perdus). La carte récupère quelques heures.` },
    );
    refreshSide();
    await load();
  }

  const need = Number(settings?.fusion_count ?? 5);
  const list = (entries ?? []).filter((e) => e.kind === kind);
  const count = (k: DexKind) => (entries ?? []).filter((e) => e.kind === k && !e.fused).length;
  const pickedRank = list.find((e) => e.id === picked[0])?.rank;
  const canFuse = (e: DexEntry) => !e.fused && !e.equipped && e.rank !== "Divin" && (!pickedRank || e.rank === pickedRank);
  // Rangs où une fusion est possible tout de suite.
  const fusable = GACHA_RANKS.filter((r) => r !== "Divin" && list.filter((e) => e.rank === r && !e.fused && !e.equipped).length >= need);

  function togglePick(e: DexEntry) {
    setPicked((p) => (p.includes(e.id) ? p.filter((x) => x !== e.id) : p.length < need && canFuse(e) ? [...p, e.id] : p));
  }

  async function fuse() {
    setBusy("fuse");
    setMsg(null);
    const { data, error: err } = await supabase.rpc("dex_fuse", { p_ids: picked });
    setBusy(null);
    if (err) return setMsg({ ok: false, text: /dex_fuse/.test(err.message) ? "La fusion arrive avec la migration 0105." : err.message });
    setFused(data as { card: RecruitCard; dex_new: boolean; awakened: boolean });
    setPicked([]);
    setFusing(false);
    refreshSide();
    await load();
  }

  function switchKind(k: DexKind) {
    setKind(k);
    setPicked([]);
    setFusing(false);
    setFused(null);
    setMsg(null);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl uppercase tracking-wide text-red">Dex</h1>
        <p className="font-body text-paper/70">
          Chaque carte tirée y est enregistrée. Retirer un personnage déjà connu l&apos;éveille (★, cinq niveaux : +5 % par niveau). Les cartes en trop se fusionnent en une carte du rang au-dessus.
        </p>
      </header>

      <AdminTabBar tabs={TABS} tab={tab} onChange={go} label="Sections du dex" />
      {error && <p className="font-mono text-xs text-red-light">{error}</p>}

      <AdminPanel id="cartes" tab={tab}>
        <div role="tablist" aria-label="Type de carte" className="flex flex-wrap gap-2">
          {DEX_KINDS.map((k) => (
            <button
              key={k.key}
              role="tab"
              aria-selected={kind === k.key}
              onClick={() => switchKind(k.key)}
              className={clsx(
                "rounded-lg border px-3 py-1.5 font-mono text-xs uppercase",
                kind === k.key ? "border-red text-paper" : "border-white/15 text-paper/60 hover:text-paper",
              )}
            >
              {k.label} {entries && <span className="text-paper/50">· {count(k.key)}</span>}
            </button>
          ))}
        </div>

        <div className="glass-card space-y-3 p-4">
          {kind === "renfort" &&
            (quests.length === 0 ? (
              <p className="font-body text-sm text-paper/70">Aucune quête à puissance globale en cours où tu participes : prends-en une pour y réutiliser tes cartes.</p>
            ) : (
              <label className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase text-paper/70">
                Réutiliser sur
                <select
                  value={questId}
                  onChange={(e) => setQuestId(e.target.value)}
                  className="max-w-full rounded-lg border border-white/15 bg-ink px-2 py-1.5 text-sm normal-case text-paper"
                >
                  {quests.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFusing((v) => !v);
                setPicked([]);
                setFused(null);
              }}
              className={clsx(
                "rounded-lg border px-3 py-1.5 font-mono text-xs uppercase",
                fusing ? "border-yellow-300 text-yellow-200" : "border-white/15 text-paper/75 hover:text-paper",
              )}
            >
              {fusing ? "Annuler la fusion" : `Fusionner ${need} cartes`}
            </button>
            {!fusing && (
              <span className="font-mono text-[11px] text-paper/55">
                {fusable.length ? `Possible maintenant : rang ${fusable.map(shortRank).join(", ")}` : `Il faut ${need} cartes du même rang, ni fusionnées ni équipées.`}
              </span>
            )}
            {fusing && (
              <>
                <span className="font-mono text-xs text-paper/70">
                  {picked.length} / {need}
                  {pickedRank ? ` · rang ${shortRank(pickedRank)} → ${shortRank(GACHA_RANKS[GACHA_RANKS.indexOf(pickedRank) + 1])}` : " · choisis les cartes"}
                </span>
                <button
                  type="button"
                  className="rounded-lg bg-yellow-300/90 px-3 py-1.5 font-mono text-xs uppercase text-ink disabled:opacity-40"
                  disabled={picked.length !== need || busy === "fuse"}
                  onClick={fuse}
                >
                  {busy === "fuse" ? "…" : "Fusionner"}
                </button>
              </>
            )}
          </div>
          {fusing && <p className="font-body text-sm text-paper/60">Les cartes fusionnées restent dans ta collection mais ne servent plus. Les retirer les ramène.</p>}
          {msg && <p className={clsx("font-mono text-xs", msg.ok ? "text-blue-light" : "text-red-light")}>{msg.text}</p>}
          {fused && (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-yellow-300/30 p-3">
              <div className={`rd-reveal rank-${fused.card.rank}`} style={{ width: "13rem" }}>
                <RecruitCardView card={fused.card} size="md" />
              </div>
              <p className="font-mono text-xs uppercase text-paper/80">
                Fusion réussie : {fused.card.name} · {RANK_LABEL[fused.card.rank]}
                {fused.dex_new ? " · nouveau" : fused.awakened ? " · éveil" : ""}
              </p>
            </div>
          )}
        </div>

        {entries && list.length === 0 && <p className="glass-card px-4 py-3 font-body text-sm text-paper/60">Aucune carte pour le moment.</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => {
            const waiting = e.reuse_ready_at && new Date(e.reuse_ready_at).getTime() > Date.now();
            const sel = picked.includes(e.id);
            const blocked = fusing && !sel && (!canFuse(e) || picked.length >= need);
            return (
              <article key={e.id} className={clsx("glass-card flex flex-col items-start gap-3 p-4", e.fused && "opacity-45", blocked && "opacity-40")}>
                <RecruitCardView card={e} size="md" selected={sel} onClick={fusing && !blocked ? () => togglePick(e) : undefined} />
                <p className="font-mono text-[11px] text-paper/60">
                  Tirée {e.draws} fois{e.level ? ` · éveil ${e.level}/5` : ""} · dernière le {new Date(e.last_at).toLocaleDateString("fr-FR")}
                </p>
                {e.fused ? (
                  <p className="font-mono text-xs text-paper/60">Fusionnée. La retirer la ramène.</p>
                ) : fusing ? null : e.kind === "renfort" ? (
                  <div className="w-full space-y-2">
                    <p className="font-mono text-xs text-paper/75">
                      Réutilisation : <strong className="text-paper">{money(e.reuse_cost)}</strong> · {pct(e.reuse_fail)} d&apos;échec
                    </p>
                    <button type="button" className="qp-recruit w-full" disabled={!questId || !!waiting || busy === e.id} onClick={() => reuse(e)}>
                      {waiting ? `Disponible ${hhmm(e.reuse_ready_at!)}` : busy === e.id ? "…" : "Utiliser sur la quête"}
                    </button>
                  </div>
                ) : (
                  <div className="w-full space-y-1">
                    {(() => {
                      const pw = allyPowers(e.kind as AllyKind, e);
                      return pw.specs.map((x) => (
                        <details key={x.spec} className="font-body text-xs text-paper/70">
                          <summary className="cursor-pointer font-mono text-xs text-paper">
                            {x.label} · force {String(pw.force).replace(".", ",")}
                          </summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            {x.lines.map((l) => (
                              <li key={l}>{l}</li>
                            ))}
                          </ul>
                        </details>
                      ));
                    })()}
                    <p className="font-mono text-xs text-paper/75">
                      Protège {e.ally_charges} fois par jour, {e.ally_chance} % de réussite{e.equipped ? " · équipé" : ""}.
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {kind !== "renfort" && <p className="font-body text-sm text-paper/60">Pour équiper un allié, ouvre la page de sa simulation.</p>}
      </AdminPanel>

      <AdminPanel id="collection" tab={tab}>
        {!collection ? (
          <p className="font-mono text-xs text-paper/60">Chargement…</p>
        ) : (
          <>
            <div className="glass-card space-y-2 p-4">
              <p className="font-mono text-xs uppercase text-paper/70">
                {collection.found.toLocaleString("fr-FR")} personnages découverts sur {collection.total.toLocaleString("fr-FR")}
              </p>
              <Bar value={collection.found / collection.total} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {DEX_KINDS.map((k) => (
                <section key={k.key} className="glass-card space-y-2 p-4">
                  <h2 className="font-display text-base uppercase tracking-wide">{k.label}</h2>
                  <ul className="space-y-1.5">
                    {[...GACHA_RANKS].reverse().map((r) => {
                      const n = collection.kinds[k.key]?.[r] ?? 0;
                      return (
                        <li key={r} className={`rank-${r} grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 font-mono text-xs`}>
                          <span style={{ color: "var(--rk)" }}>{RANK_LABEL[r].replace("Rang ", "")}</span>
                          <Bar value={n / collection.total_per_rank} color="var(--rk)" />
                          <span className="text-right text-paper/70">
                            {n} / {collection.total_per_rank}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </AdminPanel>

      <AdminPanel id="historique" tab={tab}>
        {!history ? (
          <p className="font-mono text-xs text-paper/60">Chargement…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Tile label="Tirages" value={history.stats.draws.toLocaleString("fr-FR")} />
              <Tile label="Dépensés en tirages" value={money(history.stats.spent)} />
              <Tile label="Sans réponse" value={history.stats.draws ? pct(history.stats.fails / history.stats.draws) : "—"} />
              <Tile label="Garanties" value={String(history.stats.pities)} />
              <Tile label="Réutilisations réussies" value={`${history.reuse.ok} / ${history.reuse.count}`} />
            </div>
            <div className="glass-card space-y-2 p-4">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-paper/65">Garantie rang A ou mieux</h2>
              <ul className="flex flex-wrap gap-2">
                {DEX_KINDS.map((k) => (
                  <li key={k.key} className="rounded-lg border border-white/10 px-2 py-1 font-mono text-xs text-paper/75">
                    {k.label} :{" "}
                    {history.pity_left[k.key] == null ? "désactivée" : history.pity_left[k.key]! <= 1 ? "au prochain tirage" : `dans ${history.pity_left[k.key]} tirages`}
                  </li>
                ))}
              </ul>
              {Object.keys(history.stats.by_rank).length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {[...GACHA_RANKS].reverse().map((r) =>
                    history.stats.by_rank[r] ? (
                      <li key={r} className={`qp-chip rank-${r}`}>
                        {RANK_LABEL[r]} : {history.stats.by_rank[r]}
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
            </div>
            {history.fusions.length > 0 && (
              <div className="glass-card space-y-2 p-4">
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-paper/65">Fusions</h2>
                <ul className="space-y-1 font-mono text-xs text-paper/75">
                  {history.fusions.map((f, i) => (
                    <li key={i}>
                      {when(f.created_at)} · {kindLabel(f.kind)} · {shortRank(f.from_rank)} → <span className={`rank-${f.to_rank}`} style={{ color: "var(--rk)" }}>{shortRank(f.to_rank)}</span>
                      {f.name ? ` · ${f.name}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="glass-card overflow-x-auto p-4">
              {history.draws.length === 0 ? (
                <p className="font-body text-sm text-paper/60">Aucun tirage.</p>
              ) : (
                <table className="w-full font-mono text-xs">
                  <thead className="text-left uppercase text-paper/50">
                    <tr>
                      <th className="py-1 pr-2 font-normal">Quand</th>
                      <th className="py-1 pr-2 font-normal">Type</th>
                      <th className="py-1 pr-2 font-normal">Rang</th>
                      <th className="hidden py-1 pr-2 text-right font-normal sm:table-cell">Chance</th>
                      <th className="py-1 text-right font-normal">Prix</th>
                    </tr>
                  </thead>
                  <tbody className="text-paper/80">
                    {history.draws.map((d, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="whitespace-nowrap py-1 pr-2">{when(d.created_at)}</td>
                        <td className="py-1 pr-2">{d.quest ? d.quest : kindLabel(d.kind)}</td>
                        <td className={clsx("whitespace-nowrap py-1 pr-2", d.rank && `rank-${d.rank}`)} style={d.rank ? { color: "var(--rk)" } : undefined}>
                          {d.rank ? RANK_LABEL[d.rank].replace("Rang ", "") : <span className="text-paper/45">—</span>}
                          {d.pity && <span className="ml-1 text-paper/50">garantie</span>}
                        </td>
                        <td className="hidden py-1 pr-2 text-right sm:table-cell">×{Number(d.luck).toLocaleString("fr-FR")}</td>
                        <td className="py-1 text-right whitespace-nowrap">{money(d.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </AdminPanel>

      <AdminPanel id="classement" tab={tab}>
        {!leaders ? (
          <p className="font-mono text-xs text-paper/60">Chargement…</p>
        ) : leaders.length === 0 ? (
          <p className="glass-card px-4 py-3 font-body text-sm text-paper/60">Personne n&apos;a encore de carte.</p>
        ) : (
          <div className="glass-card overflow-x-auto p-4">
            <table className="w-full min-w-[26rem] font-mono text-xs">
              <thead className="text-left uppercase text-paper/50">
                <tr>
                  <th className="py-1 pr-2 font-normal">#</th>
                  <th className="py-1 pr-2 font-normal">Agent</th>
                  <th className="py-1 pr-2 text-right font-normal">Cartes</th>
                  <th className="py-1 pr-2 font-normal">Meilleur</th>
                  <th className="py-1 pr-2 text-right font-normal">Divins</th>
                  <th className="py-1 text-right font-normal">Éveils</th>
                </tr>
              </thead>
              <tbody className="text-paper/80">
                {leaders.map((l, i) => {
                  const best = GACHA_RANKS[l.best];
                  return (
                    <tr key={l.user_id} className={clsx("border-t border-white/5", l.me && "bg-white/5 text-paper")}>
                      <td className="py-1.5 pr-2">{i + 1}</td>
                      <td className="py-1.5 pr-2">{l.nickname}</td>
                      <td className="py-1.5 pr-2 text-right">{l.found}</td>
                      <td className={`py-1.5 pr-2 rank-${best}`} style={{ color: "var(--rk)" }}>
                        {RANK_LABEL[best]}
                      </td>
                      <td className="py-1.5 pr-2 text-right">{l.divins}</td>
                      <td className="py-1.5 text-right">{l.levels}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </div>
  );
}

function Bar({ value, color = "#f0c27a" }: { value: number; color?: string }) {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="presentation">
      <span className="block h-full rounded-full" style={{ width: `${w > 0 ? Math.max(w, 1.5) : 0}%`, background: color }} />
    </span>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/55">{label}</p>
      <p className="mt-1 font-mono text-sm text-paper">{value}</p>
    </div>
  );
}

export default function DexPage() {
  return (
    <Suspense fallback={null}>
      <DexInner />
    </Suspense>
  );
}
