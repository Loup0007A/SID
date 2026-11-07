"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LineChart } from "@/components/LineChart";
import { SidIcon, type IconName } from "@/components/icons/SidIcon";
import { entryForPath } from "@/lib/navigation";

/**
 * Engagement (Lot 72, migration 0089) : fréquentation, rétention, temps passé.
 * get_admin_stats_engagement().
 */

type Rate = { n: number; ok: number };
type Engagement = {
  since: string | null;
  members: number;
  dau: number;
  wau: number;
  mau: number;
  dau_avg_30: number | null;
  new_7: number;
  new_30: number;
  returned_7: number;
  daily: { day: string; active: number; new: number }[];
  retention: { d1: Rate; d7: Rate; d30: Rate };
  cohorts: { week: string; size: number; weeks: (number | null)[] }[];
  churn: { base: number; lost: number };
  at_risk: { nickname: string; last_day: string; days: number }[];
  frequency: { label: string; n: number }[];
  time: {
    sessions_7: number;
    members_7: number;
    hours_7: number;
    avg_session: number | null;
    median_session: number | null;
    avg_day_member: number | null;
    sessions_day_member: number | null;
    idle_share: number | null;
    pages_per_session: number | null;
    buckets: { label: string; n: number }[];
    daily: { day: string; minutes_member: number | null; hours: number }[];
    pages: { page: string; seconds: number; views: number; avg: number | null }[];
    heat: { dow: number; hour: number; seconds: number }[];
    devices: { device: string; sessions: number; seconds: number }[];
    top: { nickname: string; seconds: number }[];
  };
};

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DOW_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DOW_FULL = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const DEVICE: Record<string, string> = { mobile: "Téléphone", tablette: "Tablette", ordinateur: "Ordinateur", inconnu: "Inconnu" };

const fmtDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)} %` : "—");

/** 45 → « 45 s », 754 → « 12 min », 3900 → « 1 h 05 ». */
function dur(s: number | null | undefined) {
  if (s == null || !Number.isFinite(Number(s))) return "—";
  const v = Math.round(Number(s));
  if (v < 60) return `${v} s`;
  if (v < 3600) return `${Math.round(v / 60)} min`;
  const h = Math.floor(v / 3600);
  const m = Math.round((v % 3600) / 60);
  return `${h} h ${String(m).padStart(2, "0")}`;
}

function pageLabel(path: string) {
  if (path === "/dashboard") return "Accueil";
  return entryForPath(path)?.label ?? path.replace("/dashboard/", "");
}

function Tile({ label, value, hint, tone = "text-blue-light" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">{label}</p>
      <p className={`font-display text-2xl ${tone}`}>{value}</p>
      {hint && <p className="font-mono text-[10px] text-paper/50">{hint}</p>}
    </div>
  );
}

function Bars({ rows, format }: { rows: { label: string; n: number; extra?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (rows.length === 0) return <p className="font-body text-sm text-paper/55">Rien sur la période.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(6rem,38%)_1fr_auto] items-center gap-2 font-body text-sm">
          <span className="truncate text-paper/80">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-white/5">
            <span className="block h-full rounded-full bg-blue/70" style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="text-right font-mono text-xs text-paper/70">
            {format ? format(r.n) : r.n.toLocaleString("fr-FR")}
            {r.extra && <span className="block text-[10px] text-paper/45">{r.extra}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Card({ icon, title, children, note }: { icon: IconName; title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="glass-card space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg uppercase">
          <SidIcon name={icon} /> {title}
        </h2>
        {note && <span className="font-mono text-[10px] uppercase tracking-wide text-paper/50">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper/60">{children}</h3>;
}

export function StatsEngagement() {
  const supabase = useMemo(() => createClient(), []);
  const [e, setE] = useState<Engagement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cell, setCell] = useState<{ dow: number; hour: number } | null>(null);

  useEffect(() => {
    supabase.rpc("get_admin_stats_engagement").then(({ data, error }) => {
      if (error) setError(error.message.includes("get_admin_stats_engagement") ? "Rétention et temps passé : la migration 0089 doit être lancée." : error.message);
      else setE(data as Engagement);
    });
  }, [supabase]);

  const heat = useMemo(() => new Map((e?.time.heat ?? []).map((h) => [`${h.dow}-${h.hour}`, Number(h.seconds)])), [e]);
  const heatMax = useMemo(() => Math.max(1, ...(e?.time.heat ?? []).map((h) => Number(h.seconds))), [e]);

  if (error) return <p className="font-mono text-xs text-paper/60">{error}</p>;
  if (!e) return <p className="font-mono text-xs text-paper/60">Calcul de la rétention et du temps passé…</p>;

  const t = e.time;
  const r = e.retention;
  const stick = e.mau > 0 && e.dau_avg_30 != null ? Number(e.dau_avg_30) / e.mau : null;
  const timed = t.daily.filter((d) => d.minutes_member != null);
  const totalDevice = t.devices.reduce((s, d) => s + Number(d.seconds), 0);
  const since = e.since ? new Date(e.since).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : null;
  const cellSec = cell ? heat.get(`${cell.dow}-${cell.hour}`) ?? 0 : 0;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ Fréquentation */}
      <Card icon="people" title="Fréquentation">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label="Aujourd'hui" value={String(e.dau)} hint="membres venus" />
          <Tile label="7 derniers jours" value={String(e.wau)} hint={pct(e.wau, e.members) + " des membres"} />
          <Tile label="30 derniers jours" value={String(e.mau)} hint={pct(e.mau, e.members) + " des membres"} />
          <Tile
            label="Fidélité"
            value={stick == null ? "—" : `${Math.round(stick * 100)} %`}
            hint="des actifs du mois, présents un jour donné"
            tone={stick != null && stick >= 0.3 ? "text-green-300" : "text-blue-light"}
          />
          <Tile label="Nouveaux" value={String(e.new_7)} hint={`7 j · ${e.new_30} sur 30 j`} />
          <Tile label="Retours" value={String(e.returned_7)} hint="après un mois d'absence (7 j)" />
        </div>
        <LineChart
          labels={e.daily.map((d) => fmtDay(d.day))}
          series={[
            { name: "Membres venus", color: "#8FB3D9", values: e.daily.map((d) => d.active) },
            { name: "Inscriptions", color: "#f0c27a", values: e.daily.map((d) => d.new) },
          ]}
          zeroBased
          height={200}
        />
      </Card>

      {/* ------------------------------------------------------------ Rétention */}
      <Card icon="medal" title="Rétention" note="sur tout l'historique des visites">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["Revenus le lendemain", r.d1, "de l'inscription"],
            ["Revenus la 2e semaine", r.d7, "jours 7 à 13 après l'inscription"],
            ["Revenus le 2e mois", r.d30, "jours 30 à 59 après l'inscription"],
          ].map(([label, v, hint]) => {
            const rate = v as Rate;
            return (
              <div key={label as string} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">{label as string}</p>
                <p className="font-display text-4xl text-[#f0c27a]">{pct(rate.ok, rate.n)}</p>
                <p className="font-mono text-[10px] text-paper/50">
                  {rate.n > 0 ? `${rate.ok} sur ${rate.n} membres` : "pas encore assez d'inscrits"} · {hint as string}
                </p>
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <Sub>Cohortes : % des inscrits d&apos;une semaine revenus les semaines suivantes</Sub>
          {e.cohorts.length === 0 ? (
            <p className="font-body text-sm text-paper/55">Pas d&apos;inscription sur les 10 dernières semaines.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-separate border-spacing-[3px] font-mono text-[11px]">
                <thead>
                  <tr className="text-paper/55">
                    <th className="w-px whitespace-nowrap pr-3 text-left font-normal">Semaine du</th>
                    <th className="w-px pr-2 font-normal">Inscrits</th>
                    {Array.from({ length: 8 }, (_, i) => (
                      <th key={i} className="font-normal">
                        S+{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {e.cohorts.map((c) => (
                    <tr key={c.week}>
                      <td className="whitespace-nowrap text-paper/80">{fmtDay(c.week)}</td>
                      <td className="text-center text-paper/70">{c.size}</td>
                      {c.weeks.map((v, i) => (
                        <td
                          key={i}
                          className="rounded text-center"
                          style={{ background: v == null ? "transparent" : `rgba(240, 194, 122, ${0.08 + (v / 100) * 0.75})`, color: v != null && v >= 55 ? "#262A38" : undefined }}
                          title={v == null ? "Semaine pas encore commencée" : `${v} % revenus la semaine ${i + 1} après leur inscription`}
                        >
                          {v == null ? "" : `${v}`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-2">
            <Sub>Membres perdus</Sub>
            <p className="font-display text-3xl text-red-light">{pct(e.churn.lost, e.churn.base)}</p>
            <p className="font-body text-sm text-paper/70">
              {e.churn.lost} des {e.churn.base} membres venus il y a 30 à 60 jours ne sont pas revenus ce mois-ci.
            </p>
          </div>
          <div className="space-y-2">
            <Sub>Régularité sur 30 jours</Sub>
            <Bars rows={e.frequency.map((f) => ({ label: f.label, n: Number(f.n) }))} format={(n) => `${n} membre${n > 1 ? "s" : ""}`} />
          </div>
          <div className="space-y-2">
            <Sub>À relancer</Sub>
            {e.at_risk.length === 0 ? (
              <p className="font-body text-sm text-paper/55">Personne : les habitués sont tous revenus ces 14 derniers jours.</p>
            ) : (
              <ul className="space-y-1">
                {e.at_risk.map((m) => (
                  <li key={m.nickname} className="flex justify-between gap-2 font-body text-sm">
                    <span className="truncate text-paper/85">{m.nickname}</span>
                    <span className="shrink-0 font-mono text-[11px] text-paper/55">
                      {m.days} j actifs · vu le {fmtDay(m.last_day)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="font-body text-[11px] text-paper/45">Venus au moins 3 jours ces 60 derniers jours, plus vus depuis 14 jours.</p>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------ Temps passé */}
      <Card icon="clock" title="Temps passé" note={since ? `mesuré depuis le ${since}` : undefined}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label="Par session" value={dur(t.avg_session)} hint={`moyenne · médiane ${dur(t.median_session)}`} />
          <Tile label="Par membre et par jour" value={dur(t.avg_day_member)} hint="les jours où il vient" />
          <Tile label="Sessions par jour" value={t.sessions_day_member == null ? "—" : Number(t.sessions_day_member).toLocaleString("fr-FR")} hint="par membre venu" />
          <Tile label="Pages par session" value={t.pages_per_session == null ? "—" : Number(t.pages_per_session).toLocaleString("fr-FR")} />
          <Tile label="Cumul sur 7 jours" value={`${Number(t.hours_7).toLocaleString("fr-FR")} h`} hint={`${t.sessions_7} sessions · ${t.members_7} membres`} />
          <Tile label="Onglet ouvert, absent" value={t.idle_share == null ? "—" : `${Math.round(Number(t.idle_share) * 100)} %`} hint="du temps connecté, non compté" tone="text-paper/80" />
        </div>
        <p className="font-body text-xs text-paper/55">
          Temps actif : le site est affiché et le membre a cliqué ou tapé dans les 5 dernières minutes. Une session s&apos;arrête après 10 minutes sans signal.
        </p>

        {timed.length >= 2 && (
          <div className="space-y-2">
            <Sub>Minutes par membre venu, chaque jour</Sub>
            <LineChart
              labels={timed.map((d) => fmtDay(d.day))}
              series={[{ name: "Minutes par membre", color: "#f0c27a", values: timed.map((d) => Number(d.minutes_member)) }]}
              zeroBased
              height={180}
              formatValue={(n) => `${n.toLocaleString("fr-FR")} min`}
            />
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Sub>Pages où l&apos;on reste (30 j)</Sub>
            <Bars rows={t.pages.map((p) => ({ label: pageLabel(p.page), n: Number(p.seconds), extra: p.avg != null ? `${dur(p.avg)} par visite` : undefined }))} format={(n) => dur(n)} />
          </div>
          <div className="space-y-2">
            <Sub>Durée des sessions (30 j)</Sub>
            <Bars rows={t.buckets.map((b) => ({ label: b.label, n: Number(b.n) }))} format={(n) => `${n} session${n > 1 ? "s" : ""}`} />
            <Sub>Appareils</Sub>
            <ul className="space-y-1">
              {t.devices.map((d) => (
                <li key={d.device} className="flex items-center justify-between gap-2 font-body text-sm">
                  <span className="text-paper/85">{DEVICE[d.device] ?? d.device}</span>
                  <span className="font-mono text-[11px] text-paper/60">
                    {totalDevice > 0 ? `${Math.round((100 * Number(d.seconds)) / totalDevice)} % du temps` : "—"} · {d.sessions} session{d.sessions > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-2">
            <Sub>Quand on vient (temps actif, 30 j)</Sub>
            <p className="min-h-[1.25rem] font-mono text-xs text-blue-light">
              {cell ? `${DOW_FULL[cell.dow]} de ${cell.hour}h à ${(cell.hour + 1) % 24}h : ${dur(cellSec)}` : "Survole ou touche une case."}
            </p>
            <div className="overflow-x-auto" onMouseLeave={() => setCell(null)}>
              <div className="inline-grid grid-cols-[auto_repeat(24,minmax(14px,1fr))] gap-[2px]">
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="text-center font-mono text-[8px] text-paper/65">
                    {h % 3 === 0 ? h : ""}
                  </div>
                ))}
                {DOW_ORDER.map((dow) => (
                  <Fragment key={dow}>
                    <div className="pr-2 font-mono text-[9px] text-paper/65">{DOW_SHORT[dow]}</div>
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const s = heat.get(`${dow}-${hour}`) ?? 0;
                      return (
                        <div
                          key={`${dow}-${hour}`}
                          role="button"
                          tabIndex={0}
                          aria-label={`${DOW_FULL[dow]} ${hour}h : ${dur(s)}`}
                          onMouseEnter={() => setCell({ dow, hour })}
                          onFocus={() => setCell({ dow, hour })}
                          onClick={() => setCell({ dow, hour })}
                          className={`aspect-square cursor-pointer rounded-sm ${cell?.dow === dow && cell?.hour === hour ? "ring-2 ring-paper" : ""}`}
                          style={{ backgroundColor: `rgba(240, 194, 122, ${0.06 + (s / heatMax) * 0.85})` }}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Sub>Les plus présents (7 j)</Sub>
            {t.top.length === 0 ? (
              <p className="font-body text-sm text-paper/55">Pas encore de mesure.</p>
            ) : (
              <ol className="space-y-1">
                {t.top.map((m, i) => (
                  <li key={m.nickname} className="flex justify-between gap-2 font-body text-sm">
                    <span className="truncate text-paper/85">
                      <span className="font-mono text-[11px] text-paper/45">{i + 1}.</span> {m.nickname}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-paper/60">{dur(m.seconds)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
