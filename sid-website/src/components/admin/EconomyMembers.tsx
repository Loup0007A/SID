"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { inputClass, labelClass } from "@/lib/ui";
import { SKILLS, STAT_LABELS, type SkillKey } from "@/lib/simulationSites";
import { formatPower } from "@/components/MemberStatBars";
import type { LeaderboardEntry, SalaryFrequency, SalaryView } from "@/types/database";

/**
 * Administration → Économie → Membres (Lot 74) : un tableau compact.
 * Une ligne ouverte permet d'ajuster le solde, la renommée, le salaire et
 * les niveaux du membre. Remplace les trois listes de cartes (une par membre
 * et par réglage) qui rendaient la page interminable.
 */

const FREQ: Record<SalaryFrequency, string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  biweekly: "Toutes les 2 semaines",
  monthly: "Mensuel",
};
const PER_WEEK: Record<SalaryFrequency, number> = { daily: 7, weekly: 1, biweekly: 0.5, monthly: 7 / 30 };
const GROUPS: { label: string; skills: SkillKey[] }[] = [
  { label: STAT_LABELS.intelligence, skills: ["potions", "enigmes", "probleme"] },
  { label: STAT_LABELS.strength, skills: ["mondes-vivants"] },
  { label: STAT_LABELS.technique, skills: ["techniques"] },
];
const skillLabel = (k: SkillKey) => SKILLS.find((s) => s.key === k)?.label ?? k;
const z = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} z`;
const field = `${inputClass} !py-1.5 text-sm`;

type Row = {
  id: string;
  nickname: string;
  reputation: number;
  balance: number;
  salary: SalaryView | null;
  power: LeaderboardEntry | null;
  levels: Partial<Record<SkillKey, number>>;
};
type SortKey = "nickname" | "balance" | "reputation" | "salary" | "power";

export function EconomyMembers() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "nickname", dir: 1 });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const PER = 20;

  const load = useCallback(async () => {
    const [p, w, s, l, k] = await Promise.all([
      supabase.from("profiles").select("id, nickname, reputation").eq("status", "active").order("nickname"),
      supabase.from("wallets").select("user_id, balance"),
      supabase.rpc("list_salaries"),
      supabase.rpc("list_leaderboard"),
      supabase.from("member_skills").select("user_id, skill, points"),
    ]);
    const bal = new Map(((w.data ?? []) as { user_id: string; balance: number }[]).map((x) => [x.user_id, Number(x.balance)]));
    const sal = new Map(((s.data ?? []) as SalaryView[]).map((x) => [x.user_id, x]));
    const pow = new Map(((l.data ?? []) as LeaderboardEntry[]).map((x) => [x.user_id, x]));
    const lv = new Map<string, Partial<Record<SkillKey, number>>>();
    for (const r of (k.data ?? []) as { user_id: string; skill: SkillKey; points: number }[]) lv.set(r.user_id, { ...lv.get(r.user_id), [r.skill]: r.points });
    setRows(
      ((p.data ?? []) as { id: string; nickname: string; reputation: number }[]).map((m) => ({
        id: m.id,
        nickname: m.nickname,
        reputation: Number(m.reputation ?? 0),
        balance: bal.get(m.id) ?? 0,
        salary: sal.get(m.id) ?? null,
        power: pow.get(m.id) ?? null,
        levels: lv.get(m.id) ?? {},
      }))
    );
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = (rows ?? []).filter((r) => !s || r.nickname.toLowerCase().includes(s));
    const val = (r: Row): string | number =>
      sort.key === "nickname"
        ? r.nickname.toLowerCase()
        : sort.key === "balance"
          ? r.balance
          : sort.key === "reputation"
            ? r.reputation
            : sort.key === "salary"
              ? r.salary?.is_active ? Number(r.salary.amount) * PER_WEEK[r.salary.frequency] : -1
              : Number(r.power?.power_score ?? 0);
    return out.sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [rows, q, sort]);

  if (!rows) return <p className="font-body text-sm text-paper/60">Chargement des membres…</p>;

  const pages = Math.max(1, Math.ceil(list.length / PER));
  const shown = list.slice(page * PER, page * PER + PER);
  const active = rows.filter((r) => r.salary?.is_active);
  const weekly = active.reduce((a, r) => a + Number(r.salary!.amount) * PER_WEEK[r.salary!.frequency], 0);
  const head = (key: SortKey, label: string, right = false, extra = "") => (
    <th className={clsx("p-2 font-normal", right && "text-right", extra)} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => {
          setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "nickname" ? 1 : -1 }));
          setPage(0);
        }}
        className={clsx("uppercase hover:text-paper", sort.key === key && "text-paper")}
      >
        {label}
        {sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <section className="space-y-3">
      <div className="glass-card flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <p className="font-body text-sm text-paper/75">
          <span className="font-mono text-[10px] uppercase text-paper/55">Argent des membres</span>
          <br />
          <b className="font-display text-lg text-paper">{z(Math.round(rows.reduce((a, r) => a + r.balance, 0)))}</b>
        </p>
        <p className="font-body text-sm text-paper/75">
          <span className="font-mono text-[10px] uppercase text-paper/55">Salaires actifs</span>
          <br />
          <b className="font-display text-lg text-paper">{active.length}</b>
          <span className="ml-1 font-mono text-xs text-paper/60">≈ {z(Math.round(weekly))} / semaine</span>
        </p>
        <button
          type="button"
          disabled={paying}
          onClick={async () => {
            setPaying(true);
            setMsg(null);
            const { data, error } = await supabase.rpc("pay_salaries_now");
            setPaying(false);
            setMsg(error ? { ok: false, text: error.message } : { ok: true, text: `${data ?? 0} salaire(s) versé(s).` });
            await load();
          }}
          className="ml-auto rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
        >
          {paying ? "Versement…" : "Verser les salaires dus"}
        </button>
        {msg && <p className={clsx("w-full font-mono text-xs", msg.ok ? "text-green-300" : "text-red")}>{msg.text}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="w-full max-w-xs rounded-lg border border-paper-dark bg-ink-soft px-3 py-1.5 font-mono text-xs text-paper outline-none focus:border-blue"
          placeholder="Rechercher un membre…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
        <p className="font-body text-xs text-paper/55">Clique sur un membre pour modifier son solde, sa renommée, son salaire ou ses niveaux.</p>
      </div>

      <div className="glass-card overflow-x-auto p-2">
        <table className="w-full border-collapse font-mono text-xs sm:min-w-[640px]">
          <thead>
            <tr className="border-b border-white/10 text-left text-paper/60">
              {head("nickname", "Membre")}
              {head("balance", "Solde", true)}
              {head("reputation", "Renommée", true)}
              {head("salary", "Salaire", false, "hidden sm:table-cell")}
              {head("power", "Puissance", true, "hidden sm:table-cell")}
              <th className="w-6 p-1" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <Fragment key={r.id}>
                <tr
                  onClick={() => setOpen((o) => (o === r.id ? null : r.id))}
                  className={clsx("cursor-pointer border-b border-white/5 hover:bg-white/5", open === r.id && "bg-white/[0.06]")}
                  aria-expanded={open === r.id}
                >
                  <td className="wrap-any p-2 font-display text-sm uppercase text-paper">{r.nickname}</td>
                  <td className={clsx("whitespace-nowrap p-2 text-right", r.balance < 0 ? "text-red-light" : "text-blue-light")}>{z(r.balance)}</td>
                  <td className="whitespace-nowrap p-2 text-right">{r.reputation.toLocaleString("fr-FR")} pts</td>
                  <td className="hidden p-2 text-paper/75 sm:table-cell">
                    {r.salary ? (
                      <span className={clsx(!r.salary.is_active && "text-paper/40 line-through")}>
                        {z(r.salary.amount)} · {FREQ[r.salary.frequency].toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-paper/35">—</span>
                    )}
                  </td>
                  <td className="hidden p-2 text-right sm:table-cell">{r.power ? formatPower(Number(r.power.power_score)) : "—"}</td>
                  <td className="p-1 text-center text-paper/50">{open === r.id ? "▴" : "▾"}</td>
                </tr>
                {open === r.id && (
                  <tr className="border-b border-white/10">
                    <td colSpan={6} className="p-0">
                      <MemberEditor row={r} onDone={load} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-paper/60">
                  Aucun membre ne correspond.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 font-mono text-xs text-paper/70">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border border-white/15 px-2 py-1 disabled:opacity-30" aria-label="Page précédente">
            ←
          </button>
          <span>
            {page + 1} / {pages} · {list.length} membres
          </span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded border border-white/15 px-2 py-1 disabled:opacity-30" aria-label="Page suivante">
            →
          </button>
        </div>
      )}
    </section>
  );
}

function MemberEditor({ row, onDone }: { row: Row; onDone: () => Promise<void> }) {
  const supabase = useMemo(() => createClient(), []);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [rep, setRep] = useState("");
  const [salAmount, setSalAmount] = useState(String(row.salary?.amount ?? 2500));
  const [salFreq, setSalFreq] = useState<SalaryFrequency>(row.salary?.frequency ?? "weekly");
  const [levels, setLevels] = useState<Partial<Record<SkillKey, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(key: string, fn: string, args: Record<string, unknown>, ok: string, after?: () => void) {
    setBusy(key);
    setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: ok });
    after?.();
    await onDone();
  }

  const n = Number(amount);
  const r = Number(rep);
  const lv = (k: SkillKey) => levels[k] ?? String(row.levels[k] ?? 0);
  const changed = Object.fromEntries(
    Object.entries(levels).filter(([k, v]) => v !== String(row.levels[k as SkillKey] ?? 0))
  ) as Partial<Record<SkillKey, string>>;
  const levelsOk = Object.values(changed).every((v) => v !== "" && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 100);

  return (
    <div className="space-y-4 bg-white/[0.03] p-4 font-body text-sm" onClick={(e) => e.stopPropagation()}>
      <div className="grid gap-4 lg:grid-cols-3">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!n) return;
            void run("solde", "adjust_wallet", { p_user_id: row.id, p_amount: n, p_reason: reason.trim() || "Ajustement manuel" }, `Solde de ${row.nickname} ajusté de ${n > 0 ? "+" : ""}${z(n)}.`, () => {
              setAmount("");
              setReason("");
            });
          }}
        >
          <p className={labelClass}>Solde</p>
          <div className="flex gap-2">
            <input type="number" step="any" placeholder="+ / − montant" aria-label="Montant à ajouter ou retirer" className={`${field} !w-36`} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input placeholder="Raison" aria-label="Raison" maxLength={200} className={field} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <button disabled={!n || busy === "solde"} className="rounded-lg bg-red px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-red-light disabled:opacity-40">
              Appliquer
            </button>
            {!!n && <span className="font-mono text-[11px] text-paper/60">nouveau solde : {z(Math.round((row.balance + n) * 100) / 100)}</span>}
          </div>
        </form>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!r) return;
            void run("rep", "adjust_reputation", { p_user_id: row.id, p_amount: r }, `Renommée de ${row.nickname} : ${r > 0 ? "+" : ""}${r} pts.`, () => setRep(""));
          }}
        >
          <p className={labelClass}>Renommée</p>
          <input type="number" step={1} placeholder="+ / − points" aria-label="Points à ajouter ou retirer" className={`${field} !w-36`} value={rep} onChange={(e) => setRep(e.target.value)} />
          <div className="flex items-center gap-3">
            <button disabled={!r || busy === "rep"} className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
              Appliquer
            </button>
            {!!r && <span className="font-mono text-[11px] text-paper/60">→ {(row.reputation + r).toLocaleString("fr-FR")} pts</span>}
          </div>
        </form>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run("sal", "set_salary", { p_user_id: row.id, p_amount: Number(salAmount) || 2500, p_frequency: salFreq }, `Salaire de ${row.nickname} enregistré.`);
          }}
        >
          <p className={labelClass}>Salaire</p>
          <div className="flex gap-2">
            <input type="number" min={0} aria-label="Montant du salaire" className={`${field} !w-28`} value={salAmount} onChange={(e) => setSalAmount(e.target.value)} />
            <select aria-label="Fréquence" className={field} value={salFreq} onChange={(e) => setSalFreq(e.target.value as SalaryFrequency)}>
              {(Object.keys(FREQ) as SalaryFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQ[f]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={busy === "sal"} className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
              {row.salary?.is_active ? "Modifier" : "Définir"}
            </button>
            {row.salary?.is_active && (
              <button
                type="button"
                disabled={busy === "sal"}
                onClick={() => {
                  if (confirm(`Suspendre le salaire de ${row.nickname} ?`)) void run("sal", "stop_salary", { p_user_id: row.id }, "Salaire suspendu.");
                }}
                className="rounded-lg border border-red/70 px-3 py-1.5 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
              >
                Suspendre
              </button>
            )}
          </div>
          {row.salary?.is_active && (
            <p className="font-mono text-[11px] text-paper/55">
              prochain versement : {new Date(row.salary.next_payment_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </form>
      </div>

      <form
        className="space-y-2 border-t border-white/10 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!Object.keys(changed).length || !levelsOk) return;
          void run(
            "lv",
            "set_member_levels",
            { p_user_id: row.id, p_levels: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, Number(v)])) },
            `Niveaux de ${row.nickname} enregistrés.`,
            () => setLevels({})
          );
        }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={labelClass}>Niveaux (0 à 100)</p>
          {row.power && (
            <p className="font-mono text-[11px] text-paper/60">
              Puissance {formatPower(Number(row.power.power_score))} · Int. {formatPower(Number(row.power.intelligence ?? 0))} · Pui. {formatPower(Number(row.power.strength ?? 0))} · Tech.{" "}
              {formatPower(Number(row.power.technique ?? 0))}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          {GROUPS.map((g) => (
            <fieldset key={g.label} className="space-y-1">
              <legend className="font-mono text-[10px] uppercase tracking-wide text-blue-light">{g.label}</legend>
              <div className="flex gap-2">
                {g.skills.map((k) => (
                  <label key={k} className="space-y-1">
                    <span className="block font-mono text-[10px] uppercase text-paper/60">{skillLabel(k)}</span>
                    <input type="number" min={0} max={100} step={1} className={`${field} !w-20`} value={lv(k)} onChange={(e) => setLevels((l) => ({ ...l, [k]: e.target.value }))} />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button disabled={!Object.keys(changed).length || !levelsOk || busy === "lv"} className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
            Enregistrer
          </button>
        </div>
        <p className="font-body text-xs text-paper/50">
          Intelligence = moyenne de Potions, Énigmes et Problème. Le niveau est aussi débloqué dans les sites des simulations. Inscrit au journal d&apos;audit.
        </p>
      </form>

      {msg && <p className={clsx("font-mono text-xs", msg.ok ? "text-green-300" : "text-red")}>{msg.text}</p>}
    </div>
  );
}
