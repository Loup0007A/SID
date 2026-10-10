"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { PermissionKey } from "@/types/database";
import { inputClass } from "@/lib/ui";

interface AuditRow {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_nickname: string | null;
  action: string;
  target_user_id: string | null;
  target_label: string | null;
  details: Record<string, unknown>;
}

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  profile_changed: "Profil modifié",
  role_assigned: "Rôle attribué",
  role_removed: "Rôle retiré",
  role_created: "Rôle créé",
  role_updated: "Rôle modifié",
  role_deleted: "Rôle supprimé",
  permission_granted: "Permission ajoutée",
  permission_revoked: "Permission retirée",
  sanction_issued: "Sanction",
  sanction_ended: "Fin de sanction",
  maintenance_changed: "Maintenance",
  wallet_adjusted: "Solde ajusté",
  reputation_adjusted: "Renommée ajustée",
  password_reset: "Mot de passe réinitialisé",
  email_confirmed: "Email confirmé à la main",
};

const FIELD_LABELS: Record<string, string> = {
  status: "statut",
  is_muted: "mute",
  is_frozen: "gel",
  is_founder: "fondateur",
  member_rank: "rang",
  power_score: "puissance",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "en attente",
  active: "actif",
  rejected: "refusé",
  banned: "banni",
};

const SANCTION_LABELS: Record<string, string> = {
  warning: "avertissement",
  mute: "mute",
  freeze: "gel du compte",
  ban: "bannissement",
  fine: "amende",
};

const SECTION_LABELS: Record<string, string> = {
  shop: "Boutique",
  chat: "Messagerie",
  bank: "Banque & bourse",
  quests: "Quêtes",
  registrations: "Inscriptions",
};

function show(value: unknown, field?: string): string {
  if (value === true) return "oui";
  if (value === false) return "non";
  if (value === null || value === undefined) return "—";
  if (field === "status" && typeof value === "string") return STATUS_LABELS[value] ?? value;
  return String(value);
}

function money(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR")}`;
}

/** Une phrase lisible pour les détails de chaque type d'entrée. */
function describe(row: AuditRow): string {
  const d = row.details ?? {};
  switch (row.action) {
    case "profile_changed":
      return Object.entries(d)
        .map(([k, v]) => {
          const change = v as { from?: unknown; to?: unknown };
          return `${FIELD_LABELS[k] ?? k} : ${show(change.from, k)} → ${show(change.to, k)}`;
        })
        .join(" · ");
    case "role_assigned":
    case "role_removed":
      return String(d.role ?? "");
    case "permission_granted":
    case "permission_revoked":
      return `${d.permission ?? ""} (rôle « ${d.role ?? "?"} »)`;
    case "role_created":
    case "role_deleted":
      return String(d.name ?? "");
    case "role_updated":
      return d.previous_name && d.previous_name !== d.name ? `« ${d.previous_name} » → « ${d.name} »` : String(d.name ?? "");
    case "sanction_issued": {
      const parts = [SANCTION_LABELS[String(d.type)] ?? String(d.type)];
      if (d.amount != null) parts.push(`${Number(d.amount).toLocaleString("fr-FR")} z`);
      if (d.reason) parts.push(`« ${d.reason} »`);
      if (d.expires_at) parts.push(`jusqu'au ${new Date(String(d.expires_at)).toLocaleString("fr-FR")}`);
      return parts.join(" · ");
    }
    case "sanction_ended":
      return SANCTION_LABELS[String(d.type)] ?? String(d.type);
    case "maintenance_changed":
      return `${SECTION_LABELS[String(d.section)] ?? String(d.section)} ${d.enabled ? "réactivée" : "suspendue"}`;
    case "wallet_adjusted":
      return `${money(d.amount)} z${d.reason ? ` — « ${d.reason} »` : ""}`;
    case "reputation_adjusted":
      return `${money(d.amount)} de renommée${d.reason ? ` — « ${d.reason} »` : ""}`;
    default:
      return Object.keys(d).length ? JSON.stringify(d) : "";
  }
}

export default function AuditPage() {
  const supabase = createClient();
  const [permissions, setPermissions] = useState<Set<PermissionKey> | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [action, setAction] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(offset: number, filter: string) {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("list_audit_log", {
      p_limit: PAGE_SIZE,
      p_offset: offset,
      p_action: filter || null,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const page = (data ?? []) as AuditRow[];
    setRows((prev) => (offset === 0 ? page : [...prev, ...page]));
    setHasMore(page.length === PAGE_SIZE);
  }

  useEffect(() => {
    (async () => {
      const { permissions } = await loadCurrentUser();
      setPermissions(permissions);
    })();
  }, []);

  useEffect(() => {
    if (permissions && can(permissions, "manage_users")) load(0, action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions, action]);

  if (!permissions) return <p className="font-body text-paper/60">Chargement…</p>;
  if (!can(permissions, "manage_users")) {
    return <p className="font-body text-paper/60">Tu n&apos;as pas la permission de consulter le journal d&apos;audit.</p>;
  }

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) =>
        `${r.actor_nickname ?? ""} ${r.target_label ?? ""} ${describe(r)}`.toLowerCase().includes(q)
      )
    : rows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Journal d&apos;audit</h1>
        <p className="font-body text-sm text-paper/60">
          Chaque action sensible de l&apos;administration est enregistrée ici automatiquement : sanctions, rôles et
          permissions, soldes, maintenance, mots de passe… Personne ne peut modifier ou effacer une entrée depuis le
          site.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className={`${inputClass} w-auto`} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input
          className={`${inputClass} min-w-[12rem] flex-1`}
          placeholder="Filtrer les entrées chargées (membre, détail…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="font-mono text-sm text-red">Impossible de charger le journal : {error}</p>}

      <div className="glass-card divide-y divide-white/10">
        {visible.map((r) => (
          <div key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
            <span className="w-36 shrink-0 font-mono text-[11px] text-paper/50">
              {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}
            </span>
            <span className="rounded-full border border-blue/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-blue-light">
              {ACTION_LABELS[r.action] ?? r.action}
            </span>
            <span className="font-body text-sm">
              <span className="text-paper/60">par</span>{" "}
              {r.actor_id ? (
                <Link href={`/dashboard/profile/${r.actor_id}`} className="font-semibold hover:underline">
                  {r.actor_nickname ?? "?"}
                </Link>
              ) : (
                <span className="font-semibold">Système</span>
              )}
              {r.target_label && (
                <>
                  {" "}
                  <span className="text-paper/60">→</span>{" "}
                  {r.target_user_id ? (
                    <Link href={`/dashboard/profile/${r.target_user_id}`} className="font-semibold hover:underline">
                      {r.target_label}
                    </Link>
                  ) : (
                    <span className="font-semibold">{r.target_label}</span>
                  )}
                </>
              )}
            </span>
            <span className="w-full font-mono text-xs text-paper/70 sm:w-auto">{describe(r)}</span>
          </div>
        ))}
        {visible.length === 0 && !loading && (
          <p className="px-4 py-6 text-center font-body text-paper/60">Aucune entrée pour le moment.</p>
        )}
      </div>

      {hasMore && rows.length > 0 && (
        <button
          onClick={() => load(rows.length, action)}
          disabled={loading}
          className="rounded-lg border border-blue px-4 py-2 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40"
        >
          {loading ? "Chargement…" : "Charger plus"}
        </button>
      )}
    </div>
  );
}
