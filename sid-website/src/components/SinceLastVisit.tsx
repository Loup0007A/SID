"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";

/**
 * « Depuis ta dernière visite » (Lot 59) : un petit rapport en haut de
 * l'accueil. Argent gagné ou dépensé, renommée, titres, nouvelles quêtes,
 * nouveaux agents, nouveautés du Comptoir.
 *
 * La « dernière visite » est gardée sur l'appareil : une visite commence
 * après 45 minutes sans ouvrir l'accueil. Pendant la visite, le rapport reste
 * le même (on peut revenir à l'accueil sans le perdre) jusqu'à « Classer ».
 */

const KEY = "sid-visite-v1";
const GAP = 45 * 60_000;
const MAX_BACK = 30 * 86_400_000;

type Stored = { since: string | null; seen: string };
type Tile = { key: string; icon: IconName; value: string; label: string; href: string; tone: "up" | "down" | "info" };
type Report = { since: Date; tiles: Tile[]; topGain: string | null };

function readStore(): Stored | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}
function writeStore(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible : le rapport ne s'affichera pas */
  }
}

/** Repère de la visite en cours (null : première visite sur cet appareil). */
function visitStart(): Date | null {
  const now = Date.now();
  const st = readStore();
  if (!st) {
    writeStore({ since: null, seen: new Date(now).toISOString() });
    return null;
  }
  const seen = new Date(st.seen).getTime();
  const since = now - seen > GAP ? seen : st.since ? new Date(st.since).getTime() : null;
  writeStore({ since: since ? new Date(since).toISOString() : null, seen: new Date(now).toISOString() });
  return since ? new Date(Math.max(since, now - MAX_BACK)) : null;
}

const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString("fr-FR");

function ago(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? "hier" : `il y a ${j} jours`;
}

export function SinceLastVisit({ userId }: { userId: string }) {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    const since = visitStart();
    if (!since) return;
    const iso = since.toISOString();
    const sb = createClient();
    let alive = true;
    Promise.allSettled([
      sb.from("transactions").select("amount, reason").eq("user_id", userId).gt("created_at", iso).limit(1000),
      sb.from("reputation_events").select("delta").eq("user_id", userId).gt("created_at", iso),
      sb.from("user_titles").select("title_id", { count: "exact", head: true }).eq("user_id", userId).or(`obtained_at.gt."${iso}",upgraded_at.gt."${iso}"`),
      sb.from("quests").select("id", { count: "exact", head: true }).eq("status", "open").gt("created_at", iso),
      sb.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").neq("id", userId).gt("created_at", iso),
      sb.from("shop_items").select("id", { count: "exact", head: true }).eq("is_active", true).is("hidden_at", null).gt("created_at", iso),
    ]).then(([tx, rep, titles, quests, members, items]) => {
      if (!alive) return;
      const tiles: Tile[] = [];
      let topGain: string | null = null;
      if (tx.status === "fulfilled" && tx.value.data?.length) {
        const rows = tx.value.data as { amount: number; reason: string }[];
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
      if (tiles.length) setReport({ since, tiles, topGain });
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!report) return null;

  function file() {
    writeStore({ since: null, seen: new Date().toISOString() });
    setReport(null);
  }

  return (
    <section className="visit-report glass-card" aria-labelledby="visite-titre">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-red">Rapport de situation</p>
          <h2 id="visite-titre" className="font-display text-xl uppercase tracking-wide">
            Depuis ta dernière visite <span className="text-paper/65">· {ago(report.since)}</span>
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
          <SidIcon name="sparkle" size={14} /> Plus belle rentrée : {report.topGain}
        </p>
      )}
    </section>
  );
}
