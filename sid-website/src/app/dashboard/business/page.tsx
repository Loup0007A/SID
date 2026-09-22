"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Business, BusinessEmployee, MyEmployment, BusinessTransaction } from "@/types/business";
import type { Profile, SalaryFrequency } from "@/types/database";
import { inputClass, labelClass } from "@/lib/ui";

const FREQUENCY_LABELS: Record<SalaryFrequency, string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  biweekly: "Toutes les 2 semaines",
  monthly: "Mensuel",
};

export default function BusinessPage() {
  const supabase = createClient();
  const [myBusinesses, setMyBusinesses] = useState<Business[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [myEmployments, setMyEmployments] = useState<MyEmployment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({ name: "", description: "", shareCount: "1000", initialPrice: "10" });
  const [editForm, setEditForm] = useState<Record<string, { name: string; description: string }>>({});
  const [amounts, setAmounts] = useState<Record<string, { deposit: string; withdraw: string; borrow: string; repay: string; dividend: string }>>({});
  const [openPanel, setOpenPanel] = useState<Record<string, "employees" | "ledger" | null>>({});
  const [employees, setEmployees] = useState<Record<string, BusinessEmployee[]>>({});
  const [ledger, setLedger] = useState<Record<string, BusinessTransaction[]>>({});
  const [hireForm, setHireForm] = useState<Record<string, { userId: string; title: string; salary: string; frequency: SalaryFrequency }>>({});

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.rpc("list_my_businesses");
    setMyBusinesses((data ?? []) as Business[]);

    const { data: m } = await supabase.from("profiles").select("*").eq("status", "active");
    setMembers(m ?? []);

    const { data: emp } = await supabase.rpc("get_my_employments");
    setMyEmployments((emp ?? []) as MyEmployment[]);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function amountFor(businessId: string) {
    return amounts[businessId] ?? { deposit: "", withdraw: "", borrow: "", repay: "", dividend: "" };
  }
  function setAmount(businessId: string, field: "deposit" | "withdraw" | "borrow" | "repay" | "dividend", value: string) {
    setAmounts((a) => ({ ...a, [businessId]: { ...amountFor(businessId), [field]: value } }));
  }
  function hireFor(businessId: string) {
    return hireForm[businessId] ?? { userId: "", title: "", salary: "", frequency: "weekly" as SalaryFrequency };
  }

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, successMsg: string, clear?: () => void) {
    setBusy(true);
    setMessage(null);
    const { error } = await action();
    setBusy(false);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage(successMsg);
    clear?.();
    await refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await run(
      () =>
        supabase.rpc("create_business", {
          p_name: form.name,
          p_description: form.description || null,
          p_share_count: Number(form.shareCount) || 1000,
          p_initial_price: Number(form.initialPrice) || 10,
        }),
      "Entreprise créée !",
      () => {
        setForm({ name: "", description: "", shareCount: "1000", initialPrice: "10" });
        setShowCreate(false);
      }
    );
  }

  async function saveEdit(b: Business) {
    const edit = editForm[b.id] ?? { name: b.name, description: b.description ?? "" };
    await run(
      () => supabase.rpc("update_business", { p_business_id: b.id, p_name: edit.name, p_description: edit.description || null }),
      "Informations mises à jour."
    );
  }

  async function reloadPanel(businessId: string, panel: "employees" | "ledger") {
    if (panel === "employees") {
      const { data } = await supabase.rpc("list_business_employees", { p_business_id: businessId });
      setEmployees((e) => ({ ...e, [businessId]: (data ?? []) as BusinessEmployee[] }));
    } else {
      const { data } = await supabase.rpc("list_business_transactions", { p_business_id: businessId });
      setLedger((l) => ({ ...l, [businessId]: (data ?? []) as BusinessTransaction[] }));
    }
  }

  async function togglePanel(businessId: string, panel: "employees" | "ledger") {
    const current = openPanel[businessId];
    if (current === panel) {
      setOpenPanel((p) => ({ ...p, [businessId]: null }));
      return;
    }
    setOpenPanel((p) => ({ ...p, [businessId]: panel }));
    await reloadPanel(businessId, panel);
  }

  async function hire(businessId: string) {
    const h = hireFor(businessId);
    if (!h.userId || !h.salary) return;
    await run(
      () =>
        supabase.rpc("hire_employee", {
          p_business_id: businessId,
          p_user_id: h.userId,
          p_title: h.title || null,
          p_salary: Number(h.salary) || 0,
          p_frequency: h.frequency,
        }),
      "Employé embauché.",
      () => setHireForm((f) => ({ ...f, [businessId]: { userId: "", title: "", salary: "", frequency: "weekly" } }))
    );
    await reloadPanel(businessId, "employees");
  }

  async function fire(businessId: string, empUserId: string) {
    if (!confirm("Licencier ce membre ?")) return;
    await run(() => supabase.rpc("fire_employee", { p_business_id: businessId, p_user_id: empUserId }), "Employé licencié.");
    await reloadPanel(businessId, "employees");
  }

  async function closeBusiness(businessId: string, name: string) {
    if (!confirm(`Fermer et liquider "${name}" ? La trésorerie restante sera répartie entre les actionnaires. Action irréversible.`)) return;
    await run(() => supabase.rpc("close_business", { p_business_id: businessId }), "Entreprise fermée et liquidée.");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Entreprise</h1>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light"
        >
          {showCreate ? "Annuler" : "Créer une entreprise"}
        </button>
      </div>

      <p className="font-body text-sm text-paper/70">
        Pour investir dans une entreprise (acheter/vendre des actions), rends-toi sur{" "}
        <a href="/dashboard/bank" className="text-blue underline">Banque</a> → section Bourse.
      </p>

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      {showCreate && (
        <form onSubmit={handleCreate} className="glass-card space-y-4 p-6">
          <div className="space-y-1">
            <label className={labelClass}>Nom de l&apos;entreprise</label>
            <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Description</label>
            <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className={labelClass}>Nombre d&apos;actions émises</label>
              <input type="number" min={1} className={inputClass} value={form.shareCount} onChange={(e) => setForm({ ...form, shareCount: e.target.value })} />
            </div>
            <div className="flex-1 space-y-1">
              <label className={labelClass}>Prix de départ par action</label>
              <input type="number" min={0.01} step="0.01" className={inputClass} value={form.initialPrice} onChange={(e) => setForm({ ...form, initialPrice: e.target.value })} />
            </div>
          </div>
          <button disabled={busy} className="rounded-lg w-full bg-blue py-2 font-display uppercase text-ink hover:bg-blue-light disabled:opacity-40">
            Créer
          </button>
        </form>
      )}

      {myEmployments.length > 0 && (
        <div className="glass-card space-y-1 p-4">
          <p className="font-mono text-xs uppercase text-paper/60">Mes emplois</p>
          {myEmployments.map((e) => (
            <p key={e.business_id} className="font-body text-sm">
              {e.title ? `${e.title} chez ` : "Employé chez "}
              <strong>{e.business_name}</strong> — {e.salary.toLocaleString("fr-FR")} Cr. ({FREQUENCY_LABELS[e.frequency]})
            </p>
          ))}
        </div>
      )}

      {myBusinesses.length === 0 ? (
        <p className="glass-card p-6 text-center font-body text-paper/60">
          Tu n&apos;as encore créé aucune entreprise.
        </p>
      ) : (
        <div className="space-y-4">
          {myBusinesses.map((b) => {
            const amt = amountFor(b.id);
            const edit = editForm[b.id] ?? { name: b.name, description: b.description ?? "" };
            const hireState = hireFor(b.id);
            const panel = openPanel[b.id];
            return (
              <div key={b.id} className="glass-card space-y-4 p-6">
                <div className="space-y-2">
                  <label className={labelClass}>Nom</label>
                  <input
                    className={inputClass}
                    value={edit.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, [b.id]: { ...edit, name: e.target.value } }))}
                  />
                  <label className={labelClass}>Description</label>
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={edit.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, [b.id]: { ...edit, description: e.target.value } }))}
                  />
                  <button
                    onClick={() => saveEdit(b)}
                    disabled={busy}
                    className="rounded-lg border border-blue px-3 py-1 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40"
                  >
                    Enregistrer les infos
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-3 sm:grid-cols-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-paper/50">Trésorerie</p>
                    <p className="font-display text-xl text-blue">{b.treasury_balance.toLocaleString("fr-FR")} Cr.</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-paper/50">Cours de l&apos;action</p>
                    <p className="font-display text-xl text-blue-light">{b.share_price.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Cr.</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-paper/50">Valeur estimée</p>
                    <p className="font-display text-xl text-paper">{(b.share_price * b.share_count).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} Cr.</p>
                  </div>
                  {b.debt_principal > 0 && (
                    <div>
                      <p className="font-mono text-[10px] uppercase text-paper/50">Dette</p>
                      <p className="font-display text-xl text-red">{b.debt_principal.toLocaleString("fr-FR")} Cr.</p>
                    </div>
                  )}
                  <div>
                    <p className="font-mono text-[10px] uppercase text-paper/50">Actions détenues par le public</p>
                    <p className="font-display text-xl text-paper">{b.share_count - b.shares_in_treasury} / {b.share_count}</p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="mb-2 font-mono text-xs uppercase text-paper/60">Fonds propres</p>
                  <div className="flex flex-wrap gap-2">
                    <input type="number" min={0} placeholder="Montant" className={`${inputClass} w-28`} value={amt.deposit} onChange={(e) => setAmount(b.id, "deposit", e.target.value)} />
                    <button
                      onClick={() => run(() => supabase.rpc("deposit_business_funds", { p_business_id: b.id, p_amount: Number(amt.deposit) || 0 }), "Apport effectué.", () => setAmount(b.id, "deposit", ""))}
                      disabled={busy || !amt.deposit}
                      className="rounded-lg bg-blue px-3 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
                    >
                      Apporter
                    </button>
                    <input type="number" min={0} placeholder="Montant" className={`${inputClass} w-28`} value={amt.withdraw} onChange={(e) => setAmount(b.id, "withdraw", e.target.value)} />
                    <button
                      onClick={() => run(() => supabase.rpc("withdraw_business_funds", { p_business_id: b.id, p_amount: Number(amt.withdraw) || 0 }), "Retrait effectué.", () => setAmount(b.id, "withdraw", ""))}
                      disabled={busy || !amt.withdraw}
                      className="rounded-lg border border-blue px-3 py-2 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40"
                    >
                      Retirer
                    </button>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="mb-2 font-mono text-xs uppercase text-paper/60">Emprunt d&apos;entreprise</p>
                  <div className="flex flex-wrap gap-2">
                    <input type="number" min={0} placeholder="Montant" className={`${inputClass} w-28`} value={amt.borrow} onChange={(e) => setAmount(b.id, "borrow", e.target.value)} />
                    <button
                      onClick={() => run(() => supabase.rpc("business_borrow", { p_business_id: b.id, p_amount: Number(amt.borrow) || 0 }), "Emprunt accordé.", () => setAmount(b.id, "borrow", ""))}
                      disabled={busy || !amt.borrow}
                      className="rounded-lg bg-red px-3 py-2 font-mono text-xs uppercase text-ink hover:bg-red-light disabled:opacity-40"
                    >
                      Emprunter
                    </button>
                    {b.debt_principal > 0 && (
                      <>
                        <input type="number" min={0} placeholder="Montant" className={`${inputClass} w-28`} value={amt.repay} onChange={(e) => setAmount(b.id, "repay", e.target.value)} />
                        <button
                          onClick={() => run(() => supabase.rpc("business_repay", { p_business_id: b.id, p_amount: Number(amt.repay) || 0 }), "Remboursement effectué.", () => setAmount(b.id, "repay", ""))}
                          disabled={busy || !amt.repay}
                          className="rounded-lg border border-red px-3 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
                        >
                          Rembourser
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="mb-2 font-mono text-xs uppercase text-paper/60">Dividendes</p>
                  <div className="flex flex-wrap gap-2">
                    <input type="number" min={0} placeholder="Montant total" className={`${inputClass} w-32`} value={amt.dividend} onChange={(e) => setAmount(b.id, "dividend", e.target.value)} />
                    <button
                      onClick={() => run(() => supabase.rpc("pay_dividends", { p_business_id: b.id, p_amount: Number(amt.dividend) || 0 }), "Dividendes versés.", () => setAmount(b.id, "dividend", ""))}
                      disabled={busy || !amt.dividend}
                      className="rounded-lg bg-blue px-3 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
                    >
                      Verser (réparti au prorata des actions)
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                  <button
                    onClick={() => togglePanel(b.id, "employees")}
                    className="rounded-lg flex-1 border border-blue py-1.5 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink"
                  >
                    {panel === "employees" ? "Masquer les employés" : "👥 Employés"}
                  </button>
                  <button
                    onClick={() => togglePanel(b.id, "ledger")}
                    className="rounded-lg flex-1 border border-paper/40 py-1.5 font-mono text-xs uppercase text-paper hover:bg-paper hover:text-ink"
                  >
                    {panel === "ledger" ? "Masquer le registre" : "📒 Registre"}
                  </button>
                  <button
                    onClick={() => closeBusiness(b.id, b.name)}
                    className="rounded-lg flex-1 border border-red/60 py-1.5 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink"
                  >
                    Fermer / liquider
                  </button>
                </div>

                {panel === "employees" && (
                  <div className="space-y-3 rounded-lg border border-white/10 p-3">
                    {(employees[b.id] ?? []).map((e) => (
                      <div key={e.user_id} className="flex items-center justify-between gap-2 font-mono text-xs">
                        <span>
                          {e.nickname} {e.title && `— ${e.title}`} · {e.salary.toLocaleString("fr-FR")} Cr. ({FREQUENCY_LABELS[e.frequency]})
                        </span>
                        <button onClick={() => fire(b.id, e.user_id)} className="rounded border border-red px-2 py-0.5 uppercase text-red hover:bg-red hover:text-ink">
                          Licencier
                        </button>
                      </div>
                    ))}
                    {(employees[b.id] ?? []).length === 0 && <p className="font-body text-xs text-paper/50">Aucun employé.</p>}

                    <div className="space-y-2 border-t border-white/10 pt-2">
                      <p className="font-mono text-[10px] uppercase text-paper/50">Embaucher</p>
                      <div className="flex flex-wrap gap-2">
                        <select
                          className={`${inputClass} flex-1`}
                          value={hireState.userId}
                          onChange={(e) => setHireForm((f) => ({ ...f, [b.id]: { ...hireState, userId: e.target.value } }))}
                        >
                          <option value="">Choisir un membre…</option>
                          {members.filter((m) => m.id !== b.founder_id).map((m) => (
                            <option key={m.id} value={m.id}>{m.nickname}</option>
                          ))}
                        </select>
                        <input
                          placeholder="Titre (optionnel)"
                          className={`${inputClass} w-32`}
                          value={hireState.title}
                          onChange={(e) => setHireForm((f) => ({ ...f, [b.id]: { ...hireState, title: e.target.value } }))}
                        />
                        <input
                          type="number" min={0} placeholder="Salaire"
                          className={`${inputClass} w-24`}
                          value={hireState.salary}
                          onChange={(e) => setHireForm((f) => ({ ...f, [b.id]: { ...hireState, salary: e.target.value } }))}
                        />
                        <select
                          className={`${inputClass} w-36`}
                          value={hireState.frequency}
                          onChange={(e) => setHireForm((f) => ({ ...f, [b.id]: { ...hireState, frequency: e.target.value as SalaryFrequency } }))}
                        >
                          {(Object.keys(FREQUENCY_LABELS) as SalaryFrequency[]).map((f) => (
                            <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => hire(b.id)}
                          disabled={busy || !hireState.userId || !hireState.salary}
                          className="rounded-lg bg-blue px-3 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
                        >
                          Embaucher
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {panel === "ledger" && (
                  <div className="space-y-1 rounded-lg border border-white/10 p-3">
                    {(ledger[b.id] ?? []).map((t) => (
                      <div key={t.id} className="flex items-center justify-between font-mono text-xs">
                        <span className="text-paper/70">{t.reason}</span>
                        <span className={t.amount >= 0 ? "text-blue-light" : "text-red"}>
                          {t.amount >= 0 ? "+" : ""}{t.amount.toLocaleString("fr-FR")} Cr.
                        </span>
                      </div>
                    ))}
                    {(ledger[b.id] ?? []).length === 0 && <p className="font-body text-xs text-paper/50">Aucun mouvement pour le moment.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
