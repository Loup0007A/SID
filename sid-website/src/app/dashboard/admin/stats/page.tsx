"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LineChart } from "@/components/LineChart";
import type { AdminStats } from "@/types/stats";

// Lundi en premier ; `dow` renvoyé par la base : 0 = dimanche … 6 = samedi.
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DOW_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DOW_FULL = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** "2026-09-24" -> "24/09" (sans passer par Date : aucun risque de décalage de fuseau) */
function fmtDay(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

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
  const [cell, setCell] = useState<{ dow: number; hour: number } | null>(null);

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

  const heatmapMap = useMemo(() => new Map((stats?.heatmap ?? []).map((h) => [`${h.dow}-${h.hour}`, h.count])), [stats]);
  const maxHeat = useMemo(() => Math.max(1, ...(stats?.heatmap ?? []).map((h) => h.count)), [stats]);

  // Messages cumulés par heure de la journée (toutes journées confondues)
  const hourly = useMemo(() => {
    const totals = new Array(24).fill(0) as number[];
    (stats?.heatmap ?? []).forEach((h) => {
      totals[h.hour] += h.count;
    });
    return totals;
  }, [stats]);

  if (error) return <p className="font-mono text-sm text-red">Tu n&apos;as pas la permission de voir cette page, ou : {error}</p>;
  if (!stats) return <p className="font-body text-paper/60">Chargement des statistiques…</p>;

  const cellCount = cell ? heatmapMap.get(`${cell.dow}-${cell.hour}`) ?? 0 : 0;
  const money = (n: number) => `${n.toLocaleString("fr-FR")} Cr.`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Statistiques</h1>
        <p className="font-body text-sm text-paper/60">
          Vue d&apos;ensemble de l&apos;activité du S.I.D. Toutes les heures et dates sont affichées en heure de{" "}
          <span className="font-mono">{stats.timezone}</span>.
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
        <StatCard
          emoji="🕐"
          label="Heure la plus active"
          value={stats.peak_hour != null ? `${stats.peak_hour}h – ${(stats.peak_hour + 1) % 24}h` : "—"}
        />
        <StatCard emoji="🎮" label="Quêtes créées" value={stats.quests_created} />
        <StatCard emoji="✅" label="Quêtes accomplies" value={stats.quests_completed} />
        <StatCard emoji="🛒" label="Achats en boutique" value={stats.purchases_count} />
        <StatCard emoji="💰" label="Valeur totale des achats" value={money(stats.purchases_total_value)} />
        <StatCard emoji="🏦" label="Argent en circulation" value={money(stats.money_in_circulation)} />
        <StatCard emoji="🏢" label="Entreprises actives" value={stats.businesses_count} />
        <StatCard emoji="🧾" label="Caisse d'impôts" value={money(stats.tax_pool_balance)} />
        <StatCard
          emoji="🥇"
          label="Objet le plus vendu"
          value={stats.top_selling_item ? `${stats.top_selling_item.name} (×${stats.top_selling_item.quantity})` : "—"}
        />
        <StatCard
          emoji="💸"
          label="Meilleur acheteur"
          value={stats.top_buyer ? `${stats.top_buyer.nickname} (${money(stats.top_buyer.total_spent)})` : "—"}
        />
        <StatCard
          emoji="🏪"
          label="Meilleur vendeur"
          value={stats.top_seller ? `${stats.top_seller.nickname} (${money(stats.top_seller.total_earned)})` : "—"}
        />
      </div>

      <div className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">📈 Activité des 30 derniers jours</h2>
        <LineChart
          labels={stats.daily_activity.map((d) => fmtDay(d.day))}
          series={[
            { name: "Messages", color: "#8FB3D9", values: stats.daily_activity.map((d) => d.messages) },
            { name: "Visites", color: "#D99A9A", values: stats.daily_activity.map((d) => d.visits) },
          ]}
          zeroBased
          fill={false}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card space-y-3 p-6">
          <h2 className="font-display text-lg uppercase">💬 Messages (8 semaines)</h2>
          <LineChart
            labels={stats.weekly_activity.map((w) => `Sem. ${fmtDay(w.week_start)}`)}
            series={[{ name: "Messages", color: "#8FB3D9", values: stats.weekly_activity.map((w) => w.message_count) }]}
            zeroBased
            height={200}
          />
        </div>
        <div className="glass-card space-y-3 p-6">
          <h2 className="font-display text-lg uppercase">🛒 Achats (8 semaines)</h2>
          <LineChart
            labels={stats.purchases_weekly.map((w) => `Sem. ${fmtDay(w.week_start)}`)}
            series={[{ name: "Achats", color: "#D99A9A", values: stats.purchases_weekly.map((w) => w.purchases_count) }]}
            zeroBased
            height={200}
          />
        </div>
      </div>

      <div className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">🕐 Activité selon l&apos;heure de la journée</h2>
        <LineChart
          labels={hourly.map((_, h) => `${h}h`)}
          series={[{ name: "Messages", color: "#8FB3D9", values: hourly }]}
          zeroBased
          formatValue={(n) => `${n} message${n > 1 ? "s" : ""}`}
        />
      </div>

      <div className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">🗺️ Carte thermique — messages par jour / heure</h2>
        <p className="min-h-[1.25rem] font-mono text-xs text-blue-light">
          {cell
            ? `${DOW_FULL[cell.dow]} de ${cell.hour}h à ${(cell.hour + 1) % 24}h : ${cellCount} message${cellCount > 1 ? "s" : ""}`
            : "Survole ou touche une case pour voir l'activité."}
        </p>
        <div className="overflow-x-auto" onMouseLeave={() => setCell(null)}>
          <div className="inline-grid grid-cols-[auto_repeat(24,minmax(14px,1fr))] gap-[2px]">
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="text-center font-mono text-[8px] text-paper/40">{h % 3 === 0 ? h : ""}</div>
            ))}
            {DOW_ORDER.map((dow) => (
              <Fragment key={dow}>
                <div className="pr-2 font-mono text-[9px] text-paper/50">{DOW_SHORT[dow]}</div>
                {Array.from({ length: 24 }).map((_, hour) => {
                  const count = heatmapMap.get(`${dow}-${hour}`) ?? 0;
                  const intensity = count / maxHeat;
                  const selected = cell?.dow === dow && cell?.hour === hour;
                  return (
                    <div
                      key={`${dow}-${hour}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${DOW_FULL[dow]} ${hour}h : ${count} messages`}
                      title={`${DOW_SHORT[dow]} ${hour}h — ${count} message(s)`}
                      onMouseEnter={() => setCell({ dow, hour })}
                      onClick={() => setCell({ dow, hour })}
                      onFocus={() => setCell({ dow, hour })}
                      className={`aspect-square cursor-pointer rounded-sm ${selected ? "ring-2 ring-paper" : ""}`}
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
