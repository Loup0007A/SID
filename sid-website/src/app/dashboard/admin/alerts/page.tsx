"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { PermissionKey } from "@/types/database";
import { inputClass, buttonPrimary } from "@/lib/ui";
import { ALERT_KINDS, ALERT_SETTINGS, SEVERITY, describeAlert, exemptionLabel, timeAgo, type AlertExemption, type AlertRow } from "@/lib/alerts";
import { SidIcon } from "@/components/icons/SidIcon";

const TABS = [
  { key: "open", label: "À traiter" },
  { key: "resolved", label: "Traitées" },
  { key: "ignored", label: "Ignorées" },
  { key: "all", label: "Toutes" },
];

export default function AlertsPage() {
  const supabase = createClient();
  const [permissions, setPermissions] = useState<Set<PermissionKey> | null>(null);
  const [tab, setTab] = useState("open");
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [exemptions, setExemptions] = useState<AlertExemption[] | null>(null);
  const [showExemptions, setShowExemptions] = useState(false);

  async function refreshExemptions() {
    const { data, error } = await supabase.rpc("alert_exemptions_list");
    setExemptions(error ? null : ((data ?? []) as AlertExemption[]));
  }

  async function refresh(status = tab) {
    const { data, error } = await supabase.rpc("list_activity_alerts", { p_status: status, p_user: null, p_limit: 300 });
    if (error) {
      setMessage(error.message.includes("list_activity_alerts") ? "Pas encore disponible : la migration 0060 doit être lancée sur la base." : error.message);
      return;
    }
    setRows((data ?? []) as AlertRow[]);
  }

  useEffect(() => {
    (async () => {
      const { permissions } = await loadCurrentUser();
      setPermissions(permissions);
      if (!can(permissions, "manage_users")) return;
      await refresh("open");
      refreshExemptions();
      const { data } = await supabase.rpc("get_alert_settings");
      if (data) setSettings(Object.fromEntries(Object.entries(data as Record<string, number>).map(([k, v]) => [k, String(v)])));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!permissions) return <p className="font-body text-paper/60">Chargement…</p>;
  if (!can(permissions, "manage_users")) return <p className="font-body text-paper/60">Réservé à la gestion des comptes.</p>;

  async function setStatus(a: AlertRow, status: AlertRow["status"]) {
    const { error } = await supabase.rpc("set_alert_status", { p_id: a.id, p_status: status });
    if (error) setMessage(`Échec : ${error.message}`);
    else refresh();
  }

  async function markNormal(a: AlertRow) {
    const { data, error } = await supabase.rpc("alert_mark_normal", { p_id: a.id });
    if (error) {
      setMessage(error.message.includes("alert_mark_normal") ? "Pas encore disponible : la migration 0081 doit être lancée sur la base." : `Échec : ${error.message}`);
      return;
    }
    const n = Number(data) || 1;
    setMessage(`${a.nickname ?? "Ce membre"} : ${n} alerte${n > 1 ? "s" : ""} classée${n > 1 ? "s" : ""}. Les suivantes du même genre ne seront plus affichées.`);
    refresh();
    refreshExemptions();
  }

  async function removeExemption(e: AlertExemption) {
    const { error } = await supabase.rpc("alert_exemption_delete", { p_id: e.id });
    if (error) setMessage(`Échec : ${error.message}`);
    else refreshExemptions();
  }

  async function saveSettings() {
    const payload = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, Number(v)]));
    const { error } = await supabase.rpc("set_alert_settings", { p_settings: payload });
    setMessage(error ? `Échec : ${error.message}` : "Seuils enregistrés.");
  }

  const counts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.severity]: (acc[r.severity] ?? 0) + 1 }), {});

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Alertes d&apos;activité</h1>
        <p className="font-body text-sm text-paper/70">
          Gros mouvements de zénis, rafales de messages ou d&apos;achats, simulations trop rapides, actions d&apos;admin en
          série ou sur son propre compte, comptes endormis qui se réveillent. « Normal » range l&apos;alerte et masque les
          suivantes du même genre pour ce membre.
        </p>
      </div>

      {message && <p className="rounded-lg bg-red/10 px-3 py-2 font-mono text-xs text-red">{message}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              refresh(t.key);
            }}
            className={`rounded-lg border px-3 py-1.5 font-mono text-xs uppercase ${tab === t.key ? "border-blue bg-blue text-ink" : "border-white/15 text-paper/70 hover:bg-white/10"}`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-xs text-paper/65">
          {rows.length} alerte{rows.length > 1 ? "s" : ""}
          {counts.critical ? ` · ${counts.critical} critique${counts.critical > 1 ? "s" : ""}` : ""}
        </span>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && <p className="font-body text-sm text-paper/60">Rien à signaler. <SidIcon name="sparkle" /></p>}
        {rows.map((a) => {
          const sev = SEVERITY[a.severity];
          return (
            <div key={a.id} className={`glass-card flex flex-wrap items-start gap-3 p-4 ${a.status !== "open" ? "opacity-60" : ""}`}>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${sev.className}`}>{sev.label}</span>
              <div className="min-w-[14rem] flex-1 space-y-1">
                <p className="font-display uppercase">{a.title}</p>
                <p className="font-mono text-xs text-paper/60">
                  {ALERT_KINDS[a.kind] ?? a.kind} ·{" "}
                  {a.user_id ? (
                    <Link href={`/dashboard/admin/members/${a.user_id}`} className="text-blue-light underline">
                      {a.nickname ?? "membre supprimé"}
                    </Link>
                  ) : (
                    "—"
                  )}{" "}
                  · {timeAgo(a.created_at)}
                  {a.status !== "open" && a.handled_by_nickname && ` · ${a.status === "resolved" ? "traitée" : "ignorée"} par ${a.handled_by_nickname}`}
                  {a.details && (a.details as { exception?: boolean }).exception && " · classée seule (exception)"}
                </p>
                {describeAlert(a.details) && <p className="font-mono text-[11px] text-paper/65">{describeAlert(a.details)}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {a.status === "open" ? (
                  <>
                    <button onClick={() => setStatus(a, "resolved")} className="rounded-lg border border-blue px-3 py-1.5 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink">
                      ✓ Traitée
                    </button>
                    {a.user_id && (
                      <button
                        onClick={() => markNormal(a)}
                        title={`Les alertes « ${ALERT_KINDS[a.kind] ?? a.kind} » de ${a.nickname ?? "ce membre"} ne seront plus affichées.`}
                        className="rounded-lg border border-green-400/50 px-3 py-1.5 font-mono text-xs uppercase text-green-300 hover:bg-green-400/10"
                      >
                        Normal
                      </button>
                    )}
                    <button onClick={() => setStatus(a, "ignored")} className="rounded-lg border border-white/20 px-3 py-1.5 font-mono text-xs uppercase text-paper/70 hover:bg-white/10">
                      Ignorer
                    </button>
                  </>
                ) : (
                  <button onClick={() => setStatus(a, "open")} className="rounded-lg border border-white/20 px-3 py-1.5 font-mono text-xs uppercase text-paper/70 hover:bg-white/10">
                    Rouvrir
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {exemptions && (
        <div className="glass-card space-y-3 p-5">
          <button onClick={() => setShowExemptions((s) => !s)} className="flex w-full items-center justify-between font-display text-lg uppercase">
            Exceptions ({exemptions.length}) <span className="font-mono text-xs text-paper/65">{showExemptions ? "▲" : "▼"}</span>
          </button>
          {showExemptions &&
            (exemptions.length === 0 ? (
              <p className="font-body text-sm text-paper/60">Aucune. Le bouton « Normal » d&apos;une alerte en crée une.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {exemptions.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 py-2">
                    <div className="min-w-[12rem] flex-1">
                      <p className="font-body text-sm">
                        <Link href={`/dashboard/admin/members/${e.user_id}`} className="text-blue-light underline">
                          {e.nickname ?? "membre supprimé"}
                        </Link>{" "}
                        · {exemptionLabel(e)}
                      </p>
                      <p className="font-mono text-[11px] text-paper/60">
                        par {e.created_by_nickname ?? "—"}, {timeAgo(e.created_at)} · {e.hits} alerte{e.hits > 1 ? "s" : ""} classée{e.hits > 1 ? "s" : ""} depuis
                        {e.last_hit_at ? ` (dernière ${timeAgo(e.last_hit_at)})` : ""}
                      </p>
                    </div>
                    <button onClick={() => removeExemption(e)} className="rounded-lg border border-white/20 px-3 py-1.5 font-mono text-xs uppercase text-paper/70 hover:bg-white/10">
                      Réactiver
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}

      <div className="glass-card space-y-3 p-5">
        <button onClick={() => setShowSettings((s) => !s)} className="flex w-full items-center justify-between font-display text-lg uppercase">
          Seuils de détection <span className="font-mono text-xs text-paper/65">{showSettings ? "▲" : "▼"}</span>
        </button>
        {showSettings && (
          <>
            <p className="font-body text-sm text-paper/60">0 désactive une règle. Les changements sont inscrits au journal d&apos;audit.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ALERT_SETTINGS.map((s) => (
                <label key={s.key} className="space-y-1">
                  <span className="font-mono text-xs text-paper/70">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={settings[s.key] ?? ""}
                      onChange={(e) => setSettings((x) => ({ ...x, [s.key]: e.target.value }))}
                    />
                    <span className="shrink-0 font-mono text-xs text-paper/65">{s.unit}</span>
                  </div>
                </label>
              ))}
            </div>
            <button onClick={saveSettings} className={buttonPrimary}>
              Enregistrer les seuils
            </button>
          </>
        )}
      </div>
    </div>
  );
}
