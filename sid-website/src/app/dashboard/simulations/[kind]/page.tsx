"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { ConstructionTape } from "@/components/ConstructionTape";
import { MemberStatBars } from "@/components/MemberStatBars";
import {
  RESULT_MESSAGE_TYPE,
  SIMULATION_SITES,
  SITE_RESULT_MESSAGE_TYPE,
  STAT_LABELS,
  interpretSiteReport,
  isSimulationKind,
  siteOrigin,
} from "@/lib/simulationSites";
import type { SimulationOverview, SimulationResultResponse, SimulationRunStatus } from "@/types/simulationRuns";

const RUN_STATUS_LABELS: Record<SimulationRunStatus, string> = {
  started: "En cours",
  success: "Réussie",
  failure: "Échouée",
  abandoned: "Abandonnée",
  expired: "Expirée",
};

/**
 * Une session = l'iframe ouverte. Elle peut enchaîner plusieurs parties :
 * après chaque résultat, une nouvelle partie est ouverte automatiquement
 * (nouveau jeton) pour que le niveau suivant compte aussi.
 *  - token     : jeton de la partie qui comptera le prochain résultat (null = plus rien ne compte aujourd'hui)
 *  - startedAt : début de cette partie (horloge de l'appareil, comme celle du site dans l'iframe)
 *  - issued    : tous les jetons donnés à cette iframe
 */
type Session = { token: string | null; iframeUrl: string; startedAt: number; issued: string[] };

type Notice = { tone: "good" | "bad" | "info"; text: string };

async function requestRun(kind: string): Promise<{ ok: true; token: string; iframeUrl: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/simulations/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Impossible de lancer la simulation." };
    return { ok: true, token: data.token, iframeUrl: data.iframe_url };
  } catch {
    return { ok: false, error: "Impossible de lancer la simulation (problème de connexion)." };
  }
}

