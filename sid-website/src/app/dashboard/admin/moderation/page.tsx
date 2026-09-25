"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import type { Announcement, AnnouncementSeverity, MaintenanceFlag, SanctionType, SanctionView } from "@/types/admin";
import { inputClass, labelClass } from "@/lib/ui";
import clsx from "clsx";

const SECTION_LABELS: Record<string, string> = {
  shop: "Boutique",
  chat: "Messagerie",
  bank: "Banque & Bourse",
  quests: "Quêtes",
  registrations: "Nouvelles candidatures",
};

const SANCTION_LABELS: Record<SanctionType, string> = {
  warning: "Avertissement",
  mute: "Mute",
  freeze: "Geler le compte",
  ban: "Bannir",
  fine: "Amende",
};

const SEVERITY_LABELS: Record<AnnouncementSeverity, string> = {
  info: "Information",
  warning: "Avertissement",
  critical: "Critique",
};

export default function ModerationPage() {
  const supabase = createClient();
  const [message, setMessage] = useState<string | null>(null);

  // Annonces
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annForm, setAnnForm] = useState({ title: "", body: "", severity: "info" as AnnouncementSeverity });

  // Maintenance
  const [flags, setFlags] = useState<MaintenanceFlag[]>([]);
  const [flagMessages, setFlagMessages] = useState<Record<string, string>>({});

  // Sanctions
  const [members, setMembers] = useState<Profile[]>([]);
  const [sanctions, setSanctions] = useState<SanctionView[]>([]);
  const [sanctionForm, setSanctionForm] = useState({
    userId: "",
    type: "warning" as SanctionType,
    reason: "",
    amount: "",
    durationMinutes: "",
  });

  async function refreshAnnouncements() {
    const { data } = await supabase.rpc("list_all_announcements");
    setAnnouncements((data ?? []) as Announcement[]);
  }
  async function refreshFlags() {
    const { data } = await supabase.rpc("list_maintenance_flags");
    setFlags((data ?? []) as MaintenanceFlag[]);
  }
  async function refreshSanctions() {
    const { data } = await supabase.rpc("list_all_sanctions");
    setSanctions((data ?? []) as SanctionView[]);
  }

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from("profiles").select("*").eq("status", "active").order("nickname");
      setMembers(m ?? []);
      await Promise.all([refreshAnnouncements(), refreshFlags(), refreshSanctions()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!annForm.title.trim()) return;
    const { error } = await supabase.rpc("create_announcement", {
      p_title: annForm.title,
      p_body: annForm.body,
      p_severity: annForm.severity,
    });
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setAnnForm({ title: "", body: "", severity: "info" });
    await refreshAnnouncements();
  }

  async function deactivateAnnouncement(id: string) {
    const { error } = await supabase.rpc("deactivate_announcement", { p_id: id });
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    await refreshAnnouncements();
  }

  async function toggleFlag(flag: MaintenanceFlag) {
    const { error } = await supabase.rpc("set_maintenance", {
      p_key: flag.key,
      p_enabled: !flag.is_enabled,
      p_message: flagMessages[flag.key] ?? null,
    });
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    await refreshFlags();
  }

  async function issueSanction(e: React.FormEvent) {
    e.preventDefault();
    if (!sanctionForm.userId) {
      setMessage("Choisis un membre.");
      return;
    }
    const { error } = await supabase.rpc("issue_sanction", {
      p_user_id: sanctionForm.userId,
      p_type: sanctionForm.type,
      p_reason: sanctionForm.reason || null,
      p_amount: sanctionForm.type === "fine" ? Number(sanctionForm.amount) || 0 : null,
      p_duration_minutes: sanctionForm.durationMinutes ? Number(sanctionForm.durationMinutes) : null,
    });
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage("Sanction appliquée.");
    setSanctionForm({ userId: "", type: "warning", reason: "", amount: "", durationMinutes: "" });
    await refreshSanctions();
  }

  async function liftSanction(id: string) {
    if (!confirm("Lever cette sanction maintenant ?")) return;
    const { error } = await supabase.rpc("lift_sanction", { p_id: id });
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    await refreshSanctions();
  }

  return (
    <div className="space-y-10">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Modération</h1>
      {message && <p className="font-mono text-sm text-red">{message}</p>}

      {/* Annonces */}
      <section className="space-y-4">
        <h2 className="font-display text-lg uppercase text-paper">Annonces à la connexion</h2>
        <p className="font-body text-sm text-paper/60">
          Affichées à chaque membre tant qu&apos;il n&apos;a pas cliqué sur « J&apos;ai compris ».
        </p>
        <form onSubmit={createAnnouncement} className="glass-card space-y-3 p-4">
          <div className="space-y-1">
            <label className={labelClass}>Titre</label>
            <input required className={inputClass} value={annForm.title} onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Message</label>
            <textarea rows={3} className={inputClass} value={annForm.body} onChange={(e) => setAnnForm((f) => ({ ...f, body: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Niveau</label>
            <select
              className={inputClass}
              value={annForm.severity}
              onChange={(e) => setAnnForm((f) => ({ ...f, severity: e.target.value as AnnouncementSeverity }))}
            >
              {(Object.keys(SEVERITY_LABELS) as AnnouncementSeverity[]).map((s) => (
                <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <button className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light">
            Publier l&apos;annonce
          </button>
        </form>

        <div className="space-y-2">
          {announcements.map((a) => (
            <div key={a.id} className="glass-card flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="font-display uppercase">
                  {a.title} {!a.is_active && <span className="text-paper/40">(désactivée)</span>}
                </p>
                <p className="font-mono text-xs text-paper/50">{SEVERITY_LABELS[a.severity]} · {new Date(a.created_at).toLocaleString("fr-FR")}</p>
              </div>
              {a.is_active && (
                <button onClick={() => deactivateAnnouncement(a.id)} className="rounded-lg border border-red px-3 py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink">
                  Désactiver
                </button>
              )}
            </div>
          ))}
          {announcements.length === 0 && <p className="font-body text-sm text-paper/60">Aucune annonce.</p>}
        </div>
      </section>

      {/* Maintenance */}
      <section className="space-y-4">
        <h2 className="font-display text-lg uppercase text-paper">Suspendre une section du site</h2>
        <p className="font-body text-sm text-paper/60">
          Désactiver une section bloque les actions correspondantes côté serveur (pas seulement l&apos;affichage).
        </p>
        <div className="space-y-2">
          {flags.map((f) => (
            <div key={f.key} className="glass-card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[10rem] flex-1">
                <p className="font-display uppercase">{SECTION_LABELS[f.key] ?? f.key}</p>
                <span className={clsx("font-mono text-xs uppercase", f.is_enabled ? "text-blue-light" : "text-red")}>
                  {f.is_enabled ? "Active" : "Suspendue"}
                </span>
              </div>
              <input
                placeholder="Message affiché aux membres"
                className={`${inputClass} flex-[2]`}
                defaultValue={f.message ?? ""}
                onChange={(e) => setFlagMessages((m) => ({ ...m, [f.key]: e.target.value }))}
              />
              <button
                onClick={() => toggleFlag(f)}
                className={clsx(
                  "rounded-lg px-4 py-2 font-mono text-xs uppercase",
                  f.is_enabled ? "border border-red text-red hover:bg-red hover:text-ink" : "bg-blue text-ink hover:bg-blue-light"
                )}
              >
                {f.is_enabled ? "Suspendre" : "Réactiver"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Sanctions */}
      <section className="space-y-4">
        <h2 className="font-display text-lg uppercase text-paper">Sanctions</h2>
        <p className="font-body text-sm text-paper/60">
          Au-delà du bannir/mute rapides (page Administration) : gel de compte (bloque achats, bourse, emprunt,
          quêtes), amende, et durée limitée optionnelle (la sanction est levée automatiquement à l&apos;échéance).
        </p>

        <form onSubmit={issueSanction} className="glass-card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClass}>Membre</label>
            <select className={inputClass} value={sanctionForm.userId} onChange={(e) => setSanctionForm((f) => ({ ...f, userId: e.target.value }))}>
              <option value="">Choisir…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.nickname}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Type</label>
            <select className={inputClass} value={sanctionForm.type} onChange={(e) => setSanctionForm((f) => ({ ...f, type: e.target.value as SanctionType }))}>
              {(Object.keys(SANCTION_LABELS) as SanctionType[]).map((t) => (
                <option key={t} value={t}>{SANCTION_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Raison</label>
            <input className={inputClass} value={sanctionForm.reason} onChange={(e) => setSanctionForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>
          {sanctionForm.type === "fine" && (
            <div className="space-y-1">
              <label className={labelClass}>Montant de l&apos;amende</label>
              <input type="number" min={0} className={inputClass} value={sanctionForm.amount} onChange={(e) => setSanctionForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
          )}
          <div className="space-y-1">
            <label className={labelClass}>Durée en minutes (vide = définitif)</label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={sanctionForm.durationMinutes}
              onChange={(e) => setSanctionForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              placeholder="Ex : 1440 pour 24h"
            />
          </div>
          <button className="rounded-lg sm:col-span-2 bg-red py-2 font-display uppercase text-ink hover:bg-red-light">
            Appliquer la sanction
          </button>
        </form>

        <div className="space-y-2">
          {sanctions.map((s) => (
            <div key={s.id} className="glass-card flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="font-display uppercase">
                  {SANCTION_LABELS[s.type]} — {s.nickname} {!s.is_active && <span className="text-paper/40">(terminée)</span>}
                </p>
                <p className="font-mono text-xs text-paper/50">
                  {s.reason || "Aucune raison précisée"}
                  {s.amount != null && ` · ${s.amount.toLocaleString("fr-FR")} Cr.`}
                  {s.expires_at && ` · jusqu'au ${new Date(s.expires_at).toLocaleString("fr-FR")}`}
                  {s.issued_by_nickname && ` · par ${s.issued_by_nickname}`}
                </p>
              </div>
              {s.is_active && s.type !== "warning" && s.type !== "fine" && (
                <button onClick={() => liftSanction(s.id)} className="rounded-lg border border-blue px-3 py-1 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink">
                  Lever maintenant
                </button>
              )}
            </div>
          ))}
          {sanctions.length === 0 && <p className="font-body text-sm text-paper/60">Aucune sanction émise.</p>}
        </div>
      </section>
    </div>
  );
}
