"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { PermissionKey, Profile } from "@/types/database";
import { ACTION_LABELS, POWER_NAMES, SANCTION_LABELS, describe } from "@/lib/auditLabels";
import { ALERT_KINDS, SEVERITY, describeAlert, timeAgo, type AlertRow } from "@/lib/alerts";
import { Glyph, GlyphText } from "@/components/icons/SidIcon";

type Summary = {
  profil: Profile & { member_rank: string; power_score: number; is_muted: boolean; last_seen_at: string | null };
  email: string | null;
  solde: number;
  banque: number;
  roles: string[];
  stats: { intelligence: number; strength: number; technique: number } | null;
  sanctions_actives: number;
  messages_24h: number;
  messages_7j: number;
  visites_30j: number;
  jours_actifs_30j: number;
  entrees_7j: number;
  sorties_7j: number;
  quetes_en_cours: number;
  quetes_validees: number;
  simulations_7j: number;
  alertes_ouvertes: number;
  compte_test: { expires_at: string; permissions: string[] } | null;
  demande_suppression: { id: number; created_at: string; reason: string | null } | null;
};

type TimelineRow = {
  at: string;
  source: string;
  action: string;
  label: string | null;
  details: Record<string, unknown> | null;
  amount: number | null;
  actor: string | null;
};

const SOURCES: { key: string; label: string; icon: string }[] = [
  { key: "all", label: "Tout", icon: "•" },
  { key: "admin", label: "Administration", icon: "🛡️" },
  { key: "alerte", label: "Alertes", icon: "🚨" },
  { key: "argent", label: "Argent", icon: "💰" },
  { key: "boutique", label: "Boutique", icon: "🛒" },
  { key: "quete", label: "Quêtes", icon: "📜" },
  { key: "simulation", label: "Simulations", icon: "🎮" },
  { key: "messages", label: "Messages", icon: "💬" },
  { key: "visite", label: "Visites", icon: "👣" },
  { key: "sanction", label: "Sanctions", icon: "⚖️" },
  { key: "puissance", label: "Puissance", icon: "💪" },
  { key: "techno", label: "Arbre techno", icon: "🌳" },
  { key: "raid", label: "Raids", icon: "🐉" },
  { key: "titre", label: "Titres", icon: "🏅" },
  { key: "troll", label: "Farces", icon: "🎭" },
];
const ICON = Object.fromEntries(SOURCES.map((s) => [s.key, s.icon]));

const SIM_LABELS: Record<string, string> = { donjons: "Donjons", intelligence: "Intelligence", techniques: "Techniques" };
const SIM_STATUS: Record<string, string> = { success: "réussie", failure: "échouée", started: "commencée", abandoned: "abandonnée", expired: "expirée" };
const QUEST_STATUS: Record<string, string> = { assigned: "en cours", submitted: "rendue", validated: "validée", rejected: "refusée" };

const z = (n: unknown) => `${Number(n ?? 0).toLocaleString("fr-FR")} z`;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR")} z`;
const dateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

function describeRow(r: TimelineRow): string {
  const d = r.details ?? {};
  switch (r.source) {
    case "admin": {
      const what = ACTION_LABELS[r.action] ?? r.action;
      const extra = describe({ action: r.action, details: d });
      return [what, r.label, extra].filter(Boolean).join(" — ");
    }
    case "argent":
      return r.label || "Mouvement d'argent";
    case "boutique":
      return `Achat : ${r.label ?? "objet"}`;
    case "quete":
      return r.action === "creation" ? `A créé la quête « ${r.label} »` : `Quête « ${r.label} » — ${QUEST_STATUS[String(d.statut)] ?? d.statut}`;
    case "simulation":
      return `${SIM_LABELS[r.action] ?? r.action} : partie ${SIM_STATUS[r.label ?? ""] ?? r.label}${d.points ? ` (+${d.points})` : ""}${d.duree_s != null ? ` en ${d.duree_s} s` : ""}`;
    case "messages":
      return `${d.nombre} message${Number(d.nombre) > 1 ? "s" : ""} envoyé${Number(d.nombre) > 1 ? "s" : ""} dans ${d.salons} salon${Number(d.salons) > 1 ? "s" : ""} ce jour-là`;
    case "visite":
      return `${d.nombre} visite${Number(d.nombre) > 1 ? "s" : ""} ce jour-là`;
    case "sanction":
      return `Sanction : ${SANCTION_LABELS[r.action] ?? r.action}${r.label ? ` — « ${r.label} »` : ""}${d.active ? " (active)" : ""}`;
    case "puissance":
      return `Puissance ${d.avant} → ${d.apres}`;
    case "techno":
      return `Arbre technologique : ${r.action} niveau ${d.niveau} (${d.cout} pts)`;
    case "raid":
      return "A rejoint un raid de boss";
    case "alerte":
      return `Alerte : ${r.label ?? ALERT_KINDS[r.action] ?? r.action}`;
    case "titre":
      return `Titre obtenu : ${r.label}${Number(d.niveau) > 1 ? ` (niveau ${d.niveau})` : ""}`;
    case "troll":
      return `Farce « ${POWER_NAMES[r.action] ?? r.action} » : ${r.label ?? ""}${d.annulee ? " (arrêtée)" : ""}`;
    default:
      return r.label ?? r.action;
  }
}

