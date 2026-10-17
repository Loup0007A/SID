"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { POWERS, TROLLS_REFRESH_EVENT, type ActiveTroll } from "@/lib/titles";
import { DragonArena } from "@/components/trolls/DragonArena";
import { readOptions } from "@/lib/trollOptions";
import { CalcGate, ContractGate, Haunt404 } from "@/components/trolls/GateEffects";
import { AbyssEffect, Bailiff, LinkScramble, MirrorEffect, PartyMode, Rationing, RewriteEffect } from "@/components/trolls/AmbientEffects";

const CHIP_TEXT: Partial<Record<ActiveTroll["power"], string>> = {
  flatterie: "tes messages se terminent par un compliment pour lui",
  reseau: "les liens ne mènent plus où tu crois",
  rationnement: "un clic de temps en temps, pas plus",
  miroir: "le monde est à l'envers",
  reecriture: "les mots ont changé",
  abysses: "tu coules",
  huissier: "tes biens sont sous scellés",
  fete: "c'est la fête",
  hantise: "tes pages sont hantées",
  calcul: "calcul mental à chaque page",
  avenant: "un contrat à chaque page",
  defi_dragon: "un dragon te défie",
};

function chipText(t: ActiveTroll) {
  if (t.power === "rationnement") return `un clic toutes les ${readOptions("rationnement", t.params, t.level).interval} secondes`;
  return CHIP_TEXT[t.power];
}

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Applique les farces en cours qui visent le membre connecté. Interroge la
 * base toutes les 20 s et à chaque changement de page.
 */
export function TrollLayer({ nickname }: { nickname: string }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [trolls, setTrolls] = useState<ActiveTroll[]>([]);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [mounted, setMounted] = useState(false);
  // L'arène reste affichée jusqu'au bout, même une fois la bataille terminée.
  const [arena, setArena] = useState<ActiveTroll | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const openNow = useRef<number | null>(null);
  const seen = useRef<Map<number, ActiveTroll>>(new Map());

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_trolls");
    if (error) return;
    setTrolls((data ?? []) as ActiveTroll[]);
  }, [supabase]);

  useEffect(() => {
    setMounted(true);
    refresh();
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
    const poll = setInterval(refresh, 20000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Une farce vient d'être lancée d'ici (l'arène du dragon s'ouvre aussitôt).
    const onLaunched = (e: Event) => {
      const id = (e as CustomEvent<{ open?: number | null }>).detail?.open;
      if (id) openNow.current = id;
      refresh();
    };
    window.addEventListener(TROLLS_REFRESH_EVENT, onLaunched);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener(TROLLS_REFRESH_EVENT, onLaunched);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  const active = trolls.filter((t) => new Date(t.ends_at).getTime() > now && !dismissed.has(t.id));

  useEffect(() => {
    if (arena) return;
    const battles = active.filter((t) => t.power === "defi_dragon");
    const rank = (t: ActiveTroll) => (t.role === "dragon" ? 0 : t.role === "player" ? 1 : 2);
    const d = battles.sort((a, b) => rank(a) - rank(b))[0];
    if (d) setArena(d);
  }, [active, arena]);

  // Fin d'une farce : petit mot pour rassurer.
  useEffect(() => {
    const ids = new Set(active.map((t) => t.id));
    seen.current.forEach((t, id) => {
      if (!ids.has(id)) {
        seen.current.delete(id);
        if (t.power !== "defi_dragon") {
          setToast(`🎭 La farce de ${t.actor} est terminée.`);
          setTimeout(() => setToast(null), 5000);
        }
      }
    });
    active.forEach((t) => seen.current.set(t.id, t));
  }, [active]);

  if (!mounted) return null;

  const gated = !pathname.startsWith("/dashboard/admin");
  const has = (p: ActiveTroll["power"]) => active.find((t) => t.power === p);

  const content = (
    <>
      {arena && myId && (
        <DragonArena
          key={arena.id}
          troll={arena}
          me={{ id: myId, name: nickname }}
          autoOpen={openNow.current === arena.id}
          onDone={() => {
            setDismissed((d) => new Set(d).add(arena.id));
            setArena(null);
          }}
        />
      )}
      {has("reseau") && <LinkScramble troll={has("reseau")!} />}
      {gated && has("calcul") && <CalcGate key={`calc-${pathname}`} troll={has("calcul")!} />}
      {gated && has("hantise") && <Haunt404 key={`haunt-${pathname}`} troll={has("hantise")!} />}
      {gated && has("avenant") && <ContractGate key={`contract-${pathname}`} troll={has("avenant")!} nickname={nickname} />}
      {has("fete") && <PartyMode troll={has("fete")!} nickname={nickname} />}
      {has("abysses") && <AbyssEffect troll={has("abysses")!} />}
      {has("huissier") && <Bailiff troll={has("huissier")!} nickname={nickname} />}
      {has("miroir") && <MirrorEffect troll={has("miroir")!} />}
      {has("reecriture") && <RewriteEffect troll={has("reecriture")!} />}
      {has("rationnement") && <Rationing troll={has("rationnement")!} />}

      {active.filter((t) => t.power !== "defi_dragon").length > 0 && (
        <div data-troll-ui className="troll-chip fixed bottom-3 left-3 z-[9450] max-w-[calc(100vw-1.5rem)] space-y-1">
          {active
            .filter((t) => t.power !== "defi_dragon")
            .map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 py-1.5 font-mono text-[11px] text-paper shadow-lg backdrop-blur">
                <span aria-hidden>🎭</span>
                <span className="truncate">
                  <strong>{t.actor}</strong> · {POWERS[t.power]?.name ?? t.power} — {chipText(t)}
                </span>
                <span className="shrink-0 tabular-nums text-paper/60">{mmss(new Date(t.ends_at).getTime() - now)}</span>
              </div>
            ))}
        </div>
      )}

      {toast && (
        <div data-troll-ui className="fixed bottom-3 left-1/2 z-[9450] -translate-x-1/2 rounded-full border border-white/15 bg-black/85 px-4 py-2 font-mono text-xs text-paper shadow-lg">
          {toast}
        </div>
      )}
    </>
  );

  return createPortal(content, document.body);
}
