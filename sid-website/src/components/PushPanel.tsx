"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import {
  getPushPermission,
  hasActivePushSubscription,
  isIos,
  isPushSupported,
  isStandaloneDisplay,
  needsIosInstallFirst,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Notifications push (Lot 64) : état de cet appareil, activation, tests et
 * diagnostic. Le test direct passe par /api/push/test (site → appareil) ; le
 * test complet crée une vraie notification (base → pg_net → site → appareil).
 */

type TestResult = {
  config?: Record<string, boolean>;
  error?: string;
  detail?: string;
  results: { host: string; ok: boolean; status: number | null; message?: string }[];
};
type Diag = {
  error?: string;
  pg_net: boolean;
  site_url: string | null;
  secret_set: boolean;
  subscriptions: number;
  subscribers: number;
  recent: { status: number | null; error: string | null; timed_out: boolean | null; body: string; at: string }[];
};

const SERVICE: Record<string, string> = {
  "fcm.googleapis.com": "Chrome / Android",
  "updates.push.services.mozilla.com": "Firefox",
  "web.push.apple.com": "iPhone / Safari",
  "wns2-par02p.notify.windows.com": "Edge",
};

function explainStatus(status: number | null, message?: string) {
  if (status === 403 && /BadJwtToken|jwt|VAPID/i.test(message ?? "")) return "Refusé : la clé VAPID ou son adresse de contact (VAPID_SUBJECT) est invalide.";
  if (status === 403) return "Refusé par le service : les clés VAPID ne correspondent pas à celles de l'abonnement. Désactive puis réactive.";
  if (status === 404 || status === 410) return "Abonnement expiré : il a été retiré. Réactive les notifications.";
  if (status === 413) return "Message trop long.";
  if (status === 429) return "Trop d'envois : réessaie dans un moment.";
  if (status == null) return `Envoi impossible${message ? ` (${message})` : ""}.`;
  return `Erreur ${status}${message ? ` : ${message}` : ""}.`;
}

function explainWebhook(status: number | null, body: string, error: string | null, timedOut: boolean | null) {
  if (timedOut) return "Le site n'a pas répondu à temps.";
  if (error) return `Appel impossible : ${error}`;
  if (status === 200) return /"sent":0/.test(body) ? "Reçu, mais aucun appareil abonné pour ce membre." : "OK";
  if (status === 401) return "Secret différent : app_config.push_webhook_secret ≠ PUSH_WEBHOOK_SECRET (Vercel).";
  if (status === 404) return "Adresse introuvable : vérifie app_config.site_url.";
  if (status === 501) return "Clés VAPID absentes sur Vercel.";
  if (status && status >= 500) return "Erreur du site : vérifie SUPABASE_SERVICE_ROLE_KEY sur Vercel.";
  return `Réponse ${status ?? "?"}`;
}

function Row({ ok, label, value }: { ok: boolean | null; label: string; value: string }) {
  return (
    <li className="push-row">
      <span className={`push-dot ${ok === null ? "is-na" : ok ? "is-ok" : "is-ko"}`} aria-hidden />
      <span className="flex-1">{label}</span>
      <span className="text-paper/75">{value}</span>
    </li>
  );
}

