"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { PermissionKey, Profile } from "@/types/database";
import { inputClass, labelClass, buttonPrimary, buttonGhostBlue, buttonGhostRed, buttonOutline } from "@/lib/ui";
import { ALL_PERMISSIONS, PERMISSION_LABELS, enterSandbox, timeLeft } from "@/lib/sandbox";

type SandboxRow = {
  user_id: string;
  nickname: string;
  email: string;
  permissions: PermissionKey[];
  member_rank: string;
  expires_at: string;
  expired: boolean;
  created_at: string;
  created_by_nickname: string | null;
};

type Credentials = { userId: string; nickname: string; email: string; password: string };

const DURATIONS = [
  { hours: 1, label: "1 heure" },
  { hours: 6, label: "6 heures" },
  { hours: 24, label: "24 heures" },
  { hours: 72, label: "3 jours" },
  { hours: 168, label: "7 jours" },
];

async function api(body: object) {
  const res = await fetch("/api/admin/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export default function SandboxPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [rows, setRows] = useState<SandboxRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ nickname: "", perms: new Set<PermissionKey>(), hours: 24, rank: "E", balance: "1000" });

  async function refresh() {
    const { data, error } = await supabase.rpc("list_sandbox_accounts");
    if (error) {
      setMessage(error.message.includes("list_sandbox_accounts") ? "Fonction pas encore activée : la migration 0059 doit être lancée sur la base." : error.message);
      return;
    }
    setRows((data ?? []) as SandboxRow[]);
  }

  useEffect(() => {
    (async () => {
      const { profile, permissions } = await loadCurrentUser();
      setMe(profile);
      setPermissions(permissions);
      if (!profile || profile.sandbox_expires_at || !can(permissions, "manage_users")) return;
      // Les comptes de test expirés sont effacés à l'ouverture de la page.
      try {
        const r = await api({ action: "cleanup" });
        if (r.removed > 0) setMessage(`${r.removed} compte${r.removed > 1 ? "s" : ""} de test expiré${r.removed > 1 ? "s" : ""} effacé${r.removed > 1 ? "s" : ""}.`);
      } catch {
        // la liste dira ce qui ne va pas
      }
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!me) return <p className="font-body text-paper/60">Chargement…</p>;
  if (me.sandbox_expires_at) {
    return <p className="font-body text-paper/60">Tu navigues avec un compte de test : il ne peut pas créer d&apos;autres comptes de test. Utilise le bandeau en haut pour revenir à ton compte.</p>;
  }
  if (!can(permissions, "manage_users")) {
    return <p className="font-body text-paper/60">Le bac à sable est réservé à la gestion des comptes.</p>;
  }

  const grantable = ALL_PERMISSIONS.filter((p) => permissions.has(p));

  function togglePerm(p: PermissionKey, on: boolean) {
    setForm((f) => {
      const perms = new Set(f.perms);
      if (on) perms.add(p);
      else perms.delete(p);
      return { ...f, perms };
    });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setMessage(null);
    setCreds(null);
    try {
      const r = await api({ action: "create", nickname: form.nickname, permissions: Array.from(form.perms), hours: form.hours, rank: form.rank, balance: Number(form.balance) });
      setCreds({ userId: r.userId, nickname: r.nickname, email: r.email, password: r.password });
      setForm((f) => ({ ...f, nickname: "" }));
      await refresh();
    } catch (err) {
      setMessage(`Échec : ${err instanceof Error ? err.message : "erreur"}`);
    } finally {
      setBusy(null);
    }
  }

  async function credentialsFor(row: SandboxRow): Promise<Credentials | null> {
    try {
      const r = await api({ action: "login", userId: row.user_id });
      return { userId: row.user_id, nickname: row.nickname, email: r.email, password: r.password };
    } catch (err) {
      setMessage(`Échec : ${err instanceof Error ? err.message : "erreur"}`);
      return null;
    }
  }

  async function enter(c: Credentials) {
    setBusy(`enter:${c.userId}`);
    const err = await enterSandbox(c.email, c.password, me?.nickname);
    if (err) {
      setMessage(`Connexion au compte de test impossible : ${err}`);
      setBusy(null);
    }
  }

  async function enterRow(row: SandboxRow) {
    setBusy(`enter:${row.user_id}`);
    const c = await credentialsFor(row);
    if (c) await enter(c);
    else setBusy(null);
  }

  async function showCreds(row: SandboxRow) {
    setBusy(`creds:${row.user_id}`);
    const c = await credentialsFor(row);
    if (c) setCreds(c);
    setBusy(null);
  }

  async function remove(row: SandboxRow) {
    if (!confirm(`Effacer le compte de test « ${row.nickname} » et tout ce qu'il a créé (quêtes, messages, entreprises…) ?`)) return;
    setBusy(`del:${row.user_id}`);
    setMessage(null);
    try {
      await api({ action: "delete", userId: row.user_id });
      setMessage(`« ${row.nickname} » a été effacé.`);
      if (creds?.userId === row.user_id) setCreds(null);
      await refresh();
    } catch (err) {
      setMessage(`Échec : ${err instanceof Error ? err.message : "erreur"}`);
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!creds) return;
    try {
      await navigator.clipboard.writeText(`Email : ${creds.email}\nMot de passe : ${creds.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // presse-papiers indisponible : les identifiants restent affichés
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Bac à sable</h1>
        <p className="font-body text-sm text-paper/70">
          Crée un compte de test temporaire avec les permissions de ton choix, puis navigue sur le site avec lui pour
          vérifier ce qu&apos;un membre voit et peut faire. Le compte est actif tout de suite et invisible des autres
          membres. Il agit sur le vrai site : à son expiration (ou quand tu le supprimes), il est effacé avec tout ce
          qu&apos;il a créé.
        </p>
      </div>

      {message && <p className="rounded-lg bg-red/10 px-3 py-2 font-mono text-xs text-red">{message}</p>}

      {creds && (
        <div className="glass-card space-y-3 border-blue/40 p-5">
          <h2 className="font-display text-lg uppercase">🧪 {creds.nickname}</h2>
          <div className="grid gap-1 font-mono text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <span className="text-paper/60">Email</span>
            <span className="break-all select-all">{creds.email}</span>
            <span className="text-paper/60">Mot de passe</span>
            <span className="break-all select-all">{creds.password}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => enter(creds)} disabled={busy !== null} className={buttonPrimary}>
              {busy === `enter:${creds.userId}` ? "Connexion…" : "Entrer dans le bac à sable"}
            </button>
            <button onClick={copy} className={buttonOutline}>
              {copied ? "Copié !" : "Copier les identifiants"}
            </button>
          </div>
          <p className="font-mono text-[11px] text-paper/50">
            « Entrer » ouvre le compte de test dans ce navigateur ; un bandeau permet ensuite de revenir à ton compte.
            Pour garder ta session d&apos;admin ouverte à côté, colle plutôt ces identifiants dans une fenêtre de
            navigation privée ou un autre appareil.
          </p>
        </div>
      )}

      <form onSubmit={create} className="glass-card space-y-4 p-6">
        <h2 className="font-display text-lg uppercase">Nouveau compte de test</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClass}>Surnom (facultatif)</label>
            <input className={inputClass} placeholder="Testeur-XXXX" maxLength={40} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Durée</label>
            <select className={inputClass} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })}>
              {DURATIONS.map((d) => (
                <option key={d.hours} value={d.hours}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Rang</label>
            <select className={inputClass} value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })}>
              {["E", "D", "C", "B", "A", "S"].map((r) => (
                <option key={r} value={r}>Rang {r}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Zénis de départ</label>
            <input type="number" min={0} max={1000000} className={inputClass} value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <p className={labelClass}>Permissions données au compte de test</p>
          {grantable.length === 0 ? (
            <p className="font-body text-sm text-paper/60">Tu n&apos;as aucune permission à transmettre : le compte sera un simple membre.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {grantable.map((p) => (
                <label key={p} className="flex items-center gap-2 font-mono text-xs">
                  <input type="checkbox" className="accent-blue" checked={form.perms.has(p)} onChange={(e) => togglePerm(p, e.target.checked)} />
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
            </div>
          )}
          <p className="font-mono text-[11px] text-paper/50">
            Sans permission cochée, c&apos;est un simple membre. Tu ne peux donner que les permissions que tu as toi-même.
            {form.perms.has("manage_users") && (
              <span className="block text-red">
                ⚠ Avec « Gestion des comptes », le compte de test pourra agir sur les vrais comptes (bannir, muter, mots de passe…).
              </span>
            )}
          </p>
        </div>

        <button type="submit" disabled={busy !== null} className={buttonPrimary}>
          {busy === "create" ? "Création…" : "Créer le compte de test"}
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="font-display text-lg uppercase">Comptes de test en cours</h2>
        {rows.length === 0 && <p className="font-body text-sm text-paper/60">Aucun compte de test pour l&apos;instant.</p>}
        {rows.map((r) => (
          <div key={r.user_id} className="glass-card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <p className="font-display uppercase">
                🧪 {r.nickname} <span className="font-mono text-xs normal-case text-paper/60">· rang {r.member_rank}</span>
              </p>
              <p className="font-mono text-xs text-paper/60">
                {r.expired ? <span className="text-red">Expiré</span> : <>Expire dans {timeLeft(r.expires_at)}</>}
                {r.created_by_nickname && <> · créé par {r.created_by_nickname}</>}
              </p>
              <p className="font-mono text-[11px] text-paper/50">
                {r.permissions.length ? r.permissions.map((p) => PERMISSION_LABELS[p] ?? p).join(" · ") : "Simple membre"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!r.expired && (
                <>
                  <button onClick={() => enterRow(r)} disabled={busy !== null} className={buttonGhostBlue}>
                    {busy === `enter:${r.user_id}` ? "…" : "Entrer"}
                  </button>
                  <button onClick={() => showCreds(r)} disabled={busy !== null} className={buttonOutline}>
                    {busy === `creds:${r.user_id}` ? "…" : "Identifiants"}
                  </button>
                </>
              )}
              <button onClick={() => remove(r)} disabled={busy !== null} className={buttonGhostRed}>
                {busy === `del:${r.user_id}` ? "…" : "Supprimer"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