export default function MemberAdminPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [permissions, setPermissions] = useState<Set<PermissionKey> | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [days, setDays] = useState(30);
  const [source, setSource] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (d = days) => {
      const [{ data: s, error }, { data: t }, { data: a }] = await Promise.all([
        supabase.rpc("admin_member_summary", { p_user: params.id }),
        supabase.rpc("admin_member_timeline", { p_user: params.id, p_days: d, p_limit: 800 }),
        supabase.rpc("list_activity_alerts", { p_status: "all", p_user: params.id, p_limit: 50 }),
      ]);
      if (error) {
        setMessage(error.message.includes("admin_member_summary") ? "Pas encore disponible : la migration 0060 doit être lancée sur la base." : error.message);
        return;
      }
      setSummary(s as Summary);
      setTimeline((t ?? []) as TimelineRow[]);
      setAlerts((a ?? []) as AlertRow[]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.id]
  );

  useEffect(() => {
    (async () => {
      const { permissions } = await loadCurrentUser();
      setPermissions(permissions);
      if (can(permissions, "manage_users")) await load(30);
    })();
  }, [load]);

  if (!permissions) return <p className="font-body text-paper/60">Chargement…</p>;
  if (!can(permissions, "manage_users")) return <p className="font-body text-paper/60">Réservé à la gestion des comptes.</p>;
  if (message && !summary) return <p className="font-mono text-sm text-red">{message}</p>;
  if (!summary) return <p className="font-body text-paper/60">Chargement de la fiche…</p>;
  if (!summary.profil) return <p className="font-body text-paper/60">Ce compte n&apos;existe pas (ou plus).</p>;

  const p = summary.profil;

  async function update(fields: Partial<Profile>, done: string) {
    setBusy("update");
    setMessage(null);
    const { error } = await supabase.from("profiles").update(fields).eq("id", p.id);
    setBusy(null);
    setMessage(error ? `Échec : ${error.message}` : done);
    if (!error) load();
  }

  async function resetPassword() {
    if (!confirm(`Générer un nouveau mot de passe temporaire pour ${p.nickname} ?`)) return;
    setBusy("pwd");
    const res = await fetch("/api/admin/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: p.id }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    setMessage(res.ok ? `Nouveau mot de passe temporaire : ${data.tempPassword} — communique-le au membre.` : `Échec : ${data.error ?? res.statusText}`);
  }

  async function deleteAccount() {
    if (!confirm(`Supprimer définitivement le compte de ${p.nickname}, comme il l'a demandé ? Son dossier, ses messages et son activité seront effacés sur les trois sites.`)) return;
    setBusy("delete");
    const res = await fetch("/api/admin/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: p.id }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage(`Échec : ${data.error ?? res.statusText}`);
      return;
    }
    router.push("/dashboard/admin/users");
  }

  async function refuseDeletion() {
    const note = prompt("Pourquoi refuser ? (le membre verra ce message)");
    if (note === null) return;
    const { error } = await supabase.rpc("refuse_account_deletion", { p_user: p.id, p_note: note });
    setMessage(error ? `Échec : ${error.message}` : "Demande refusée.");
    load();
  }

  async function setAlert(a: AlertRow, status: AlertRow["status"]) {
    await supabase.rpc("set_alert_status", { p_id: a.id, p_status: status });
    load();
  }

  const shown = source === "all" ? timeline : timeline.filter((r) => r.source === source);
  const presentSources = new Set(timeline.map((r) => r.source));
  const openAlerts = alerts.filter((a) => a.status === "open");

  const badge = (text: string, cls = "border-white/20 text-paper/70") => (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${cls}`}><GlyphText text={text} /></span>
  );
  const btn = "rounded-lg border px-3 py-1.5 font-mono text-xs uppercase disabled:opacity-40";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {p.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-paper-dark font-display text-2xl text-ink">{p.nickname.slice(0, 1).toUpperCase()}</div>
        )}
        <div className="min-w-[12rem] flex-1 space-y-1">
          <h1 className="font-display text-2xl uppercase tracking-wide text-red">{p.nickname}</h1>
          <div className="flex flex-wrap gap-1">
            {badge(p.status === "active" ? "actif" : p.status === "banned" ? "banni" : p.status === "pending" ? "en attente" : "refusé", p.status === "active" ? "border-blue/60 text-blue-light" : "border-red text-red")}
            {badge(`rang ${p.member_rank}`)}
            {p.is_founder && badge("fondateur", "border-red/60 text-red")}
            {p.is_muted && badge("muet", "border-red/60 text-red")}
            {p.is_invisible && badge("👻 invisible")}
            {summary.compte_test && badge("🧪 compte de test", "border-yellow-400/70 text-yellow-300")}
            {summary.roles.map((r) => badge(r, "border-white/30 text-paper"))}
          </div>
          <p className="font-mono text-xs text-paper/60">
            {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"} · {summary.email ?? "email inconnu"} · inscrit le{" "}
            {new Date(p.created_at).toLocaleDateString("fr-FR")} · dernière visite : {p.last_seen_at ? timeAgo(p.last_seen_at) : "jamais"}
            {p.terms_version ? ` · CGU acceptées (${p.terms_version})` : " · CGU pas encore acceptées"}
          </p>
        </div>
      </div>

      {message && <p className="rounded-lg bg-blue/10 px-3 py-2 font-mono text-xs text-blue-light">{message}</p>}

      {summary.demande_suppression && (
        <div className="glass-card space-y-2 border-red/50 p-4">
          <p className="font-display uppercase text-red">Demande de suppression du compte</p>
          <p className="font-body text-sm text-paper/80">
            Envoyée {timeAgo(summary.demande_suppression.created_at)}
            {summary.demande_suppression.reason ? ` — « ${summary.demande_suppression.reason} »` : ""}. À traiter sous 30 jours.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={deleteAccount} disabled={busy !== null || p.is_founder} className={`${btn} border-red text-red hover:bg-red hover:text-ink`}>
              {busy === "delete" ? "Suppression…" : "Supprimer le compte"}
            </button>
            <button onClick={refuseDeletion} disabled={busy !== null} className={`${btn} border-white/30 text-paper hover:bg-white/10`}>
              Refuser la demande
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Solde", z(summary.solde)],
          ["Banque", z(summary.banque)],
          ["Entrées / sorties 7 j", `${signed(Number(summary.entrees_7j))} / ${signed(Number(summary.sorties_7j))}`],
          ["Puissance", Number(p.power_score ?? 0).toLocaleString("fr-FR")],
          ["Messages 24 h / 7 j", `${summary.messages_24h} / ${summary.messages_7j}`],
          ["Visites 30 j", `${summary.visites_30j} (${summary.jours_actifs_30j} j)`],
          ["Quêtes en cours / validées", `${summary.quetes_en_cours} / ${summary.quetes_validees}`],
          ["Simulations 7 j", String(summary.simulations_7j)],
          ["Sanctions actives", String(summary.sanctions_actives)],
          ["Alertes ouvertes", String(summary.alertes_ouvertes)],
        ].map(([k, v]) => (
          <div key={k} className="glass-card space-y-1 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-paper/50">{k}</p>
            <p className="font-display text-lg">{v}</p>
          </div>
        ))}
      </div>

      <div className="glass-card space-y-3 p-4">
        <p className="font-mono text-xs uppercase tracking-wide text-paper/60">Actions</p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy !== null || p.is_founder}
            onClick={() => (p.status === "banned" || confirm(`Bannir ${p.nickname} ?`)) && update({ status: p.status === "banned" ? "active" : "banned" }, p.status === "banned" ? "Compte débanni." : "Compte banni.")}
            className={`${btn} border-red text-red hover:bg-red hover:text-ink`}
          >
            {p.status === "banned" ? "Débannir" : "Bannir"}
          </button>
          <button disabled={busy !== null} onClick={() => update({ is_muted: !p.is_muted } as Partial<Profile>, p.is_muted ? "Membre démuté." : "Membre rendu muet.")} className={`${btn} border-blue text-blue hover:bg-blue hover:text-ink`}>
            {p.is_muted ? "Démute" : "Mute"}
          </button>
          {!summary.compte_test && (
            <button disabled={busy !== null} onClick={() => update({ is_invisible: !p.is_invisible }, p.is_invisible ? "Compte visible." : "Compte invisible.")} className={`${btn} border-white/30 text-paper hover:bg-white/10`}>
              {p.is_invisible ? "Rendre visible" : "Rendre invisible"}
            </button>
          )}
          <button disabled={busy !== null} onClick={resetPassword} className={`${btn} border-white/30 text-paper hover:bg-white/10`}>
            {busy === "pwd" ? "…" : "Réinitialiser le mot de passe"}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
          <Link href={`/dashboard/profile/${p.id}`} className="text-blue-light underline">Dossier public</Link>
          <Link href="/dashboard/admin/economy" className="text-blue-light underline">Solde et salaires</Link>
          <Link href="/dashboard/admin/roles" className="text-blue-light underline">Rôles et niveaux</Link>
          <Link href="/dashboard/admin/moderation" className="text-blue-light underline">Sanctions</Link>
          <Link href="/dashboard/admin/audit" className="text-blue-light underline">Journal d&apos;audit complet</Link>
        </div>
      </div>

      {openAlerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display text-lg uppercase">Alertes à traiter</h2>
          {openAlerts.map((a) => (
            <div key={a.id} className="glass-card flex flex-wrap items-center gap-3 p-3">
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${SEVERITY[a.severity].className}`}>{SEVERITY[a.severity].label}</span>
              <div className="min-w-[12rem] flex-1">
                <p className="font-body text-sm">{a.title}</p>
                <p className="font-mono text-[11px] text-paper/50">{timeAgo(a.created_at)} · {describeAlert(a.details)}</p>
              </div>
              <button onClick={() => setAlert(a, "resolved")} className={`${btn} border-blue text-blue hover:bg-blue hover:text-ink`}>✓ Traitée</button>
              <button onClick={() => setAlert(a, "ignored")} className={`${btn} border-white/20 text-paper/70 hover:bg-white/10`}>Ignorer</button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-display text-lg uppercase">Journal d&apos;activité</h2>
          <select
            value={days}
            onChange={(e) => {
              const d = Number(e.target.value);
              setDays(d);
              load(d);
            }}
            className="rounded-lg border border-white/15 bg-ink px-2 py-1 font-mono text-xs text-paper"
          >
            {[7, 30, 90, 365].map((d) => (
              <option key={d} value={d}>{d} derniers jours</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1">
          {SOURCES.filter((s) => s.key === "all" || presentSources.has(s.key)).map((s) => (
            <button
              key={s.key}
              onClick={() => setSource(s.key)}
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${source === s.key ? "border-blue bg-blue text-ink" : "border-white/15 text-paper/70 hover:bg-white/10"}`}
            >
              <Glyph e={s.icon} /> {s.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-paper/40">
          Les messages ne sont comptés que par jour : leur contenu n&apos;apparaît jamais ici.
        </p>
        {shown.length === 0 ? (
          <p className="font-body text-sm text-paper/60">Aucune activité sur cette période.</p>
        ) : (
          <ol className="glass-card divide-y divide-white/5">
            {shown.map((r, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2">
                <span className="w-28 shrink-0 font-mono text-[11px] text-paper/50">{dateTime(r.at)}</span>
                <span className="w-5 shrink-0 text-center" aria-hidden>{ICON[r.source] ? <Glyph e={ICON[r.source]} /> : "•"}</span>
                <span className="min-w-[12rem] flex-1 font-body text-sm text-paper/90">
                  {describeRow(r)}
                  {r.actor && r.source !== "alerte" && r.source !== "troll" && <span className="font-mono text-[11px] text-paper/50"> · par {r.actor}</span>}
                </span>
                {r.amount != null && Number(r.amount) !== 0 && (
                  <span className={`font-mono text-xs ${Number(r.amount) > 0 ? "text-blue-light" : "text-red"}`}>{signed(Number(r.amount))}</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
