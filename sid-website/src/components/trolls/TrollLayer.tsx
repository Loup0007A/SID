"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/session";
import { POWERS, TROLLS_REFRESH_EVENT, type ActiveTroll } from "@/lib/titles";
import dynamic from "next/dynamic";
import { readOptions } from "@/lib/trollOptions";

// Chaque effet n'est téléchargé que lorsqu'une farce de ce type vise le
// membre : sans farce en cours, rien de tout cela n'est chargé.
const DragonArena = dynamic(() => import("@/components/trolls/DragonArena").then((m) => m.DragonArena), { ssr: false });
const CalcGate = dynamic(() => import("@/components/trolls/GateEffects").then((m) => m.CalcGate), { ssr: false });
const ContractGate = dynamic(() => import("@/components/trolls/GateEffects").then((m) => m.ContractGate), { ssr: false });
const Haunt404 = dynamic(() => import("@/components/trolls/GateEffects").then((m) => m.Haunt404), { ssr: false });
const BatSwarm = dynamic(() => import("@/components/trolls/EventEffects").then((m) => m.BatSwarm), { ssr: false });
const Blizzard = dynamic(() => import("@/components/trolls/EventEffects").then((m) => m.Blizzard), { ssr: false });
const AprilFools = dynamic(() => import("@/components/trolls/HolidayEffects").then((m) => m.AprilFools), { ssr: false });
const EasterBells = dynamic(() => import("@/components/trolls/HolidayEffects").then((m) => m.EasterBells), { ssr: false });
const Fanfare = dynamic(() => import("@/components/trolls/HolidayEffects").then((m) => m.Fanfare), { ssr: false });
const Fireworks = dynamic(() => import("@/components/trolls/HolidayEffects").then((m) => m.Fireworks), { ssr: false });
const GeneralStrike = dynamic(() => import("@/components/trolls/HolidayEffects").then((m) => m.GeneralStrike), { ssr: false });
const LoveStorm = dynamic(() => import("@/components/trolls/HolidayEffects").then((m) => m.LoveStorm), { ssr: false });
const Truce = dynamic(() => import("@/components/trolls/HolidayEffects").then((m) => m.Truce), { ssr: false });
const AbyssEffect = dynamic(() => import("@/components/trolls/AmbientEffects").then((m) => m.AbyssEffect), { ssr: false });
const Bailiff = dynamic(() => import("@/components/trolls/AmbientEffects").then((m) => m.Bailiff), { ssr: false });
const LinkScramble = dynamic(() => import("@/components/trolls/AmbientEffects").then((m) => m.LinkScramble), { ssr: false });
const MirrorEffect = dynamic(() => import("@/components/trolls/AmbientEffects").then((m) => m.MirrorEffect), { ssr: false });
const PartyMode = dynamic(() => import("@/components/trolls/AmbientEffects").then((m) => m.PartyMode), { ssr: false });
const Rationing = dynamic(() => import("@/components/trolls/AmbientEffects").then((m) => m.Rationing), { ssr: false });
const RewriteEffect = dynamic(() => import("@/components/trolls/AmbientEffects").then((m) => m.RewriteEffect), { ssr: false });
const Assaut = dynamic(() => import("@/components/trolls/HuntEffects").then((m) => m.Assaut), { ssr: false });

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
  nuee: "des chauves-souris partout",
  blizzard: "tempête de neige",
  coup_de_foudre: "des cœurs partout",
  poisson: "des poissons collés partout",
  cloches: "il pleut des œufs",
  greve: "les boutons sont en grève",
  fanfare: "tout danse",
  artifice: "le ciel s'embrase",
  treve: "aucune autre farce ne peut te viser",
  assaut: "une wyverne s'abat sur ta page",
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
    currentUser().then(({ data }) => setMyId(data.user?.id ?? null));
    const poll = setInterval(refresh, 20000);
    // Une farce vient d'être lancée d'ici (l'arène du dragon s'ouvre aussitôt).
    const onLaunched = (e: Event) => {
      const id = (e as CustomEvent<{ open?: number | null }>).detail?.open;
      if (id) openNow.current = id;
      refresh();
    };
    window.addEventListener(TROLLS_REFRESH_EVENT, onLaunched);
    return () => {
      clearInterval(poll);
      window.removeEventListener(TROLLS_REFRESH_EVENT, onLaunched);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // Au chargement puis à chaque changement de page.
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  // Compte à rebours des farces : l'horloge ne tourne que s'il y en a.
  const hasTrolls = trolls.length > 0;
  useEffect(() => {
    if (!hasTrolls) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [hasTrolls]);

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
      {has("nuee") && <BatSwarm troll={has("nuee")!} />}
      {has("blizzard") && <Blizzard troll={has("blizzard")!} />}
      {has("coup_de_foudre") && <LoveStorm troll={has("coup_de_foudre")!} />}
      {has("poisson") && <AprilFools troll={has("poisson")!} />}
      {has("cloches") && <EasterBells troll={has("cloches")!} />}
      {gated && has("greve") && <GeneralStrike troll={has("greve")!} />}
      {has("fanfare") && <Fanfare troll={has("fanfare")!} />}
      {has("artifice") && <Fireworks troll={has("artifice")!} />}
      {has("treve") && <Truce troll={has("treve")!} />}
      {has("assaut") && <Assaut troll={has("assaut")!} />}

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
