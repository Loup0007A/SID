"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LineChart } from "@/components/LineChart";
import { SidIcon, type IconName } from "@/components/icons/SidIcon";
import { ALERT_KINDS } from "@/lib/alerts";

/** Statistiques supplémentaires (Lot 66) : get_admin_stats_more(), migration 0081. */

type More = {
  membres: { actifs: number; nouveaux_7j: number; nouveaux_30j: number; visiteurs_7j: number; visiteurs_30j: number; endormis: number };
  semaines: { week_start: string; nouveaux: number; visiteurs: number }[];
  richesse: { total: number; mediane: number | null; part_top10: number | null; negatifs: number; plus_riches: { nickname: string; balance: number }[] };
  flux: { motif: string; entrees: number | null; sorties: number | null; mouvements: number }[];
  encheres: { en_cours: number; vendues_30j: number; invendues_30j: number; volume_30j: number; offres_moy: number | null };
  sondages: { ouverts: number; programmes: number; participation: number | null };
  alertes: { ouvertes: number; creees_30j: number; classees_seules_30j: number; exceptions: number; par_genre: { kind: string; n: number }[] };
  notifications: { envoyees_7j: number; non_lues: number; par_type: { type: string; n: number }[] };
  cadeaux: { cadeaux_30j: number; valeur_30j: number; souhaits: number; plus_souhaites: { name: string; n: number }[] };
  mariages: { unions: number; demandes: number; public: boolean };
};

const NOTIF_LABELS: Record<string, string> = {
  chat_message: "Messages",
  quest_validated: "Quêtes validées",
  quest_failed: "Quêtes échouées",
  quest_report: "Rapports de mission",
  application_decision: "Candidatures",
  quest_confirmation_needed: "Quêtes à confirmer",
  travel_arrived: "Trajets",
  salary_paid: "Salaires",
  money_received: "Argent reçu",
  raid_call: "Raids",
  admin_alert: "Alertes admin",
  sanction: "Sanctions",
  announcement: "Annonces",
  title: "Titres",
  troll: "Farces",
  business: "Entreprises",
  auction: "Enchères",
  poll: "Sondages",
  gift: "Cadeaux",
  wishlist: "Souhaits",
  wedding: "Mariages",
  push_test: "Tests push",
};

