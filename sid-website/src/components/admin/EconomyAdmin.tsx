"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import { ExpenseLine } from "@/components/business/Expenses";
import { day, dueIn, pct, px, z } from "@/lib/econ";
import { inputClass, labelClass } from "@/lib/ui";
import type { EconomyOverview, ExpenseRequest, TaxesOverview } from "@/types/economy";

/** Lot 69 : banque centrale, frais d'entreprise, avis d'impôt, amendes (administration). */

export function CentralBankAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [eco, setEco] = useState<EconomyOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("economy_overview", { p_days: 7 });
    if (!error) setEco(data as EconomyOverview);
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  if (!eco?.today) return null;
  const t = eco.today;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg uppercase text-paper">Banque centrale</h2>
        <Link href="/dashboard/economie" className="font-mono text-xs uppercase text-blue hover:underline">
          Page publique →
        </Link>
      </div>
      <div className="glass-card grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
        {[
          ["Indice des prix", px(t.price_index)],
          ["Cours du zéni", px(t.zeni_value)],
          ["Inflation 30 j", pct(t.inflation_30d, 2, true)],
          ["Taux directeur", `${pct(t.policy_rate_weekly, 2)} / sem.`],
          ["Impôt fortune", `${pct(t.wealth_tax_rate, 2)} / sem.`],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="font-mono text-[10px] uppercase text-paper/65">{k}</p>
            <p className="font-display text-xl text-paper">{v}</p>
          </div>
        ))}
      </div>
      <div className="glass-card flex flex-wrap items-center gap-3 p-4">
        <p className="flex-1 font-body text-sm text-paper/75">
          Adaptation automatique <b className={eco.auto ? "text-green-300" : "text-red-light"}>{eco.auto ? "active" : "suspendue"}</b> : chaque jour, taux d&apos;épargne
          et d&apos;emprunt, impôts, abattement, seuil de faillite et plafonds d&apos;emprunt sont recalculés depuis le relevé des prix. Suspendue, les réglages
          d&apos;<code className="font-mono text-xs">app_config</code> restent tels quels et le relevé continue.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { error } = await supabase.rpc("economy_set_auto", { p_on: !eco.auto });
            setBusy(false);
            setMsg(error ? error.message : null);
            await load();
          }}
          className={`rounded-lg px-4 py-2 font-mono text-xs uppercase disabled:opacity-40 ${eco.auto ? "border border-red/70 text-red hover:bg-red hover:text-ink" : "bg-blue text-ink hover:bg-blue-light"}`}
        >
          {eco.auto ? "Suspendre" : "Réactiver"}
        </button>
        {msg && <p className="w-full font-mono text-xs text-red">{msg}</p>}
      </div>
    </section>
  );
}

