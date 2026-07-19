"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Quest, Wallet } from "@/types/database";
import { QuestCard } from "@/components/QuestCard";

export default function DashboardOverview() {
  const supabase = createClient();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: w } = await supabase.from("wallets").select("*").eq("user_id", user.id).single();
      setWallet(w);

      const { data: participations } = await supabase
        .from("quest_participants")
        .select("quest_id")
        .eq("user_id", user.id);

      const questIds = (participations ?? []).map((p) => p.quest_id);
      if (questIds.length) {
        const { data: quests } = await supabase.from("quests").select("*").in("id", questIds);
        setMyQuests(quests ?? []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <div className="dossier-card inline-block px-6 py-4">
        <p className="font-mono text-xs uppercase tracking-wide text-paper-text/60">Solde du dossier</p>
        <p className="font-display text-4xl text-blue">{wallet ? wallet.balance.toLocaleString("fr-FR") : "…"} Cr.</p>
      </div>

      <div>
        <h2 className="mb-4 font-display text-xl uppercase tracking-wide text-red">Mes missions en cours</h2>
        {myQuests.length === 0 ? (
          <p className="font-body text-paper/60">Aucune mission assignée pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myQuests.map((q) => (
              <QuestCard key={q.id} quest={q} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