const n = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 }));
const z = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(Number(v)).toLocaleString("fr-FR")} z`);
const fmtDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">{label}</p>
      <p className="font-display text-xl text-blue-light">{value}</p>
      {hint && <p className="font-mono text-[10px] text-paper/50">{hint}</p>}
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (rows.length === 0) return <p className="font-body text-sm text-paper/55">Rien sur la période.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(7rem,40%)_1fr_auto] items-center gap-2 font-body text-sm">
          <span className="truncate text-paper/80">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-white/5">
            <span className="block h-full rounded-full bg-blue/70" style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="font-mono text-xs text-paper/70">{n(r.n)}</span>
        </li>
      ))}
    </ul>
  );
}

function Card({ icon, title, children, href }: { icon: IconName; title: string; children: React.ReactNode; href?: string }) {
  return (
    <section className="glass-card space-y-3 p-5">
      <h2 className="flex items-center justify-between gap-2 font-display text-lg uppercase">
        <span>
          <SidIcon name={icon} /> {title}
        </span>
        {href && (
          <Link href={href} className="font-mono text-[10px] uppercase tracking-wide text-blue hover:underline">
            Ouvrir →
          </Link>
        )}
      </h2>
      {children}
    </section>
  );
}

export function StatsMore() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<More | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_admin_stats_more").then(({ data, error }) => {
      if (error) setError(error.message.includes("get_admin_stats_more") ? "Statistiques détaillées : la migration 0081 doit être lancée." : error.message);
      else setData(data as More);
    });
  }, [supabase]);

  if (error) return <p className="font-mono text-xs text-paper/60">{error}</p>;
  if (!data) return <p className="font-mono text-xs text-paper/60">Chargement des statistiques détaillées…</p>;

  const m = data.membres;
  const w = data.richesse;
  const flux = data.flux;
  const fluxMax = Math.max(1, ...flux.map((f) => Math.max(Number(f.entrees ?? 0), Number(f.sorties ?? 0))));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card icon="people" title="Membres">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile label="Actifs" value={n(m.actifs)} />
            <Tile label="Nouveaux" value={n(m.nouveaux_7j)} hint={`${n(m.nouveaux_30j)} sur 30 j`} />
            <Tile label="Venus cette semaine" value={n(m.visiteurs_7j)} hint={`${n(m.visiteurs_30j)} sur 30 j`} />
            <Tile label="Endormis" value={n(m.endormis)} hint="absents depuis 30 j" />
            <Tile
              label="Fidélité"
              value={m.actifs ? `${Math.round((100 * m.visiteurs_30j) / m.actifs)} %` : "—"}
              hint="actifs venus sur 30 j"
            />
          </div>
          <LineChart
            labels={data.semaines.map((s) => `Sem. ${fmtDay(s.week_start)}`)}
            series={[
              { name: "Visiteurs", color: "#8FB3D9", values: data.semaines.map((s) => s.visiteurs) },
              { name: "Nouveaux", color: "#D99A9A", values: data.semaines.map((s) => s.nouveaux) },
            ]}
            zeroBased
            height={180}
          />
        </Card>

        <Card icon="moneyBag" title="Richesse" href="/dashboard/admin/economy">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="En bourse" value={z(w.total)} />
            <Tile label="Solde médian" value={z(w.mediane)} />
            <Tile label="Aux 10 % plus riches" value={w.part_top10 == null ? "—" : `${n(w.part_top10)} %`} />
            <Tile label="Soldes négatifs" value={n(w.negatifs)} />
          </div>
          <ol className="space-y-1">
            {w.plus_riches.map((r, i) => (
              <li key={r.nickname + i} className="flex items-center justify-between gap-3 font-body text-sm">
                <span>
                  <span className="mr-2 font-mono text-xs text-paper/50">{i + 1}.</span>
                  {r.nickname}
                </span>
                <span className="font-mono text-xs text-blue-light">{z(r.balance)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card icon="moneyFly" title="D'où vient l'argent (30 jours)">
        {flux.length === 0 ? (
          <p className="font-body text-sm text-paper/55">Aucun mouvement.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] font-body text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-paper/55">
                  <th className="py-1 pr-3 font-normal">Motif</th>
                  <th className="py-1 pr-3 font-normal">Entrées</th>
                  <th className="py-1 pr-3 font-normal">Sorties</th>
                  <th className="py-1 text-right font-normal">Mouv.</th>
                </tr>
              </thead>
              <tbody>
                {flux.map((f) => (
                  <tr key={f.motif} className="border-t border-white/5">
                    <td className="max-w-[16rem] truncate py-1.5 pr-3 text-paper/85">{f.motif}</td>
                    <td className="py-1.5 pr-3">
                      {f.entrees ? (
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 rounded-full bg-green-400/70" style={{ width: `${(Number(f.entrees) / fluxMax) * 6}rem` }} />
                          <span className="font-mono text-xs text-green-300">+{z(f.entrees)}</span>
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3">
                      {f.sorties ? (
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 rounded-full bg-red/70" style={{ width: `${(Number(f.sorties) / fluxMax) * 6}rem` }} />
                          <span className="font-mono text-xs text-red-light">−{z(f.sorties)}</span>
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs text-paper/60">{n(f.mouvements)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card icon="gavel" title="Enchères" href="/dashboard/shop?onglet=encheres">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="En cours" value={n(data.encheres.en_cours)} />
            <Tile label="Vendues (30 j)" value={n(data.encheres.vendues_30j)} hint={`${n(data.encheres.invendues_30j)} sans offre`} />
            <Tile label="Volume (30 j)" value={z(data.encheres.volume_30j)} />
            <Tile label="Offres par vente" value={n(data.encheres.offres_moy)} />
          </div>
        </Card>

        <Card icon="ballot" title="Sondages" href="/dashboard/polls">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Ouverts" value={n(data.sondages.ouverts)} />
            <Tile label="Programmés" value={n(data.sondages.programmes)} />
            <Tile label="Participation" value={data.sondages.participation == null ? "—" : `${n(data.sondages.participation)} %`} hint="10 derniers sondages" />
          </div>
        </Card>

        <Card icon="gift" title="Cadeaux et souhaits">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Cadeaux (30 j)" value={n(data.cadeaux.cadeaux_30j)} hint={z(data.cadeaux.valeur_30j)} />
            <Tile label="Souhaits" value={n(data.cadeaux.souhaits)} />
          </div>
          <Bars rows={data.cadeaux.plus_souhaites.map((r) => ({ label: r.name, n: r.n }))} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card icon="siren" title="Alertes" href="/dashboard/admin/alerts">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="À traiter" value={n(data.alertes.ouvertes)} />
            <Tile label="Créées (30 j)" value={n(data.alertes.creees_30j)} />
            <Tile label="Classées seules" value={n(data.alertes.classees_seules_30j)} hint="par une exception" />
            <Tile label="Exceptions" value={n(data.alertes.exceptions)} />
          </div>
          <Bars rows={data.alertes.par_genre.map((r) => ({ label: ALERT_KINDS[r.kind] ?? r.kind, n: r.n }))} />
        </Card>

        <Card icon="bell" title="Notifications (7 jours)">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Envoyées" value={n(data.notifications.envoyees_7j)} />
            <Tile label="Non lues" value={n(data.notifications.non_lues)} />
          </div>
          <Bars rows={data.notifications.par_type.map((r) => ({ label: NOTIF_LABELS[r.type] ?? r.type, n: r.n }))} />
        </Card>

        <Card icon="rings" title="Mariages" href="/dashboard/mariage">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Unions" value={n(data.mariages.unions)} />
            <Tile label="Demandes" value={n(data.mariages.demandes)} />
          </div>
          <p className="font-mono text-[11px] text-paper/60">Page {data.mariages.public ? "visible par tous" : "réservée aux admins"}.</p>
        </Card>
      </div>
    </div>
  );
}
