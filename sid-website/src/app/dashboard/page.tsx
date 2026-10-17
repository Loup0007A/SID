"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { PermissionKey, Profile, Quest, Wallet } from "@/types/database";
import { QuestCard } from "@/components/QuestCard";
import { NavIcon } from "@/components/NavIcon";
import { NAV_GROUPS, visibleEntries } from "@/lib/navigation";
import { ConstructionTape } from "@/components/ConstructionTape";
import { useSuspendedSections } from "@/lib/maintenance";
import { MemberStatBars } from "@/components/MemberStatBars";
import type { SimulationOverview } from "@/types/simulationRuns";
import { BirthdaysToday } from "@/components/secrets/Birthday";

export default function DashboardHome() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [training, setTraining] = useState<SimulationOverview | null>(null);
  // « À faire » : ce qui attend le membre (et l'administration) en ce moment.
  const [todo, setTodo] = useState<{ notifs: number; pending: number; alerts: number; deletions: number }>({ notifs: 0, pending: 0, alerts: 0, deletions: 0 });

  useEffect(() => {
    (async () => {
      const { profile, permissions } = await loadCurrentUser();
      setProfile(profile);
      setPermissions(permissions);
      if (!profile) return;

      const { data: w } = await supabase.from("wallets").select("*").eq("user_id", profile.id).single();
      setWallet(w);

      const isAdmin = can(permissions, "manage_users") && !profile.sandbox_expires_at;
      const [notifs, pending, alerts, deletions] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("is_read", false),
        can(permissions, "recruit", "manage_users")
          ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending")
          : Promise.resolve({ count: 0 }),
        isAdmin ? supabase.rpc("count_open_alerts") : Promise.resolve({ data: 0 }),
        isAdmin
          ? supabase.from("privacy_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
          : Promise.resolve({ count: 0 }),
      ]);
      setTodo({
        notifs: notifs.count ?? 0,
        pending: ("count" in pending ? pending.count : 0) ?? 0,
        alerts: Number(("data" in alerts ? alerts.data : 0) ?? 0) || 0,
        deletions: ("count" in deletions ? deletions.count : 0) ?? 0,
      });

      // Facteurs de puissance (absent tant que la migration 0049 n'est pas appliquée).
      const { data: overview } = await supabase.rpc("get_simulation_overview");
      if (overview) setTraining(overview as SimulationOverview);

      const { data: countsData } = await supabase.rpc("quest_participant_counts");
      setCounts(new Map(((countsData ?? []) as { quest_id: string; participant_count: number }[]).map((c) => [c.quest_id, c.participant_count])));

      const { data: participations } = await supabase.from("quest_participants").select("quest_id").eq("user_id", profile.id);
      const questIds = (participations ?? []).map((p) => p.quest_id);
      if (questIds.length) {
        // "En cours" : on exclut les quêtes déjà accomplies ou échouées.
        const { data: quests } = await supabase
          .from("quests")
          .select("*")
          .in("id", questIds)
          .in("status", ["open", "in_progress"]);
        setMyQuests(quests ?? []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = visibleEntries((...anyOf) => can(permissions, ...anyOf));
  const suspended = useSuspendedSections();

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">Dossier central</p>
          <h1 className="font-display text-3xl uppercase tracking-wide">
            {profile ? `Bonjour, ${profile.nickname}` : "Bienvenue"}
          </h1>
        </div>
        <Link href="/dashboard/bank" scroll={false} className="glass-card px-5 py-3 transition hover:-translate-y-0.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">Solde</p>
          <p className="font-display text-3xl text-blue">{wallet ? wallet.balance.toLocaleString("fr-FR") : "…"} z</p>
        </Link>
      </div>

      {profile && <BirthdaysToday myId={profile.id} />}

      <section aria-label="À faire" className="flex flex-wrap gap-2">
        {myQuests.length > 0 && (
          <a href="#missions" className="glass-card px-3 py-2 font-mono text-xs hover:border-blue/50">
            📜 {myQuests.length} mission{myQuests.length > 1 ? "s" : ""} en cours
          </a>
        )}
        {todo.notifs > 0 && (
          <Link href="/dashboard/notifications" scroll={false} className="glass-card px-3 py-2 font-mono text-xs hover:border-blue/50">
            🔔 {todo.notifs} notification{todo.notifs > 1 ? "s" : ""} non lue{todo.notifs > 1 ? "s" : ""}
          </Link>
        )}
        {todo.pending > 0 && (
          <Link href="/dashboard/admin/applications" scroll={false} className="glass-card border-blue/40 px-3 py-2 font-mono text-xs hover:border-blue">
            📋 {todo.pending} candidature{todo.pending > 1 ? "s" : ""} à examiner
          </Link>
        )}
        {todo.alerts > 0 && (
          <Link href="/dashboard/admin/alerts" scroll={false} className="glass-card border-red/50 px-3 py-2 font-mono text-xs text-red hover:border-red">
            🚨 {todo.alerts} alerte{todo.alerts > 1 ? "s" : ""} d&apos;activité
          </Link>
        )}
        {todo.deletions > 0 && (
          <Link href="/dashboard/admin/alerts" scroll={false} className="glass-card border-red/50 px-3 py-2 font-mono text-xs text-red hover:border-red">
            🗑️ {todo.deletions} demande{todo.deletions > 1 ? "s" : ""} de suppression de compte
          </Link>
        )}
        {myQuests.length === 0 && todo.notifs === 0 && todo.pending === 0 && todo.alerts === 0 && todo.deletions === 0 && (
          <Link href="/dashboard/quests" scroll={false} className="glass-card px-3 py-2 font-mono text-xs text-paper/70 hover:border-blue/50">
            Rien ne t&apos;attend pour l&apos;instant · voir les quêtes ouvertes →
          </Link>
        )}
      </section>

      {myQuests.length > 0 && (
        <section id="missions" className="scroll-mt-24 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl uppercase tracking-wide text-red">Mes missions en cours</h2>
            <Link href="/dashboard/quests" scroll={false} className="font-mono text-xs uppercase text-blue underline">
              Toutes les quêtes
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myQuests.map((q) => (
              <QuestCard key={q.id} quest={q} participantCount={counts.get(q.id) ?? 0} />
            ))}
          </div>
        </section>
      )}

      {NAV_GROUPS.map((group) => {
        const items = entries.filter((e) => e.group === group.key);
        if (items.length === 0) return null;
        return (
          <section key={group.key} className="space-y-3">
            <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-paper/50">{group.label}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((e) => (
                <Link
                  key={e.key}
                  href={e.href}
                  scroll={false}
                  aria-label={
                    e.section && suspended[e.section]
                      ? `${e.label} (service suspendu)`
                      : e.wip
                        ? `${e.label} (en développement)`
                        : undefined
                  }
                  className="glass-card group relative flex flex-col items-center gap-2 overflow-hidden px-3 py-5 text-center transition hover:-translate-y-1 hover:border-blue/50 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                >
                  <span className="flex h-16 w-16 items-center justify-center transition group-hover:scale-110">
                    <NavIcon entry={e} />
                  </span>
                  <span className="font-display uppercase tracking-wide">{e.label}</span>
                  <span className="hidden font-body text-xs leading-snug text-paper/60 sm:block">{e.description}</span>
                  {e.section && suspended[e.section] ? (
                    <ConstructionTape label="Service suspendu" />
                  ) : (
                    e.wip && <ConstructionTape />
                  )}
                </Link>
              ))}
              {group.key === "entrainement" && training && (
                <div className="glass-card col-span-2 px-4 py-4 sm:col-span-3 lg:col-span-1">
                  <MemberStatBars
                    stats={{ intelligence: training.intelligence, strength: training.strength, technique: training.technique }}
                    power={training.power}
                  />
                </div>
              )}
            </div>
          </section>
        );
      })}

    </div>
  );
}
