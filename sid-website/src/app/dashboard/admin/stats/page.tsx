"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminStats } from "@/types/stats";

const DOW_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string | number }) {
  return (
    <div className="glass-card space-y-1 p-4">
      <p className="font-mono text-xs uppercase tracking-wide text-paper/60">{emoji} {label}</p>
      <p className="font-display text-2xl text-blue-light">{value}</p>
    </div>
  );
}

export default function AdminStatsPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_admin_stats");
      if (error) {
        setError(error.message);
        return;
      }
      setStats(data as AdminStats);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="font-mono text-sm text-red">Tu n&apos;as pas la permission de voir cette page, ou : {error}</p>;
  if (!stats) return <p className="font-body text-paper/60">Chargement des statistiques…</p>;

  const maxWeekly = Math.max(1, ...stats.weekly_activity.map((w) => w.message_count));
  const heatmapMap = new Map(stats.heatmap.map((h) => [`${h.dow}-${h.hour}`, h.count]));
  const maxHeat = Math.max(1, ...stats.heatmap.map((h) => h.count));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Statistiques</h1>
        <p className="font-body text-sm text-paper/60">
          Vue d&apos;ensemble de l&apos;activité de la S.I.D. Certains indicateurs "génériques" (réactions,
          photos, événements) n&apos;ont pas d&apos;équivalent ici et sont remplacés par des indicateurs propres
          au site (quêtes, boutique).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard emoji="👥" label="Membres inscrits" value={stats.total_members} />
        <StatCard emoji="🟢" label="Actifs aujourd'hui" value={stats.active_today} />
        <StatCard emoji="📅" label="Visites (7 jours)" value={stats.visits_week} />
        <StatCard emoji="📅" label="Visites (30 jours)" value={stats.visits_month} />
        <StatCard emoji="💬" label="Messages envoyés" value={stats.messages_total} />
        <StatCard
          emoji="🏆"
          label="Membre le plus actif"
          value={stats.most_active_member ? `${stats.most_active_member.nickname} (${stats.most_active_member.message_count})` : "—"}
        />
        <StatCard emoji="🔥" label="Série de jours actifs" value={`${stats.streak_days} j.`} />
        <StatCard emoji="🕐" label="Heure la plus active" value={stats.peak_hour != null ? `${stats.peak_hour}h` : "—"} />
        <StatCard emoji="🎮" label="Quêtes créées" value={stats.quests_created} />
        <StatCard emoji="✅" label="Quêtes accomplies" value={stats.quests_completed} />
        <StatCard emoji="🛒" label="Achats en boutique" value={stats.purchases_count} />
        <StatCard emoji="💰" label="Valeur totale des achats" value={`${stats.purchases_total_value.toLocaleString("fr-FR")} Cr.`} />
      </div>

      <div className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">📈 Évolution de l&apos;activité (8 dernières semaines)</h2>
        {stats.weekly_activity.length === 0 ? (
          <p className="font-body text-sm text-paper/60">Pas encore assez de données.</p>
        ) : (
          <div className="flex h-32 items-end gap-2">
            {stats.weekly_activity.map((w) => (
              <div key={w.week_start} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-blue"
                  style={{ height: `${(w.message_count / maxWeekly) * 100}%`, minHeight: 2 }}
                  title={`${w.message_count} messages`}
                />
                <span className="font-mono text-[9px] text-paper/50">
                  {new Date(w.week_start).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">🗺️ Carte thermique — messages par jour / heure</h2>
        <div className="overflow-x-auto">
          <div className="inline-grid grid-cols-[auto_repeat(24,minmax(14px,1fr))] gap-[2px]">
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="text-center font-mono text-[8px] text-paper/40">{h % 3 === 0 ? h : ""}</div>
            ))}
            {DOW_LABELS.map((label, dow) => (
              <Fragment key={dow}>
                <div className="pr-2 font-mono text-[9px] text-paper/50">{label}</div>
                {Array.from({ length: 24 }).map((_, hour) => {
                  const count = heatmapMap.get(`${dow}-${hour}`) ?? 0;
                  const intensity = count / maxHeat;
                  return (
                    <div
                      key={`${dow}-${hour}`}
                      title={`${label} ${hour}h — ${count} message(s)`}
                      className="aspect-square rounded-sm"
                      style={{ backgroundColor: `rgba(143, 179, 217, ${0.08 + intensity * 0.85})` }}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
