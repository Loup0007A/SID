"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SpyRole, SpyReport } from "@/types/database";

function levelLabel(level: number) {
  return { 1: "Novice", 2: "Confirmé", 3: "Élite" }[level] ?? "Novice";
}

function xpToNextLevel(xp: number) {
  if (xp < 50) return { next: 50, label: "Confirmé" };
  if (xp < 150) return { next: 150, label: "Élite" };
  return null;
}

export default function SpyPage() {
  const supabase = createClient();
  const [spyRole, setSpyRole] = useState<SpyRole | null | undefined>(undefined); // undefined = chargement
  const [targets, setTargets] = useState<{ id: string; name: string }[]>([]);
  const [reports, setReports] = useState<SpyReport[]>([]);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: role } = await supabase.from("spy_roles").select("*").eq("user_id", user.id).maybeSingle();
    setSpyRole(role ?? null);
    if (!role) return;

    if (role.last_spied_at) {
      const until = new Date(new Date(role.last_spied_at).getTime() + 3600_000);
      setCooldownUntil(until > new Date() ? until : null);
    }

    const { data: t } = await supabase.rpc("list_spyable_channels");
    setTargets(t ?? []);

    const { data: r } = await supabase.from("spy_reports").select("*").eq("spy_id", user.id).order("created_at", { ascending: false });
    setReports(r ?? []);
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function spyOn(channelId: string) {
    setMessage(null);
    const { error } = await supabase.rpc("espionner", { p_channel_id: channelId });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Mission d'espionnage réussie.");
    refresh();
  }

  if (spyRole === undefined) return <p className="font-body text-paper/60">Chargement…</p>;

  if (spyRole === null) {
    return (
      <div className="dossier-card max-w-md p-6">
        <p className="font-body">Tu n&apos;as pas ce rôle.</p>
      </div>
    );
  }

  const nextLevel = xpToNextLevel(spyRole.xp);
  const onCooldown = cooldownUntil && cooldownUntil > new Date();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">Dossier confidentiel</p>
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Réseau d&apos;espionnage</h1>
      </div>

      <div className="dossier-card space-y-2 p-6">
        <p className="font-display uppercase">Niveau {spyRole.spy_level} — {levelLabel(spyRole.spy_level)}</p>
        <p className="font-mono text-xs text-paper-text/70">{spyRole.xp} XP{nextLevel ? ` · ${nextLevel.next - spyRole.xp} XP avant le niveau ${nextLevel.label}` : " · niveau maximum atteint"}</p>
        <p className="font-mono text-xs text-paper-text/70">
          {onCooldown
            ? `Prochaine mission possible à ${cooldownUntil!.toLocaleTimeString("fr-FR")}`
            : "Prêt pour une mission."}
        </p>
      </div>

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      <div className="space-y-3">
        <h2 className="font-display text-lg uppercase text-paper">Cibles disponibles</h2>
        {targets.length === 0 && <p className="font-body text-paper/60">Aucun salon espionnable accessible pour le moment.</p>}
        {targets.map((t) => (
          <div key={t.id} className="dossier-card flex items-center justify-between p-4">
            <span className="font-display uppercase">{t.name}</span>
            <button
              disabled={!!onCooldown}
              onClick={() => spyOn(t.id)}
              className="rounded-lg border border-red px-4 py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-30"
            >
              Espionner
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg uppercase text-paper">Rapports précédents</h2>
        {reports.length === 0 && <p className="font-body text-paper/60">Aucun rapport pour l&apos;instant.</p>}
        {reports.map((r) => (
          <div key={r.id} className="dossier-card space-y-2 p-4">
            <p className="font-mono text-xs text-paper-text/60">{new Date(r.created_at).toLocaleString("fr-FR")}</p>
            {r.snippets.map((s, i) => (
              <p key={i} className="font-body text-sm">
                <span className="font-mono text-xs uppercase text-red">{s.sender_nickname} : </span>
                {s.content}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
