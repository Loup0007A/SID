"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { inputClass, labelClass } from "@/lib/ui";

/**
 * Administration → Économie → Absences (Lot 76, migration 0093) :
 * réglages de la pénalité, membres concernés, dispenses, prélèvements.
 */

type Member = {
  id: string;
  nickname: string;
  last_day: string;
  days: number;
  next: number | null;
  exempt_until: string | null;
  exempt_reason: string | null;
  shares: number;
  savings: number;
  wallet: number;
  debt: number;
  charged_30: number;
};
type Data = {
  enabled: boolean;
  grace: number;
  rate: number;
  start_day: string | null;
  last_day: string | null;
  members: Member[];
  recent: { nickname: string; day: string; days: number; amount: number; shares: number; savings: number; wallet: number; debt: number }[];
  total_30: number;
  members_30: number;
};

const z = (n: number) => `${Math.round(Number(n)).toLocaleString("fr-FR")} z`;
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
const field = `${inputClass} !py-1.5 text-sm`;

export function InactivityAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [grace, setGrace] = useState("7");
  const [rate, setRate] = useState("200");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [exempt, setExempt] = useState<{ id: string; until: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("inactivity_admin");
    if (error) return setMissing(true);
    const x = data as Data;
    setD(x);
    setGrace(String(x.grace));
    setRate(String(x.rate));
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  async function call(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return false;
    }
    setMsg({ ok: true, text: ok });
    await load();
    return true;
  }

  if (missing) return <p className="font-body text-sm text-paper/65">Lance la migration <code className="font-mono text-xs">0093_roue_absences.sql</code>.</p>;
  if (!d) return <p className="font-body text-sm text-paper/60">Chargement…</p>;

  const g = Number(grace) || d.grace;
  const r = Number(rate) || 0;
  const cumul = (n: number) => Array.from({ length: Math.max(0, n - g + 1) }, (_, i) => r * (g + i)).reduce((a, b) => a + b, 0);
  const dirty = g !== d.grace || r !== Number(d.rate);

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 font-body text-sm">
            <input
              type="checkbox"
              checked={d.enabled}
              disabled={busy}
              onChange={(e) => call("inactivity_settings_save", { p_enabled: e.target.checked, p_grace: null, p_rate: null }, e.target.checked ? "Pénalité activée." : "Pénalité suspendue.")}
              className="h-4 w-4 accent-[#f0c27a]"
            />
            Pénalité active
          </label>
          <label className="space-y-1">
            <span className={labelClass}>À partir de (jours d&apos;absence)</span>
            <input type="number" min={1} max={365} className={`${field} !w-28`} value={grace} onChange={(e) => setGrace(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Par jour d&apos;absence (z)</span>
            <input type="number" min={0} step="any" className={`${field} !w-32`} value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => call("inactivity_settings_save", { p_enabled: null, p_grace: g, p_rate: r }, "Réglages enregistrés.")}
            className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            Enregistrer
          </button>
        </div>
        <p className="font-body text-sm text-paper/70">
          Après {g} jours sans visite, chaque jour coûte {z(r)} × le nombre de jours d&apos;absence : {z(r * g)} le {g}
          <sup>e</sup> jour, {z(r * (g + 1))} le suivant… soit {z(cumul(14))} au bout de 14 jours et {z(cumul(30))} au bout de 30. Pris dans l&apos;ordre sur
          les actions (rendues à l&apos;entreprise), l&apos;épargne, le solde, puis en dette ; l&apos;argent va dans la caisse commune.
        </p>
        <p className="font-mono text-[11px] text-paper/50">
          Absences comptées depuis le {d.start_day ? new Date(d.start_day).toLocaleDateString("fr-FR") : "—"} · dernier jour traité :{" "}
          {d.last_day ? new Date(d.last_day).toLocaleDateString("fr-FR") : "—"} · 30 derniers jours : {z(d.total_30)} pris à {d.members_30} membre
          {d.members_30 > 1 ? "s" : ""}
        </p>
        {msg && <p className={clsx("font-mono text-xs", msg.ok ? "text-green-300" : "text-red")}>{msg.text}</p>}
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-lg uppercase text-paper">Membres absents</h2>
        {d.members.length === 0 ? (
          <p className="glass-card p-4 font-body text-sm text-paper/60">Personne n&apos;approche de la pénalité.</p>
        ) : (
          <ul className="space-y-2">
            {d.members.map((m) => {
              const late = m.days >= d.grace;
              return (
                <li key={m.id} className={clsx("glass-card space-y-2 p-3", late && !m.exempt_until && "border-red/50")}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-display uppercase text-paper">{m.nickname}</span>
                    <span className={clsx("font-mono text-xs", late ? "text-red-light" : "text-[#f0c27a]")}>
                      {m.days} jour{m.days > 1 ? "s" : ""} sans visite (dernière : {day(m.last_day)})
                      {m.exempt_until
                        ? ` · dispensé jusqu'au ${day(m.exempt_until)}`
                        : late
                          ? ` · cette nuit : −${z(Number(m.next ?? d.rate * m.days))}`
                          : ` · pénalité dans ${d.grace - m.days} j`}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-paper/60">
                    actions {z(m.shares)} · épargne {z(m.savings)} · solde {z(m.wallet)} · dette {z(m.debt)}
                    {m.charged_30 > 0 && <span className="text-red-light"> · déjà pris (30 j) : {z(m.charged_30)}</span>}
                    {m.exempt_reason && <span> · {m.exempt_reason}</span>}
                  </p>
                  {exempt?.id === m.id ? (
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await call("inactivity_exempt", { p_user: m.id, p_until: exempt.until, p_reason: exempt.reason || null }, `${m.nickname} est dispensé.`)) setExempt(null);
                      }}
                    >
                      <label className="space-y-1">
                        <span className={labelClass}>Jusqu&apos;au</span>
                        <input type="date" required className={`${field} !w-40`} value={exempt.until} onChange={(e) => setExempt({ ...exempt, until: e.target.value })} />
                      </label>
                      <label className="min-w-0 flex-1 basis-40 space-y-1">
                        <span className={labelClass}>Raison (facultatif)</span>
                        <input className={field} maxLength={200} value={exempt.reason} onChange={(e) => setExempt({ ...exempt, reason: e.target.value })} placeholder="Vacances, examens…" />
                      </label>
                      <button disabled={busy} className="rounded-lg bg-blue px-3 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
                        Dispenser
                      </button>
                      <button type="button" onClick={() => setExempt(null)} className="rounded-lg border border-white/15 px-3 py-2 font-mono text-xs uppercase text-paper/70">
                        Annuler
                      </button>
                    </form>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const t = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
                          setExempt({ id: m.id, until: m.exempt_until ?? t, reason: m.exempt_reason ?? "" });
                        }}
                        className="font-mono text-[11px] uppercase text-blue hover:underline"
                      >
                        {m.exempt_until ? "Modifier la dispense" : "Dispenser"}
                      </button>
                      {m.exempt_until && (
                        <button
                          type="button"
                          onClick={() => call("inactivity_exempt", { p_user: m.id, p_until: null, p_reason: null }, "Dispense levée.")}
                          className="font-mono text-[11px] uppercase text-paper/50 hover:text-red-light"
                        >
                          Lever
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="font-body text-xs text-paper/50">
          Apparaissent ici les membres absents depuis au moins {Math.max(d.grace - 3, 1)} jours, et les membres dispensés.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-lg uppercase text-paper">Derniers prélèvements</h2>
        {d.recent.length === 0 ? (
          <p className="glass-card p-4 font-body text-sm text-paper/60">Aucun prélèvement pour l&apos;instant.</p>
        ) : (
          <ul className="glass-card divide-y divide-white/5 p-2">
            {d.recent.map((c, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-2 py-1.5 font-body text-sm">
                <span className="w-12 shrink-0 font-mono text-[11px] text-paper/50">{day(c.day)}</span>
                <span className="font-display uppercase text-paper">{c.nickname}</span>
                <span className="font-mono text-xs text-red-light">−{z(c.amount)}</span>
                <span className="font-mono text-[11px] text-paper/55">
                  ({c.days} j : {[c.shares > 0 && `actions ${z(c.shares)}`, c.savings > 0 && `épargne ${z(c.savings)}`, c.wallet > 0 && `solde ${z(c.wallet)}`, c.debt > 0 && `dette ${z(c.debt)}`]
                    .filter(Boolean)
                    .join(", ")}
                  )
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
