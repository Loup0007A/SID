"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { Profile, PermissionKey, ProfileStatus } from "@/types/database";
import { inputClass } from "@/lib/ui";

const STATUS_LABELS: Record<ProfileStatus, string> = {
  pending: "En attente",
  active: "Actif",
  rejected: "Refusé",
  banned: "Banni",
};

export default function AdminUsersPage() {
  const supabase = createClient();
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [resetResult, setResetResult] = useState<{ userId: string; password: string } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  async function refresh() {
    const { data, error } = await supabase.rpc("list_all_profiles_for_admin");
    if (error) {
      setMessage(`Impossible de charger les comptes : ${error.message}`);
      return;
    }
    setProfiles((data ?? []) as Profile[]);
  }

  useEffect(() => {
    (async () => {
      const { permissions } = await loadCurrentUser();
      setPermissions(permissions);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canUsers = can(permissions, "manage_users");

  async function toggleBan(p: Profile) {
    const nextStatus: ProfileStatus = p.status === "banned" ? "active" : "banned";
    if (nextStatus === "banned" && !confirm(`Bannir ${p.nickname} ? Le compte n'aura plus accès au tableau de bord.`)) return;
    const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", p.id);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    refresh();
  }

  async function toggleMute(p: Profile) {
    const { error } = await supabase.from("profiles").update({ is_muted: !p.is_muted }).eq("id", p.id);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    refresh();
  }

  async function resetPassword(p: Profile) {
    if (!confirm(`Générer un nouveau mot de passe temporaire pour ${p.nickname} ?`)) return;
    setResettingId(p.id);
    setResetResult(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: p.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Échec de la réinitialisation : ${data.error ?? res.statusText}`);
        return;
      }
      setResetResult({ userId: p.id, password: data.tempPassword });
    } catch (e) {
      setMessage(`Échec de la réinitialisation : ${e instanceof Error ? e.message : "erreur réseau"}`);
    } finally {
      setResettingId(null);
    }
  }

  if (!canUsers) {
    return <p className="font-body text-paper/60">Tu n&apos;as pas la permission de gérer les comptes.</p>;
  }

  const filtered = profiles.filter((p) =>
    `${p.nickname} ${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Administration des comptes</h1>
        <Link href="/dashboard/admin/economy" className="font-mono text-xs uppercase text-blue underline">
          Économie &amp; salaires →
        </Link>
      </div>

      <input
        placeholder="Rechercher un membre…"
        className={inputClass}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      <div className="space-y-3">
        {filtered.map((p) => (
          <div key={p.id} className="glass-card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[10rem] flex-1">
              <Link href={`/dashboard/profile/${p.id}`} className="font-display uppercase hover:text-blue-light hover:underline">
                {p.nickname}
              </Link>
              <p className="font-mono text-xs text-paper/60">
                {[p.first_name, p.last_name].filter(Boolean).join(" ")} · {STATUS_LABELS[p.status]}
                {p.is_muted && <span className="ml-1 text-red">· Mute</span>}
                {p.is_founder && <span className="ml-1 text-blue-light">· Fondateur</span>}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toggleBan(p)}
                disabled={p.is_founder}
                className="rounded-lg border border-red px-3 py-1.5 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {p.status === "banned" ? "Débannir" : "Bannir"}
              </button>
              <button
                onClick={() => toggleMute(p)}
                className="rounded-lg border border-blue px-3 py-1.5 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink"
              >
                {p.is_muted ? "Démute" : "Mute"}
              </button>
              <button
                onClick={() => resetPassword(p)}
                disabled={resettingId === p.id}
                className="rounded-lg border border-paper/40 px-3 py-1.5 font-mono text-xs uppercase text-paper hover:bg-paper hover:text-ink disabled:opacity-40"
              >
                {resettingId === p.id ? "…" : "Réinitialiser le mot de passe"}
              </button>
            </div>

            {resetResult?.userId === p.id && (
              <p className="w-full rounded-lg bg-blue/10 px-3 py-2 font-mono text-xs text-blue-light">
                Nouveau mot de passe temporaire : <span className="font-bold">{resetResult.password}</span> — communique-le
                au membre, il pourra le changer depuis son dossier.
              </p>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="font-body text-paper/60">Aucun compte ne correspond à cette recherche.</p>}
      </div>
    </div>
  );
}
