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
  STAT_LABELS,
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

type Session = { token: string; iframeUrl: string };

export default function SimulationPage() {
  const params = useParams<{ kind: string }>();
  const kind = params.kind;
  const supabase = createClient();

  const [overview, setOverview] = useState<SimulationOverview | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameBoxRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);

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

  const submitResult = useCallback(
    async (token: string, success: boolean, signature?: string) => {
      if (submitting.current) return;
      submitting.current = true;
      try {
        const res = await fetch("/api/simulations/result", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(signature ? { "X-SID-Signature": signature } : {}) },
          body: JSON.stringify({ token, success }),
        });
        const data = (await res.json()) as SimulationResultResponse;
        const finished = data.ok || data.result === "already_completed";
        if (finished && data.result === "already_completed") {
          // Le site a déjà envoyé le résultat lui-même : on affiche simplement le bilan.
          setNotice({ tone: "info", text: "Partie terminée, résultat enregistré." });
        } else {
          setNotice({ tone: data.ok && data.status === "success" ? "good" : data.ok ? "info" : "bad", text: data.message });
        }
        // « Trop tôt » : la partie reste ouverte, un vrai résultat pourra suivre.
        if (data.result !== "too_fast") setSession(null);
        await refresh();
      } catch {
        setNotice({ tone: "bad", text: "Impossible d'enregistrer le résultat (problème de connexion). Réessaie depuis la simulation." });
      } finally {
        submitting.current = false;
      }
    },
    [refresh]
  );

  // Le site de la simulation (dans l'iframe) annonce la fin de partie avec
  // window.parent.postMessage({ type: "sid:simulation-result", token, success }, "*").
  // On n'écoute que CE site, et que l'iframe affichée ici.
  useEffect(() => {
    if (!session || !origin) return;
    const active = session;
    function onMessage(e: MessageEvent) {
      if (e.origin !== origin || e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as { type?: unknown; token?: unknown; success?: unknown; signature?: unknown } | null;
      if (!d || d.type !== RESULT_MESSAGE_TYPE || d.token !== active.token || typeof d.success !== "boolean") return;
      void submitResult(active.token, d.success, typeof d.signature === "string" ? d.signature : undefined);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [session, origin, submitResult]);

  async function start() {
    if (!site) return;
    setStarting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/simulations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: site.kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ tone: "bad", text: data.error ?? "Impossible de lancer la simulation." });
        return;
      }
      setSession({ token: data.token, iframeUrl: data.iframe_url });
    } catch {
      setNotice({ tone: "bad", text: "Impossible de lancer la simulation (problème de connexion)." });
    } finally {
      setStarting(false);
    }
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
  const recentRuns = (overview?.recent_runs ?? []).filter((r) => r.kind === site.kind);

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
        <div className="glass-card space-y-4 p-5">
          {session ? (
            <>
              <div
                ref={frameBoxRef}
                className="overflow-hidden rounded-lg border border-white/15 bg-black"
              >
                <iframe
                  ref={iframeRef}
                  src={session.iframeUrl}
                  title={`Simulation ${site.label}`}
                  className="h-[70vh] min-h-[420px] w-full"
                  sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms"
                  allow="fullscreen; gamepad; autoplay"
                  allowFullScreen
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => frameBoxRef.current?.requestFullscreen?.()}
                  className="rounded-lg border border-blue px-3 py-1.5 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink"
                >
                  Plein écran
                </button>
                <button
                  onClick={() => {
                    setSession(null);
                    setNotice({ tone: "info", text: "Simulation quittée : aucun point gagné ni perdu." });
                  }}
                  className="rounded-lg border border-paper/30 px-3 py-1.5 font-mono text-xs uppercase text-paper/70 hover:border-red hover:text-red"
                >
                  Quitter la simulation
                </button>
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
