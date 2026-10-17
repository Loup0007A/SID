"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { PermissionKey } from "@/types/database";
import { inputClass } from "@/lib/ui";
import { ACTION_LABELS, describe } from "@/lib/auditLabels";

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