export function ExpenseQueue() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ExpenseRequest[] | null>(null);
  const [recent, setRecent] = useState<ExpenseRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([supabase.rpc("expenses_list", { p_scope: "pending" }), supabase.rpc("expenses_list", { p_scope: "recent" })]);
    if (p.error) return setRows([]);
    setRows((p.data ?? []) as ExpenseRequest[]);
    setRecent(((r.data ?? []) as ExpenseRequest[]).slice(0, 6));
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  async function decide(e: ExpenseRequest, approve: boolean) {
    setBusy(e.id);
    setMsg(null);
    const { error } = await supabase.rpc("expense_decide", { p_id: e.id, p_approve: approve, p_note: notes[e.id] || null });
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: approve ? `Frais validés : ${e.item_name} pour ${e.business_name}.` : "Demande refusée, somme remise en trésorerie." });
    await load();
  }

  if (!rows) return null;
  return (
    <section id="frais" className="scroll-mt-24 space-y-3">
      <h2 className="font-display text-lg uppercase text-paper">
        Frais d&apos;entreprise {rows.length > 0 && <span className="ml-1 rounded-full bg-yellow-400/20 px-2 py-0.5 font-mono text-xs text-yellow-300">{rows.length}</span>}
      </h2>
      <p className="font-body text-sm text-paper/65">
        Achats de la boutique que la trésorerie paie pour un fondateur ou un employé. Validés, ils passent au prix du jour ; refusés, la somme revient.
      </p>
      {msg && <p className={`font-mono text-xs ${msg.ok ? "text-green-300" : "text-red"}`}>{msg.text}</p>}
      {rows.length === 0 ? (
        <p className="font-body text-sm text-paper/60">Aucune demande en attente.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((e) => {
            const diff = e.current_price != null ? Number(e.current_price) - Number(e.reserved) : 0;
            return (
              <li key={e.id} className="glass-card space-y-2 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display uppercase">
                    {e.item_name}
                    {e.quantity > 1 && ` × ${e.quantity}`}
                  </p>
                  <p className="font-display text-xl text-paper">{z(e.reserved)}</p>
                </div>
                <p className="font-body text-sm text-paper/75">
                  <b className="text-blue-light">{e.business_name}</b> pour {e.requester} · vendu par {e.seller ?? "—"}
                </p>
                <p className="font-body text-sm italic text-paper/70">« {e.motive} »</p>
                <p className="font-mono text-[11px] text-paper/55">
                  {day(e.created_at)} · trésorerie restante {z(e.treasury ?? 0, 0)}
                  {Math.abs(diff) >= 0.01 && <span className="text-[#f0c27a]"> · prix du jour {z(e.current_price ?? 0)} ({diff > 0 ? "+" : "−"}{z(Math.abs(diff))})</span>}
                </p>
                {e.related && (
                  <p className="rounded-md border border-[#f0c27a]/50 bg-[#f0c27a]/10 px-2 py-1 font-body text-xs text-[#f0c27a]">
                    <SidIcon name="warning" size={13} /> Le vendeur est lié à l&apos;entreprise (fondateur, employé ou une de ses entreprises) : cet achat ferait sortir de
                    l&apos;argent de la trésorerie vers lui.
                  </p>
                )}
                {e.self ? (
                  <p className="font-mono text-[11px] text-paper/50">Ta propre demande : un autre admin la valide.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <input placeholder="Réponse (facultative)" maxLength={300} className={`${inputClass} flex-1 !py-1.5 text-sm`} value={notes[e.id] ?? ""} onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))} />
                    <button type="button" disabled={busy === e.id} onClick={() => decide(e, true)} className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
                      Valider
                    </button>
                    <button type="button" disabled={busy === e.id} onClick={() => decide(e, false)} className="rounded-lg border border-red/70 px-3 py-1.5 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40">
                      Refuser
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {recent.length > 0 && (
        <details className="glass-card p-4">
          <summary className="cursor-pointer font-mono text-xs uppercase text-paper/70">Décisions récentes</summary>
          <ul className="mt-2 space-y-1.5">
            {recent.map((e) => (
              <ExpenseLine key={e.id} e={e} showBusiness />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function TaxesAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<TaxesOverview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("taxes_overview");
    if (!error) setData(data as TaxesOverview);
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return null;
  return (
    <section id="impots" className="scroll-mt-24 space-y-3">
      <h2 className="font-display text-lg uppercase text-paper">Avis d&apos;impôt et amendes</h2>
      <div className="glass-card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        {[
          ["À payer", `${data.a_payer.n} · ${z(data.a_payer.total, 0)}`],
          ["Payés (30 j)", `${data.payes_30j.n} · ${z(data.payes_30j.total, 0)}`],
          ["Saisis (30 j)", `${data.saisis_30j.n} · ${z(data.saisis_30j.total, 0)}`],
          ["Membres majorés", String(data.majores)],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="font-mono text-[10px] uppercase text-paper/65">{k}</p>
            <p className="font-display text-lg text-paper">{v}</p>
          </div>
        ))}
      </div>
      {msg && <p className="font-mono text-xs text-red">{msg}</p>}
      {data.avis.length > 0 && (
        <details className="glass-card p-4">
          <summary className="cursor-pointer font-mono text-xs uppercase text-paper/70">Avis en attente ({data.avis.length})</summary>
          <ul className="mt-2 divide-y divide-white/5">
            {data.avis.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 font-body text-sm">
                <span className="font-display uppercase text-paper">{a.nickname}</span>
                <span className="text-paper/70">
                  {a.kind === "fortune" ? "Fortune" : a.kind === "societe" ? `Sociétés · ${a.business_name}` : `Amende${a.business_name ? ` · ${a.business_name}` : ""}`}
                </span>
                <span className="font-mono text-xs text-paper">{z(a.amount)}</span>
                {a.surcharge_pct > 0 && <span className="font-mono text-[11px] text-red-light">+{a.surcharge_pct} %</span>}
                <span className="font-mono text-[11px] text-paper/50">{dueIn(a.due_at)}</span>
                {a.reason && <span className="w-full truncate text-xs text-paper/55">{a.reason}</span>}
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Annuler cet avis de ${z(a.amount)} pour ${a.nickname} ?`)) return;
                    const { error } = await supabase.rpc("tax_cancel", { p_bill: a.id });
                    setMsg(error ? error.message : null);
                    await load();
                  }}
                  className="ml-auto font-mono text-[11px] uppercase text-paper/55 hover:text-red-light"
                >
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <FineForm onDone={load} />
    </section>
  );
}

function FineForm({ onDone }: { onDone: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [target, setTarget] = useState<"membre" | "entreprise">("membre");
  const [members, setMembers] = useState<{ id: string; nickname: string }[]>([]);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [who, setWho] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id, nickname").eq("status", "active").order("nickname"),
      supabase.from("businesses").select("id, name").eq("is_closed", false).order("name"),
    ]).then(([m, b]) => {
      setMembers((m.data ?? []) as { id: string; nickname: string }[]);
      setBusinesses((b.data ?? []) as { id: string; name: string }[]);
    });
  }, [supabase]);

  return (
    <form
      id="amendes"
      className="glass-card scroll-mt-24 space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const { error } = await supabase.rpc("fine_issue", {
          p_user: target === "membre" ? who : null,
          p_business: target === "entreprise" ? who : null,
          p_amount: Number(amount) || 0,
          p_reason: reason,
        });
        setBusy(false);
        if (error) return setMsg({ ok: false, text: error.message.includes("fine_issue") ? "Amendes indisponibles : la migration 0086 doit être lancée." : error.message });
        setMsg({ ok: true, text: "Amende envoyée : à payer sous 7 jours, sinon saisie avec majoration." });
        setAmount("");
        setReason("");
        onDone();
      }}
    >
      <p className="font-display uppercase text-paper">Infliger une amende</p>
      <div className="flex flex-wrap gap-2">
        {(["membre", "entreprise"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTarget(k);
              setWho("");
            }}
            aria-pressed={target === k}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase ${target === k ? "border-blue text-blue-light" : "border-white/15 text-paper/60"}`}
          >
            {k === "membre" ? "Un membre" : "Une entreprise"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="space-y-1">
          <span className={labelClass}>{target === "membre" ? "Membre" : "Entreprise (payée par sa trésorerie)"}</span>
          <select required className={inputClass} value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Choisir…</option>
            {(target === "membre" ? members.map((m) => ({ id: m.id, label: m.nickname })) : businesses.map((b) => ({ id: b.id, label: b.name }))).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Montant</span>
          <input required type="number" min={1} className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className={labelClass}>Motif (visible par le membre)</span>
        <input required minLength={3} maxLength={300} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !who || !amount || reason.trim().length < 3} className="rounded-lg bg-red px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-red-light disabled:opacity-40">
          {busy ? "Envoi…" : "Envoyer l'amende"}
        </button>
        {msg && <p className={`font-mono text-xs ${msg.ok ? "text-green-300" : "text-red"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}

export function DisputesShortcut() {
  const supabase = useMemo(() => createClient(), []);
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    supabase.rpc("disputes_list", { p_scope: "open" }).then(({ data, error }) => setN(error ? null : ((data ?? []) as unknown[]).length));
  }, [supabase]);
  if (n == null) return null;
  return (
    <Link href="/dashboard/litiges?vue=juge" className="glass-card flex items-center justify-between gap-3 p-4 transition hover:-translate-y-0.5">
      <span className="flex items-center gap-3">
        <SidIcon name="gavel" size={28} />
        <span>
          <span className="block font-display uppercase text-paper">Litiges</span>
          <span className="block font-body text-sm text-paper/65">{n === 0 ? "Aucun litige en cours." : `${n} litige${n > 1 ? "s" : ""} en cours à suivre ou à trancher.`}</span>
        </span>
      </span>
      <span className="font-mono text-xs uppercase text-blue">Ouvrir →</span>
    </Link>
  );
}
