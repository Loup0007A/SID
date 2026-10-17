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
  const [statusFilter, setStatusFilter] = useState<"all" | ProfileStatus | "invisible">("all");
  const [sortBy, setSortBy] = useState<"recent" | "seen" | "name">("recent");
  const [resetResult, setResetResult] = useState<{ userId: string; password: string } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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

  async function toggleInvisible(p: Profile) {
    const { error } = await supabase.from("profiles").update({ is_invisible: !p.is_invisible }).eq("id", p.id);
    if (error) {
      setMessage(
        error.message.includes("is_invisible")
          ? "Fonction pas encore activée : la migration 0058 doit être lancée sur la base."
          : `Échec : ${error.message}`
      );
      return;
    }
    setMessage(`${p.nickname} est maintenant ${p.is_invisible ? "visible" : "invisible"} pour les autres membres.`);
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

  // Pour un membre qui ne reçoit jamais son email de confirmation : le
  // compte est marqué comme confirmé sans passer par le message.
  async function confirmEmail(p: Profile) {
    if (!confirm(`Confirmer manuellement l'email de ${p.nickname} ? Il pourra se connecter sans cliquer sur le lien reçu.`)) return;
    setConfirmingId(p.id);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/confirm-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: p.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Échec de la confirmation : ${data.error ?? res.statusText}`);
        return;
      }
      setMessage(`Email de ${p.nickname} confirmé.`);
    } catch (e) {
      setMessage(`Échec de la confirmation : ${e instanceof Error ? e.message : "erreur réseau"}`);
    } finally {
      setConfirmingId(null);
    }
  }

  if (!canUsers) {
    return <p className="font-body text-paper/60">Tu n&apos;as pas la permission de gérer les comptes.</p>;
  }

  const seen = (p: Profile) => (p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0);
  const filtered = profiles
    .filter((p) => `${p.nickname} ${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => statusFilter === "all" || (statusFilter === "invisible" ? p.is_invisible : p.status === statusFilter))
    .sort((a, b) =>
      sortBy === "name" ? a.nickname.localeCompare(b.nickname, "fr") : sortBy === "seen" ? seen(b) - seen(a) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  const lastSeen = (p: Profile) => {
    if (!p.last_seen_at) return "jamais venu";
    const d = Math.floor((Date.now() - new Date(p.last_seen_at).getTime()) / 86400000);
    return d === 0 ? "vu aujourd'hui" : d === 1 ? "vu hier" : `vu il y a ${d} j`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Administration des comptes</h1>
        <Link href="/dashboard/admin/economy" className="font-mono text-xs uppercase text-blue underline">
          Économie &amp; salaires →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Rechercher un membre…"
          className={`${inputClass} min-w-[12rem] flex-1`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={`${inputClass} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">Tous les comptes ({profiles.length})</option>
          <option value="active">Actifs</option>
          <option value="pending">En attente</option>
          <option value="banned">Bannis</option>
          <option value="rejected">Refusés</option>
          <option value="invisible">Invisibles</option>
        </select>
        <select className={`${inputClass} w-auto`} value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
          <option value="recent">Plus récents</option>
          <option value="seen">Dernière visite</option>
          <option value="name">Nom</option>
        </select>
      </div>

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      <div className="space-y-3">
        {filtered.map((p) => (
          <div key={p.id} className="glass-card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[10rem] flex-1">
              <Link href={`/dashboard/admin/members/${p.id}`} className="font-display uppercase hover:text-blue-light hover:underline" title="Fiche : activité, alertes, actions">
                {p.nickname}
              </Link>
              <p className="font-mono text-xs text-paper/60">
                {[p.first_name, p.last_name].filter(Boolean).join(" ")} · {STATUS_LABELS[p.status]}
                {p.is_muted && <span className="ml-1 text-red">· Mute</span>}
                {p.is_founder && <span className="ml-1 text-blue-light">· Fondateur</span>}
                {p.is_invisible && <span className="ml-1 text-paper/80">· 👻 Invisible</span>}
                {p.sandbox_expires_at && <span className="ml-1 text-yellow-300">· 🧪 Test</span>}
                <span className="ml-1 text-paper/40">· {lastSeen(p)}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard/admin/members/${p.id}`}
                className="rounded-lg border border-blue bg-blue/10 px-3 py-1.5 font-mono text-xs uppercase text-blue-light hover:bg-blue hover:text-ink"
              >
                Fiche
              </Link>
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
                onClick={() => toggleInvisible(p)}
                className="rounded-lg border border-paper/40 px-3 py-1.5 font-mono text-xs uppercase text-paper hover:bg-paper hover:text-ink"
                title="Un compte invisible n'apparaît plus aux autres membres (trombinoscope, classement, carte, organigramme, profil, listes de choix)"
              >
                {p.is_invisible ? "Rendre visible" : "Rendre invisible"}
              </button>
              <button
                onClick={() => confirmEmail(p)}
                disabled={confirmingId === p.id}
                className="rounded-lg border border-blue px-3 py-1.5 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40"
              >
                {confirmingId === p.id ? "…" : "Confirmer l'email"}
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
