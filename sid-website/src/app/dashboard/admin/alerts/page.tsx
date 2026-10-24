"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { PermissionKey } from "@/types/database";
import { inputClass, buttonPrimary } from "@/lib/ui";
import { ALERT_KINDS, ALERT_SETTINGS, SEVERITY, describeAlert, timeAgo, type AlertRow } from "@/lib/alerts";
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
          Le site repère tout seul ce qui sort de l&apos;ordinaire (vérification toutes les 3 minutes, à chaque visite d&apos;un
          membre) : gros mouvements de zénis, rafales de messages ou d&apos;achats, simulations trop rapides, actions
          d&apos;admin en série ou sur son propre compte, comptes endormis qui se réveillent… Une alerte n&apos;est pas une
          preuve : ouvre la fiche du membre pour vérifier, puis classe-la.
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
        <span className="ml-auto font-mono text-xs text-paper/50">
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
                </p>
                {describeAlert(a.details) && <p className="font-mono text-[11px] text-paper/50">{describeAlert(a.details)}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {a.status === "open" ? (
                  <>
                    <button onClick={() => setStatus(a, "resolved")} className="rounded-lg border border-blue px-3 py-1.5 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink">
                      ✓ Traitée
                    </button>
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

      <div className="glass-card space-y-3 p-5">
        <button onClick={() => setShowSettings((s) => !s)} className="flex w-full items-center justify-between font-display text-lg uppercase">
          Seuils de détection <span className="font-mono text-xs text-paper/50">{showSettings ? "▲" : "▼"}</span>
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
                    <span className="shrink-0 font-mono text-xs text-paper/50">{s.unit}</span>
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
