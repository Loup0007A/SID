"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DragonSvg } from "@/components/titles/TitleVisuals";
import type { ActiveTroll } from "@/lib/titles";
import { connectArena, type ArenaBattle, type ArenaRole } from "@/lib/arenaRelay";
import { DRAGON_FINALES, readOptions } from "@/lib/trollOptions";
import { SIMULATION_SITES } from "@/lib/simulationSites";
import { announceActivity } from "@/lib/presence";
import { SidIcon, Glyph } from "@/components/icons/SidIcon";

/** Page de l'arène dans le jeu 3D (surchargeable pour les essais). */
const ARENA_URL = process.env.NEXT_PUBLIC_ARENA_URL || `${SIMULATION_SITES.donjons.url ?? "https://loup0007a.github.io/3D-game-world/"}arena.html`;
const PLAYER_WAIT = 15; // secondes avant l'entrée automatique d'un joueur convoqué
const TRIBUNE_WAIT = 15; // secondes avant l'ouverture de la tribune

type Stage = "call" | "chip" | "arena" | "fled";
const UUID = /^[0-9a-f-]{36}$/i;

function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/**
 * Défi du Dragon : convocation (joueur), tribune (tout le S.I.D.) ou retour
 * dans son arène (dragon), puis le jeu 3D en plein écran, relié aux autres
 * par la page (lib/arenaRelay).
 */
