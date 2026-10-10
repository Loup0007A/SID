"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { PermissionKey, Profile, Quest, Wallet } from "@/types/database";
import { QuestCard } from "@/components/QuestCard";
import { NavIcon } from "@/components/NavIcon";
import { NAV_GROUPS, visibleEntries } from "@/lib/navigation";

export default function DashboardHome() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    (async () => {
      const { profile, permissions } = await loadCurrentUser();
      setProfile(profile);
      setPermissions(permissions);
      if (!profile) return;

      const { data: w } = await supabase.from("wallets").select("*").eq("user_id", profile.id).single();
      setWallet(w);

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
                  className="glass-card group flex flex-col items-center gap-2 px-3 py-5 text-center transition hover:-translate-y-1 hover:border-blue/50 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                >
                  <span className="flex h-16 w-16 items-center justify-center transition group-hover:scale-110">
                    <NavIcon entry={e} />
                  </span>
                  <span className="font-display uppercase tracking-wide">{e.label}</span>
                  <span className="hidden font-body text-xs leading-snug text-paper/60 sm:block">{e.description}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase tracking-wide text-red">Mes missions en cours</h2>
          <Link href="/dashboard/quests" scroll={false} className="font-mono text-xs uppercase text-blue underline">
            Toutes les quêtes
          </Link>
        </div>
        {myQuests.length === 0 ? (
          <p className="font-body text-paper/60">Aucune mission assignée pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myQuests.map((q) => (
              <QuestCard key={q.id} quest={q} participantCount={counts.get(q.id) ?? 0} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
