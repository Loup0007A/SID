"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";

/**
 * Rapport de la semaine (Lot 59, hebdomadaire depuis le Lot 66) : en haut de
 * l'accueil, à partir du vendredi 18 h (heure de Paris), le bilan des sept
 * jours écoulés. Argent gagné ou dépensé, renommée, titres, nouvelles quêtes,
 * nouveaux agents, nouveautés du Comptoir. Il reste affiché jusqu'à
 * « Classer », puis revient le vendredi suivant.
 */

const KEY = "sid-rapport-semaine-v1";
const TZ = "Europe/Paris";

type Tile = { key: string; icon: IconName; value: string; label: string; href: string; tone: "up" | "down" | "info" };
type Report = { start: Date; end: Date; tiles: Tile[]; topGain: string | null };

/** Écart (ms) entre l'heure de Paris et l'heure UTC à l'instant t. */
function parisOffset(t: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(t));
  const g = (k: string) => Number(parts.find((p) => p.type === k)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - t;
}

/** Le dernier vendredi 18 h (Paris) déjà passé. */
function lastFridayEvening(now = Date.now()) {
  const local = new Date(now + parisOffset(now));
  const back = (local.getUTCDay() - 5 + 7) % 7;
  const at = (days: number) => {
    const guess = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - days, 18);
    return guess - parisOffset(guess);
  };
  const t = at(back);
  return new Date(t <= now ? t : at(back + 7));
}

function filedPeriod(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString("fr-FR");

const dayFmt = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

export function SinceLastVisit({ userId }: { userId: string }) {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    const end = lastFridayEvening();
    if (filedPeriod() === end.toISOString()) return;
    const start = new Date(end.getTime() - 7 * 86_400_000);
    const iso = start.toISOString();
    const until = end.toISOString();
    const sb = createClient();
    let alive = true;
    Promise.allSettled([
      sb.from("transactions").select("amount, reason").eq("user_id", userId).gt("created_at", iso).lte("created_at", until).limit(2000),
      sb.from("reputation_events").select("delta").eq("user_id", userId).gt("created_at", iso).lte("created_at", until),
      sb
        .from("user_titles")
        .select("title_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .or(`and(obtained_at.gt."${iso}",obtained_at.lte."${until}"),and(upgraded_at.gt."${iso}",upgraded_at.lte."${until}")`),
      sb.from("quests").select("id", { count: "exact", head: true }).eq("status", "open").gt("created_at", iso).lte("created_at", until),
      sb.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").neq("id", userId).gt("created_at", iso).lte("created_at", until),
      sb.from("shop_items").select("id", { count: "exact", head: true }).eq("is_active", true).is("hidden_at", null).gt("created_at", iso).lte("created_at", until),
    ]).then(([tx, rep, titles, quests, members, items]) => {
      if (!alive) return;
      const tiles: Tile[] = [];
      let topGain: string | null = null;
      if (tx.status === "fulfilled" && tx.value.data?.length) {
        // Une réforme monétaire change l'échelle, ce n'est ni un gain ni une dépense.
        const rows = (tx.value.data as { amount: number; reason: string }[]).filter((r) => !r.reason?.startsWith("Réforme monétaire"));
        const gain = rows.filter((r) => Number(r.amount) > 0).reduce((a, r) => a + Number(r.amount), 0);
        const spent = rows.filter((r) => Number(r.amount) < 0).reduce((a, r) => a + Number(r.amount), 0);
        if (gain > 0) tiles.push({ key: "gain", icon: "moneyBag", value: `+${fmt(gain)} z`, label: "gagnés", href: "/dashboard/bank", tone: "up" });
        if (spent < 0) tiles.push({ key: "spent", icon: "moneyFly", value: `−${fmt(spent)} z`, label: "dépensés", href: "/dashboard/bank", tone: "down" });
        const best = rows.filter((r) => Number(r.amount) > 0).sort((a, b) => Number(b.amount) - Number(a.amount))[0];
        if (best) topGain = `${best.reason} (+${fmt(Number(best.amount))} z)`;
      }
      if (rep.status === "fulfilled" && rep.value.data?.length) {
        const d = (rep.value.data as { delta: number }[]).reduce((a, r) => a + r.delta, 0);
        if (d !== 0)
          tiles.push({ key: "rep", icon: d > 0 ? "medal" : "warning", value: `${d > 0 ? "+" : "−"}${fmt(d)}`, label: "de renommée", href: "/dashboard/profile", tone: d > 0 ? "up" : "down" });
      }
      const count = (r: PromiseSettledResult<{ count: number | null }>) => (r.status === "fulfilled" ? r.value.count ?? 0 : 0);
      const t = count(titles as PromiseSettledResult<{ count: number | null }>);
      if (t) tiles.push({ key: "titles", icon: "crown", value: String(t), label: t > 1 ? "titres gagnés" : "titre gagné", href: "/dashboard/titles", tone: "up" });
      const q = count(quests as PromiseSettledResult<{ count: number | null }>);
      if (q) tiles.push({ key: "quests", icon: "scroll", value: String(q), label: q > 1 ? "nouvelles quêtes" : "nouvelle quête", href: "/dashboard/quests", tone: "info" });
      const m = count(members as PromiseSettledResult<{ count: number | null }>);
      if (m) tiles.push({ key: "members", icon: "hello", value: String(m), label: m > 1 ? "nouveaux agents" : "nouvel agent", href: "/dashboard/members", tone: "info" });
      const o = count(items as PromiseSettledResult<{ count: number | null }>);
      if (o) tiles.push({ key: "items", icon: "store", value: String(o), label: o > 1 ? "objets au Comptoir" : "objet au Comptoir", href: "/dashboard/shop", tone: "info" });
      if (tiles.length) setReport({ start, end, tiles, topGain });
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!report) return null;

  function file() {
    try {
      localStorage.setItem(KEY, report!.end.toISOString());
    } catch {
      /* stockage indisponible : le rapport reviendra à la prochaine visite */
    }
    setReport(null);
  }

  return (
    <section className="visit-report glass-card" aria-labelledby="visite-titre">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-red">Rapport de la semaine</p>
          <h2 id="visite-titre" className="font-display text-xl uppercase tracking-wide">
            Ta semaine <span className="text-paper/65">· du {dayFmt(report.start)} au {dayFmt(report.end)}</span>
          </h2>
        </div>
        <button type="button" onClick={file} className="font-mono text-[11px] uppercase tracking-wide text-paper/70 hover:text-paper hover:underline">
          Classer le rapport
        </button>
      </div>
      <ul className="visit-tiles">
        {report.tiles.map((t, i) => (
          <li key={t.key} style={{ animationDelay: `${i * 70}ms` }}>
            <Link href={t.href} scroll={false} className={`visit-tile is-${t.tone}`}>
              <SidIcon name={t.icon} size={22} />
              <span className="visit-value">{t.value}</span>
              <span className="visit-label">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      {report.topGain && (
        <p className="font-body text-sm text-paper/75">
          <SidIcon name="sparkle" size={14} /> Plus belle rentrée de la semaine : {report.topGain}
        </p>
      )}
    </section>
  );
}