export function DragonArena({
  troll,
  me,
  autoOpen,
  onDone,
}: {
  troll: ActiveTroll;
  me: { id: string; name: string };
  autoOpen: boolean;
  onDone: () => void;
}) {
  const supabase = createClient();
  const role = (troll.role === "dragon" || troll.role === "player" ? troll.role : "spectator") as ArenaRole;
  const o = readOptions("defi_dragon", troll.params, troll.level);
  const [stage, setStage] = useState<Stage>(role === "dragon" ? (autoOpen ? "arena" : "chip") : "call");
  const [left, setLeft] = useState(role === "player" ? PLAYER_WAIT : TRIBUNE_WAIT);
  const frame = useRef<HTMLIFrameElement>(null);
  const phaseRef = useRef<string>("loading");
  const finished = useRef(false);
  const answered = useRef(false);

  const battle: ArenaBattle = useMemo(() => {
    const order = (troll.params?.players as string[] | undefined) ?? [];
    const players = [...(troll.players ?? [])].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return {
      id: String(troll.id),
      actor: { id: troll.actor_id, name: troll.actor },
      players,
      skin: o.skin,
      finale: o.finale,
      spectators: o.spectators,
    };
  }, [troll.id, troll.actor_id, troll.actor, troll.players, troll.params, o.skin, o.finale, o.spectators]);

  const others = battle.players.filter((p) => p.id !== me.id).map((p) => p.name);

  const answer = useCallback(
    async (result: "fuite" | "tribune") => {
      if (answered.current) return;
      answered.current = true;
      await supabase.rpc("answer_troll", { p_id: troll.id, p_result: result });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [troll.id]
  );

  const finish = useCallback(
    async (winner: string, victim: unknown, details: Record<string, unknown> = {}) => {
      if (finished.current || role === "spectator") return;
      if (!["dragon", "joueurs", "annule"].includes(winner)) return;
      finished.current = true;
      await supabase.rpc("arena_finish", {
        p_id: troll.id,
        p_winner: winner,
        p_victim: typeof victim === "string" && UUID.test(victim) ? victim : null,
        p_details: details,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [troll.id, role]
  );

  // Décompte avant l'entrée (joueur) ou la tribune (spectateur).
  useEffect(() => {
    if (stage !== "call") return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [stage]);
  useEffect(() => {
    if (stage === "call" && left <= 0) setStage("arena");
  }, [left, stage]);

  // Le jeu en plein écran, et le relais temps réel.
  useEffect(() => {
    if (stage !== "arena") return;
    const origin = new URL(ARENA_URL).origin;
    const toGame = (msg: Record<string, unknown>) => {
      if (msg.action === "event" && msg.event === "phase") {
        const p = (msg.payload as { p?: string } | undefined)?.p;
        if (p) phaseRef.current = p;
      }
      frame.current?.contentWindow?.postMessage(msg, origin);
    };
    const relay = connectArena(supabase, battle, role, me, toGame);
    function onMessage(e: MessageEvent) {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data as Record<string, unknown> | null;
      if (!d || d.type !== "mv-arena") return;
      if (d.action === "ready") relay.gameReady();
      else if (d.action === "send" && typeof d.event === "string") {
        if (d.event === "phase") {
          const p = (d.payload as { p?: string } | undefined)?.p;
          if (p) phaseRef.current = p;
        }
        relay.fromGame(d.event, d.payload);
      } else if (d.action === "end") {
        void finish(String(d.winner ?? ""), d.victim, typeof d.raison === "string" ? { raison: d.raison } : {});
      } else if (d.action === "close") {
        onDone();
      }
    }
    window.addEventListener("message", onMessage);
    announceActivity(role === "dragon" ? "arene_dragon" : role === "player" ? "arene_joueur" : "arene_tribune");
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("message", onMessage);
      announceActivity(null);
      relay.close();
      html.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  async function flee() {
    await answer("fuite");
    setStage("fled");
    setTimeout(onDone, 2600);
  }

  async function quitArena() {
    const phase = phaseRef.current;
    const done = finished.current || phase === "finale" || phase === "end";
    if (role === "dragon") {
      if (!done && !window.confirm(phase === "lobby" || phase === "loading" ? "Annuler la bataille ? Les options payées te sont remboursées." : "Quitter maintenant ? Les joueurs gagneront.")) return;
      if (!done) await finish(phase === "lobby" || phase === "loading" ? "annule" : "joueurs", null, { raison: "abandon_du_dragon" });
    } else if (role === "player") {
      if (!done && !window.confirm(`Fuir l'arène ? ${troll.actor} saura que tu as fui.`)) return;
      if (!done) await answer("fuite");
    } else {
      await answer("tribune");
    }
    onDone();
  }

  async function cancelFromChip() {
    if (!window.confirm("Annuler ta bataille ? Les options payées sont remboursées pendant les 4 minutes qui suivent le lancement.")) return;
    await finish("annule", null, { raison: "annulee" });
    onDone();
  }

  /* ------------------------- Rendu ------------------------- */

  if (stage === "arena") {
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    const src = `${ARENA_URL}?arena=${encodeURIComponent(battle.id)}&role=${role}${coarse ? "&q=low" : ""}`;
    return (
      <div data-troll-ui className="fixed inset-0 z-[9600] bg-black">
        <iframe
          ref={frame}
          src={src}
          title="Arène du Dragon"
          className="block h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms"
          allow="fullscreen; gamepad; autoplay"
          allowFullScreen
        />
        <button
          onClick={quitArena}
          className="absolute right-3 top-3 z-10 rounded-full border border-white/25 bg-black/60 px-3 py-1.5 font-mono text-[11px] text-paper/80 backdrop-blur hover:bg-black/80 sm:right-auto sm:left-1/2 sm:top-auto sm:bottom-3 sm:-translate-x-1/2"
        >
          {role === "dragon" ? "✕ Quitter l'arène" : role === "player" ? <><SidIcon name="runner" /> Fuir l&apos;arène</> : "✕ Quitter la tribune"}
        </button>
      </div>
    );
  }

  if (stage === "chip") {
    return (
      <div data-troll-ui className="fixed bottom-16 right-3 z-[9460] w-[min(320px,calc(100vw-1.5rem))] space-y-2 rounded-xl border border-[#ff7a2f]/50 bg-black/85 p-3 font-body text-sm text-paper shadow-[0_0_30px_-8px_#ff5a1f] backdrop-blur">
        <p className="font-display uppercase tracking-wide text-[#ffb15c]"><SidIcon name="dragon" /> Ton arène t&apos;attend</p>
        <p className="text-paper/75">Défi contre {listNames(battle.players.map((p) => p.name))}.</p>
        <div className="flex gap-2">
          <button onClick={() => setStage("arena")} className="flex-1 rounded-lg bg-gradient-to-r from-[#ff7a2f] to-[#b3121b] px-3 py-1.5 font-display text-xs uppercase tracking-wide text-ink">
            Y retourner
          </button>
          <button onClick={cancelFromChip} className="rounded-lg border border-white/20 px-3 py-1.5 font-mono text-xs text-paper/70 hover:bg-white/10">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (stage === "fled") {
    return (
      <div data-troll-ui className="dragon-duel fixed inset-0 z-[9300] flex items-center justify-center p-4 text-paper">
        <div className="dragon-duel-sky absolute inset-0" />
        <div className="relative z-10 max-w-md space-y-3 text-center">
          <p className="text-6xl"><SidIcon name="runner" /><SidIcon name="runner" /></p>
          <p className="font-display text-2xl uppercase tracking-wide">Tu as fui</p>
          <p className="font-body text-paper/75">{troll.actor} est prévenu. Le dragon se souviendra de ta lâcheté…</p>
        </div>
      </div>
    );
  }

  // Convocation.
  if (role === "player") {
    return (
      <div data-troll-ui className="dragon-duel fixed inset-0 z-[9300] flex flex-col items-center justify-center overflow-hidden p-4 text-paper">
        <div className="dragon-duel-sky absolute inset-0" />
        <div className="dragon-duel-flyby absolute">
          <DragonSvg breathing />
        </div>
        <div className="relative z-10 max-w-lg space-y-4 text-center">
          <p className="dragon-roar font-display text-5xl uppercase tracking-wider text-[#ffb15c] sm:text-6xl">ROOOAAAR</p>
          <p className="font-display text-2xl uppercase tracking-wide">{troll.actor} s&apos;est changé en dragon</p>
          <p className="font-body text-paper/85">
            Il te convoque dans son arène, dans le monde 3D{others.length ? `, avec ${listNames(others)}` : ""}. Éclairs de lumière contre souffle de
            feu : abats-le avant la fin du temps, ou fuis.
          </p>
          <p className="font-mono text-xs text-paper/60">
            {o.spectators ? <><SidIcon name="megaphone" /> Tout le S.I.D. regarde depuis la tribune. </> : ""}
            {o.finale ? <><Glyph e={DRAGON_FINALES[o.finale].emoji} /> S&apos;il gagne : {DRAGON_FINALES[o.finale].label.toLowerCase()} en cinématique.</> : ""}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button onClick={() => setStage("arena")} className="rounded-lg bg-gradient-to-r from-[#ff7a2f] to-[#b3121b] px-6 py-3 font-display text-lg uppercase tracking-wide text-ink shadow-lg shadow-red-900/50">
              <SidIcon name="swords" /> Entrer dans l&apos;arène
            </button>
            <button onClick={flee} className="rounded-lg border border-white/30 bg-black/40 px-6 py-3 font-display text-lg uppercase tracking-wide text-paper/80 hover:bg-white/10">
              <SidIcon name="runner" /> Fuir
            </button>
          </div>
          <p className="font-mono text-[11px] text-paper/65">Entrée automatique dans {Math.max(0, left)} s…</p>
        </div>
      </div>
    );
  }

  return (
    <div data-troll-ui className="fixed inset-x-3 top-3 z-[9460] mx-auto max-w-xl overflow-hidden rounded-xl border border-[#ff7a2f]/50 bg-black/90 text-paper shadow-[0_0_40px_-6px_#ff5a1f] backdrop-blur">
      <div className="dragon-duel-sky absolute inset-0 opacity-60" />
      <div className="relative flex items-center gap-3 p-3">
        <div className="w-24 shrink-0 sm:w-28">
          <DragonSvg breathing />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-sm uppercase tracking-wide text-[#ffb15c]"><SidIcon name="megaphone" /> Tout le S.I.D. en tribune !</p>
          <p className="font-body text-sm text-paper/85">
            {troll.actor} s&apos;est changé en dragon et affronte {listNames(battle.players.map((p) => p.name))} dans l&apos;arène.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={() => setStage("arena")} className="rounded-lg bg-gradient-to-r from-[#ff7a2f] to-[#b3121b] px-3 py-1.5 font-display text-xs uppercase tracking-wide text-ink">
              <SidIcon name="camera" /> Regarder ({Math.max(0, left)} s)
            </button>
            <button
              onClick={async () => {
                await answer("tribune");
                onDone();
              }}
              className="rounded-lg border border-white/20 px-3 py-1.5 font-mono text-xs text-paper/70 hover:bg-white/10"
            >
              Pas cette fois
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
