"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Wallet, SalaryView, SalaryFrequency } from "@/types/database";
import { inputClass } from "@/lib/ui";

const FREQUENCY_LABELS: Record<SalaryFrequency, string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  biweekly: "Toutes les 2 semaines",
  monthly: "Mensuel",
};

export default function EconomyAdminPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<Profile[]>([]);
  const [wallets, setWallets] = useState<Map<string, Wallet>>(new Map());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const [reputationAmounts, setReputationAmounts] = useState<Record<string, string>>({});
  const [reputationMessage, setReputationMessage] = useState<string | null>(null);

  const [salaries, setSalaries] = useState<SalaryView[]>([]);
  const [salaryForm, setSalaryForm] = useState<{ userId: string; amount: string; frequency: SalaryFrequency }>({
    userId: "",
    amount: "2500",
    frequency: "weekly",
  });
  const [salaryMessage, setSalaryMessage] = useState<string | null>(null);
  const [payingNow, setPayingNow] = useState(false);

  async function refresh() {
    const [{ data: m }, { data: w }] = await Promise.all([
      supabase.from("profiles").select("*").eq("status", "active").order("nickname"),
      supabase.from("wallets").select("*"),
    ]);
    setMembers(m ?? []);
    setWallets(new Map((w ?? []).map((x) => [x.user_id, x])));
  }

  async function refreshSalaries() {
    const { data } = await supabase.rpc("list_salaries");
    setSalaries((data ?? []) as SalaryView[]);
  }

  useEffect(() => {
    refresh();
    refreshSalaries();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function adjust(userId: string) {
    const amount = Number(amounts[userId]);
    if (!amount) return;
    await supabase.rpc("adjust_wallet", { p_user_id: userId, p_amount: amount, p_reason: reasons[userId] ?? "Ajustement manuel" });
    setAmounts((a) => ({ ...a, [userId]: "" }));
    setReasons((r) => ({ ...r, [userId]: "" }));
    refresh();
  }

  async function adjustReputation(userId: string) {
    const amount = Number(reputationAmounts[userId]);
    if (!amount) return;
    const { error } = await supabase.rpc("adjust_reputation", { p_user_id: userId, p_amount: amount });
    if (error) {
      setReputationMessage(`Échec : ${error.message}`);
      return;
    }
    setReputationAmounts((a) => ({ ...a, [userId]: "" }));
    refresh();
  }

  async function saveSalary(e: React.FormEvent) {
    e.preventDefault();
    setSalaryMessage(null);
    if (!salaryForm.userId) {
      setSalaryMessage("Choisis un membre.");
      return;
    }
    const { error } = await supabase.rpc("set_salary", {
      p_user_id: salaryForm.userId,
      p_amount: Number(salaryForm.amount) || 2500,
      p_frequency: salaryForm.frequency,
    });
    if (error) {
      setSalaryMessage(`Échec : ${error.message}`);
      return;
    }
    setSalaryForm({ userId: "", amount: "2500", frequency: "weekly" });
    refreshSalaries();
  }

  async function stopSalary(userId: string) {
    if (!confirm("Suspendre ce salaire ?")) return;
    const { error } = await supabase.rpc("stop_salary", { p_user_id: userId });
    if (error) {
      setSalaryMessage(`Échec : ${error.message}`);
      return;
    }
    refreshSalaries();
  }

  async function payNow() {
    setPayingNow(true);
    setSalaryMessage(null);
    const { data, error } = await supabase.rpc("pay_salaries_now");
    setPayingNow(false);
    if (error) {
      setSalaryMessage(`Échec : ${error.message}`);
      return;
    }
    setSalaryMessage(`${data ?? 0} salaire(s) versé(s).`);
    refreshSalaries();
    refresh();
  }

  return (
    <div className="space-y-10">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Économie de la S.I.D.</h1>

      <section className="space-y-3">
        <h2 className="font-display text-lg uppercase text-paper">Ajustement manuel du solde</h2>
        {members.map((m) => (
          <div key={m.id} className="glass-card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[10rem]">
              <p className="font-display uppercase">{m.nickname}</p>
              <p className="font-mono text-xs text-blue">{(wallets.get(m.id)?.balance ?? 0).toLocaleString("fr-FR")} Cr.</p>
            </div>
            <input
              type="number"
              placeholder="Montant (+/-)"
              className={`${inputClass} w-32`}
              value={amounts[m.id] ?? ""}
              onChange={(e) => setAmounts((a) => ({ ...a, [m.id]: e.target.value }))}
            />
            <input
              placeholder="Raison"
              className={`${inputClass} flex-1`}
              value={reasons[m.id] ?? ""}
              onChange={(e) => setReasons((r) => ({ ...r, [m.id]: e.target.value }))}
            />
            <button onClick={() => adjust(m.id)} className="rounded-lg bg-red px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-red-light">
              Appliquer
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg uppercase text-paper">Renommée</h2>
        {reputationMessage && <p className="font-mono text-sm text-red">{reputationMessage}</p>}
        {members.map((m) => (
          <div key={m.id} className="glass-card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[10rem]">
              <p className="font-display uppercase">{m.nickname}</p>
              <p className="font-mono text-xs text-blue">{m.reputation.toLocaleString("fr-FR")} pts</p>
            </div>
            <input
              type="number"
              placeholder="Points (+/-)"
              className={`${inputClass} w-32`}
              value={reputationAmounts[m.id] ?? ""}
              onChange={(e) => setReputationAmounts((a) => ({ ...a, [m.id]: e.target.value }))}
            />
            <button onClick={() => adjustReputation(m.id)} className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light">
              Appliquer
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg uppercase text-paper">Salaires</h2>
          <button
            onClick={payNow}
            disabled={payingNow}
            className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            {payingNow ? "Versement…" : "Verser les salaires dus maintenant"}
          </button>
        </div>

        {salaryMessage && <p className="font-mono text-sm text-red">{salaryMessage}</p>}

        <form onSubmit={saveSalary} className="glass-card flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <label className="font-mono text-xs uppercase tracking-wide text-paper/70">Membre</label>
            <select
              className={inputClass}
              value={salaryForm.userId}
              onChange={(e) => setSalaryForm((f) => ({ ...f, userId: e.target.value }))}
            >
              <option value="">Choisir…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.nickname}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs uppercase tracking-wide text-paper/70">Montant</label>
            <input
              type="number" min={0} className={`${inputClass} w-32`}
              value={salaryForm.amount}
              onChange={(e) => setSalaryForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs uppercase tracking-wide text-paper/70">Fréquence</label>
            <select
              className={inputClass}
              value={salaryForm.frequency}
              onChange={(e) => setSalaryForm((f) => ({ ...f, frequency: e.target.value as SalaryFrequency }))}
            >
              {(Object.keys(FREQUENCY_LABELS) as SalaryFrequency[]).map((f) => (
                <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
              ))}
            </select>
          </div>
          <button className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink hover:bg-blue-light">
            Définir le salaire
          </button>
        </form>

        <div className="space-y-2">
          {salaries.map((s) => (
            <div key={s.user_id} className="glass-card flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="font-display uppercase">{s.nickname}</p>
                <p className="font-mono text-xs text-paper/60">
                  {s.amount.toLocaleString("fr-FR")} Cr. · {FREQUENCY_LABELS[s.frequency]} · prochain versement :{" "}
                  {new Date(s.next_payment_at).toLocaleString("fr-FR")} · {s.is_active ? "actif" : "suspendu"}
                </p>
              </div>
              {s.is_active && (
                <button
                  onClick={() => stopSalary(s.user_id)}
                  className="rounded-lg border border-red px-3 py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink"
                >
                  Suspendre
                </button>
              )}
            </div>
          ))}
          {salaries.length === 0 && <p className="font-body text-sm text-paper/60">Aucun salaire configuré.</p>}
        </div>
      </section>
    </div>
  );
}