export function PushPanel() {
  const [ready, setReady] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<string>("default");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [diag, setDiag] = useState<Diag | null>(null);

  const supported = ready && isPushSupported();
  const ios = ready && isIos();
  const installed = ready && isStandaloneDisplay();

  async function refresh() {
    setPermission(getPushPermission());
    setSubscribed(await hasActivePushSubscription().catch(() => false));
  }

  useEffect(() => {
    setReady(true);
    refresh();
    loadCurrentUser().then(({ permissions, profile }) => setIsAdmin(can(permissions, "manage_users") || !!profile?.is_founder));
  }, []);

  async function toggle() {
    setBusy("toggle");
    setMsg(null);
    setTest(null);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setMsg({ ok: true, text: "Notifications coupées sur cet appareil." });
      } else {
        await subscribeToPush();
        setMsg({ ok: true, text: "Notifications activées sur cet appareil. Envoie-toi un test pour vérifier." });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Échec." });
    }
    await refresh();
    setBusy(null);
  }

  async function sendTest() {
    setBusy("test");
    setMsg(null);
    try {
      const r = await fetch("/api/push/test", { method: "POST" });
      setTest((await r.json()) as TestResult);
    } catch {
      setTest({ error: "network", results: [] });
    }
    setBusy(null);
  }

  async function fullTest() {
    setBusy("full");
    setMsg(null);
    const { data, error } = await createClient().rpc("push_self_test");
    const code = (data as { error?: string } | null)?.error;
    setMsg(
      error || code
        ? { ok: false, text: code === "too_soon" ? "Un test par minute au plus." : "Test impossible (migration 0079 lancée ?)." }
        : { ok: true, text: "Notification créée. Elle doit arriver sur tes appareils d'ici quelques secondes ; sinon, la base ne joint pas le site (voir le diagnostic)." }
    );
    setBusy(null);
  }

  async function runDiag() {
    setBusy("diag");
    const { data, error } = await createClient().rpc("push_diagnostic");
    setDiag(error ? { error: error.message, pg_net: false, site_url: null, secret_set: false, subscriptions: 0, subscribers: 0, recent: [] } : (data as Diag));
    setBusy(null);
  }

  const configIssues = test?.config
    ? [
        !test.config.vapid_public && "NEXT_PUBLIC_VAPID_PUBLIC_KEY absente",
        !test.config.vapid_private && "VAPID_PRIVATE_KEY absente",
        !test.config.vapid_subject && "VAPID_SUBJECT absente (mets mailto:ton@adresse)",
        !test.config.webhook_secret && "PUSH_WEBHOOK_SECRET absente",
        !test.config.service_key && "SUPABASE_SERVICE_ROLE_KEY absente",
      ].filter(Boolean)
    : [];

  return (
    <div data-tuto="profil-notifs" className="glass-card space-y-4 p-6">
      <div>
        <h2 className="font-display text-lg uppercase">Notifications push</h2>
        <p className="font-body text-sm text-paper/70">Message, quête validée, arrivée à destination… même site fermé.</p>
      </div>

      <ul className="space-y-1.5" aria-label="État de cet appareil">
        <Row
          ok={supported ? true : ios && !installed ? null : false}
          label="Navigateur"
          value={supported ? "compatible" : !ready ? "…" : ios && !installed ? "après installation" : "non compatible"}
        />
        {ios && <Row ok={installed} label="App sur l'écran d'accueil" value={installed ? "oui" : "non (obligatoire sur iPhone)"} />}
        <Row
          ok={permission === "granted" ? true : permission === "denied" ? false : null}
          label="Autorisation"
          value={permission === "granted" ? "accordée" : permission === "denied" ? "bloquée" : permission === "unsupported" ? "—" : "pas encore demandée"}
        />
        <Row ok={subscribed} label="Cet appareil" value={subscribed ? "abonné" : "non abonné"} />
      </ul>

      {ready && needsIosInstallFirst() && (
        <ol className="list-decimal space-y-1 rounded-lg border border-blue/40 bg-blue/10 p-3 pl-8 font-body text-sm text-paper/85">
          <li>Dans Safari : Partager → « Sur l&apos;écran d&apos;accueil ».</li>
          <li>Ouvre S.I.D. depuis cette icône, reviens ici et active.</li>
        </ol>
      )}

      {permission === "denied" && (
        <p className="rounded-lg border border-red/40 bg-red/10 p-3 font-body text-sm text-paper/85">
          Bloquées pour ce site. {ios ? "Réglages de l'iPhone → Notifications → S.I.D." : "Clique sur le cadenas à gauche de l'adresse → Notifications → Autoriser."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={toggle}
          disabled={!supported || (ready && needsIosInstallFirst()) || busy !== null}
          className={`rounded-lg px-4 py-2 font-display text-sm uppercase disabled:opacity-40 ${
            subscribed ? "border border-red bg-transparent text-red hover:bg-red hover:text-ink" : "bg-blue text-ink hover:bg-blue-light"
          }`}
        >
          {busy === "toggle" ? "…" : subscribed ? "Désactiver ici" : "Activer sur cet appareil"}
        </button>
        {subscribed && (
          <>
            <button onClick={sendTest} disabled={busy !== null} className="rounded-lg border border-white/20 px-4 py-2 font-mono text-xs uppercase hover:border-blue disabled:opacity-40">
              {busy === "test" ? "Envoi…" : "M'envoyer un test"}
            </button>
            <button onClick={fullTest} disabled={busy !== null} className="rounded-lg border border-white/20 px-4 py-2 font-mono text-xs uppercase hover:border-blue disabled:opacity-40">
              {busy === "full" ? "…" : "Test complet"}
            </button>
          </>
        )}
      </div>

      {msg && <p className={`font-body text-sm ${msg.ok ? "text-[#b9e3c6]" : "text-red"}`}>{msg.text}</p>}

      {test && (
        <div className="space-y-1.5 rounded-lg bg-black/20 p-3 font-body text-sm" aria-live="polite">
          {test.error === "vapid_missing" && <p className="text-red">Clés VAPID absentes sur Vercel : aucun push ne peut partir.</p>}
          {test.error === "no_subscription" && <p className="text-red">Le serveur ne connaît aucun appareil pour toi : désactive puis réactive.</p>}
          {test.error === "network" && <p className="text-red">Le site ne répond pas.</p>}
          {test.error === "read_failed" && <p className="text-red">Lecture des abonnements impossible : {test.detail}</p>}
          {test.results.map((r, i) => (
            <p key={i}>
              <SidIcon name={r.ok ? "check" : "cross"} /> {SERVICE[r.host] ?? r.host} :{" "}
              {r.ok ? <span className="text-[#b9e3c6]">envoyé — la notification doit apparaître.</span> : <span className="text-red">{explainStatus(r.status, r.message)}</span>}
            </p>
          ))}
          {configIssues.length > 0 && <p className="text-paper/75">Réglages Vercel à compléter : {configIssues.join(" · ")}.</p>}
          {test.results.some((r) => r.ok) && (
            <p className="text-paper/70">Envoyé mais rien reçu ? Sur ordinateur, vérifie que les notifications du navigateur sont autorisées par le système (et le mode Ne pas déranger).</p>
          )}
        </div>
      )}

      {isAdmin && (
        <details className="rounded-lg border border-white/10 p-3" onToggle={(e) => (e.target as HTMLDetailsElement).open && !diag && runDiag()}>
          <summary className="cursor-pointer font-mono text-xs uppercase text-paper/80">Diagnostic serveur (admins)</summary>
          {!diag ? (
            <p className="mt-2 font-mono text-xs text-paper/65">…</p>
          ) : diag.error ? (
            <p className="mt-2 font-body text-sm text-red">{diag.error === "forbidden" ? "Réservé aux admins." : `Indisponible (migration 0079 ?) : ${diag.error}`}</p>
          ) : (
            <div className="mt-2 space-y-2">
              <ul className="space-y-1.5">
                <Row ok={diag.pg_net} label="Extension pg_net (Supabase)" value={diag.pg_net ? "active" : "absente : Database → Extensions → pg_net"} />
                <Row ok={!!diag.site_url} label="app_config.site_url" value={diag.site_url ?? "vide"} />
                <Row ok={diag.secret_set} label="app_config.push_webhook_secret" value={diag.secret_set ? "renseigné" : "vide"} />
                <Row ok={diag.subscriptions > 0} label="Appareils abonnés" value={`${diag.subscriptions} (${diag.subscribers} membre${diag.subscribers > 1 ? "s" : ""})`} />
              </ul>
              {diag.recent.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-paper/65">Derniers appels de la base au site</p>
                  <ul className="mt-1 space-y-1 font-body text-xs">
                    {diag.recent.map((r, i) => (
                      <li key={i}>
                        <span className="font-mono text-paper/65">{new Date(r.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span> ·{" "}
                        <span className={r.status === 200 ? "text-[#b9e3c6]" : "text-red"}>{explainWebhook(r.status, r.body, r.error, r.timed_out)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button onClick={runDiag} disabled={busy !== null} className="font-mono text-[11px] uppercase text-blue-light underline">
                Actualiser
              </button>
            </div>
          )}
        </details>
      )}
    </div>
  );
}