export default function SimulationPage() {
  const params = useParams<{ kind: string }>();
  const kind = params.kind;
  const supabase = createClient();

  const [overview, setOverview] = useState<SimulationOverview | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameBoxRef = useRef<HTMLDivElement>(null);
  // Plein écran : « native » = API du navigateur ; « css » = repli quand
  // l'API n'existe pas ou est refusée (iPhone, notamment).
  const [fullscreen, setFullscreen] = useState<"native" | "css" | null>(null);
  const submitting = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const site = isSimulationKind(kind) ? SIMULATION_SITES[kind] : null;
  const origin = site ? siteOrigin(site) : null;

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_simulation_overview");
    if (error || !data) {
      setOverviewError(true);
      return;
    }
    setOverview(data as SimulationOverview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const el = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setFullscreen((prev) => (el && el === frameBoxRef.current ? "native" : prev === "native" ? null : prev));
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // Repli CSS : Échap pour sortir, et la page derrière ne défile plus.
  useEffect(() => {
    if (fullscreen !== "css") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(null);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const enterFullscreen = useCallback(async () => {
    const box = frameBoxRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
    if (!box) return;
    const request = box.requestFullscreen?.bind(box) ?? box.webkitRequestFullscreen?.bind(box);
    if (request) {
      try {
        await request();
        setFullscreen("native");
        // Donne le clavier au jeu tout de suite.
        iframeRef.current?.focus();
        return;
      } catch {
        // refusé : repli CSS ci-dessous
      }
    }
    setFullscreen("css");
    iframeRef.current?.focus();
  }, []);

  const exitFullscreen = useCallback(() => {
    const doc = document as Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element | null };
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
    setFullscreen(null);
  }, []);

  // Enregistre le résultat de la partie en cours, puis en ouvre une nouvelle
  // pour que la prochaine tentative dans la même iframe compte aussi.
  const submitResult = useCallback(
    async (success: boolean, signature?: string) => {
      const current = sessionRef.current;
      if (!site || !current?.token || submitting.current) return;
      submitting.current = true;
      const token = current.token;
      let text: string;
      let tone: Notice["tone"];
      let finished = true;
      try {
        const res = await fetch("/api/simulations/result", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(signature ? { "X-SID-Signature": signature } : {}) },
          body: JSON.stringify({ token, success }),
        });
        const data = (await res.json()) as SimulationResultResponse;
        if (data.result === "already_completed") {
          // Le site a envoyé le résultat lui-même juste avant : même bilan.
          const label = STAT_LABELS[site.factor];
          if (data.status === "success") {
            text = data.points_awarded
              ? `Simulation réussie : +${data.points_awarded} ${label}.`
              : `Simulation réussie, mais ${label} est déjà au maximum (100).`;
            tone = "good";
          } else {
            text = data.status === "failure" ? "Simulation échouée : aucun point cette fois." : "Résultat enregistré.";
            tone = "info";
          }
        } else {
          text = data.message;
          tone = data.ok && data.status === "success" ? "good" : data.ok ? "info" : "bad";
        }
        // On ne passe à une nouvelle partie que si celle-ci est réglée pour de
        // bon. « Trop tôt », erreur serveur… : la partie reste ouverte, le
        // résultat suivant pourra encore compter.
        finished = data.ok || ["already_completed", "expired", "not_found", "daily_limit"].includes(String(data.result));
      } catch {
        text = "Impossible d'enregistrer le résultat (problème de connexion).";
        tone = "bad";
        finished = false;
      }

      if (finished) {
        const next = await requestRun(site.kind);
        if (next.ok) {
          setSession((s) => (s ? { ...s, token: next.token, startedAt: Date.now(), issued: [...s.issued, next.token] } : s));
          text += " Tu peux enchaîner : la prochaine partie réussie comptera aussi.";
        } else {
          setSession((s) => (s ? { ...s, token: null } : s));
          text += ` Les prochaines parties ne compteront pas : ${next.error}`;
        }
      }
      setNotice({ tone, text });
      await refresh();
      submitting.current = false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refresh, site?.kind]
  );

  // Messages venant du site affiché dans l'iframe (et seulement de lui) :
  //  - format des sites : { type: "sid-quest-resultat", epreuve, statut, reussi, debut, … }
  //  - format générique : { type: "sid:simulation-result", token, success }
  useEffect(() => {
    if (!session || !origin || !site) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== origin || e.source !== iframeRef.current?.contentWindow) return;
      const current = sessionRef.current;
      if (!site || !current) return;
      const d = e.data as Record<string, unknown> | null;
      if (!d || typeof d !== "object") return;

      if (d.type === SITE_RESULT_MESSAGE_TYPE) {
        const verdict = interpretSiteReport(site, d, current.startedAt);
        if (verdict.action === "record") void submitResult(verdict.success);
        return;
      }
      if (d.type === RESULT_MESSAGE_TYPE && typeof d.success === "boolean" && current.issued.includes(String(d.token))) {
        void submitResult(d.success, typeof d.signature === "string" ? d.signature : undefined);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(session), origin, submitResult]);

  async function start() {
    if (!site) return;
    setStarting(true);
    setNotice(null);
    const run = await requestRun(site.kind);
    setStarting(false);
    if (!run.ok) {
      setNotice({ tone: "bad", text: run.error });
      return;
    }
    setSession({ token: run.token, iframeUrl: run.iframeUrl, startedAt: Date.now(), issued: [run.token] });
  }

  if (!site) {
    return (
      <div className="glass-card space-y-3 p-6 text-center">
        <p className="font-body text-paper/70">Cette simulation n&apos;existe pas.</p>
        <Link href="/dashboard" className="text-blue underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  const factorLabel = STAT_LABELS[site.factor];
  const doneToday = overview?.results_today?.[site.kind] ?? 0;
  const maxPerDay = overview?.max_results_per_day ?? 0;
  const limitReached = overview ? doneToday >= maxPerDay : false;
  const disabledReason = !site.url
    ? "Le site de cette simulation n'est pas encore branché au S.I.D."
    : overview && !overview.enabled
      ? "Les simulations sont temporairement fermées par l'administration."
      : limitReached
        ? `Limite du jour atteinte (${maxPerDay} résultats). Reviens demain !`
        : null;
  // Seules les parties jouées jusqu'au bout : les parties ouvertes d'avance
  // pour enchaîner (puis abandonnées ou expirées) n'intéressent personne.
  const recentRuns = (overview?.recent_runs ?? []).filter(
    (r) => r.kind === site.kind && (r.status === "success" || r.status === "failure")
  );

  return (
    <div className="space-y-6">
      {site.inDevelopment && <ConstructionTape variant="banner" label="Simulation en développement" />}

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-5xl" aria-hidden>
          {site.emoji}
        </span>
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-red">{site.label}</h1>
          <p className="font-body text-paper/70">
            {site.description} Une simulation réussie rapporte <strong>+1 {factorLabel}</strong> (100 maximum).
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
        <div
          className={clsx(
            "glass-card space-y-4 p-5",
            // backdrop-filter rendrait le repli « fixed » relatif à la carte au lieu de l'écran
            fullscreen === "css" && "![-webkit-backdrop-filter:none] ![backdrop-filter:none]"
          )}
        >
          {notice && (
            <p
              className={clsx(
                "rounded-lg border px-3 py-2 font-body text-sm",
                notice.tone === "good" && "border-blue/50 bg-blue/10 text-blue-light",
                notice.tone === "bad" && "border-red/50 bg-red/10 text-red-light",
                notice.tone === "info" && "border-white/15 bg-white/5 text-paper/80"
              )}
            >
              {notice.text}
            </p>
          )}
          {session ? (
            <>
              <div
                ref={frameBoxRef}
                className={clsx(
                  "overflow-hidden bg-black",
                  fullscreen !== "css" && "relative",
                  fullscreen === null && "rounded-lg border border-white/15",
                  fullscreen === "native" && "h-full w-full",
                  fullscreen === "css" && "fixed inset-0 z-[100] h-[100dvh] w-screen"
                )}
              >
                <iframe
                  ref={iframeRef}
                  src={session.iframeUrl}
                  title={`Simulation ${site.label}`}
                  className={clsx("block w-full", fullscreen ? "h-full" : "h-[70vh] min-h-[420px]")}
                  sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms"
                  allow="fullscreen; gamepad; autoplay"
                  allowFullScreen
                />
                {fullscreen && (
                  <button
                    onClick={exitFullscreen}
                    aria-label="Quitter le plein écran"
                    className="absolute left-1/2 top-0 -translate-x-1/2 rounded-b-md border border-t-0 border-white/20 bg-black/70 px-2 py-0.5 font-mono text-[10px] uppercase text-paper/70 opacity-70 hover:border-blue hover:text-blue hover:opacity-100"
                  >
                    ✕ Quitter
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={enterFullscreen}
                  className="rounded-lg border border-blue px-3 py-1.5 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink"
                >
                  Plein écran
                </button>
                <button
                  onClick={() => {
                    exitFullscreen();
                    setSession(null);
                    setNotice({ tone: "info", text: "Simulation fermée. Les parties déjà terminées restent comptées." });
                  }}
                  className="rounded-lg border border-paper/30 px-3 py-1.5 font-mono text-xs uppercase text-paper/70 hover:border-red hover:text-red"
                >
                  Fermer la simulation
                </button>
                {!session.token && (
                  <span className="self-center font-mono text-[11px] text-paper/50">Les parties ne comptent plus pour aujourd&apos;hui.</span>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="font-body text-paper/80">
                La simulation s&apos;ouvre ici même. Réussis-la pour gagner un point de {factorLabel.toLowerCase()} ; un échec
                ne fait rien perdre.
              </p>
              <button
                onClick={start}
                disabled={starting || Boolean(disabledReason)}
                className="rounded-lg bg-red px-5 py-2.5 font-display uppercase tracking-wide text-ink hover:bg-red-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                {starting ? "Lancement…" : "Lancer la simulation"}
              </button>
              {disabledReason && <p className="font-mono text-xs text-paper/60">{disabledReason}</p>}
            </div>
          )}
        </div>

        <aside className="glass-card space-y-4 p-5">
          {overview ? (
            <>
              <MemberStatBars
                stats={{ intelligence: overview.intelligence, strength: overview.strength, technique: overview.technique }}
                power={overview.power}
                highlight={site.factor}
              />
              <p className="border-t border-white/10 pt-3 font-mono text-xs text-paper/60">
                Résultats comptés aujourd&apos;hui :{" "}
                <span className="whitespace-nowrap text-paper">
                  {doneToday} / {maxPerDay}
                </span>
              </p>
            </>
          ) : (
            <p className="font-body text-sm text-paper/60">
              {overviewError ? "Statistiques indisponibles pour le moment." : "Chargement…"}
            </p>
          )}
        </aside>
      </div>

      {recentRuns.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-paper/50">Mes dernières parties</h2>
          <div className="glass-card divide-y divide-white/10">
            {recentRuns.map((r) => (
              <div key={r.started_at} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 font-mono text-xs">
                <span className="text-paper/60">{new Date(r.started_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                <span
                  className={clsx(
                    r.status === "success" && "text-blue-light",
                    r.status === "failure" && "text-red-light",
                    (r.status === "abandoned" || r.status === "expired") && "text-paper/50"
                  )}
                >
                  {RUN_STATUS_LABELS[r.status]}
                  {r.status === "success" && ` (+${r.points_awarded})`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
